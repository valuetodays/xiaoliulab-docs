---
title: 为什么我不再允许业务代码直接使用 MyBatis-Plus 的 insert 和 updateById
date: 2026-09-01
description: 从一次 JPA 迁移到 MyBatis-Plus 的真实踩坑出发，重新审视 BaseMapper 中 insert 和 updateById 在复杂业务系统中的维护成本，并通过 BizBaseMapper + BizSqlInjector 对通用写能力进行项目级裁剪。
author: valuetodays
categories:
  - 探索技术
tags:
  - Java
  - Spring Boot
  - MyBatis
  - MyBatis-Plus
  - BaseMapper
  - SQL Injector
  - ORM
keywords:
  - MyBatis-Plus BaseMapper
  - MyBatis-Plus updateById
  - MyBatis-Plus insert
  - BizBaseMapper
  - BizSqlInjector
  - MyBatis-Plus SQL Injector
---

# 为什么我不再允许业务代码直接使用 MyBatis-Plus 的 insert 和 updateById

> 这里需要提前说明：本文并不是认为 MyBatis-Plus 的 `BaseMapper`、`insert()` 或 `updateById()` 设计得不好。
>
> MyBatis-Plus 的目标之一，本来就是尽可能降低常规 CRUD 的开发成本。对于后台管理、简单数据维护、原型开发等场景，这套通用 API 非常高效。如果你的系统主要是简单 CRUD，业务状态不复杂，`insert()` 和 `updateById()` 可能就是非常高效、合理的选择。
>
> 本文讨论的是长期维护、业务规则较多、状态流转复杂、更新场景很多的业务系统。在这种场景下，我更希望写操作能够显式表达“修改什么、在什么条件下修改、为什么允许修改”。
>
> 因此，本文不是对 MyBatis-Plus 的否定，也不是试图把这种约束推广成所有项目都必须遵守的规范，而是基于具体业务系统维护需求做的一层项目级约束。

配套示例工程：<a href="https://cdn.jsdelivr.net/gh/valuetodays/supreme-octo-palm-tree@main/attachment/springboot2-sample-mybatisplus-bizbasemapper.zip">点此下载代码</a>。


示例工程使用 Spring Boot 2、Java 8、MyBatis-Plus、H2，对本文的最终方案进行了实际验证。工程以 ZIP 形式提供，不单独维护 GitHub Demo 仓库。

本文涉及的 MyBatis-Plus 官方源码与讨论：

