---
title: "Spring Boot 2.2 + Micrometer 中 JVM 指标为什么会突然消失"
description: "记录一次 Spring Boot 2.2.10.RELEASE + Micrometer 1.3.14 环境中的真实排查过程：自定义 AsyncConfigurer 接入线程池监控后，Prometheus 端点仍然正常，但 jvm_* 指标全部消失。通过对照实验、延迟绑定验证和 Bean 生命周期分析，最终定位到 MeterRegistry 被提前初始化。"
date: 2026-08-27
head:
  - - meta
    - name: keywords
      content: Spring Boot,Micrometer,Prometheus,JVM Metrics,MeterRegistry,AsyncConfigurer,Actuator,Bean 生命周期
---

# Spring Boot 2.2 + Micrometer 中 JVM 指标为什么会突然消失

## 一、问题是从“给线程池加监控”开始的

当时系统里已经有一套基于：

```text
Spring Boot Actuator
        ↓
Micrometer
        ↓
Prometheus
        ↓
Grafana
```

的监控体系。

JVM 内存、GC、线程等指标都已经正常运行。

后来需要给自定义线程池增加监控，希望把线程池的：

- 活跃线程数
- 队列长度
- 已完成任务数
- 线程池大小

也暴露给 Prometheus。

项目环境是：

- Spring Boot：`2.2.10.RELEASE`
- Micrometer Core：`1.3.14`
- Micrometer Prometheus Registry：`1.3.14`
- Spring Boot Actuator
- 自定义 `AsyncConfigurer`

项目直接声明了：

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

没有显式指定版本。

后来通过 `dependency:tree` 和 `effective-pom` 确认，Micrometer `1.3.14` 来自 Spring Boot `2.2.10.RELEASE` 的依赖管理：

```xml
<micrometer.version>1.3.14</micrometer.version>
```

原本以为，这只是给现有线程池增加几项监控指标，不应该影响 JVM Metrics。

结果上线前验证时发现了一个很奇怪的问题。

## 二、Prometheus 还活着，但 JVM 指标没了

最初看到 Grafana JVM 面板没有数据时，第一反应自然是：

> 是 Prometheus 抓取异常，还是 Grafana Dashboard 出问题了？

先直接绕过 Grafana 和 Prometheus Server，查看应用自己的 Actuator 端点：

```bash
curl http://localhost:8080/actuator/prometheus
```

端点可以正常访问。

说明：

- Actuator 正常
- Prometheus Endpoint 正常
- `PrometheusMeterRegistry` 也确实存在

但继续执行：

```bash
curl http://localhost:8080/actuator/prometheus | grep jvm_
```

没有任何输出。

原本应该存在的：

```text
jvm_memory_used_bytes
jvm_memory_committed_bytes
jvm_gc_memory_allocated_bytes
jvm_threads_live_threads
...
```

全部消失了。

这时问题就变得很反直觉：

> Prometheus 端点没有坏，应用也没有报错，为什么只有 JVM Metrics 消失了？

而且业务功能完全正常。

这意味着，如果没有 Grafana 面板或者专门检查 `/actuator/prometheus`，这个问题甚至可能长期存在而不被发现。

## 三、先回到基线：默认线程池是不是正常

遇到这种问题，继续盯着 Grafana 已经没有意义。

先把变量减少到最少。

恢复到原来的默认线程池配置，不启用自定义 `AsyncConfigurer`，也不增加任何线程池指标。

重新启动应用：

```bash
curl http://localhost:8080/actuator/prometheus | grep jvm_
```

JVM 指标全部恢复。

于是有了第一个明确结论：

> 问题确实和这次自定义线程池监控改造有关。

但这时还不知道具体是哪一部分。

因为这次改造实际上同时做了两件事：

1. 自定义了 `AsyncConfigurer`
2. 在线程池中接入了 Micrometer

到底是哪一个触发的，还需要继续拆。

## 四、缩小变量：只要构造器里有 MeterRegistry，问题就出现

