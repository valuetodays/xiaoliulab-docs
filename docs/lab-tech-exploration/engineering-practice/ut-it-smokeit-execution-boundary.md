---
title: 别把所有测试都叫 Test：我如何用 UT、IT 和 SmokeIT 划分执行边界
description: 基于多年个人实践，介绍如何用 UT、IT 和独立 SmokeIT 工程划分测试执行边界，并通过 Maven Surefire、Failsafe 和明确的触发机制降低误执行风险。
date: 2026-09-07
tags:
  - Java
  - Maven
  - JUnit
  - 单元测试
  - 集成测试
  - SmokeIT
category:
  - 探索技术
  - 测试
---

# 别把所有测试都叫 Test：我如何用 UT、IT 和 SmokeIT 划分执行边界

在 Java 项目里，测试类最常见的命名大概是：

```text
UserServiceTest
OrderServiceTest
PaymentComponentTest
```

这种命名没有错，而且也是大量项目长期使用的方式。

但我在实际开发中逐渐遇到一个问题：

> 看到一个 `*Test`，我并不知道执行它时到底会发生什么。

它可能只是测试一个普通 Java 方法，也可能会启动整个 Spring Boot 或 Quarkus 应用；可能只在内存中运行，也可能会连接 PostgreSQL、Redis，甚至访问外部 HTTP 服务。

当项目规模越来越大以后，测试名称如果只能告诉我“这是一个测试”，信息量就不太够了。

因此，我长期使用了一套自己的测试命名和执行约定：

```text
*UT
*IT
*SmokeIT
```

这不是 Java、JUnit 或 Maven 的行业标准，而是一套我个人使用多年的工程实践。

它的目的也不是让类名看起来更整齐，而是让不同测试的**执行边界更加明确、稳定和可预测**。

## 1. 为什么我不再把所有测试都叫 `Test`

### 1.1 `*Test` 无法表达真实执行边界

假设一个工程中存在：

```text
ExchangeRateServiceTest
PaymentRepositoryTest
RedisCacheTest
ThirdChannelApiTest
```

只看名字，很难判断：

- 是否会启动应用；
- 是否会连接数据库；
- 是否依赖 Redis；
- 是否会访问网络；
- 是否依赖某个已经部署的测试环境；
- 是否会直接修改数据库。

如果这些测试最终都被同一条命令执行，那么问题就不仅仅是“测试运行得比较慢”。

更大的问题是：

> 执行者并不知道自己启动了一组什么性质的测试。

例如开发人员只是想验证刚刚修改的一个计算方法，于是习惯性执行：

```bash
mvn test
```

如果这个命令背后同时包含数据库、MQ、外部 HTTP，甚至直接改库的测试，那么 `mvn test` 的含义其实已经变得很模糊。

### 1.2 `mvn test` 到底应该执行什么

对我来说，`mvn test` 应该具有一个非常稳定的含义：

> 执行本工程中可以高频、低风险、重复运行的 UT。

它应该适合：

- 本地开发时频繁运行；
- 提交代码前运行；
- CI 中持续运行；
- 定时或周期性自动运行；
- 在没有真实外部环境的情况下运行。

而需要真实数据库、Redis、HTTP 服务或其他基础设施的测试，应该进入另一条执行路径。

### 1.3 `*Test` 在我的工程里默认不会执行

这是这套约定里一个很重要的细节。

在我的 Maven 配置里，Surefire 被显式限制为只执行 `*UT`，Failsafe 只执行 `*IT`。

因此，即使有人新建了：

```text
UserServiceTest
ResetAccountTest
DeleteDataTest
```

它们也不会因为“名字里有 Test”就自动进入 Maven 的测试执行链。

这意味着一个新测试只有在被明确归类为：

```text
*UT
```

或：

```text
*IT
```

之后，才真正进入对应的执行集合。

我更愿意接受“一个未分类测试暂时没跑”，也不愿意接受“一个有副作用的测试被自动误跑”。

特别是那些：

- 直接修改数据库；
- 清理测试数据；
- 调用真实 HTTP；
- 重置业务状态；
- 依赖某个测试环境；

