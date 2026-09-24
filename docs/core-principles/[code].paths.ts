import { defineRoutes } from 'vitepress';
import {
  corePrinciples,
  getCorePrinciple,
} from '../.vitepress/data/core-principles';

export default defineRoutes({
  paths: corePrinciples.map((corePrinciple) => ({
    params: { code: corePrinciple.code },
  })),
  transformPageData(pageData) {
    const corePrinciple = getCorePrinciple(pageData.params?.code);

    if (!corePrinciple) {
      return;
    }

    return {
      title: corePrinciple.name,
      description: corePrinciple.description,
      frontmatter: {
        ...pageData.frontmatter,
        title: corePrinciple.name,
        description: corePrinciple.description,
      },
    };
  },
});