问题实现的核心结构类似：

```java
public class AsyncTaskExecutePool implements AsyncConfigurer {

    private final MeterRegistry meterRegistry;

    public AsyncTaskExecutePool(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // 线程池配置略

        executor.initialize();

        Executors.newSingleThreadScheduledExecutor().schedule(() -> {
            ExecutorServiceMetrics.monitor(
                    meterRegistry,
                    executor.getThreadPoolExecutor(),
                    "xxx-async-poll-executor-wrong"
            );
        }, 1, TimeUnit.SECONDS);

        return executor;
    }
}
```

当时为了避免线程池刚初始化就立即绑定指标，`ExecutorServiceMetrics.monitor(...)` 还特意延迟了 1 秒执行。

从直觉上看，这已经足够“晚”了。

但启动之后：

```bash
curl http://localhost:8080/actuator/prometheus | grep jvm_
```

JVM 指标依然消失。

把 `AsyncConfigurer` 恢复掉，JVM 指标又重新出现。

反复几次之后，这个现象可以稳定复现。

## 五、真正的转折点：monitor 已经延迟 1 秒，为什么还会出问题

这一步是整个排查过程中最关键的转折。

一开始一直把注意力放在：

```java
ExecutorServiceMetrics.monitor(...)
```

上。

因为这是新加的监控代码，最容易怀疑它。

但它已经延迟 1 秒执行了。

如果问题真的是：

> 线程池指标绑定得太早

那么延迟执行以后，至少应该产生某些变化。

但结果没有任何变化。

这意味着：

> 问题很可能在 `ExecutorServiceMetrics.monitor(...)` 真正执行之前就已经发生了。

继续往前看代码，真正更早发生的事情只有一个：

```java
public AsyncTaskExecutePool(MeterRegistry meterRegistry)
```

也就是说：

> 虽然真正“使用” `MeterRegistry` 是 1 秒之后，但 Spring 在创建 `AsyncTaskExecutePool` 时，就已经必须先把 `MeterRegistry` 创建出来了。

这里开始意识到，问题可能不是“线程池监控 API 怎么调用”，而是：

> **构造器依赖改变了 Spring Bean 的初始化顺序。**

## 六、“延迟使用”不等于“延迟创建”

这是这次问题里最容易忽略的一点。

下面两件事完全不同：

```text
1 秒后才调用 meterRegistry
```

和：

```text
Spring 1 秒后才创建 meterRegistry
```

问题代码虽然做到了前者：

```java
schedule(() -> {
    ExecutorServiceMetrics.monitor(...);
}, 1, TimeUnit.SECONDS);
```

但并没有做到后者。

因为 Bean 构造器已经写成：

```java
public AsyncTaskExecutePool(MeterRegistry meterRegistry)
```

为了创建 `AsyncTaskExecutePool`，Spring 必须先解析并创建它的构造器依赖。

依赖关系实际上是：

```text
创建 AsyncTaskExecutePool
        ↓
需要 MeterRegistry
        ↓
提前创建 PrometheusMeterRegistry
        ↓
1 秒后才真正执行 monitor(...)
```

所以：

> 延迟 `monitor()` 只能延迟“使用 Registry”，不能延迟“创建 Registry”。

到这里，排查方向才真正从线程池 API 转向 Spring 生命周期。

## 七、为什么 AsyncConfigurer 会把问题放大

`AsyncConfigurer` 不是普通业务 Bean。

它参与 Spring 异步执行基础设施的配置，会在应用启动过程中较早被处理。

当一个较早参与基础设施初始化的 Bean：

```text
AsyncConfigurer
```

构造器又依赖：

```text
MeterRegistry
```

就形成了：

```text
异步基础设施需要初始化
        ↓
需要创建 AsyncConfigurer
        ↓
AsyncConfigurer 需要 MeterRegistry
        ↓
MeterRegistry 被提前创建
```

这就是所谓的 early initialization。

