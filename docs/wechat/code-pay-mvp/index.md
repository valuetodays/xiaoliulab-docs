---
title: 微信 Code Pay 付款码支付教程：Spring Boot 最小实现
description: 使用 Java、Spring Boot 和 weixin-java 接入微信 Code Pay，通过用户付款码 auth_code 完成商户扫码收款，并说明订单查询与支付回调流程。
head:
  - - meta
    - name: keywords
      content: 微信 Code Pay,微信付款码支付,微信支付 auth_code,商户扫码收款,Spring Boot 微信支付,weixin-java
---

# 微信 Code Pay 最小接入指南

## 0. 阅读说明

> 本文只讨论一个最小闭环：在配置正确的前提下，如何使用用户付款码 `auth_code` 完成 Code Pay 扣款。

> 默认你已经完成商户号、证书以及 yml 配置，本文不再介绍这些内容。见[微信支付接入路线](/wechat/getting-started/)。

> 查询订单和支付回调与 Native Pay 基本一致，本文只做链接说明，不重复展开。

> 文中的示例代码版本：
>
> - Java 25
>
> - Spring Boot 3.5.12
>
> - weixin-java（wx-java-pay）4.8.3.B

## 1. Code Pay 适用场景

Code Pay 适合 **商户主动扫用户付款码** 的场景。

典型流程：

```plaintext
用户打开微信付款码
  ↓
商户设备 / 扫码枪读取付款码
  ↓
后端拿到 auth_code
  ↓
后端调用微信支付 Code Pay 接口
  ↓
微信直接完成扣款或返回支付中
  ↓
后端根据返回结果 / 主动查单 / 回调确认最终状态
```

Code Pay 的核心不是“生成二维码”，而是：

```plaintext
拿到用户付款码 auth_code 后，后端直接发起扣款。
```

和 Native Pay 的区别：

```plaintext
Native Pay：商户生成付款二维码，用户扫码付款。
Code Pay：用户展示付款码，商户扫码扣款。
```

## 2. 环境准备

### springboot 引入 wx-java-pay

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.12</version>
    <relativePath/>
</parent>

<properties>
    <java.version>25</java.version>
    <maven.compiler.source>${java.version}</maven.compiler.source>
    <maven.compiler.target>${java.version}</maven.compiler.target>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>
    <!-- https://github.com/binarywang/WxJava -->
    <wx-java.version>4.8.3.B</wx-java.version>
</properties>

<dependency>
    <groupId>com.github.binarywang</groupId>
    <artifactId>wx-java-pay-spring-boot-starter</artifactId>
    <version>${wx-java.version}</version>
</dependency>
```

### yml 配置已正确

本文默认以下配置已经完成：

```yaml
wx:
  pay:
    app-id: xxx
    mch-id: xxx
    # APIv3 密钥：商户平台 → API安全 → 解密回调 → APIv3密钥
    api-v3-key: xxx
    # 商户 API 证书，来自 xxxx_cert.zip 解压后的 apiclient_key.pem
    private-key-path: xxx
    # 商户 API 证书，来自 xxxx_cert.zip 解压后的 apiclient_cert.pem
    private-cert-path: xxx
    notify-url: https://你的域名/wxpay/pay/notify
    # 商户 API 证书序列号：商户平台 → API安全 → 商户API证书 → 管理证书 里的序列号
    cert-serial-no: xxx
    # 微信支付公钥文件
    public-key-path: xxxx
    # 微信支付公钥ID
    public-key-id: PUB_KEY_ID_xxxx
