---
title: "Quarkus 容器 RSS 持续增长：一次 JVM Heap 正常但 Native Memory 膨胀的问题排查"
description: "记录一次 Quarkus + JDK 21 服务在 Docker 中运行时 RSS 持续增长的问题排查。Heap、线程和 DirectByteBuffer 均未出现明显异常，NMT 与 docker stats 之间存在显著差额，最终通过 MALLOC_ARENA_MAX=2 的正向与反向实验，将问题高度收敛到 glibc malloc arena / native allocator 行为。"
date: 2026-08-28
head:
  - - meta
    - name: keywords
      content: Quarkus,JDK 21,Docker,RSS,Native Memory,glibc,malloc arena,MALLOC_ARENA_MAX,NMT,容器内存
---

# Quarkus 容器 RSS 持续增长：一次 JVM Heap 正常但 Native Memory 膨胀的问题排查

## 一、问题不是 Heap，而是容器 RSS

生产环境中，一个基于 Quarkus + JDK 21 的服务出现了一个比较反直觉的内存问题。

服务特征如下：

- 运行在 Docker 容器中
- JVM Heap 限制为 128MB
- 启动后容器内存大约 300MB
- 运行 1～2 天后，容器 RSS 会增长到 600MB～1.2GB
- 没有 OOM
- 没有明显 Full GC 异常
- 服务功能和 QPS 没有显著变化

最开始看到这个现象时，很容易先怀疑：

> 是不是 Java Heap 泄漏了？

但如果 Heap 最大值只有 128MB，而容器已经占到 600MB 甚至 1GB 以上，那么问题显然不能只从 Heap 解释。

真正需要回答的是：

> 多出来的这些内存到底在哪里？

## 二、先从 Docker 层确认现象

先通过：

```bash
docker stats
```

持续观察容器内存。

现象比较稳定：

```text
服务刚启动
≈ 300MB

运行时间增加
↓
RSS 持续增长

运行 1～2 天
≈ 600MB～1.2GB

重启容器
↓
立即回到初始水平
```

这个现象至少说明：

> 内存增长和进程运行时间相关，而不是容器一启动就固定占用这么多。

但 `docker stats` 看到的是容器整体内存，不能直接告诉我们是哪一部分在增长。

所以接下来需要从 JVM 内部逐层排查。

## 三、先看 Heap：没有发现明显对象泄漏迹象

首先检查 JVM Heap：

```bash
jcmd 1 GC.heap_info
```

观察结果：

- Heap committed 始终在预期范围
- Old 区使用率相对稳定
- 没有持续抬升
- 没有明显 Full GC 异常

因此，当时可以得到的结论不是：

> 已经完全证明不存在 Java 对象泄漏。

更准确的说法是：

> 没有观察到典型的 Java Heap 持续增长特征，Heap 不是当前最可疑的方向。

如果问题真的是 Java 对象不断泄漏，通常会更容易看到：

```text
Heap 使用量持续抬升
↓
Old 区占用越来越高
↓
GC 压力越来越明显
```

但现场并没有这种表现。

## 四、再看线程：数量稳定，栈内存不像主要来源

继续检查线程：

```bash
jcmd 1 Thread.print
```

以及：

```bash
ls /proc/1/task | wc -l
```

线程数长期稳定在大约：

```text
50～60
```

同时单线程栈已经限制为：

```text
512KB
```

如果粗略估算：

```text
60 × 512KB ≈ 30MB
```

即使考虑一些额外开销，也不足以解释数百 MB 的持续增长。

所以线程和栈内存也不像主要来源。

## 五、DirectByteBuffer 也没有明显累积

接着查看 DirectByteBuffer：

```bash
jcmd 1 GC.class_histogram | grep DirectByteBuffer
```

没有观察到 `DirectByteBuffer` 对象数量明显增长。

这一步能说明的是：

> 没有看到 DirectByteBuffer Java 对象明显累积，因此 Direct Buffer 不是当时最优先的怀疑方向。

但这里不能把结论写成：

> 已经排除了所有直接内存问题。

因为 `GC.class_histogram` 主要看到的是 Java 对象视角，并不能覆盖所有 native allocation。

到这里为止，几个最常见的 JVM 内部方向都没有解释 RSS 的持续上涨。

这时问题开始变得有意思。

## 六、NMT 给出了关键线索：JVM 统计和 RSS 对不上

为了进一步观察 JVM Native Memory，启用了：

```bash
-XX:NativeMemoryTracking=summary
```

然后执行：

```bash
jcmd 1 VM.native_memory summary
```

结果出现了一个非常关键的差异：

```text
JVM NMT committed
≈ 300MB～350MB

docker stats / RSS
≈ 600MB～1.2GB
```

两者之间存在数百 MB 的差额。

这说明：

> 至少有一部分内存没有体现在 JVM NMT 的统计里。

这一步是整个排查过程的转折点。

因为继续只盯着：

```text
Heap
Metaspace
Thread
DirectBuffer
CodeCache
```

已经无法解释这个差额。

排查方向需要从：

```text
JVM 内部
```

