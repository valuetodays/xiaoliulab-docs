---
title: 小刘实验室更新日志
description: 记录小刘实验室网站的内容更新、功能调整与重要变化。
articleMeta: false
head:
  - - meta
    - name: keywords
      content: 小刘实验室,更新日志,网站更新,文档更新
---

# 小刘实验室更新日志

这里记录小刘实验室的重要更新，包括新增实验、文档完善、功能上线以及网站改进。最新内容排在最前面。

## 2026-08-28

### ✨ 新增

- 新增 [Quarkus 容器 RSS 持续增长：一次 JVM Heap 正常但 Native Memory 膨胀的问题排查](/lab-tech-exploration/java-jvm/quarkus-container-rss-growth)，记录 Quarkus + JDK 21 服务在 Docker 中 RSS 持续增长的排查过程，并通过 `MALLOC_ARENA_MAX=2` 的正向与反向实验，进一步确认问题与 glibc malloc arena / native allocator 行为高度相关。
- 新增 [一个 4 年来从未生效的 JVM 参数：Docker 中 JAVA_OPTS 的误区](/lab-tech-exploration/java-jvm/docker-java-opts-not-effective)，记录 Docker 环境中 `JAVA_OPTS` 不会被 JVM 自动读取的问题排查过程，并介绍通过 `JAVA_TOOL_OPTIONS` 让 JVM 参数生效及验证的方法。

## 2026-08-27

### ✨ 新增

- 新增 [Spring Boot 2.2 + Micrometer 中 JVM 指标消失：一次 MeterRegistry 提前初始化问题排查](/lab-tech-exploration/java-jvm/spring-boot-micrometer-jvm-metrics-missing)，记录自定义 `AsyncConfigurer` 构造器依赖 `MeterRegistry` 引发 JVM 指标缺失的排查与规避过程，并梳理 Spring Bean 初始化时序对监控指标注册的影响。
- 新增 [微服务访问报 No route to host：一次 firewalld 端口未放行问题排查](/lab-tech-exploration/network-infrastructure/microservice-no-route-to-host)，记录微服务跨节点访问失败的定位与修复过程，并说明为什么 firewalld 未放行端口也可能表现为 `No route to host`。

## 2026-08-25

### ✨ 新增

- 新增 [HTTPS 证书申请失败排查：secondary validation DNS timeout](/lab-tech-exploration/network-infrastructure/https-certificate-secondary-validation-dns-timeout)，记录 1Panel 申请 HTTPS 证书时 DNS 查询超时的排查过程，包括现场保留、DNS 与 HTTP 链路验证、CA 对照实验及证据边界。

## 2026-08-24

### ✨ 新增

- 新增 [ETF 的份额是怎么产生的？](/lab-fortune/lab-finance-exploration/03-investment-tools/how-are-etf-shares-created)，从募集期认购与成立后的一级市场申购赎回出发，理解 ETF 最初的份额如何形成，以及基金总份额为什么还能继续增加或减少。
- 新增 [我在证券账户里买 ETF，钱到底去了哪里？](/lab-fortune/lab-finance-exploration/03-investment-tools/where-does-my-money-go-when-i-buy-an-etf)，从一次普通的 ETF 买入出发，区分二级市场买卖与基金申购，理解买入 ETF 时资金去了哪里，以及 ETF 份额发生了什么变化。

## 2026-08-14

### ✨ 新增

- 上线探索技术专题，新增 [从“一屏多看几个依赖”开始：一次 Maven POM 简化设计的历史探索](/lab-tech-exploration/build-tools/maven-pom-simplification-history)，从依赖声明过于冗长的使用痛点出发，梳理 Maven 社区关于 XML attributes、GAV identity、POM authoring 与模型演进的历史讨论和设计取舍。

### 🚀 改进

- 普通文章页新增字数与预计阅读时间提示，自动统计中英文正文并排除代码块，无需手工维护文章字数。

## 2026-08-11

### ✨ 新增

