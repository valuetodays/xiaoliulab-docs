import type { DefaultTheme } from 'vitepress';

export const wechatSidebar: DefaultTheme.SidebarItem[] = [
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
];
