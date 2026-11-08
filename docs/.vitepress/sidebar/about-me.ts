import type { DefaultTheme } from 'vitepress';

export const aboutMeSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '关于我',
    items: [
      { text: '专题首页', link: '/about-me/' },
      { text: '关于小刘实验室', link: '/about-me/website' },
      { text: '童年和求学经历', link: '/about-me/education' },
      { text: '工作经历', link: '/about-me/career' },
    ],
  },
];
