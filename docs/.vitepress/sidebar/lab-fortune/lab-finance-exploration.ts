import type { DefaultTheme } from 'vitepress';

export const financeExplorationSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '探索金融',
    items: [
      { text: '金融实验首页', link: '/lab-fortune/' },
      { text: '探索金融首页', link: '/lab-fortune/lab-finance-exploration/' },
      { text: '为什么有探索金融？', link: '/lab-fortune/lab-finance-exploration/why-this-finance-exploration' },
      {
        text: '余额宝',
        collapsed: false,
        items: [
          { text: '为什么钱放在银行会有利息？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-do-banks-pay-interest' },
          { text: '为什么把钱放进余额宝，不是把钱存进支付宝？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-isnt-money-in-yuebao-stored-by-alipay' },
          { text: '为什么把钱放进余额宝后，它不会一直放在那里？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-doesnt-money-in-yuebao-stay-there' },
          { text: '为什么余额宝里的金额经常变化？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-does-the-amount-in-yuebao-change-every-day' },
          { text: '为什么余额宝会显示“七日年化”？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-does-yuebao-show-seven-day-annualized-rate' },
          { text: '为什么余额宝里的钱能比较方便地转出？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-can-money-in-yuebao-be-withdrawn-anytime' },
          { text: '为什么同时显示每万份收益和七日年化？', link: '/lab-fortune/lab-finance-exploration/01-yuebao/why-does-yuebao-show-both-ten-thousand-yield-and-seven-day-annualized-rate' },
        ],
      },
      {
        text: '金融认知起点',
        collapsed: false,
        items: [
          { text: '为什么我开始重新学习金钱？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-did-i-start-learning-about-money' },
          { text: '为什么有些东西看起来很值钱，却不一定是资产？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-are-some-expensive-things-not-assets' },
          { text: '从收入支出开始，理解现金流与净资产', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/understanding-wealth-from-income-expenses' },
          { text: '为什么账户余额增加，购买力却不一定同步增加？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-saving-money-may-not-grow-wealth' },
          { text: '普通投资者为什么需要了解投资？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-ordinary-investors-need-to-understand-investing' },
          { text: '投资收益到底来自哪里？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-investment-generates-returns' },
          { text: '风险与收益：为什么高收益伴随高波动？', link: '/lab-fortune/lab-finance-exploration/02-changing-how-i-think-about-money/why-high-return-means-high-risk' },
        ],
      },
      {
        text: '投资工具',
        collapsed: false,
        items: [
          { text: '支付宝里的基金，到底是什么？', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/what-are-funds-on-alipay' },
          { text: '从支付宝基金到 ETF', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/from-alipay-fund-to-etf' },
          { text: '我在证券账户里买 ETF，钱到底去了哪里？', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/where-does-my-money-go-when-i-buy-an-etf' },
          { text: 'ETF 的份额是怎么产生的？', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/how-are-etf-shares-created' },
          { text: 'ETF 为什么会出现折价和溢价？', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/why-etf-trades-at-premium-or-discount' },
          { text: '同样跟踪一个指数的 ETF，为什么还会有区别？', link: '/lab-fortune/lab-finance-exploration/03-investment-tools/why-etfs-tracking-the-same-index-differ' },
        ],
      },
    ],
  },
];