进一步扩展到：

```text
JVM 之外的 native allocator / libc
```

## 七、问题开始指向 glibc malloc arena

Quarkus 服务底层会使用 Vert.x、Netty 等组件。

这类多线程 I/O 服务除了 JVM 自己管理的内存之外，也会经过系统 native allocator 进行内存申请和释放。

Linux 上常见的 glibc malloc 使用 arena 机制来降低多线程 malloc 竞争。

可以简单理解为：

```text
多个线程
↓
可能使用不同 malloc arena
↓
减少 malloc 锁竞争
↓
提升并发分配效率
```

但它带来的另一个问题是：

> arena 中释放后的内存不一定会及时归还给操作系统。

因此可能出现：

```text
应用逻辑已经不再使用某些 native 内存
↓
glibc allocator 内部仍然保留这些页
↓
进程 RSS 长时间维持在高位
```

在容器环境中，这种表现尤其明显。

因为容器关注的是：

```text
进程实际占用的内存
```

而不是：

```text
JVM Heap 当前用了多少
```

于是就可能出现：

```text
Heap 很稳定
NMT 看起来也没有明显增长
但 RSS 一直涨
```

这和现场现象高度吻合。

不过到这里仍然只是：

> 强烈怀疑 glibc allocator / malloc arena。

还需要实验验证。

## 八、第一次实验：限制 malloc arena 数量

在容器环境中加入：

```bash
MALLOC_ARENA_MAX=2
```

然后重新运行服务。

这个变量的作用是限制 glibc 可创建的 malloc arena 数量。

继续观察容器 RSS。

修复前：

```text
启动 RSS
≈ 300MB

运行 24 小时
≈ 600MB

运行 48 小时
≈ 700MB+
```

加入：

```bash
MALLOC_ARENA_MAX=2
```

之后：

```text
启动 RSS
≈ 250MB～300MB

运行 48 小时
≈ 300MB～350MB
```

同时：

- Java Heap 没有明显变化
- Metaspace 没有明显变化
- 线程数没有明显变化
- 服务功能正常

RSS 从原来的持续增长，变成了相对稳定。

这个结果已经很有指向性。

但仅仅一次“加配置后好了”，还不够让我完全放心。

因为也可能存在：

- 当时流量不同
- 运行路径不同
- 发布版本恰好有其他变化
- 某个偶发条件没有再次出现

所以继续做了一个反向实验。

## 九、反向验证：故意让 MALLOC_ARENA_MAX 失效

为了验证 RSS 稳定是否真的和：

```text
MALLOC_ARENA_MAX=2
```

有关，故意把环境变量写错：

```bash
MALLOC_ARENA_MAX1=2
```

这样做的目的不是测试拼写错误，而是：

> 人为让 `MALLOC_ARENA_MAX=2` 这项配置失效，相当于关闭这个控制变量。

然后重新运行服务。

结果：

```text
运行约 1 天
↓
RSS 再次增长到约 600MB
```

也就是说：

```text
MALLOC_ARENA_MAX=2 生效
↓
RSS 稳定

故意让 MALLOC_ARENA_MAX 失效
↓
RSS 再次增长
```

这次反向实验把证据强度又往前推进了一步。

随后恢复正确配置：

```bash
MALLOC_ARENA_MAX=2
```

RSS 再次保持稳定。

整个实验形成了一个比较完整的工程闭环。

## 十、现有证据到底能证明到什么程度

到这里，最容易写成一句：

> 根因就是 glibc malloc arena。

但如果作为公开技术复盘，我更愿意把证据边界说清楚。

目前已经确认的事实是：

1. 容器 RSS 会随运行时间持续增长
2. JVM Heap 没有同步增长
3. 线程数量相对稳定
4. DirectByteBuffer 对象没有明显累积
5. NMT 统计显著低于进程 RSS
6. 加入 `MALLOC_ARENA_MAX=2` 后 RSS 明显收敛
7. 故意让该配置失效后，RSS 再次增长
8. 恢复配置后，RSS 再次稳定

这些证据高度支持：

> **RSS 增长主要来自 JVM NMT 统计之外的 native allocator 行为，并且和 glibc malloc arena 的数量高度相关。**

但如果要做更严格的 allocator 层直接证明，还可以继续使用：

- `/proc/<pid>/smaps`
- `pmap`
- `malloc_info`
- jemalloc profiling
- 更细粒度的 native allocation tracing

本文并没有做到这一步。

所以更准确的结论是：

> **现有工程证据高度指向 glibc malloc arena / native allocator 的内存保留与碎片化，而不是 JVM Heap 本身。**

## 十一、为什么 NMT 也解释不了全部 RSS

这次问题还有一个很容易产生误解的点。

看到：

```bash
jcmd 1 VM.native_memory summary
```

很多人会直觉认为：

> 这就是 Java 进程全部 native memory。

实际上并不是。

NMT 主要统计 HotSpot 自己跟踪的 native memory 类别。

它能帮助观察：