如果只是随手命名成 `*Test`，在我的规则下反而处于一种安全的“未注册”状态。

## 2. 为什么我长期使用 `UT / IT`

### 2.1 这是一套个人实践，不是行业标准

首先需要明确：

> `*UT / *IT` 并不是 Java 测试领域的统一标准。

JUnit 并没有规定单元测试必须叫什么名字。

Maven 也不会分析测试代码，然后自动判断：

```text
这是 Unit Test
这是 Integration Test
```

测试类型最终仍然需要通过命名、插件配置、Tag、目录结构等方式人为建立。

Maven 生态对 `*IT` 有比较成熟的约定，但 `*UT` 并不是 Maven 默认规则。

我使用 `UT / IT` 已经很多年，但它仍然只是一种个人工程约定。

### 2.2 Maven 本身并不理解 Unit Test 和 Integration Test

Maven 中通常由 Surefire 和 Failsafe 承担不同阶段的测试执行。

但它们识别哪些测试，本质上仍然依赖匹配规则。

也就是说，Maven 不会理解“这段代码到底是不是单元测试”，它只会按照配置去匹配哪些类属于当前执行集合。

这也是为什么我希望测试类型直接出现在类名中。

### 2.3 我曾经使用过 `UnitTest / IntegrationTest`

这套命名也不是一开始就确定的。

我曾经使用过：

```text
UserServiceUnitTest
UserRepositoryIntegrationTest
```

从可读性来说，这两个名字其实很好。

但使用一段时间以后，我发现它们有一个问题：

```text
UnitTest
IntegrationTest
          ^^^^
```

最终仍然都是以 `Test` 结尾。

如果某个历史 Maven 配置、IDE 配置或者其他工具使用：

```text
**/*Test.java
```

那么：

```text
UserServiceUnitTest
UserRepositoryIntegrationTest
```

依然会全部落入这个大集合。

而这恰好违背了我想要建立明确执行边界的初衷。

### 2.4 为什么最终改成 `UT / IT`

后来我最终收敛成：

```text
UserServiceUT
UserRepositoryIT
```

这样两个集合在名称上就是明确互斥的：

```text
*UT
*IT
```

这确实不是最传统的 Java 测试类命名。

我也接受这一点。

这是一个刻意的取舍：

> 我愿意牺牲一点传统类名风格，换取更加明显的执行边界。

所以这里的 `UT / IT` 不是为了缩写，也不是为了创造一套新的标准。

它只是让我看到类名时，就能立即知道：

> 这个测试应该以什么方式执行。

## 3. UT 和 IT 为什么放在同一个测试目录

### 3.1 我没有采用 `src/integrationtest/java`

还有一种常见做法，是从源码目录上直接拆开：

```text
src/main/java
src/test/java
src/integrationtest/java
```

这种方式当然有优点。

UT 和 IT 可以拥有不同的：

- classpath；
- 依赖；
- resource；
- CI 执行入口。

从构建系统角度看，它的隔离非常明确。

但我最终没有采用这种方式。

### 3.2 同一个被测对象的 UT 和 IT 应该保持邻近

原因是实际开发时，我通常不是这样找测试：

> 我要看看整个项目有哪些 Integration Test。

更常见的情况是：

> 我正在修改这个 Component，它有哪些测试？

例如：

```text
ExchangeRateApiClientUT
ExchangeRateApiClientIT
```

这两个测试虽然执行边界不同，但维护的是同一个组件。

一个典型场景是：

`ExchangeRateApiClientUT` 不真正发起 HTTP 请求，而是读取 `src/test/resources` 中保存的真实脱敏响应样本，并验证 JSON 是否仍然能够正常解析为 `ExchangeRateResponse`。

而 `ExchangeRateApiClientIT` 会真正访问测试环境里的上游服务，获取真实响应，再解析为同一个强类型对象。

UT 和 IT 验证的范围不同，但明显属于同一个业务上下文。

因此我更希望在 IDE 中看到：

