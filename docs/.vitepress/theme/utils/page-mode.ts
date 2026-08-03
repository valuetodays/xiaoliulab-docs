export const PAGE_MODE = {
  DEFAULT: 'default',
  VIDEO: 'video',
} as const;

export type PageMode = (typeof PAGE_MODE)[keyof typeof PAGE_MODE];

export function parsePageMode(search: string): PageMode {
  const mode = new URLSearchParams(search).get('mode');

  switch (mode) {
    case PAGE_MODE.VIDEO:
      return PAGE_MODE.VIDEO;

    default:
      return PAGE_MODE.DEFAULT;
  }
}

export function getPageMode(): PageMode {
  if (typeof window === 'undefined') {
    return PAGE_MODE.DEFAULT;
  }

  return parsePageMode(window.location.search);
}

export function isVideoMode(): boolean {
  return getPageMode() === PAGE_MODE.VIDEO;
}

export function applyPageMode(): PageMode {
  const pageMode = getPageMode();

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.pageMode = pageMode;
  }

  return pageMode;
}

export function getPageModeInitScript(): string {
  const defaultMode = JSON.stringify(PAGE_MODE.DEFAULT);
  const videoMode = JSON.stringify(PAGE_MODE.VIDEO);

  return `(() => {
    const requestedMode = new URLSearchParams(window.location.search).get('mode');
    document.documentElement.dataset.pageMode = requestedMode === ${videoMode}
      ? ${videoMode}
      : ${defaultMode};
  })();`;
}