问题并不是：

> 构造器注入本身有问题。

而是：

> **一个创建时机较早的基础设施 Bean，通过构造器依赖把另一个本不应该这么早创建的 Bean 提前拉进了初始化链路。**

## 八、为什么 MeterRegistry 提前创建后，偏偏丢的是 JVM Metrics

接下来要解释另一个问题：

> 即使 `PrometheusMeterRegistry` 提前创建了，为什么 Prometheus Endpoint 还能工作，却只丢了 JVM 指标？

关键在于：

`PrometheusMeterRegistry` 本身并不会自动产生 JVM 内存、GC、线程等指标。

这些指标来自一组 `MeterBinder`。

可以简单理解为：

```text
JVM MeterBinder
      ↓ bind
MeterRegistry
      ↓
/actuator/prometheus
```

例如 JVM：

- 内存
- GC
- 线程
- Class Loading

这些指标，最终都需要对应 Binder 绑定进 Registry。

所以：

```text
PrometheusMeterRegistry 存在
```

并不等于：

```text
所有应该存在的 MeterBinder 都已经完成绑定
```

这也正好解释了现场现象：

```text
/actuator/prometheus 可以访问
```

但：

```text
jvm_* 全部消失
```

## 九、再回头看 MeterRegistryPostProcessor

Spring Boot 会通过相关后处理逻辑，将容器中的 `MeterBinder` 和 `MeterRegistry` 关联起来。

正常情况下，可以把流程简单理解为：

```text
监控相关 Bean 按正常顺序准备
        ↓
MeterRegistry 创建
        ↓
MeterBinder 按预期参与绑定
        ↓
JVM Metrics 出现在 Registry
```

而问题场景变成了：

```text
AsyncConfigurer 需要 MeterRegistry
        ↓
MeterRegistry 提前创建
        ↓
部分 JVM MeterBinder 尚未按正常生命周期准备完成
        ↓
预期的 JVM Metrics 没有进入当前 Registry
```

这里需要特别避免一个过于简单的说法：

> `MeterRegistryPostProcessor` 只执行一次。

更准确的是：

> `MeterRegistry` 的初始化和后处理发生得过早，改变了原本预期的 Bean 初始化时序，使部分后续才准备完成的 `MeterBinder` 没有按正常路径参与当前 Registry 的绑定。

因此，这个问题最终可以归结为：

> **Bean early initialization 导致 Micrometer 监控组件初始化顺序发生变化。**

## 十、怎么证明这个判断不是猜测

光看生命周期逻辑还不够，最终还是需要用代码验证。

修复后的思路是：

> 不再让 `AsyncConfigurer` 在构造阶段依赖 `MeterRegistry`。

线程池先作为普通 Spring Bean 创建：

```java
@Bean(AsyncExecutionAspectSupport.DEFAULT_TASK_EXECUTOR_BEAN_NAME)
public ThreadPoolTaskExecutor taskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

    // 线程池配置略

    executor.initialize();
    return executor;
}
```

然后把线程池监控从异步基础设施初始化阶段拆出来。

在应用启动完成之后再绑定：

```java
@Bean
public ApplicationListener<ApplicationReadyEvent> metricsBinderTaskExecutor(
        MeterRegistry registry,
        @Qualifier(AsyncExecutionAspectSupport.DEFAULT_TASK_EXECUTOR_BEAN_NAME)
        ThreadPoolTaskExecutor executor) {

    return event -> ExecutorServiceMetrics.monitor(
            registry,
            executor.getThreadPoolExecutor(),
            "xxxx-async-executor"
    );
}
```

重新启动后：

```bash
curl http://localhost:8080/actuator/prometheus | grep jvm_
```

JVM 指标恢复。

同时线程池自己的指标也可以正常注册。

这个结果验证了前面的判断：

> 真正需要拆掉的不是线程池监控，而是 `AsyncConfigurer → MeterRegistry` 这条早期依赖链。

