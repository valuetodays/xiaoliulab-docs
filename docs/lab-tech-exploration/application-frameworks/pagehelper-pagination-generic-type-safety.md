---
title: "PageHelper 两种分页写法对比：一次泛型失真的排查与源码分析"
description: "记录一次 Spring Boot 2.2.10.RELEASE + MyBatis 项目中 PageHelper 两种分页写法的对比与排查。通过 doSelectPageInfo、ISelect、Page、PageInfo 以及 MyBatis 查询结果的关系，解释为什么第一种写法会出现泛型失真，以及为什么显式接收 List<T> 再构造 PageInfo 更容易维护。"
head:
  - - meta
    - name: keywords
      content: PageHelper 1.3.0,PageHelper,MyBatis,Spring Boot 2.2.10,分页,PageInfo,泛型,ISelect,doSelectPageInfo,Java 8
---

# PageHelper 两种分页写法对比：一次泛型失真的排查与源码分析

## 一、问题背景：泛型写错了，接口居然还能正常返回

在一个：

```text
Java 8
Spring Boot 2.2.10.RELEASE
MyBatis
pagehelper-spring-boot-starter 1.3.0
```

项目中，对两个分页接口做对比时，发现了一个比较反直觉的现象。

第一种写法声明返回：

```java
PageInfo<DemoPageQueryVo>
```

但实际 SQL 查询出来的对象并不是：

```text
DemoPageQueryVo
```

甚至把返回值改成：

```java
PageInfo<Integer>
```

接口仍然能够返回完整的对象 JSON。

也就是说：

> Java 代码里的泛型看起来写成什么，对实际返回的数据几乎没有影响。

而另一种更传统的写法：

```java
List<DemoPageQueryResp> list = queryListFromDb(req);
return new PageInfo<>(list);
```

表现却完全符合直觉。

于是问题变成：

> 为什么同样使用 PageHelper，两种写法在泛型语义上会有这么大的差异？

## 二、复现环境


本次复现使用：

```text
Java 8
Spring Boot 2.2.10.RELEASE
MyBatis
pagehelper-spring-boot-starter 1.3.0
```

Maven 依赖：

```xml
<dependency>
    <groupId>com.github.pagehelper</groupId>
    <artifactId>pagehelper-spring-boot-starter</artifactId>
    <version>1.3.0</version>
</dependency>
```

本文分析基于上述版本环境下的实际行为与源码。

完整示例代码如下：

<a href="https://cdn.jsdelivr.net/gh/valuetodays/supreme-octo-palm-tree@main/attachment/springboot2-mybatis-startpage2025-12-19.zip">代码</a>


测试接口：

```text
/demo/pageQuery1
/demo/pageQuery2
```

请求示例：

```bash
curl -X POST \
  -H 'content-type: application/json;charset=UTF-8' \
  'http://localhost:8000/demo/pageQuery1' \
  -d '{"pageNum":1,"pageSize":2}'
```

以及：

```bash
curl -X POST \
  -H 'content-type: application/json;charset=UTF-8' \
  'http://localhost:8000/demo/pageQuery2' \
  -d '{"pageNum":1,"pageSize":2}'
```

这里需要说明：

> 本文重点分析的是这两种 API 写法与泛型行为，不依赖某个特定业务 SQL。

## 三、第一种写法：`doSelectPageInfo`

第一种分页代码如下：

```java
public PageInfo<DemoPageQueryVo> pageQuery1(DemoPageQueryReq req) {
    PageInfo<DemoPageQueryVo> pageInfo =
        PageHelper.startPage(req.getPageNum(), req.getPageSize())
            .doSelectPageInfo(() -> {
                queryListFromDb(req);
            });

    return pageInfo;
}
```

这里从代码表面上看，返回值非常明确：

```java
PageInfo<DemoPageQueryVo>
```

似乎 PageHelper 最终应该得到：

```text
DemoPageQueryVo
```

类型的数据。

但实际并不是这样。

## 四、第一种异常现象：`DemoPageQueryVo` 只有 id，JSON 却还有很多字段

例如：

```java
DemoPageQueryVo
```

只有：

```text
id
```

一个字段。