- 新增 [同样跟踪一个指数的 ETF，为什么还会有区别？](/lab-fortune/lab-finance-exploration/03-investment-tools/why-etfs-tracking-the-same-index-differ)，从搜索沪深300 ETF 时出现多个结果的经历出发，认识基金规模、流动性、费用、跟踪效果、成立时间和单位价格等差异。
- 新增 [ETF 为什么会出现折价和溢价？](/lab-fortune/lab-finance-exploration/03-investment-tools/why-etf-trades-at-premium-or-discount)，从基金净值与市场价格的差异出发，理解 ETF 折溢价的形成，以及申购赎回和套利机制如何影响市场价格。
- 新增 [从支付宝基金到 ETF](/lab-fortune/lab-finance-exploration/03-investment-tools/from-alipay-fund-to-etf)，从场外基金的使用经历出发，探索证券账户和 ETF 带来的交易方式变化，理解基金净值、市场价格和成交机制之间的区别。

## 2026-08-07

### ✨ 新增

- 新增 [支付宝里的基金，到底是什么？](/lab-fortune/lab-finance-exploration/03-investment-tools/what-are-funds-on-alipay)，从支付宝购买基金的经历出发，认识基金背后的资产组合、主动与被动投资、净值与成本、申购赎回及相关费用，以及场外基金的基本运行方式。

## 2026-08-06

### ✨ 新增

- 新增 [风险与收益：为什么高收益伴随高波动？](/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-high-return-means-high-risk)，从投资收益的不确定性出发，理解风险的本质，以及投资如何在收益、风险和个人目标之间寻找平衡。
- 新增 [投资收益到底来自哪里？](/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-investment-generates-returns)，从社会发展、企业价值创造和资产回报出发，探索长期投资收益形成背后的逻辑。
- 新增 [普通投资者为什么需要了解投资？](/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-ordinary-investors-need-to-understand-investing)，从普通人的长期资金管理出发，重新认识投资的意义，以及资金、风险、收益和个人目标之间的关系。
- 新增 [为什么账户余额增加，购买力却不一定同步增加？](/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-saving-money-may-not-grow-wealth)，从储蓄和购买力变化出发，重新观察账户余额、实际购买力与长期资金安排之间的关系。
- 新增 [从收入支出开始，理解现金流与净资产](/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/understanding-wealth-from-income-expenses)，从一个月的收入与支出开始，重新观察个人财务中的现金流、现金结余与净资产，并理解消费、资产配置和负债选择如何影响未来财务状态。

## 2026-08-05

### ✨ 新增

- 新增 [为什么不同市场状态，需要不同的历史统计？](/lab-fortune/lab-zuot/signal/why-different-market-regimes-need-different-statistics)，介绍如何按趋势、波动和流动性拆分历史样本，比较不同市场状态下的价格触达分布，并检查状态定义的时间顺序、样本量和稳定性。
- 新增 [历史上，价格通常能走多远？](/lab-fortune/lab-zuot/signal/how-far-does-price-usually-move)，介绍如何以昨日收盘价为起点，通过历史最高价和最低价构造价格波动样本，并利用触达比例、历史分布和百分位方法理解目标价格的历史出现频率。
- 新增 [为什么有些东西看起来很值钱，却不一定是资产？](/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-are-some-expensive-things-not-assets)，从价值与现金流两个视角重新理解资产，认识到同一个词在不同语境下，可能回答的是不同的问题。

## 2026-08-03

### ✨ 新增

- 新增 [为什么我开始重新学习金钱？](/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-did-i-start-learning-about-money)，记录从“会挣钱、会存钱”到主动理解金钱的认知变化，以及阅读如何让我开始不断追问那些每天都在接触、却从未认真思考过的问题。

## 2026-08-01

### ✨ 新增

