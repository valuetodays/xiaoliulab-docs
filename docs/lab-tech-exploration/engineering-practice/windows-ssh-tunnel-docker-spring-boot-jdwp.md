---
title: "Windows 通过 SSH 隧道远程调试 Docker 中的 Spring Boot（JDWP）"
description: "介绍如何在 Windows 开发机上，通过 SSH 隧道安全连接 Linux Docker 容器中的 Spring Boot JDWP 调试端口，在不改变业务服务原有公网入口、不重新发布服务的情况下，用 IDEA 临时保留现场并进行远程调试。"
keywords:
  - Spring Boot
  - JDWP
  - Remote Debug
  - SSH Tunnel
  - Docker
  - IntelliJ IDEA
  - Windows
  - 远程调试
---

# Windows 通过 SSH 隧道远程调试 Docker 中的 Spring Boot（JDWP）

## 背景

有些问题只在当前运行现场才能观察到。

例如测试环境偶发出现：

```text
某个字段值异常
某个条件分支没有按预期执行
某个第三方回调进入了意外路径
某个线程中的运行时变量无法从日志判断
```

如果为了排查临时增加日志，就需要：

```text
修改代码
↓
重新构建
↓
重新发布
↓
重启服务
```

但服务一旦重启，原来的运行现场可能已经消失。

这种情况下，可以临时使用 JVM 的 JDWP Remote Debug，让本地 IDEA 直接附加到正在运行的 JVM。

本文的前提是：

> Spring Boot 业务服务正常只通过域名 / HTTP / HTTPS 对外提供，不额外把 JDWP 调试端口暴露到公网。

调试时只增加一条临时链路：

```text
Windows IDEA
↓
Windows 127.0.0.1:5005
↓
SSH 隧道
↓
Linux 127.0.0.1:5005
↓
Docker 端口映射
↓
容器中的 JVM JDWP
```

核心原则可以概括成一句：

> 不改变业务服务原有公网入口，只为 JDWP 增加一条临时、只经过 SSH 的本地访问链路。

## 适用场景

这套方式比较适合：

- Spring Boot 服务运行在 Linux Docker 容器中；
- Windows 本地使用 IntelliJ IDEA；
- 测试环境或预发布环境出现偶发问题；
- 不希望为了排查临时增加日志并重新发布；
- 担心服务重启后现场丢失；
- Linux 主机已经具备 SSH 访问能力；
- 不希望把 5005 等 JDWP 端口直接暴露到公网。

生产环境需要慎用。

JDWP 调试能力很强，断点、变量查看和线程暂停等操作都有可能影响业务执行和时序，因此更适合作为受控的临时诊断手段，而不是长期开放的生产接口。

## 整体架构

正常业务链路保持不变：

```text
公网
↓
域名 / HTTPS
↓
Nginx / 网关
↓
Spring Boot
```

调试链路单独存在：

```text
IDEA
↓
Windows localhost:5005
↓
SSH
↓
Linux localhost:5005
↓
Docker
↓
JVM JDWP
```

这里有三个容易混淆的地址。

### Windows 127.0.0.1:5005

这是 IDEA 实际连接的位置：

```text
localhost:5005
```

外部机器无法直接通过这个端口连接 Windows 上的调试隧道。

### Linux 127.0.0.1:5005

Docker 只把容器中的 JDWP 端口发布到 Linux 宿主机本地：

```bash
-p 127.0.0.1:5005:5005
```

因此即使 Linux 主机本身拥有公网 IP，5005 也不会直接监听公网网卡。

### 容器 0.0.0.0:5005

JVM 运行在容器内部。

JDWP 需要监听容器网络接口：

```text
0.0.0.0:5005
```

Docker 再负责把 Linux 主机的：

```text
127.0.0.1:5005
```

转发到容器：

```text
5005
```

## Docker 容器开启 JDWP

本文实际使用的是 JDK 8 Docker 环境。

JVM 增加：

```text
-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=0.0.0.0:5005
```

几个参数的含义：

| 参数 | 含义 |
| --- | --- |
| `transport=dt_socket` | 使用 Socket 进行调试通信 |
| `server=y` | JVM 作为调试服务端等待 Debugger 连接 |
| `suspend=n` | JVM 启动时不等待调试器，应用正常启动 |
| `address=0.0.0.0:5005` | 在容器网络接口监听 5005 |

对于测试环境，通常使用：

```text
suspend=n
```

否则如果 Debugger 没有连接，应用会在启动阶段一直等待。

不同 JDK 版本的 JDWP `address` 语义存在差异，如果不是本文使用的 JDK 8 环境，应先确认当前 JDK 对 JDWP 地址参数的支持方式。

## Docker 只在宿主机 localhost 发布 JDWP

调试端口不要这样发布：

```bash
-p 5005:5005
```

因为这种方式会把 Docker 端口发布到宿主机所有网络接口。

本文使用：

```bash
-p 127.0.0.1:5005:5005
```

