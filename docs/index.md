---
layout: home

hero:
  name: 小刘实验室
  text: 微信支付接入实验室
  tagline: 面向 Java / Spring Boot 开发者，提供 Native Pay、JSAPI Pay、Code Pay 的最小化接入示例。
  actions:
    - theme: brand
      text: 微信native支付
      link: /wechat/native-pay-mvp/
    - theme: alt
      text: JSAPI Pay（整理中）
      # link: /lab-wx-jsapi/
    - theme: alt
      text: Code Pay（整理中）
      # link: /lab-wx-codepay/

features:
  - title: Native Pay
    details: 电脑页面生成 code_url，用户使用微信扫码完成支付。
    link: /wechat/native-pay-mvp/
  - title: JSAPI Pay
    details: 公众号内网页拉起微信支付，适合微信 H5 场景。
    link: /lab-wx-jsapi/
  - title: Code Pay
    details: 扫用户付款码完成支付，适合扫码枪、收银台等场景。
    link: /lab-wx-codepay/
  - title: 支付回调
    details: 处理微信支付通知，完成签名验签、订单状态更新。
  - title: 订单查询
    details: 根据 out_trade_no 查询微信订单状态，排查支付链路问题。
  - title: 接入示例
    details: 提供 yml 配置、接口调用顺序、常见问题说明。
---

## 这个文档适合谁？

如果你正在第一次接入微信支付，或者想快速理解 Native Pay / JSAPI Pay / Code Pay 的完整流程，可以从这里开始。

## 推荐阅读顺序

1. 先看 Native Pay，理解创建订单、生成 code_url、查询订单、处理回调。
2. 再看 JSAPI Pay，理解 openid、prepay_id 和前端拉起支付。
3. 最后看 Code Pay，理解付款码支付和扫码枪场景。
