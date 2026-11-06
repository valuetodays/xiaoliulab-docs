import type { DefaultTheme } from 'vitepress';

export const lifeTopicsSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '人生课题',
    items: [
      {
        text: '生存基础',
        collapsed: false,
        items: [
          {
            text: '生存基础：健康与金钱',
            link: '/life-topics/survival/health-and-money',
          },
        ],
      },
    ],
  },
];
