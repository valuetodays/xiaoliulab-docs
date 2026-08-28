---
title: "一个 4 年来从未生效的 JVM 参数：Docker 中 JAVA_OPTS 的误区"
description: "记录一次 Docker 中 JVM 参数长期未生效的问题排查：JAVA_OPTS 虽然通过 docker run 注入容器，但 ENTRYPOINT 直接执行 java 时 JVM 并不会自动读取它。通过 docker stats、ps、jinfo 逐层验证，最终改用 JAVA_TOOL_OPTIONS 并确认参数真正生效。"
head:
  - - meta
    - name: keywords
      content: Java,Docker,JAVA_OPTS,JAVA_TOOL_OPTIONS,JVM 参数,jinfo,jcmd,Spring Boot,容器内存
---

# 一个 4 年来从未生效的 JVM 参数：Docker 中 JAVA_OPTS 的误区

## 一、一直以为 JVM 参数已经生效

项目使用阿里云流水线构建并通过 Docker 发布。

Dockerfile 中直接使用 `java` 启动 Spring Boot 应用：

```dockerfile
FROM openjdk:8u322-jdk-bullseye

ENV LANG="C.UTF-8"
ENV LC_ALL="C.UTF-8"
ENV TZ=Asia/Shanghai

ENTRYPOINT [
  "java",
  "-Dfile.encoding=UTF-8",
  "-Dsun.jnu.encoding=UTF-8",
  "-Dcom.sun.jndi.rmi.object.trustURLCodebase=false",
  "-Dcom.sun.jndi.cosnaming.object.trustURLCodebase=false",
  "-jar",
  "/data/app/test_app-8003.jar"
]

CMD ["--spring.profiles.active=prod"]

EXPOSE 8003
```

运行容器时，又通过环境变量传入了一组 JVM 参数：

```bash
docker run \
  --memory=1150m \
  --memory-swap=1650m \
  -e JAVA_OPTS="-Xmx512m -Xms256m -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=256m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/var/log/dump/memoryError.dump" \
  --name test_app \
  -p 8003:8003 \
  -d $image \
  --spring.profiles.active=test
```

这套配置已经存在了很长时间。

一直以来的认知是：

> `JAVA_OPTS` 已经通过 `docker run -e` 传进容器，所以这些 JVM 参数应该已经生效。

真正开始检查之后，才发现这个前提从一开始就是错的。

## 二、为什么开始怀疑参数没有生效

先看容器整体内存：

```bash
docker stats --no-stream test_app
```

输出类似：

```text
CONTAINER ID   NAME       CPU %   MEM USAGE / LIMIT   MEM %    NET I/O         BLOCK I/O     PIDS
377443d4339d   test_app   0.72%   544MiB / 1.123GiB   47.30%   346kB / 711kB   0B / 24.6kB   103
```

容器当前使用了大约：

```text
544 MiB
```

但这里还不能直接说明：

```text
-Xmx512m
```

有没有生效。

因为 `docker stats` 看到的是：

> 容器整体内存使用量。

其中不仅包括 Java Heap，还可能包括：

- Metaspace
- 线程栈
- Direct Memory
- Code Cache
- JVM Native Memory
- 其他容器内进程与页缓存

所以第一步只能得到：

> 内存表现值得继续确认，但不能只靠 `docker stats` 判断 JVM 参数。

## 三、再看 Java 进程实际是怎么启动的

进入容器：

```bash
docker exec -it test_app bash
```

查看 Java 进程：

```bash
ps ww -o pid,rss,command -C java
```

结果：

```text
PID   RSS    COMMAND
1     564532 java -Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8 -Dcom.sun.jndi.rmi.object.trustURLCodebase=false -Dcom.sun.jndi.cosnaming.object.trustURLCodebase=false -jar /data/app/test_app-8003.jar --spring.profiles.active=test
```

这里出现了第一个很明显的异常。

启动命令里能看到 Dockerfile `ENTRYPOINT` 中写死的：

```text
-Dfile.encoding=UTF-8
-Dsun.jnu.encoding=UTF-8
...
```

但完全看不到通过 `JAVA_OPTS` 传入的：

```text
-Xmx512m
-Xms256m
-XX:MetaspaceSize=128m
-XX:MaxMetaspaceSize=256m
```

这时已经可以高度怀疑：

