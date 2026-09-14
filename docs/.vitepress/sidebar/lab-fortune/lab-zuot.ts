import type { DefaultTheme } from 'vitepress';

export const labZuotSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '做T实验',
    items: [
      { text: '金融实验首页', link: '/lab-fortune/' },
      { text: '做T实验首页', link: '/lab-fortune/lab-zuot/' },
      {
        text: '基础认知',
        collapsed: true,
        items: [
          { text: '为什么会有这个“做T实验”？', link: '/lab-fortune/lab-zuot/basics/why-this-lab' },
          { text: '做T的数学基础', link: '/lab-fortune/lab-zuot/basics/math-foundation' },
          { text: '什么样的标的适合做T？', link: '/lab-fortune/lab-zuot/basics/what-makes-a-good-target' },
          { text: '为什么我选择红利ETF？', link: '/lab-fortune/lab-zuot/basics/why-i-finally-chose-dividend-etf' },
          { text: '为什么第一笔交易最难？', link: '/lab-fortune/lab-zuot/basics/why-first-trade-is-hard' },
        ],
      },
      {
        text: '统计与信号',
        collapsed: true,
        items: [
          { text: '为什么历史行情值得研究？', link: '/lab-fortune/lab-zuot/signal/why-study-historical-market-data' },
          { text: '历史行情里究竟有哪些数据？', link: '/lab-fortune/lab-zuot/signal/what-data-does-market-history-contain' },
          { text: '为什么历史数据不能直接给出交易答案？', link: '/lab-fortune/lab-zuot/signal/why-historical-data-cannot-give-answer' },
          { text: '什么样的统计结果才值得相信？', link: '/lab-fortune/lab-zuot/signal/what-statistics-make-a-trading-signal-reliable' },
          { text: '为什么技术指标需要历史验证？', link: '/lab-fortune/lab-zuot/signal/why-technical-indicators-need-historical-validation' },
          { text: '如何利用历史数据寻找交易机会？', link: '/lab-fortune/lab-zuot/signal/how-to-find-trading-opportunities-with-historical-data' },
          { text: '历史上，价格通常能走多远？', link: '/lab-fortune/lab-zuot/signal/how-far-does-price-usually-move' },
          { text: '为什么不同市场状态，需要不同的历史统计？', link: '/lab-fortune/lab-zuot/signal/why-different-market-regimes-need-different-statistics' },
        ],
      },
      {
        text: '交易工程',
        collapsed: true,
        items: [
          { text: '一轮做 T 是怎样完成的？', link: '/lab-fortune/lab-zuot/engineering/how-a-t-trade-cycle-works' },
        ],
      },
    ],
  },
];
