---
layout: home

hero:
  name: 微信支付实验室
  text: 从第一次付款成功开始
  tagline: Native Pay、Code Pay、JSAPI Pay 的最小 MVP 实验。先跑通，再理解。
  actions:
    - theme: brand
      text: 微信 Native Pay 最小接入指南
      link: /wechat/native-pay-mvp/
    - theme: alt
      text: 微信 Code Pay 最小接入指南
      link: /wechat/code-pay-mvp/
    - theme: alt
      text: 微信 JSAPI Pay 最小接入指南
      link: /wechat/jsapi-pay-mvp/
    - theme: alt
      text: 微信 H5 Pay 支持情况
      link: /wechat/h5-pay-mvp/

features:
  - title: Native Pay
    details: 电脑页面生成 code_url，微信扫码支付。
    link: /wechat/native-pay-mvp/
  - title: Code Pay
    details: 扫码用户付款码完成支付。
    link: /wechat/code-pay-mvp/
  - title: JSAPI Pay
    details: 公众号内网页拉起微信支付。
    link: /wechat/jsapi-pay-mvp/
  - title: 支付回调
    details: 处理微信支付通知。
  - title: 订单查询
    details: 根据 out_trade_no 查询订单状态。
  - title: 常见问题
    details: notify_url、公网 HTTPS、匿名访问等排查。
---

## 这个专题适合谁？

适合第一次接入微信支付，或者想快速跑通 Native Pay / JSAPI Pay / Code Pay 最小流程的 Java / Spring Boot 开发者。

## 推荐实验顺序

1. Native Pay MVP：理解创建订单、生成 code_url、查询订单、处理回调。
2. Code Pay MVP：理解付款码支付和扫码枪场景。
3. JSAPI Pay MVP：理解 openid、prepay_id 和前端拉起支付。