```

注意：字段名以项目实际配置类为准。

本文不展开证书、商户号、API v3 Key 的配置过程，只验证三件事：

```plaintext
1. 能否使用付款码 auth_code 发起 Code Pay
2. 能否主动查询订单状态
3. 能否收到并处理微信支付回调
```

## 3. 问题一：如何使用 auth_code 发起 Code Pay

### 3.1 后端核心代码

```java
@Test
public void testCodePay() {
    // 微信收款码（条形码）中的数字就是这样带空格的，方便人浏览
    String authCode = "13 0894 7568 8822 6930".replace(" ", "");
    String outTradeNo = 自己生成唯一编号；

    WxPayCodepayRequest request = new WxPayCodepayRequest();
    request.setDescription("小刘codepay支付测试");
    request.setOutTradeNo(outTradeNo);

    WxPayCodepayRequest.Amount amount = new WxPayCodepayRequest.Amount();
    amount.setTotal(1); // 单位：分。这里是 0.01 元
    amount.setCurrency(WxPayConstants.CurrencyType.CNY);
    request.setAmount(amount);

    WxPayCodepayRequest.Payer payer = new WxPayCodepayRequest.Payer();
    payer.setAuthCode(authCode);
    request.setPayer(payer);

    WxPayCodepayRequest.SceneInfo sceneInfo = new WxPayCodepayRequest.SceneInfo();
    WxPayCodepayRequest.StoreInfo storeInfo = new WxPayCodepayRequest.StoreInfo();
    storeInfo.setOutId("xiaoliu-lab-test-store");
    sceneInfo.setStoreInfo(storeInfo);
    request.setSceneInfo(sceneInfo);

    try {
        WxPayCodepayResult codepayResp = wxPayService.codepay(request);
        log.info("codepayResp={}", codepayResp);
    } catch (WxPayException e) {
        throw BizAssert.createNewException("微信 Code Pay 下单失败：" + e.getMessage(), e);
    }
}
```

### 3.2 关键点

`auth_code` 是用户微信付款码内容，一般来自：

```plaintext
1. 扫码枪
2. 收银设备
3. 前端页面输入测试
4. 开发阶段手工复制测试
```

`outTradeNo` 必须由你自己的系统生成，并落库保存。

Code Pay 和 Native Pay 不一样，它不会返回 `code_url`。

它的核心结果是：

```plaintext
1. 本次扣款是否成功
2. 是否处于 USERPAYING 等待用户确认
3. 是否需要主动查单确认最终结果
```

### 3.3 scene_info 不能省略

Code Pay 下单时，`scene_info` 是必填字段。

最小可用配置可以先传门店信息：

```java
WxPayCodepayRequest.SceneInfo sceneInfo = new WxPayCodepayRequest.SceneInfo();
WxPayCodepayRequest.StoreInfo storeInfo = new WxPayCodepayRequest.StoreInfo();
storeInfo.setOutId("xiaoliu-lab-test-store");
sceneInfo.setStoreInfo(storeInfo);
request.setSceneInfo(sceneInfo);
```

如果不传，可能会遇到类似错误：

```plaintext
/body/scene_info 映射到字段“场景信息”必填性规则校验失败，此字段为必填项
```

## 4. 问题二：如何查询订单

Code Pay 的查单逻辑与 Native Pay 一致。
详见：

- [微信 Native 支付最小接入指南 - 如何查询订单](/wechat/native-pay-mvp/#_4-问题二-如何查询订单-主动查单)




可以直接参考：

```plaintext
微信 Native 支付最小接入指南
问题二：如何查询订单（主动查单）
```

常用方式仍然是按商户订单号查询：

```java
WxPayOrderQueryV3Result result = wxPayService.queryOrderV3(null, outTradeNo);

String tradeState = result.getTradeState();
String tradeStateDesc = result.getTradeStateDesc();
String transactionId = result.getTransactionId();
```

常见状态：

```plaintext
SUCCESS     支付成功
NOTPAY      未支付
USERPAYING  用户支付中
CLOSED      已关闭
REVOKED     已撤销
PAYERROR    支付失败
```

对于 Code Pay，尤其要注意 `USERPAYING`。

这表示用户可能还在输入密码、指纹确认或刷脸确认，此时不要立刻当作失败处理。

建议做法：

```plaintext
如果返回 SUCCESS：
    更新本地订单为支付成功

如果返回 USERPAYING：
    等待几秒后主动查单

如果返回明确失败：
    标记失败或允许重新发起支付
