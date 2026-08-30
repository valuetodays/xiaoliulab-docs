---
title: 从 Spring Boot 迁移到 Quarkus：一份面向真实业务的基础能力验证清单
description: 因 Spring Boot 启动速度和资源占用问题，先后尝试多种轻量 Java Web 框架和 Go，最终将 Quarkus 作为业务系统候选，并从数据访问、配置、事务、校验、调度、监控、部署等方面逐项验证其是否能承载真实后台业务。
---

# 从 Spring Boot 迁移到 Quarkus：一份面向真实业务的基础能力验证清单

## 背景：不是一开始就选了 Quarkus

这次技术选型的起点其实很简单：

> **Spring Boot 启动太慢。**

当时我想找一个更轻量、启动更快，同时又能继续承载真实后台业务的方案。

一开始并没有直接认定 Quarkus，而是陆续尝试过一批框架：

- Spark Java
- Blade
- Micronaut
- Solon
- Jooby
- Vert.x
- Javalin
- Helidon
- Quarkus

这些框架定位并不完全一样。

有些方案非常轻，只提供 HTTP 路由或较薄的一层 Web 抽象；有些更像工具包，需要自己继续组合依赖注入、事务、配置、校验、调度等能力。

这类框架并不是不能写业务，而是如果一个已经习惯 Spring Boot 完整开发模型的项目，为了换取更快启动速度，还要重新拼出 Bean 容器、事务、配置、异常处理、调度、监控等一整套基础设施，那么迁移成本很快就会超过收益。

因此我后来真正寻找的，并不是：

> 哪个 Java Web 框架启动最快？

而是：

> **哪个方案能在保持轻量和启动速度优势的同时，继续提供足够完整的业务开发能力？**

## 我甚至尝试过 Go

当时还试过 Go。

Go 的内存占用确实很有吸引力，但如果把现有 Java 业务系统直接换成 Go，问题就不再只是“更换一个框架”，而是：

```text
Java 技术栈
→ Go 技术栈
```

现有大量 Java 基础代码、工具类、通用组件和开发经验都很难直接复用。

对于一个以业务逻辑为主、需要长期维护的后台系统来说，这种迁移成本明显高于：

```text
Spring Boot
→ 另一个 Java 应用框架
```

所以后来我的边界比较明确：

> **Go 可以继续用，但更适合和现有 Java 业务体系低耦合、能够独立运行的小工具或小服务。**

例如 HTTPS 证书巡查、个人收藏夹这类功能，用 Go 很合适；核心业务系统则继续留在 Java 生态里。

## 为什么最后继续验证 Quarkus

经过前面一轮尝试后，Quarkus 比较接近我想要的方向：

- 启动速度快；
- 运行时相对轻；
- 有完整的依赖注入体系；
- 有事务能力；
- 有配置体系；
- 有参数校验；
- 有 Scheduler；
- 有健康检查和 Prometheus；
- 可以继续使用 PostgreSQL、Redis 等常见基础设施；
- 开发模型仍然属于熟悉的 Java 后台应用范畴。

当时准备迁移的应用本身也不复杂，核心外部依赖主要是：

```text
PostgreSQL
Redis
```

这很适合作为试点：

> 既是真实业务应用，又没有大量强绑定 Spring 生态的历史包袱。

但真正开始迁业务之前，我并没有先搬 Controller 和 Service。

我先列了一份 TODO List，把 Spring Boot 项目中已经习惯使用的基础能力逐项验证。

因为真正的问题从来不是：

> Quarkus 能不能启动？

而是：

> **Quarkus 能不能承载一个完整后台业务系统的开发模式？**

本文就是根据当时那份验证清单和后续实际迁移经验重新整理。

## 迁移目标

当时给这次迁移设定的目标可以归纳为：

1. 降低服务运行内存占用；
2. 提升启动速度；
3. 保持后台业务系统常用开发能力完整；
4. 尽量复用现有 Java 开发习惯和基础代码；
5. 兼容现有日志、监控、Docker 和 CI/CD 体系；
6. 验证通过后再沉淀 Quarkus 基础模板。

