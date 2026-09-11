---
title: Mapper 测试为什么只需要最小 Spring 上下文
description: 记录一种轻量 Mapper 集成测试方式：修改 Mapper、XML 或 SQL 后，不启动完整 Spring Boot 应用，只加载 DataSource、MyBatis-Plus 和目标 Mapper，以尽快验证刚刚的调整。
tags:
  - Spring Boot
  - MyBatis-Plus
  - Mapper
  - Integration Test
  - 测试
  - 快速反馈
category:
  - 技术探索
orientations:
  - boundary
  - explicit
  - restraint
  - reproducible
---

# Mapper 测试为什么只需要最小 Spring 上下文

修改 Mapper、XML 或 SQL 以后，我经常只是想确认一件事：

> **这次修改到底能不能正常执行。**

例如刚刚改了：

```text
Mapper 方法
Mapper XML
SQL
参数绑定
ResultMap
字段映射
```

这时候如果为了验证一次修改，先启动完整 Spring Boot 应用，再登录、进入页面、构造业务条件、触发接口，反馈链路就太长了。

我更希望得到的是：

```text
修改 Mapper / XML / SQL
        ↓
直接运行对应 MapperIT
        ↓
几秒内确认刚刚的调整
```

所以这类测试的核心目标不是尽可能还原完整应用，而是**让开发者在修改 Mapper、XML 或 SQL 后，可以很便宜地验证刚刚的调整。**

## 最小上下文不是越少越好

这类 Mapper 测试真正需要的东西通常只有：

```text
Spring Test
+
DataSource
+
MyBatis / MyBatis-Plus
+
目标 Mapper
+
测试数据库
```

与这次 Mapper 验证无关的组件，则没有必要一起启动。

例如：

```text
Controller
Service
Security
Scheduler
MQ
第三方 Client
Web Filter
业务 Interceptor
```

这些组件即使在正式应用里存在，也不代表测试 Mapper 时必须加载。

不过“最小上下文”不是简单地理解成：

> 能删多少就删多少。

更准确的是**只保留会影响这次 Mapper 验证结果的依赖。**

例如某个 MyBatis 插件本身会改变 SQL 行为，而这次测试正好需要验证这种行为，那么它就应该进入测试上下文。

但如果只是登录校验、Web 请求上下文、审计日志或其他业务链路拦截器，就没有必要为了测试 Mapper 一起启动。

## 核心价值是快速反馈

这套做法最直接的收益当然是启动更快。

在一个 Spring Boot 2.2.10 示例工程中，Mapper 测试的 Spring 上下文启动大约需要：

```text
约 2 秒
```

单独执行：

```text
BookMapperIT#selectList
```

测试本身大约只需要：

```text
约 200 ms
```

但我更看重的不是这个数字本身。

真正重要的是**反馈周期足够短以后，开发过程中可以随时运行。**

修改 Mapper XML 后，如果不确定 SQL 有没有写错，可以直接在 IDE 中运行对应测试方法。

在实际项目里，这个差异会更加明显。

公司开发机配置一般，启动完整 Spring Boot 应用大约需要约 50 秒或更久。而运行这套最小 Mapper 测试，从启动 Spring 上下文到得到结果大约只需要约 3 秒。

以前遇到过不少很小的 Mapper XML 修改，例如只是增加或删除一个查询字段，结果 `SELECT` 后面的字段列表多了一个逗号，或者少了一个逗号。

这种错误本身很简单，但如果本地没有一个低成本的验证入口，就可能一直到重新部署以后才发现：

```text
修改 Mapper XML
→ 打包
→ 部署
→ 启动应用
→ 进入业务流程
→ SQL 执行失败
→ 再修改
→ 再部署
```

一个本来几秒钟就能发现的问题，最后变成了一次完整的重新部署。

所以这里真正想缩短的，不只是 Spring 的启动时间，而是：

> **从“刚刚改完代码”到“知道这次修改有没有问题”之间的时间。**

