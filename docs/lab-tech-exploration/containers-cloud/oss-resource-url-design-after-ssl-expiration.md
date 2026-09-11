---
title: 从 SSL 证书过期到 CDN：一次 OSS 资源地址的来回调整
description: 记录一次 OSS 资源访问方式的调整过程：自定义域名证书过期后，先恢复证书，再改用阿里云 OSS 原生域名展示资源；后来因为 CDN、CORS、CORP 和访问策略要求，又将上传地址与展示地址拆开，并把数据库中的完整 URL 收敛为对象相对路径。
date: 2026-09-11

tags:
  - OSS
  - CDN
  - HTTPS
  - CORS
  - CORP
  - 数据设计

category:
  - 技术探索

orientations:
  - preserve-truth
  - explicit
  - evolution
---

# 从 SSL 证书过期到 CDN：一次 OSS 资源地址的来回调整

最开始的问题很直接：`自定义 OSS 域名的 SSL 证书过期，导致页面中的图片无法正常显示`。

后来运维人员恢复了证书。

证书恢复以后，新请求已经可以正常访问，但部分已经打开的页面仍保持之前图片加载失败的状态，需要刷新甚至强制刷新后才能重新显示。

这里不把原因只归结为“浏览器缓存了 SSL 错误”。

一方面，失败的连接或请求状态可能在短时间内被复用；另一方面，`<img>` 等资源一旦加载失败，浏览器通常不会因为服务端证书恢复而自动重新发起请求。刷新页面后重新请求资源，图片才恢复显示。

真正值得记录的，不只是证书过期本身，而是后续围绕 OSS 原生域名、自定义域名、CDN 和数据库资源地址发生的一系列调整。

## 证书为什么会一直过期到影响业务

SSL 证书过期没有在业务受影响以前被发现。

证书到期并不是一个突然发生的事件，它的有效期是提前已知的。

如果只有在图片无法访问以后才发现问题，说明当时证书生命周期还没有真正进入主动监控范围。

至少缺少了下面这些机制中的一部分：

- 证书到期时间检查；
- 到期前提前告警；
- HTTPS 资源域名可用性探测；
- 证书续期责任和处理流程。

代码没有变化，OSS 中的文件也没有变化，但一个外部基础设施依赖到期，同样可以让业务资源整体失效。

## 第一次调整：改用 OSS 原生域名展示

证书恢复以后，我还是决定把资源展示地址改成阿里云 OSS 原生域名。

当时 OSS 配置大致类似：

```java
OssConfig ossConfigCn = new OssConfig();
ossConfigCn.setAccessKeyId("...");
ossConfigCn.setAccessKeySecret("...");
ossConfigCn.setEndpoint("https://oss-cn-hangzhou.aliyuncs.com/");
ossConfigCn.setBucketName("bucketname");
```

示例中的 AK/SK 仅用于说明配置关系，实际凭证不应硬编码在代码中，应通过配置中心、密钥管理服务或临时凭证等方式提供。

同一个对象可以通过 OSS 原生地址访问：

```text
https://bucketname.oss-cn-hangzhou.aliyuncs.com/xxx.jpg
```

也可以通过已经绑定到 OSS 的自定义域名访问：

```text
https://oss.example.com/xxx.jpg
```

当时选择 OSS 原生域名展示，主要是为了减少对自定义域名证书生命周期的依赖。

配合这次调整，我修改了一批代码，也调整了数据库中的历史资源地址。

当时的思路很直接：

> 如果直接使用阿里云 OSS 原生域名，就不需要再单独维护自定义资源域名的 SSL 证书。

这个方案降低了证书维护风险，但后来又遇到了新的约束。

## 第二次调整：上传和展示不是同一个问题

后来访问策略进一步收紧。

上传侧要求只允许使用指定的阿里云 OSS Endpoint，例如：

```text
https://oss-cn-hangzhou.aliyuncs.com/
```

而资源展示侧仍然希望使用自定义域名：

```text
https://oss.example.com/
```

原因包括：

- 展示资源需要 CDN；
- 浏览器访问需要处理 CORS / CORP 等策略；
- 自定义域名更适合作为统一、稳定的资源展示入口；
- OSS Endpoint 更适合作为应用访问对象存储服务的基础设施地址。

其中，CORS 用于控制跨源请求权限，CORP（Cross-Origin Resource Policy）用于限制资源是否允许被其他来源加载，两者作用层次不同。

这时我才意识到，之前一直在讨论“到底应该用哪个域名”，其实把两个不同问题混在了一起。

## 上传地址

上传时使用 OSS Endpoint。

例如：

```text
https://oss-cn-hangzhou.aliyuncs.com/
```

它负责的是应用和对象存储之间的交互。

链路更接近：

```text
应用
  ↓
OSS Endpoint
  ↓
Bucket
  ↓
Object
```

这里关注的是：

