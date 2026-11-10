import type { ContentData } from 'vitepress';

// 该专题首页没有 articleMeta: false，单独按目录页排除。
const TOPIC_INDEX_URLS = new Set(['/lab-fortune/lab-finance-exploration/']);
const demoUrlPattern = /https:\/\/cdn\.jsdelivr\.net\/gh\/valuetodays\/supreme-octo-palm-tree[^\s)"'<>]*/g;

export function isArticlePage(page: ContentData): boolean {
  const { frontmatter, url } = page;
  const head = frontmatter.head;
  const isRedirect = Array.isArray(head) && head.some((entry) => (
    Array.isArray(entry)
    && entry[0] === 'meta'
    && typeof entry[1]?.['http-equiv'] === 'string'
    && entry[1]['http-equiv'].toLowerCase() === 'refresh'
  ));

  return url !== '/'
    && !TOPIC_INDEX_URLS.has(url)
    && !/\/AGENTS(?:\.html)?$/i.test(url)
    && frontmatter.layout !== 'home'
    && frontmatter.articleMeta !== false
    && !isRedirect;
}

export function getDemoUrls(source: string): string[] {
  return [...new Set(source.match(demoUrlPattern) ?? [])];
}
