import type { DefaultTheme } from 'vitepress';

export const labTechnologySidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '技术实验',
    items: [
      { text: '专题首页', link: '/lab-technology/' },
      {
        text: 'TdxQuant',
        collapsed: false,
        items: [
          {
            text: '安装通达信金融终端与 Python 环境',
            link: '/lab-technology/tdxquant/installation',
          },
          {
            text: '使用 curl 和 Python 获取第一份行情数据',
            link: '/lab-technology/tdxquant/basic-usage',
          },
          {
            text: '封装内部行情服务',
            link: '/lab-technology/tdxquant/build-http-service',
          },
          {
            text: '踩坑：前复权行情随查询结束日期变化',
            link: '/lab-technology/tdxquant/pitfalls/tdxquant_front_adjustment_end_time',
          },
        ],
      },
    ],
  },
];
