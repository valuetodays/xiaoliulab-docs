---
title: 从 Spring Boot 迁移到 Quarkus：我先验证了哪些基础能力
description: 一次以缩短启动时间为目标的 Quarkus 迁移准备记录。对于主要依赖 PostgreSQL 和 Redis 的 Spring Boot Web 应用，在真正迁移业务前，先逐项验证 REST、Bean、配置、事务、校验、定时任务、文件处理、异常处理和日志等基础能力。
---

# 从 Spring Boot 迁移到 Quarkus：我先验证了哪些基础能力

## 背景

这次寻找替代方案的原因很简单：**Spring Boot 启动太慢。**

一开始并不是直接认定要迁移到 Quarkus。为了看看 Java 生态里有没有更轻、更快，同时又能承载实际业务的框架，我先后尝试过：

- Spark Java
- Blade
- Micronaut
- Solon
- Jooby
- Vert.x
- Javalin
- Helidon
- Quarkus

这些框架的定位并不完全一样。

有些刻意保持得很轻，只提供 HTTP 路由或比较薄的 Web 抽象；有些则更像工具包，需要自己继续组合依赖注入、事务、配置、校验、定时任务等基础能力。

这类框架并不是不能做业务，而是对于一个已经习惯 Spring Boot 完整开发模型的人来说，如果为了缩短启动时间，还要自己重新搭一套 Bean 管理、事务、配置和各种通用基础设施，迁移成本就会迅速上升。

当时我甚至还尝试过 Go。它在内存占用方面确实很有吸引力，但如果把现有业务系统从 Java 切到 Go，问题就不再只是“换一个更轻的框架”。

现有大量 Java 基础代码、工具类、通用组件和既有开发经验都很难直接复用，迁移成本会从：

```text
Spring Boot → 另一个 Java 应用框架
```

扩大成：

```text
Java 技术栈 → Go 技术栈
```

这对一个以业务逻辑为主、长期维护的后台系统来说，代价明显更高。

所以后来我的边界也比较明确：

> **Go 可以继续用，但更适合那些和现有 Java 业务体系耦合很低、可以独立运行的小工具或服务。**

例如我会用 Go 做 HTTPS 证书巡查、个人收藏夹这类相对独立的功能；而核心业务系统则继续留在 Java 生态里，再寻找一个更轻、但业务基础能力仍然完整的框架。

因此我当时真正寻找的，并不是“启动最快的 Java Web 框架”，而是：

> **在保持较轻运行时和较快启动速度的同时，能不能提供足够完整的业务开发基础能力。**

经过这轮尝试后，Quarkus 更接近我想要的方向：它不是只解决 HTTP 路由，而是已经具备一套相对完整的应用框架能力。

当时面对的应用本身也不算复杂，核心基础设施主要是：

- PostgreSQL
- Redis

这让它很适合作为一次迁移尝试：既是真实业务应用，又没有大量强绑定 Spring 生态的组件。

但真正决定迁移之前，我并没有先搬业务代码。

对于一个长期使用 Spring Boot 的开发者来说，真正需要确认的并不是 Quarkus 能不能启动一个 Hello World，而是：

> 现有 Spring Boot 项目里已经习惯使用的那些基础能力，在 Quarkus 中是否都有足够自然、稳定的对应实现？

因此迁移前先列了一份 TODO List，把日常 Web 开发依赖的能力逐项验证。全部验证完成之后，才开始真正考虑迁移业务。

那份 TODO 在完成后已经删除，本文根据当时的实际迁移内容重新整理，不再尝试还原已经不存在的逐项实验记录。

## 先验证能力，再迁业务

如果只看最小示例，从 Spring Boot 切换到 Quarkus 并不困难。

真正的问题在于，成熟项目不会只有一个 REST Controller。

一个普通的后台服务至少还会涉及：

- Bean 管理
- 配置读取
- 多环境 Profile
- 数据库事务
- 参数校验
- 定时任务
- 文件上传与下载
- 全局异常处理
- 日志
- 统一响应对象
- 应用启动后的初始化逻辑

如果这些能力中有一部分需要完全改变开发方式，或者需要额外引入大量组件，那么迁移成本就可能超过启动性能带来的收益。