这也是为什么我不把“Hello World 启动时间”当成迁移依据。

一个空应用几百毫秒启动并没有太大意义。

只有业务真正需要的能力都能接住，启动速度优势才有价值。

# 一、数据访问能力

## 1. 一开始使用 JPA / Panache

最初迁移 Quarkus 时，数据访问首先尝试的是 JPA / Panache。

这条路线本身可以工作，也很适合：

- Demo；
- 简单表；
- 配置类小表；
- 只读查询；
- 更新模型比较简单的场景。

但随着业务继续迁移，我越来越在意另一个问题：

> 数据访问方式是否符合现有后台业务的开发习惯？

很多后台业务并不是：

```text
读完整对象
→ 修改完整对象
→ 保存完整对象
```

而更常见的是：

```text
创建时写一部分字段
→ 支付流程更新支付状态
→ 审核流程更新审核字段
→ 回调流程更新渠道字段
→ 页面编辑更新页面自己负责的字段
```

多个流程可能同时修改同一条业务记录。

因此我更希望数据访问层能够明确控制：

- 更新哪些字段；
- 在什么条件下更新；
- 状态流转的前置状态是什么；
- SQL 最终会执行什么。

## 2. 后来发现 Quarkus 也能继续使用 MyBatis-Plus

这是迁移过程中一个很重要的变化。

一开始我的理解更接近：

```text
Spring Boot + MyBatis / MyBatis-Plus
→ Quarkus + JPA / Panache
```

后来发现 Quarkus 也可以继续使用 MyBatis-Plus，这件事让迁移成本一下降低很多。

因为这样就不用同时做两次迁移：

```text
Spring Boot → Quarkus
MyBatis-Plus → JPA
```

而可以把变化收敛为：

```text
Spring Boot → Quarkus
数据访问方式尽量保持不变
```

这很重要。

框架迁移本身已经会改变：

- Bean 管理；
- 配置方式；
- Web 注解；
- 异常处理扩展点；
- Filter / Interceptor；
- 监控路径；
- 部署方式。

如果数据库访问也同时完全更换，迁移过程中出现问题时很难判断究竟是哪一层引起的。

因此后来的方向更明确：

> **Quarkus 负责替换应用框架，但已有成熟的数据访问习惯尽量保留。**

## 3. Repository / Mapper 风格

对于后台业务，我更偏向 Repository / Mapper 风格。

需要验证的不是“能不能查数据库”，而是：

- Mapper 接口如何定义；
- SQL 如何组织；
- 参数如何绑定；
- 返回对象如何映射；
- 分页如何实现；
- 批量操作是否方便；
- 指定字段更新是否自然；
- 条件更新是否容易表达；
- 如何配合事务。

重点始终是：

> **是否符合后台业务系统指定字段更新、显式状态流转的开发方式。**

## 4. CRUD 只是最低要求

迁移验证不能停在：

```text
insert 成功
select 成功
update 成功
delete 成功
```

真实业务还需要继续确认：

- 按条件查询；
- 分页查询；
- 指定字段修改；
- 条件修改；
- 批量查询；
- 批量更新；
- 多表事务。

尤其是更新操作。

例如状态流转更希望看到：

```sql
UPDATE pay_order
SET status = 'PAID',
    paid_time = ?
WHERE order_id = ?
  AND status = 'TO_PAY';
```

而不是：

```text
查出整行
→ 修改几个字段
→ 把整个对象重新保存
```

这不是 Quarkus 独有的问题，而是迁移时必须确认：

> 新的数据访问方案不能让原来已经形成的业务边界退化。

## 5. 分页

分页是后台项目的基础能力之一。

需要统一：

- `pageNum`
- `pageSize`
- 默认页码；
- 默认分页大小；
- 最大分页大小；
- 排序字段；
- 是否允许前端自由传排序字段；
- 统一分页返回结构。

例如：

```java
public class PageQueryReq {

    private Integer pageNum;

    private Integer pageSize;
}
```

返回：

```java
public class PageResp<T> {

    private Long total;

    private List<T> records;
}
```

也可以使用已有前端习惯：

```text
total
rows
```

