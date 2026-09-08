import { createContentLoader } from 'vitepress';
import {
  getPrinciple,
  principles,
  type PrincipleDefinition,
} from './principles';

export interface ArticleMeta {
  title: string;
  link: string;
  tags?: string[];
  principles?: string[];
}

export interface PrincipleGroup {
  principle: PrincipleDefinition;
  articles: ArticleMeta[];
}

export interface PrinciplesData {
  groups: PrincipleGroup[];
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter((item): item is string => typeof item === 'string');
  return values.length > 0 ? values : undefined;
}

export default createContentLoader('**/*.md', {
  transform(pages): PrinciplesData {
    const articles: ArticleMeta[] = [];

    for (const page of pages) {
      const articlePrinciples = stringArray(page.frontmatter.principles);

      if (!articlePrinciples) {
        continue;
      }

      for (const code of articlePrinciples) {
        if (!getPrinciple(code)) {
          console.warn(
            `[principles] Unknown principle code "${code}" in ${page.url}`,
          );
        }
      }

      const validPrinciples = [...new Set(
        articlePrinciples.filter((code) => getPrinciple(code)),
      )];

      if (validPrinciples.length === 0) {
        continue;
      }

      articles.push({
        title: typeof page.frontmatter.title === 'string'
          ? page.frontmatter.title
          : page.url,
        link: page.url,
        tags: stringArray(page.frontmatter.tags),
        principles: validPrinciples,
      });
    }

    return {
      groups: principles.map((principle) => ({
        principle,
        articles: articles.filter((article) => (
          article.principles?.includes(principle.code)
        )),
      })),
    };
  },
});
