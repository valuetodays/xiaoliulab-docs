import { createContentLoader } from 'vitepress';
import {
  getOrientation,
  orientations,
  type OrientationDefinition,
} from './orientations';

export interface ArticleMeta {
  title: string;
  link: string;
  tags?: string[];
  orientations?: string[];
}

export interface OrientationGroup {
  orientation: OrientationDefinition;
  articles: ArticleMeta[];
}

export interface OrientationsData {
  groups: OrientationGroup[];
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter((item): item is string => typeof item === 'string');
  return values.length > 0 ? values : undefined;
}

export default createContentLoader('**/*.md', {
  transform(pages): OrientationsData {
    const articles: ArticleMeta[] = [];

    for (const page of pages) {
      const articleOrientations = stringArray(page.frontmatter.orientations);

      if (!articleOrientations) {
        continue;
      }

      for (const code of articleOrientations) {
        if (!getOrientation(code)) {
          console.warn(
            `[orientations] Unknown orientation code "${code}" in ${page.url}`,
          );
        }
      }

      const validOrientations = [...new Set(
        articleOrientations.filter((code) => getOrientation(code)),
      )];

      if (validOrientations.length === 0) {
        continue;
      }

      articles.push({
        title: typeof page.frontmatter.title === 'string'
          ? page.frontmatter.title
          : page.url,
        link: page.url,
        tags: stringArray(page.frontmatter.tags),
        orientations: validOrientations,
      });
    }

    return {
      groups: orientations.map((orientation) => ({
        orientation,
        articles: articles.filter((article) => (
          article.orientations?.includes(orientation.code)
        )),
      })),
    };
  },
});