重点不是名字，而是：

> **整个系统必须统一。**

## 6. 特殊字段映射

数据库框架能 CRUD，不代表项目就能迁。

还要验证：

| 字段类型 | 需要关注 |
| --- | --- |
| JSON | Java 对象、String、Map、JsonObject 如何映射 |
| `List<Long>` | JSON、数组、字符串还是关联表 |
| LocalDateTime | DB 存储、请求解析、JSON 返回 |
| Enum | code、name、ordinal |
| BigDecimal | 精度和 JSON 格式 |
| Boolean | PostgreSQL / MySQL 类型差异 |

其中几个原则基本不会因为框架变化而改变：

- Enum 不建议用 ordinal 入库；
- LocalDateTime 的对外格式需要统一；
- 需要查询的 List 数据优先考虑关系模型；
- JSON 字段适合配置类数据，频繁查询时要谨慎。

## 7. 事务

事务是必须单独验证的能力。

至少需要确认：

- Service 层事务；
- 多表写入；
- RuntimeException 回滚；
- checked exception 行为；
- 同类内部方法调用；
- 事务与异步线程；
- 事务与定时任务；
- 事务与外部 HTTP 调用边界。

我更倾向继续保持：

```text
Service
→ 负责业务事务编排

Repository / Mapper
→ 负责数据访问
```

外部 HTTP 请求如果耗时不可控，也不应该长时间放在数据库事务里。

## 8. SQL 日志与 P6Spy

迁移后还要确认原来的 SQL 可观测能力是否能继续保留。

关注点包括：

- 实际 SQL；
- 参数；
- SQL 执行耗时；
- 数据源配置是否受影响；
- 开发环境能否方便打开；
- 生产环境如何控制日志量。

SQL 日志不是框架迁移的核心，但出了问题以后非常重要。

# 二、REST 与接口能力

## 1. 从 Spring MVC 到 Jakarta REST

Spring Boot 中习惯：

```java
@RestController
@RequestMapping("/users")
public class UserController {
}
```

Quarkus 更自然的方式是 Jakarta REST：

```java
@Path("/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserResource {
}
```

迁移时我并不要求 Quarkus 看起来和 Spring Boot 一样。

真正需要确认的是：

```text
路径
参数
JSON Body
返回 JSON
文件接口
异常处理
```

这些业务能力是否完整。

因此 Quarkus 项目中更愿意使用其原生的 Jakarta REST 风格，而不是为了降低表面迁移成本而过度依赖 Spring 兼容层。

## 2. 统一返回对象

业务接口通常已经约定统一响应，例如：

```java
public class R<T> {

    private Integer code;

    private String msg;

    private T data;
}
```

换框架以后这个业务协议不应该丢。

需要验证：

- 普通对象；
- List；
- 分页；
- Void；
- 业务异常；
- 参数校验异常；
- 文件下载是否绕过统一包装。

这类代码如果能够继续直接复用，说明业务层与框架层的边界本来就比较清楚。

## 3. JSON 序列化

这也是很容易漏掉的一层。

至少需要确认：

- LocalDateTime 返回格式；
- LocalDateTime 请求解析；
- BigDecimal；
- Long 是否需要转字符串；
- null 是否输出；
- Enum 输出 code 还是 name；
- 驼峰字段；
- 嵌套对象；
- List / Page 内部时间字段。

例如时间格式仍然可以统一为：

```text
yyyy-MM-dd HH:mm:ss
```

迁移成功不应该以“接口能返回 JSON”为标准，而应该以：

> **原接口协议是否仍然稳定。**

## 4. 文件上传与下载

后台系统很容易存在：

- Excel 上传；
- Excel 下载；
- PDF；
- ZIP；
- 附件；
- 大文件。

因此需要验证：

- multipart；
- 文件大小限制；
- 中文文件名；
- Content-Type；
- Content-Disposition；
- 流式下载；
- 下载异常；
- 是否需要鉴权。

这类能力在 Hello World 中完全看不到，但一旦真实迁移就会碰到。

# 三、参数校验与统一异常

## 1. Bean Validation

原有 Spring Boot 项目通常大量依赖：

