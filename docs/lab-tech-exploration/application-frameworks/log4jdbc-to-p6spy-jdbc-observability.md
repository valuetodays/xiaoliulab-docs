---
title: "从 log4jdbc 到 p6spy：后来才意识到，我需要的不只是单行 SQL"
description: "一次从 SQL 多行日志出发的 JDBC 日志组件替换复盘：最初只是为了让 SQL 更适合检索，后来重新梳理才发现，p6spy 真正的价值在于执行耗时、connectionId、category、JDBC URL、日志过滤和 MessageFormattingStrategy 所组成的轻量级 JDBC 可观测能力。"
keywords:
  - log4jdbc
  - p6spy
  - SQL 日志
  - MessageFormattingStrategy
  - 慢 SQL
  - JDBC
  - 可观测性
---

# 从 log4jdbc 到 p6spy：后来才意识到，我需要的不只是单行 SQL

## 背景：最开始只是觉得多行 SQL 不好查

一个旧项目原来使用 `log4jdbc-log4j2` 记录 SQL：

```xml
<log4jdbc.version>1.16</log4jdbc.version>

<dependency>
    <groupId>org.bgee.log4jdbc-log4j2</groupId>
    <artifactId>log4jdbc-log4j2-jdbc4.1</artifactId>
    <version>${log4jdbc.version}</version>
</dependency>
```

实际日志类似：

```text
2026-08-28 00:21:17.909 [http-nio-8004-exec-36] [aa8f5d1eae924d6bb9bd0522931db83e] INFO  jdbc.sqlonly.sqlOccurred:228 - insert into sys_touch_log (id, log_type, token_info, user_name, user_id, source_info, ext_info,
client_ip, dest_URL, `status`, utc_create, remark ) values ('20260828002117fdf6152a-7618-435f-9541-bf07d29e7701',
'TOUCH', 'N', 'test888@example.com', '0', '94081291', NULL, NULL, 'TestController.test',
'VALID', 1787871177, 'normal' )
```

SQL 本身没有问题，但一条 SQL 被拆成多行后，日常查询日志会变得很不舒服。

例如使用 `grep`、Loki 或 Grafana 按关键字、traceId、表名查询时，我更希望：

```text
一条 SQL = 一条完整日志
```

而不是命中其中一行以后，再向前后拼接上下文。

我以前的项目更多使用 p6spy，所以当时看到这个问题后，第一反应就是把 log4jdbc 换成 p6spy：

```xml
<p6spy.version>3.9.1</p6spy.version>

<dependency>
    <groupId>p6spy</groupId>
    <artifactId>p6spy</artifactId>
    <version>${p6spy.version}</version>
</dependency>
```

当时的想法很简单：

> p6spy 输出单行 SQL，更适合日志检索。

但几年后重新整理这份笔记时，我发现这个理由其实并不充分。

## 事后才发现：log4jdbc 本身就可以关闭自动换行

重新查看 log4jdbc 的实现后发现，它确实会主动对 SQL 插入换行。

相关逻辑大致是：

```java
if (Properties.getDumpSqlMaxLineLength() <= 0) {
    output.append(sql);
} else {
    // insert line breaks into sql to make it more readable
    ...
}
```

对应配置：

```properties
log4jdbc.dump.sql.maxlinelength=0
```

将其设置为 `0` 后，就可以关闭这种为了“可读性”而进行的自动折行。

也就是说，如果当时唯一的问题只是：

> SQL 被 log4jdbc 打成了多行。

那么更小的改动其实应该是先调整 log4jdbc 配置，而不是直接替换整个组件。

这也是这次复盘里首先需要承认的一点：

> 当时对 log4jdbc 不够熟悉，也没有先完整检查它的配置能力，替换前的调研并不充分。

但继续往下整理后，我又发现，最终留下 p6spy 并不只是因为“单行 SQL”。

## 组件版本也是一个长期维护因素

重新做事前评估时，还有一个不能忽略的背景：项目里使用的 `log4jdbc-log4j2 1.16` 已经非常老。

Maven Central 中，这个版本发布于 2013 年；而当前使用的 `p6spy 3.9.1` 发布于 2020 年。两者现在都谈不上高频更新，但 p6spy 这一代版本明显更新一些。

因此，不能把这次替换简单包装成：

```text
旧组件 → 仍在活跃维护的新组件
```

因为 p6spy 3.9.1 本身也已经多年没有发布新版本。

但如果站在当时的事前调研角度，组件年代仍然可以作为一个长期维护因素：

```text
log4jdbc-log4j2 1.16：2013 年
p6spy 3.9.1：2020 年
```

在功能都能满足基本 SQL 打印需求的情况下，我会更倾向于选择自己更熟悉、版本代际也更新一些，并且具有可编程扩展入口的 p6spy。