- OSS SDK；
- Endpoint；
- Bucket；
- 权限；
- 上传策略；
- 网络访问限制。

## 展示地址

浏览器展示资源时使用自定义域名：

```text
https://oss.example.com/xxx.jpg
```

链路更接近：

```text
浏览器
  ↓
自定义域名
  ↓
CDN
  ↓
OSS
```

这里关注的是：

- HTTPS；
- CDN；
- 缓存；
- CORS；
- CORP；
- 浏览器资源加载策略。

上传和展示最终指向的是同一个对象，但承担的职责不同。

因此，上传域名和展示域名没有必要保持一致。

## 关于读权限的前提

本文讨论的是可以通过固定 URL 直接读取的资源场景。

如果 Bucket 为私有读，展示时需要生成带签名和有效期的 URL。此时数据库仍然可以只保存对象路径，但最终展示地址需要经过签名层生成。

## 数据库里真正需要保存什么

如果数据库中保存完整 URL：

```text
https://oss.example.com/xxx.jpg
```

后来改成：

```text
https://bucketname.oss-cn-hangzhou.aliyuncs.com/xxx.jpg
```

就需要修改历史数据。

以后如果再切回自定义域名，又可能需要再改一次。

但整个过程中真正没有变化的是：

```text
/xxx.jpg
```

对象还是那个对象。

变化的只是当前通过哪个入口访问它。

因此后来我把这几个概念拆开：

```text
OSS Endpoint
资源对象路径
展示域名
```

它们分别属于不同层次。

### OSS Endpoint

例如：

```yaml
oss:
  endpoint: https://oss-cn-hangzhou.aliyuncs.com/
```

用于上传以及访问 OSS API。

### 数据库资源路径

数据库只保存：

```text
/xxx.jpg
```

或者：

```text
xxx.jpg
```

它代表资源本身的位置，不包含当前展示策略。

### 展示域名

展示域名放到配置中：

```yaml
oss:
  display-base-url: https://oss.example.com
```

最终返回前端时再组合：

```text
display-base-url + object-path
```

得到：

```text
https://oss.example.com/xxx.jpg
```

## 拆开以后，域名切换不再需要改历史数据

调整后的关系变成：

```text
数据库
  ↓
/xxx.jpg

上传
  ↓
OSS Endpoint + /xxx.jpg

展示
  ↓
Display Base URL + /xxx.jpg
```

以后如果展示域名从：

```text
https://oss.example.com
```

改成：

```text
https://cdn.example.com
```

只需要修改配置。

数据库中的：

```text
/xxx.jpg
```

不需要变化。

如果临时需要切回 OSS 原生域名展示，也只需要调整展示域名配置。

这样，资源访问入口变化不会再扩散到历史业务数据。

## 为什么不能简单理解成“数据库不要存完整 URL”

完整 URL 本身并没有问题。

如果保存的是一个真正的外部链接，例如：

```text
https://example.org/article/123
```

这个 URL 本身就是业务数据，那么完整保存是合理的。

这次需要拆开的，是自己管理的 OSS 资源。

对于这类资源：

- 对象路径代表资源本身；
- OSS Endpoint 代表上传和存储访问方式；
- 自定义域名代表当前展示方式。

如果把三者合成一个完整 URL 持久化，基础设施变化就会扩散到业务数据。

## 最后的结构

调整后，资源访问关系变成：

```text
上传：

应用
  ↓
OSS Endpoint
  ↓
Object


持久化：

数据库
  ↓
Object Path


展示：

浏览器
  ↓
自定义域名
  ↓
CDN
  ↓
OSS Object
```

这样既可以在上传侧限制只能访问指定 OSS Endpoint，也可以在展示侧继续使用自定义域名、CDN 和浏览器安全策略。

## 沉淀下来的约束

- 数据库保存资源标识，不保存当前展示入口；
- 上传入口和展示入口分别配置，不要求使用同一个域名；
- 自定义域名一旦进入业务链路，证书生命周期必须进入主动监控。

## 后续需要补上的监控

如果继续使用自定义域名作为展示入口，后续至少需要覆盖：

- 自定义域名证书到期时间；
- 到期前提前告警；
- HTTPS 可用性探测；
- CDN 资源访问检查；
- 证书续期责任和处理流程。

自定义域名带来了 CDN、统一入口等能力，也意味着需要承担对应的运维责任。

## 结论

实际经历的过程是：

```text
自定义域名 SSL 证书过期
        ↓
图片无法显示
        ↓
运维恢复证书
        ↓
部分已打开页面需要重新刷新
        ↓
改用 OSS 原生域名展示资源
        ↓
修改代码和历史资源 URL
        ↓
访问策略进一步收紧
        ↓
重新区分上传地址与展示地址
        ↓
上传使用 OSS Endpoint
展示使用自定义域名 + CDN
数据库只保存对象路径
```

最终稳定下来的，是三个独立概念：

> **资源本身、资源上传入口、资源展示入口。**
