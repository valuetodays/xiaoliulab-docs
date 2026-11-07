import type { DefaultTheme } from 'vitepress';

export const securitiesSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '证券工程',
    items: [
      { text: '专题首页', link: '/securities/' },
      {
        text: '为什么我开始自己开发证券软件？',
        link: '/securities/why-i-built-it',
      },
      {
        text: '证券交易管理',
        collapsed: false,
        items: [
          {
            text: '从零打通 Java、Python 与 QMT 的真实证券交易链路',
            link: '/securities/trading/programmatic-t-trading',
          },
          {
            text: '从一买一卖到成交中和：我的做 T 交易记录模型如何演进',
            link: '/securities/trading/trade-offset-evolution',
          },
        ],
      },
      {
        text: '融资业务',
        collapsed: false,
        items: [
          {
            text: '一笔融资交易，究竟什么时候才算结束？',
            link: '/securities/margin/margin-debt-lifecycle',
          },
        ],
      },
      {
        text: '期权业务',
        collapsed: false,
        items: [
          {
            text: '从 ETF 到期权：时间为什么改变了我的交易方式？',
            link: '/securities/options/etf-to-options-time-and-trading',
          },
        ],
      },
    ],
  },
];
