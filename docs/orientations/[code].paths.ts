import { defineRoutes } from 'vitepress';
import { getOrientation, orientations } from '../.vitepress/data/orientations';

export default defineRoutes({
  paths: orientations.map((orientation) => ({
    params: { code: orientation.code },
  })),
  transformPageData(pageData) {
    const orientation = getOrientation(pageData.params?.code);

    if (!orientation) {
      return;
    }

    return {
      title: orientation.name,
      description: orientation.description,
      frontmatter: {
        ...pageData.frontmatter,
        title: orientation.name,
        description: orientation.description,
      },
    };
  },
});