开发过程就可以变成：

```text
改一点
→ 跑一次
→ 确认
→ 再继续
```

而不是：

```text
先改一批
→ 最后再启动整个系统
→ 一次性排查多个问题
```

Mapper、XML 和 SQL 都很适合这种短反馈循环。

## 最常见的使用场景

这类 Mapper IT 最适合处理的，不是复杂业务回归，而是刚改完 Mapper、XML 或 SQL 后的快速确认。

例如：

```text
Mapper XML 少了一个逗号
动态 SQL 的 <if> 只判断了 null，没有处理空字符串
ResultMap 漏了一个字段
SELECT xxx AS yyy 中的别名 yyy 写错
字段名改了，但 SQL 里还保留旧名称
参数名和 XML 中的引用不一致
SQL 能执行，但结果映射不完整
```

这些问题有两类。

一类会让 SQL 直接失败：

```text
语法错误
参数绑定错误
字段名不存在
```

另一类则更隐蔽：

```text
SQL 可以正常执行
但返回结果不正确
```

例如：

```sql
SELECT
    user_name AS username,
    tenant_id AS tenant
FROM t_user
```

如果：

```text
tenant
```

这个别名和目标对象属性不一致，SQL 本身可能完全没有报错，但最终映射结果已经不对了。

这类问题如果通过完整业务流程验证，成本很高。

可能需要：

```text
启动完整应用
→ 登录
→ 进入页面
→ 构造条件
→ 调接口
→ 再观察返回值
```

而 Mapper IT 可以直接把反馈链路缩短成：

```text
修改 Mapper / XML / SQL
        ↓
运行对应 MapperIT
        ↓
马上知道刚才的调整是否有问题
```

它不是为了替代完整业务测试，而是专门处理开发过程中频繁出现的：

```text
小修改
小错误
立即验证
```

## 为什么不用 `@SpringBootTest`

最常见的 Mapper 集成测试写法之一是：

```java
@SpringBootTest
class BookMapperIT {
}
```

它当然可以工作。

但 `@SpringBootTest` 更接近：

> 启动一个完整的 Spring Boot ApplicationContext。

实际项目里，这通常意味着除了 Mapper，还会加载大量无关组件：

```text
Controller
Service
Security
Redis
Scheduler
MQ
HTTP Client
第三方渠道 Bean
OSS
其他业务配置
```

于是一个 Mapper 测试可能因为完全无关的组件失败。

例如：

```text
第三方配置缺失
Redis 无法连接
某个 Scheduler 初始化失败
某个 Bean 创建失败
某个 Web Interceptor 依赖缺失
```

这些失败都不能说明 Mapper 本身有问题。

而 Mapper 测试真正需要验证的链路其实很窄：

```text
DataSource
    ↓
MyBatis-Plus
    ↓
Mapper
    ↓
SQL
    ↓
Database
```

所以没有必要为了验证这一条链路，把整个应用一起启动。

## 这是 IT，但主要用于开发时手工快速验证

虽然这种测试很轻，但我仍然把它命名为：

```text
BookMapperIT
```

而不是：

```text
BookMapperUT
```

因为它依赖：

```text
Spring Context
DataSource
MyBatis-Plus
真实 SQL
数据库
```

所以从测试性质上看，它仍然属于 Integration Test。

这和我在另一篇文章中使用的：

```text
*UT
*IT
*SmokeIT
```

分类是一致的。

关于这套测试执行边界，可以参考[别把所有测试都叫 Test：我如何用 UT、IT 和 SmokeIT 划分执行边界](/lab-tech-exploration/engineering-practice/ut-it-smokeit-execution-boundary)

不过，这里的 Mapper IT 有一个很重要的使用场景区别。

它并不是为了让开发者每次修改代码以后，都通过命令行批量执行所有 IT。

它更主要用于开发过程中的手工快速验证。

例如刚刚修改了：

