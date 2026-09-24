import { createContentLoader } from 'vitepress';
import {
  corePrinciples,
  getCorePrinciple,
  type CorePrincipleDefinition,
} from './core-principles';

export interface ArticleMeta {
  title: string;
  link: string;
  tags?: string[];
  corePrinciples?: string[];
}

export interface CorePrincipleGroup {
  corePrinciple: CorePrincipleDefinition;
  articles: ArticleMeta[];
}

export interface CorePrinciplesData {
  groups: CorePrincipleGroup[];
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter((item): item is string => typeof item === 'string');
  return values.length > 0 ? values : undefined;
}

export default createContentLoader('**/*.md', {
  transform(pages): CorePrinciplesData {
    const articles: ArticleMeta[] = [];

    for (const page of pages) {
      const articleCorePrinciples = stringArray(
        page.frontmatter['core-principles'],
      );

      if (!articleCorePrinciples) {
        continue;
      }

      for (const code of articleCorePrinciples) {
        if (!getCorePrinciple(code)) {
          console.warn(
            `[core-principles] Unknown core principle code "${code}" in ${page.url}`,
          );
        }
      }

      const validCorePrinciples = [...new Set(
        articleCorePrinciples.filter((code) => getCorePrinciple(code)),
      )];

      if (validCorePrinciples.length === 0) {
        continue;
      }

      articles.push({
        title: typeof page.frontmatter.title === 'string'
          ? page.frontmatter.title
          : page.url,
        link: page.url,
        tags: stringArray(page.frontmatter.tags),
        corePrinciples: validCorePrinciples,
      });
    }

    return {
      groups: corePrinciples.map((corePrinciple) => ({
        corePrinciple,
        articles: articles.filter((article) => (
          article.corePrinciples?.includes(corePrinciple.code)
        )),
      })),
    };
  },
});
