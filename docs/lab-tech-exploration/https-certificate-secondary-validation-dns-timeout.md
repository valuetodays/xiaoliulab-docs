---
title: HTTPS 证书申请失败排查：secondary validation DNS timeout
description: 记录 1Panel 申请 HTTPS 证书时遇到 secondary validation DNS timeout 的排查过程、交叉验证方法与证据边界。
date: 2026-08-25
category: 技术探索
head:
  - - meta
    - name: keywords
      content: HTTPS, ACME, Let's Encrypt, ZeroSSL, 1Panel, HTTP-01, DNS-01, secondary validation, DNS timeout, CAA, 火山引擎 DNS
---

# HTTPS 证书申请失败排查：secondary validation DNS timeout

为了保护隐私，本文使用 `example.cn` 替代真实域名。

在 1Panel 中为域名申请 HTTPS 证书时，遇到了：

```text
During secondary validation:
DNS problem: query timed out
```

本文记录一次真实排查过程。重点不是给出一个未经证实的根因，而是说明：

> 出现 `secondary validation` 和 `DNS query timed out` 时，如何保存现场、验证 DNS / HTTP 链路，并明确现有证据的边界。

---

## 1. 问题背景与环境

排查日期：

```text
2026-08-25
```

环境：

```text
服务器：火山云 ECS
Web 管理：1Panel
Web Server：OpenResty / Nginx
DNS：火山引擎 DNS

权威 DNS：
ns1.volcengine-dns.com
ns2.volcengine-dns.com
```

当时未留存以下版本信息：

```text
1Panel 具体版本
OpenResty / Nginx 具体版本
底层 ACME 客户端具体版本
```

测试涉及多个 `example.cn` 子域名。

开始排查前，已经确认：

```text
域名已经配置 A 记录
域名能够解析到目标服务器
80 端口可访问
1Panel 已创建网站
同一台服务器上的其它域名可以正常申请证书
```

这些条件只能降低 1Panel、服务器和基础网络整体异常的可能性，不能完全排除某个域名、某个时间点或某条验证路径上的问题。

---

## 2. 错误现象

Let's Encrypt + HTTP-01 申请时出现：

```text
invalid authorization:
acme: error: 400 ::
urn:ietf:params:acme:error:dns ::

During secondary validation:

DNS problem:
query timed out looking up A for fi.example.cn;

DNS problem:
query timed out looking up AAAA for fi.example.cn
```

另一个子域名也出现类似错误。

关键点不是：

```text
404
403
connection refused
```

而是：

```text
secondary validation
DNS query timed out
```

Let's Encrypt 官方公开介绍过 Multi-Perspective Validation：域名控制权验证会从多个网络视角进行，以降低单一路由或网络劫持带来的风险。

因此，出现 `secondary validation` 并不等于已经定位到某一段网络，只能说明：

> 至少有一个额外验证视角没有在预期时间内完成 DNS 查询。

官方说明：

<https://letsencrypt.org/2020/02/19/multi-perspective-validation.html>

---

## 3. 第一组假设：DNS 配置是否异常

首先使用多个公共 DNS 查询，结果均能解析到预期地址。

随后直接查询权威 DNS，A 记录也能正常返回。

AAAA 没有配置 IPv6，因此预期结果是权威 NODATA，而不是 timeout。

当时多次查询结果的共同特征如下。以下内容是**整理后的摘要，不是某一次完整 `dig` 原始输出**：

```text
status: NOERROR
flags: qr aa
ANSWER: 0
AUTHORITY: 1

Authority 中存在 example.cn 的 SOA
响应服务器为已查询的权威 DNS 地址
查询耗时约 2~33 ms
```

这里比单纯看到 `ANSWER: 0` 更重要的是：

```text
aa：权威应答
Authority 中存在 SOA
status: NOERROR
查询能够快速返回
```

这些特征共同说明：

> 在当时实际查询到的权威节点上，AAAA 是正常的权威 NODATA 响应，而不是 DNS 查询失败。

继续执行：

```bash
dig +trace fi.example.cn
```

能够完整走到：

```text
根 DNS
→ .cn
→ example.cn
→ ns1/ns2.volcengine-dns.com
→ fi.example.cn
```

还直接查询了当时解析得到的多个权威 DNS 地址，均能获得权威应答。

### 证据边界

这些结果可以说明：

> 在执行命令的位置和时间点，域名委派、A 查询以及当时实际查询到的权威 DNS 地址没有发现明显异常。