所以，“log4jdbc 偏旧”不是这次替换的决定性理由，也不是当时真实的直接触发点；但在今天重新做完整的事前评估时，它可以作为维护性判断中的一个加分项。

## 后来才意识到：我用的其实不只是 SQL 打印

重新回看这些年的实际使用方式，p6spy 对我的价值早就不只是：

```text
把 SQL 打印出来
```

而是逐渐变成了一个很轻量的 JDBC 可观测入口。

我实际使用过的信息包括：

```text
实际 SQL
执行耗时 elapsed
connectionId
category
JDBC URL
SQL 过滤
自定义 MessageFormattingStrategy
```

这些信息组合起来，已经和普通的 `show-sql` 有明显区别。

## 通过 elapsed 直接记录 SQL 执行耗时

p6spy 的 `MessageFormattingStrategy` 可以在格式化日志时拿到 SQL 执行耗时：

```java
String formatMessage(
        int connectionId,
        String now,
        long elapsed,
        String category,
        String prepared,
        String sql,
        String url
);
```

其中：

```java
long elapsed
```

表示本次 JDBC 操作的执行耗时。

这意味着 SQL 日志不只是：

```text
执行了什么 SQL
```

还可以直接回答：

```text
这条 SQL 执行了多久
```

例如可以在自定义格式化策略中按照耗时做不同处理：

```java
if (elapsed >= slowSqlThreshold) {
    // 记录慢 SQL
}
```

这比事后再从数据库慢查询日志、APM 或业务日志里寻找对应关系更直接。

需要说明的是，log4jdbc 本身也有 SQL timing 相关能力，因此“能够看到 SQL 耗时”并不是 p6spy 独有的能力。

这里真正吸引我的，是 p6spy 把 `elapsed` 直接暴露给 `MessageFormattingStrategy`，可以和 SQL、连接信息、category 等数据一起进行程序化处理。

## connectionId：把同一连接上的操作串起来

`connectionId` 也是我实际使用过的信息。

平时只看一条查询时，它可能没有那么显眼；但涉及事务时，它就很有价值。

例如：

```text
connection=18 | statement | update ...
connection=18 | statement | insert ...
connection=18 | rollback
```

至少可以快速看出这些 JDBC 操作发生在同一个连接上下文中。

它不能替代完整的分布式追踪或事务诊断，但在排查普通业务系统里的数据库问题时，是一个成本很低的辅助信息。

## category：我关心的不只是 SELECT、UPDATE

p6spy 还会给 JDBC 操作提供 category。

常见的记录并不只有 `statement`，还可能包括：

```text
statement
batch
commit
rollback
```

我实际使用过这个字段。

这使得 SQL 日志不只是“数据库执行了什么语句”，还可以看到一部分 JDBC 行为。

例如排查事务问题时：

```text
commit
rollback
```

本身就可能比某条 SQL 更值得注意。

## 多数据源时，JDBC URL 很有价值

单数据源系统里：

```sql
select * from t_order where id = 1
```

通常已经足够理解它查的是哪个数据库。

但多数据源系统里，同样一条 SQL 可能发往不同的数据库实例。

p6spy 的格式化入口同时提供：

```java
String url
```

因此可以从 JDBC URL 中提取：

```text
数据库地址
端口
库名
```

再和 SQL 一起记录。

最终日志可以表达成类似：

```text
23ms | connection=18 | db=10.0.1.12:3306/order | statement | select ...
```

这样排查问题时，不只是知道：

> 执行了哪条 SQL。

还知道：

> 这条 SQL 到底打到了哪个数据库。

在多数据源项目里，这个信息非常有用。

## 只保留真正有用的 SQL 内容

p6spy 可以同时拿到两种 SQL：

```text
带 ? 的 prepared SQL
参数已经替换后的实际 SQL
```

如果两份都打印，日志会明显变长。

对于我的排障习惯，大多数时候真正需要的是已经带实际参数的 SQL：

```sql
select * from user where id = 123
```

而不是再重复打印：

```sql
select * from user where id = ?
```

因此可以通过自定义 `MessageFormattingStrategy` 控制最终输出，只留下实际排查需要的信息。

这也是我后来认为 p6spy 比“默认 SQL logger”更有价值的一点：

> 日志内容可以按照项目实际需求重新设计，而不是完全接受组件默认格式。

## 过滤没有排查价值的 SQL

实际项目里并不是所有 SQL 都值得长期保留。

例如连接池或健康检查产生的：

```sql
select 1
```

频率可能很高，但绝大多数时候没有排查价值。

我实际使用过 p6spy 的过滤能力，把这类 SQL 从日志中排除。

因此最终的 SQL 日志不是简单的：

```text
所有 JDBC 调用全部原样输出
```

而是：

```text
保留业务 SQL
过滤已知噪声
尽量让每条日志都有排查价值
```

这对于生产环境长期保留 SQL 日志尤其重要。

## 一个以前没用过，但后来发现很有价值的能力：定位 SQL 来源