```java
@NotNull
@NotBlank
@Size
@Valid
```

例如：

```java
public class AuditOrderReq {

    @NotNull(message = "ID不能为空")
    private Long id;

    @NotNull(message = "审核结果不能为空")
    private Integer auditResult;
}
```

迁移时需要验证：

- GET 参数；
- JSON Body；
- 嵌套对象；
- List；
- 自定义校验注解；
- 中文 message；
- 校验失败返回结构；
- 是否能和全局异常处理打通。

如果只迁 Controller，但原有校验悄悄失效，这种迁移是不能接受的。

## 2. 统一异常处理

Spring Boot 常用：

```text
@RestControllerAdvice
```

Quarkus 的扩展点不同，但工程目标不变。

需要统一处理：

- 业务异常；
- 参数异常；
- 404；
- 405；
- 数据库异常；
- 认证授权异常；
- 未知异常。

目标仍然是：

```text
前端
→ 收到统一 R

日志
→ 记录完整异常

响应
→ 不暴露 SQL、堆栈和内部路径
```

这也是一个很典型的迁移思路：

> **不要寻找同名注解，要寻找同等语义。**

# 四、Filter、Interceptor 与 AOP 替代

Spring Boot 项目常见：

- Spring AOP；
- HandlerInterceptor；
- OncePerRequestFilter；
- RequestBodyAdvice；
- ResponseBodyAdvice；
- ControllerAdvice。

Quarkus 里需要重新按场景选择：

| 场景 | Quarkus 关注点 |
| --- | --- |
| HTTP 请求拦截 | ContainerRequestFilter |
| HTTP 响应处理 | ContainerResponseFilter |
| 方法级拦截 | CDI Interceptor |
| 请求体处理 | ReaderInterceptor |
| 统一异常 | ExceptionMapper |
| 权限认证 | Security / Filter |

这一块是 Spring Boot 开发者迁移时比较容易产生“框架不一样了”的地方。

但重新拆开以后会发现，原来的需求仍然是这些：

```text
HTTP 请求级别处理
方法级别处理
请求体处理
返回值处理
异常处理
鉴权
```

只是 Spring 把它们包装成了另一套扩展体系。

## 请求拦截需要验证什么

至少包括：

- 请求路径；
- Header；
- 客户端 IP；
- traceId；
- MDC；
- 鉴权；
- 白名单；
- CORS 预检；
- 异常统一返回。

如果系统存在请求体加密，还需要进一步确认：

- 能否读取原始 body；
- 解密后能否继续 JSON 反序列化；
- body 是否只能读取一次；
- 是否影响 multipart；
- 解密失败如何返回；
- 哪些接口需要排除。

## 方法级拦截

如果原来依赖 AOP 完成：

- 操作日志；
- 耗时统计；
- 权限；
- 自定义注解；

则需要确认 CDI Interceptor 能否自然承接。

# 五、配置与 Bean 管理

## 1. 配置注入

Spring Boot 常见：

```java
@Value
@ConfigurationProperties
```

Quarkus 中同样需要覆盖：

- 单值；
- 默认值；
- List；
- Map；
- 嵌套配置；
- Profile；
- 环境变量覆盖；
- 缺失配置是否启动失败；
- 结构化配置对象。

例如：

```java
@ConfigProperty(name = "app.name")
String appName;
```

我更关心的是：

> **原来结构化的配置不能因为换框架退化成到处读取字符串 key。**

## 2. 多 Profile

需要确认：

```text
dev
test
prod
```

不同环境能够独立配置：

- PostgreSQL；
- Redis；
- 第三方 API；
- 日志；
- Scheduler；
- Docker；
- CI/CD。

同时验证：

- 环境变量覆盖；
- Docker Compose 注入；
- CI 变量注入。

## 3. 敏感配置

数据库密码、Redis 密码、Token、私钥、签名密钥等不应该因为框架迁移改变基本安全原则。

优先考虑：

```text
环境变量
服务器本地 .env
CI 变量
Docker Secret
K8s Secret
```

而不是把明文密钥直接提交到 Git。

## 4. Bean 列表与策略模式

