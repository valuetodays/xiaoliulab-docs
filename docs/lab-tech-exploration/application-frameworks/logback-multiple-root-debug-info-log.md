---
title: "Logback 的 debug.log 和 info.log 为什么几乎一样：一次旧项目多 root 配置排查"
description: "记录一次 Spring Boot 2.2.10.RELEASE 旧项目的 Logback 配置排查。debug.log 与 info.log 内容几乎一致，进一步发现配置文件存在多个 root，并结合 ThresholdFilter 的实际语义解释为什么日志会出现这种结果，最终将配置收敛为单一 root。"
date: 2026-08-28
head:
  - - meta
    - name: keywords
      content: Spring Boot 2.2.10,Logback,logback.xml,root logger,ThresholdFilter,debug.log,info.log,旧项目维护,日志配置
---

# Logback 的 debug.log 和 info.log 为什么几乎一样：一次旧项目多 root 配置排查

## 一、问题背景：两个日志文件为什么几乎完全一样

维护一个旧项目时，偶然注意到一个比较奇怪的现象：

```text
debug.log
```

和：

```text
info.log
```

里面的内容几乎完全一致。

这个项目使用：

```text
Spring Boot 2.2.10.RELEASE
```

如果没有在项目中额外覆盖 Logback 版本，Spring Boot 2.2.10.RELEASE 管理的 Logback 版本为：

```text
logback-classic 1.2.3
logback-core    1.2.3
```

单从文件名理解，很容易认为：

```text
debug.log
→ 主要记录 DEBUG 日志

info.log
→ 主要记录 INFO 日志
```

但实际日志显然不是这种效果。

于是开始回头检查这个已经使用多年的 `logback.xml`。

## 二、先看旧项目的 logback.xml

原配置经过脱敏后如下：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration scan="false" scanPeriod="30 seconds" debug="false">
    <contextName>app-xxx</contextName>

    <property name="log.path" value="/var/log/app-xxx/log"/>
    <property name="log.charset" value="utf-8"/>
    <property name="log.pattern"
              value="%contextName %red(%d{yyyy-MM-dd HH:mm:ss}) [%X{traceId}/%X{spanId}] %green([%thread]) %highlight(%-5level) %boldMagenta(%logger{36}) - %msg%n"/>

    <appender name="info" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${log.path}/info.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${log.path}/%d{yyyy-MM, aux}/info.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>90</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>%date [%thread] %-5level [%X{traceId}/%X{spanId}] [%logger{50}] %file:%line - %msg%n</pattern>
            <charset>${log.charset}</charset>
        </encoder>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>INFO</level>
        </filter>
    </appender>

    <appender name="debug" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${log.path}/debug.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${log.path}/%d{yyyy-MM, aux}/debug.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>90</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>%date [%thread] %-5level [%X{traceId}/%X{spanId}] [%logger{50}] %file:%line - %msg%n</pattern>
            <charset>${log.charset}</charset>
        </encoder>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>DEBUG</level>
        </filter>
    </appender>

    <appender name="error" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${log.path}/error.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${log.path}/%d{yyyy-MM, aux}/error.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>90</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>%date [%thread] %-5level [%X{traceId}/%X{spanId}] [%logger{50}] %file:%line - %msg%n</pattern>
            <charset>${log.charset}</charset>
        </encoder>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>ERROR</level>
        </filter>
    </appender>

    <root level="INFO">
        <appender-ref ref="info"/>
    </root>

    <root level="ERROR">
        <appender-ref ref="error"/>
    </root>

    <root level="DEBUG">
        <appender-ref ref="debug"/>
    </root>

    <appender name="console" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>${log.pattern}</pattern>
            <charset>${log.charset}</charset>
        </encoder>
    </appender>

    <root level="info">
        <appender-ref ref="console"/>
    </root>