- [BaseMapper.java](https://github.com/baomidou/mybatis-plus/blob/3.0/mybatis-plus-core/src/main/java/com/baomidou/mybatisplus/core/mapper/BaseMapper.java)
- [DefaultSqlInjector.java](https://github.com/baomidou/mybatis-plus/blob/3.0/mybatis-plus-core/src/main/java/com/baomidou/mybatisplus/core/injector/DefaultSqlInjector.java)
- [Issue #926：mybatis-plus 的一种很别扭的用法](https://github.com/baomidou/mybatis-plus/issues/926)
- [MyBatis-Plus SQL Injector 官方文档](https://baomidou.com/guides/sql-injector/)

## 文章脉络

这篇文章的思路不是从“如何自定义一个 Mapper”开始，而是从一次真实的业务问题逐步推导到最终方案：

```text
JPA -> MyBatis-Plus 迁移时踩坑
        |
        v
重新审视 insert / updateById
        |
        v
发现 updateById 在复杂业务系统中长期维护成本更高
        |
        v
思考理想模型：按 Query / Insert / Update / Delete 拆分 Mapper 能力
        |
        v
查看 MyBatis-Plus 官方源码、GitHub issue 和现有扩展机制
        |
        v
排除 Fork MyBatis-Plus、继承 BaseMapper 后 override 等方案
        |
        v
BizBaseMapper + BizSqlInjector
        |
        v
使用 H2 对保留的方法进行逐项验证
        |
        v
形成项目级约束：通用查询可以保留，业务写操作尽量显式化
```

核心目标并不是减少 MyBatis-Plus 的能力，而是重新划定：

> **框架提供的能力全集，与业务代码允许直接使用的能力边界。**


## 为什么开始重新审视 BaseMapper

### 一次从 JPA 迁移到 MyBatis-Plus 的真实踩坑

这个问题最初并不是来自代码风格讨论，而是一次真实的生产问题。

此前项目中使用过 JPA。JPA 中很常见的写法是：

```java
repository.save(entity);
```

长期使用以后，很容易形成一种心智模型：

```text
save
=
根据实体当前状态完成持久化
```

迁移到 MyBatis-Plus 后，Mapper 层提供的是更加明确的数据库动作：

```java
mapper.insert(entity);
mapper.updateById(entity);
```

`insert()` 就是 INSERT，并不会因为这条数据已经存在，就自动转换为 UPDATE。

在一次较大范围的替换过程中，本来应该执行 UPDATE 的逻辑被写成了 INSERT。问题在生产环境中存在了一段时间以后，才重新定位到这里。

这件事让我意识到：

> ORM 或持久层框架 API 一旦直接大量出现在业务代码中，框架迁移时很容易发生“位置相似、名称相近，但语义并不一致”的错误映射。

如果上层依赖的是：

```java
saveUser(...)
updateOrderStatus(...)
markPaymentSuccess(...)
```

那么底层从 JPA 换成 MyBatis-Plus，业务语义本身并不需要跟着框架 API 一起变化。

### insert 的问题相对有限，updateById 才是主要矛盾

`insert()` 确实存在前面提到的迁移误用问题，但从业务系统的调用频率来看，它通常还比较容易管理。

一个实体的新增入口往往不多，例如：

```text
创建用户
创建订单
保存回调记录
导入一条基础数据
```

而 UPDATE 完全不同。

一个业务对象在生命周期中可能被修改很多次：

```text
修改手机号
修改邮箱
修改状态
修改审核结果
记录支付结果
记录退款结果
修改备注
修改标签
记录失败原因
记录完成时间
```

而且这些 UPDATE 通常每次只修改少数字段。

如果全部写成：

```java
entity.setXxx(...);
entity.setYyy(...);

mapper.updateById(entity);
```

随着系统逐渐变大，`updateById()` 会出现在大量业务代码中。

因此，相比 `insert()`，`updateById()` 才是促使我重新设计 Mapper 使用边界的主要原因。

### 通用写方法为什么会逐渐增加维护成本

`BaseMapper` 的价值之一，就是把大量常规 CRUD 收敛成少数通用 API。

从“写代码”的角度看，这是减少重复。

但从“长期维护业务”的角度看，另一种复杂度可能被隐藏起来：

```java
updateById(entity);
```

只有一个方法。

可是不同调用点的实际含义可能完全不同：

```text
支付成功
退款完成
审核拒绝
修改手机号
修改用户状态
关闭订单
更新回调结果
```

也就是说：

> 通用方法减少了接口数量，但没有消除业务复杂度，只是把复杂度转移到了调用方。


## updateById 在业务系统中的真实问题

### 看不到真正修改了哪些字段

看到：

```java
orderMapper.updateById(order);
```

仅仅从这一行，无法知道最终修改了哪些字段。

为了理解真实 SQL，通常需要向上寻找：

```java
order.setStatus(...);
order.setPayTime(...);
order.setRemark(...);
```

如果对象是经过多个方法传递过来的，还要继续判断：

- 前面是否已经调用过其他 `setXxx()`；
- 哪些字段当前为 `null`；
- Entity 是否来自一次完整查询；
- 是否存在公共方法修改过它；
- 是否配置了自动填充字段；
- 当前字段更新策略如何处理 `null`。

最终开发者实际上是在脑中把若干 Java 语句重新拼成：

```sql
UPDATE t_order
SET status = ?,
    pay_time = ?,
    remark = ?
WHERE id = ?
```

对于线上问题排查和代码 Review，这种阅读方式并不友好。

### UPDATE 的核心不只是 SET，更是 WHERE

如果只是“看不到更新字段”，还只是可读性问题。

在复杂业务系统中，更重要的是 UPDATE 的业务前置条件。

例如订单从处理中进入成功状态：

```sql
UPDATE t_order
SET status = 'SUCCESS',
    success_time = ?
WHERE id = ?
  AND status = 'PROCESSING'
```

这里真正重要的业务信息之一是：

```sql
AND status = 'PROCESSING'
```

它表达的是：

> 只有仍然处于 `PROCESSING` 状态的数据，才允许进入 `SUCCESS`。

这不仅是查询条件，也是状态机约束和一种简单的并发保护。

而如果习惯写：

```java
order.setStatus(SUCCESS);
order.setSuccessTime(now);
orderMapper.updateById(order);
```

开发者很容易形成：

```text
更新 = 根据 ID 找到记录，然后修改字段
```

这样的思维。

但真实业务中的 UPDATE 往往更接近：

> 在满足明确前置条件的情况下，修改明确的一组字段。

例如：

```sql
WHERE id = ?
  AND status = ?
```

或者：

```sql
WHERE id = ?
  AND version = ?
```

又或者：

```sql
WHERE id = ?
  AND audit_status = 'WAIT'
```

这些 WHERE 条件本身就是业务的一部分。

### Entity 很容易变成万能写入参数

`updateById(entity)` 还会自然诱导一种写法：

```java
User user = new User();
user.setId(userId);
user.setStatus(status);

userMapper.updateById(user);
```

当 Entity 字段越来越多：

```text
id
name
mobile
status
balance
level
deleted
createTime
updateTime
...
```

一个完整数据库 Entity 与“当前业务允许修改的字段集合”其实并不是一回事。

当前业务可能只允许修改：

```text
status
```

但传递的却是一个理论上可以容纳整行数据库状态的对象。

对于明确的业务修改，我更倾向于：

```java
updateUserStatus(userId, expectedStatus, newStatus);
```

复杂一些时，也可以使用专门的 Param / Command：

```java
updateUserStatus(UserStatusUpdateParam param);
```

这样写入边界更加明确。

### 字段更新策略增加了额外认知成本

例如：

```java
entity.setMobile(null);
mapper.updateById(entity);
```

仅看这两行代码，有时并不能立即判断最终 SQL 是否包含：

```sql
mobile = NULL
```

因为真实行为还可能受到 MyBatis-Plus 字段策略等配置影响。

也就是说：

```text
setXxx(...)
+
updateById(...)
```

不一定能仅凭调用点直观对应最终 SQL。

这并不是框架的问题，而是通用 Entity 更新机制必然需要处理的复杂性。

但对于业务维护者来说，这些隐含规则都会增加排查时的认知负担。

### affected rows 本身具有业务意义

业务 UPDATE 往往应该关注受影响行数。

例如：

```sql
UPDATE t_order
SET status = 'SUCCESS'
WHERE id = ?
  AND status = 'PROCESSING'
```

如果：

```text
affectedRows = 0
```

它可能意味着：

- 数据不存在；
- 状态已经被其他逻辑修改；
- 收到了重复回调；
- 当前状态不允许这次迁移；
- 并发竞争失败。

因此，UPDATE 返回值本身有时就是业务结果的一部分。

显式业务方法更容易让调用方意识到：

> 这个业务动作有没有真正完成，需要判断。

### “先查再 set 再 updateById”会扩大旧 Entity 的影响范围

`updateById()` 还有一个比可读性更值得警惕的问题：当它与“先查询完整 Entity，再修改部分字段”的写法结合时，可能在并发场景下误覆盖其他已经发生的修改。

例如，业务本来只是想修改用户手机号：

```java
User user = userMapper.selectById(userId);

user.setMobile(newMobile);

userMapper.updateById(user);
```

从业务意图来看，这次操作只想修改：

```text
mobile
```

但是 `selectById()` 查询出来的是一个完整的 Entity，其中还可能包含：

```text
status
email
level
remark
...
```

这些字段代表的是**查询发生时数据库中的状态**。

如果查询完成以后、执行 `updateById()` 以前，另一个线程修改了其中某个字段，就可能出现旧数据覆盖新数据的问题。

例如：

```text
T1：selectById(userId)

    mobile = 138...
    status = NORMAL


T2：修改用户状态

    status = FROZEN


T1：修改手机号

    user.setMobile("139...")


T1：updateById(user)
```

如果 T1 最终执行的 UPDATE 中同时包含了 `mobile` 和 `status`：

```sql
UPDATE t_user
SET mobile = '139...',
    status = 'NORMAL'
WHERE id = ?
```

那么 T2 刚刚写入的：

```text
status = FROZEN
```

就可能被 T1 手中较早查询出来的旧值：

```text
status = NORMAL
```

重新覆盖。

最终结果变成：

```text
手机号修改成功
+
用户状态被意外恢复成旧值
```

但 T1 的业务代码从来没有想过要修改 `status`。

这类问题的危险之处就在于：

> 当前业务只想修改一个字段，但完整 Entity 同时携带了其他字段的旧状态。

因此：

```java
selectById(...)
setXxx(...)
updateById(...)
```

并不只是多了一次查询，也不仅仅存在“查询和更新之间有并发窗口”的问题。

这个并发窗口还可能进一步演变成：

> **使用旧 Entity 中携带的数据，覆盖其他事务已经完成的更新。**

如果当前业务真正只允许修改手机号，更明确的实现应该是：

```sql
UPDATE t_user
SET mobile = ?
WHERE id = ?
```

如果还存在业务前置条件，可以进一步写成：

```sql
UPDATE t_user
SET mobile = ?
WHERE id = ?
  AND status = 'NORMAL'
```

这样当前操作只会修改它真正负责的字段。

其他线程同时修改：

```text
email
level
remark
audit_status
```

都不会因为当前业务持有了一份较旧的 Entity 而被顺带覆盖。

当然，MyBatis-Plus 可以配合乐观锁等机制解决一部分并发更新问题，具体 SQL 是否包含某个字段，也受到字段更新策略以及 Entity 使用方式的影响。

这里真正想强调的并不是：

> 所有 `updateById()` 都一定会产生并发覆盖。

而是：

> **“先查完整 Entity → 修改少数字段 → 再按 Entity 更新”这种编程模式，扩大了当前业务操作可能影响的数据范围。**

对于长期维护的业务系统，我更希望一次更新从接口和 SQL 层面就能够明确：

```text
这次允许修改哪些字段？
```

而不是依赖：

```text
当前这个 Entity 恰好携带了哪些值？
```

这也是我希望将业务 UPDATE 从通用 `updateById(entity)` 中逐步拆出来的重要原因之一。

### Find Usages 会因为大量 updateById 而失去定位能力

这是长期维护过程中一个非常现实的问题。

当整个系统到处都是：

```java
updateById(...)
```

线上出现问题以后，如果希望找到：

> 到底哪里可能修改了这个数据？

在 IDE 中对 `updateById()` 执行 Find Usages，很可能一次出现几十甚至几百个调用方。

这些调用点可能分别代表：

```text
更新用户手机号
更新用户状态
订单支付成功
退款完成
审核通过
审核失败
回调处理
定时任务修复
```

但是在调用关系中，它们全部表现成：

```java
updateById(...)
```

这会明显降低：

```text
Find Usages
Call Hierarchy
Navigate to Declaration
```

这些静态代码导航能力的业务定位价值。

如果 Mapper 中是：

```java
updateUserMobile(...)
updateUserStatus(...)
markOrderPaid(...)
markRefundSuccess(...)
updateAuditResult(...)
```

方法名本身就变成了一种业务索引。

### 方法变多并不代表复杂，业务语义反而更清晰

限制 `updateById()` 以后，一个直接结果就是 Mapper 方法会增加。

以前：

```java
updateById(...)
```

一个方法承担大量不同业务更新。

以后可能出现：

```java
updateUserMobile(...)
updateUserEmail(...)
updateUserStatus(...)
markOrderPaid(...)
markRefundSuccess(...)
closeExpiredOrder(...)
```

方法确实更多。

但每个方法都回答了一个问题：

> 这次写操作到底是什么业务动作？

打开一个 Mapper，仅仅看方法列表，就能大致知道这个业务对象有哪些写操作。

所以：

> 通用方法少，并不一定意味着系统更简单。

很多时候，只是把复杂度隐藏到了调用方。



## 理想中的 Mapper 能力模型与官方现状

### 如果 BaseMapper 能按 CRUD 能力拆分会更好

在考虑如何限制 `insert()` 和 `updateById()` 时，我最先想到的其实不是复制 `BaseMapper`。

理想情况下，希望 MyBatis-Plus 的 Mapper 能力本身就是可以组合的。

例如：

```java
public interface QueryMapper<T> {
}

public interface InsertMapper<T> {
}

public interface UpdateMapper<T> {
}

public interface DeleteMapper<T> {
}
```

然后官方的完整 `BaseMapper` 再组合它们：

```java
public interface BaseMapper<T>
        extends QueryMapper<T>,
                InsertMapper<T>,
                UpdateMapper<T>,
                DeleteMapper<T> {
}
```

这样，框架仍然可以提供一个开箱即用的完整 `BaseMapper`。

而有特殊要求的项目，则可以自己组合能力。

这种结构会更符合接口隔离原则，也更方便项目根据需要定义自己的能力边界。

### 查看 MyBatis-Plus 官方 GitHub issue 和实现

为了确认 MyBatis-Plus 是否已经有类似方向，我查看了官方源码、GitHub issue 和现有扩展机制。

当前 `BaseMapper` 仍然是一个统一提供 CRUD 能力的接口：

- [BaseMapper.java](https://github.com/baomidou/mybatis-plus/blob/3.0/mybatis-plus-core/src/main/java/com/baomidou/mybatisplus/core/mapper/BaseMapper.java)

MyBatis-Plus 同时通过 SQL Injector 为这些通用 Mapper 方法注册对应 SQL：

- [DefaultSqlInjector.java](https://github.com/baomidou/mybatis-plus/blob/3.0/mybatis-plus-core/src/main/java/com/baomidou/mybatisplus/core/injector/DefaultSqlInjector.java)

截至本文编写时，没有看到官方已经明确计划把 `BaseMapper` 拆成 `QueryMapper / InsertMapper / UpdateMapper / DeleteMapper` 这种接口结构。

因此，上面的四接口模型只是本文在解决问题过程中形成的一个理想设计，并不是 MyBatis-Plus 官方已经提出的方案。

### 社区对 CRUD 接口边界也有过讨论

在调研 MyBatis-Plus 官方 GitHub 时，我也看到过社区对 BaseMapper / IService 职责边界的讨论，例如 [Issue #926：mybatis-plus 的一种很别扭的用法](https://github.com/baomidou/mybatis-plus/issues/926)。该 issue 关注的是两套 CRUD 抽象之间的重复和使用方式问题，并没有提出本文设想的 CRUD 四接口拆分方案。本文引用它，只是说明围绕通用 CRUD 接口边界，社区长期存在不同理解。

本文不打算延续这类框架设计争论，而只讨论一个更具体的问题：在复杂业务系统中，是否有必要限制部分通用写 API 的直接使用。

但它并没有提出：

```text
QueryMapper
InsertMapper
UpdateMapper
DeleteMapper
```

这样的 CRUD 拆分方案。

因此不能把这个 issue 描述成“社区已经提出过四接口拆分”。

但这个讨论至少说明：

> MyBatis-Plus 通用 CRUD API 的职责组织方式，长期以来确实会引发不同使用者对接口边界的思考。

本文提出的能力拆分，是在自己的业务场景下进一步延伸出来的思考。

### 官方目前没有看到这类拆分计划

从当前官方源码和公开讨论来看，我没有看到 MyBatis-Plus 准备把 `BaseMapper` 按 CRUD 能力重新拆分的明确计划。

这其实也可以理解。

MyBatis-Plus 的一个重要价值就是：

```java
public interface UserMapper extends BaseMapper<User> {
}
```

然后快速获得完整 CRUD 能力。

如果修改基础 Mapper 继承体系，会涉及大量既有项目、第三方扩展和兼容性成本。

因此，对于自己的业务约束，更现实的方式不是等待框架改变，而是在项目内部增加一层能力边界。


## 从几个方案到 BizBaseMapper + BizSqlInjector

### 为什么不直接 Fork MyBatis-Plus

最直接的方式当然是修改官方源码，把 `BaseMapper` 中不希望使用的方法直接删除。

但为了两个方法 Fork 整个 MyBatis-Plus，代价明显过高：

- 要维护自己的 Maven 版本；
- 需要自己的制品发布；
- 官方升级时需要持续合并；
- Bug Fix 和安全修复需要自行同步；
- 时间越久，与官方版本漂移越严重。

所以很快就排除了这个方案。

### 为什么不用继承 BaseMapper 再 override

第二个很自然的想法是：

```java
public interface BizBaseMapper<T> extends BaseMapper<T> {
}
```

然后覆盖：

```java
@Override
default int insert(T entity) {
    throw new UnsupportedOperationException();
}

@Override
default int updateById(T entity) {
    throw new UnsupportedOperationException();
}
```

这样确实可以让调用在运行时失败。

但它不符合本文的真正目标。

我希望在 IDE 自动补全中，根本就不存在：

```text
insert
updateById
```

而不是直到运行时才发现这个方法被禁用。

### Java 接口继承只能增加能力，不能减少能力

一旦：

```java
BizBaseMapper<T> extends BaseMapper<T>
```

那么 `BaseMapper` 的 public 方法就已经成为 `BizBaseMapper` 类型能力的一部分。

子接口不能表达：

> 我继承 `BaseMapper`，但不要其中两个方法。

这一步最终决定了 `BizBaseMapper` 不能继续继承 `BaseMapper`。

### 为什么最终选择复制 BaseMapper 并做裁剪

最后的方案是：

```java
public interface BizBaseMapper<T> extends Mapper<T> {
}
```

然后基于当前 MyBatis-Plus `BaseMapper` 源码，将希望继续使用的方法复制到 `BizBaseMapper` 中。

但不再声明目标方法，并处理依赖这些方法的相关 default 方法。

最终形成：

```text
MyBatis-Plus BaseMapper
    = 框架能力全集

BizBaseMapper
    = 项目允许业务 Mapper 使用的能力集合
```

这不是最理想的接口结构，但在当前框架结构下，是一种比较小、透明、容易验证的项目级改动。

### BaseMapper 和 SQL Injector 是怎样配合工作的

仅仅复制 `BaseMapper` 方法声明还不够。

MyBatis-Plus 的通用 Mapper 方法之所以可以在没有 XML 的情况下执行，是因为 `BaseMapper` 负责定义 Java API，而 `DefaultSqlInjector` 会在启动阶段为这些通用方法注册对应的 `MappedStatement`。

可以简单理解为：

```text
BaseMapper
=
Java API

DefaultSqlInjector
=
这些 API 对应的通用 SQL 注册机制
```

官方源码：

- [BaseMapper.java](https://github.com/baomidou/mybatis-plus/blob/3.0/mybatis-plus-core/src/main/java/com/baomidou/mybatisplus/core/mapper/BaseMapper.java)
- [DefaultSqlInjector.java](https://github.com/baomidou/mybatis-plus/blob/3.0/mybatis-plus-core/src/main/java/com/baomidou/mybatisplus/core/injector/DefaultSqlInjector.java)

### BizBaseMapper 的职责

`BizBaseMapper` 的职责是：

> 决定业务 Mapper 在 Java 类型层面能够看到哪些通用能力。

示例工程中的源码位于 ZIP 内：

```text
src/main/java/.../base/BizBaseMapper.java
```

配套工程：

- [springboot2-sample-mybatisplus-bizbasemapper.zip](./springboot2-sample-mybatisplus-bizbasemapper.zip)

### BizSqlInjector 的职责

`BizSqlInjector` 负责与 `BizBaseMapper` 配合，继续使用 MyBatis-Plus SQL Injector 机制。

源码位于 ZIP 内：

```text
src/main/java/.../config/BizSqlInjector.java
```

它的目标不是重新实现 MyBatis-Plus 的 SQL 能力，而是尽可能复用官方现有实现。

### BaseMapper 和 BizBaseMapper 如何共存

这个方案没有删除官方 `BaseMapper`。

同一个项目中可以同时存在：

```java
public interface BookMapper extends BaseMapper<BookPO> {
}
```

以及：

```java
public interface BookBizMapper extends BizBaseMapper<BookPO> {
}
```

它们承担不同角色：

```text
BaseMapper
    官方完整能力
    可以继续用于历史代码或对照测试

BizBaseMapper
    项目约束后的能力
    用于新的业务 Mapper
```

因此可以渐进式迁移，不需要一次性重构全部旧代码。

---

## 使用 H2 完整验证这套方案

### 为什么选择独立的 H2 测试工程

因为 `BizBaseMapper` 位于所有业务 Mapper 的基础位置，仅仅验证几个常用查询能运行，并不足以说明方案可靠。

因此准备了一个简单工程：

- Spring Boot 2
- Java 8
- MyBatis-Plus
- H2
- JUnit

工程：

- [springboot2-sample-mybatisplus-bizbasemapper.zip](./springboot2-sample-mybatisplus-bizbasemapper.zip)

测试使用内存 H2，并通过 `schema.sql` 和 `data.sql` 建立固定初始数据。

### 对 BizBaseMapper 保留方法逐项测试

测试并没有只选择几个常用方法。

`BizBaseMapper` 当前保留下来的公开方法都逐项编写了对应测试，包括查询、Wrapper 更新、删除、分页、ResultHandler 等入口。

测试源码位于 ZIP 工程中的：

```text
src/test/java/.../mapper/BookBizMapperAllMethodsTest.java
```

### 方法覆盖率达到 100%

最终测试结果中：

```text
BizBaseMapper Method Coverage = 100%
```

也就是说：

> `BizBaseMapper` 当前保留下来的公开方法都有实际测试调用。

测试不仅验证 Java 方法能够进入，还实际连接 H2 执行对应 SQL。

### 使用 BaseMapper 作为对照组

示例工程还保留：

```java
BookMapper extends BaseMapper<BookPO>
```

作为官方 Mapper 对照组。

对照测试验证：

```java
selectList(...)
insert(...)
```

仍然正常运行。

测试源码：

```text
src/test/java/.../mapper/BookMapperTest.java
```

这样可以确认：

> 自定义 `BizBaseMapper / BizSqlInjector` 没有破坏官方 `BaseMapper` 的正常使用。

### 验证 insert 和 updateById 不再暴露

除了功能测试，还增加了接口约束测试。

目的不是验证调用以后抛异常，而是验证：

```text
BizBaseMapper 类型本身就不暴露目标 API
```

这和：

```text
extends BaseMapper
+
override 后抛异常
```

有本质区别。

### 为什么没有继续追求所有特殊分支 100% 覆盖

方法覆盖已经达到 100%，但没有为了覆盖率数字继续构造所有 MyBatis-Plus 特殊组合，例如逻辑删除 + 自动填充等场景。

本文真正需要验证的是：

> 从 `BaseMapper` 裁剪目标写方法以后，项目实际保留的 Mapper API 是否仍然能够正常工作。

在全部保留方法都得到真实 H2 验证以后，为了让 Branch Coverage 强行达到 100% 而增加大量与当前目标无关的测试模型，收益已经比较有限。

---

## 最终形成的业务写操作原则

### 查询能力可以继续通用化

本文并不希望把所有 Mapper 方法重新手写。

例如：

```java
selectById(...)
selectList(...)
selectCount(...)
selectPage(...)
```

这些通用查询能力仍然非常适合继续使用。

Wrapper、LambdaWrapper、分页和 MyBatis-Plus 其他成熟能力也全部保留。

### 新增和修改应该具有明确业务语义

不再推荐：

```java
userMapper.insert(user);
```

而是：

```java
userMapper.saveUser(...);
```

不再推荐：

```java
user.setStatus(newStatus);
userMapper.updateById(user);
```

而是：

```java
userMapper.updateUserStatus(
    userId,
    expectedStatus,
    newStatus
);
```

对于订单：

```java
orderMapper.markOrderPaid(...);
```

对于退款：

```java
orderMapper.markRefundSuccess(...);
```

对于审核：

```java
auditMapper.updateAuditResult(...);
```

### 写操作应该明确字段和前置条件

一个业务 UPDATE 最好能够回答：

```text
修改什么？
在什么条件下允许修改？
```

例如：

```sql
UPDATE t_order
SET status = 'SUCCESS',
    success_time = ?
WHERE id = ?
  AND status = 'PROCESSING'
```

相比 `updateById(entity)`，这种表达暴露了更多真正有价值的业务信息。

### 业务方法名本身就是代码索引

```java
markOrderPaid(...)
markRefundSuccess(...)
updateUserMobile(...)
```

不仅是 API，也天然成为 Find Usages、全文搜索、调用链分析和线上问题定位时的业务索引。

### ORM CRUD API 应该尽量收敛在基础设施层

JPA 的 `save()` 与 MyBatis-Plus 的 `insert()`、`updateById()` 语义并不完全一致。

如果业务代码直接大量依赖 ORM API，框架迁移时，上层业务也容易一起受到影响。

而：

```java
saveUser(...)
markOrderPaid(...)
updateAuditResult(...)
```

才是相对稳定的业务语义。

### 通用方法少，不代表系统更简单

使用：

```java
updateById(entity)
```

Mapper 方法看起来很少。

使用：

```java
updateUserMobile(...)
updateUserStatus(...)
markOrderPaid(...)
markRefundSuccess(...)
```

Mapper 方法会变多。

但方法数量并不是衡量系统复杂度的唯一标准。

一个 `updateById(entity)` 可能隐藏几十种不同业务动作，而几十个明确命名的业务方法，反而把这些复杂度显式表达出来。

---

## 总结

MyBatis-Plus 的 `BaseMapper` 是非常实用的通用 CRUD 抽象。

本文没有尝试证明：

```text
BaseMapper 不好
```

也没有认为：

```text
insert / updateById 不应该存在
```

它们非常适合 MyBatis-Plus 本身追求的开发效率和通用场景。

本文真正讨论的是：

> 一个长期维护、业务状态复杂的系统，是否应该把框架提供的所有通用写能力，原封不动地暴露给业务代码。

最终我的答案是：

```text
不一定。
```

因此，在官方 `BaseMapper` 之外增加了：

```text
BizBaseMapper + BizSqlInjector
```

`BaseMapper` 继续作为 MyBatis-Plus 的完整能力集合存在。

而 `BizBaseMapper` 表达：

> **当前项目允许业务 Mapper 直接使用的通用能力边界。**

最终希望形成的习惯是：

```text
查询
    可以通用化

写入
    尽量业务化
```

尤其对于 UPDATE：

> 业务更新的核心通常不是“根据 ID 更新一行数据”，而是“在明确的业务前置条件下，修改明确的字段”。

这也是我最终不再允许新的业务代码直接使用 `insert(T)` 和 `updateById(T)` 的原因。