后台业务里很常见：

```text
多个支付渠道处理器
多个回调处理器
多个同步任务处理器
多个消息处理器
```

Spring 中可能通过：

```text
List<Interface>
Map<String, Interface>
```

组织。

Quarkus 迁移时也需要确认：

- 同接口多实现；
- Bean 生命周期；
- 启动时构建 handler map；
- Bean 未被发现时的行为。

这类能力一旦缺失，会直接影响现有策略模式代码能否复用。

# 六、中间件能力

## 1. Redis / Cache

Redis 是这次目标应用的核心依赖之一。

需要验证：

- 客户端；
- 连接；
- 密码；
- 超时；
- Key 前缀；
- String / Hash / List；
- JSON 序列化；
- 过期时间；
- 缓存能力；
- Redis 异常时如何处理。

迁移时我不要求 API 和 Spring Data Redis 完全一样。

只要：

> **现有业务依赖的 Redis 使用模式能够自然表达。**

就可以接受。

## 2. NATS

如果某个项目使用 NATS，则继续验证：

- 连接；
- 发布；
- 订阅；
- 序列化；
- 消费线程；
- 断线重连；
- 异常重试；
- 优雅关闭；
- 监控；
- 幂等。

这类并不是所有 Quarkus 项目都必须具备，而是：

> 项目真实依赖什么，就验证什么。

## 3. 统一 HTTP Client

调用第三方服务是后台业务的常见能力。

需要确认：

- OkHttp 或其他统一客户端是否继续使用；
- 连接池；
- connectTimeout；
- readTimeout；
- writeTimeout；
- 代理；
- 请求 / 响应日志；
- charset；
- GBK 等非 UTF-8 响应；
- 异常封装；
- 重试；
- 同步 / 异步；
- 阻塞调用对 Quarkus worker 的影响。

对于响应字符集，我已经形成了比较明确的处理原则：

```text
Content-Type 有 charset
→ 优先使用响应 charset

调用方明确指定 charset
→ 按显式配置覆盖

都没有
→ 回退 UTF-8
```

# 七、定时任务

## 1. Quarkus Scheduler

需要验证：

- fixed interval；
- cron；
- 异常处理；
- 是否并发执行；
- 是否可以禁用；
- 多实例是否重复执行；
- Profile 开关；
- 日志；
- 执行耗时。

对于简单内部任务，Quarkus Scheduler 已经足够。

## 2. XXL-Job 是否继续保留

如果业务需要：

- 分布式调度；
- 手动触发；
- 执行日志；
- 失败重试；
- 分片；
- 调度中心；

那就没有必要为了“Quarkus 原生”而强行把 XXL-Job 去掉。

本地 Scheduler 更适合：

- 简单任务；
- 单实例；
- 非核心补偿；
- 不需要人工触发的内部任务。

框架迁移的目标不是“把所有外部组件换掉”，而是：

> **哪些已有能力值得保留，就继续保留。**

# 八、监控、健康检查和日志

## 1. Prometheus

原 Spring Boot 项目可能已经有：

```text
/actuator/prometheus
```

Quarkus 中常见：

```text
/q/metrics
```

迁移需要确认：

- HTTP 请求次数；
- 请求耗时；
- JVM 内存；
- GC；
- 线程；
- 数据库连接池；
- 自定义指标；
- Grafana 面板；
- Prometheus scrape。

如果应用框架换了，但现有监控体系无法继续使用，那运维成本会非常高。

## 2. Health Check

需要确认：

- liveness；
- readiness；
- 数据库；
- Redis；
- 外部依赖是否需要纳入；
- Docker / Nginx / LB 如何使用。

Quarkus 常见路径：

```text
/q/health
```

这类能力也是业务上线前必须确认，而不是上线后再补。

## 3. 日志

需要验证：

- console；
- file；
- JSON；
- 异常堆栈；
- traceId；
- MDC；
- requestUri；
- clientIp；
- logger；
- 线程名；
- 容器日志；
- Loki / EFK；
- 多行异常解析。

日志不是附属能力，而是：

> **线上出问题以后最基础的诊断入口。**

