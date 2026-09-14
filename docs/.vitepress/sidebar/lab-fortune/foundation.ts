import type { DefaultTheme } from 'vitepress';

export const foundationSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '金融基础',
    items: [
      { text: '金融实验首页', link: '/lab-fortune/' },
      { text: '金融基础首页', link: '/lab-fortune/foundation/' },
      {
        text: '投资工具',
        collapsed: true,
        items: [
          { text: '宽基 ETF 和行业 ETF', link: '/lab-fortune/foundation/instruments/broad-vs-sector-etf' },
          { text: '交易成本', link: '/lab-fortune/foundation/instruments/stock-vs-etf' },
          { text: '指数观察指标', link: '/lab-fortune/foundation/instruments/index-observation-indicators' },
        ],
      },
      {
        text: '交易基础',
        collapsed: true,
        items: [
          { text: 'T+0 与 T+1', link: '/lab-fortune/foundation/trading/t0-vs-t1' },
          { text: '交易成本', link: '/lab-fortune/foundation/trading/trading-cost' },
        ],
      },
    ],
  },
];
