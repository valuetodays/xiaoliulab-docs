---
title: "一次 User-Agent 解析引发的内存与登录性能问题：从 YAUAA 缓存怀疑到删除无用功能"
description: "记录一次旧项目中 Heap 长时间维持高位和登录接口额外耗时约 1 秒的排查过程。通过 Grafana、heap dump、Eclipse MAT、Arthas 和复现实验，定位到从 eladmin 继承的 YAUAA User-Agent 解析逻辑，并确认真正的大头不是 10000 条 parse cache，而是 Analyzer 自身的数据结构初始化和内存占用。"
head:
  - - meta
    - name: keywords
      content: Java,Spring Boot,YAUAA,User-Agent,Heap,Eclipse MAT,Arthas,HashMap,登录性能,eladmin,旧项目维护
---

# 一次 User-Agent 解析引发的内存与登录性能问题：从 YAUAA 缓存怀疑到删除无用功能

## 一、问题背景：Heap 下不去，登录接口也偏慢

维护一个旧项目时，在 Grafana 上注意到：

> Heap 使用量上升后，很长时间都没有明显下降。

服务没有立即 OOM，但内存曲线已经值得继续确认。

当时对 JVM 生成了 heap dump，并使用 Eclipse MAT 查看，发现内存中存在大量 `HashMap` 相关对象，而且从对象信息中能够看到与 User-Agent 解析相关的类名。

因此，排查方向逐步收敛到项目中的浏览器 User-Agent 解析逻辑。

这个系统还有一个特殊背景：

```text
Java 服务部署在杭州
MySQL 部署在伦敦
```

登录流程本身需要访问数据库，所以接口偏慢时，很容易首先怀疑：

> 是不是杭州到伦敦的跨地域数据库访问导致的？

当时使用 Arthas 对登录调用链做过耗时分析，最终定位到 User-Agent 解析这一段本身就额外消耗了大约：

```text
1 秒
```

也就是说，这段 UA 解析逻辑同时出现在：

```text
内存排查
```

和：

```text
登录性能排查
```

两条问题链路中。

## 二、这段 UA 解析代码从哪里来的

当前项目最初基于开源项目 eladmin 搭建。

eladmin 原本有“在线用户”功能，会展示当前用户的一些客户端信息，例如：

```text
IP
登录位置
浏览器
操作系统
```

为了识别浏览器信息，项目中保留了 User-Agent 解析逻辑，并引入了 YAUAA：

```xml
<!-- 解析客户端操作系统、浏览器信息 -->
<dependency>
    <groupId>nl.basjes.parse.useragent</groupId>
    <artifactId>yauaa</artifactId>
    <version>5.23</version>
</dependency>
```

对应代码：

```java
public static String getBrowser(String ua) {
    UserAgentAnalyzer userAgentAnalyzer = UserAgentAnalyzer
            .newBuilder()
            .hideMatcherLoadStats()
            .withCache(10000)
            .withField(UserAgent.AGENT_NAME_VERSION)
            .build();

    UserAgent.ImmutableUserAgent userAgent = userAgentAnalyzer.parse(ua);

    return userAgent.get(UserAgent.AGENT_NAME_VERSION).getValue();
}
```

当前业务系统实际上并没有继续使用原项目“在线用户”页面中的浏览器展示能力。

也就是说：

> 这段浏览器解析逻辑来自历史脚手架功能，而不是当前业务真正需要的能力。

但它仍然存在于登录链路中。

## 三、第一怀疑：是不是 `withCache(10000)` 太大

看到代码后，最显眼的是：

```java
.withCache(10000)
```

再结合 MAT 中大量 `HashMap`，第一个怀疑很自然：

> 会不会是 YAUAA 的解析缓存太大，导致 Heap 长时间维持高位？

继续跟踪源码，可以看到 YAUAA 内部确实存在 parse cache。

核心逻辑类似：

```java
public synchronized ImmutableUserAgent parse(MutableUserAgent userAgent) {
    if (userAgent == null) {
        return null;
    }

    if (parseCache == null) {
        userAgent.reset();
        return super.parse(userAgent);
    }

    String userAgentString = userAgent.getUserAgentString();
    ImmutableUserAgent cachedValue = parseCache.get(userAgentString);

    if (cachedValue != null) {
        return cachedValue;
    } else {
        cachedValue = super.parse(userAgent);
        parseCache.put(userAgentString, cachedValue);
    }

    return cachedValue;
}
```

