import type { DefaultTheme } from 'vitepress';

export const financialHistorySidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '金融历史',
    items: [
      { text: '金融实验首页', link: '/lab-fortune/' },
      { text: '金融历史首页', link: '/lab-fortune/financial-history/' },
      {
        text: '从 LTCM 到 JWM',
        link: '/lab-fortune/financial-history/ltcm-to-jwm-survival-risk',
      },
    ],
  },
];