```text
thirdchannel/exchangerate/
├── ExchangeRateApiClientUT
└── ExchangeRateApiClientIT
```

而不是为了测试类型，把它们拆散到两个源码目录里。

### 3.3 代码结构靠近，执行策略分开

这最终形成了一个我比较喜欢的职责划分：

> **目录负责组织相关代码，类名负责表达测试类型，Maven 负责决定什么时候执行。**

换句话说：

> **UT 和 IT 在代码结构上靠近，在执行策略上分开。**

## 4. 让 Maven 真正按 UT / IT 执行

仅仅把测试类改名成 `UT / IT` 没有什么意义。

真正重要的是让 Maven 根据这个名称做出执行决策。

目前我的配置类似：

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <version>${surefire-plugin.version}</version>
    <configuration>
        <skip>${skipUTs}</skip>
        <systemPropertyVariables>
            <java.util.logging.manager>org.jboss.logmanager.LogManager</java.util.logging.manager>
            <maven.home>${maven.home}</maven.home>
        </systemPropertyVariables>
        <includes>
            <include>**/*UT.java</include>
        </includes>
        <excludes>
            <exclude>**/*IT.java</exclude>
        </excludes>
    </configuration>
</plugin>

<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-failsafe-plugin</artifactId>
    <version>${failsafe-plugin.version}</version>
    <executions>
        <execution>
            <goals>
                <goal>integration-test</goal>
                <goal>verify</goal>
            </goals>
        </execution>
    </executions>
    <configuration>
        <skip>${skipITs}</skip>
        <includes>
            <include>**/*IT.java</include>
        </includes>
        <excludes>
            <exclude>**/*UT.java</exclude>
        </excludes>
        <systemPropertyVariables>
            <native.image.path>
                ${project.build.directory}/${project.build.finalName}-runner
            </native.image.path>
            <java.util.logging.manager>org.jboss.logmanager.LogManager</java.util.logging.manager>
            <maven.home>${maven.home}</maven.home>
        </systemPropertyVariables>
    </configuration>
</plugin>
```

### 4.1 Surefire 只执行 `*UT`

Surefire 明确配置：

```xml
<includes>
    <include>**/*UT.java</include>
</includes>
```

所以：

```bash
mvn test
```

的含义变得很清楚：

> 执行本工程中的 UT。

普通的 `*Test` 不会被执行。

### 4.2 Failsafe 只执行 `*IT`

Failsafe 则只处理：

```xml
<includes>
    <include>**/*IT.java</include>
</includes>
```

并绑定 `integration-test` 和 `verify`。

整个执行关系非常直观：

```text
XxxUT
   ↓
Surefire
   ↓
test


XxxIT
   ↓
Failsafe
   ↓
integration-test
   ↓
