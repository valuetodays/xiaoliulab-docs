import { defineConfig, type HeadConfig } from 'vitepress';
import { articleMetadataPlugin } from './markdown/article-metadata';
import { getPageModeInitScript } from './theme/utils/page-mode';

const siteUrl = 'https://docs.xiaoliulab.com';

// 已迁移页面的旧路径。
// 旧页面仅用于历史链接跳转，不加入 sitemap。
const sitemapExcludedPaths = [
  'lab-tech-exploration/maven-pom-simplification-history',
  'lab-tech-exploration/https-certificate-secondary-validation-dns-timeout',
];

// refer https://vitepress.dev/reference/site-config for details
export default defineConfig({
  lang: 'zh-CN',
  title: '小刘实验室',
  cleanUrls: true,
  description: '记录真实实验、真实验证与持续迭代的技术和金融实践。',
  base: '/',
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['script', {}, getPageModeInitScript()],
    [
      'script',
      {
        defer: '',
        src: 'https://myanalytics.pages.dev/tracker.min.js',
        'data-website-id': 'a-web-xiaoliulab-docs',
      },
    ],
  ],
  sitemap: {
    hostname: `${siteUrl}/`,
    transformItems(items) {
      return items.filter((item) => !sitemapExcludedPaths.includes(item.url));
    },
  },
  transformHead({ pageData }) {
    const relativePath = pageData.relativePath
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '');
    const frontmatterCanonical = pageData.frontmatter.head?.find(
      ([tag, attrs]) => tag === 'link' && attrs.rel === 'canonical',
    );
    const canonicalUrl = frontmatterCanonical?.[1].href ?? `${siteUrl}/${relativePath}`;
    const canonicalHead: HeadConfig[] = frontmatterCanonical
      ? []
      : [['link', { rel: 'canonical', href: canonicalUrl }]];

    return [
      ...canonicalHead,
      ['meta', { property: 'og:type', content: 'article' }],
      ['meta', { property: 'og:locale', content: 'zh_CN' }],
      ['meta', { property: 'og:site_name', content: '小刘实验室' }],
      ['meta', { property: 'og:title', content: pageData.title }],
      ['meta', { property: 'og:description', content: pageData.description }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
    ];
  },
  vite: {
    server: {
      allowedHosts: ['v200'],
    },
  },

  markdown: {
    config(markdown) {
      markdown.use(articleMetadataPlugin);
    },
  },

  themeConfig: {
    outline: [2, 3],

    footer: {
      message: `
        <span class="beian-links">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
            ICP备案号：京ICP备17040585号-6
          </a>
          <span class="beian-public-security">
            <span class="beian-separator" aria-hidden="true">|</span>
            <a
              href="https://beian.mps.gov.cn/#/query/webSearch?code=11010802049380"
              target="_blank"
              rel="noopener noreferrer"
              class="beian-link"
            >
              <img src="/images/gaba-icon.png" alt="" />
              京公网安备 11010802049380号
            </a>
          </span>
        </span>
      `,
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },

    nav: [
      { text: '首页', link: '/' },
      { text: '微信支付', link: '/wechat/' },
      { text: '技术实验', link: '/lab-technology/' },
      { text: '金融实验', link: '/lab-fortune/' },
      { text: '探索金融', link: '/lab-fortune/lab-finance-exploration/' },
      { text: '探索技术', link: '/lab-tech-exploration/' },
      { text: '做T实验', link: '/lab-fortune/lab-zuot/' },
      { text: '更新日志', link: '/changelog' },
    ],

    sidebar: {
      '/lab-tech-exploration/': [
        {
          text: '探索技术',
          items: [
            { text: '专题首页', link: '/lab-tech-exploration/' },
            {
              text: 'Java 与 JVM',
              collapsed: false,
              items: [
                {
                  text: 'Quarkus 容器 RSS 持续增长：一次 JVM Heap 正常但 Native Memory 膨胀的问题排查',
                  link: '/lab-tech-exploration/java-jvm/quarkus-container-rss-growth',
                },
                {
                  text: '一个 4 年来从未生效的 JVM 参数：Docker 中 JAVA_OPTS 的误区',
                  link: '/lab-tech-exploration/java-jvm/docker-java-opts-not-effective',
                },
                {
                  text: 'Spring Boot 2.2 + Micrometer 中 JVM 指标消失：一次 MeterRegistry 提前初始化问题排查',
                  link: '/lab-tech-exploration/java-jvm/spring-boot-micrometer-jvm-metrics-missing',
                },
              ],
            },
            {
              text: '应用框架',
              collapsed: true,
              items: [
                {
                  text: '从 Spring Boot 迁移到 Quarkus：一份面向真实业务的基础能力验证清单',
                  link: '/lab-tech-exploration/application-frameworks/spring-boot-to-quarkus-capability-validation',
                },
                {
                  text: 'Spring Boot 2.7 YAML 国际化：一次从查不到合适方案到源码扩展点的探索',
                  link: '/lab-tech-exploration/application-frameworks/spring-boot-2-7-yaml-i18n-source-extension',
                },
                {
                  text: '从 JPA + MyBatis 到 MyBatis-Plus：一次旧项目数据访问层的维护性收敛',
                  link: '/lab-tech-exploration/application-frameworks/jpa-mybatis-to-mybatis-plus-maintainability',
                },
                {
                  text: '从 log4jdbc 到 p6spy：后来才意识到，我需要的不只是单行 SQL',
                  link: '/lab-tech-exploration/application-frameworks/log4jdbc-to-p6spy-jdbc-observability',
                },
                {
                  text: '一次 User-Agent 解析引发的内存与登录性能问题：从 YAUAA 缓存怀疑到删除无用功能',
                  link: '/lab-tech-exploration/application-frameworks/yauaa-user-agent-memory-login-performance',
                },
                {
                  text: 'PageHelper 两种分页写法对比：一次泛型失真的排查与源码分析',
                  link: '/lab-tech-exploration/application-frameworks/pagehelper-pagination-generic-type-safety',
                },
                {
                  text: 'Logback 的 debug.log 和 info.log 为什么几乎一样：一次旧项目多 root 配置排查',
                  link: '/lab-tech-exploration/application-frameworks/logback-multiple-root-debug-info-log',
                },
                {
                  text: '为什么我不再允许业务代码直接使用 MyBatis-Plus 的 insert 和 updateById',
                  link: '/lab-tech-exploration/application-frameworks/avoid-mybatis-plus-insert-and-updatebyid-in-business-code',
                },
              ],
            },
            {
              text: '构建与依赖',
              collapsed: true,
              items: [
                {
                  text: '从“一屏多看几个依赖”开始：一次 Maven POM 简化设计的历史探索',
                  link: '/lab-tech-exploration/build-tools/maven-pom-simplification-history',
                },
              ],
            },
            {
              text: '数据库与中间件',
              collapsed: true,
              items: [],
            },
            {
              text: '容器与云环境',
              collapsed: true,
              items: [
                {
                  text: 'Java 8 Alpine 容器中 jstack 与 Arthas 失败：一次 JVM 诊断能力补齐',
                  link: '/lab-tech-exploration/containers-cloud/java8-alpine-jstack-arthas-diagnostics',
                },
                {
                  text: '一次 Docker 基础镜像切换后的签名异常：从生产回滚到默认字符集',
                  link: '/lab-tech-exploration/containers-cloud/docker-base-image-signature-default-charset',
                },
                {
                  text: 'Dockerfile 写了 LANG=en_US.UTF-8，真的代表 Locale 生效了吗？',
                  link: '/lab-tech-exploration/containers-cloud/alpine-lang-en-us-utf8-locale-validation',
                },
                {
                  text: 'Docker 旧服务端口配置失真：一次 `--net=host` 环境下的排查与统一维护',
                  link: '/lab-tech-exploration/containers-cloud/docker-old-service-port-config-drift',
                },
                {
                  text: 'Docker 服务去除 --net=host：从 host 网络回到 bridge 的一次改造记录',
                  link: '/lab-tech-exploration/containers-cloud/docker-remove-host-network',
                },
              ],
            },
            {
              text: '网络与基础设施',
              collapsed: false,
              items: [
                {
                  text: '一次 VPN 访问收紧导致支付回调中断的事故复盘',
                  link: '/lab-tech-exploration/network-infrastructure/vpn-payment-callback-incident',
                },
                {
                  text: 'HTTPS 证书申请失败排查：secondary validation DNS timeout',
                  link: '/lab-tech-exploration/network-infrastructure/https-certificate-secondary-validation-dns-timeout',
                },
                {
                  text: '微服务访问报 No route to host：一次 firewalld 端口未放行问题排查',
                  link: '/lab-tech-exploration/network-infrastructure/microservice-no-route-to-host',
                },
              ],
            },
            {
              text: '安全',
              collapsed: true,
              items: [],
            },
            {
              text: '工程实践',
              collapsed: true,
              items: [
                {
                  text: 'Windows 通过 SSH 隧道远程调试 Docker 中的 Spring Boot（JDWP）',
                  link: '/lab-tech-exploration/engineering-practice/windows-ssh-tunnel-docker-spring-boot-jdwp',
                },
              ],
            },
          ],
        },
      ],
      '/wechat/': [
        {
          text: '微信支付实验',
          items: [
            { text: '专题首页', link: '/wechat/' },
            { text: '为什么会有这个“微信支付实验”？', link: '/wechat/why-this-lab/' },
            { text: '微信支付接入路线', link: '/wechat/getting-started/' },
            { text: '微信 Native Pay 最小接入指南', link: '/wechat/native-pay-mvp/' },
            { text: '微信 Code Pay 最小接入指南', link: '/wechat/code-pay-mvp/' },
            { text: '微信 JSAPI Pay 最小接入指南', link: '/wechat/jsapi-pay-mvp/' },
            { text: '微信 H5 Pay 支持情况', link: '/wechat/h5-pay-mvp/' },
          ],
        },
      ],
 '/lab-technology/': [
    {
      text: '技术实验',
      items: [
        { text: '专题首页', link: '/lab-technology/' },
        {
          text: 'TdxQuant',
          collapsed: false,
          items: [
            {
              text: '安装通达信金融终端与 Python 环境',
              link: '/lab-technology/tdxquant/installation',
            },
            {
              text: '使用 curl 和 Python 获取第一份行情数据',
              link: '/lab-technology/tdxquant/basic-usage',
            },
            {
              text: '封装内部行情服务',
              link: '/lab-technology/tdxquant/build-http-service',
            },
            {
              text: '踩坑：前复权行情随查询结束日期变化',
              link: '/lab-technology/tdxquant/pitfalls/tdxquant_front_adjustment_end_time',
            },
          ],
        },
      ],
    },
  ],
      '/lab-fortune/': [
        {
          text: '金融实验',
          items: [
            { text: '专题首页', link: '/lab-fortune/' },
            {
              text: '金融基础',
              link: '/lab-fortune/foundation/',
              collapsed: false,
              items: [
                {
                  text: '投资工具',
                  collapsed: true,
                  items: [
                    { text: '宽基 ETF 和行业 ETF', link: '/lab-fortune/foundation/instruments/broad-vs-sector-etf' },
                    { text: '交易成本', link: '/lab-fortune/foundation/instruments/stock-vs-etf' },
                  ],
                },
                {
                  text: '交易基础',
                  collapsed: true,
                  items: [
                    { text: 'T+0 与 T+1', link: '/lab-fortune/foundation/trading/t0-vs-t1' },
                    { text: '交易成本', link: '/lab-fortune/foundation/trading/trading-cost' },
                  ],
                },
              ],
            },
            {
              text: '数据实验',
              collapsed: false,
              items: [
                { text: '为什么投资研究需要可靠的数据来源？', link: '/lab-fortune/lab-data/why-investment-research-needs-reliable-data' },
              ],
            },
            {
              text: '探索金融',
              link: '/lab-fortune/lab-finance-exploration/',
              collapsed: false,
              items: [
                { text: '为什么有探索金融？', link: '/lab-fortune/lab-finance-exploration/why-this-finance-exploration' },
                {
                  text: '余额宝',
                  collapsed: true,
                  items: [
                    { text: '为什么钱放在银行会有利息？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-do-banks-pay-interest' },
                    { text: '为什么把钱放进余额宝，不是把钱存进支付宝？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-isnt-money-in-yuebao-stored-by-alipay' },
                    { text: '为什么把钱放进余额宝后，它不会一直放在那里？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-doesnt-money-in-yuebao-stay-there' },
                    { text: '为什么余额宝里的金额经常变化？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-does-the-amount-in-yuebao-change-every-day' },
                    { text: '为什么余额宝会显示“七日年化”？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-does-yuebao-show-seven-day-annualized-rate' },
                    { text: '为什么余额宝里的钱能比较方便地转出？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-can-money-in-yuebao-be-withdrawn-anytime' },
                    { text: '为什么同时显示每万份收益和七日年化？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-does-yuebao-show-both-ten-thousand-yield-and-seven-day-annualized-rate' },
                  ],
                },
                {
                  text: '金融认知起点',
                  collapsed: true,
                  items: [
                    { text: '为什么我开始重新学习金钱？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-did-i-start-learning-about-money' },
                    { text: '为什么有些东西看起来很值钱，却不一定是资产？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-are-some-expensive-things-not-assets' },
                    { text: '从收入支出开始，理解现金流与净资产', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/understanding-wealth-from-income-expenses' },
                    { text: '为什么账户余额增加，购买力却不一定同步增加？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-saving-money-may-not-grow-wealth' },
                    { text: '普通投资者为什么需要了解投资？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-ordinary-investors-need-to-understand-investing' },
                    { text: '投资收益到底来自哪里？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-investment-generates-returns' },
                    { text: '风险与收益：为什么高收益伴随高波动？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-high-return-means-high-risk' },
                  ],
                },
                {
                  text: '投资工具',
                  collapsed: true,
                  items: [
                    { text: '支付宝里的基金，到底是什么？', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/what-are-funds-on-alipay' },
                    { text: '从支付宝基金到 ETF', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/from-alipay-fund-to-etf' },
                    { text: '我在证券账户里买 ETF，钱到底去了哪里？', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/where-does-my-money-go-when-i-buy-an-etf' },
                    { text: 'ETF 的份额是怎么产生的？', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/how-are-etf-shares-created' },
                    { text: 'ETF 为什么会出现折价和溢价？', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/why-etf-trades-at-premium-or-discount' },
                    { text: '同样跟踪一个指数的 ETF，为什么还会有区别？', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/why-etfs-tracking-the-same-index-differ' },
                  ],
                },
              ],
            },
            {
              text: '做T实验',
              link: '/lab-fortune/lab-zuot/',
              collapsed: false,
              items: [
                {
                  text: '基础认知',
                  collapsed: true,
                  items: [
                    { text: '为什么会有这个“做T实验”？', link: '/lab-fortune/lab-zuot/basics/why-this-lab' },
                    { text: '做T的数学基础', link: '/lab-fortune/lab-zuot/basics/math-foundation' },
                    { text: '什么样的标的适合做T？', link: '/lab-fortune/lab-zuot/basics/what-makes-a-good-target' },
                    { text: '为什么我选择红利ETF？', link: '/lab-fortune/lab-zuot/basics/why-i-finally-chose-dividend-etf' },
                    { text: '为什么第一笔交易最难？', link: '/lab-fortune/lab-zuot/basics/why-first-trade-is-hard' },
                  ],
                },
                {
                  text: '统计与信号',
                  collapsed: true,
                  items: [
                    { text: '为什么历史行情值得研究？', link: '/lab-fortune/lab-zuot/signal/why-study-historical-market-data' },
                    { text: '历史行情里究竟有哪些数据？', link: '/lab-fortune/lab-zuot/signal/what-data-does-market-history-contain' },
                    { text: '为什么历史数据不能直接给出交易答案？', link: '/lab-fortune/lab-zuot/signal/why-historical-data-cannot-give-answer' },
                    { text: '什么样的统计结果才值得相信？', link: '/lab-fortune/lab-zuot/signal/what-statistics-make-a-trading-signal-reliable' },
                    { text: '为什么技术指标需要历史验证？', link: '/lab-fortune/lab-zuot/signal/why-technical-indicators-need-historical-validation' },
                    { text: '如何利用历史数据寻找交易机会？', link: '/lab-fortune/lab-zuot/signal/how-to-find-trading-opportunities-with-historical-data' },
                    { text: '历史上，价格通常能走多远？', link: '/lab-fortune/lab-zuot/signal/how-far-does-price-usually-move' },
                    { text: '为什么不同市场状态，需要不同的历史统计？', link: '/lab-fortune/lab-zuot/signal/why-different-market-regimes-need-different-statistics' },
                  ],
                },
                {
                  text: '交易工程',
                  collapsed: true,
                  items: [
                    { text: '一轮做 T 是怎样完成的？', link: '/lab-fortune/lab-zuot/engineering/how-a-t-trade-cycle-works' },
                  ],
                }
              ],
            },
            { 
              text: '策略实验',
              link: '/lab-fortune/experiments/',
              collapsed: false,
              items: [
                { text: 'FTX-0001 红利类 ETF 一年持有实验', link: '/lab-fortune/experiments/ftx-0001-dividend-etf-one-year-holding' },
              ],
            },
            { text: '内容路线图', link: '/lab-fortune/roadmap' },
          ],
        },
      ],
    },
  },
});