## 十一、为什么这里选择 ApplicationReadyEvent

这里使用 `ApplicationReadyEvent`，不是因为：

> Micrometer 必须等到 ApplicationReadyEvent 之后才能使用。

而是因为本次问题的目标非常明确：

> 避免在线程池异步基础设施初始化阶段引入 `MeterRegistry` 依赖。

所以把线程池指标绑定放到应用 Ready 之后，是一个：

- 简单
- 明确
- 容易验证
- 不参与早期启动链路

的规避方式。

最终结构变成：

```text
Spring 创建 ThreadPoolTaskExecutor
        ↓
应用完成启动
        ↓
ApplicationReadyEvent
        ↓
获取 MeterRegistry
        ↓
ExecutorServiceMetrics.monitor(...)
```

监控逻辑不再反向影响异步基础设施 Bean 的创建。

## 十二、为什么这个问题特别危险

这个问题没有造成业务故障。

也正因为如此，它反而很隐蔽。

### 12.1 应用启动完全正常

不会出现：

```text
Application failed to start
```

也不会因为 JVM Metrics 没有注册而抛异常。

### 12.2 异步线程池正常工作

业务异步任务照常执行。

从功能测试角度，很容易认为本次改动完全正常。

### 12.3 Prometheus Endpoint 也正常

```bash
curl http://localhost:8080/actuator/prometheus
```

仍然有输出。

如果只做：

> 端点是否 200

这样的 Smoke Test，也发现不了问题。

### 12.4 真正损失的是可观测性

可能消失的包括：

- JVM Heap / Non-Heap 内存
- GC
- JVM 线程
- Class Loading
- Buffer
- 其他 JVM Runtime Metrics

最终表现可能是：

- Grafana JVM 面板突然空白
- 告警规则失效
- JVM 内存问题失去观测
- GC 异常无法提前发现
- 线上故障排查缺少关键指标

这是典型的：

> 业务没有坏，但监控已经坏了。

## 十三、这次排查真正留下来的几个经验

### 13.1 不要默认“只是注入一下”没有副作用

在普通业务 Bean 中，构造器注入通常只是一个依赖表达方式。

但对于：

- 基础设施 Bean
- 自动配置 Bean
- 异步配置
- 事务基础设施
- BeanPostProcessor
- 监控基础设施

构造器依赖还会影响：

> Bean 必须在什么时候被创建。

所以：

```java
public Xxx(MeterRegistry meterRegistry)
```

不仅表达“我需要它”，也隐含着：

> “创建我的时候，它必须已经存在。”

### 13.2 延迟使用依赖，不等于延迟创建依赖

这是这次最直接的教训。

即使：

```java
ExecutorServiceMetrics.monitor(...)
```

延迟了 1 秒，

只要：

```java
MeterRegistry
```

已经出现在早期 Bean 的构造器中，它就可能早在那之前已经被 Spring 创建。

### 13.3 Prometheus Endpoint 存在，不代表监控体系完整

这个检查：

```bash
curl http://localhost:8080/actuator/prometheus
```

只能证明：

> Endpoint 可以访问。

不能证明：

> 所有关键指标都已经注册。

对于 JVM Metrics，更实际的检查应该是：

```bash
curl http://localhost:8080/actuator/prometheus | grep jvm_
```

必要时部署后的 Smoke Test 也应该检查：

```text
jvm_memory_*
jvm_gc_*
jvm_threads_*
```

### 13.4 出现监控异常时，先往应用内部收缩

如果：

```text
/actuator/prometheus
```

里已经没有 `jvm_*`，

那么问题还没有到：

```text
Prometheus Server
Grafana
```

这时继续调 Dashboard 或 PromQL 基本没有意义。

排查范围应该先收缩到：

```text
Spring Boot
Micrometer
Bean 生命周期
MeterBinder 注册
```

### 13.5 老版本项目更需要关注生命周期边界

本文问题已经在：

```text
Spring Boot 2.2.10.RELEASE
Micrometer 1.3.14
```

