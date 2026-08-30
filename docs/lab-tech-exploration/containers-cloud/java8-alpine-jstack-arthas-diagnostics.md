---
title: Java 8 Alpine 容器中 jstack 与 Arthas 失败：一次 JVM 诊断能力补齐
description: 记录 Java 8 服务运行在 Alpine 镜像时，jps 可以看到进程但 jstack 与 Arthas 无法正常工作，最终通过切换 Debian JDK 镜像恢复 JVM 诊断能力的过程。
---

# Java 8 Alpine 容器中 jstack 与 Arthas 失败：一次 JVM 诊断能力补齐

这个问题最初并不是因为 Alpine 跑 Java 业务有异常。事实上，后续签名复现实验里 Alpine + `en_US.UTF-8` 的接口验签是成功的；这里遇到的是另一条独立问题：JVM 诊断能力不可用。

真正的触发点是一次 CPU 问题排查：服务运行正常，但需要进一步查看 JVM 线程时，才发现容器里的诊断能力并没有想象中完整。

## 背景：Java 应用 CPU 过高

当时一个 Java 应用 CPU 占用较高，需要先查看线程信息。

服务使用的基础镜像是：

```dockerfile
FROM openjdk:8-jdk-alpine

ENV LANG="en_US.UTF-8"
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app
COPY /target/user-app.jar /app/user-app.jar
EXPOSE 8003
ENTRYPOINT ["java","-jar","/app/user-app.jar"]
```

既然镜像名称里已经是 `jdk`，第一反应自然是进入容器，用 `jps` 找进程，再用 `jstack` 看线程栈。

## jps 正常，jstack 却失败

进入容器后：

```bash
/app # jps
1 user-app.jar
170 Jps
```

`jps` 能够正常识别 PID 为 1 的 Java 进程。

但继续执行：

```bash
/app # jstack 1 > a.log
1: Unable to get pid of LinuxThreads manager thread
```

这时问题已经不是“镜像里没装 JDK 工具”。

`jps`、`jstack` 都存在，Java 进程也能被 `jps` 看见，但 `jstack` 无法取得需要的线程信息。

## 再用 Arthas 验证

为了排除只是 `jstack` 命令自身的问题，又尝试使用 Arthas attach 到同一个 Java 进程。

Arthas 同样无法正常 attach，并出现相同方向的错误。

这一步很重要，因为它把问题从：

```text
jstack 某个命令坏了？
```

进一步转成：

```text
这个 Java 8 + Alpine 运行环境下，JVM attach / 诊断能力本身存在兼容问题？
```

## 开始关注 Alpine 本身

Alpine 和常见 Debian / Ubuntu 镜像有一个很基础的差异：Alpine 使用 musl libc，而 Debian / Ubuntu 通常使用 glibc。

当时使用的又是 Java 8 时代的 OpenJDK Alpine 镜像，因此开始怀疑这不是业务代码问题，而是旧版本 JDK 诊断工具与 Alpine/musl 组合的兼容性问题。

这个错误并不是孤例。Docker OpenJDK 项目早期也有人在 `java:openjdk-8u92-jdk-alpine` 中对 PID 1 执行 `jmap` 时得到同样的：

```text
Unable to get pid of LinuxThreads manager thread
```

而切换到非 Alpine 的 OpenJDK 8 镜像后恢复正常。

因此这里更适合把结论限定为：

> 在这组 Java 8 + OpenJDK Alpine 镜像中，JVM Attach / Serviceability 工具存在实际兼容性问题；不应该泛化为“所有 Alpine、所有 JDK 版本都不能使用 jstack”。

## 换到 Debian 验证

最终把基础镜像换成 Debian 系列：

```dockerfile
FROM openjdk:8u322-jdk-bullseye
```

重新运行服务后再次验证：

```text
jstack → 正常
Arthas → 正常
```

这才完成了这个问题的闭环。

也就是说，当时切换 Debian 的目的非常明确：

> 不是为了修复 Java 应用运行问题，而是为了让测试和生产环境重新具备可用的 JVM 诊断能力。

## 为什么我最终没有继续折腾 Alpine

理论上还可以继续研究特定 Alpine 版本、musl、JDK 构建方式和 attach 实现之间的兼容细节。

但从业务系统维护角度，当时真正需要的能力很简单：

```text
CPU 高 → 能 jstack
线程问题 → 能 attach Arthas
内存问题 → 能继续使用 JDK 诊断工具
```

既然换到 Debian JDK 镜像后这些能力都恢复了，就没有必要为了更小的基础镜像继续承担额外诊断成本。

这是一种工程取舍，而不是说 Alpine 不能运行 Java。

## 后续：这个改动又引出了另一个问题

有意思的是，这次“为了补齐 JVM 诊断能力”而做的基础镜像切换，后来又引出了一个完全不同的生产问题：多个第三方接口的签名开始失败。

那次问题最终又追到了 Docker 运行环境与 `String#getBytes()` 默认字符集。

详见：

[一次 Docker 基础镜像切换后的签名异常：从生产回滚到默认字符集](/lab-tech-exploration/containers-cloud/docker-base-image-signature-default-charset)

## 结论

这次排查里最值得保留的不是“Alpine 一定不能用于生产”，而是几个更具体的判断：

1. **JDK 镜像里存在诊断命令，不代表这些命令在当前基础镜像和 JVM 组合下就一定可用。**
2. **业务运行正常和现场可诊断是两种不同能力。** 真正遇到 CPU、线程或内存问题时，后者才会暴露出来。
3. **Java 8 Alpine 的旧镜像组合需要特别验证 Attach / Serviceability 工具。** 不要只因为 `jps` 能看到进程，就认为 `jstack`、`jmap`、Arthas 一定也能工作。
4. **基础镜像选择应该把维护和诊断成本一起算进去。** 镜像体积不是唯一指标。

## 参考

- [docker-library/openjdk #76: jmap not happy on alpine](https://github.com/docker-library/openjdk/issues/76)
