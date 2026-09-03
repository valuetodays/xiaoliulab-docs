---
title: Spring Boot 单体应用中的接口安全边界设计
description: 从调用方身份和信任模型出发，讨论为什么应区分 /api、/open、/callback、内部接口和管理接口，并给出一套可维护的路径约定。
date: 2026-09-02
tags:
  - Spring Boot
  - API
  - 接口设计
  - 安全
  - Callback
category:
  - 探索技术
  - Spring Boot
---

# Spring Boot 单体应用中的接口安全边界设计

## 背景

在一个 Spring Boot 单体应用中，接口最开始往往只是按业务模块组织。

随着系统逐渐接入页面端、第三方系统、异步回调、内部服务和运维能力后，不同接口面对的调用方已经完全不同。

例如：

- 页面用户调用接口时，系统关心的是登录态和用户身份；
- 外部系统主动调用接口时，系统关心的是 Client 身份、Token、签名、IP 和限流；
- 第三方回调接口则更关注签名校验、重复通知、幂等和状态流转；
- 内部服务接口通常依赖内网、服务身份或固定访问范围；
- 管理和运维接口则需要更严格的认证、权限和审计。

如果这些接口仍然混在同一套路径规则下，安全代码就很容易逐渐变成大量例外判断：

```text
这个接口需要登录
这个接口不用登录
这个接口要验签
这个接口只允许某些 IP
这个接口允许第三方重复调用
这个接口只能内部访问
```

随着接口数量增加，路径本身无法表达接口属于哪一种安全域，安全配置和业务代码都会越来越难理解和维护。

因此，接口路径不应该只用于区分业务模块。

更重要的是：

> **接口路径应该反映调用方身份、信任边界和安全处理方式。**

基于这个原则，可以将接口划分为不同的安全域：

```text
/api/**          页面用户
/open/**         外部系统主动调用
/callback/**     第三方异步通知
/*-internal/**   内部服务
/admin/**        管理和运维接口
```

这样的划分不是为了让 URL 看起来更整齐，而是为了让系统在请求进入业务代码之前，就能够明确：

> 这个请求来自谁，应该信任到什么程度，以及应该执行哪一套安全规则。

## 路径本身没有统一标准

对于第三方回调接口，实际项目中可以看到很多不同写法，例如：

```text
/api/{channel}/{business}/callback
/api/callback/{channel}/{business}
/api/{channel}/{business}_callback
/api/{channel}/callback_{business}
```

从 HTTP 和 Spring MVC 的角度看，这些写法都可以正常工作。

它们之间并不存在一个通用的行业标准，要求所有系统必须采用其中某一种形式。

真正需要考虑的是：

> **路径能否稳定表达接口的安全属性，而不是只表达业务归属。**

例如：

```text
/api/lianlian/payment/callback
```

从业务角度很容易理解：

```text
连连
└─ 支付
   └─ 回调
```

但如果系统需要统一处理所有第三方回调请求，就会发现：

```text
/api/lianlian/payment/callback
/api/wechat/pay/callback
/api/alipay/refund/callback
/api/xxx/transfer/callback
```

这些接口虽然都属于第三方回调，却散落在 `/api/**` 的不同位置。

安全层需要不断判断：

```text
这个 /api 接口需要登录吗？

不需要，因为它是 callback。

那这个呢？

也不需要。

这个呢？

还是 callback。
```

久而久之，`/api/**` 就不再代表一种稳定的信任模型。

## `/api/**`：页面用户安全域

`/api/**` 主要面向 PC、H5、App 页面等业务用户。

这一类请求通常具备明确的用户身份。

典型路径：

```text
/api/order/list
/api/account/info
/api/exchange/create
```

其核心信任模型是：

```text
请求
↓
识别用户
↓
校验登录态
↓
校验权限
↓
执行业务
```

重点关注的问题通常包括：

- 用户是否登录；
- 当前用户是谁；
- 是否拥有当前资源的访问权限；
- 是否存在越权访问；
- 是否需要验证码；
- 是否存在异常频率访问；
- 浏览器请求是否具有明显异常特征。

因此：

> `/api/**` 代表的是“用户身份安全域”。

## `/api/**/public/**`：页面安全域中的匿名接口

`/api/**/public/**` 不是通用行业规范，而是项目内部约定。

它主要解决一个很实际的问题：

> 不希望在安全配置中长期维护一份不断增长的匿名接口白名单。