组合中稳定复现。

对于仍然运行这类老版本框架的项目，可以增加约束：

- 避免在 `AsyncConfigurer` 等早期基础设施 Bean 中构造器依赖 `MeterRegistry`
- 线程池监控和异步基础设施配置解耦
- 新增 Micrometer 指标后验证原有 JVM Metrics
- 修改 Actuator / Micrometer 相关配置后检查实际指标内容

这里不需要禁止使用 `AsyncConfigurer` 本身。

真正需要避免的是：

> 为了增加监控，把监控基础设施无意中拉进更早的 Bean 初始化阶段。

## 十四、关于版本升级

Spring Boot `2.2.10.RELEASE` 和 Micrometer `1.3.14` 都已经属于较老版本。

如果项目具备升级条件，应优先考虑升级，并在目标版本重新验证：

- `MeterRegistry` early initialization 行为
- JVM `MeterBinder` 注册行为
- 自定义线程池指标绑定方式

本文不直接给出：

```text
升级到 Spring Boot x.x
或 Micrometer x.x 后一定修复
```

这样的结论。

因为这次问题本身就是一个生命周期细节问题。

对于版本边界，应该以：

- 目标版本实际验证
- 对应官方 Issue
- 源码变化

作为依据，而不是只凭经验推断。

## 十五、附录

### 15.1 示例工程

示例工程代码：

[Spring Boot 2.2.10 + AsyncConfigurer + MeterRegistry 示例](https://cdn.jsdelivr.net/gh/valuetodays/supreme-octo-palm-tree@main/attachment/springboot2.2.10-async-thread-meter-registry.zip)

其中包含：

- 问题实现：`AsyncTaskExecutePool`
- 修复实现：`AsyncConfig`
- `ApplicationReadyEvent` 延迟绑定线程池指标的示例

### 15.2 涉及组件

本次问题主要涉及：

- `AsyncConfigurer`
- `ThreadPoolTaskExecutor`
- `MeterRegistry`
- `PrometheusMeterRegistry`
- `MeterBinder`
- `MeterRegistryPostProcessor`
- `ExecutorServiceMetrics`
- `ApplicationReadyEvent`
- Spring Boot Actuator

### 15.3 已验证环境

```text
Spring Boot: 2.2.10.RELEASE
Micrometer Core: 1.3.14
Micrometer Prometheus Registry: 1.3.14
```

其中 Micrometer `1.3.14` 由 Spring Boot `2.2.10.RELEASE` 的依赖管理提供。

对于其他 Spring Boot / Micrometer 版本，应单独验证，不能直接假定存在完全相同的行为。

### 15.4 最终回看

如果只看最终修复，这个问题很容易被压缩成一句话：

> 不要在 `AsyncConfigurer` 构造器里注入 `MeterRegistry`。

但真正有价值的并不是这条规则本身。

更值得留下的是这条排查路径：

```text
Grafana JVM 面板没数据
        ↓
先检查 /actuator/prometheus
        ↓
Prometheus Endpoint 正常，但 jvm_* 消失
        ↓
恢复默认线程池后 JVM Metrics 恢复
        ↓
锁定自定义 AsyncConfigurer
        ↓
发现 monitor 已经延迟 1 秒，问题仍存在
        ↓
意识到问题发生在 monitor 之前
        ↓
回看构造器依赖
        ↓
MeterRegistry 被早期 Bean 提前创建
        ↓
进一步分析 MeterBinder 绑定时序
        ↓
解除 AsyncConfigurer → MeterRegistry 依赖
        ↓
ApplicationReadyEvent 后再绑定线程池指标
        ↓
JVM Metrics 恢复
```

最终真正理解的是：

> **在 Spring 中，依赖关系不仅决定“谁使用谁”，也决定“谁必须在谁之前被创建”。**

而对于监控、异步、事务这类基础设施组件，这种初始化顺序本身就是系统行为的一部分。