缓存初始化逻辑：

```java
public static final int DEFAULT_PARSE_CACHE_SIZE = 10000;

protected int cacheSize = DEFAULT_PARSE_CACHE_SIZE;

private synchronized void initializeCache() {
    if (cacheSize >= 1) {
        parseCache = new LRUMap<>(cacheSize);
    } else {
        parseCache = null;
    }
}
```

从这里看，`cacheSize = 10000` 的确值得验证。

## 四、对照实验：把缓存从 10000 改成 0

为了验证问题是不是主要来自 parse cache，把：

```java
.withCache(10000)
```

改成：

```java
.withCache(0)
```

如果最初假设成立，理论上应该看到：

```text
关闭 parse cache
↓
Heap 占用明显下降
```

但当时实际观察到：

> 问题依旧。

这一步很重要，因为它否定了最直观的解释：

> “Heap 高就是因为 10000 条 parse cache。”

后面的复现实验也进一步证明：

> `parseCache` 确实会占一部分内存，但它不是主要内存来源。

## 五、登录慢的真正耗时点：Arthas 定位到 UA 解析

由于 Java 在杭州、MySQL 在伦敦，登录偏慢时，最容易把所有延迟都归因于跨地域数据库访问。

但 Arthas 对登录调用链的耗时分析显示：

```text
登录接口
↓
登录业务处理
↓
User-Agent 解析
↓
UserAgentAnalyzer
↓
parse
```

其中 UA 解析这一段本身就额外消耗了大约：

```text
1 秒
```

这一步很关键，因为它把：

```text
“登录慢可能主要是跨洲数据库导致的”
```

进一步收敛成：

```text
“登录链路里还存在一段与数据库无关、而且可以直接消除的秒级开销”
```

也正是从这里开始，User-Agent 解析从一个普通的历史工具方法，变成了明确需要处理的性能问题。

## 六、重新看代码：每次登录都重新创建 Analyzer

排除“只是 parse cache 太大”之后，再回头看原始代码：

```java
public static String getBrowser(String ua) {
    UserAgentAnalyzer userAgentAnalyzer = UserAgentAnalyzer
            .newBuilder()
            .hideMatcherLoadStats()
            .withCache(10000)
            .withField(UserAgent.AGENT_NAME_VERSION)
            .build();

    UserAgent.ImmutableUserAgent userAgent = userAgentAnalyzer.parse(ua);

    return userAgent.get(UserAgent.AGENT_NAME_VERSION).getValue();
}
```

这时真正值得警惕的是：

> 每调用一次 `getBrowser()`，都会重新创建一个新的 `UserAgentAnalyzer`。

而这个方法又处于登录流程中。

调用关系大致是：

```text
用户登录
↓
读取 User-Agent
↓
getBrowser(ua)
↓
newBuilder()
↓
build UserAgentAnalyzer
↓
parse
↓
返回浏览器名称
```

如果 Analyzer 的初始化和第一次解析本身很重，那么：

> 每一次登录都会重复支付这笔初始化成本。

为了确认这一点，后面专门做了一组复现实验。

## 七、复现实验一：单独测 `build()` 成本

测试代码：

```java
package me.guanglian;

import nl.basjes.parse.useragent.UserAgent;
import nl.basjes.parse.useragent.UserAgentAnalyzer;
import org.junit.jupiter.api.Test;

class UaBuildTest {

    @Test
    void testBuildCost() {
        long start = System.nanoTime();

        UserAgentAnalyzer analyzer = UserAgentAnalyzer
                .newBuilder()
                .hideMatcherLoadStats()
                .withCache(10000)
                .withField(UserAgent.AGENT_NAME_VERSION)
                .build();

        long cost = (System.nanoTime() - start) / 1_000_000;

        System.out.println(analyzer.getClass().getSimpleName());
        System.out.println("build cost = " + cost + " ms");
    }
}
```

连续执行 3 次，结果都在：

```text
build cost ≈ 1259 ms
```

左右。

说明在当前这套 YAUAA 5.23 测试环境中：

> `UserAgentAnalyzer.newBuilder().build()` 本身就有稳定的秒级成本。

这和当年 Arthas 在登录链路里看到的“约 1 秒额外耗时”方向高度一致。

## 八、复现实验二：第一次 parse 很慢，后续只有几毫秒

