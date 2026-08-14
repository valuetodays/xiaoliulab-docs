---
title: 从“一屏多看几个依赖”开始：一次 Maven POM 简化设计的历史探索
description: 从 Maven POM 依赖声明过于冗长这一具体痛点出发，梳理社区十余年来关于 XML attributes、GAV identity、id="g:a:v"、替代 authoring format 与 POM model 简化的讨论与演进。
date: 2026-08-14
category: 技术探索
head:
  - - meta
    - name: keywords
      content: Maven,Maven 4,POM,GAV,dependency,plugin,exclusion,ModelParser,Build POM,Consumer POM,XML,Java
---

# 从“一屏多看几个依赖”开始，我重新理解了 Maven POM 的复杂度

最开始，我其实没有想那么多。

我只是觉得 Maven 的 dependency 写法太占地方了。

一个普通依赖：

```xml
<dependency>
    <groupId>org.apache.curator</groupId>
    <artifactId>curator-recipes</artifactId>
    <version>${curator.version}</version>
</dependency>
```

五行。

项目里的依赖一多，一个屏幕能看到的内容就非常有限。

于是我最开始想的问题非常简单：

> Maven 能不能让 dependency 写得短一点，让我一屏看到更多内容？

比如：

```xml
<dependency
    groupId="org.apache.curator"
    artifactId="curator-recipes"
    version="${curator.version}"/>
```

甚至进一步：

```xml
<dependency id="org.apache.curator:curator-recipes:${curator.version}"/>
```

原本我以为这只是一个“减少 XML 标签”的小问题。

后来翻 Maven 社区十几年来的讨论才发现：

**这个问题远比“少写几行 XML”有意思。**

社区里很多人从不同角度讨论过类似问题，而且讨论逐渐触及了 Maven 中几个很基础的设计问题：

- 什么是 artifact 的 identity？
- identity 和 dependency semantics 是否应该分开？
- XML 的冗长和 POM model 的复杂是不是同一回事？
- Maven 的 authoring format 是否必须等于最终发布出去的 POM？
- “简化 Maven”到底是在减少书写成本，还是减少理解成本？

这篇文章记录一下这次探索。

---

## 最早的诉求，其实和我的想法几乎一样

我原本以为“一屏看不到几个 dependency”只是自己的个人习惯。

结果翻到 MNG-5392 时发现，2012 年就有人几乎一模一样地抱怨过这个问题。

他的意思大致是：

一个 dependency 要占五行，编辑器里一次只能看到几个依赖。

如果改成 attribute：

```xml
<dependency
    groupId="junit"
    artifactId="junit"
    version="4.4"
    scope="test"/>
```

不仅可以少打很多字，而且在同一个屏幕里能看到更多 dependency，项目也更容易快速浏览和理解。

看到这里我挺有共鸣。

因为我最开始的需求真的没有什么“架构哲学”：

> **我只是想一屏多看点东西。**

但继续往前翻，才发现这个诉求从 2008 年左右就已经反复出现。

MNG-3397 是一个比较早的 RFC，讨论让 POM 更多地使用 XML attributes。

后面又陆续出现：

```text
2009  MNG-4090
      Allow attribute based configuration

2012  MNG-5392
      Support XML attributes for simple data types in POM

2014  MNG-5653
      POM using attributes for plugin definitions

2016  MNG-5996
      A cleaner approach to defining dependencies
```

这些方案的共同思路都很直接：

> XML 继续保留，但简单的数据不要每个字段都单独占一个 child element。

也就是说，从：

```xml
<dependency>
    <groupId>g</groupId>
    <artifactId>a</artifactId>
    <version>v</version>
</dependency>
```

变成：

```xml
<dependency groupId="g" artifactId="a" version="v"/>
```

这是第一种“简化”。

---

## 第一种简化：减少表达成本

这类方案解决的问题很容易理解：

```text
少打字
少移动光标
减少 XML 噪音
提高信息密度
一屏看到更多内容
```

本质上属于：

> **同样的信息，能不能用更少的语法表达？**

我把它称为：

**表达简化。**

它并不改变 Maven 的概念模型。

`groupId` 还是 `groupId`，`artifactId` 还是 `artifactId`。

只是表示方式变短了。

但社区后来慢慢出现了另一种想法：

> groupId、artifactId、version 为什么一定要在每一个地方分别写？

