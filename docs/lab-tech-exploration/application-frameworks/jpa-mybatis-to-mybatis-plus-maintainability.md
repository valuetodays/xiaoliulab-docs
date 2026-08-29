---
title: "从 JPA + MyBatis 到 MyBatis-Plus：一次旧项目数据访问层的维护性收敛"
description: "记录一个 Spring Boot 2.2 老项目从 JPA + 原生 MyBatis 混合数据访问栈逐步收敛到 MyBatis-Plus 的过程，重点讨论维护效率、字段变更成本、简单 CRUD 与业务语义 SQL 的边界，以及一组已经实际配套运行过的依赖版本。"
date: 2026-08-29
keywords:
  - Spring Boot 2.2
  - JPA
  - MyBatis
  - MyBatis-Plus
  - PageHelper
  - 数据访问层
  - CRUD
  - 维护性
---

# 从 JPA + MyBatis 到 MyBatis-Plus：一次旧项目数据访问层的维护性收敛

## 背景：一个项目里同时存在两套数据访问方式

这个项目基于 Spring Boot `2.2.10.RELEASE`。

早期框架中保留了 JPA：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

后来项目维护过程中又引入了原生 MyBatis 和 PageHelper：

```xml
<dependency>
    <groupId>com.github.pagehelper</groupId>
    <artifactId>pagehelper-spring-boot-starter</artifactId>
    <version>1.3.0</version>
</dependency>

<dependency>
    <groupId>org.mybatis.spring.boot</groupId>
    <artifactId>mybatis-spring-boot-starter</artifactId>
    <version>1.3.2</version>
</dependency>
```

实际业务代码已经主要使用 MyBatis，JPA 更多是原框架遗留下来的技术栈。

这意味着同一个项目里长期同时存在：

```text
JPA + MyBatis
```

从功能上看没有问题，但从维护角度看，没有必要同时保留两套数据访问模型。

真正推动这次改造的，并不是“哪个框架更新”或者“哪个框架启动更快”，而是一个更实际的问题：

> 数据访问层能不能更省时间、更少出错、更容易维护。

## 原生 MyBatis 的问题，不只是 XML 多

原生 MyBatis 最大的问题并不是“要写 XML”本身。

真正增加维护成本的是：

> 数据库字段发生变化时，往往需要同步修改很多地方。

例如一个普通的单表查询：

```xml
<select id="selectById">
    select id,
           order_no,
           status,
           paid_time,
           create_time
    from t_order
    where id = #{id}
</select>
```

如果表中新增一个普通字段，可能需要重新检查：

```text
Entity / POJO
select 字段列表
ResultMap
insert
update
批量 insert
列表查询
导出 SQL
```

这些修改很多时候都没有新的业务语义，只是在机械地同步字段。

字段越多、Mapper 越多，这类修改点也越多。

带来的结果不是简单的“代码多几行”，而是：

```text
开发时间增加
联调时间增加
需要检查的地方增加
漏改、错改的概率增加
```

对于长期维护的业务系统，这些都是实际成本。

## 为什么不是继续使用 JPA

既然原生 MyBatis 在普通 CRUD 上存在不少机械维护成本，一个自然的问题是：

> 为什么不直接继续使用 JPA？

原因并不是 JPA 不能完成这些工作，而是它和这个项目实际面对的查询、更新方式并不匹配。

首先，这个项目里有不少连表查询、列表查询和带业务条件的组合查询。

这类场景下，我更希望直接看到：

```text
查了哪些表
用了什么 JOIN
WHERE 条件是什么
最终返回哪些字段
```

相比通过实体关联、JPQL、Specification、Criteria API 或持久化上下文间接表达数据库行为，显式 SQL 对长期维护和线上排障更直观。

其次，这个项目里还有大量“只修改少数字段”的状态型业务，例如：

```text
订单付款成功
订单付款失败
退款成功
退款失败
KYC 审核通过
KYC 审核拒绝
页面修改订单图片
```

这些更新真正需要表达的是：

```text
谁负责修改哪些字段
允许从什么状态迁移
哪些字段不能被顺带覆盖
```

如果采用一种“先查整行、修改几个字段、再保存整个对象”的更新方式，并发场景下很容易产生丢失更新。

例如页面操作和外部支付回调同时处理同一笔订单。

两边都先查到：

```text
status = TO_PAY
image  = old.png
```

页面线程只修改图片：

```text
image = new.png
```

支付回调只修改付款状态：

```text
status = PAID
paid_time = ...
```

如果两边最后都生成类似：

```sql
update t_order
set status = ?,
    paid_time = ?,
    image = ?,
    ...
where id = ?
```

那么后保存的一方就可能把另一方已经更新成功的字段重新覆盖成自己查询时拿到的旧值。

例如支付回调先成功写入：

```text
status = PAID
```

随后页面线程再保存旧对象，就可能把状态重新写回：

