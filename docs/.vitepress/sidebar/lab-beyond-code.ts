import type { DefaultTheme } from 'vitepress';

export const labBeyondCodeSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '代码之外',
    items: [
      { text: '专题首页', link: '/lab-beyond-code/' },
      {
        text: '工程交付',
        collapsed: false,
        items: [
          {
            text: '功能开发完成了，为什么半年还没上线？',
            link: '/lab-beyond-code/delivery/feature-developed-but-not-released',
          },
        ],
      },
      {
        text: '团队与协作',
        collapsed: false,
        items: [],
      },
      {
        text: '工程治理',
        collapsed: false,
        items: [],
      },
      {
        text: '经验与成长',
        collapsed: false,
        items: [],
      },
      {
        text: '工程判断',
        collapsed: false,
        items: [],
      },
    ],
  },
];
