---
title: 从请求头到可信 Token：一次跨模块租户上下文改造
description: 记录一个遗留 Spring 项目中的租户上下文改造：旧方案由前端通过 X-TENANT-ID 指定当前租户，后来改为切换租户时由后端重新签发 Token，并通过 TenantIdProvider 在不破坏 common 与 web 模块边界的前提下，让既有静态调用获得经过认证校验的 TenantId。

tags:
  - Spring
  - Java
  - 安全
  - 多租户
  - 模块设计
  - 遗留系统

category:
  - 技术探索

orientations:
  - boundary
  - explicit
  - evolution
---

# 从请求头到可信 Token：一次跨模块租户上下文改造

项目里原来有一个获取当前租户 ID 的静态方法：

```java
public static Long getCurrentTenantId() {
    String tenantId = request.getHeader("X_TENANT_ID");
    return Long.valueOf(tenantId);
}
```

业务代码只需要调用：

```java
SecurityUtils.getCurrentTenantId();
```

就可以得到当前租户 ID。

这个调用方式已经存在很久，也被大量业务代码使用。

问题在于：

> **`X-TENANT-ID` 由前端直接传入，客户端可以自行修改。**

后来系统调整了租户切换方式，不再把请求头中的 TenantId 作为可信的当前租户，而是在用户切换租户时由后端校验并重新生成 Token。

这时 `SecurityUtils#getCurrentTenantId()` 背后的实现也需要一起调整。

## 旧方案：当前租户由前端直接传入

旧的调用关系很简单：

```text
用户选择租户
    ↓
前端保存当前 TenantId
    ↓
后续请求携带 X-TENANT-ID
    ↓
SecurityUtils 读取 Header
    ↓
业务代码使用 TenantId
```

例如：

```http
X-TENANT-ID: 1001
```

这里的问题不是 Header 这种传递形式本身，而是：

> **服务端直接把客户端提供的 TenantId 当成了可信身份上下文。**

客户端完全可以手工构造：

```http
X-TENANT-ID: 2002
```

如果业务代码直接使用这个值，就把“当前可以访问哪个租户”的一部分决定权交给了客户端。

## 新方案：切换租户时重新生成 Token

后来租户切换逻辑进行了调整。

用户仍然可以在页面左上角切换租户，但切换动作不再只是修改前端保存的 TenantId。

新的流程是：

```text
用户选择新的租户
    ↓
前端调用切换租户接口
    ↓
后端确认当前账号
    ↓
校验账号是否有权访问目标租户
    ↓
重新生成 Token
    ↓
前端保存新 Token
    ↓
后续请求携带新 Token
```

当前租户因此成为服务端认证上下文的一部分。

业务请求到达后，再通过 Token 恢复当前身份：

```text
请求
  ↓
读取 Token
  ↓
解析 Token
  ↓
Redis / MySQL 校验
  ↓
确认登录状态和身份关系
  ↓
得到可信 TenantId
```

这样，“切换租户”仍然由用户主动发起，但切换结果必须经过服务端确认。

## TenantIdHelper 负责恢复可信租户上下文

新的 TenantId 获取能力已经存在于 `web` 模块的 `TenantIdHelper` 中。

它不是简单读取另一个 Header，而是处理认证后的上下文，大致包括：

```text
当前请求
  ↓
取得 Token
  ↓
解析 Token
  ↓
读取账号和租户信息
  ↓
Redis / MySQL 校验
  ↓
确认 Token 和当前身份仍然有效
  ↓
返回可信 TenantId
```

Redis / MySQL 在这里参与确认 Token、登录状态以及账号与租户关系。

因此，新旧方案真正的差异是：

```text
旧：

客户端声明 TenantId
        ↓
业务代码直接使用
```

变成：

```text
新：

客户端发起租户切换
        ↓
服务端校验并签发新 Token
        ↓
后续从经过认证校验的 Token 上下文获取 TenantId
```

## 同一请求内的重复调用

`SecurityUtils.getCurrentTenantId()` 已经被大量代码使用，因此同一个请求内部可能被调用多次。

如果每次调用都重新执行：

```text
Token 解析
  ↓
Redis / MySQL 校验
  ↓
返回 TenantId
```

就可能产生重复校验和重复查询。

这次改造先解决 TenantId 的信任来源和模块边界问题，没有同时处理这一性能优化。

后续可以在 `TenantIdHelper` 中增加请求级缓存，例如把已经校验完成的 TenantId 缓存在当前请求上下文中，使同一个请求生命周期内只执行一次完整校验。

## 前端还残留着旧的 X-TENANT-ID

租户切换机制调整以后，前端并没有立即删除所有发送 `X-TENANT-ID` 的历史代码。

因此部分请求中仍然可能出现：

```http
X-TENANT-ID: 1001
```

