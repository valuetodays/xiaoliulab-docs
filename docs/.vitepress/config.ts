import { defineConfig } from 'vitepress';

// refer https://vitepress.dev/reference/site-config for details
export default defineConfig({
  lang: 'en-US',
  title: '小刘实验室',

  description: 'Vite & Vue powered static site generator.',

  themeConfig: {
    nav: [
      { text: 'Example', link: '/example' },

      // {
      //   text: 'Dropdown Menu',
      //   items: [
      //     { text: 'Item A', link: '/item-1' },
      //     { text: 'Item B', link: '/item-2' },
      //     { text: 'Item C', link: '/item-3' },
      //   ],
      // },

      // ...
    ],

    sidebar: [
      {
        // text: 'Guide',
        items: [
          { text: 'Example', link: '/example' },
          // ...
        ],
      },

      {
        text: '微信支付',
        items: [{ text: 'Native Pay MVP', link: '/wechat/native-pay-mvp/' }],
      },
    ],
  },
});
