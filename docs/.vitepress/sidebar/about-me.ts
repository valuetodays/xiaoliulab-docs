import type { DefaultTheme } from 'vitepress';

export const aboutMeSidebar: DefaultTheme.SidebarItem[] = [
  {
    items: [
      { text: '关于我', link: '/about-me/' },
      { text: '童年和求学经历', link: '/about-me/education' },
      { text: '工作经历', link: '/about-me/career' },
    ],
  },
  {
    items: [
      { text: '关于小刘实验室', link: '/about-me/website' },
    ],
  },
];
