import type { DefaultTheme } from 'vitepress';

export const deepDrawdownSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '深度回撤',
    items: [
      { text: '金融实验首页', link: '/lab-fortune/' },
      {
        text: '512690：一次“微型股灾”实盘复盘',
        link: '/lab-fortune/deep-drawdown/512690-micro-crash-review',
      },
      {
        text: '512170：深度回撤前瞻实验',
        link: '/lab-fortune/deep-drawdown/512170-deep-drawdown-plan',
      },
    ],
  },
];