```text
status = TO_PAY
```

这类问题对于订单、支付、退款、KYC 等状态敏感业务风险很高。

因此我更希望不同业务只修改自己真正负责的字段。

页面修改图片：

```sql
update t_order
set image = ?
where order_id = ?
```

支付成功：

```sql
update t_order
set status = 'PAID',
    paid_time = ?
where order_id = ?
  and status = 'TO_PAY'
```

这样不仅避免无关字段互相覆盖，还可以直接把状态迁移条件写进 `WHERE`，让数据库更新语句本身表达业务约束。

所以这里真正的维护原则是：

> 业务更新应该尽量缩小更新字段范围；谁负责哪个字段，就只更新哪个字段。对于状态迁移，还应该把原状态条件显式写进 SQL。

这也是我更倾向于 MyBatis / MyBatis-Plus 的重要原因。

对于复杂查询，我希望 SQL 足够明确；对于关键写操作，我同样希望能直接看清：

```text
改哪些字段
从什么状态改
目标状态是什么
并发时哪些字段不会被覆盖
```

另外，这个项目的 JPA 本身主要来自原有框架，后续真实业务代码已经长期使用 MyBatis。

继续同时维护：

```text
Entity / Repository / JPA
```

和：

```text
Mapper / XML / MyBatis
```

还会额外增加两套数据访问模型的认知成本。

因此这次改造并不是简单地认为“JPA 不好”，而是：

> 当前项目更需要显式、可控、容易排障的数据访问方式；同时又希望减少原生 MyBatis 在简单 CRUD 上的机械维护成本，因此最终选择以 MyBatis / MyBatis-Plus 作为统一的数据访问方案。

## MyBatis-Plus 更像是对现有 MyBatis 的增强

引入 MyBatis-Plus，并不意味着重新换一套完全不同的数据访问模型。

更接近：

```text
MyBatis
↓
MyBatis + MyBatis-Plus
```

已有的：

```text
Mapper
XML
复杂 SQL
手写 SQL
```

仍然可以继续使用。

MyBatis-Plus 主要补上的，是原生 MyBatis 在普通 CRUD 上过于机械的问题。

例如：

```java
selectById(id);
insert(entity);
updateById(entity);
deleteById(id);
```

这类操作本身没有多少业务语义。

如果每一个单表 CRUD 都重新写一套：

```xml
<select>
<insert>
<update>
<delete>
```

长期维护价值很低。

MyBatis-Plus 可以把这些重复工作收掉，让字段映射和普通 CRUD 的维护点明显减少。

## 简单 CRUD 追求少维护

对于普通单表操作，我更希望数据库字段变化后，只需要修改真正必要的地方。

例如新增一个普通字段时，理想情况是：

```text
修改表结构
修改实体字段
```

很多基础 CRUD 不再需要逐个同步修改 XML。

因此 MyBatis-Plus 在这个项目里的价值，并不只是“少写代码”。

更准确地说是：

> 减少字段变化时的机械维护点，从而降低开发、调试和出错成本。

这也是这次改造最重要的目标之一。

## 但关键业务更新不能全部变成 updateById

MyBatis-Plus 提供 `updateById` 很方便，但这并不意味着所有更新都应该使用它。

这个项目里有大量状态型业务，例如：

```text
订单付款成功
订单付款失败
退款成功
退款失败
KYC 审核通过
KYC 审核拒绝
```

这些操作表面上都是：

```text
UPDATE 一条记录
```

但从业务上看，它们并不是普通字段编辑，而是明确的状态迁移。

如果写成：

```java
orderMapper.updateById(order);
```

代码只能表达：

> 更新了一条订单记录。

却无法直接表达：

```text
为什么允许更新
原状态必须是什么
目标状态是什么
同时修改哪些业务字段
重复回调应该如何处理
```

这种写法虽然通用，但业务语义太弱。

## 业务状态变化应该有明确的方法名

对于付款成功这样的操作，更适合写成：

```java
orderMapper.updateAsPaid(orderId, paidTime);
```

对应 SQL：

```sql
update t_order
set status = 'PAID',
    paid_time = ?
where order_id = ?
  and status = 'TO_PAY'
```

这里的方法名和 SQL 都直接表达了业务规则。

方法名：

```text
updateAsPaid
```

说明这不是一次普通 update，而是一次“标记为已付款”的业务动作。

SQL：

```sql
where status = 'TO_PAY'
```

又把允许的状态迁移直接写进数据库更新条件。

这种代码在维护时更容易回答：

```text
这段代码到底想做什么？
什么状态可以被修改？
哪些字段会一起变化？
重复执行时会发生什么？
```

相比之下，一个泛化的 `updateById` 很难提供同样清晰的语义。

## MyBatis-Plus 用来减少样板代码，不是消灭业务 SQL

因此这次改造后，我更倾向于把数据访问分成两类。

