# 微信 JSAPI Pay 最小接入指南

## 0. 阅读说明

> 本文只讨论一个最小闭环：在配置正确的前提下，如何在微信公众号网页内获取 `openid`、如何创建 JSAPI 支付单、如何让前端拉起微信支付、如何查询订单、如何处理支付回调。

> 默认你已经完成商户号、证书、API v3 Key、公众号与商户号绑定以及 yml 配置，本文不再介绍这些内容。见[微信支付接入路线](/wechat/getting-started/)。

> 文中的示例代码版本：
>
> - Java 25
>
> - Spring Boot 3.5.12
>
> - weixin-java（wx-java-pay）4.8.3.B

## 1. JSAPI Pay 适用场景

JSAPI Pay 适合 **微信公众号内 H5 页面拉起微信支付** 的场景。

典型流程：

```plaintext
用户从公众号菜单进入 H5 页面
  ↓
如果没有 openid，先跳转微信 OAuth 授权
  ↓
后端通过 code 换取 openid
  ↓
用户在微信内网页点击支付
  ↓
后端使用 openid 创建 JSAPI 支付单
  ↓
后端返回前端调起支付需要的参数
  ↓
前端调用 WeixinJSBridge.invoke('getBrandWCPayRequest', ...)
  ↓
用户在微信支付弹窗中确认付款
  ↓
微信异步回调后端 notify_url
  ↓
后端更新订单状态
  ↓
前端查询订单状态并展示结果
```

JSAPI Pay 的核心不是“生成二维码”，而是：

```plaintext
后端使用 openid 创建预支付单，前端在微信内网页拉起支付。
```

和 Native Pay、Code Pay 的区别：

```plaintext
Native Pay：商户生成付款二维码，用户扫码付款。
Code Pay：用户展示付款码，商户扫码扣款。
JSAPI Pay：用户在微信公众号网页内点击按钮，微信内置支付弹窗完成付款。
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
<dependency>
    <groupId>com.github.binarywang</groupId>
    <artifactId>wx-java-mp-spring-boot-starter</artifactId>
    <version>${wx-java.version}</version>
</dependency>
```

### yml 配置已正确

本文默认以下配置已经完成：

```yaml
wx:
  # com.binarywang.spring.starter.wxjava.mp.properties.WxMpProperties
  mp:
    app-id: xxx
    secret: xxx
    #token: 'xxx'，jsapi pay时不需要 token / aes-key / config-storage
    #aes-key: 'xxx'
    #config-storage:
    #  type: Memory
  # com.binarywang.spring.starter.wxjava.pay.properties.WxPayProperties
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

本文不展开证书、商户号、API v3 Key 的配置过程，只验证四件事：

```plaintext
1. 能否在微信公众号网页内拿到用户 openid
2. 能否使用 openid 创建 JSAPI 支付单
3. 前端能否调起微信支付弹窗
4. 能否查询订单并处理微信支付回调
```

## 3. JSAPI Pay 额外准备

JSAPI Pay 比 Native Pay、Code Pay 多几个前置条件。

```plaintext
1. 必须在微信内打开页面
2. 必须通过 OAuth 获取当前用户 openid
3. 公众号 appid 必须与商户号绑定
4. H5 页面域名需要完成 ICP 备案并配置 HTTPS
5. 需要在微信支付商户平台配置支付授权目录
6. OAuth 获取 openid 需要在公众号后台配置网页授权域名。
7. notify_url 必须是公网 HTTPS，且不能要求登录
```

其中最容易踩坑的是：

```plaintext
当前页面 URL 未注册
```

这通常不是代码问题，而是微信支付商户平台中的 **支付授权目录** 配置不正确。

## 4. 问题一：如何获取 openid

JSAPI Pay 创建订单时必须传 `openid`。

一般流程是：

```plaintext
公众号菜单 URL
  ↓
后端入口接口
  ↓
302 跳转到微信 OAuth 授权地址
  ↓
微信回调后端 callback，带 code 和 state
  ↓
后端用 code 换取 openid
  ↓
后端生成登录态或一次性 token
  ↓
