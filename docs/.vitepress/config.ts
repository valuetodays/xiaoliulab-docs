import { defineConfig } from 'vitepress';

const siteUrl = 'https://docs.xiaoliulab.com';

// refer https://vitepress.dev/reference/site-config for details
export default defineConfig({
  lang: 'zh-CN',
  title: '小刘实验室',
  description: '记录真实实验、真实验证与持续迭代的技术和金融实践。',
  base: '/',
  lastUpdated: true,
  head: [
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
      .replace(/\.md$/, '.html');
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
    footer: {
      message: '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">ICP备案号：京ICP备17040585号-6</a>',
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
      { text: '金融实验室', link: '/lab-fortune/' },
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
      '/lab-fortune/': [
        {
          text: '金融实验室',
          items: [
            { text: '专题首页', link: '/lab-fortune/' },
            { text: '金融基础', link: '/lab-fortune/foundation/' },
            {
              text: '做T实验室',
              link: '/lab-fortune/lab-zuot/',
              collapsed: false,
              items: [
                {
                  text: '基础认知',
                  collapsed: false,
                  items: [
                    { text: '为什么会有这个实验室', link: '/lab-fortune/lab-zuot/basics/why-this-lab' },
                    { text: '做T的数学基础', link: '/lab-fortune/lab-zuot/basics/math-foundation' },
                    { text: '什么样的标的才算适合做T？', link: '/lab-fortune/lab-zuot/basics/what-makes-a-good-target' },
                    { text: '为什么我最终选择了红利ETF？', link: '/lab-fortune/lab-zuot/basics/why-i-finally-chose-dividend-etf' },
                  ],
                },
              ],
            },
            { text: '金融实验', link: '/lab-fortune/experiments/' },
            { text: '内容路线图', link: '/lab-fortune/roadmap' },
          ],
        },
      ],
    },
  },
});