- Java Heap reservation / commitment
- Class
- Thread
- Code
- GC
- Compiler
- Internal
- Symbol
- Native Memory Tracking 本身
- 其他 HotSpot 管理的 native 区域

但：

> JVM 之外通过 libc allocator 等路径申请的所有内存，并不一定都完整体现在 NMT 中。

所以：

```text
NMT committed
<
RSS
```

本身并不反常。

真正值得关注的是：

> 差额是否异常大，并且是否随运行时间持续扩大。

本次就是因为这个差额越来越明显，才把排查方向从 JVM 内部推进到了 glibc allocator。

## 十二、RSS、Heap 和 NMT 不是一个概念

这次问题里至少同时存在三个容易混淆的数字。

### 12.1 Java Heap

由：

```text
-Xms
-Xmx
```

等参数控制。

它只是 JVM 内存的一部分。

### 12.2 NMT

通过：

```bash
jcmd 1 VM.native_memory summary
```

查看。

它反映 HotSpot 能够跟踪到的一部分 native memory。

### 12.3 RSS

通过：

```text
docker stats
/proc
ps
```

等看到。

它更接近：

> 当前进程实际驻留在物理内存中的页。

所以：

```text
RSS
≠
Heap
```

同时：

```text
RSS
≠
NMT committed
```

如果只看 Heap 很容易误判：

```text
Heap 才 128MB，Java 不可能占 1GB
```

但实际一个 Java 进程的内存结构远不止 Heap。

## 十三、最终采取的方案

当前服务保留：

```bash
MALLOC_ARENA_MAX=2
```

用来限制 glibc malloc arena 数量。

同时保留：

```bash
-XX:NativeMemoryTracking=summary
```

方便以后出现类似问题时快速区分：

```text
JVM 内部增长
```

还是：

```text
JVM 之外的 native memory / RSS 增长
```

这里不把：

```text
MALLOC_ARENA_MAX=2
```

作为所有 Java 容器的无条件固定值。

因为 arena 数量限制本质上是在：

```text
内存占用
```

和：

```text
多线程 malloc 并发性能
```

之间做取舍。

更稳妥的做法是：

> 对存在类似 RSS 膨胀现象的服务进行验证后再决定具体值。

## 十四、这次排查真正留下来的几个经验

### 14.1 容器内存异常，不要只看 Heap

Java 服务跑在容器里以后，真正受容器限制的是：

```text
整个进程 / 容器内存
```

而不是：

```text
Java Heap
```

所以：

```text
-Xmx=128m
```

绝不意味着：

```text
容器最多只会使用 128MB
```

### 14.2 Heap 稳定，只能说明问题不明显发生在 Heap

这次一开始很容易得到一个过强结论：

> Heap 稳定，所以没有内存泄漏。

更准确应该是：

> 没有观察到典型的 Java Heap 对象持续累积。

native allocator、线程栈、Direct Memory、mmap、libc 等都还需要继续看。

### 14.3 NMT 是分界线，不是终点

NMT 很有价值。

因为它可以帮我们判断：

```text
RSS 增长
```

到底能不能在 JVM 自己的内存统计中找到对应变化。

但如果：

```text
RSS >> NMT
```

就应该意识到：

> 问题可能已经超出 HotSpot 自己能完整解释的范围。

### 14.4 正向实验最好再做一次反向验证

这次最有价值的不是：

```text
加 MALLOC_ARENA_MAX=2 后好了
```

而是：

```text
加上
→ 稳定

故意关闭
→ 再次增长

恢复
→ 再次稳定
```

这种实验比“改完观察一次”更有说服力。

### 14.5 JVM 问题有时根本不在 JVM 里

服务是 Java 写的，并不意味着所有内存问题都应该通过 JVM 参数解决。

运行时还包括：

```text
JVM
↓
native libraries
↓
libc allocator
↓
Linux kernel
↓
Docker / cgroup
```

任何一层都可能影响最终看到的 RSS。

## 十五、最终回看

如果只保留最终答案，这个问题可以缩成：

> Quarkus 容器 RSS 持续增长，设置 `MALLOC_ARENA_MAX=2` 后恢复稳定。

但真正值得留下来的，是问题是怎么从 JVM 一层层走出去的：

```text
容器 RSS 持续增长
        ↓
先怀疑 Java Heap
        ↓
Heap 使用稳定
        ↓
检查线程
        ↓
线程数量稳定
        ↓
检查 DirectByteBuffer
        ↓
没有明显累积
        ↓
启用 NMT
        ↓
发现 NMT committed 明显低于 RSS
        ↓
意识到大量内存可能不在 JVM 统计范围内
        ↓
排查方向转向 native allocator / glibc
        ↓
加入 MALLOC_ARENA_MAX=2
        ↓
RSS 明显稳定
        ↓
故意让该配置失效
        ↓
RSS 再次增长
        ↓
恢复配置
        ↓
RSS 再次稳定
```

最终得到的不只是一个环境变量。

更重要的是形成了一个判断思路：

> **当 Java 容器 RSS 持续上涨，而 Heap、线程和 NMT 都解释不了时，排查范围就不应该继续困在 JVM 内部。**
