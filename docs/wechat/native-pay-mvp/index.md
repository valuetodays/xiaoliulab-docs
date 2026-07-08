# 微信 Native Pay 最小接入指南

## 0. 阅读说明

> 本文只讨论一个最小闭环：在配置正确的前提下，如何生成 `code_url`、如何查询订单、如何处理支付回调。

> 默认你已经完成商户号、证书以及 yml 配置，本文不再介绍这些内容。见[微信支付接入路线](/wechat/getting-started/)。

> 文中的示例代码版本：
>
> - Java 25
>
> - Spring Boot 3.5.12
>
> - weixin-java（wx-java-pay）4.8.3.B

## 1. Native Pay 适用场景

Native Pay 适合 **PC 页面扫码支付**。

典型流程：

```plaintext
用户在 PC 页面点击支付
  ↓
后端调用微信支付 Native 下单接口
  ↓
微信返回 code_url
  ↓
前端把 code_url 渲染成二维码
  ↓
用户用微信扫码付款
  ↓
微信异步回调后端 notify_url
  ↓
后端更新订单状态
  ↓
前端轮询查询订单状态
```

Native Pay 的核心不是“前端拉起支付”，而是：

```plaintext
后端生成 code_url，前端展示二维码。
```

## 2. 环境准备

### springboot引入wx-java-pay

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
1. 能否创建 Native 支付单并拿到 code_url
2. 能否主动查询订单状态
3. 能否收到并处理微信支付回调
```


## 3. 问题一：如何生成 code\_url（Native 下单）

### 3.1 后端核心代码

```java
    @Test
    public void testNativePay() {
        String outTradeNo = 自己生成唯一编号；

        WxPayUnifiedOrderV3Request request = new WxPayUnifiedOrderV3Request();
        request.setDescription("小刘native支付测试");
        request.setOutTradeNo(outTradeNo);

        // 如果 WxPayConfig 里已经 setNotifyUrl，这里可以不 set。
        // 但建议显式 set，方便排查。
        request.setNotifyUrl(wxPayService.getConfig().getNotifyUrl());

        WxPayUnifiedOrderV3Request.Amount amount = new WxPayUnifiedOrderV3Request.Amount();
        amount.setTotal(1); // 单位：分。这里是 0.01 元
        amount.setCurrency(WxPayConstants.CurrencyType.CNY);
        request.setAmount(amount);

        try {
            // Native 模式：返回 code_url
            String codeUrl = wxPayService.createOrderV3(TradeTypeEnum.NATIVE, request);
            log.info("codeUrl={}", codeUrl);
        } catch (WxPayException e) {
            throw BizAssert.createNewException("微信 Native Pay 下单失败：" + e.getMessage(), e);
        }
    }
```

### 3.2 关键点

`outTradeNo` 必须由你自己的系统生成，并落库保存。

建议保存：

```plaintext
out_trade_no
amount
pay_status
code_url
create_time
update_time
```

`code_url` 不是支付结果，只是二维码内容。用户是否支付成功，要看：

```plaintext
1. 微信异步回调
2. 主动查单结果
```


## 4. 问题二：如何查询订单（主动查单）

### 4.1 后端核心代码

```java
WxPayOrderQueryV3Result result = wxPayService.queryOrderV3(null, outTradeNo);

String tradeState = result.getTradeState();
String tradeStateDesc = result.getTradeStateDesc();
String transactionId = result.getTransactionId();
```

如果使用的是按商户订单号查询，一般传：

```java
wxPayService.queryOrderV3(null, outTradeNo);
```

如果按微信支付订单号查询，则传：

```java
wxPayService.queryOrderV3(transactionId, null);
```

### 4.2 常见状态

```plaintext
SUCCESS     支付成功
NOTPAY      未支付
USERPAYING  用户支付中
CLOSED      已关闭
REVOKED     已撤销
PAYERROR    支付失败
```

Native Pay 页面通常需要前端轮询查询：

```plaintext
每 2~3 秒查一次
最多查询 1~2 分钟
成功后停止轮询
超时后提示用户刷新或重新发起支付
```

## 5. 问题三：如何处理支付回调（notify\_url）

> 微信支付回调是由微信服务器主动请求你的 `notify_url`，因此该接口不能依赖用户登录态，也不能要求携带业务 token。

### 5.1 回调接口

微信支付会请求你配置的 `notify_url`：

```http
POST /wxpay/pay/notify
```

这个接口不是给前端调用的，而是给微信支付服务器调用的。

### 5.2 回调处理流程

```plaintext
收到微信回调
  ↓