所以迁移框架时不能只看代码能不能跑。

# 九、OpenAPI 与 Swagger

需要确认：

- OpenAPI；
- Swagger UI；
- dev/test 是否打开；
- prod 是否关闭；
- 接口描述；
- Req / Resp 展示；
- 鉴权 Header；
- 前端联调方式。

这部分通常不复杂，但对日常开发效率影响很大。

# 十、测试能力

## 1. 普通单元测试

至少需要继续支持：

- JUnit；
- Service 测试；
- 工具类测试；
- 参数校验；
- SQL 构造；
- Mock 外部依赖。

## 2. Quarkus 集成测试

需要关注：

```java
@QuarkusTest
```

以及：

- 多模块测试类位置；
- Test Profile；
- 测试数据库；
- HTTP 测试；
- Redis / NATS 外部依赖隔离；
- CI 中如何运行。

## 3. ArchUnit

如果项目已经有架构约束测试，也没有理由因为换 Quarkus 而丢掉。

例如：

- Controller 不直接访问 Repository；
- Service 不依赖 Controller；
- 包依赖方向；
- Req / Resp 命名；
- 禁止 System.out；
- internal 包边界。

这类能力和框架关系不大，应该继续复用。

# 十一、打包与部署

## 1. JVM 模式

当时优先考虑的还是 JVM 模式，而不是 Native。

需要验证：

- Dockerfile；
- JDK / JRE；
- 启动命令；
- JVM 参数；
- 环境变量；
- 外部配置；
- 日志目录；
- 容器内存限制；
- Health Check。

## 2. Native 模式

Native 的启动速度和内存很诱人，但不能只看这两个指标。

还需要额外验证：

- 编译耗时；
- 镜像大小；
- 反射；
- JSON；
- 数据库驱动；
- 第三方库；
- CI 成本；
- 出问题后的诊断成本。

所以当时更实际的策略是：

> **先把 JVM 模式跑稳，Native 作为单独专题验证。**

不是迁 Quarkus 就必须同时迁 Native。

## 3. CI/CD

需要继续支持：

- Maven；
- 多模块；
- 测试；
- Docker Build；
- 镜像推送；
- 部署脚本；
- 滚动发布；
- 回滚；
- 环境变量注入。

如果原来已有成熟流水线，框架迁移应该尽量减少对它的破坏。

# 十二、运行内存与性能

## 1. JVM 参数

需要实际观察：

- Xms；
- Xmx；
- Xss；
- GC；
- Metaspace；
- 容器限制；
- RSS；
- 长时间运行稳定性。

小服务可以从类似参数开始实验：

```bash
-Xms128m -Xmx256m -Xss512k
```

GC 也需要按实际场景验证，例如：

```bash
-XX:+UseG1GC
```

低资源场景还可以比较 Serial GC。

这些都只是实验起点，不应该直接当成通用推荐值。

## 2. 线程池

这是实际迁移后很容易踩坑的一项。

需要关注：

- HTTP 线程；
- worker；
- 阻塞调用；
- 同步 HTTP 请求；
- 异步 HTTP 请求；
- 队列；
- 线程数；
- CPU 与线程关系。

一个重要经验是：

> **同步阻塞调用如果长期占住 Quarkus executor / worker 线程，可能导致其他请求排队甚至超时。**

因此需要根据场景：

```text
异步化
或
使用独立线程池
```

这和传统 Spring MVC 的默认线程模型体验并不完全一样，是迁移时需要特别关注的地方。

## 3. 启动速度

既然迁移的起点就是启动慢，那最终必须记录：

- 空应用；
- 真实业务模块；
- 本地；
- Docker；
- Spring Boot 对比；
- 不同 JVM 参数。

否则“Quarkus 启动更快”只能停留在印象。

# 十三、安全与请求处理

## 1. CORS

需要验证：

- localhost；
- 127.0.0.1；
- 测试域名；
- 生产域名；
- OPTIONS；
- Header；
- Method；
- Credentials。

## 2. Host Header

在网关 / Nginx 环境下需要确认：

- 转发后的 Host；
- 回调地址；
- 登录态；
- 多域名代理；
- 区域域名。