所以当时的思路不是先问：

> Quarkus 比 Spring Boot 快多少？

而是先问：

> **我现在依赖的这些基础能力，Quarkus 能不能完整接住？**

## REST 接口

Spring Boot 中最熟悉的写法通常是：

```java
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping("/{id}")
    public User get(@PathVariable Long id) {
        return service.get(id);
    }
}
```

Quarkus 默认使用 Jakarta REST，写法会变成类似：

```java
@Path("/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserResource {

    @GET
    @Path("/{id}")
    public User get(@PathParam("id") Long id) {
        return service.get(id);
    }
}
```

注解体系不同，但开发模型并没有发生根本变化：

```text
HTTP 路径
→ 参数绑定
→ 调用 Service
→ 返回 JSON
```

对于已经熟悉 Spring MVC 的开发者，这部分主要是 API 和注解习惯的迁移，而不是重新学习 Web 开发。

## Bean：从 Spring Bean 到 CDI

Spring Boot 中习惯：

```java
@Service
public class UserService {
}
```

然后：

```java
@Autowired
private UserService userService;
```

Quarkus 主要使用 CDI。

例如：

```java
@ApplicationScoped
public class UserService {
}
```

注入可以写成：

```java
@Inject
UserService userService;
```

如果原来的业务代码已经按 Controller / Service / Repository 之类的职责拆分，那么迁移到 CDI 并不会迫使业务结构发生明显变化。

真正需要调整的是：

> **不要继续把 Spring 的 Bean 注解体系当成默认前提，而是接受 CDI 成为新的组件模型。**

## 启动任务：CommandLineRunner 对应能力

Spring Boot 中经常使用：

```java
@Component
public class InitRunner implements CommandLineRunner {

    @Override
    public void run(String... args) {
        // 初始化
    }
}
```

迁移时需要确认 Quarkus 是否能够在应用启动阶段执行初始化逻辑。

Quarkus 可以监听启动事件，例如：

```java
@ApplicationScoped
public class ApplicationLifecycle {

    void onStart(@Observes StartupEvent event) {
        // 初始化
    }
}
```

这里的重点不是找到一个名字也叫 `CommandLineRunner` 的东西，而是确认：

> 原来依赖“应用启动后执行一次”的业务能力仍然存在。

这是迁移框架时很容易忽略的一类问题：**不要只找同名 API，要找同等语义。**

## 配置文件与配置映射

Spring Boot 很常见的是：

```java
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String name;
    private Integer timeout;

    // getter/setter
}
```

Quarkus 同样支持把配置映射成结构化对象。

迁移时重点验证的不是 YAML 或 properties 的语法本身，而是原项目常用的配置模式是否仍然成立，例如：

```text
基础配置
数据库配置
Redis 配置
第三方接口地址
超时时间
业务开关
```

对于大量使用 `*Properties` 对象管理配置的 Spring Boot 项目，这一点很重要。

如果迁移后又退回到代码里到处读取字符串配置：

```java
config.getValue("xxx.xxx", String.class)
```

那实际上是在降低可维护性。

所以我的目标仍然是：

> **配置应该保持结构化，而不是因为换框架退回到散落的字符串读取。**

## 多 Profile

实际项目不可能只有一个配置环境。

至少通常会有：

```text
dev
test
prod
```

因此迁移前必须确认不同 Profile 下：

- 数据库地址可以切换；
- Redis 地址可以切换；
- 第三方接口可以切换；
- 环境特有配置不会混用；
- 启动参数和 Docker 部署方式可控。

Spring Boot 中已经形成的“同一份程序 + 不同环境配置”模式，迁移到 Quarkus 后应该继续保持。

如果一个框架在 Hello World 上启动再快，但多环境配置变得难以维护，对业务项目来说也没有意义。

## PostgreSQL、JPA 与 MyBatis-Plus

这个应用本身依赖 PostgreSQL，因此数据库访问能力是迁移前必须验证的核心项目。

一开始迁移 Quarkus 时，我采用的是 **Quarkus + JPA**。这条路线本身没有问题，也能完成基本的数据访问和事务处理。