- 新增 [为什么余额宝既显示“每万份收益”，又显示“七日年化”？](/lab-fortune/lab-finance-exploration/01-yuebao/why-does-yuebao-show-both-ten-thousand-yield-and-seven-day-annualized-rate)，从当天结果与近期水平两个时间尺度出发，理解每万份收益和七日年化分别回答什么问题，以及为什么不能互相替代。
- 新增 [为什么余额宝里的钱能比较方便地转出？](/lab-fortune/lab-finance-exploration/01-yuebao/why-can-money-in-yuebao-be-withdrawn-anytime)，从基金赎回、资产流动性和快速到账服务出发，理解转出便利背后依靠的是流动性管理，而不是资金一直停留在账户里。
- 新增 [为什么余额宝会显示“七日年化”？](/lab-fortune/lab-finance-exploration/01-yuebao/why-does-yuebao-show-seven-day-annualized-rate)，从最近七天的基金收益与年度折算方式出发，理解七日年化反映的是近期收益水平，而不是未来一年的收益承诺。
- 新增 [为什么余额宝里的金额经常变化？](/lab-fortune/lab-finance-exploration/01-yuebao/why-does-the-amount-in-yuebao-change-every-day)，继续追问货币基金的投资结果如何反映到页面金额，理解基金收益经过计算、分配并通过红利再投资转成新的基金份额，最终体现为余额变化。
- 新增 [为什么把钱放进余额宝后，它不会一直放在那里？](/lab-fortune/lab-finance-exploration/01-yuebao/why-doesnt-money-in-yuebao-stay-there)，继续追问货币基金收到资金后会如何运作，理解余额宝页面金额背后的基金资产并不会静止存放，而是会按照规则参与金融市场运作。
- 新增 [为什么把钱放进余额宝，不是把钱存进支付宝？](/lab-fortune/lab-finance-exploration/01-yuebao/why-isnt-money-in-yuebao-stored-by-alipay)，从一次看似普通的转入出发，理解为什么把钱转入余额宝，并不是把钱存进支付宝，而是持有了一份货币基金。

## 2026-07-31

### ✨ 新增

- 新增 [为什么有探索金融？](/lab-fortune/lab-finance-exploration/why-this-finance-exploration)，记录从银行卡和第一笔存款开始，在解决真实问题的过程中逐步认识储蓄、现金管理、基金、ETF、融资、投资研究与全球资产的探索路线。
- 新增 [为什么钱放在银行会有利息？](/lab-fortune/lab-finance-exploration/01-yuebao/why-do-banks-pay-interest)，从储户与银行的不同视角出发，一步步理解银行为什么愿意支付利息，以及存款、借款与利息之间的关系。


## 2026-07-30

### ✨ 新增

- 新增 [如何利用历史数据寻找交易机会？](/lab-fortune/lab-zuot/signal/how-to-find-trading-opportunities-with-historical-data)，介绍如何从市场现象发现研究方向，将交易想法转化为可验证假设，并通过明确规则、比较基准、收益风险分析和样本外验证寻找具有统计依据的交易机会。
- 新增 [为什么技术指标需要历史验证？](/lab-fortune/lab-zuot/signal/why-technical-indicators-need-historical-validation)，介绍技术指标与交易信号之间的关系，以及如何通过交易规则、历史样本、比较基准和样本外验证判断指标是否具有研究价值。

## 2026-07-28

### ✨ 新增

- 新增 [为什么历史数据不能直接给出交易答案？](/lab-fortune/lab-zuot/signal/why-historical-data-cannot-give-answer)，介绍历史数据无法直接产生交易结论的原因，以及如何通过假设、统计分析、回测和持续验证建立交易判断。
- 新增 [一个交易信号，什么样的统计结果才值得相信？](/lab-fortune/lab-zuot/signal/what-statistics-make-a-trading-signal-reliable)，介绍如何通过统计口径、样本、基准比较、收益风险分析和样本外验证，判断一个交易想法是否具备持续研究的价值。
- 上线数据实验室，新增 [为什么投资研究需要可靠的数据来源？](/lab-fortune/lab-data/why-investment-research-needs-reliable-data)，介绍投资研究中数据来源的重要性，以及如何从来源、完整性、统计口径、时间一致性和可复现性等方面建立可靠的数据基础。

