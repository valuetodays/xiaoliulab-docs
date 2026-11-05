import type { DefaultTheme } from 'vitepress';

export const foundationSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '金融基础',
    items: [
      { text: '金融实验首页', link: '/lab-fortune/' },
      { text: '金融基础首页', link: '/lab-fortune/foundation/' },
      {
        text: '投资工具',
        collapsed: false,
        items: [
          { text: '宽基 ETF 和行业 ETF', link: '/lab-fortune/foundation/instruments/broad-vs-sector-etf' },
          { text: '交易成本', link: '/lab-fortune/foundation/instruments/stock-vs-etf' },
          { text: 'ETF 和联接基金怎么选？', link: '/lab-fortune/foundation/instruments/etf-vs-etf-feeder-fund' },
          { text: '指数观察指标', link: '/lab-fortune/foundation/instruments/index-observation-indicators' },
        ],
      },
      {
        text: '收益与复投',
        collapsed: false,
        items: [
          { text: '月度分红比季度分红更划算吗？', link: '/lab-fortune/foundation/returns/monthly-vs-quarterly-dividend-reinvestment' },
        ],
      },
      {
        text: '交易基础',
        collapsed: false,
        items: [
          { text: 'T+0 与 T+1', link: '/lab-fortune/foundation/trading/t0-vs-t1' },
          { text: '交易成本', link: '/lab-fortune/foundation/trading/trading-cost' },
        ],
      },
    ],
  },
];