普通 CRUD：

```text
selectById
insert
deleteById
普通 updateById
```

交给 MyBatis-Plus。

而有明确业务语义的修改：

```text
updateAsPaid
updateAsPayFailed
updateAsRefunded
approveKyc
rejectKyc
```

继续保留显式 Mapper 方法和显式 SQL。

可以概括成一句：

> MyBatis-Plus 用来消灭无意义的 CRUD 样板代码，而不是消灭有业务意义的 SQL。

或者换一个维护角度：

> 简单 CRUD 追求少维护，关键业务更新追求易理解。

这两者并不冲突。

## 显式 SQL 对线上排障也更友好

这个项目的维护方式比较依赖实际 SQL。

出现线上问题时，我希望能够快速回答：

> 这段业务代码最后到底修改了数据库什么内容？

对于关键业务更新，如果 Mapper 中直接存在：

```xml
<update id="updateAsPaid">
    ...
</update>
```

那么打开代码就能看到数据库行为。

这种“所见即所得”的方式，对支付、退款、订单状态、KYC 等状态敏感业务尤其重要。

并不是所有 SQL 都需要手写。

真正值得保留的是那些：

> SQL 本身就是业务规则的一部分。

## 这也是一次数据访问技术栈的收敛

改造前的数据访问体系大致是：

```text
JPA
+
原生 MyBatis
+
PageHelper
```

而项目真实业务已经主要使用 MyBatis。

因此继续保留 JPA，只会让项目存在两套并行的数据访问思路。

引入 MyBatis-Plus 后，整体思路变成：

```text
MyBatis / MyBatis-Plus
```

简单 CRUD 交给 MyBatis-Plus，复杂 SQL 和业务 SQL 继续保持 MyBatis 的显式写法。

它没有要求把老代码一次性重写。

已有 XML 可以继续运行，复杂查询可以继续保留，只有那些机械性的 CRUD 才逐步收敛。

对于旧项目来说，这种渐进式改造的风险也更低。

## 版本留念：一组已经实际配套运行过的依赖

这次改造还有一个很实际的目的：留下当时已经验证可以一起运行的版本组合。

Spring Boot 版本保持不变：

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.2.10.RELEASE</version>
</parent>
```

移除 JPA：

```xml
<!-- removed -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

PageHelper 调整为：

```xml
<dependency>
    <groupId>com.github.pagehelper</groupId>
    <artifactId>pagehelper-spring-boot-starter</artifactId>
    <version>2.1.0</version>
</dependency>
```

MyBatis-Plus 使用：

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-bom</artifactId>
            <version>3.5.15</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

这里记录版本，并不是为了说明它们是某种“最佳版本”。

意义只是：

> 这是一组在这个 Spring Boot 2.2 老项目中已经实际配套运行过的依赖版本，后续维护时可以作为兼容性参考。

## 一个附带现象：启动时间从约 60 秒降到约 30 秒

改造完成后，还观察到一个比较明显的现象：

```text
改造前：日常启动约 60 秒
改造后：日常启动约 30 秒
```

这个变化值得记录，但不适合作为本文的核心结论。

因为这次改造同时调整了多项数据访问依赖，并没有做严格的单变量实验，所以不能直接得出：

> 删除 JPA 就节省了 30 秒启动时间。

更准确的说法是：

> 数据访问层收敛完成后，项目启动时间同时出现了明显下降。

这是一项额外收益，但真正推动这次改造的仍然是维护性。

## 后续演进

这次改造完成后，项目的数据访问层已经基本收敛到 MyBatis / MyBatis-Plus。

后续继续维护分页代码时，又发现 PageHelper 的部分分页写法在泛型表达和调用方式上不够直观，因此又对分页方式进行过进一步整理。

相关记录：

- [PageHelper 两种分页写法对比：一次泛型失真的排查与源码分析](/lab-tech-exploration/application-frameworks/pagehelper-pagination-generic-type-safety)

那属于后续阶段的改造，不在本文展开。

## 最终回看：核心还是维护时间和效率

如果只看依赖变化，这次改造很容易被理解成：

```text
去掉 JPA, 加入 MyBatis-Plus
```

但真正重要的并不是框架名称。

这次改造最终解决的是三个维护问题：

```text
一套项目里没有必要长期保留两套数据访问体系

原生 MyBatis 在普通单表 CRUD 上存在大量机械维护工作

关键业务状态变化需要显式的方法名和 SQL，而不是被通用 updateById 掩盖
```

所以最后形成的原则是：

> 结构性 CRUD 交给 MyBatis-Plus，减少字段变化带来的机械维护；业务性写操作保留显式 Mapper 和 SQL，让业务规则直接体现在代码里。

最终目标只有一个：

> 用更少的时间完成开发、修改、联调和排障，同时让关键业务代码更容易理解，也更不容易出错。