verify
```

### 4.3 `skipUTs / skipITs` 的用途和注意事项

我还分别提供：

```text
skipUTs
skipITs
```

用于控制不同测试集合。

这里需要特别说明：

> `skipUTs` 是我为了这套约定自行绑定的项目属性，不是 Surefire 原生定义的标准属性名。

也就是说，下面这种写法：

```bash
mvn test -DskipUTs=true
```

是否生效，取决于项目中是否像上面这样把它绑定到：

```xml
<skip>${skipUTs}</skip>
```

不要把它和 Surefire 常见的 `skipTests`、`maven.test.skip` 混为一谈。

`skipITs` 则是 Failsafe 生态中常见的属性名，但无论如何，项目里的最终行为仍然应该以当前 `pom.xml` 配置为准。

这里的重要点不是属性名本身，而是：

> **不同测试集合应该有不同的显式执行入口，而不是依赖开发人员猜测。**

另外，从纯模式匹配角度看，在已经配置 `include *UT` 的情况下，再写：

```xml
<exclude>**/*IT.java</exclude>
```

其实是冗余的。

Failsafe 中反过来也一样。

我仍然倾向于保留这种显式配置，因为它让人打开 `pom.xml` 时，不需要自行推导：

- 这里只允许 UT；
- 这里不允许 IT。

对机器来说重复了一点，对阅读代码的人反而更加明确。

## 5. UT 和 IT 的区别，不只是测试范围

### 5.1 UT：必须适合长期、周期执行

在我的定义里，UT 最重要的特征，不是“测试范围一定很小”，而是：

> **它必须适合稳定、重复、自动执行。**

因此 UT 通常不依赖：

- 当前测试环境是否在线；
- 某个外部渠道是否可用；
- 网络是否稳定；
- 某个共享测试数据是否仍然存在。

例如渠道调用中，可以保存测试环境里真实出现过的响应报文：

```text
src/test/resources/lianlian/
├── payout/
│   └── rate_resp.txt
└── virtualAccount/
    └── getVirtualAccount-resp.txt
```

这些内容来自真实测试环境，只对必要的敏感字段做脱敏。

然后 UT 读取这些协议样本，并验证：

```text
真实脱敏响应
→ 当前解析代码
→ 强类型对象
```

哪怕测试核心只是：

```java
JSONUtil.parse(text, ExchangeRateResponse.class);
```

它仍然有意义。

它至少能够持续证明：

> 当前代码仍然可以处理我们历史上已经确认过的协议。

类似地，我也倾向于对下面这些协议基础能力强制保留 UT：

- 加密；
- 解密；
- 签名；
- 验签；
- 序列化；
- 反序列化。

这些代码看起来往往很小，但一旦底层依赖、JDK Provider 或协议实现发生变化，风险并不小。

因为 UT 不依赖真实外部环境，所以它除了开发阶段使用之外，还承担另一项职责：

> **周期性运行。**

它可以在 CI、每日构建或其他自动任务中反复执行，用来持续确认：

> 我们的代码没有悄悄破坏过去已经成立的能力。

### 5.2 IT：更多用于开发人员按需验证真实功能

IT 的角色则不同。

IT 通常会进入真实集成边界，例如：

- 数据库；
- Redis；
- MQ；
- 测试环境；
- 真实 HTTP；
- 第三方渠道。

仍以渠道调用为例，`ExchangeRateApiClientIT` 可以真正访问测试环境：

```text
HTTP Client
→ 网络
→ 测试环境上游
→ 当前真实响应
→ JSON 解析
→ 强类型对象
```

它验证的是一条真实链路。

但也正因为如此，它通常不适合像 UT 一样高频、周期执行。

它可能受到：

- 测试环境状态；
- 上游服务可用性；
- 网络波动；
- 数据准备；
- 限流；
- 临时配置；

影响。

因此在我的工程里，IT 更多是：

> **开发人员在开发、联调、排障或发布前按需执行的测试。**

### 5.3 UT 也可以覆盖 IT 所关心的一部分能力

UT 和 IT 并不是完全不同的两个世界。

例如 UT 可以通过真实脱敏 JSON 样本验证：

```text
JSON → 强类型对象
```

而 IT 则通过真实 HTTP 获取当前 JSON 后，再验证同一段解析逻辑。

两者都会覆盖解析能力，区别只是 IT 把验证边界进一步向外扩展到了真实环境。

因此：

> UT 可以覆盖 IT 中一部分稳定、可离线验证的能力，同时额外承担周期运行的责任。

### 5.4 为什么我宁愿“漏执行”，也不接受“误执行”

这也是 `*Test` 默认不执行的原因。

自动测试体系里，一个未分类的测试暂时没有执行，通常还可以被代码评审、人工测试或后续整理发现。

但一个本不应该自动运行的测试如果被周期任务误执行，可能直接产生：

- 脏数据；
- 状态修改；
- 真实外部请求；
- 重复消息；
- 共享环境污染。

所以我的选择很明确：

> **对于自动执行，我更看重低副作用和可预测性，而不是“尽量把所有测试都跑起来”。**

### 5.5 这套约定仍然需要开发人员正确分类

这套方案并不会自动理解测试内容。

如果有人把一个会写数据库、发真实 HTTP 的测试错误地命名成 `XxxUT`，Surefire 仍然会执行它。

因此：

> `UT / IT` 是执行边界，也是开发约定；它不能完全替代代码评审和工程约束。

目前我的主要约束仍然来自：

- 清晰命名；
- 代码评审；
- 测试代码本身的可读性；
- 对 UT 副作用的明确要求。

如果团队规模继续扩大，也可以进一步考虑用静态检查或 ArchUnit 一类工具做兜底，例如限制 `*UT` 对真实网络客户端、数据库访问层等依赖。

但这属于进一步的增强，而不是这套方案成立的前提。

## 6. SmokeIT 为什么单独放在另一个工程

UT 和 IT 都属于业务工程。

SmokeIT 则不同。

目前我的 SmokeIT 是独立工程，它不会参与业务工程正常的 Maven 测试生命周期。

### 6.1 通过 HTTP 把已部署系统当成黑盒

SmokeIT 不启动被测应用。

它直接通过 HTTP 调用一个已经部署的服务。

因此它看到的是：

```text
HTTP Request
→ 已部署系统
→ HTTP Response
```

它不需要知道 Controller 是哪个类、Service 怎么实现、DAO 用 MyBatis 还是 JPA，也不关心应用是 Spring Boot 还是 Quarkus。

从 SmokeIT 角度看，整个系统就是一个黑盒。

### 6.2 SmokeIT 不属于业务工程的常规测试生命周期

我把它放到独立工程，还有一个非常实际的原因：

> 避免一个普通的业务工程构建意外访问已部署环境。

业务工程中的开发人员可以放心运行 UT。

需要 IT 时，也是在本工程明确进入集成测试阶段。

而 SmokeIT 必须进入另一个工程执行。

这本身就是一层很强的隔离。

### 6.3 关键能力检查与历史 Bug 回归

目前我的 SmokeIT 大致承担两类职责。

第一类是验证系统关键能力仍然正常。

例如：

```text
HeartbeatSmokeIT
OrderSmokeIT
CountrySmokeIT
CurrencyModuleSmokeIT
```

这类测试不追求完整接口覆盖率，而是回答：

> 这个已经部署的系统最核心的能力现在还能不能工作？

另一类则是历史 Bug 回归。

例如曾经发生过一次 OSS 域名迁移问题。

旧域名已经不可访问，新域名才是系统当前应该使用的地址。

于是可以留下：

```java
class OssImageSmokeIT {

    @Test
    void currentOssImageShouldReturnOk() {
        // 新域名应返回 200
    }

    @Test
    void legacyOssImageShouldBeRejected() {
        // 旧域名当前返回 403
    }
}
```

这个测试真正保存的并不是：

> HTTP GET 应该返回 200。

它保存的是一段工程历史：

> 我们曾经发生过一次域名迁移问题，这个问题以后不能再次被带回来。

因此我把这一类 SmokeIT 理解成：

> **可执行的 Bug 档案。**

修复一个 Bug，只是解决这一次故障。

留下一个能够长期运行的回归测试，才是在防止它再次发生。

### 6.4 SmokeIT 必须有明确的触发机制

SmokeIT 既然被拆到了独立工程，就必须同时回答另一个问题：

> 谁来执行它，什么时候执行？

如果没有明确触发机制，那么只是把“什么时候运行测试”这个问题从业务工程转移到了另一个工程。

目前我更倾向于把 SmokeIT 分成几种触发方式：

- **发布后自动执行**：验证新部署版本最基本的能力是否可用；
- **周期执行**：适用于 Heartbeat、关键只读接口、稳定的历史 Bug 回归；
- **开发人员手工执行**：用于联调、排障、验证某个特定问题。

其中，关键能力类 SmokeIT 和没有明显副作用的历史 Bug 回归，天然适合进入自动执行链。

例如：

```text
发布完成
→ 执行关键 SmokeIT
→ 判断新版本是否具备基本可用性
```

也可以：

```text
周期任务
→ 执行稳定的 SmokeIT
→ 持续确认关键能力和历史故障点没有再次出问题
```

这样，“可执行的 Bug 档案”才不只是代码仓库里的一份记录，而是真正参与系统持续验证。

### 6.5 为什么 SmokeIT 默认只做只读操作

因为 SmokeIT 面向的是真实部署环境，所以我对它的副作用要求明显更严格。

目前很多 SmokeIT 会明确注明：

> 仅执行查询，不触发写操作。

原因很简单。

一个真实写接口可能产生：

- 数据库数据；
- 订单；
- MQ 消息；
- 邮件；
- 短信；
- 第三方 API 调用；
- 支付或退款行为。

因此 SmokeIT 的第一目标不是覆盖率。

而是：

> 在尽量低副作用的情况下，验证系统关键行为。

如果确实需要写操作，则应该额外考虑：

- 是否幂等；
- 是否能够清理；
- 是否使用专用测试数据；
- 是否会触发真实业务行为。

## 7. 三类测试最终形成的边界

经过这些年的调整，目前我理解的三层测试大致是：

| 类型 | 所在位置 | 典型执行方式 | 是否适合周期执行 | 主要保护对象 |
|---|---|---|---|---|
| `UT` | 业务工程 | Surefire、CI、定时任务 | 是 | 本地逻辑、已知协议、基础能力 |
| `IT` | 业务工程 | Failsafe、开发人员按需 | 通常否 | 真实集成、数据库、Redis、测试环境、外部依赖 |
| `SmokeIT` | 独立工程 | 部署后自动、部分周期、人工按需 | 部分适合 | 已部署系统、关键链路、历史 Bug |
| `*Test` | 业务工程 | 默认不执行 | 否 | 未明确归类 |

它们失败时表达的含义也不同。

### 7.1 UT 失败

优先检查：

- 代码逻辑；
- DTO；
- 序列化 / 反序列化；
- 加解密；
- 签名验签；
- 最近重构。

### 7.2 IT 失败

优先检查：

- 数据库；
- Redis；
- 应用配置；
- 真实 HTTP Client；
- 测试环境；
- 上游接口；
- 组件之间的组合。

### 7.3 SmokeIT 失败

优先检查：

- 当前部署版本；
- 环境配置；
- 网络；
- DNS；
- 证书；
- 外部依赖；
- 真实数据状态；
- 历史问题是否复发。

因此三层测试并不是按照“测试多一点、测试少一点”区分。

它们实际上是在逐层扩大系统边界：

```text
UT
代码内部及可离线验证能力
  ↓
IT
本工程及真实集成依赖
  ↓
SmokeIT
已经部署的完整系统
```

更重要的是，它们有不同的触发方式：

- UT：默认、高频、自动；
- IT：按需、人工为主；
- SmokeIT：部署后自动、部分周期执行、必要时人工；
- `*Test`：默认不执行。

执行边界不仅体现在名字里，也体现在“谁会跑它、什么时候跑它”。

## 8. 结语：这不是测试命名规范，而是一套长期工程实践

我使用 `UT / IT` 已经很多年。

后来又逐渐形成独立的 SmokeIT 工程。

但我并不认为：

```text
*UT
*IT
*SmokeIT
```

是什么应该被所有项目照搬的行业标准。

它只是一套长期使用后，我觉得适合自己工程习惯的实践。

我真正关心的不是测试类最终叫什么，而是：

> **开发人员看到一个测试时，能不能大概知道执行它会发生什么。**

因此我更希望：

```text
ExchangeRateApiClientUT
ExchangeRateApiClientIT
OssImageSmokeIT
```

这种名称本身就带有一部分执行语义。

最终，我把这套实践理解为几层职责的组合：

> **目录负责让相关代码靠近，命名负责表达测试类型，Maven 负责控制执行阶段，独立工程负责隔离已部署系统，而自动化入口负责决定这些测试什么时候真正发生。**

所以这篇文章真正想表达的并不是：

> 测试类应该使用 `UT / IT` 结尾。

而是：

> **不要把不同执行成本、不同依赖范围、不同副作用风险的测试，都隐藏在一个含义过于宽泛的 `Test` 后面。**

只要最终能够让测试的执行边界显式、稳定、可预测，具体采用哪一种命名方式，都可以根据自己的项目和团队做选择。