但它已经不再决定服务端当前租户。

后端可信的 TenantId 来自 Token 认证链路，而不是这个 Header。

这种残留代码后续仍然应该清理，否则维护者看到 `X-TENANT-ID` 后，很容易误以为它仍然参与租户身份判断。

## 还有一个模块边界问题

安全问题解决以后，还需要处理一个代码结构上的限制。

项目大致分成两个模块：

```text
common
└─ SecurityUtils

web
├─ TenantIdHelper
└─ 业务代码
```

依赖方向是：

```text
web
  ↓
common
```

`SecurityUtils` 位于 `common`。

可信 TenantId 的获取逻辑则位于 `web` 中的 `TenantIdHelper`。

但现有业务代码已经大量调用：

```java
SecurityUtils.getCurrentTenantId();
```

于是出现了一个问题：

> **common 中的 SecurityUtils 需要使用 web 中的 TenantIdHelper，但 common 不能反向依赖 web。**

## 直接获取 TenantIdHelper 会破坏模块边界

最直接的改法是：

```java
public static Long getCurrentTenantId() {
    TenantIdHelper helper = SpringContextHolder.getBean(TenantIdHelper.class);

    return helper.getCurrentTenantId();
}
```

运行时可能可以工作，但这要求 `common` 在编译期认识：

```text
web.TenantIdHelper
```

依赖关系会变成：

```text
common
  ↓
web
```

同时项目原来又存在：

```text
web
  ↓
common
```

模块边界因此被反转，甚至可能形成循环依赖。

这也会留下一个更长期的问题：

> 一旦允许 common 直接依赖 web 中的 Bean，以后其他类似需求很容易继续沿用这种方式。

## 另一种选择是修改所有调用链

也可以彻底取消：

```java
SecurityUtils.getCurrentTenantId();
```

在请求入口处先取得 TenantId，然后层层传入：

```text
Controller
  ↓ tenantId
Service A
  ↓ tenantId
Service B
  ↓ tenantId
Utility
```

这种依赖方式更加显式。

如果是新代码，我会优先考虑这种结构。

但在当前项目中，`SecurityUtils#getCurrentTenantId()` 已经存在大量调用。

为了修正 TenantId 的信任来源，同时重写所有调用链，会让一次局部安全改造扩大成一次范围很大的重构。

这次没有选择这样做。

## 在 common 中增加 TenantIdProvider

最后增加了一个很薄的接口：

```java
public interface TenantIdProvider {
    Long getCurrentTenantId();
}
```

接口放在 `common`。

`SecurityUtils` 只依赖这个接口：

```java
public static Long getCurrentTenantId() {
    TenantIdProvider provider = SpringContextHolder.getBean(TenantIdProvider.class);

    return provider.getCurrentTenantId();
}
```

原来的代码：

```java
String tenantId = request.getHeader("X_TENANT_ID");
```

从这里被移除。

`SecurityUtils` 不再知道 TenantId 来自：

- Header；
- Token；
- Redis；
- MySQL；
- Session；
- 其他认证上下文。

它只声明一个需求：

> **获取当前已经由服务端确认过的 TenantId。**

## web 提供 TenantIdProvider 的实现

具体实现仍然放在 `web`：

```java
@Component
public class DefaultTenantIdProvider implements TenantIdProvider {

    private final TenantIdHelper tenantIdHelper;

    public DefaultTenantIdProvider(TenantIdHelper tenantIdHelper) {
        this.tenantIdHelper = tenantIdHelper;
    }

    @Override
    public Long getCurrentTenantId() {
        return tenantIdHelper.getCurrentTenantId();
    }
}
```

于是编译期结构变成：

```text
common
├─ SecurityUtils
└─ TenantIdProvider
        ↑
        │ implements
        │
web
├─ DefaultTenantIdProvider
└─ TenantIdHelper
```

运行时调用链则是：

```text
业务代码
  ↓
SecurityUtils.getCurrentTenantId()
  ↓
SpringContextHolder
  ↓
TenantIdProvider
  ↓
DefaultTenantIdProvider
  ↓
TenantIdHelper
  ↓
Token 解析
  ↓
Redis / MySQL 校验
  ↓
可信 TenantId
```

这样既保留了旧的静态调用方式，也没有让 `common` 反向依赖 `web`。

## 为什么接口放在 common，而不是 web

如果 `TenantIdProvider` 也定义在 `web`，`SecurityUtils` 为了引用这个接口，仍然需要让 `common` 依赖 `web`。

所以接口应该放在需要这种能力的一侧。

这里由 `common` 声明：

> 我需要一种获取当前 TenantId 的能力。

`web` 决定：

> 在当前系统中，这个 TenantId 应该怎样安全地取得。

依赖关系因此保持为：

```text
common
  定义能力
      ↑
      │ implements
      │
web
  提供实现
```