这样 Linux 主机只能通过：

```text
127.0.0.1:5005
```

访问 JDWP。

公网无法直接连接该端口。

一个完整的 Docker 启动示例：

```shell
docker run \
  -e JAVA_TOOL_OPTIONS="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=0.0.0.0:5005" \
  -e SERVER_PORT=8003 \
  --name xxx \
  -p 8003:8003 \
  -p 127.0.0.1:5005:5005 \
  -d openjdk:8u322-jdk-bullseye
```

其中业务端口：

```text
8003
```

仍然按照原项目方式提供服务。

调试端口：

```text
5005
```

只绑定 Linux 本机。

如果业务本身只通过 Nginx / 域名对外，也可以继续按照原有网络架构配置业务端口，不需要因为 Remote Debug 改变现有公网入口。

## Linux 主机先验证 JDWP

启动容器后，可以在 Linux 主机检查端口：

```bash
ss -lntp | grep 5005
```

期望看到类似：

```text
127.0.0.1:5005
```

而不是：

```text
0.0.0.0:5005
```

也可以在 Linux 本机测试：

```bash
telnet 127.0.0.1 5005
```

这里只需要确认 TCP 可以建立连接。

JDWP 不是普通 HTTP 协议，因此不需要期待返回可读文本。

## Windows 配置 SSH Key

如果每次建立隧道都需要输入 SSH 密码，使用体验会比较差。

可以为这台 Linux 主机单独准备 SSH Key。

以下示例可以在 Git Bash、WSL 或其他支持 OpenSSH 的 Windows 环境中执行。

### 生成 SSH Key

```bash
cd ~
mkdir -p .ssh
cd .ssh

ssh-keygen -t rsa -f for192.168.1.100
```

生成：

```text
for192.168.1.100
for192.168.1.100.pub
```

其中：

```text
for192.168.1.100
```

是私钥，不要泄露。

### 把公钥安装到 Linux

```bash
ssh-copy-id \
  -i ./for192.168.1.100.pub \
  root@192.168.1.100
```

首次需要输入 Linux 主机密码。

安装成功以后，再连接这台主机就可以使用 SSH Key。

实际环境中不一定需要使用 `root`，更推荐使用具备必要权限的普通运维账号。

## 配置 Windows SSH Client

编辑：

```text
~/.ssh/config
```

加入：

```sshconfig
# 文件：~/.ssh/config
Host debug-server
    HostName 192.168.1.100
    User root
    PreferredAuthentications publickey
    IdentityFile ~/.ssh/for192.168.1.100
```

这样以后不需要记：

```text
root@192.168.1.100
```

只需要：

```bash
ssh debug-server
```

## 验证免密登录

执行：

```bash
ssh debug-server
```

如果能够直接进入 Linux 主机，说明 SSH Key 配置成功。

## 建立 SSH 隧道

最基本的命令是：

```bash
ssh \
  -L 127.0.0.1:5005:127.0.0.1:5005 \
  debug-server
```

参数含义：

| 部分 | 含义 |
| --- | --- |
| 第一个 `127.0.0.1:5005` | Windows 本地监听地址 |
| `debug-server` | SSH 目标 Linux 主机 |
| 第二个 `127.0.0.1:5005` | SSH 连接到 Linux 后访问的目标地址 |

链路就是：

```text
Windows 127.0.0.1:5005
↓
SSH
↓
Linux 127.0.0.1:5005
```

如果只是建立隧道，不需要登录远程 Shell，可以加：

```text
-N
```

最终：

```bash
ssh \
  -N \
  -L 127.0.0.1:5005:127.0.0.1:5005 \
  debug-server
```

该终端需要保持运行。

关闭 SSH 进程后，调试隧道也会随之关闭。

这种行为反而很适合临时调试：

> 需要时建立，不需要时关闭，不让 JDWP 长期处于可访问状态。

## 把隧道也写进 SSH Config

如果经常调试同一台测试机，可以继续简化：

```sshconfig
# 文件：~/.ssh/config
Host debug-server
    HostName 192.168.1.100
    User root
    PreferredAuthentications publickey
    IdentityFile ~/.ssh/for192.168.1.100
    LocalForward 127.0.0.1:5005 127.0.0.1:5005
```

以后只需要：

```bash
ssh -N debug-server
```

就可以建立整个调试隧道。

## 验证 Windows 本地端口

SSH 隧道建立以后，可以在 Windows 检查：

```bash
netstat -ano | grep 5005
```

或者 Git Bash 中：

```bash
netstat -ano | grep 5005
```

应该能看到 Windows 本地：

```text
127.0.0.1:5005
```

正在监听。

这时：

```text
Windows localhost:5005
```

实际上已经被映射到：

```text
Linux localhost:5005
```

最终再进入 Docker 中的 JVM JDWP。

## IntelliJ IDEA 配置 Remote Debug

在 IntelliJ IDEA 中打开：

