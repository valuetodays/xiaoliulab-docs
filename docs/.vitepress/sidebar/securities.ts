import type { DefaultTheme } from 'vitepress';

export const securitiesSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '证券工程',
    items: [
      { text: '专题首页', link: '/securities/' },
      {
        text: '为什么我开始自己开发证券软件？',
        link: '/securities/why-i-built-it',
      },
    ],
  },
];
