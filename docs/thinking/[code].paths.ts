import { defineRoutes } from 'vitepress';
import { getPrinciple, principles } from '../.vitepress/data/principles';

export default defineRoutes({
  paths: principles.map((principle) => ({
    params: { code: principle.code },
  })),
  transformPageData(pageData) {
    const principle = getPrinciple(pageData.params?.code);

    if (!principle) {
      return;
    }

    return {
      title: principle.name,
      description: principle.description,
      frontmatter: {
        ...pageData.frontmatter,
        title: principle.name,
        description: principle.description,
      },
    };
  },
});
