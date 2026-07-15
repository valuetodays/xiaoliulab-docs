import { defineConfig } from 'vitepress';

const siteUrl = 'https://valuetodays.github.io/xiaoliulab-docs';

// refer https://vitepress.dev/reference/site-config for details
export default defineConfig({
  lang: 'zh-CN',
  title: '小刘实验室',
  description: '记录真实实验、真实验证与持续迭代的技术和金融实践。',
  base: '/xiaoliulab-docs/',
  lastUpdated: true,
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
      { text: '做T实验室', link: '/zuot/' },
    ],

    sidebar: {
      '/wechat/': [
        {
          text: '微信支付实验',
          items: [
            { text: '专题首页', link: '/wechat/' },
            { text: '微信支付接入路线', link: '/wechat/getting-started/' },
            { text: '微信 Native Pay 最小接入指南', link: '/wechat/native-pay-mvp/' },
            { text: '微信 Code Pay 最小接入指南', link: '/wechat/code-pay-mvp/' },
            { text: '微信 JSAPI Pay 最小接入指南', link: '/wechat/jsapi-pay-mvp/' },
            { text: '微信 H5 Pay 支持情况', link: '/wechat/h5-pay-mvp/' },
          ],
        },
      ],
      '/zuot/': [
        {
          text: '做T实验室',
          items: [
            { text: '专题首页', link: '/zuot/' },
          ],
        },
      ],
    },
  },
});
