import { defineConfig } from 'vitepress';
import { getPageModeInitScript } from './theme/utils/page-mode';

const siteUrl = 'https://docs.xiaoliulab.com';

// refer https://vitepress.dev/reference/site-config for details
export default defineConfig({
  lang: 'zh-CN',
  title: '小刘实验室',
  cleanUrls: true,
  description: '记录真实实验、真实验证与持续迭代的技术和金融实践。',
  base: '/',
  lastUpdated: true,
  head: [
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
  },
  transformHead({ pageData }) {
    const relativePath = pageData.relativePath
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '');
    const canonicalUrl = `${siteUrl}/${relativePath}`;

    return [
      ['link', { rel: 'canonical', href: canonicalUrl }],
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
      { text: '微信支付实验室', link: '/wechat/' },
      { text: '技术实验室', link: '/lab-technology/' },
      { text: '金融实验室', link: '/lab-fortune/' },
      { text: '探索金融', link: '/lab-fortune/lab-finance-exploration/' },
      { text: '做T实验室', link: '/lab-fortune/lab-zuot/' },
      { text: '更新记录', link: '/changelog' },
    ],

    sidebar: {
      '/wechat/': [
        {
          text: '微信支付实验',
          items: [
            { text: '专题首页', link: '/wechat/' },
            { text: '为什么会有这个实验室？', link: '/wechat/why-this-lab/' },
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
      text: '技术实验室',
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
          text: '金融实验室',
          items: [
            { text: '专题首页', link: '/lab-fortune/' },
            {
              text: '金融基础',
              link: '/lab-fortune/foundation/',
              collapsed: false,
              items: [
                {
                  text: '交易基础',
                  collapsed: true,
                  items: [
                    { text: 'T+0 与 T+1', link: '/lab-fortune/foundation/trading/t0-vs-t1' },
                  ],
                },
              ],
            },
            {
              text: '数据实验室',
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
                  ],
                },
              ],
            },
            {
              text: '做T实验室',
              link: '/lab-fortune/lab-zuot/',
              collapsed: false,
              items: [
                {
                  text: '基础认知',
                  collapsed: true,
                  items: [
                    { text: '为什么会有这个实验室', link: '/lab-fortune/lab-zuot/basics/why-this-lab' },
                    { text: '做T的数学基础', link: '/lab-fortune/lab-zuot/basics/math-foundation' },
                    { text: '什么样的标的适合做T？', link: '/lab-fortune/lab-zuot/basics/what-makes-a-good-target' },
                    { text: '为什么我选择红利ETF？', link: '/lab-fortune/lab-zuot/basics/why-i-finally-chose-dividend-etf' },
                    { text: '为什么第一笔交易最难？', link: '/lab-fortune/lab-zuot/basics/why-first-trade-is-hard' },
                  ],
                },
                {
                  text: '信号研究',
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
              ],
            },
            { text: '策略实验', link: '/lab-fortune/experiments/' },
            { text: '内容路线图', link: '/lab-fortune/roadmap' },
          ],
        },
      ],
    },
  },
});
