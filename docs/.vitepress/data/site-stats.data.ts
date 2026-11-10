import {
  createContentLoader,
  createMarkdownRenderer,
  type ContentData,
} from 'vitepress';

export interface SiteStats {
  articleCount: number;
  wordCount: number;
  builtAt: string;
}

// 该专题首页没有 articleMeta: false，单独按目录页排除。
const TOPIC_INDEX_URLS = new Set(['/lab-fortune/lab-finance-exploration/']);

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

export default createContentLoader('**/*.md', {
  includeSrc: true,
  async transform(pages): Promise<SiteStats> {
    // Content loader 已初始化站点的 Markdown renderer，这里复用它及单篇字数插件。
    const markdown = await createMarkdownRenderer(process.cwd());
    const stats: SiteStats = {
      articleCount: 0,
      wordCount: 0,
      builtAt: new Date().toISOString(),
    };

    for (const page of pages) {
      if (!isArticlePage(page) || !page.src?.trim()) {
        continue;
      }

      const environment: { frontmatter?: Record<string, unknown> } = {};
      markdown.parse(page.src, environment);
      const wordCount = environment.frontmatter?.wordCount;

      if (typeof wordCount !== 'number' || !Number.isFinite(wordCount)) {
        throw new Error(`[site-stats] Missing article word count: ${page.url}`);
      }

      stats.articleCount += 1;
      stats.wordCount += wordCount;
    }

    return stats;
  },
});
