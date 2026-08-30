---
title: 一次 Docker 基础镜像切换后的签名异常：从生产回滚到默认字符集
description: 记录 Java 8 服务从 Alpine 切换到 Debian 后第三方接口签名异常的生产问题，以及两个月后通过最小复现、三组 Dockerfile 对照实验最终定位 String.getBytes() 默认字符集风险的过程。
---

# 一次 Docker 基础镜像切换后的签名异常：从生产回滚到默认字符集

一次看起来只是更换 Docker 基础镜像的改动，最终导致多个第三方接口的签名无法通过。

当时先通过回滚恢复了生产。约两个月后，我又重新想起这件事，才把真实签名逻辑抽成最小工程，用同一份 JAR、同一套请求和同一份签名代码，只改变 Dockerfile 做对照实验。

最后发现，真正应该修复的并不是“生产环境必须使用某一种 Locale”，而是签名代码不应该依赖 `String#getBytes()` 的平台默认字符集。

## 问题的起点不是签名，而是 JVM 诊断

这个服务最初使用的是 Alpine 基础镜像：

```dockerfile
FROM openjdk:8-jdk-alpine
```

业务运行本身没有明显问题，但后来一次排查 JVM 问题时发现，容器中虽然 `jps` 可以看到 Java 进程，`jstack` 和 Arthas 却无法正常工作。

为了让测试和生产环境保留基本的 JVM 诊断能力，我决定把基础镜像改成 Debian：

```dockerfile
FROM openjdk:8u322-jdk-bullseye
```

当时把这次改动理解成“只更换基础镜像，Java 业务代码没有变化”，因此低估了运行环境变化本身的风险，没有在测试环境把所有渠道接口重新完整验证一遍。

这个判断后来证明过于乐观。

## 上生产后，多个接口同时出现签名异常

生产发布后，系统调用第三方资金渠道接口时开始出现签名异常。

受影响的不只是某一个接口，包括获取汇率在内的多个接口都可能失败。这些接口虽然业务不同，但共用同一套加密和签名代码：系统先生成请求内容，完成加密和签名后发送给第三方，对方认为签名不正确。

这使问题范围很快从“某一个业务接口”收敛到了公共签名链路。

## 先看 Git 提交记录

出现问题后，我先查看了对应版本的 Git 提交记录。

这一版还有其他业务修改，但和多个接口同时出现签名错误都没有明显关系。真正影响所有接口公共运行环境的变化，是 Docker 基础镜像从 Alpine 切到了 Debian。

于是先做最直接的验证：

> Java 代码完全不变，只恢复原来的 Dockerfile。

回滚后接口恢复正常。

生产问题先止住了。当时没有继续追到更底层，只能确认：

- 新镜像发布后出现签名异常；
- 相同代码恢复旧镜像后恢复正常；
- 基础镜像变化高度可疑。

但这还不足以说明“Debian 会导致签名失败”，更不能说明具体是哪一个系统差异影响了签名。

## 两个月后，重新把问题捡起来

大约两个月后，我又想到这件事。

这次不再直接在完整业务系统里猜，而是把真实项目里的核心签名逻辑抽出来，做了一个最小复现工程。

实验的原则是尽量只改变运行环境：

```text
同一份 JAR
同一套 HTTP 请求
同一份 RSA 签名代码
同一份输入内容
只改变 Dockerfile
```

客户端负责对内容做 `SHA256withRSA` 签名并发送给服务端，服务端使用对应公钥验签。

## 三组 Dockerfile

最小工程保留了三种客户端镜像组合。

### Alpine + en_US.UTF-8

```dockerfile
FROM openjdk:8-jdk-alpine

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

WORKDIR /app
COPY target/sign-client.jar .

CMD ["java", "-jar", "/app/sign-client.jar"]
```

### Debian + en_US.UTF-8