跳回前端页面
```

最小流程可以先只做静默授权：

```plaintext
scope=snsapi_base
```

静默授权通常可以拿到 `openid`，不需要用户手动确认。

### 4.1 后端入口示例

```java
@GetMapping("/wx/oauth/entry")
public ResponseEntity<Void> entry(@RequestParam("to") String to) {
    String state = 生成并保存state，同时记录to;
    String redirectUri = "https://你的域名/wx/oauth/callback";

    // 为了安全考虑，建议检查 to 在白名单里

    String oauthUrl = wxMpService.getOAuth2Service().buildAuthorizationUrl(
            redirectUri,
            "snsapi_base",
            state
    );

    return ResponseEntity.status(HttpStatus.FOUND)
            .location(URI.create(oauthUrl))
            .build();
}
```

### 4.2 OAuth 回调示例

```java
@GetMapping("/wx/oauth/callback")
public ResponseEntity<Void> callback(@RequestParam("code") String code,
                                     @RequestParam("state") String state) {
    WxOAuth2AccessToken accessToken = wxMpService.getOAuth2Service().getAccessToken(code);
    String openid = accessToken.getOpenId();
    // 保存用户表与open_id的关系
    String ticket = 生成前端登录态或一次性票据;
    // 把ticket放到缓存，value是用户及openid
    String to = 根据state取出原始前端页面;

    String redirectToFrontend = "https://wx.xiaoliulab.com/wx-redirect?to=" + url_encode(to) + "&ticket=" + ticket;

    return ResponseEntity.status(HttpStatus.FOUND)
            .location(URI.create(redirectToFrontend))
            .build();
}
```

实际项目中建议：

```plaintext
1. state 必须防篡改、防重放
2. 不要把 openid 明文长期暴露在 URL 中
3. code 只能使用一次
4. ticket 建议短有效期
5. 前端进入支付页前，后端应能根据 ticket 找到 openid
```

### 4.3 使用 ticket 登录

/wx-redirect是前后端约定的中转页面，它调用后端的loginByTicket

```java
@GetMapping("/loginByTicket")
public ResponseEntity<LoginResp> callback(@RequestParam("ticket") String ticket) {
    // 根据ticket查缓存中的用户及open_id
    // 生成登录后的token并放到redis中，并设置过期时间
    // 用完ticket后要删除
    String token = "xxx";
    LoginResp resp = new LoginResp();
    resp.setToken(token);
    return ResponseEntity.ok(resp);
}
```

前端拿到token后保存到localStorage中，并跳到to页面。


完整图：

```text
公众号
    │
    ▼
entry
    │
302
    ▼
微信 OAuth
    │
code
    ▼
callback
    │
openid
    │
ticket
    ▼
wx-redirect
    │
loginByTicket
    ▼
token
    ▼
H5 支付页面
```



## 5. 问题二：如何创建 JSAPI 支付单

### 5.1 后端核心代码

```java
/**
 * 本方法是演示调用jsapi pay接口，真实场景中openid要从微信获取
 */