但接口实际返回 JSON 中却包含 SQL 查询出来的多个字段。

这说明：

> `PageInfo<DemoPageQueryVo>` 这个泛型声明并没有把查询结果转换成 `DemoPageQueryVo`。

进一步测试，把返回类型故意写成：

```java
PageInfo<Integer>
```

接口依然能够返回原来的完整对象内容。

这个现象说明：

> 这里的泛型并没有参与运行时查询结果对象的构造。

它更多是在编译期告诉 Java：

```text
“把这个 PageInfo 当成装着某种类型来使用”
```

但真实对象到底是什么，仍然取决于 MyBatis 查询结果。

## 五、第二种写法：显式接收查询结果

第二种代码如下：

```java
public PageInfo<DemoPageQueryResp> pageQuery2(DemoPageQueryReq req) {
    PageHelper.startPage(req.getPageNum(), req.getPageSize());

    List<DemoPageQueryResp> list = queryListFromDb(req);

    return new PageInfo<>(list);
}
```

这段代码的类型关系要直观得多：

```text
Mapper 查询
↓
List<DemoPageQueryResp>
↓
new PageInfo<>(list)
↓
PageInfo<DemoPageQueryResp>
```

如果：

```java
queryListFromDb(req)
```

返回的是：

```java
List<DemoPageQueryResp>
```

那么最终：

```java
new PageInfo<>(list)
```

的泛型也自然是：

```text
DemoPageQueryResp
```

代码阅读者不需要知道 PageHelper 内部还有什么隐式行为，就能直接判断：

> SQL 结果是什么类型，分页结果就是什么类型。

## 六、为什么 `doSelectPageInfo` 的泛型可以“随便写”

问题的关键可以从本次 `pagehelper-spring-boot-starter 1.3.0` 对应实现中的 `Page#doSelectPageInfo` 看出来。

核心逻辑类似：

```java
public <E> PageInfo<E> doSelectPageInfo(ISelect select) {
    select.doSelect();
    return (PageInfo<E>) this.toPageInfo();
}
```

这里有两个非常关键的细节。

第一个是：

```java
ISelect
```

第二个是：

```java
(PageInfo<E>)
```

先看 `ISelect`。

它执行查询的入口本身不通过返回值把查询结果类型传给 `doSelectPageInfo`。

也就是说，调用：

```java
.doSelectPageInfo(() -> {
    queryListFromDb(req);
})
```

时，`doSelectPageInfo` 并没有从 lambda 的返回值中获得：

```text
DemoPageQueryResp
```

这种类型信息。

查询确实执行了，但实际查询结果是通过 PageHelper 分页机制进入当前 `Page` 对象，而不是靠这个 lambda 的返回值传回来。

## 七、真正的查询结果类型仍然由 MyBatis 决定

假设 Mapper XML 中配置的是：

```xml
<select id="queryListFromDb"
        resultType="com.xxx.DemoPageQueryResp">
```

那么 MyBatis 在执行 SQL 时，真正创建的元素对象就是：

```text
DemoPageQueryResp
```

PageHelper 不会因为调用处写了：

```java
PageInfo<DemoPageQueryVo>
```

就自动把：

```text
DemoPageQueryResp
```

转换成：

```text
DemoPageQueryVo
```

同样也不会因为写成：

```java
PageInfo<Integer>
```

就把数据库结果转换成：

```text
Integer
```

真实数据对象仍然由：

```text
Mapper 方法
resultType / resultMap
MyBatis 映射
```

决定。

所以第一种写法真正发生的是：

```text
Java 声明：
PageInfo<DemoPageQueryVo>

运行时内容：
DemoPageQueryResp
```

泛型声明和实际元素类型出现了偏离。

## 八、PageHelper 真正做了什么：分页查询结果本身就是 `Page`

理解第二种写法时，还有一个非常关键的事实。

调用：

```java
PageHelper.startPage(pageNum, pageSize);
```

后，紧跟着执行的 MyBatis 查询会被 PageHelper 拦截。

正常代码看起来是：

```java
List<DemoPageQueryResp> list = queryListFromDb(req);
```

但在分页场景下，这个 `list` 的实际运行时类型通常是：

