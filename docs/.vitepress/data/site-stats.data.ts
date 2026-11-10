import {
  createContentLoader,
  createMarkdownRenderer,
} from 'vitepress';
import { isArticlePage } from './content-sources';

export { isArticlePage } from './content-sources';

export interface SiteStats {
  articleCount: number;
  wordCount: number;
  builtAt: string;
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