@Test
public void testJsapiPay() {
    String openid = "用户的openid";
    String outTradeNo = 自己生成唯一编号；

    WxPayUnifiedOrderV3Request request = new WxPayUnifiedOrderV3Request();
    request.setDescription("小刘JSAPI支付测试");
    request.setOutTradeNo(outTradeNo);

    // 如果 WxPayConfig 里已经 setNotifyUrl，这里可以不 set。
    // 但建议显式 set，方便排查。
    request.setNotifyUrl(wxPayService.getConfig().getNotifyUrl());x

    WxPayUnifiedOrderV3Request.Amount amount = new WxPayUnifiedOrderV3Request.Amount();
    amount.setTotal(1); // 单位：分。这里是 0.01 元
    amount.setCurrency(WxPayConstants.CurrencyType.CNY);
    request.setAmount(amount);

    WxPayUnifiedOrderV3Request.Payer payer = new WxPayUnifiedOrderV3Request.Payer();
    payer.setOpenid(openid);
    request.setPayer(payer);

    try {
        // JSAPI 模式：返回前端调起支付需要的参数
        WxPayUnifiedOrderV3Result.JsapiResult jsapiPayParams = wxPayService.createOrderV3(TradeTypeEnum.JSAPI, request);
        log.info("jsapiPayParams={}", jsapiPayParams);
    } catch (WxPayException e) {
        throw BizAssert.createNewException("微信 JSAPI Pay 下单失败：" + e.getMessage(), e);
    }
}
```

### 5.2 关键点

`outTradeNo` 必须由你自己的系统生成，并落库保存。

JSAPI Pay 不会返回 `code_url`，它返回的是前端调起微信支付所需参数。

常见参数包括：

```plaintext
appId
timeStamp
nonceStr
packageValue
signType
paySign
```

> 注意 `package` 在java中是关键字，此处转成 `packageValue`。

其中 `packageValue` 一般类似：

```plaintext
prepay_id=wx201410272009395522657a690389285100
```

## 6. 问题三：前端如何拉起微信支付

前端必须在微信内置浏览器中调用：

```javascript
WeixinJSBridge.invoke(
  'getBrandWCPayRequest',
  {
    appId: payParams.appId,
    timeStamp: payParams.timeStamp,
    nonceStr: payParams.nonceStr,
    package: payParams.packageValue,
    signType: payParams.signType,
    paySign: payParams.paySign
  },
  function (res) {
    if (res.err_msg === 'get_brand_wcpay_request:ok') {
      // 用户支付成功
      // 注意：这里表示前端支付弹窗返回成功，但后端最终状态仍建议以回调/查单为准
    } else if (res.err_msg === 'get_brand_wcpay_request:cancel') {
      // 用户取消支付
    } else {
      // 支付失败或配置错误
    }
  }
);
```

为了兼容 WeixinJSBridge 注入时机，可以封装成：

```javascript
function onBridgeReady(payParams) {
  WeixinJSBridge.invoke(
    'getBrandWCPayRequest',
    payParams,
    function (res) {
      console.log('wx pay result', res);
    }
  );
}

function callWxPay(payParams) {
  if (typeof WeixinJSBridge === 'undefined') {
    if (document.addEventListener) {
      document.addEventListener('WeixinJSBridgeReady', function () {
        onBridgeReady(payParams);
      }, false);
    } else if (document.attachEvent) {
      document.attachEvent('WeixinJSBridgeReady', function () {
        onBridgeReady(payParams);
      });
      document.attachEvent('onWeixinJSBridgeReady', function () {
        onBridgeReady(payParams);
      });
    }
  } else {
    onBridgeReady(payParams);
  }
}
```

需要注意：

```plaintext
1. 必须在微信内打开页面
2. 当前页面 URL 必须匹配支付授权目录
3. 前端返回 ok 后，仍然建议查询后端订单状态
4. 不要只以前端回调作为最终支付成功依据
```

## 7. 问题四：如何查询订单（主动查单）

JSAPI Pay 的查单逻辑与 Native Pay 一致。
详见：

- [微信 Native 支付最小接入指南 - 如何查询订单](/wechat/native-pay-mvp/#_4-问题二-如何查询订单-主动查单)

可以直接参考：

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

JSAPI Pay 页面通常建议：

```plaintext
前端调起支付成功后：
    调用后端查单接口，确认本地订单是否 SUCCESS

如果后端还没收到回调：
    可以等待 1~2 秒后再次查询

如果用户取消支付：
    页面提示用户已取消，可重新发起支付