但实际项目原本更习惯 MyBatis / MyBatis-Plus 这一类显式 SQL 的开发方式，所以后续发现 **Quarkus 也可以继续使用 MyBatis-Plus** 时，迁移阻力一下小了很多。

这件事对我很重要，因为它意味着：

> 迁移到 Quarkus，并不等于必须同时把原有的数据访问习惯也全部换掉。

如果框架层切换的同时，还要把数据库访问从 MyBatis-Plus 全部改成 JPA，那么迁移会同时叠加两类变化：

```text
Spring Boot → Quarkus
MyBatis-Plus → JPA
```

这样很难判断迁移过程中出现的问题究竟来自哪里，也会明显增加业务代码改造量。

而继续使用 MyBatis-Plus 后，变化更接近：

```text
Spring Boot → Quarkus
数据访问方式尽量保持不变
```

这让迁移更像是一次框架运行时和基础设施能力的替换，而不是把整个应用开发模型一起推倒重来。

### 事务

无论使用 JPA 还是 MyBatis-Plus，事务语义都必须重新确认。

除了“能查询数据库”，还要确认事务语义。

例如业务代码仍然需要类似：

```java
@Transactional
public void createOrder() {
    // 多个数据库操作
}
```

对熟悉 Spring Boot 的开发者来说，这一点尤其重要，因为 `@Transactional` 已经是非常自然的开发习惯。

迁移时需要确认的是：

```text
事务什么时候开始
什么时候提交
抛出异常时是否回滚
方法调用边界是否符合预期
```

而不是只确认 SQL 能执行成功。

这类能力如果行为不同，才会真正影响业务迁移。

## Redis

Redis 是这个应用的另一项主要外部依赖。

因此迁移前同样需要验证：

- 基本读写；
- key 过期；
- JSON / 对象存储方式；
- 连接配置；
- 不同 Profile 的 Redis 地址；
- 现有封装是否值得保留。

我的目标并不是让 Quarkus 中的 Redis API 和 Spring Data Redis 完全一样。

更实际的问题是：

> **业务真正依赖的 Redis 使用方式能不能继续存在，而且代码复杂度是否可以接受。**

如果答案是可以，那么 API 差异本身并不是阻碍迁移的理由。

## 参数校验：`@Valid`

Web 项目里另一个非常常见的基础能力是参数校验。

例如：

```java
public class CreateUserRequest {

    @NotBlank
    public String name;

    @Email
    public String email;
}
```

Controller / Resource 接收参数时：

```java
public Response create(@Valid CreateUserRequest request) {
    ...
}
```

这一项看起来很小，但实际项目中大量接口都会依赖 Bean Validation。

如果迁移时遗漏，很容易出现一种情况：

> 接口能跑，但原来由框架自动完成的输入约束悄悄消失了。

因此它也应该出现在迁移验证清单里。

## 定时任务：`@Scheduled`

后台系统通常都会存在定时任务，例如：

```text
同步数据
清理缓存
补偿任务
状态扫描
报表统计
```

Spring Boot 中经常直接：

```java
@Scheduled(cron = "...")
public void execute() {
}
```

所以迁移 Quarkus 前，定时任务能力也必须验证。

这里主要关注的是：

- cron 表达式；
- 固定间隔任务；
- 是否支持配置化；
- 多实例部署时是否会重复执行；
- 原有任务语义是否需要重新设计。

前三项属于框架能力，最后一项其实和 Spring Boot 一样，仍然是业务系统自己需要解决的问题。

## 文件上传与下载

文件接口属于另一种非常容易被 Hello World 忽略的能力。

实际后台系统中经常会有：

```text
Excel 上传
附件上传
批量导入
报表下载
文件流返回
```

所以当时也专门验证了上传和下载。

迁移时需要确认的不只是“能不能收到一个文件”，还包括：

```text
multipart 请求
文件大小限制
临时文件处理
Content-Type
Content-Disposition
流式返回
异常处理
```

这类功能数量可能不多，但只要业务里存在，就不能等迁移到一半才发现处理方式完全不同。

## 统一异常处理

