import type { DefaultTheme } from 'vitepress';

export const experimentsSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '策略实验',
    items: [
      { text: '金融实验首页', link: '/lab-fortune/' },
      { text: '策略实验首页', link: '/lab-fortune/experiments/' },
      { text: 'FTX-0001 红利类ETF一年持有实验', link: '/lab-fortune/experiments/ftx-0001-dividend-etf-one-year-holding' },
      { text: 'FTX-0002 五年机会实验', link: '/lab-fortune/experiments/ftx-0002-five-year-opportunity-experiment' },
      { text: 'FTX-0003 A股深度回撤修复实验', link: '/lab-fortune/experiments/ftx-0003-a-share-deep-drawdown-recovery-experiment' },
      { text: 'FTX-0010 CCI尾盘低位观察实验', link: '/lab-fortune/experiments/ftx-0010-cci-tail-low-observation' },
      { text: 'FTX-0011 510300 CCI超卖短期修复验证实验', link: '/lab-fortune/experiments/ftx-0011-510300-cci-oversold-repair' },
    ],
  },
];