验签 / 解密通知数据
  ↓
拿到 out_trade_no、transaction_id、trade_state、amount
  ↓
根据 out_trade_no 查询本地订单
  ↓
校验金额是否一致
  ↓
幂等更新订单状态为支付成功
  ↓
返回 SUCCESS 给微信
```

### 5.3 后端核心代码

具体方法名以项目当前使用的 `weixin-java-pay` 版本为准，伪代码如下：

```java
@PostMapping("/wxpay/pay/notify")
public Map<String, String> wxPayNotify(@RequestBody String body,
                                       @RequestHeader("Wechatpay-Timestamp") String timestamp,
                                       @RequestHeader("Wechatpay-Nonce") String nonce,
                                       @RequestHeader("Wechatpay-Signature") String signature,
                                       @RequestHeader("Wechatpay-Serial") String serial) {
    SignatureHeader signatureHeader = SignatureHeader.builder()
                    .timeStamp(timestamp)
                    .nonce(nonce)
                    .signature(signature)
                    .serial(serial)
                    .build();
    WxPayNotifyV3Result notifyV3Result = wxPayService.parseOrderNotifyV3Result(body, signatureHeader);
    WxPayNotifyV3Result.DecryptNotifyResult result = notifyV3Result.getResult();

    String outTradeNo = result.getOutTradeNo();
    String transactionId = result.getTransactionId();
    String tradeState = result.getTradeState();
    Integer total = result.getAmount().getTotal();
    // 处理业务
    return Map.of("code", "SUCCESS", "message", "成功");
}
```

### 5.4 幂等要求

微信回调可能重复发送，所以回调处理必须幂等。

建议逻辑：

```plaintext
如果本地订单已经是 SUCCESS：
    直接返回成功
否则：
    校验金额
    更新状态为 SUCCESS
    保存 transaction_id
    保存 success_time
```

不要因为重复回调导致：

```plaintext
重复加积分
重复发货
重复记账
重复触发实验完成事件
```


## 6. 为什么已经有支付回调，还需要主动查单？

回调是后端最终确认支付结果的重要来源，但前端页面无法直接感知回调。

所以 Native Pay 通常同时使用：

```plaintext
微信回调：负责后端可靠更新订单状态
前端查单：负责页面及时展示支付结果
```

也就是说：

```plaintext
回调更新库，查单读状态。
```

如果页面轮询时本地状态还没更新，也可以由后端主动调用微信查单，再同步本地状态。

## 7. 最小验收标准

Native Pay 文档对应的功能完成后，应能验证：

```plaintext
1. 点击创建支付单后，后端返回 code_url
2. 前端能把 code_url 渲染成二维码
3. 微信扫码后能正常付款
4. 支付后微信能回调 notify_url
5. 本地订单状态能变成 SUCCESS
6. 前端查询订单能看到 SUCCESS
```

只要这 6 点成立，就说明 Native Pay 的核心链路已经跑通。

## 8. 调试顺序（推荐）

```plaintext
第一步：
先写一个 JUnit，调用 createOrderV3，确认能得到 code_url。

第二步：
将 code_url 粘贴到草料二维码等工具中生成二维码。

第三步：
使用微信扫码完成付款。

第四步：
实现查单接口，确认能够查询到订单状态。

第五步：
先不要编写业务逻辑，只打印支付回调日志，确认能够收到微信支付回调。

第六步：
最后再编写订单状态更新等业务逻辑，并保证回调处理具有幂等性。
```

## 9. 常见问题定位

```plaintext
1. 没有 code_url
→ 检查商户号 / APIv3 / 证书

2. 扫码无法支付
→ 检查金额是否为 1 分（0.01元）

3. 回调收不到
→ 检查 notify_url 是否公网 HTTPS
→ 检查 `notify_url` 是否允许匿名访问，不要被登录拦截器、鉴权网关、白名单拦住  
→ 检查服务器防火墙、安全组、Nginx 是否放行对应路径

4. 查单成功但回调失败
→ 回调网络问题，不影响支付结果

5. 用户支付成功但系统未更新
→ 回调幂等逻辑问题
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

👉 微信公众号：小刘信息技术工作室（持续更新支付/后端实践）
```