> `JAVA_OPTS` 虽然存在于容器环境变量中，但根本没有进入 `java` 启动命令。

不过，`ps` 看到的是进程命令行。

最终 JVM 到底采用了什么参数，还是应该直接问 JVM 自己。

## 四、用 jinfo 确认 JVM 最终生效参数

先查看 Java 进程：

```bash
jps
```

输出：

```text
1 test_app-8003.jar
159 Jps
```

然后逐项查看 JVM 参数：

```bash
jinfo -flag MaxHeapSize 1
jinfo -flag InitialHeapSize 1
jinfo -flag MetaspaceSize 1
jinfo -flag MaxMetaspaceSize 1
```

结果：

```text
-XX:MaxHeapSize=301989888
-XX:InitialHeapSize=18874368
-XX:MetaspaceSize=21807104
-XX:MaxMetaspaceSize=18446744073709547520
```

换算后大约是：

```text
MaxHeapSize      ≈ 288 MB
InitialHeapSize  ≈ 18 MB
MetaspaceSize    ≈ 20 MB
MaxMetaspaceSize ≈ 基本可视为未限制
```

这里终于可以确定：

> 原来配置的 `-Xmx512m -Xms256m -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=256m` 根本没有生效。

其中：

```text
MaxHeapSize
```

就是 JVM 内部对应 `-Xmx` 的参数。

如果 `-Xmx512m` 真正生效，应该看到：

```text
MaxHeapSize = 536870912
```

而不是：

```text
301989888
```

到这里已经不是“怀疑”，而是有 JVM 自己的参数输出作为证据。

## 五、问题到底出在哪里

回头看 Dockerfile：

```dockerfile
ENTRYPOINT [
  "java",
  "-Dfile.encoding=UTF-8",
  "-Dsun.jnu.encoding=UTF-8",
  "-Dcom.sun.jndi.rmi.object.trustURLCodebase=false",
  "-Dcom.sun.jndi.cosnaming.object.trustURLCodebase=false",
  "-jar",
  "/data/app/test_app-8003.jar"
]
```

这里使用的是 Docker exec form。

最终容器启动时，本质上直接执行：

```text
java -Dfile.encoding=UTF-8 ... -jar /data/app/test_app-8003.jar
```

而：

```bash
docker run -e JAVA_OPTS="..."
```

做的事情只是：

> 在容器环境里增加一个名为 `JAVA_OPTS` 的环境变量。

它不会自动变成：

```text
java $JAVA_OPTS ...
```

### 5.1 JAVA_OPTS 不是 JVM 标准环境变量

这是整个问题最核心的地方。

`JAVA_OPTS` 本身只是一个约定俗成的变量名。

JVM 不会因为发现环境中存在：

```text
JAVA_OPTS=-Xmx512m ...
```

就自动把这些内容追加到启动参数。

只有当某个启动脚本主动写了类似：

```bash
java $JAVA_OPTS -jar app.jar
```

时，它才会生效。

例如某些：

- shell 启动脚本
- 容器 entrypoint 脚本
- 运维封装脚本
- 特定框架启动脚本

可能会主动读取 `JAVA_OPTS`。

但本次 Dockerfile 没有这样的中间层。

它是直接：

```text
ENTRYPOINT ["java", ...]
```

所以根本没人去读取 `JAVA_OPTS`。

## 六、为什么改成 JAVA_TOOL_OPTIONS 就可以

修复方式是把：

```bash
JAVA_OPTS
```

改成：

```bash
JAVA_TOOL_OPTIONS
```

例如：

```bash
docker run \
  --memory=1150m \
  --memory-swap=1650m \
  -e JAVA_TOOL_OPTIONS="-Xmx512m -Xms256m -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=256m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/var/log/dump/memoryError.dump" \
  --name test_app \
  -p 8003:8003 \
  -d $image \
  --spring.profiles.active=test
```

两者最大的区别不是名字不同，而是生效机制完全不同。

| 环境变量 | 生效机制 |
| --- | --- |
| `JAVA_OPTS` | 普通环境变量，需要启动脚本主动读取并拼进 `java` 命令 |
| `JAVA_TOOL_OPTIONS` | JVM 自身识别，JVM 启动时会自动读取 |

所以在当前这种：

```dockerfile
ENTRYPOINT ["java", "-jar", "..."]
```

直接执行 `java` 的场景中：