## SpringContextHolder 只负责运行时找到实现

静态工具类无法使用普通的构造器注入，所以这里使用：

```java
SpringContextHolder.getBean(TenantIdProvider.class)
```

它只承担一件事：

> **在运行时找到 TenantIdProvider 的实现。**

`SecurityUtils` 并不知道实际实现是：

```text
DefaultTenantIdProvider
```

也不知道它后面还有：

```text
TenantIdHelper
Token
Redis
MySQL
```

从依赖关系上看，这种方式和 SPI 有一点相似：

```text
common 定义接口
web 提供实现
运行时完成绑定
```

但它不是 Java SPI，而是使用 Spring 容器完成实现查找。

## 这层 Provider 不是为了多个实现

`TenantIdProvider` 很可能长期只有一个：

```text
DefaultTenantIdProvider
```

但接口仍然有价值。

因为这里引入接口的主要目的不是多态，而是阻止依赖继续穿透：

```text
SecurityUtils
    ↓
TenantIdProvider
```

到这里为止。

`common` 不需要知道：

```text
TenantIdHelper
Token 如何解析
Redis 如何校验
MySQL 如何确认租户关系
租户切换如何重新签发 Token
```

这些细节全部留在 `web`。

接口在这里承担的是模块边界。

## 为什么没有顺便重构掉静态工具类

如果重新设计一个系统，我不会优先选择：

```text
静态工具类
+
SpringContextHolder
+
运行时 getBean
```

更自然的结构通常是：

```text
普通 Bean
+
构造器注入
+
显式依赖
```

但当前系统已经存在：

- 大量 `SecurityUtils.getCurrentTenantId()` 调用；
- 已经形成的 common / web 模块关系；
- 位于 web 中的认证和租户上下文逻辑。

这次改造的首要目标是：

> **不再让业务代码使用客户端直接声明的 TenantId。**

在完成这个目标时，没有必要同时扩大成一次全局静态工具类重构。

因此保留原有调用入口，只替换它背后的可信数据来源。

## 安全边界和模块边界分别发生了什么变化

改造前的安全链路：

```text
前端
  ↓
X-TENANT-ID
  ↓
SecurityUtils
  ↓
业务代码
```

改造后的安全链路：

```text
用户切换租户
  ↓
后端校验权限
  ↓
重新生成 Token
  ↓
后续请求携带 Token
  ↓
TenantIdHelper
  ↓
Redis / MySQL 校验
  ↓
可信 TenantId
  ↓
业务代码
```

模块关系则始终保持：

```text
web
  ↓
common
```

而没有变成：

```text
common
  ↓
web
```

所以这次改造实际上解决了两个相互独立的问题：

1. TenantId 的信任来源需要从客户端输入迁移到服务端认证上下文；
2. common 获取这个能力时不能破坏现有模块依赖方向。

## 失败契约

改造后，`getCurrentTenantId()` 的失败原因比原来更多，例如：

- Token 缺失；
- Token 过期或无效；
- 登录状态不存在；
- Redis / MySQL 校验失败；
- 当前账号与租户关系无效。

这里需要保持一个明确的调用契约：

> **校验失败时抛出认证或鉴权异常，不返回 `null`。**

这样已有业务代码仍然可以把：

```java
SecurityUtils.getCurrentTenantId();
```

理解为：

> 要么得到一个已经确认过的 TenantId，要么当前请求在认证链路中失败。

调用方不需要额外处理“TenantId 可能为 `null`”这一种状态。

## 关于调用范围

`TenantIdHelper` 依赖当前认证上下文，因此 `getCurrentTenantId()` 的语义对应的是：

> 当前已登录请求的租户。

对于没有 HTTP 请求和登录上下文的定时任务、MQ 消费、后台批处理等场景，不应该默认存在一个“当前租户”。

这些场景如果需要 TenantId，更适合由任务消息、任务参数或业务数据显式提供，而不是继续复用当前请求上下文的概念。

## 结论

最初需要修改的只是一行代码：

```java
String tenantId = request.getHeader("X_TENANT_ID");
```

但它背后实际涉及两个边界。

第一个是信任边界：

```text
前端可以发起租户切换
```

不等于：

```text
前端可以直接决定当前可信 TenantId
```

切换结果应该经过服务端校验，并进入新的 Token。

第二个是模块边界：

```text
common
```

不能因为需要认证后的租户上下文，就直接依赖：

```text
web
```

最终增加的 `TenantIdProvider` 很薄：

```text
common 定义能力
web 提供可信实现
Spring 在运行时完成连接
```

业务代码继续调用：

```java
SecurityUtils.getCurrentTenantId();
```

但这个方法背后的 TenantId，已经从客户端可直接提供的请求头，变成了服务端认证链路确认后的租户上下文。