```text
com.github.pagehelper.Page
```

而 `Page<E>` 本身继承自：

```java
ArrayList<E>
```

因此它既可以作为：

```java
List<DemoPageQueryResp>
```

使用，又额外保存了：

```text
pageNum
pageSize
total
pages
startRow
endRow
```

等分页信息。

这就是为什么下面的代码可以正常拿到总记录数：

```java
PageHelper.startPage(req.getPageNum(), req.getPageSize());

List<DemoPageQueryResp> list = queryListFromDb(req);

PageInfo<DemoPageQueryResp> pageInfo = new PageInfo<>(list);
```

因为这里传给 `PageInfo` 的并不是一个完全普通的 `ArrayList`，而是 PageHelper 返回的 `Page`。

## 九、`new PageInfo<>(list)` 为什么还能保留总数和页码

第一眼看第二种写法时，还有一个疑问：

```java
new PageInfo<>(list)
```

只是把一个 `List` 传进去，它怎么知道：

```text
总记录数
当前页
每页条数
总页数
```

这些信息？

关键仍然在于：

```text
list 的运行时类型是 Page
```

PageHelper 官方用法本身就支持：

```java
PageHelper.startPage(1, 10);

List<User> list = userMapper.selectAll();

PageInfo<User> pageInfo = new PageInfo<>(list);
```

`PageInfo` 在构造时能够识别这个列表实际是一个 `Page`，并读取其中已经保存的分页信息。

因此第二种写法并不是：

> 查询完成后重新计算了一次分页信息。

而是：

> 显式拿到 PageHelper 已经生成的分页结果，再把它包装成 PageInfo。

## 十、这里并不是 PageHelper “不知道查询结果”

原文最初曾把第一种现象概括为：

> PageHelper 不知道 select 出来的是什么类型。

这句话容易产生一点误解。

更准确的说法应该是：

> `doSelectPageInfo` 的泛型参数 `E` 并不是从 `ISelect` 的返回类型推导出来的。

PageHelper 当然拿到了真实查询结果，否则也无法生成：

```text
Page
PageInfo
```

问题在于：

```text
真实查询结果中的对象类型
```

和：

```text
doSelectPageInfo 调用点声明的泛型 E
```

之间没有编译器可以验证的强类型关联。

于是下面这种代码在语法上就可能成立：

```java
PageInfo<Integer> pageInfo =
    PageHelper.startPage(1, 10)
        .doSelectPageInfo(() -> queryListFromDb(req));
```

但运行时里面装着的仍可能是：

```text
DemoPageQueryResp
```

真正的问题因此不是“PageHelper 没拿到结果”，而是：

> API 的泛型声明与实际查询元素类型之间缺少类型约束。

## 十一、为什么这种写法容易误导维护者

假设维护人员看到：

```java
public PageInfo<DemoPageQueryVo> pageQuery1(...)
```

第一反应通常是：

> 这个方法返回的列表元素就是 `DemoPageQueryVo`。

这也是 Java 泛型代码通常给人的语义保证。

但在这里，这个推断并不可靠。

真正决定元素类型的可能是另一个地方：

```text
Mapper 方法签名
Mapper XML
resultType
resultMap
```

于是阅读一个分页方法时，还必须继续向下追：

```text
这个 ISelect 到底执行了什么 SQL？
Mapper 真正返回什么？
PageHelper 里面实际塞进去的对象是什么？
```

这就破坏了方法签名原本应该提供的类型信息。

从维护角度看，这才是第一种写法最大的问题。

## 十二、为什么更推荐显式 `List<T>` 的写法

第二种方式：

```java
PageHelper.startPage(req.getPageNum(), req.getPageSize());

List<DemoPageQueryResp> list = queryListFromDb(req);

return new PageInfo<>(list);
```

虽然比链式调用多了一行，但它把类型关系直接摆在代码里：

```text
queryListFromDb
↓
List<DemoPageQueryResp>
↓
PageInfo<DemoPageQueryResp>
```

这有几个明显好处。

### 12.1 Mapper 返回类型直接可见

代码里明确出现：

```java
List<DemoPageQueryResp>
```