这时问题就开始发生变化了。

---

## 从“少写 XML”到“artifact identity 是什么”

2020 年的 MNG-7005 提出了类似 Gradle 的 GAV 写法：

```xml
<gav>myGroup:myArtifact:1.0.0</gav>
```

它已经不是简单把：

```xml
<groupId/>
<artifactId/>
<version/>
```

搬到 attribute 上。

而是开始把：

```text
groupId + artifactId + version
```

视为一个整体。

也就是一个 **artifact coordinate**。

差不多同一时期，还有一个更进一步的方案：MNG-7039。

它提出用 URI/URN 风格表达 Maven artifact：

```xml
<dependency
    uri="mvn:com.company/foo-api/1.0.1-SNAPSHOT"
    scope="compile"/>
```

这个方案让我第一次意识到：

> “让 POM 更短”和“定义 Maven artifact 的统一身份表达”其实不是完全相同的问题。

如果 Maven 有一个标准的单字符串 coordinate：

```text
groupId:artifactId:version
```

或者某种正式 URI，那么它的用途就不仅仅是 POM。

它还可以出现在：

```text
CLI
日志
IDE
dependency tree
自动化工具
repository tooling
API
```

这就从一个“XML 排版问题”，变成了一个领域建模问题：

> **Maven artifact 到底有没有一个统一、自然的 identity representation？**

---

## `<dependency>`、`<plugin>`、`<exclusion>` 其实很像

继续看下去以后，我开始注意到 Maven POM 里的一个现象。

比如 dependency：

```xml
<dependency>
    <groupId>org.example</groupId>
    <artifactId>foo</artifactId>
    <version>1.0</version>
</dependency>
```

plugin：

```xml
<plugin>
    <groupId>org.example</groupId>
    <artifactId>foo-plugin</artifactId>
    <version>1.0</version>
</plugin>
```

exclusion：

```xml
<exclusion>
    <groupId>org.example</groupId>
    <artifactId>foo</artifactId>
</exclusion>
```

它们当然不是同一种东西。

但它们有一部分非常相似：

> **都需要指出“我说的是哪个 artifact”。**

真正不同的是这个 artifact 在当前上下文里的含义。

dependency 表示：

```text
我要依赖它
```

plugin 表示：

```text
我要把它作为构建工具运行
```

exclusion 表示：

```text
我要从依赖图中排除它
```

所以从概念上看，很自然地可以想象一个东西：

```text
ArtifactReference
    groupId
    artifactId
    version?
    type?
    classifier?
```

然后：

```text
Dependency
    ArtifactReference
    + scope
    + optional
    + exclusions

Plugin
    ArtifactReference
    + executions
    + configuration

Exclusion
    ArtifactReference
```

如果这样理解，那么：

```xml
<dependency id="g:a:v"/>
<plugin id="g:a:v"/>
<exclusion id="g:a"/>
```

就不再只是“少写几个标签”。

它实际上是在表达：

> **这些模型对象共享一个共同的 artifact identity 概念。**

这也是我后来越来越觉得 `id="..."` 有意思的地方。

---

## 为什么我越来越喜欢 `id="g:a:v"`

单从“字符数”看，attribute 方案已经足够短：

```xml
<dependency groupId="g" artifactId="a" version="v"/>
```

但：

```xml
<dependency id="g:a:v"/>
```

让我觉得更自然。

原因并不只是它更短，而是 **`id` 这个词恰好符合 GAV 的语义**。

GAV 在这里回答的是：

> 这个 dependency 指的是谁？

而：

```xml
<scope>runtime</scope>
<optional>true</optional>
<exclusions>...</exclusions>
```

回答的则是：

> 我与它是什么关系？怎么使用它？

也就是说，可以很自然地分成两层：

```text
id
    = who is it?

scope / optional / exclusions
    = how do I depend on it?
```

因此：

```xml
<dependency id="org.postgresql:postgresql:42.7.3">
    <scope>runtime</scope>
    <exclusions>
        ...
    </exclusions>
</dependency>
```

并不是单纯把 XML 压缩成一行。

它背后隐含的是一种更清楚的模型：

```text
identity      -> compact
relationship  -> structured
```

我觉得这比“少写几个标签”更重要。

---

## 十几年后，社区又走回了 `id`