这次重新查看 p6spy 配置时，还发现一个以前没有实际使用过、但很有价值的能力：SQL 调用栈。

p6spy 可以为 SQL 日志输出 stack trace，并通过相关配置限制需要关注的调用范围。

它解决的是另一类常见问题：

```text
我知道这条 SQL 很慢
↓
我也知道它执行了什么
↓
但我不知道是哪段 Java 代码发出来的
```

对于动态 SQL、公共 Mapper、框架自动查询或者历史代码，这个能力很适合临时定位 SQL 来源。

我以前没有使用它，但以后遇到“这条 SQL 到底是谁发出来的”这类问题时，会优先考虑这种方式，而不是先人工沿着代码猜调用链。

## 为什么我在生产环境仍然打印 SQL

经常能看到一种建议：

> 生产环境不要打印 SQL。

这个建议有合理的背景。

高并发系统中，全量 SQL 日志可能带来：

```text
大量日志 IO
更高的日志采集和存储成本
大量噪声
敏感数据泄露风险
```

但我实际维护的项目并不是高并发系统，因此这部分日志量一直处于可接受范围。

相比节省这些日志，我更看重线上排障效率。

如果生产环境完全不记录实际 SQL，发生问题以后，经常需要：

```text
找到接口
↓
定位 Service
↓
找到 Mapper
↓
分析动态条件
↓
还原运行参数
↓
手工拼出实际 SQL
```

复杂一点的 SQL，几分钟才能还原出来并不罕见。

因此在我当前维护的这类业务系统里，SQL 日志不是开发阶段遗留下来的调试信息，而是一部分正式的线上可观测数据。

我的取舍是：

> 生产环境可以打印 SQL，但不应该无控制地打印 SQL。

例如：

```text
过滤 select 1 等噪声
SQL 尽量保持单行
只保留真正有用的字段
记录执行耗时
多数据源时标识目标数据库
关注敏感数据是否需要脱敏
```

如果未来面对的是高并发、大 SQL 量系统，则应该重新评估这个策略，可以考虑只记录慢 SQL、采样、按需开启或交给专门的 APM / 数据库观测系统处理。

## 重新看这次替换：单行 SQL 只是一个小问题

如果只看最初的修改记录，这次改造似乎只是：

```text
log4jdbc SQL 多行
↓
换成 p6spy
↓
SQL 变成单行
```

重新复盘以后，结论已经完全不同。

首先，当初的事前调研确实不充分：

> log4jdbc 本身支持通过 `log4jdbc.dump.sql.maxlinelength=0` 关闭自动换行，如果唯一诉求只是单行 SQL，没有必要为了这一点替换组件。

但另一方面，这些年真正让我持续使用 p6spy 的，也早就不是“单行”这一项能力。

真正留下来的价值是：

```text
实际 SQL
+
elapsed
+
connectionId
+
category
+
JDBC URL
+
过滤规则
+
MessageFormattingStrategy
```

它们共同组成了一个很轻量、但对普通业务系统非常实用的 JDBC 可观测层。

所以如果今天重新做一次事前评估，我不会再给出：

> 因为 log4jdbc 会换行，所以换 p6spy。

这样的理由。

更准确的结论应该是：

> 单行 SQL 只是触发重新评估的一个小问题。真正让我更愿意使用 p6spy 的，是它提供了一个可编程的 JDBC 日志入口，可以把 SQL 内容、执行耗时、连接上下文、数据库位置和过滤规则组合成适合线上排障的日志。

## 最后的维护原则

这次重新整理旧笔记还有一个意外收获：

> 一个已经解决的问题，不代表当年的决策过程就是完整的。

当时从 log4jdbc 换到 p6spy，确实解决了 SQL 日志难查询的问题；但如果只以“单行 SQL”作为替换理由，事前工作并没有做完整。

几年后再回头看，反而是在继续追问：

```text
原组件真的做不到吗？
当时还有没有更小的修改？
这些年为什么一直没有换回去？
真正持续产生价值的到底是什么？
```

最后才发现：

> 我原来需要的并不只是 SQL 打印，而是一层足够轻量、能够长期留在生产环境里的 JDBC 可观测能力。

这才是这次从 log4jdbc 切换到 p6spy 后，真正值得留下来的经验。

## 参考资料

- p6spy `spy.properties`：https://github.com/p6spy/p6spy/blob/master/src/main/assembly/individualFiles/spy.properties
- p6spy Configuration and Usage：https://p6spy.readthedocs.io/en/latest/configandusage.html
- log4jdbc `Slf4jSpyLogDelegator`：https://github.com/etheriau/log4jdbc-log4j2/blob/master/log4jdbc-log4j2-jdbc4.1/src/main/java/net/sf/log4jdbc/log/slf4j/Slf4jSpyLogDelegator.java
- log4jdbc 配置说明：https://github.com/arthurblake/log4jdbc