维护人员不需要猜。

### 12.2 泛型更容易由编译器约束

如果方法真正要返回：

```java
PageInfo<DemoPageQueryResp>
```

那么整个类型链条是一致的。

### 12.3 数据来源更清楚

分页只是：

```text
对这次 Mapper 查询进行分页
```

而不是把查询动作隐藏在：

```java
doSelectPageInfo(() -> ...)
```

里面。

### 12.4 更符合普通 Java 代码阅读习惯

先获得数据：

```java
List<T>
```

再包装：

```java
PageInfo<T>
```

没有额外的泛型错觉。

## 十三、两种写法真正的区别

可以把两种方式简化成下面的对比。

第一种：

```java
PageInfo<DemoPageQueryVo> pageInfo =
    PageHelper.startPage(...)
        .doSelectPageInfo(() -> queryListFromDb(req));
```

类型关系更像：

```text
调用方自己声明 E
↓
ISelect 执行查询
↓
PageHelper 保存真实查询结果
↓
强制转换成 PageInfo<E>
```

第二种：

```java
PageHelper.startPage(...);

List<DemoPageQueryResp> list = queryListFromDb(req);

return new PageInfo<>(list);
```

类型关系是：

```text
Mapper 返回 List<DemoPageQueryResp>
↓
分页时实际对象为 Page<DemoPageQueryResp>
↓
PageInfo<DemoPageQueryResp>
```

第二种更容易让：

```text
方法签名
Mapper 类型
实际数据
```

保持一致。

## 十四、这次源码排查修正了一个认知

最初理解 PageHelper 时，容易把它想象成：

```text
PageHelper 执行查询
↓
拿到普通 List
↓
再包装成 PageInfo
```

实际机制并不是这么简单。

更准确的理解是：

```text
PageHelper.startPage
↓
保存本次分页上下文
↓
MyBatis 执行下一次查询
↓
PageHelper 拦截查询
↓
分页结果进入 Page
↓
Page 本身既是 List，又保存分页信息
↓
PageInfo 再从 Page 提取分页元数据
```

而：

```java
doSelectPageInfo(...)
```

只是把：

```text
执行查询
+
把当前 Page 转成 PageInfo
```

组合到了一个 API 里。

真正需要警惕的不是 PageHelper 的分页能力，而是：

> `doSelectPageInfo` 这种 `ISelect + 泛型强转` 的 API 形式，无法让编译器验证调用方写下的 `E` 是否就是 Mapper 真正返回的元素类型。

## 十五、统一项目中的分页写法

如果只是讨论：

```text
能不能分页
```

两种方式都能工作。

但旧项目长期维护时，更重要的是：

```text
代码签名表达的类型
```

和：

```text
实际运行数据类型
```

是否保持一致。

因此在项目中更推荐统一使用：

```java
PageHelper.startPage(req.getPageNum(), req.getPageSize());

List<DemoPageQueryResp> list = queryListFromDb(req);

return new PageInfo<>(list);
```

并保持：

```text
Mapper 返回类型
=
PageInfo<T> 的 T
=
接口真正返回的数据类型
```

这样一个分页方法本身就能够把类型关系说明白。

而不是依赖维护人员了解：

```text
ISelect
Page
ThreadLocal
拦截器
未经检查的泛型转换
```

之后，才能判断方法到底返回什么。

## 十六、一句话规范

这次排查最终可以收敛成一条项目规范：

> **使用 PageHelper 时，优先显式接收 Mapper 返回的 `List<T>`，再构造 `PageInfo<T>`；让 `T` 来自真实查询结果，而不是在 `doSelectPageInfo` 调用处人为指定。**

这样做并不是因为：

```text
doSelectPageInfo 不能分页
```

而是为了让：

> **方法签名、Mapper 返回类型和运行时数据保持一致，让分页代码所见即所得。**

## 参考资料

- [PageHelper 官方项目：Mybatis-PageHelper](https://github.com/pagehelper-org/Mybatis-PageHelper)
- [PageHelper 官方使用文档](https://github.com/pagehelper-org/Mybatis-PageHelper/blob/master/wikis/zh/HowToUse.md)