</configuration>
```

第一眼最明显的问题就是：

> 一个配置文件里出现了多个 `<root>`。

这里分别定义了：

```xml
<root level="INFO">...</root>
<root level="ERROR">...</root>
<root level="DEBUG">...</root>
<root level="info">...</root>
```

而 Logback 官方配置语法描述的是：

```text
一个 configuration 中最多只有一个 root 元素
```

所以这份配置从结构上就已经不是正常推荐的写法。

## 三、先通过代码复现日志级别

为了避免只根据历史日志猜测，新建一个和启动类同包的测试组件：

```java
package com.app.xxx;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class LoggerTest implements CommandLineRunner {

    @Override
    public void run(String... args) {
        log.debug("debug11111111111111111111");
        log.info("info111111111111111111111");
        log.warn("warn1111111111111111111111");
        log.error("error1111111111111111111111111111111");
    }
}
```

启动服务后检查：

```text
debug.log
info.log
```

发现两个文件里都有：

```text
info111111111111111111111
warn1111111111111111111111
error1111111111111111111111111111111
```

但都没有：

```text
debug11111111111111111111
```

这个结果至少说明两件事：

1. 当前最终生效的 root 日志级别不是 DEBUG
2. `debugAppender` 并不是“只收 DEBUG 日志”

第二点其实很容易被文件名误导。

## 四、第一个关键点：`ThresholdFilter DEBUG` 并不是“只记录 DEBUG”

旧配置中的 debug appender 使用：

```xml
<filter class="ch.qos.logback.classic.filter.ThresholdFilter">
    <level>DEBUG</level>
</filter>
```

看到这段时，很容易把它理解成：

> 只把 DEBUG 日志写进 debug.log。

实际上 `ThresholdFilter` 的含义是：

> 拒绝低于指定级别的日志，指定级别以及更高级别继续通过。

因此：

```text
ThresholdFilter = DEBUG
```

允许的是：

```text
DEBUG
INFO
WARN
ERROR
```

而：

```text
ThresholdFilter = INFO
```

允许的是：

```text
INFO
WARN
ERROR
```

所以如果 root 的有效级别最终是 INFO：

```text
DEBUG
→ 在 logger 层就被挡掉

INFO / WARN / ERROR
→ 同时进入 infoAppender 和 debugAppender
```

于是就会出现最初看到的现象：

```text
debug.log
和
info.log
内容几乎完全一致
```

这不仅仅是多个 root 导致的。

`ThresholdFilter` 的实际语义也是理解这个现象的关键。

## 五、第二个关键点：多个 root 实际发生了什么

排查时曾经问过 AI，得到过两种说法：

```text
只使用最后一个 root
```

以及：

```text
多个 root 的 appender 会合并
```

仅凭这些回答无法确定，所以继续通过运行结果验证。

当前配置最后一个 root 是：

```xml
<root level="info">
    <appender-ref ref="console"/>
</root>
```

运行结果表现为：

```text
DEBUG 没有输出
INFO / WARN / ERROR 可以输出
```

这和最终有效 root level 为 INFO 是一致的。

与此同时，前面几个 root 引用的：

```text
info
error
debug
```

appender 并没有消失。

结合 Logback 的配置方式，可以更准确地理解当前 Logback 1.2.3 下观察到的行为：

```text
每次处理 root 元素
→ 都是在配置同一个 ROOT Logger

后面的 level
→ 会再次设置 ROOT Logger 的 level

前面已经添加的 appender-ref
→ 不会因为后续 root 配置自动被清空
```

因此这份异常配置最终表现得近似于：

```xml
<root level="INFO">
    <appender-ref ref="info"/>
    <appender-ref ref="error"/>
    <appender-ref ref="debug"/>
    <appender-ref ref="console"/>
</root>
```

需要强调的是：

> 这是对当前 Spring Boot 2.2.10.RELEASE / Logback 1.2.3 环境下实际行为的解释，不应该把“可以写多个 root”当成 Logback 的合法配置方式。

官方配置结构本身就要求：

> `<root>` 最多一个。

正确解决方式不是研究怎样排列多个 root，而是把它们收敛成一个 root。

## 六、调整 root 顺序，再做一次反向验证

为了确认 root level 与日志结果之间的关系，又把：

```xml
<root level="DEBUG">
    <appender-ref ref="debug"/>
</root>
```

移动到了最后：

```xml
<root level="ERROR">
    <appender-ref ref="error"/>
