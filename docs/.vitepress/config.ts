import { defineConfig } from 'vitepress';

// refer https://vitepress.dev/reference/site-config for details
export default defineConfig({
  lang: 'zh-CN',
  title: '小刘实验室',
  base: '/xiaoliulab-docs/',

  description: 'Vite & Vue powered static site generator.',

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '微信支付实验室', link: '/wechat/' },
    ],

    sidebar: {
      '/wechat/': [
        {
          text: '微信支付实验室',
          items: [
            { text: '专题首页', link: '/wechat/' },
            { text: 'Native Pay MVP', link: '/wechat/native-pay-mvp/' },
            { text: 'JSAPI Pay MVP（整理中）', link: '/wechat/jsapi-pay-mvp/' },
            { text: 'Code Pay MVP（整理中）', link: '/wechat/code-pay-mvp/' },
          ],
        },
      ],
    },
  },
});