另一个测试类把 Analyzer 改成长期复用：

```java
package me.guanglian;

import nl.basjes.parse.useragent.UserAgent;
import nl.basjes.parse.useragent.UserAgentAnalyzer;
import org.junit.jupiter.api.Test;

public class UaTest {

    private static final UserAgentAnalyzer userAgentAnalyzer = UserAgentAnalyzer
            .newBuilder()
            .hideMatcherLoadStats()
            .withCache(10000)
            .withField(UserAgent.AGENT_NAME_VERSION)
            .build();

    public static String getBrowser(String userAgent) {
        UserAgent.ImmutableUserAgent a = userAgentAnalyzer.parse(userAgent);
        return a.get(UserAgent.AGENT_NAME_VERSION).getValue();
    }

    @Test
    public void testParseCostMulti() {
        for (int i = 0; i < 10; i++) {
            String ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        + "AppleWebKit/537.36 (KHTML, like Gecko) "
                        + "Chrome/151.0.0." + i + " Safari/537.36";

            long start = System.nanoTime();

            String browser = getBrowser(ua);

            long cost = (System.nanoTime() - start) / 1_000_000;

            System.out.println(
                    "index=" + i
                    + ", browser=" + browser
                    + ", parse cost=" + cost + " ms"
            );
        }
    }
}
```

实际输出：

```text
Initializing Analyzer data structures
Built in 772 msec : Hashmap 143433, Ranges map:2900

index=0, browser=Chrome 151, parse cost=904 ms
index=1, browser=Chrome 151.0.0.1, parse cost=5 ms
index=2, browser=Chrome 151.0.0.2, parse cost=4 ms
index=3, browser=Chrome 151.0.0.3, parse cost=3 ms
index=4, browser=Chrome 151.0.0.4, parse cost=2 ms
index=5, browser=Chrome 151.0.0.5, parse cost=2 ms
index=6, browser=Chrome 151.0.0.6, parse cost=2 ms
index=7, browser=Chrome 151.0.0.7, parse cost=2 ms
index=8, browser=Chrome 151.0.0.8, parse cost=3 ms
index=9, browser=Chrome 151.0.0.9, parse cost=2 ms
```

这个结果非常关键。

真正慢的并不是：

```text
每一次 parse
```

而是：

```text
第一次 parse
→ 初始化 Analyzer data structures
→ 约 772 ms

第一次完整 parse
→ 约 904 ms
```

后续在同一个 Analyzer 上继续解析：

```text
2～5 ms
```

这说明原来的旧代码问题非常明确：

```text
每次登录
↓
新建 Analyzer
↓
第一次 parse
↓
重新初始化 Analyzer data structures
↓
重复支付约 0.9 秒成本
```

如果 Analyzer 被复用，这笔成本本来只需要支付一次。

## 九、官方说明：Analyzer 本来就应该少量创建、长期复用

继续查 YAUAA 官方文档后，发现官方对 Analyzer 生命周期有明确提醒：

> 应尽可能少地实例化新的 `UserAgentAnalyzer`。

官方文档说明，完整 Analyzer 初始化本身就是一个重量级操作，并且需要大量分析数据结构。

参考：

