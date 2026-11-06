---
title: 微信支付：从第一次付款成功开始
description: 面向 Java 与 Spring Boot 开发者，整理 Native Pay、Code Pay、JSAPI Pay 的最小 MVP 实验，以及 H5 Pay 支持情况、支付回调、订单查询与常见问题。先跑通，再理解。
articleMeta: false
head:
  - - meta
    - name: keywords
      content: 微信支付,微信支付接入,Native Pay,Code Pay,JSAPI Pay,H5 Pay,Java,Spring Boot
---

# 微信支付

第一次接入微信支付，该从哪里开始？

这个专题整理 Native Pay、Code Pay、JSAPI Pay 的最小 MVP 实验，从第一次付款成功开始，先跑通，再理解。

## 第一次来到实验？

先读一读[为什么会有这个“微信支付实验”？](/wechat/why-this-lab/)，了解这里为什么强调真实验证，以及“先跑通，再理解”的学习方式。

## 这个专题适合谁？

适合第一次接入微信支付，或者想快速跑通 Native Pay / JSAPI Pay / Code Pay 最小流程的 Java / Spring Boot 开发者。

## 推荐实验顺序

如果还不清楚需要准备什么，可以先阅读[微信支付接入路线](/wechat/getting-started/)，再按下面的顺序选择实验。

1. [微信 Native Pay 最小接入指南](/wechat/native-pay-mvp/)：理解创建订单、生成 code_url、查询订单、处理回调。
2. [微信 Code Pay 最小接入指南](/wechat/code-pay-mvp/)：理解付款码支付和扫码枪场景。
3. [微信 JSAPI Pay 最小接入指南](/wechat/jsapi-pay-mvp/)：理解 openid、prepay_id 和前端拉起微信支付。
4. [微信 H5 Pay 支持情况](/wechat/h5-pay-mvp/)：理解在手机浏览器中拉起微信支付。

## 内容范围

除了发起支付，还需要关注通知处理、订单状态和接入过程中遇到的问题。

| 内容 | 关注的问题 |
| --- | --- |
| [Native Pay](/wechat/native-pay-mvp/) | 电脑页面生成 code_url，微信扫码支付 |
| [Code Pay](/wechat/code-pay-mvp/) | 扫码用户付款码完成支付 |
| [JSAPI Pay](/wechat/jsapi-pay-mvp/) | 公众号内网页拉起微信支付 |
| 支付回调 | 处理微信支付通知 |
| 订单查询 | 根据 out_trade_no 查询订单状态 |
| 常见问题 | notify_url、公网 HTTPS、匿名访问等排查 |
