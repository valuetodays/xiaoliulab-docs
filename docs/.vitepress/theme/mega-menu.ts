export interface MegaMenuItem {
  text: string;
  link: string;
}

export interface MegaMenuGroup {
  title: string;
  items: readonly MegaMenuItem[];
}

export const megaMenuGroups = [
  {
    title: '技术',
    items: [
      { text: '技术实验', link: '/lab-technology/' },
      { text: '探索技术', link: '/lab-tech-exploration/' },
    ],
  },
  {
    title: '金融',
    items: [
      { text: '金融实验', link: '/lab-fortune/' },
      { text: '探索金融', link: '/lab-fortune/lab-finance-exploration/' },
      { text: '做T实验', link: '/lab-fortune/lab-zuot/' },
    ],
  },
  {
    title: '站点',
    items: [
      { text: '取向', link: '/orientations/' },
      { text: '更新日志', link: '/changelog' },
    ],
  },
] as const satisfies readonly MegaMenuGroup[];

export const megaMenuTriggerTexts = ['技术', '金融', '更多'] as const;

export type MegaMenuTriggerText = (typeof megaMenuTriggerTexts)[number];

const mobileGroupTitleByTrigger: Record<MegaMenuTriggerText, string> = {
  技术: '技术',
  金融: '金融',
  更多: '站点',
};

export function getMegaMenuGroupForTrigger(text: MegaMenuTriggerText) {
  const title = mobileGroupTitleByTrigger[text];
  return megaMenuGroups.find((group) => group.title === title)!;
}