- [YAUAA 官方文档：Using the analyzer](https://yauaa.basjes.nl/using/index.html)
- [YAUAA 官方文档：Memory usage](https://yauaa.basjes.nl/using/memoryusage/index.html)
- [YAUAA 官方文档：Performance](https://yauaa.basjes.nl/expect/performance/index.html)

这和当前旧代码正好相反：

```text
官方推荐
→ Analyzer 少量创建、长期复用

当前旧代码
→ 每次登录都重新创建
```

因此，这次复现实验并不是偶然撞到了一个慢点，而是：

> 旧代码的对象生命周期设计本身就和 YAUAA 的使用模型相冲突。

## 十、社区测试也观察到秒级初始化成本

在 Keycloak 的一段社区讨论中，也有人测试过 YAUAA 的初始化性能。

其中记录的初始化时间大约在：

```text
1.7 秒
```

左右。

不同版本、不同机器、不同测试方式不能直接做严格数值比较，但方向是一致的：

> YAUAA Analyzer 初始化不是适合放在每个请求中反复执行的轻量操作。

参考：

- [Keycloak Discussion #17067：Device detection library: Should we replace UA parser?](https://github.com/keycloak/keycloak/discussions/17067)

本项目复现实验：

```text
build
→ 约 1.26 秒

第一次 parse
→ 约 0.90 秒

后续 parse
→ 2～5 ms
```

和社区观察、官方说明可以互相印证。

## 十一、复现实验三：用 MAT 验证 Analyzer 的实际 Heap 占用

为了补回当年已经丢失的 MAT 截图，重新构造了一个最小测试环境，并生成 heap dump。

测试中让：

```java
private static final UserAgentAnalyzer userAgentAnalyzer
```

长期存活，然后用 Eclipse MAT 分析 Dominator Tree。

在：

```java
.withCache(10000)
```

条件下，MAT 显示：

```text
UserAgentAnalyzer retained heap
≈ 104.64 MB

占整个测试 JVM 存活对象
≈ 94.11%
```

其中几个主要对象：

```text
informMatcherActions LinkedHashMap
≈ 63.48 MB

parseCache LRUMap
≈ 10.30 MB

matcherConfigs HashMap
≈ 9.52 MB

lookups LinkedHashMap
≈ 3.86 MB

informMatcherActionRanges HashMap
≈ 2.03 MB
```

Histogram 中还能看到：

```text
LinkedHashMap
≈ 158,721 个

LinkedHashMap$Entry
≈ 475,480 个

HashMap
≈ 3,637 个

ImmutableUserAgent
= 10,000 个
```

这和 YAUAA 自己初始化日志中的：

```text
Hashmap 143433
Ranges map:2900
```

方向完全一致。

也解释了为什么当年 MAT 中会看到大量 Map 相关对象。

## 十二、cache=0 对照：真正的大头不是 parseCache

继续把：

```java
.withCache(10000)
```

改成：

```java
.withCache(0)
```

再做同样的 heap dump 和 MAT 分析。

结果：

```text
cache=10000
→ UserAgentAnalyzer retained heap ≈ 104.64 MB

cache=0
→ UserAgentAnalyzer retained heap ≈ 94.41 MB
```

差值约：

```text
10.23 MB
```

而在 `cache=10000` 的 MAT 中：

```text
parseCache retained heap ≈ 10.30 MB
```

两者几乎完全对得上。

这说明：

> 10000 条 parse cache 确实占了一部分内存，但大约只有 10MB。

而即使彻底关闭 cache：

```text
UserAgentAnalyzer
仍然保留约 94MB Heap
```

真正的大头来自：

```text
matcher
lookup
规则结构
大量 LinkedHashMap / HashMap
```

而不是：

```text
10000 条解析结果缓存
```

这也完整解释了当年的现象：

```text
withCache(10000)
→ 改成 withCache(0)
→ Heap 问题依旧
```

因为关闭缓存只去掉了约 10MB。

Analyzer 自身近百 MB 的规则和匹配数据结构仍然存在。

## 十三、MAT 的 Path to GC Roots 也确认了引用关系

本次测试中，MAT 的 Path to GC Roots 显示：

```text
UserAgentAnalyzer
↓
UaTest.userAgentAnalyzer
↓
class UaTest
↓
ClassLoader / Test Thread
```

也就是说，在这次复现实验里：

```java
private static final UserAgentAnalyzer userAgentAnalyzer
```

确实通过强引用让 Analyzer 长期存活。

这个结果说明本次 MAT retained heap 统计对象关系是清晰的。

但它不能反推：

> 当年线上服务中完全相同的对象引用链一定也是这样。

因为当年的 heap dump 截图已经没有保留。

因此文章中对历史问题仍然保留边界：

> 当时 MAT 发现大量 HashMap，并能从对象信息看到 UA 解析相关类名，因此把排查方向收敛到 YAUAA；现在的复现实验进一步证明 YAUAA Analyzer 本身确实会建立大量 Map 结构并占用显著 Heap，但不能用今天的测试引用链替代当年的线上 GC Root 证据。

## 十四、到这里，问题已经不是“怎么调 cache”了

现在已经可以比较清楚地看到：

```text
性能
→ 每次新建 Analyzer 都会重复支付初始化成本

内存
→ Analyzer 本身就需要近百 MB 的规则数据结构

cache
→ 只是其中约 10MB
```

技术上当然还有几个优化方向：

```text
1. 把 Analyzer 做成单例 / Bean，长期复用
2. 关闭不需要的 parse cache
3. 换一个更轻量的 UA 解析库
```

但继续研究之前，更应该先问：

> 当前业务真的需要浏览器信息吗？

## 十五、真正的业务用途只是 eladmin 的“在线用户”展示

继续回看代码来源后发现：

```text
YAUAA
↓
解析浏览器
↓
用于 eladmin 原有“在线用户”功能
↓
页面展示浏览器信息
```

但当前业务系统并没有使用这项展示能力。

换句话说：

```text
登录请求
↓
每次解析浏览器
↓
支付秒级初始化成本
↓
占用大量 Analyzer 内部结构
↓
最终结果却没有任何业务页面使用
```

到这里，再继续研究：

```text
怎么调 cache
怎么复用 Analyzer
换什么解析库
```

已经不是最优先的问题。

因为更根本的问题是：

> 这项计算本身已经没有业务价值。

## 十六、最终方案：直接删除功能和依赖

最终选择最简单的方案：

```text
删除 getBrowser()
删除相关调用
删除 YAUAA Maven 依赖
```

也就是移除：

```xml
<dependency>
    <groupId>nl.basjes.parse.useragent</groupId>
    <artifactId>yauaa</artifactId>
    <version>5.23</version>
</dependency>
```

没有继续：

```text
调 cache
做单例
换解析器
```

因为这些都在优化一个当前系统根本不需要的功能。

## 十七、这次排查真正暴露的是“历史继承成本”

这类问题在基于开源脚手架长期演进出来的旧项目中很常见。

最开始：

```text
脚手架提供一个功能
↓
项目直接继承
↓
功能附带若干依赖和运行逻辑
```

后来业务发生变化：

```text
页面不用了
功能不用了
```

但代码和依赖不会自动消失。

于是系统可能长期保留：

```text
没有业务价值的计算
没有业务价值的依赖
没有业务价值的内存占用
没有业务价值的接口耗时
```

这次 User-Agent 解析就是一个典型例子。

原本只是为了“在线用户”页面显示一个浏览器名称。

到了当前系统：

```text
展示功能已经不用
↓
解析逻辑还在登录链路
↓
每次登录仍然执行
↓
额外增加约 1 秒耗时
↓
同时带来近百 MB 的 Analyzer 数据结构成本
```

真正需要治理的不是某个参数，而是这种历史继承成本。

## 十八、最终回看：无用功能最好的优化方式是删除

整个排查过程可以概括为：

```text
Grafana 发现 Heap 长时间不下降
↓
heap dump + MAT
→ 大量 HashMap，且能看到 UA 相关类名
↓
将排查方向收敛到 YAUAA
↓
第一怀疑：withCache(10000)
↓
改成 0
↓
问题依旧
↓
Arthas 排查登录调用链
→ UA 解析额外约 1 秒
↓
重新检查代码
→ 每次登录都重新创建 Analyzer
↓
2026 复现实验
→ build ≈ 1.26 秒
→ first parse ≈ 0.90 秒
→ subsequent parse ≈ 2～5 ms
↓
MAT 对照
→ cache=10000 retained ≈ 104.64 MB
→ cache=0 retained ≈ 94.41 MB
→ parseCache 只占约 10MB
↓
确认真正大头是 Analyzer 自身规则结构
↓
回看业务用途
→ 来自 eladmin 的在线用户浏览器展示
↓
当前业务根本没有使用
↓
删除 getBrowser() 和 YAUAA
```

这次排查最后留下的经验不是：

> YAUAA 不能用。

也不是：

> `withCache(10000)` 一定有问题。

而是：

> **重量级组件不要隐藏在看起来很轻的工具方法里，更不要在高频请求路径中反复初始化。**

对于旧项目，还应该再问一句：

```text
为什么现在还需要它？
```

如果答案是：

```text
已经没有业务用途
```

那么最有效的优化往往不是调参数，而是：

> **直接删除无用功能、代码和依赖。**

## 参考资料

- [YAUAA 官方文档：Using the analyzer](https://yauaa.basjes.nl/using/index.html)
- [YAUAA 官方文档：Memory usage](https://yauaa.basjes.nl/using/memoryusage/index.html)
- [YAUAA 官方文档：Performance](https://yauaa.basjes.nl/expect/performance/index.html)
- [Keycloak Discussion #17067：Device detection library: Should we replace UA parser?](https://github.com/keycloak/keycloak/discussions/17067)
