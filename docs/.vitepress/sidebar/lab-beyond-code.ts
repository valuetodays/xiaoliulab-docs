import type { DefaultTheme } from 'vitepress';

export const labBeyondCodeSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '代码之外',
    items: [
      { text: '专题首页', link: '/lab-beyond-code/' },
      {
        text: '工程交付',
        collapsed: false,
        items: [
          {
            text: '功能开发完成了，为什么半年还没上线？',
            link: '/lab-beyond-code/delivery/feature-developed-but-not-released',
          },
        ],
      },
      {
        text: '团队与协作',
        collapsed: false,
        items: [
          {
            text: '我心目中的理想团队',
            link: '/lab-beyond-code/team/my-ideal-team',
          },
        ],
      },
      {
        text: '工程治理',
        collapsed: false,
        items: [
          {
            text: '接手一个没有单元测试的遗留系统，我会从哪里开始？',
            link: '/lab-beyond-code/governance/legacy-system-unit-testing-start-guide',
          },
          {
            text: '单元测试跑起来了，为什么后来又停了？',
            link: '/lab-beyond-code/governance/unit-test-ci-sustainability',
          },
        ],
      },
      {
        text: '经验与成长',
        collapsed: false,
        items: [
          {
            text: '工程经验如何传递，而不是让每个人重新踩坑？',
            link: '/lab-beyond-code/growth/engineering-experience-transfer',
          },
          {
            text: 'AI 能写代码之后，工程师还需要做什么？',
            link: '/lab-beyond-code/growth/ai-coding-engineer-role',
          },
        ],
      },
      {
        text: '工程判断',
        collapsed: false,
        items: [
          {
            text: '从发现问题到解决问题，中间隔着什么？',
            link: '/lab-beyond-code/judgment/from-identifying-to-solving-problems',
          },
        ],
      },
    ],
  },
];