```text
BookMapper.java
BookMapper.xml
一段 SQL
一个 ResultMap
```

此时可以直接在 IDE 中运行：

```text
BookMapperIT#selectList
```

快速确认刚才的调整有没有问题。

也就是说，它的典型使用方式是：

```text
修改 Mapper / XML / SQL
        ↓
在 IDE 中运行对应 MapperIT
        ↓
几秒内确认结果
```

而不是：

```text
每改一次代码
        ↓
命令行执行全部 IT
```

`*IT` 在这里表达的是测试性质和执行边界，不代表它必须以批量命令行方式运行。

## 关于本文示例

本文示例的目标是演示：**如何为 Mapper 测试构造一个足够小的 Spring 上下文。**

所以代码刻意做了简化。

例如：

```java
mapper.selectList(null);
```

这里只是为了让示例足够短。

读者可以把它理解成：

```text
一个实际项目里的复杂 Mapper 方法
+
对应 Mapper XML 中的 <select> 节点
+
动态 SQL
+
ResultMap
```

文章关注的不是 `selectList(null)` 本身，而是：

> 修改 Mapper、XML 或 SQL 后，是否可以不启动完整应用，直接运行对应 Mapper IT 快速验证。

示例中使用 H2，只是为了让工程可以独立运行、不依赖外部数据库。

真实项目里数据库怎么准备，可以根据测试目标选择，后文会单独说明。

## 示例项目结构

下面使用一个 Spring Boot 2.2.10 的示例工程。

项目结构被简化成两个模块：

```text
springboot2-sample-common-mapper
├─ common-mapper
│  ├─ src/main/java
│  │  ├─ mapper
│  │  └─ po
│  │
│  └─ src/test
│     ├─ java
│     │  ├─ MapperTestBase
│     │  └─ BookMapperIT
│     │
│     └─ resources
│        ├─ application-dao-test.yml
│        └─ db
│           ├─ schema.sql
│           └─ data.sql
│
└─ web
   └─ Spring Boot Application
```

当前项目把 Mapper、PO 和 MyBatis-Plus 相关代码集中在独立的：

```text
common-mapper
```

模块中。

`web` 模块依赖 `common-mapper`。

这里的模块名只是当前项目的组织方式，不是这套测试方案的必要条件。

真正重要的是：

> **`common-mapper` 自己就能够完成 Mapper 测试，不需要通过 `web` 模块启动完整 Spring Boot 应用。**

## Spring Boot 2.2.10 示例

<a href="https://cdn.jsdelivr.net/gh/valuetodays/supreme-octo-palm-tree@main/attachment/springboot2-sample-common-mapper.zip">点此下载最小化工程代码</a>

这套示例实际使用：

```text
Spring Boot 2.2.10.RELEASE
MyBatis-Plus 3.5.15
Java 8
H2
```

父工程中明确版本：

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.2.10.RELEASE</version>
</parent>

<properties>
    <java.version>1.8</java.version>
    <mybatis-plus.version>3.5.15</mybatis-plus.version>
</properties>