</root>

<root level="INFO">
    <appender-ref ref="info"/>
</root>

<root level="info">
    <appender-ref ref="console"/>
</root>

<root level="DEBUG">
    <appender-ref ref="debug"/>
</root>
```

再次启动服务。

这次：

```text
debug11111111111111111111
```

出现在：

```text
debug.log
```

中。

同时 `debug.log` 中的日志数量明显增加，而 `info.log` 仍然没有 DEBUG 日志。

这个结果正好符合两个规则：

```text
最终 root level = DEBUG
→ DEBUG 事件可以被创建并继续传递
```

以及：

```text
debugAppender ThresholdFilter = DEBUG
→ DEBUG / INFO / WARN / ERROR 都可以进入 debug.log

infoAppender ThresholdFilter = INFO
→ DEBUG 被拒绝，只接收 INFO / WARN / ERROR
```

所以这次反向调整进一步确认：

> 真正需要同时理解 root level 和 appender filter，两层过滤共同决定最终文件里有什么日志。

## 七、root level 和 ThresholdFilter 是两道不同的门

这次排查后，可以把整个日志判断过程简单理解成两层。

第一层是 Logger：

```text
root level
```

决定一条日志事件有没有机会继续往后走。

例如：

```text
root level = INFO
```

那么：

```java
log.debug(...)
```

在 Logger 这一层就不会继续进入 appender。

第二层才是 appender 自己的 filter：

```text
ThresholdFilter
```

决定已经到达这个 appender 的事件是否应该写入。

例如：

```text
root level = DEBUG
```

时，DEBUG、INFO、WARN、ERROR 都可能继续到 appender。

此时：

```text
infoAppender ThresholdFilter = INFO
```

会拒绝 DEBUG。

而：

```text
debugAppender ThresholdFilter = DEBUG
```

会接受 DEBUG 以及更高级别。

可以简化成：

```text
日志调用
↓
Logger level
↓
Appender
↓
Appender Filter
↓
最终输出
```

这也是为什么只盯着：

```xml
<level>DEBUG</level>
```

很容易误判最终日志行为。

## 八、当前服务其实不需要 debug.log

把配置行为弄清楚之后，还需要回到实际需求。

当前生产服务并没有长期保存 DEBUG 日志的需求。

真正需要的是：

```text
info.log
→ INFO / WARN / ERROR

error.log
→ ERROR

console
→ INFO / WARN / ERROR
```

这样的话：

```text
debug.log
```

本身就没有继续保留的必要。

与其修复一套实际上不需要的 debug 日志配置，不如直接删除它。

## 九、最终收敛成一个 root

这次修改最终遵循一个明确的配置规范：

> **一个 Logback 配置文件只定义一个 `root`；日志级别由 `root` 统一控制，文件输出范围由各 appender 的 Filter 明确限定。**

当前服务并不需要长期保存 DEBUG 日志，因此最终只保留：

```text
info.log
→ INFO / WARN / ERROR

error.log
→ ERROR

console
→ INFO / WARN / ERROR
```

修正后的配置如下：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration scan="false" scanPeriod="30 seconds" debug="false">
    <contextName>app-xxx</contextName>

    <property name="log.path" value="/var/log/app-xxx/log"/>
    <property name="log.charset" value="utf-8"/>
    <property name="console.log.pattern"
              value="%contextName %red(%d{yyyy-MM-dd HH:mm:ss}) [%X{traceId}/%X{spanId}] %green([%thread]) %highlight(%-5level) %boldMagenta(%logger{36}) - %msg%n"/>

    <appender name="infoAppender" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${log.path}/info.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${log.path}/%d{yyyy-MM, aux}/info.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>90</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>%date [%thread] %-5level [%X{traceId}/%X{spanId}] [%logger{50}] - %msg%n</pattern>
            <charset>${log.charset}</charset>
        </encoder>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>INFO</level>
        </filter>
    </appender>

    <appender name="errorAppender" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>${log.path}/error.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>${log.path}/%d{yyyy-MM, aux}/error.%d{yyyy-MM-dd}.%i.log</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>90</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>%date [%thread] %-5level [%X{traceId}/%X{spanId}] [%logger{50}] - %msg%n</pattern>
            <charset>${log.charset}</charset>
        </encoder>
        <filter class="ch.qos.logback.classic.filter.ThresholdFilter">
            <level>ERROR</level>
        </filter>
    </appender>

    <appender name="consoleAppender" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>${console.log.pattern}</pattern>
            <charset>${log.charset}</charset>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="infoAppender"/>
        <appender-ref ref="errorAppender"/>
        <appender-ref ref="consoleAppender"/>
    </root>
</configuration>
```