这类问题平时不显眼，但一旦换 Web 框架或网关行为，很容易暴露。

## 3. 鉴权

最终仍然需要处理：

- Token；
- 登录态；
- 白名单；
- 管理后台权限；
- 内部接口；
- Filter；
- 未登录；
- 无权限；
- 统一异常返回。

业务系统是否能迁，最终还是要落到这些实际能力上。

# 十四、我后来形成的验证顺序

如果现在重新做一次，我仍然会按阶段验证，而不是一上来就搬业务代码。

## 第一阶段：Web 基础能力

```text
Resource
统一返回
参数校验
统一异常
JSON / LocalDateTime
文件上传下载
```

## 第二阶段：数据访问能力

```text
Repository / Mapper
CRUD
分页
指定字段更新
条件更新
事务
特殊字段
```

## 第三阶段：框架增强能力

```text
HTTP Filter
方法级 Interceptor
请求体处理
配置
Profile
Bean 列表
```

## 第四阶段：中间件能力

```text
Redis
NATS
HTTP Client
Scheduler
XXL-Job
```

## 第五阶段：运维上线能力

```text
日志
Prometheus
Health
Docker
CI/CD
JVM 参数
线程池
启动速度
```

这个顺序的好处是：

> **前一层不稳定，就不要急着把后一层业务搬进来。**

# 十五、哪些能力不需要“长得像 Spring Boot”

迁移过程中我逐渐接受了一件事：

> **Quarkus 不需要长得像 Spring Boot，只需要覆盖原来依赖的业务语义。**

例如：

| Spring Boot 习惯 | Quarkus 对应思路 |
| --- | --- |
| `@RestController` | Jakarta REST Resource |
| Spring Bean | CDI Bean |
| `CommandLineRunner` | Startup Event |
| `@ConfigurationProperties` | Config Mapping / 配置注入 |
| `@Transactional` | Jakarta Transaction |
| `@Valid` | Bean Validation |
| `@Scheduled` | Quarkus Scheduler |
| `@RestControllerAdvice` | ExceptionMapper |
| Filter / Interceptor | Jakarta REST Filter / CDI Interceptor |
| `/actuator/prometheus` | `/q/metrics` |
| Actuator Health | `/q/health` |

真正需要回答的是：

```text
业务结构还能不能保持清晰？
现有 Java 基础代码还能不能复用？
后台常用能力是否完整？
日志监控能不能接回原有体系？
部署方式是否稳定？
迁移后的代码是不是更难维护？
```

如果这些问题都可以接受，那么 API 名字不同并不是迁移障碍。

# 十六、最终判断

这次迁移让我确认，Quarkus 对我来说真正有吸引力的地方，并不是某一个 API，也不是 Native Image。

而是：

> **它在“比传统 Spring Boot 更轻”和“仍然像一个完整业务应用框架”之间找到了一个比较合适的位置。**

一些更轻量的 Java Web 框架虽然启动更快、结构更简单，但如果需要自己重新搭建大量后台基础能力，对已有业务系统并不一定划算。

Go 的资源占用更低，但把 Java 业务系统整体迁过去，又会失去大量现有 Java 基础代码和经验积累。

Quarkus 则允许我继续留在 Java 生态里：

```text
Java
PostgreSQL
Redis
MyBatis-Plus
现有业务代码
现有工具和组件
```

尽量保留这些东西，只替换应用框架本身。

因此，对于主要依赖 PostgreSQL、Redis，Spring 历史绑定又不重的后台服务，Quarkus 是一个值得实际验证的方向。

但迁移前不要只看：

```text
启动时间
Hello World
内存截图
```

真正应该验证的是：

```text
能否承载完整业务开发模式
能否复用现有 Java 基础能力
能否融入日志、监控、部署、测试体系
能否保持更快启动和较低资源占用
能否避免迁移后重新造一套基础设施
```

对我来说，这份清单最终的意义也在这里：

> **先确认 Quarkus 能接住现有 Spring Boot 项目的基础能力，再迁业务。**

而不是先把业务搬过去，再一个一个发现缺什么。