```text
Run
↓
Edit Configurations
↓
+
↓
Remote JVM Debug
```

配置：

```text
Host: localhost
Port: 5005
```

然后点击：

```text
Debug
```

IDEA 并不知道后面存在：

```text
SSH
Docker
Linux
```

对 IDEA 来说，它只是连接：

```text
localhost:5005
```

后面的网络转发全部由 SSH 和 Docker 完成。

## 实际排查方式

Remote Debug 的价值不只是“可以打断点”。

它更重要的使用场景是：

> 在不修改代码、不重新发布、不破坏当前现场的前提下，直接观察当前 JVM 的执行状态。

例如测试环境刚刚复现了一个偶发问题。

这时可以：

```text
保持当前服务不重启
↓
建立 SSH Tunnel
↓
IDEA Attach
↓
在怀疑的位置增加断点
↓
等待下一次请求进入
↓
观察变量和实际执行路径
```

如果问题和当前内存状态有关，还可以直接查看：

```text
方法参数
局部变量
对象字段
条件分支
异常对象
调用栈
```

相比：

```text
猜测问题
↓
增加日志
↓
重新发布
↓
再次等待复现
```

Remote Debug 在测试环境里往往能明显缩短定位时间。

## 为什么不直接开放 5005

最简单的做法当然是：

```bash
-p 5005:5005
```

然后 IDEA 直接连接：

```text
server-public-ip:5005
```

但 JDWP 本身不是一个应该直接暴露到公网的业务协议。

调试器连接 JVM 后可以获得非常强的运行时控制能力。

因此本文不把“保护一个公网 JDWP”作为目标，而是直接避免它成为公网入口：

```text
公网
X
5005

SSH
✓
22

Linux localhost
✓
5005
```

也就是说：

> 不去考虑怎样把 JDWP 安全地开放到公网，而是让它根本不出现在公网。

## 生产环境为什么要慎用

这套方案技术上同样可以连接生产 JVM，但生产环境需要特别谨慎。

Remote Debug 可能带来的影响包括：

```text
断点暂停业务线程
改变业务执行时序
增加接口响应时间
误操作变量或执行流程
```

尤其是在：

```text
支付
订单
资金
回调
```

这类业务里，一个断点就可能改变原来的运行行为。

因此更推荐：

```text
开发环境
测试环境
预发布环境
```

用于 Remote Debug。

生产环境只有在明确评估风险、控制访问权限，并且普通日志、监控、Arthas、JFR 等方式无法解决问题时，再考虑作为临时诊断手段。

## 故障排查

### IDEA 无法连接 localhost:5005

按照链路逐层检查：

```text
1. JVM 是否已经开启 JDWP？
2. 容器内部是否监听 5005？
3. Docker 是否映射到 Linux 127.0.0.1:5005？
4. Linux 本机是否能连接 127.0.0.1:5005？
5. SSH Tunnel 是否正在运行？
6. Windows 是否监听 127.0.0.1:5005？
7. IDEA 是否连接 localhost:5005？
```

不要一开始就修改防火墙。

这条链路设计的目标本来就是：

> JDWP 不需要穿过公网防火墙。

### 容器启动后一直不提供服务

检查是否误用了：

```text
suspend=y
```

如果配置成：

```text
suspend=y
```

JVM 会等待 Debugger 连接以后才继续启动。

普通临时远程调试通常使用：

```text
suspend=n
```

### Linux 上看到 0.0.0.0:5005

检查 Docker 参数是否写成：

```bash
-p 5005:5005
```

应该改成：

```bash
-p 127.0.0.1:5005:5005
```

要区分：

```text
容器内 JVM 监听 0.0.0.0:5005
```

和：

```text
Linux 宿主机发布 127.0.0.1:5005
```

两者不是同一层网络。

## 最终链路

整个方案最终只有三层：

```text
IDEA
Windows localhost:5005
        │
        │ SSH LocalForward
        ▼
Linux localhost:5005
        │
        │ Docker Port Mapping
        ▼
Container 5005
        │
        ▼
JVM JDWP
```

业务服务原来的访问方式完全不用改变：

```text
用户
↓
域名 / HTTPS
↓
Nginx / 网关
↓
Spring Boot
```

Remote Debug 只是临时增加了一条独立诊断链路。

## 总结

这套方案解决的并不是“如何把 JDWP 暴露出去”，而是：

> 如何在不增加新的公网入口、不修改业务代码、不重新发布服务的情况下，临时连接当前正在运行的 JVM。

它特别适合测试环境中那些：

```text
刚刚复现
现场还在
一重启可能就消失
```

的问题。

最终原则很简单：

> 业务入口继续只通过原有域名提供；JDWP 只绑定 Linux localhost；Windows IDEA 通过 SSH Tunnel 临时连接。

需要时建立隧道，排查完成后关闭。

这样既保留了 Remote Debug 的排障效率，也不会为了调试额外长期暴露一个 JVM 端口。