```text
JAVA_OPTS
```

不会自动生效。

而：

```text
JAVA_TOOL_OPTIONS
```

会由 JVM 自己读取。

这和 Spring Boot 本身无关，也不是 Docker 对 Spring Boot 做了特殊支持。

关键在于：

> 最终启动的是 JVM，而 `JAVA_TOOL_OPTIONS` 是 JVM 自身支持的机制。

## 七、修改后再次验证

修改为 `JAVA_TOOL_OPTIONS` 后重新启动容器。

先执行：

```bash
jps
```

这次输出里已经出现：

```text
Picked up JAVA_TOOL_OPTIONS: -Xmx512m -Xms256m -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=256m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/var/log/dump/memoryError.dump
```

这已经说明 JVM 主动读取到了环境变量。

但仍然继续用 `jinfo` 验证最终参数：

```bash
jinfo -flag MaxHeapSize 1
```

输出：

```text
-XX:MaxHeapSize=536870912
```

即：

```text
512 MB
```

继续检查：

```bash
jinfo -flag InitialHeapSize 1
```

输出：

```text
-XX:InitialHeapSize=268435456
```

即：

```text
256 MB
```

检查 Metaspace：

```bash
jinfo -flag MetaspaceSize 1
```

输出：

```text
-XX:MetaspaceSize=134217728
```

即：

```text
128 MB
```

再检查：

```bash
jinfo -flag MaxMetaspaceSize 1
```

输出：

```text
-XX:MaxMetaspaceSize=268435456
```

即：

```text
256 MB
```

最终结果：

| 参数 | 配置值 | JVM 实际值 |
| --- | ---: | ---: |
| `-Xmx` | 512 MB | 512 MB |
| `-Xms` | 256 MB | 256 MB |
| `MetaspaceSize` | 128 MB | 128 MB |
| `MaxMetaspaceSize` | 256 MB | 256 MB |

和启动参数完全对应。

至此可以确认：

> 修改后的 JVM 参数真正生效了。

## 八、这次排查中三个命令分别看什么

这次排查同时用了：

```text
docker stats
ps
jinfo
```

它们看到的其实不是同一个东西。

### 8.1 docker stats：看容器整体内存

```bash
docker stats --no-stream test_app
```

适合回答：

> 整个容器现在占了多少内存？

它包含 JVM Heap 之外的很多内容，所以不能直接拿来证明 `-Xmx`。

### 8.2 ps：看 Java 进程启动命令

```bash
ps ww -o pid,rss,command -C java
```

适合回答：

> `java` 最终是用什么命令启动的？

本次就是通过它第一次直观看到：

```text
JAVA_OPTS 中的参数没有出现在命令行
```

其中 `RSS` 表示进程当前驻留在物理内存中的大小。

它比单独看 Heap 更接近 Java 进程当前实际占用的物理内存，但仍然不等于：

```text
-Xmx
```

### 8.3 jinfo / jcmd：看 JVM 最终参数

真正要判断：

```text
-Xmx 到底是多少？
-Xms 到底是多少？
MaxMetaspaceSize 有没有生效？
```

应该直接查看 JVM。

例如：

```bash
jinfo -flag MaxHeapSize 1
```

或者使用：

```bash
jcmd 1 VM.flags
```

这才是验证 JVM 参数是否真正生效的关键证据。

可以简单记成：

```text
docker stats
    ↓
容器用了多少内存

ps
    ↓
java 是怎么启动的

jinfo / jcmd
    ↓
JVM 最终采用了什么参数
```

## 九、为什么这个问题能存在 4 年

回头看，这个问题其实并不复杂。

但它很容易长期存在，因为：

### 9.1 配置看起来完全合理

看到：

```bash
-e JAVA_OPTS="-Xmx512m ..."
```

很容易产生一种错觉：

> 都已经写进 docker run 了，肯定生效了。

实际上：

```text
配置存在
```

和：

```text
配置被消费
```

是两回事。

### 9.2 应用完全可以正常运行

即使 `JAVA_OPTS` 没生效，JVM 仍然会使用默认参数启动。

所以不会出现：

- 启动失败
- 编译失败
- 明显异常日志

只要默认 Heap 恰好还能支撑业务，问题就可能一直隐藏。

### 9.3 很少有人主动验证 JVM 实际参数

很多时候配置 JVM 参数的流程是：

