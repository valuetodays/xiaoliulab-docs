import type { DefaultTheme } from 'vitepress';

export const labFortuneSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '金融实验',
    items: [
      { text: '专题首页', link: '/lab-fortune/' },
      { text: '金融基础', link: '/lab-fortune/foundation/' },
      {
        text: '数据实验',
        link: '/lab-fortune/lab-data/why-investment-research-needs-reliable-data',
      },
      { text: '探索金融', link: '/lab-fortune/lab-finance-exploration/' },
      { text: '做T实验', link: '/lab-fortune/lab-zuot/' },
      { text: '策略实验', link: '/lab-fortune/experiments/' },
      { text: '金融历史', link: '/lab-fortune/financial-history/' },
      { text: '内容路线图', link: '/lab-fortune/roadmap' },
    ],
  },
];