但不能说明：

```text
所有地域都正常
所有 Anycast 后端都正常
所有网络路径都正常
CA 的所有验证视角都能得到相同结果
```

---

## 4. 第二组假设：HTTP-01 链路是否异常

1Panel 为 HTTP-01 配置了类似：

```nginx
location ^~ /.well-known/acme-challenge/ {
    allow all;
    root /usr/share/nginx/html;
}
```

如果要手工验证这条路径，先在对应目录放置测试文件：

```bash
mkdir -p /usr/share/nginx/html/.well-known/acme-challenge
echo hello > /usr/share/nginx/html/.well-known/acme-challenge/test.txt
```

然后从目标服务器之外的公网环境访问：

```bash
curl --noproxy '*' \
  http://fi.example.cn/.well-known/acme-challenge/test.txt
```

使用 `--noproxy '*'` 是为了避免本地 HTTP 代理改变实际访问路径。

如果正常返回：

```text
hello
```

只能说明：

> 当前测试时刻下，这条公网 HTTP 路径可访问。

它不能完全等价于 1Panel 实际申请证书时的：

```text
challenge token
临时配置
配置 reload 时序
CA 实际访问路径
```

不过本次失败日志首先指向 DNS 查询超时，而不是 challenge 文件返回错误，因此 HTTP-01 路径本身不是最强嫌疑。

---

## 5. DNS-01 对照实验

为了绕开 HTTP challenge，又测试了 DNS-01。

手工添加：

```text
_acme-challenge.h5.example.cn
```

TXT 记录以后，可以通过 DNS 查询看到对应 token，随后 DNS-01 成功签发。

之后又在 1Panel 中配置火山 DNS API，让它自动创建 TXT。

这里所谓“自动创建正常”，只指：

```text
1Panel 已执行创建操作
火山 DNS 控制台中可以看到对应 TXT
当前递归 DNS 查询位置也能查到该 TXT
```

这并不等价于所有权威后端、所有地域或 CA 的所有验证视角都已经看到同一条 TXT。

另一次申请最终失败：

```text
During secondary validation:

DNS problem:
query timed out looking up TXT for
_acme-challenge.sh.example.cn
```

这里必须注意：

> 手工 DNS-01 成功和自动 DNS-01 失败并不是严格的单变量实验。

它们发生在：

```text
不同子域名
不同时间
不同申请轮次
```

因此只能记录：

> DNS-01 出现过成功，也出现过失败。

不能据此证明：

```text
手工优于自动
自动 DNS-01 有问题
某个子域名有问题
```

一次默认 `dig TXT` 成功，也只能说明当前递归 DNS 已经能看到 TXT。

如果要继续检查传播情况，应直接查询当时能够发现的权威服务器地址，并在需要时分别验证 UDP / TCP 53。

---

## 6. 切换 CA 与重试实验

随后在 1Panel 中增加 ZeroSSL ACME 账户，并继续使用 HTTP-01。

实际观察到：

```text
Let's Encrypt：
  HTTP-01 出现失败
  DNS-01 出现成功，也出现过失败

ZeroSSL：
  HTTP-01 出现失败
  随后重试成功
```

这些结果**不是同条件下的 CA 稳定性对照**。

因为期间同时变化了：

```text
验证方式
子域名
时间
重试次数
CA
```

因此不能得出：

```text
ZeroSSL 比 Let's Encrypt 稳定
问题根因在 Let's Encrypt
```

更合理的理解是：

> 切换 CA 会改变验证服务，并可能改变实际使用的验证节点或网络路径，因此可以作为诊断和临时绕行手段。

### 切换 CA 前先检查 CAA

CAA 应从**实际申请证书的域名**开始检查。如果当前名称没有 CAA，再按继承规则向父级查找；如果存在 CNAME，还需检查目标名称链。

例如域名最终只允许：

```text
CAA 0 issue "letsencrypt.org"
```

那么改用其它 CA 可能会因为 CAA 限制而失败。

Let’s Encrypt CAA 说明：

<https://letsencrypt.org/docs/caa/>

---

## 7. 现有证据与原因猜测

现有证据比较支持：

```text
本地和服务器侧没有发现明显 DNS 配置错误
已测试到的权威 DNS 地址可以正常响应
HTTP-01 challenge 路径没有发现明显配置异常
DNS-01 有成功案例，也有失败案例
切换 CA 后出现过失败，也出现过成功
```