很多系统会存在类似接口：

```text
/api/login
/api/captcha
/api/oauth/exchange
/api/register
/api/password/reset
```

如果采用传统做法，安全配置里往往需要逐个声明这些匿名路径。

随着业务增加，这份白名单会不断增长。

更麻烦的是，新增一个匿名接口时，还必须同步修改安全配置。

如果忘记修改，就可能出现两种结果：

- 本应匿名访问的接口被登录校验拦住；
- 为了解决问题，又临时增加一个新的例外。

久而久之，安全配置会变成一份和业务代码分离的路径清单。

因此，项目约定：

```text
/api/**/public/**
```

统一表示页面端可以匿名访问的接口。

例如：

```text
/api/auth/public/login
/api/oauth/public/exchange
/api/captcha/public/create
```

这样安全层只需要识别统一的路径特征，而不需要维护每一个具体 URL。

其核心思想是：

> **让“是否需要登录”成为路径自身可以表达的属性。**

在实现层面，可以直接通过统一路径匹配进行判断，而不是查询一张额外的白名单。

需要注意：

`/api/**/public/**` 仍然属于 `/api` 页面安全域。

它只是：

> `/api` 中不要求登录的一类接口。

它并不等价于 `/open/**`。

两者的区别在于：

```text
/api/**/public/**   面向页面用户，只是当前没有登录态
/open/**            面向外部系统，识别的是 Client 身份
```

因此，不能简单地把“无需登录”等同于“开放 API”。

## `/open/**`：外部系统主动调用

`/open/**` 面向合作方、第三方系统或其他外部服务主动调用。

例如：

```text
/open/lianlian/order/query
/open/partner/payment/create
/open/merchant/account/balance
```

这里通常不存在页面用户登录态。

系统更关心的是：

```text
调用方是谁？
↓
是否有资格调用这个接口？
↓
请求是否可信？
↓
调用频率是否正常？
```

常见安全手段包括：

- Client ID；
- API Token；
- API Key；
- 请求签名；
- 时间戳；
- Nonce；
- IP 白名单；
- 防重放；
- Client + URI 维度限流；
- 调用权限控制。

因此：

> `/open/**` 代表的是“外部系统主动调用安全域”。

它和 `/api/**` 的根本区别不是“登录”和“不登录”，而是：

```text
/api   识别的是用户身份
/open  识别的是系统或 Client 身份
```

### `/open/**` 还可以进一步演进为独立服务

`/open/**` 和其他几个安全域还有一个不同点：

> 它比较容易从“路径级安全域”进一步演进成“服务级安全域”。

当外部 API 的数量、调用方、认证方式或流量逐渐增加后，可以考虑将 Open API 从原业务应用中独立出来，并使用单独的域名，例如：

```text
https://open.example.com/**
```

相比：

```text
https://www.example.com/open/**
```

独立服务和独立域名可以进一步隔离：

- 部署和扩容；
- API 网关与路由；
- Client 认证；
- 签名和防重放；
- 限流策略；
- WAF 规则；
- 日志与监控；
- API 版本管理；
- 对外文档和 SLA。

因此，`/open/**` 可以看作单体阶段的一种安全域划分。

当 Open API 已经形成相对独立的对外能力时：

```text
/open/**
    ↓
独立 Open API 服务
    ↓
open.example.com
```

往往是更清晰的演进方式。

但 `/api/**` 和 `/callback/**` 通常没有这么强的独立性。

`/api/**` 直接服务于当前业务系统的页面用户，通常与登录态、用户权限和具体业务模型紧密关联。

`/callback/**` 虽然也是外部请求，但收到通知后往往需要直接驱动当前系统中的订单、支付、退款或其他业务状态流转，因此也通常与具体业务系统保持较强关联。

所以：

> **`/open/**` 更容易独立成一个对外服务，而 `/api/**` 和 `/callback/**` 更多时候仍然属于当前业务系统内部的接口边界。**

这里讨论的是常见的架构演进方向，而不是说 `/api/**` 或 `/callback/**` 在技术上绝对不能拆分。

## `/callback/**`：第三方异步通知

`/callback/**` 面向第三方系统异步通知。

例如：

```text
/callback/lianlian/payment/success
/callback/lianlian/payment/reject
/callback/wechat/payment/notify
/callback/alipay/refund/notify
```

从表面上看，它与 `/open/**` 很像：

- 都不是页面请求；
- 都不走用户登录；
- 都由外部系统调用。