```dockerfile
FROM openjdk:8u322-jdk-bullseye

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

WORKDIR /app
COPY target/sign-client.jar .

CMD ["java", "-jar", "/app/sign-client.jar"]
```

### Debian + C.UTF-8

```dockerfile
FROM openjdk:8u322-jdk-bullseye

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

WORKDIR /app
COPY target/sign-client.jar .

CMD ["java", "-jar", "/app/sign-client.jar"]
```

三种镜像使用的是同一份 `sign-client.jar`。

## 第一轮：签名代码不指定字符集

先把签名代码写成：

```java
signature.update(content.getBytes());
```

Java 8 的 `String#getBytes()` 在没有传入 charset 时，会使用 JVM 的平台默认字符集。因此这里实际上把运行环境的一部分隐式带进了签名算法。

用纯 ASCII 内容测试：

```bash
curl -X POST 'http://127.0.0.1:18080/client/api/trade' \
  -H 'content-type: application/json' \
  -d '{"content": "aaZAaw903jd98ldQW"}'
```

在纯 ASCII 参数下，三种 Docker 环境都可以正常验签。

再加入中文：

```bash
curl -X POST 'http://127.0.0.1:18080/client/api/trade' \
  -H 'content-type: application/json' \
  -d '{"content": "aaZAaw903jd98ldQW啊"}'
```

这时差异出现了：

| Docker 环境 | `LANG` | 包含中文时的结果 |
| --- | --- | --- |
| Alpine | `en_US.UTF-8` | 正常 |
| Debian Bullseye | `en_US.UTF-8` | 验签失败 |
| Debian Bullseye | `C.UTF-8` | 正常 |

这里要特别区分两个维度：**Alpine + `en_US.UTF-8` 在这个签名接口实验中是正常的，但同一个 Alpine/Java 8 环境下 `jstack` 和 Arthas 无法正常使用。** 前者是业务接口与签名结果，后者是 JVM 诊断能力，不能把“接口正常”写成“Alpine 环境整体没有问题”。

这一步至少说明：在这个最小工程里，代码不变时，不同基础镜像 / Locale 组合确实能够改变签名结果。

但仅凭这三组结果，还不应该继续推断“glibc 修改了 JSON”“Locale 自动做了 Unicode normalization”之类更具体的机制。真正值得继续检查的是签名代码中有没有依赖环境的隐式行为。

## 第二轮：显式指定 UTF-8

把签名输入改成：

```java
signature.update(content.getBytes(StandardCharsets.UTF_8));
```

再次运行相同测试。

显式指定 UTF-8 后，再次使用相同请求验证，三种 Docker 环境都可以正常验签，包括此前在中文参数下失败的 Debian + `en_US.UTF-8`。

这使问题进一步收敛到了一个很普通、但在加密签名代码里非常危险的细节：

```java
content.getBytes()
```

依赖平台默认字符集，而：

```java
content.getBytes(StandardCharsets.UTF_8)
```

把“字符串如何变成参与签名的字节”明确固定了下来。

Java 8 API 对 `String#getBytes()` 的定义就是使用平台默认字符集；默认 charset 又通常在 JVM 启动时根据操作系统的 locale / charset 环境确定。因此在协议、摘要、签名等要求字节级一致的场景中，不应该依赖这个默认值。

## 为什么纯 ASCII 没有暴露问题

这次最小实验还有一个很有用的现象：不包含中文时，各环境都可以正常验签；加入中文之后，差异才出现。

这并不奇怪。

对于常见 ASCII 字符，不同 ASCII 兼容字符集通常会生成相同的单字节结果，因此代码即使依赖默认 charset，也可能长期看起来没有问题。

一旦签名原文出现中文等非 ASCII 字符，字符到字节的编码规则开始真正参与结果，环境差异才容易暴露。

这也是这类问题比较隐蔽的地方：

> 测试数据如果长期只有数字、英文和常见符号，错误的字符集处理可能一直潜伏着。