2025 年出现的 Maven #11500 又重新讨论了：

```xml
<dependency>groupId:artifactId:version</dependency>
```

后来讨论逐渐演进成：

```xml
<dependency id="groupId:artifactId:version">
    ...
</dependency>
```

到了 2026 年，又出现了一个具体实现 PR，尝试把这个概念用于：

```xml
<dependency id="org.slf4j:slf4j-api:2.0.17"/>

<exclusion id="*:*"/>

<mixin id="com.example.mixins:java-mixin:1.0.0"/>
```

回过头再看 2014 年的 plugin RFC，还能发现当时已经出现过：

```xml
<plugin id="maven-compiler-plugin:3.1"/>
```

于是会有一种很有意思的感觉：

**有些设计想法并不是突然产生的，而是在十几年里不断以不同形式重新出现。**

从：

```text
child elements
```

到：

```text
XML attributes
```

再到：

```text
<gav>g:a:v</gav>
```

再到 URI coordinate，

最后又走向：

```text
id="g:a:v"
```

背后逐渐浮现出一个很稳定的原则：

```text
identity      -> compact
configuration -> structured
```

简单情况尽可能简单。

复杂情况再展开。

---

## 但“写得短”不等于“真的简单”

这是这次探索里我觉得最值得留下来的一个认识。

我开始时理解的“简化 Maven”只有一种：

> 少写。

但后来发现，至少存在另一种完全不同的“简化哲学”：

> **让概念更清楚。**

例如：

```text
g:a:v@runtime?
```

当然很短。

但如果把所有信息都塞进一种紧凑 DSL，字符是减少了，人脑的解析成本可能反而增加。

所以：

```text
字符少
```

和：

```text
容易理解
```

不是一回事。

我现在更愿意把“简化”分成：

```text
表达简化
和
认知简化
```

一种是在减少书写成本。

一种是在减少理解成本。

---

## MNG-6230：另一种完全不同的简化

MNG-6230 给我的触动比较大。

它讨论的不是：

> plugin 能不能少写几行？

而是：

> plugin 的 artifact identity 和 execution declaration 为什么一定要绑在一起？

现在 Maven 的 plugin 结构大致是：

```text
plugin
    coordinate
    configuration
    executions
        phase
        goals
        configuration
```

MNG-6230 尝试把它拆成：

```text
plugin definition
    what tool is this?

execution definition
    when and how should it run?
```

也就是说：

```text
定义工具
```

和：

```text
定义怎么执行工具
```

是两个概念。

这是一种完全不同的简化。

它不是 syntax sugar。

它是在减少 **model complexity**。

所以我后来觉得，可以这样概括：

> **一种简化，是减少表达成本。**
>
> **另一种简化，是减少理解成本。**

有时候配置写得稍微长一点，但概念职责更清楚，反而是真的更简单。

---

## 还有第三层：authoring format 也未必是本质

MNG-6061 更进一步。

它直接问：

> 为什么 Maven 配置一定要是 XML？

是不是可以有：

```text
YAML
TOML
Groovy
...
```

早期还有 Polyglot Maven 这样的实验。

放在 Maven 3 时代，这类想法很容易碰到一个现实：

> Maven model 和 XML 绑定得太深。

但 Maven 4 开始出现一些很有意思的基础设施：

```text
Build POM
Consumer POM
ModelParser SPI
```

它们让我意识到第三层问题：

> **用户怎么写 Maven 项目，和 Maven 最终怎么把 model 提供给生态，未必必须是同一个东西。**

于是可以把复杂度再分一层：

```text
1. 表达简化
   少写、少重复、一屏看到更多

2. 认知简化
   identity、configuration、execution 等概念更清晰

3. 架构简化
   authoring representation
   internal model
   consumer representation
   不再被一种文件格式完全绑死
```

我原本只是从第一层开始。

最后一路看到了第三层。

---

## 有些老问题，今天可能需要重新看

翻这些历史 Issue 时还有一个很明显的感受：

一些 proposal 当年没有继续，并不一定意味着这个方向本身没有价值。

有时候，限制来自当时的实现条件。

一个很具体的例子是 MNG-4090。

它希望把：

```xml
<dependency>
    <groupId>junit</groupId>
    <artifactId>junit</artifactId>
    <version>4.5</version>
    <scope>test</scope>
</dependency>
```

简化为：