```

## 5. 问题三：如何处理支付回调

Code Pay 的支付回调与 Native Pay 一致。

详见：

- [微信 Native 支付最小接入指南 - 支付回调](/wechat/native-pay-mvp/#_5-问题三-如何处理支付回调-notify-url)


可以直接参考：

```plaintext
微信 Native 支付最小接入指南
问题三：如何处理支付回调（notify_url）
```

需要注意：

```plaintext
1. notify_url 必须是公网 HTTPS
2. notify_url 不能要求用户登录
3. notify_url 不能被 token、拦截器、网关鉴权拦住
4. 回调处理必须幂等
5. 回调中必须校验金额
```

回调接口仍然不是给前端调用的，而是给微信支付服务器调用的。

## 6. 为什么 Code Pay 也需要主动查单？

Code Pay 是商户主动扣款，正常情况下接口返回就能得到一部分结果。

但在以下场景中，仍然需要主动查单：

```plaintext
1. 用户正在输入密码，返回 USERPAYING
2. 请求超时，不确定微信侧是否已经扣款
3. 本地服务异常，不确定订单是否成功
4. 回调还没到，但页面需要尽快展示结果
```

所以 Code Pay 推荐同时使用：

```plaintext
接口返回：判断本次调用的即时结果
主动查单：确认不确定状态
支付回调：作为后端可靠更新来源
```

也就是说：

```plaintext
Code Pay 不是只看接口返回，最终状态仍然要以微信订单状态为准。
```

## 7. 最小验收标准

Code Pay 文档对应的功能完成后，应能验证：

```plaintext
1. 能够拿到用户付款码 auth_code
2. 后端能够生成 out_trade_no
3. 后端能够调用 wxPayService.codepay(request)
4. 金额为 1 分时能够完成测试扣款
5. 如果返回 USERPAYING，能够通过主动查单确认最终状态
6. 支付后微信能回调 notify_url
7. 本地订单状态能变成 SUCCESS
```

只要这 7 点成立，就说明 Code Pay 的核心链路已经跑通。

## 8. 调试顺序（推荐）

```plaintext
第一步：
先写一个 JUnit，手机打开微信付款码（点击条形码，显示一长串数字，即是auth_code），手工填入 auth_code，调用 wxPayService.codepay(request)。

第二步：
确认 scene_info 已传，至少包含 store_info.out_id。

第三步：
使用 1 分钱金额测试扣款。

第四步：
如果返回 SUCCESS，确认本地订单可以更新为成功。

第五步：
如果返回 USERPAYING，等待几秒后主动查单。

第六步：
确认支付回调能够正常收到。

第七步：
最后再编写订单状态更新等业务逻辑，并保证回调处理具有幂等性。
```

## 9. 常见问题定位

```plaintext
1. 提示 scene_info 必填
→ 检查 request.setSceneInfo(sceneInfo) 是否已设置
→ 检查 store_info.out_id 是否已设置

2. 提示 auth_code 无效
→ 检查付款码是否已经过期
→ 检查是否复制时带入空格
→ 检查付款码是否已经被使用

3. 用户正在支付中
→ 这是 USERPAYING 场景，不要立即判定失败
→ 等待几秒后主动查单

4. 请求超时
→ 不要直接重新扣款
→ 先使用 out_trade_no 主动查单确认状态

5. 回调收不到
→ 检查 notify_url 是否公网 HTTPS
→ 检查 notify_url 是否允许匿名访问，不要被登录拦截器、鉴权网关、白名单拦住
→ 检查服务器防火墙、安全组、Nginx 是否放行对应路径

6. 用户支付成功但系统未更新
→ 检查回调处理是否正常
→ 检查主动查单是否同步本地订单状态
→ 检查订单更新逻辑是否幂等
```

## 10. 阅读更多

```plaintext
📚 微信支付系列

✅ Native 支付最小接入指南
✅ JSAPI 支付最小接入指南
✅ Code Pay 最小接入指南
□ Refund 最小接入指南
□ Refund Notify 最小接入指南
□ 常见错误汇总
□ 微信支付最佳实践
```

👉 微信公众号：小刘实验室（持续更新支付/后端实践）

<img
  src="/images/xiaoliulab-mp-qrcode.png"
  alt="小刘实验室公众号"
  width="320"
/>