这里最终只保留了一个：

```xml
<root level="INFO">
```

所有需要的 appender 都明确挂在这个 root 上。

结构上比原来的多个 root 更容易理解，也符合 Logback 正常的配置模型。

## 十、修正后的日志行为

最终配置的行为是：

| 日志级别 | `info.log` | `error.log` | Console |
| --- | --- | --- | --- |
| DEBUG | 否 | 否 | 否 |
| INFO | 是 | 否 | 是 |
| WARN | 是 | 否 | 是 |
| ERROR | 是 | 是 | 是 |

这里还有一个容易误解的地方：

```text
ERROR 同时出现在 info.log 和 error.log
```

是正常的。

因为 `infoAppender` 使用：

```xml
<ThresholdFilter>
    <level>INFO</level>
</ThresholdFilter>
```

它表示：

```text
INFO 以及更高级别
```

所以 ERROR 仍然会进入 `info.log`。

而 `errorAppender` 的阈值是 ERROR，因此只会接收 ERROR。

如果业务需求是：

```text
info.log 只能出现 INFO
```

那就不能继续使用 `ThresholdFilter INFO`，而需要改成精确匹配日志级别的过滤方式。

但当前服务想要的是：

```text
info.log = INFO / WARN / ERROR
```

所以现有配置符合需求。

## 十一、这次旧项目维护真正发现了什么

最初只是偶然看到：

> `debug.log` 和 `info.log` 怎么完全一样？

继续往下排查，却发现问题至少包含两层。

第一层是配置结构本身：

```text
一个 logback.xml
出现了多个 root
```

这是不应该长期保留的异常配置。

第二层是对 `ThresholdFilter` 的理解：

```text
ThresholdFilter DEBUG
```

并不是：

```text
只记录 DEBUG
```

而是：

```text
记录 DEBUG 以及更高等级
```

这两件事叠加在一起，最终制造出了一个非常迷惑的现象：

```text
debug.log
看起来几乎就是 info.log 的复制品
```

如果只把问题归结为“多个 root”，实际上还少了一半解释。

## 十二、最终回看：旧配置能运行，不代表配置就是正确的

这也是维护旧项目时很典型的一类问题。

这个 `logback.xml` 并没有让服务启动失败。

日志也一直在正常产生。

从“服务能不能跑”的角度看，它甚至可以多年不被发现。

但从维护角度看，它存在明显问题：

```text
多个 root
↓
结构本身不规范

debugAppender
↓
名字很容易让人误解实际过滤行为

debug.log 和 info.log
↓
长期产生大量重复日志

真正的日志需求
↓
其实根本不需要 debug.log
```

最后的解决办法并不复杂：

```text
确认真实日志需求
↓
只保留一个 root
↓
明确挂载需要的 appender
↓
理解每个 ThresholdFilter 的真实语义
↓
删除没有必要的 debug.log
```

旧项目维护中经常会遇到这种配置：

> 它能运行，不代表它容易理解；它一直没报错，也不代表它值得继续保留。

这次修改最终做的事情，就是让日志配置重新回到：

> **结构唯一、行为明确、配置与实际需求一致。**

## 参考资料

- [Logback 官方文档：Configuration](https://logback.qos.ch/manual/configuration.html)
- [Logback 官方文档：Filters / ThresholdFilter](https://logback.qos.ch/manual/filters.html#thresholdFilter)
- [Spring Boot 2.2.10.RELEASE Dependency Versions](https://docs.spring.io/spring-boot/docs/2.2.10.RELEASE/reference/html/appendix-dependency-versions.html)
