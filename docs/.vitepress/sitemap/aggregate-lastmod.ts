import type { ContentData } from 'vitepress';
import { getDemoUrls, isArticlePage } from '../data/content-sources';

interface SitemapItem {
  url: string;
  lastmod?: string | number | Date;
}

function timestamp(value: SitemapItem['lastmod']): number {
  const result = value instanceof Date
    ? value.getTime()
    : typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Date.parse(value)
        : 0;

  return Number.isFinite(result) && result > 0 ? result : 0;
}

/** 为首页和 Demo 汇总补上其上游文档的更新时间，保留页面自身较新的时间。 */
export function updateAggregateLastmod(items: SitemapItem[], pages: ContentData[]): void {
  const itemByUrl = new Map(
    items.map((item) => [item.url.replace(/^\/+/, ''), item]),
  );
  const pageByUrl = new Map(
    pages.map((page) => [page.url.replace(/^\/+/, ''), page]),
  );

  function advance(url: string, source: SitemapItem): void {
    const target = itemByUrl.get(url);

    if (
      target
      && pageByUrl.get(url)?.frontmatter.lastUpdated !== false
      && timestamp(source.lastmod) > timestamp(target.lastmod)
    ) {
      target.lastmod = source.lastmod;
    }
  }

  for (const page of pages) {
    const source = itemByUrl.get(page.url.replace(/^\/+/, ''));

    if (!source || !timestamp(source.lastmod)) {
      continue;
    }

    if (isArticlePage(page) && page.src?.trim()) {
      advance('', source);
    }

    if (getDemoUrls(page.src ?? '').length > 0) {
      advance('demos/', source);
    }
  }
}