但两者的信任模型并不相同。

`/open/**` 通常是：

```text
对方主动请求我们的能力
```

而 `/callback/**` 通常是：

```text
之前发生了一笔业务
↓
第三方在未来某个时间通知处理结果
↓
系统根据通知推进业务状态
```

因此回调接口最重要的问题不是：

> 对方有没有资格调用我的业务 API？

而是：

> 这条通知是真是假、有没有处理过、现在还能不能处理？

回调接口通常需要重点处理：

- 签名验证；
- 证书验证；
- 时间戳；
- 防重放；
- 重复通知；
- 幂等；
- 乱序通知；
- 状态机校验；
- 第三方重试；
- 回调响应格式。

例如第三方可能连续发送：

```text
SUCCESS
SUCCESS
SUCCESS
```

系统不能因为收到三次通知，就执行三次业务操作。

也可能出现：

```text
SUCCESS
↓
较早发送的 PROCESSING 延迟到达
```

此时也不能让业务状态从成功重新退回处理中。

因此：

> `/callback/**` 代表的是“异步事件通知安全域”。

## 为什么不建议继续使用 `/api/{channel}/{business}/callback`

例如：

```text
/api/lianlian/payment/callback
```

这个路径本身没有技术问题。

如果系统很小，只有一两个回调接口，这样设计完全可以正常使用。

问题出现在系统逐渐扩大以后。

假设有：

```text
/api/lianlian/payment/callback
/api/lianlian/refund/callback
/api/wechat/payment/callback
/api/alipay/refund/callback
```

从业务目录看，它们的位置很自然。

但从安全系统看，它们全部隐藏在 `/api/**` 中。

安全层很难通过路径第一时间判断：

```text
这是普通页面 API
还是第三方通知？
```

于是配置容易逐渐变成：

```text
/api/** 默认需要登录

但是排除：
/api/lianlian/payment/callback
/api/lianlian/refund/callback
/api/wechat/payment/callback
/api/alipay/refund/callback
...
```

这种模型的问题不是不能工作，而是：

> **系统依赖越来越多的例外，而不是依赖稳定的规则。**

相比之下：

```text
/callback/**
```

本身就可以代表一套安全策略。

例如：

```text
/callback/**
    → 不走用户登录
    → CallbackSignatureVerifier
    → ReplayProtection
    → IdempotencyCheck
    → CallbackStateValidator
```

安全配置会更容易理解。

## 推荐的回调路径结构

如果已经决定将 callback 作为独立安全域，可以采用：

```text
/callback/{channel}/{business}/{event}
```

例如：

```text
/callback/lianlian/payment/success
/callback/lianlian/payment/reject
/callback/lianlian/refund/success
/callback/wechat/payment/notify
```

路径从左到右表达：

```text
安全域
↓
渠道
↓
业务
↓
事件
```

即：

```text
callback
└─ lianlian
   └─ payment
      ├─ success
      └─ reject
```

这样既保留了业务归属，也保留了统一安全入口。

相比：

```text
/api/lianlian/payment_callback
```

或者：

```text
/api/lianlian/callback_payment
```

这种结构更容易长期维护。

这里需要强调：

> 这不是行业统一标准，而是基于安全边界的一种推荐约定。

重点不在于 `callback` 这个单词必须出现在 URL 最前面。

重点在于：

> 所有属于同一种信任模型的接口，最好能够通过稳定的路径规则被识别出来。

## `/*-internal/**`：内部服务接口

内部服务接口面向：

- 其他内部服务；
- 定时任务；
- 数据同步程序；
- 内部脚本；
- 受控基础设施。

例如：

```text
/order-internal/replay
/payment-internal/sync
/account-internal/rebuild
```

这一类接口一般不应该被普通公网调用方直接访问。

典型安全模型包括：

- VPC / 内网；
- 固定网段；
- IP 白名单；
- Service Token；
- mTLS；
- 服务身份认证。

因此：

> `/*-internal/**` 代表的是“内部服务安全域”。

如果当前系统还没有真正使用内部接口，也可以先预留该路径约定，而不急于实现完整认证体系。

## `/admin/**` 与 `/ops/**`：管理和运维接口

还有一些接口既不属于普通业务用户，也不属于第三方系统，例如：

```text
/admin/user/disable
/admin/order/retry
/ops/cache/clear
/ops/task/rebuild
```

这些接口通常具备较高权限。