```xml
<dependency
    groupId="junit"
    artifactId="junit"
    version="4.5"
    scope="test"/>
```

这个 Issue 的作者还特意提到了 XStream。

作者当时的意思是：Maven 使用 XStream，而过去 XStream 不支持这种 attribute-based XML；后来相应能力已经具备，因此可以重新考虑这种写法。

这里需要特别说明一点：

**不能因此简单地说“POM 节点层次这么多，是 XStream 导致的”。**

Maven POM 的层次和写法首先来自它早期的 model/schema 设计。XML parser、对象映射方式、模型代码生成等基础设施，会影响这种设计有多容易改变，但它们并不是唯一原因。

更准确地说，历史上的关系更接近：

```text
Maven domain model
    ↓
POM model / schema design
    ↓
XML serialization / parser infrastructure
```

而不是：

```text
XStream
    ↓
决定了整个 POM 的结构
```

不过 XStream 这个例子依然很有意义。

因为它说明了一件事情：

> 历史讨论里的“不能做”，有时候只是“以当时的实现方式不好做”。

类似的技术约束，在早期讨论中还有很多：

```text
model 不容易演进
parser 与 XML model 耦合
需要新的 model version
改动范围太大
Maven 3 compatibility 成本很高
维护资源有限
```

而 Maven 4 的基础条件已经发生了变化。

现在至少可以看到：

```text
ModelParser SPI
Build POM
Consumer POM
新的 model infrastructure
```

因此，再看一个十年前被放弃的 proposal 时，不能只问：

> 当年为什么没做？

还要继续问：

> 当年的理由，今天还存在吗？

---

## “当年做不到”和“现在仍然不应该做”是两回事

这也是我这次整理历史讨论时越来越在意的一点。

一个 objection 大致可以分成两类。

第一类是：

```text
当时技术上很难做到
```

例如：

```text
parser 不支持
model 很难改
需要新的 model version
兼容成本过高
```

这种理由会随着架构变化而过时。

第二类则是：

```text
即使技术上能做到，这个设计是否值得？
```

例如：

```text
支持多种等价语法会不会增加认知成本？
紧凑 DSL 会不会比 XML 更难读？
IDE、formatter、文档如何处理？
生态到底要不要出现多种 POM authoring format？
```

这些问题不会因为 Maven 4 出现就自动消失。

它们属于真正长期存在的设计取舍。

所以我觉得，历史整理最大的价值之一就是：

> **知道一个想法过去为什么没有发生，才能判断那个理由今天是否依然成立。**

---

## 社区讨论比“少写几个标签”更有哲学

我这次最有趣的体验，其实是认知逐渐变化的过程。

一开始我是：

> 一个 dependency 五行，太占地方了。

然后发现别人也这么想。

继续翻：

> 能不能改 attribute？

再继续：

> GAV 本身是不是一个 identity？

再继续：

> dependency、plugin、exclusion 为什么都在重复表达 artifact？

再继续：

> identity 和 relationship semantics 是否应该分开？

然后：

> syntax complexity 和 model complexity 是不是两回事？

最后甚至变成：

> Maven 的哪些部分是本质，哪些只是历史表示方式？

所以现在回头看，“简化 Maven 开发”这个词本身其实至少有两种哲学：

```text
一种简化，是减少表达成本。

一种简化，是减少理解成本。
```

如果再往架构层看，还可以加一句：

```text
还有一种简化，是让不同层次之间不再不必要地耦合。
```

---

## 最后

这次探索最后，我把相关历史 proposal 做了一次整理，并回复到了 Maven 的开发者邮件列表里。

整理过程中，我越来越觉得：

**一个好的历史讨论整理，不一定需要提出一个全新的方案。**

把十几年里散落的想法重新串起来，也很有价值。

因为很多时候社区并不缺 idea。

真正缺的可能是：

```text
这些想法解决的到底是不是同一个问题？

哪些方案只是不同语法？

哪些方案是在重新定义领域概念？

过去阻碍它们的原因是什么？

这些原因今天还成立吗？
```

我原来只是想让一屏多显示几个 dependency。

结果最后发现：

**POM 的“长”，只是最表面的现象。**

真正值得思考的是：

> 我们究竟是在简化文本，还是在简化模型，还是在简化人的理解？

而这三个问题，并不总是同一个问题。
