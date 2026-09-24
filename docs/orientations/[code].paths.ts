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
      title: '页面已移动',
      description: `“${corePrinciple.name}”内核思想页面已移动到新地址。`,
      frontmatter: {
        ...pageData.frontmatter,
        title: '页面已移动',
        description: `“${corePrinciple.name}”内核思想页面已移动到新地址。`,
        canonical: `/core-principles/${corePrinciple.code}`,
        head: [
          [
            'meta',
            {
              'http-equiv': 'refresh',
              content: `0; url=/core-principles/${corePrinciple.code}`,
            },
          ],
        ],
      },
    };
  },
});