## 2026-07-23

### ✨ 新增

- 新增 [TdxQuant 前复权行情随查询结束日期变化的踩坑记录](/lab-technology/tdxquant/pitfalls/tdxquant_front_adjustment_end_time)，分析前复权行情受查询结束日期影响的问题，提供最小复现代码，并给出保持前复权口径一致的工程实现方案。

## 2026-07-22

### ✨ 新增

- 新增 [历史行情里究竟有哪些数据？](/lab-fortune/lab-zuot/signal/what-data-does-market-history-contain)，介绍交易研究中常见的五类数据，并说明不同数据分别能够回答什么问题。


## 2026-07-21

### ✨ 新增

- 新增 [为什么历史行情值得研究？](/lab-fortune/lab-zuot/signal/why-study-historical-market-data)，介绍为什么交易研究需要从历史行情出发，并通过样本、统计和验证，将市场观察转化为可验证的交易假设。

## 2026-07-19

### ✨ 新增

- 新增 [安装通达信金融终端与 Python 环境](/lab-technology/tdxquant/installation)，介绍通达信终端版本选择、Python 环境、依赖库以及 Windows 虚拟机中的运行准备。
- 新增 [使用 curl 和 Python 获取第一份行情数据](/lab-technology/tdxquant/basic-usage)，介绍如何通过本地 HTTP 接口和 Python API 验证 TdxQuant，并完成历史 K 线刷新与行情数据获取。
- 新增 [封装内部行情服务](/lab-technology/tdxquant/build-http-service)，介绍如何为 TdxQuant 建立内部行情 API 边界，并梳理统一响应、数据转换、访问鉴权和长期运行等工程化问题。

## 2026-07-17

### ✨ 新增

- 新增 [为什么会有“做T实验”？](/lab-fortune/lab-zuot/basics/why-this-lab)，介绍“做T实验”的建立初衷，以及如何通过数学、统计学、工程和资产配置，持续研究市场波动。
- 新增 [什么样的标的才算适合做T？](/lab-fortune/lab-zuot/basics/what-makes-a-good-target)，介绍长期做T标的的选择标准，以及流动性、手续费、波动、长期价值和长期坚持等核心因素。
- 新增 [为什么我最终选择了红利ETF？](/lab-fortune/lab-zuot/basics/why-i-finally-chose-dividend-etf)，介绍为什么红利ETF最符合小刘实验室的长期做T标准，以及做T与长期资产配置之间的关系。

## 2026-07-16

### ✨ 新增

- 新增 [为什么一厘价差也能产生收益？——做T的数学基础](/lab-fortune/lab-zuot/basics/math-foundation)，介绍做T收益背后的数学原理。

### 🚀 改进

- 新增全站更新日志页面，并在顶部导航中增加入口。
- “金融实验”导航重新整理，更方便查找相关实验。
- 在“做T实验”下增加“基础认知”文档目录。

## 2026-07-15

- 上线“金融实验”，增加金融基础、做T实验、金融实验和内容路线图。
- 将“做T专题”统一更名为“做T实验”，并重新整理相关链接与内容目录。
- 完善“微信支付”的页面说明、扩展阅读、常见问题和搜索引擎信息。
- 优化网站首页的实验室入口与页面样式。
- 网站正式启用 docs.xiaoliulab.com 独立域名。

## 2026-07-09

- 新增微信 JSAPI Pay 最小接入指南。
- 新增微信 H5 Pay 支持情况说明。

## 2026-07-08

- 完善微信 Native Pay 和 Code Pay 文档结构与示例说明。
- 增加公众号二维码等文档资源。
- 配置本地开发端口与允许访问的主机。

## 2026-07-07

- 上线基于 VitePress 的文档网站。
- 新增专题化首页及基础视觉样式。
- 网站支持自动发布和持续更新。
- 建立网站文档改造计划。

## 2026-07-06

- 创建小刘实验室文档。