安全重点包括：

- 强认证；
- 角色权限；
- 最小权限；
- 操作审计；
- 网络访问限制；
- 操作日志；
- 高风险操作二次确认。

Spring Boot Actuator 也属于类似的管理面，只是通常使用：

```text
/actuator/**
```

单独管理。

因此：

> 管理面和业务面也不应该默认使用完全相同的安全模型。

## 最终路径约定

在单体 Spring Boot 应用中，可以使用如下路径划分：

| 路径 | 调用方 | 主要身份 | 核心安全关注 |
| --- | --- | --- | --- |
| `/api/**` | 页面用户 | User | 登录、权限、越权 |
| `/api/**/public/**` | 未登录页面用户 | Anonymous User | 验证码、限流、滥用 |
| `/open/**` | 外部系统 | Client | Token、签名、IP、限流 |
| `/callback/**` | 第三方通知系统 | Callback Sender | 签名、幂等、防重放、状态机 |
| `/*-internal/**` | 内部服务 | Service | 内网、服务身份、mTLS |
| `/admin/**`、`/ops/**` | 管理员 / 运维系统 | Admin | 强认证、权限、审计 |

如果应用配置了 Context Path：

```properties
server.servlet.context-path=/demo
```

那么实际对外路径为：

```text
/demo/api/**
/demo/open/**
/demo/callback/**
/demo/*-internal/**
/demo/admin/**
```

Controller 中仍然只声明应用内路径，不重复 `/demo`。

## 路径应该成为安全策略选择器

路径划分带来的最大价值，并不是 URL 更统一。

真正的价值是安全代码可以直接按照安全域组织：

```text
/api/**
    → User Authentication
    → Authorization
    → Browser Security

/api/**/public/**
    → Skip Login
    → Anonymous Abuse Protection

/open/**
    → Client Authentication
    → Signature
    → IP Allowlist
    → Rate Limit

/callback/**
    → Callback Signature
    → Replay Protection
    → Idempotency
    → State Validation

/*-internal/**
    → Internal Network
    → Service Authentication

/admin/**
    → Strong Authentication
    → Privilege Control
    → Audit
```

这样，请求进入 Controller 之前，系统就已经知道应该使用哪一套安全规则。

相反，如果所有接口都混在：

```text
/api/**
```

下面，安全层最终只能不断维护：

```text
这个接口例外
那个接口也例外
这个接口不用登录但要验签
那个接口不用验签但是限制 IP
```

规则越多，系统越难理解。

## 少维护一份“路径真相”

路径设计还有一个实际收益：

> 尽量不要让接口的安全属性只存在于另一份独立配置中。

例如：

```text
/api/order/list
```

从路径本身看不出它是否需要登录。

如果是否匿名完全依赖安全配置中的白名单，那么系统实际上存在两份信息：

```text
Controller 中定义接口是什么
安全配置中定义接口属于什么安全属性
```

两份信息需要长期保持同步。

而类似：

```text
/api/auth/public/login
```

至少可以直接从路径看出：

```text
这是 api 页面接口
并且属于 public 匿名区域
```

同理：

```text
/callback/lianlian/payment/success
```

可以直接看出：

```text
这是第三方 callback
不是页面 API
```

路径并不能表达全部安全规则，但它可以表达最重要的第一层分类。

这样可以减少系统中“隐式约定”和“额外白名单”的数量。

## 结论

接口路径不存在唯一正确的行业标准。

下面这些写法从技术上都可以正常工作：

```text
/api/{channel}/{business}/callback
/api/callback/{channel}/{business}
/api/{channel}/{business}_callback
/api/{channel}/callback_{business}
```

真正需要解决的并不是：

> callback 这个单词到底应该放在 URL 的哪个位置？

而是：

> **这个请求属于哪一种调用方，它应该进入哪一种信任模型？**

因此，比具体 URL 形式更重要的一条原则是：

> **先划分安全边界，再设计路径。**

`/api/**/public/**` 也是同样的思路。

它并不是为了追求某种 URL 风格，而是为了避免长期维护一份匿名接口白名单，让路径本身能够表达“这是页面安全域中的匿名接口”。

当 `/api`、`/open`、`/callback`、内部接口和管理接口分别代表稳定的调用方类型以后，路径本身就成为系统安全架构的一部分。

URL 不再只是 Controller 的分类方式。

它开始表达：

> **谁在调用，以及系统应该如何信任这个请求。**
