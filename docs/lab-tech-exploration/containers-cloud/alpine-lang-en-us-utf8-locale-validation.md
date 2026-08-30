---
title: Dockerfile 写了 LANG=en_US.UTF-8，真的代表 Locale 生效了吗？
description: 从一次 Java 8 Docker 签名问题继续追查 Alpine Locale 行为，验证环境变量被设置并不等于对应 Locale 数据真实存在，并说明这一结论的版本和镜像边界。
---

# Dockerfile 写了 LANG=en_US.UTF-8，真的代表 Locale 生效了吗？

这个问题来自另一篇 Docker 签名异常的复现。

同一份 Java 程序、同一份 JAR、同一套签名输入，只改变 Dockerfile 后，曾出现这样的实验结果：

```text
Alpine + LANG=en_US.UTF-8       → 验签正常
Debian + LANG=en_US.UTF-8       → 验签失败
Debian + LANG=C.UTF-8           → 验签正常
```

第一反应很容易是：

> Dockerfile 明明都写了 `LANG=en_US.UTF-8`，为什么 Alpine 和 Debian 的行为却不一样？

这又引出了一个更基础的问题：

> **环境变量里出现 `LANG=en_US.UTF-8`，真的代表这个 Locale 在容器里存在并生效了吗？**

## 实验使用的 Alpine Dockerfile

当时的最小复现工程中有这样一个 Dockerfile：

```dockerfile
FROM openjdk:8-jdk-alpine

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

WORKDIR /app
COPY target/sign-client.jar .

CMD ["java", "-jar", "/app/sign-client.jar"]
```

从 Dockerfile 看，`LANG` 和 `LC_ALL` 都已经设置成 `en_US.UTF-8`。

但“变量被赋值”和“系统具备对应 Locale 数据”并不是一回事。

## 第一种验证：查看系统支持的 Locale

在具备 `locale` 命令的环境中，最直接的检查是：

```bash
locale -a
```

它回答的是：当前系统实际提供哪些 Locale。

如果列表里根本没有：

```text
en_US.UTF-8
```

那么 Dockerfile 中写：

```dockerfile
ENV LANG=en_US.UTF-8
```

并不能凭空生成一套 `en_US.UTF-8` Locale 数据。

这也是这次排查里首先需要区分的两个概念：

```text
环境变量的值
≠
操作系统真实提供的 Locale
```

## 第二种验证：直接看 locale 输出

继续执行：

```bash
locale
```

有时可以看到类似：

```text
LANG=en_US.UTF-8
LC_CTYPE="en_US.UTF-8"
...
```

这很容易让人认为“已经生效”。

但这类输出至少有一部分是在展示当前 locale 相关环境变量的取值，本身不能单独证明镜像里已经安装了完整的 `en_US.UTF-8` Locale 数据。

因此不能只看：

```bash
echo $LANG
```

或者只看 `locale` 中出现的字符串，就结束验证。

## 第三种验证：用实际行为做对照

当时又按提示使用 `sort` 做了一个简单行为实验：

```bash
printf "a\nB\n" | sort
```

这个实验不是为了证明 Java 签名机制，而是为了进一步观察当前系统的排序行为是否真的体现出预期的 Locale 差异。

原记录中的对照预期是：

```text
C 类排序行为：
B
a
```

而语言化的 `en_US.UTF-8` 排序行为可能不同。

这个测试的价值在于：

> 不只读取配置字符串，而是直接观察 Locale 相关功能的实际行为。

不过需要注意，`sort` 属于操作系统用户态工具，它能帮助判断系统 Locale 环境，但不能单独证明 JVM 最终使用了哪个默认 charset。要判断 Java 行为，还应该直接查看 JVM 自己的默认字符集。

例如：

```java
System.out.println(java.nio.charset.Charset.defaultCharset());
System.out.println(java.util.Locale.getDefault());
```

本文保留的是当时已有的系统侧实验记录，不把后来可以补做的 Java 输出写成“当时已经执行过”。

## 第四种验证：看 Locale 数据是否存在

原排查还检查了：

```bash
ls /usr/lib/locale
```

目的同样很直接：确认镜像里到底有没有相应的 Locale 数据，而不只是设置了环境变量。

当时使用的是精简的旧 `openjdk:8-jdk-alpine` 镜像，没有额外安装 Locale 支持包，因此这类检查进一步支持了一个判断：