```

## 8. 问题五：如何处理支付回调

JSAPI Pay 的支付回调与 Native Pay 一致。

详见：

- [微信 Native 支付最小接入指南 - 支付回调](/wechat/native-pay-mvp/#_5-问题三-如何处理支付回调-notify-url)

需要注意：

```plaintext
1. notify_url 必须是公网 HTTPS
2. notify_url 不能要求用户登录
3. notify_url 不能被 token、拦截器、网关鉴权拦住
4. 回调处理必须幂等
5. 回调中必须校验金额
6. 回调中建议校验 out_trade_no 对应的订单归属和金额
```

回调接口仍然不是给前端调用的，而是给微信支付服务器调用的。

## 9. 为什么 JSAPI Pay 也需要主动查单？

JSAPI Pay 前端会收到 `WeixinJSBridge.invoke` 的回调，但这个回调不能替代后端支付结果。

原因是：

```plaintext
1. 前端回调可能比后端 notify_url 更早返回
2. 用户页面可能关闭，前端逻辑不一定执行完整
3. 支付回调可能延迟
4. 本地订单状态需要以后端数据库为准
5. 前端返回 ok 后，仍应确认微信订单状态和本地订单状态
```

所以 JSAPI Pay 推荐同时使用：

```plaintext
前端支付回调：负责页面交互提示
主动查单：负责页面及时确认状态
支付回调：作为后端可靠更新来源
```

也就是说：

```plaintext
JSAPI Pay 不是只看前端 WeixinJSBridge 返回，最终状态仍然要以微信订单状态为准。
```

## 10. 最小验收标准

JSAPI Pay 文档对应的功能完成后，应能验证：

```plaintext
1. 用户能够从公众号菜单进入 H5 页面
2. 后端能够通过 OAuth 获取用户 openid
3. 后端能够生成 out_trade_no
4. 后端能够使用 openid 创建 JSAPI 支付单
5. 前端能够拿到 appId、timeStamp、nonceStr、package、signType、paySign
6. 前端能够调用 WeixinJSBridge.invoke 拉起微信支付
7. 金额为 1 分时能够完成测试扣款
8. 支付后微信能回调 notify_url
9. 本地订单状态能变成 SUCCESS
10. 前端查询订单能看到 SUCCESS
```

只要这 10 点成立，就说明 JSAPI Pay 的核心链路已经跑通。

## 11. 调试顺序（推荐）

```plaintext
第一步：
先确认公众号菜单能打开你的 H5 页面。

第二步：
确认 H5 页面是在微信内打开，不是普通浏览器打开。

第三步：
接入 OAuth，确认后端能拿到 openid。

第四步：
写一个后端接口，使用 openid 创建 JSAPI 支付单。

第五步：
确认返回给前端的支付参数包含 appId、timeStamp、nonceStr、package、signType、paySign。

第六步：
前端调用 WeixinJSBridge.invoke('getBrandWCPayRequest', ...) 拉起支付。

第七步：
使用 1 分钱金额完成测试付款。

第八步：
确认支付回调能够正常收到。

第九步：
实现查单接口，确认前端可以看到最终支付状态。

第十步：
最后再编写订单状态更新、实验完成、消息通知等业务逻辑，并保证回调处理具有幂等性。
```

## 12. 常见问题定位

```plaintext
1. 当前页面的 URL 未注册
→ 检查微信支付商户平台的支付授权目录
→ 检查当前页面 URL 是否在授权目录下
→ 检查是否使用了正确的域名和 HTTPS

2. 获取不到 openid
→ 检查公众号 appid 是否正确
→ 检查 OAuth 回调域名是否配置正确
→ 检查 code 是否重复使用
→ 检查 state 是否被错误覆盖

3. JSAPI 下单失败，提示 openid 不匹配
→ 检查 openid 是否来自当前公众号
→ 检查公众号 appid 是否与商户号绑定
→ 检查支付配置中的 app-id 是否和 OAuth 使用的是同一个 appid

4. 前端 WeixinJSBridge 未定义
→ 检查页面是否在微信内置浏览器中打开
→ 检查是否等待 WeixinJSBridgeReady 事件

5. 支付弹窗拉不起
→ 检查返回给前端的 paySign 是否正确
→ 检查 package 是否为 prepay_id=xxx 格式
→ 检查 signType 是否与后端签名方式一致

6. 用户支付成功但系统未更新
→ 检查回调处理是否正常
→ 检查主动查单是否同步本地订单状态
→ 检查订单更新逻辑是否幂等

7. 回调收不到
→ 检查 notify_url 是否公网 HTTPS
→ 检查 notify_url 是否允许匿名访问，不要被登录拦截器、鉴权网关、白名单拦住
→ 检查服务器防火墙、安全组、Nginx 是否放行对应路径
```

## 13. 阅读更多

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