Spring Boot 项目里通常会逐渐形成统一异常处理，例如：

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
}
```

迁移到 Quarkus 后，具体扩展点会不同，但这个工程能力不能丢。

目标仍然是把：

```text
业务异常
参数异常
权限异常
系统异常
```

转换成统一的 HTTP 响应，而不是让每个 Resource 自己 `try/catch`。

因此我更关注的是：

> **Quarkus 有没有足够自然的全局异常映射机制？**

而不是一定要找到一个叫 `@RestControllerAdvice` 的注解。

框架迁移时，这种思维转换很重要。

## 统一响应对象

原有 Spring Boot 项目通常会约定统一返回结构，例如：

```json
{
  "code": "000000",
  "message": "success",
  "data": {}
}
```

换到 Quarkus 以后，没有必要因为框架变化就放弃这层业务协议。

因此统一响应包装也属于迁移验证内容。

这类代码通常不依赖复杂的 Spring 能力，本质只是：

```text
Resource
→ Service
→ Result<T>
→ JSON
```

如果能够直接迁移，说明业务层和框架层原本就保持了比较好的边界。

## 日志

日志看起来最普通，但真正迁移时也必须验证。

至少要确认：

- 日志级别；
- 包级别日志配置；
- 日志格式；
- 异常堆栈；
- Docker stdout；
- 不同环境日志级别；
- 原来依赖的 MDC / Trace 信息。

开发环境里能看到一行 `INFO` 并不意味着生产日志能力已经迁移完成。

对于线上系统，日志不是附属功能，而是问题发生以后最基础的诊断入口。

## 哪些东西其实不需要“完全对标”

迁移过程中我逐渐接受一个事实：

> **Quarkus 不需要长得像 Spring Boot，只需要能够覆盖原来依赖的业务能力。**

例如：

| Spring Boot 习惯 | Quarkus 对应思路 |
| --- | --- |
| `@RestController` | Jakarta REST Resource |
| Spring Bean | CDI Bean |
| `CommandLineRunner` | Startup Event |
| `@ConfigurationProperties` | 配置映射 |
| `@Transactional` | Jakarta Transaction |
| `@Valid` | Bean Validation |
| `@Scheduled` | Scheduler |
| `@RestControllerAdvice` | Exception Mapper / 全局异常映射 |

表面 API 不一样并不重要。

真正重要的是下面这些问题：

```text
业务结构还能不能保持清晰？
现有能力能不能完整覆盖？
迁移后代码是不是更难维护？
第三方依赖是否需要大量绕路？
```

如果答案都可以接受，那么框架 API 本身的区别只是迁移成本，而不是迁移障碍。

## 为什么最后愿意继续验证 Quarkus

经过前面的框架尝试后，Quarkus 只是进入了候选范围；真正让我愿意继续做完整能力验证，还有一个很重要的前提：这个应用依赖相对简单。

核心外部依赖主要就是：

```text
PostgreSQL
Redis
```

没有大量强绑定 Spring 生态的组件需要同时替换。

这让迁移可以控制在一个比较小的范围：

```text
Web 层
Bean 容器
配置
数据库
Redis
定时任务
校验
文件接口
异常和日志
```

这些基础能力逐项确认以后，才有理由继续迁真正的业务代码。

如果面对的是另一个深度依赖大量 Spring 组件、第三方 Starter 和内部 Spring 扩展的老项目，我不会因为“Quarkus 启动更快”就直接认为它也值得迁移。

## 最后的判断

这次验证最终让我确认了一件事：

> **对于一个主要依赖 PostgreSQL 和 Redis、并且数据访问层可以继续沿用熟悉模式的普通 Java Web 应用，从 Spring Boot 迁移到 Quarkus 并不意味着要把整个开发模型推倒重来。**

很多能力只是：

```text
Spring Boot 的实现
→ 换成 Quarkus / Jakarta 对应实现
```

真正需要适应的是框架的默认模型、配置方式和扩展点，而业务代码本身未必需要发生很大变化。

而这次迁移准备过程中，我觉得最有用的方法并不是先读完 Quarkus 的全部文档，而是：

> **把自己在 Spring Boot 项目里真正依赖的能力列成一张清单，然后逐项验证。**

因为只有这些能力全部成立以后，“启动更快”才有实际意义。

否则一个启动只需要几百毫秒、但缺少现有业务能力的 Hello World，并不能证明它适合迁移真实项目。