```text
改配置
→ 发布
→ 应用启动成功
→ 结束
```

缺少最后一步：

```text
→ 到 JVM 内部确认参数真的生效
```

于是一个“看起来已经配置”的参数，就可能多年没有真正进入 JVM。

## 十、这次问题真正留下来的经验

### 10.1 配置过，不代表生效过

这次最重要的经验其实不是：

> `JAVA_OPTS` 要换成 `JAVA_TOOL_OPTIONS`。

而是：

> **任何重要运行时配置，都应该验证最终运行状态，而不是只验证配置文件。**

比如 JVM 参数，不应该只看：

```text
Dockerfile
docker run
环境变量
```

而应该最终落到：

```bash
jinfo
jcmd
```

### 10.2 环境变量本身不会自动产生行为

设置：

```bash
-e SOME_OPTIONS="..."
```

只代表容器里有这个变量。

必须继续追问：

> 谁会读取它？

如果答案是：

```text
没人
```

那它就只是一个没有消费者的字符串。

### 10.3 JAVA_OPTS 是约定，不是 JVM 协议

看到一个变量名很常见，不代表它是标准机制。

`JAVA_OPTS` 经常出现在：

- Tomcat
- shell 脚本
- Docker entrypoint
- CI/CD 配置

所以很容易形成：

> Java 会自动识别它

这样的印象。

实际上它是否生效，完全取决于启动链路有没有主动引用它。

### 10.4 要区分容器内存和 JVM Heap

例如：

```text
docker stats = 544 MiB
```

不能得出：

```text
-Xmx = 544 MiB
```

因为：

```text
容器内存 ≠ JVM Heap
```

同样：

```text
RSS ≠ Xmx
```

`Xmx` 是 Heap 上限。

RSS 是当前进程驻留物理内存。

容器内存又是更外层的视角。

排查 JVM 内存问题时，这几个概念应该分开。

## 十一、关于 JAVA_TOOL_OPTIONS

`JAVA_TOOL_OPTIONS` 的优势在于：

> JVM 启动时会主动读取它。

因此，即使 Dockerfile 是：

```dockerfile
ENTRYPOINT ["java", "-jar", "/data/app/app.jar"]
```

也不需要额外改成 shell 脚本去拼接参数。

例如：

```bash
-e JAVA_TOOL_OPTIONS="-Xmx512m -Xms256m"
```

JVM 启动时就可以看到：

```text
Picked up JAVA_TOOL_OPTIONS: -Xmx512m -Xms256m
```

不过它的特点也意味着：

> 它会影响当前环境中启动的 Java 工具和 Java 进程。

所以在包含多个 Java 进程或需要执行 `jps`、`jinfo` 等工具的环境里，也可能看到：

```text
Picked up JAVA_TOOL_OPTIONS: ...
```

这是正常现象。

## 十二、最终回看

如果只看修复结论，这个问题可以压缩成一句话：

> Docker `ENTRYPOINT ["java", ...]` 不会自动读取 `JAVA_OPTS`，需要显式拼接，或者改用 JVM 自身支持的 `JAVA_TOOL_OPTIONS`。

但这次问题真正值得留下来的，是验证过程：

```text
docker run 中明明配置了 JAVA_OPTS
        ↓
一直默认它已经生效
        ↓
docker stats 发现内存表现值得确认
        ↓
ps 查看启动命令
        ↓
没有看到 -Xmx / -Xms
        ↓
jinfo 查看 JVM 最终参数
        ↓
确认 JAVA_OPTS 根本没有进入 JVM
        ↓
回头检查 Docker ENTRYPOINT
        ↓
发现只是直接执行 java，没有任何脚本读取 JAVA_OPTS
        ↓
改为 JAVA_TOOL_OPTIONS
        ↓
JVM 输出 Picked up JAVA_TOOL_OPTIONS
        ↓
再次使用 jinfo
        ↓
512 / 256 / 128 / 256 MB 全部与配置一致
```

最终修复的是一个 JVM 参数问题。

但更值得记住的是：

> **不要因为一段配置存在了很多年，就默认它真的生效了。**

至此，修复了一个 4 年来从未真正生效的 JVM 参数配置。

## 十三、参考

- [在线文件大小（bit、bytes、KB、MB、GB、TB）转换换算 - BeJSON](https://www.bejson.com/convert/filesize/)