但仍然不能确定：

```text
是哪一家 CA 的问题
是不是某个权威 DNS 后端的问题
是不是跨地域网络路径问题
是不是 Anycast 节点不同步
是不是 DNS 查询预算或瞬时延迟问题
```

更准确的说法是：

> 失败集中出现在 secondary validation 阶段，现象符合“某个额外验证视角下 DNS 查询未及时完成”，但现有证据不足以定位到更具体的网络、DNS 后端或 CA 内部行为。

可以做一个谨慎猜测：

```text
CA Primary Validation
        ↓
      正常

CA Secondary Validation
        ↓
  某个不同验证视角
        ↓
 DNS 查询未及时完成
        ↓
      timeout
```

可能涉及：

```text
权威 DNS 后端
Anycast 路由
跨地域网络路径
DNS 响应延迟
CA 的查询超时预算
瞬时故障
```

没有进一步证据之前，不继续缩小到某一家服务商或某一段网络。

---

## 8. 临时处理建议

出现：

```text
During secondary validation
DNS problem: query timed out
```

时，建议先保存现场，再考虑重试：

```text
1. 保存完整 ACME 日志和失败时间
2. 立即查询 A / AAAA / TXT
3. 查询当时能够发现的权威 DNS 地址
4. 必要时验证 UDP / TCP 53
5. 检查 HTTP-01 公网路径或 DNS-01 TXT
6. 从实际申请域名开始检查 CAA，并按继承规则向上确认
7. 保存完现场后等待一段时间再试
8. 持续失败时，可切换其它 CA 做对照或临时绕行
```

“切换 CA”不是根因修复，只是：

```text
诊断手段
临时绕行
```

不要持续高频重复申请，以免触发 CA 的失败验证或签发速率限制。

---

## 9. 附录：DNS-01 自动化的权限风险

DNS-01 自动化需要把 DNS API 凭证交给 1Panel。

如果服务商支持细粒度权限，应优先限制为：

```text
指定 DNS Zone
必要的 TXT 操作
_acme-challenge.*
```

如果只能授予类似：

```text
DNSFullAccess
```

则这仍然属于高价值权限。

凭证泄露可能导致：

```text
修改 A / CNAME
删除解析
网站流量劫持
邮件相关记录被修改
通过 DNS 验证重新申请证书
```

另一种进一步缩小权限面的做法是：

> 将 `_acme-challenge` 通过 CNAME 或 NS 委派到独立 DNS 区域，再让 ACME 自动化程序使用只能管理这个专用区域的凭证。

这样降低的是：

> **交给 ACME 自动化程序的专用 DNS 凭证泄露后的影响范围。**

它并不能降低主域名 DNS 管理凭证本身泄露后的风险，因为主域名管理员仍然可以修改这条委派关系。

---

## 10. 附录：排障命令

```bash
# 公共 DNS
nslookup fi.example.cn 1.1.1.1
nslookup fi.example.cn 8.8.8.8

# 完整委派链
dig +trace fi.example.cn

# 权威 DNS
nslookup -type=ns example.cn 8.8.8.8

# DNS-01 TXT
dig TXT _acme-challenge.fi.example.cn

# 假设当时查到的权威 DNS 地址为 180.184.1.138
dig @180.184.1.138 TXT _acme-challenge.fi.example.cn
dig +tcp @180.184.1.138 TXT _acme-challenge.fi.example.cn

# 从实际申请域名向父级检查 CAA
dig CAA fi.example.cn
dig CAA example.cn
```

如果 `fi.example.cn` 是 CNAME，还应继续检查其目标名称链。

HTTP-01 测试前先创建测试文件：

```bash
mkdir -p /usr/share/nginx/html/.well-known/acme-challenge
echo hello > /usr/share/nginx/html/.well-known/acme-challenge/test.txt
```

然后从目标服务器之外的公网环境执行：

```bash
curl --noproxy '*' -i \
  http://fi.example.cn/.well-known/acme-challenge/test.txt
```

---

这次排查没有得到一个可以严格证明的单一根因。

更实用的经验是：

> 当 ACME 已经明确报 `secondary validation` 和 `DNS query timed out` 时，先保存现场，再验证 DNS、HTTP、CAA 和当时能够观察到的权威节点；如果基础配置没有发现明显异常，可以等待重试，或者切换其它 CA 做对照，而不是反复修改已经验证正常的配置。