<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-bom</artifactId>
            <version>${mybatis-plus.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

`common-mapper` 模块依赖 MyBatis-Plus：

```xml
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-boot-starter</artifactId>
</dependency>

<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
</dependency>
```

示例中还使用了 P6Spy 观察 SQL：

```xml
<dependency>
    <groupId>p6spy</groupId>
    <artifactId>p6spy</artifactId>
    <version>3.9.1</version>
</dependency>
```

P6Spy 不是这套最小 Mapper 测试结构的必要条件。

## MapperTestBase 只加载必要配置

核心代码很短：

```java
@ExtendWith(SpringExtension.class)
@ContextConfiguration(
        initializers = ConfigFileApplicationContextInitializer.class
)
@ActiveProfiles("dao-test")
@Configuration(proxyBeanMethods = false)
@Import({
        DataSourceAutoConfiguration.class,
        MybatisPlusAutoConfiguration.class
})
public abstract class MapperTestBase {
}
```

这里没有：

```java
@SpringBootTest
```

也没有：

```java
@SpringBootApplication
```

只明确导入：

```java
DataSourceAutoConfiguration.class
MybatisPlusAutoConfiguration.class
```

也就是说，这个测试上下文关心的是：

```text
怎么创建 DataSource
怎么初始化 MyBatis-Plus
```

而不是：

```text
整个应用怎么启动
```

### `SpringExtension`

```java
@ExtendWith(SpringExtension.class)
```

让 JUnit 5 测试使用 Spring TestContext。

这样具体测试类仍然可以使用：

```java
@Autowired
```

注入 Mapper。

### `ConfigFileApplicationContextInitializer`

```java
@ContextConfiguration(
        initializers = ConfigFileApplicationContextInitializer.class
)
```

用于加载 Spring Boot 配置文件。

配合：

```java
@ActiveProfiles("dao-test")
```

测试会读取对应测试配置。

### 只导入两个自动配置

真正决定上下文范围的是：

```java
@Import({
        DataSourceAutoConfiguration.class,
        MybatisPlusAutoConfiguration.class
})
```

这里没有开启整个 Spring Boot 自动配置体系，而是明确选择 Mapper 测试需要的部分。

这使测试目标保持得很窄：

```text
DataSource
+
MyBatis-Plus
+
Mapper
```

## Base 不负责扫描业务 Mapper

`MapperTestBase` 没有：

```java
@MapperScan
```

这是刻意的。

Base 只定义：

> 一个 Mapper IT 应该如何获得最小测试环境。

至于具体测试需要扫描哪个 Mapper 包，由测试类自己决定。

例如：

```java
@Slf4j
@MapperScan(basePackages = {
        "cn.xiaoliulab.sample.common.mapper"
})
public class BookMapperIT extends MapperTestBase {

    @Autowired
    private BookMapper mapper;

    @Test
    public void selectList() {
        List<BookPO> list = mapper.selectList(null);

        Assertions.assertFalse(list.isEmpty());

        log.info("list={}", list);
    }
}
```

这样：

```text
MapperTestBase
```

负责：

```text
DataSource
MyBatis-Plus
测试配置
```

而：

```text
BookMapperIT
```

负责：

```text
扫描哪些 Mapper
测试哪个 Mapper
验证什么结果
```

Base 不需要知道具体业务 Mapper 在哪里。

## 测试数据库使用 H2

测试配置使用独立 profile：

```yaml
spring:
  datasource:
    driver-class-name: com.p6spy.engine.spy.P6SpyDriver
    url: jdbc:p6spy:h2:mem:dal-test;MODE=MySQL;DB_CLOSE_DELAY=-1
    username: sa
    password:
    initialization-mode: always
    schema:
      - classpath:db/schema.sql
    data:
      - classpath:db/data.sql
```

测试启动时：

```text
创建 H2 内存数据库
    ↓
执行 schema.sql
    ↓
执行 data.sql
    ↓
运行 Mapper IT
```

例如测试表：

```sql
create table if not exists t_book (
    id bigint not null primary key auto_increment,
    type_id bigint,
    book_isbn varchar(32),
    book_name varchar(32),
    status enum('PENDING', 'PUBLISHED')
);
```

再准备少量固定测试数据：

```sql
INSERT INTO t_book (
    id,
    type_id,
    book_isbn,
    book_name,
    status
)
VALUES
    (1, 100, 'aaa', 'java入门', 'PENDING'),
    (2, 101, 'bbb', 'java中级', 'PENDING'),
    (3, 102, 'ccc', 'java高级', 'PENDING');
```

这里使用 H2 只是为了让示例无需准备外部 MySQL 就可以运行。

真实项目并不需要照搬这种数据库准备方式。

## 为什么这里可以测试写操作

如果 Mapper IT 直接连接共享开发数据库，我通常会更加谨慎，甚至限制测试只读。

但这个示例使用的是：

```text
H2 内存数据库
```

测试数据本身就是临时创建的。

因此：

```java
mapper.insert(...)
mapper.update(...)
mapper.delete(...)
```

都可以安全验证。

这里真正的边界不是 Mapper IT 永远不能写数据库。

而是**测试是否能够控制自己写入的数据环境。**

不过，H2 是临时数据库，并不代表同一个测试上下文中的多个 `@Test` 方法天然互不影响。

Spring Test 会缓存 ApplicationContext，`schema.sql` 和 `data.sql` 通常只在数据库初始化时执行一次。

如果一个测试方法修改了数据：

```java
@Test
void updateBook() {
    mapper.update(...);
}
```

后面的另一个测试方法就可能看到已经被修改过的数据。

这容易出现一种典型问题：

```text
单独运行某个测试
→ 通过

运行整个测试类
→ 失败
```

原因不是 Mapper 本身，而是测试方法之间共享了数据状态。

对于存在写操作的 Mapper IT，可以使用：

```java
@Transactional
```

让每个测试方法执行结束后自动回滚。

例如：

```java
@Transactional
@Test
void updateBook() {
    // 修改测试数据

    // 测试结束后自动回滚
}
```

如果某些场景不适合事务回滚，也应该显式清理测试数据。

目标是：

> **每个测试方法都能够独立运行，不依赖其他测试方法之前执行了什么。**

对于一次性的测试数据库，写操作本身没有问题；真正需要避免的是测试方法之间产生隐式的数据依赖。

## 为什么不通过 web 模块测试 Mapper

当前模块关系是：

```text
web
  ↓
common-mapper
```

如果为了测试 `common-mapper`，反过来必须先启动：

```text
web
```

那么测试结构就会变成：

```text
BookMapper
    ↓
为了测试它
    ↓
启动 web
    ↓
加载完整应用
```

这会让底层模块的验证依赖上层应用。

而现在：

```text
common-mapper
    ↓
自己的 MapperTestBase
    ↓
自己的测试数据库
```

就可以独立完成验证。

这不仅减少启动内容，也缩短了开发中的反馈链路。

## 为什么不加载业务 Interceptor

完整应用中可能存在很多 Interceptor。

例如：

```text
登录校验
租户上下文
请求日志
审计
权限
Web 请求链路
```

这些组件在正式应用里可能非常重要。

但 Mapper IT 的问题是：

> 刚刚修改的 Mapper、XML 或 SQL 能不能正确执行？

如果某个 Interceptor 不会影响这个问题的答案，就没有必要加载。

否则测试会重新开始依赖：

```text
Token
Request
Session
Redis
当前用户
租户上下文
其他业务 Bean
```

测试范围又会慢慢扩大。

当然，如果测试目标本身就是验证某个 MyBatis Interceptor 对 SQL 的影响，那么这个 Interceptor 就属于必要依赖，应该显式加入。

判断标准始终只有一个：

> **它是否会影响当前 Mapper 验证结果。**

## H2 的 MySQL 兼容模式不是 MySQL

示例中使用：

```text
MODE=MySQL
```

让 H2 尽量按照 MySQL 的部分语法和行为执行。

这对于演示和开发阶段快速验证很方便。

例如可以很快发现：

```text
SQL 少了逗号
字段名写错
参数绑定错误
ResultMap 不完整
SELECT 别名写错
动态 SQL 拼接错误
```

但：**H2 的 MySQL 兼容模式并不等于真正的 MySQL。**

在一些更依赖数据库实现细节的场景中，两者仍然可能存在差异，例如：

```text
数据库函数
日期时间行为
大小写规则
ENUM 行为
JSON 类型
索引
锁
事务隔离级别
执行计划
MySQL 特有语法
```

因此这套 H2 Mapper IT 更适合回答：刚刚修改的 Mapper、XML 或 SQL 是否基本正确？

而不是：这段 SQL 在真实 MySQL 中的所有行为是否完全正确？

真实项目如果需要验证 MySQL 行为，可以直接连接测试 MySQL：

```text
Mapper IT
  ↓
MySQL
```

这种情况下通常不需要：

```text
schema.sql
data.sql
```

因为数据库结构和测试数据已经存在。

另一种方式是：

```text
Testcontainers
  ↓
启动临时 MySQL
  ↓
schema.sql
  ↓
data.sql
  ↓
Mapper IT
```

这样仍然能够控制数据环境，同时使用真实 MySQL。

所以：

```text
H2 + schema.sql + data.sql
```

只是本文为了方便演示选择的一种实现。

不是这套 Mapper 最小上下文方案的必要组成部分。

## 最小上下文也让失败更容易定位

完整应用启动失败时，问题可能来自任何地方。

而 Mapper 最小上下文里的失败范围很有限：

```text
DataSource 配置
MyBatis-Plus 配置
Mapper 扫描
Mapper XML
SQL
数据库结构
结果映射
```

如果 `BookMapperIT` 失败，排查范围天然比：

```java
@SpringBootTest
```

小很多。

因此最小上下文带来的不只是启动速度，还有：**更小的故障搜索空间。**

## 不同 Spring Boot 版本的实现会变化

不同 Spring Boot 和 MyBatis-Plus 版本下：

```text
自动配置类
测试依赖
配置文件加载方式
```

都可能发生变化。

因此示例代码不能简单跨版本复制。

但这篇文章关注的原则不依赖具体版本：

```text
不启动完整 Application
不加载 Web 层
不加载无关业务 Bean
不加载与 Mapper 验证无关的 Interceptor

只加载会影响 Mapper 执行结果的组件
```

版本变化的是实现方式，不变的是测试边界。

## 什么时候不适合使用这种方式

最小 Mapper IT 适合快速验证：

```text
Mapper
XML
SQL
参数绑定
数据库字段映射
ResultMap
MyBatis 插件行为
```

但它不能替代完整应用测试。

如果真正要验证的是：

```text
Controller
  ↓
Service
  ↓
事务
  ↓
Security
  ↓
Mapper
```

那就已经不是 Mapper 测试的范围。

这时应该使用更高层级的 IT 或 SmokeIT。

同样，如果测试目标依赖真实数据库特性，也不应该因为本文示例用了 H2，就强行继续使用 H2。

测试环境应该跟随测试目标扩大，而不是让一套轻量 Mapper IT 承担所有验证职责。

## 最后的结构

最终 Mapper 测试的依赖关系很简单：

```text
BookMapperIT
      ↓
MapperTestBase
      ↓
Spring Test
      ↓
DataSourceAutoConfiguration
      +
MybatisPlusAutoConfiguration
      ↓
BookMapper
      ↓
测试数据库
```

没有：

```text
Web Application
Controller
Security
Scheduler
第三方 Client
业务 Interceptor
其他业务 Bean
```

当 Mapper、XML 或 SQL 发生修改时，可以直接在 IDE 中运行对应 IT，在很短的时间内得到反馈。

数据库既可以是：

```text
H2
```

也可以是：

```text
测试 MySQL
```

或者：

```text
Testcontainers + MySQL
```

数据库怎么准备可以变化，最小上下文的目标不变。

## 结论

Mapper 测试使用最小 Spring 上下文，并不是为了证明：

> Spring Boot 启动得越少越高级。

它解决的是一个很实际的问题：**让开发者在修改 Mapper、XML 或 SQL 后，可以很便宜地验证刚刚的调整。**

为了这个目标，测试只需要加载会影响 Mapper 执行结果的组件。

如果某个组件和这次验证无关，就没有必要进入测试上下文。

于是开发过程可以保持一个很短的反馈循环：

```text
修改
→ 运行对应 MapperIT
→ 确认
→ 继续
```

这就是最小 Mapper 测试上下文真正的价值。