## 最终处理

最后没有因为这次问题退回到“以后一直使用 Alpine”。

切换到 Debian 的最初目的，是解决 Java 8 Alpine 环境下 `jstack`、Arthas 等 JVM 诊断工具不可用的问题，这个需求仍然存在。

最终方案是：

```text
继续使用 Debian JDK 镜像
+
容器环境使用 C.UTF-8
+
签名代码显式使用 StandardCharsets.UTF_8
```

随后重新在测试环境完整验证了获取汇率及其他共用这套加密、签名逻辑的第三方接口，确认正常后再使用这套镜像。

其中真正属于代码层根治的是：

```java
str.getBytes(StandardCharsets.UTF_8);
```

而不是依靠某一种 Docker Locale 恰好得到正确结果。

## 最小复现工程

这次问题后来整理成了一个 Spring Boot 2.2.10 + Java 8 的最小复现工程，包含：

```text
sign-server
└── 接收 content / sign / merchantId，并使用公钥验签

sign-client
├── 使用私钥对 content 签名
├── 调用 sign-server
└── 三种 Dockerfile
    ├── dockerfile-alpine_en_us
    ├── dockerfile-bullseye_en_us
    └── dockerfile-bullseye_c
```

演示程序保留在：

[下载 springboot2.2.10-http-sign.7z](https://cdn.jsdelivr.net/gh/valuetodays/supreme-octo-palm-tree@main/attachment/springboot2.2.10-http-sign.7z)

基本测试步骤：

```bash
# 先构建并启动 sign-server
# 再构建 sign-client；每次选择一个 Dockerfile 构建

docker build -t sign-client -f ./dockerfile-alpine_en_us .
docker build -t sign-client -f ./dockerfile-bullseye_en_us .
docker build -t sign-client -f ./dockerfile-bullseye_c .

docker run -p 18080:18080 --name sign-client -d sign-client
```

`sign-client` 中服务端地址需要按实际实验环境调整。

原实验还记录了一个版本边界：`openjdk:8-jdk-alpine` 在 Rocky Linux 9.5 上启动时出现过：

```text
library initialization failed - unable to allocate file descriptor table
```

而当时在 CentOS 7.8.2003 上可以运行，因此 Alpine 这一组实验是在能够运行该旧镜像的环境中完成的。这个现象和本文签名问题不是同一个问题，只作为复现实验的环境说明保留。

## 这次问题留下的几个结论

最直接的教训不是“Debian 不适合 Java”，也不是“生产环境必须使用 C.UTF-8”。

更重要的是下面几件事：

1. **基础镜像也是应用运行依赖的一部分。** Java 代码不变，不代表运行环境没有发生实质变化。
2. **签名、摘要、加密协议中的字符到字节转换必须显式指定编码。** 不应该依赖平台默认 charset。
3. **生产回滚只能先证明某个变化高度可疑，不等于已经证明底层根因。** 后续仍需要最小复现和控制变量实验。
4. **非 ASCII 测试数据很重要。** 只有英文和数字时，字符集问题很容易被掩盖。
5. **运行环境变更同样需要完整验证。** 这次最终换成 Debian + `C.UTF-8` 后，重新在测试环境验证完整渠道链路，才完成了这次变更的闭环。

## 关联文章

- [Java 8 Alpine 容器中 jstack 与 Arthas 失败：一次 JVM 诊断能力补齐](/lab-tech-exploration/containers-cloud/java8-alpine-jstack-arthas-diagnostics)
- [Dockerfile 写了 LANG=en_US.UTF-8，真的代表 Locale 生效了吗？](/lab-tech-exploration/containers-cloud/alpine-lang-en-us-utf8-locale-validation)

## 参考

- [Java 8 String#getBytes API](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)
- [Java 8 Charset API](https://docs.oracle.com/javase/8/docs/api/java/nio/charset/Charset.html)