> 在这个具体 Alpine 镜像里，仅设置 `LANG=en_US.UTF-8`，不能等价成“已经安装并启用了 glibc 环境里那套 en_US.UTF-8 Locale”。

## 不要把历史实验泛化成“Alpine 永远不支持 en_US.UTF-8”

原来的笔记里曾经直接写：

> Alpine 默认不支持 en_US.UTF-8，生产环境不要使用 Alpine。

现在重新整理时，这个结论需要收窄。

现代 Alpine 已经有 `musl-locales` 包，官方包索引中可以看到包括：

```text
/usr/share/i18n/locales/musl/en_US.UTF-8
```

Alpine Wiki 也明确给出了安装 `musl-locales` 并使用 `locale -a` 查看可用 Locale 的方式。

因此更准确的说法应该是：

> **在当时使用的精简 `openjdk:8-jdk-alpine` 镜像中，如果没有安装相应 Locale 支持，仅写 `LANG=en_US.UTF-8` 不能证明对应 Locale 真实存在并按预期生效。**

这句话有明确的镜像和版本边界，也不会把旧 Java 8 实验错误推广到所有 Alpine 版本。

## 它和签名问题是什么关系

这篇文章只是解释了当时为什么继续怀疑“Dockerfile 里相同的 `LANG`，在 Alpine 和 Debian 中未必代表完全相同的运行环境”。

但它并不是签名问题的最终根因证明。

签名问题后来通过更直接的代码对照收敛到了：

```java
content.getBytes()
```

和：

```java
content.getBytes(StandardCharsets.UTF_8)
```

之间的差异。

也就是说：

```text
Locale / 基础镜像差异
↓
改变了平台默认环境
↓
业务代码又恰好依赖平台默认 charset
↓
最终把环境差异带进签名字节
```

工程上真正应该修的是最后这一层：

> **签名原文转字节时显式指定 UTF-8，而不是依赖某个容器环境恰好提供正确的默认值。**

完整排查见：

[一次 Docker 基础镜像切换后的签名异常：从生产回滚到默认字符集](/lab-tech-exploration/containers-cloud/docker-base-image-signature-default-charset)

## 最小复现工程

这三个 Dockerfile 和签名代码都保留在同一个演示程序里：

[下载 springboot2.2.10-http-sign.7z](https://cdn.jsdelivr.net/gh/valuetodays/supreme-octo-palm-tree@main/attachment/springboot2.2.10-http-sign.7z)

其中客户端目录包含：

```text
dockerfile-alpine_en_us
dockerfile-bullseye_en_us
dockerfile-bullseye_c
```

可以使用同一份 JAR 分别构建镜像，再对比实际运行结果。

原工程 README 还记录：旧 `openjdk:8-jdk-alpine` 镜像在 Rocky Linux 9.5 上曾出现：

```text
library initialization failed - unable to allocate file descriptor table
```

在 CentOS 7.8.2003 上则可以启动。因此如果现在重新运行这个历史 Java 8 Demo，需要注意宿主机和旧镜像之间还可能存在额外兼容性问题。

## 结论

这次小实验最后留下的结论其实比“Alpine 支不支持 en_US.UTF-8”更通用：

1. **配置文件里写了某个环境变量，不等于运行环境真的具备它所代表的能力。**
2. **判断 Locale 是否生效，应同时看可用 Locale、实际行为以及应用自身看到的 charset / Locale，而不是只看 `LANG` 字符串。**
3. **历史 Docker 镜像结论需要保留版本边界。** 旧 `openjdk:8-jdk-alpine` 的实验结果不应该直接推广到现代 Alpine。
4. **对于签名、摘要、协议编码，代码应显式指定 charset。** Locale 环境应该是运行配置，而不是协议正确性的隐式前提。

## 关联文章

- [一次 Docker 基础镜像切换后的签名异常：从生产回滚到默认字符集](/lab-tech-exploration/containers-cloud/docker-base-image-signature-default-charset)
- [Java 8 Alpine 容器中 jstack 与 Arthas 失败：一次 JVM 诊断能力补齐](/lab-tech-exploration/containers-cloud/java8-alpine-jstack-arthas-diagnostics)

## 参考

- [Alpine Linux Wiki: Locale](https://wiki.alpinelinux.org/wiki/Locale)
- [Alpine Linux musl-locales package contents](https://pkgs.alpinelinux.org/contents?name=musl-locales)
