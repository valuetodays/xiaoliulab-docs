import { createContentLoader } from 'vitepress';

const demoCdnPrefix =
  'https://cdn.jsdelivr.net/gh/valuetodays/supreme-octo-palm-tree';
const demoUrlPattern = new RegExp(
  `${demoCdnPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\s)"'<>]*`,
  'g',
);

export interface DemoAttachment {
  name: string;
  url: string;
  format?: string;
}

export interface DemoDocument {
  title: string;
  description?: string;
  link: string;
  attachments: DemoAttachment[];
}

export interface DemosData {
  documents: DemoDocument[];
}

function getAttachmentName(url: string): string {
  const pathname = new URL(url).pathname;
  const filename = pathname.split('/').pop();

  return filename ? decodeURIComponent(filename) : 'Demo 附件';
}

function getAttachmentFormat(name: string): string | undefined {
  const extension = name.match(/\.([a-z0-9]+)$/i)?.[1];
  return extension?.toUpperCase();
}

export default createContentLoader('**/*.md', {
  includeSrc: true,
  transform(pages): DemosData {
    const documents: DemoDocument[] = [];

    for (const page of pages) {
      if (!page.src) {
        continue;
      }

      const urls = [...new Set(page.src.match(demoUrlPattern) ?? [])];

      if (urls.length === 0) {
        continue;
      }

      documents.push({
        title: typeof page.frontmatter.title === 'string'
          ? page.frontmatter.title
          : page.url,
        description: typeof page.frontmatter.description === 'string'
          ? page.frontmatter.description
          : undefined,
        link: page.url,
        attachments: urls.map((url) => {
          const name = getAttachmentName(url);

          return {
            name,
            url,
            format: getAttachmentFormat(name),
          };
        }),
      });
    }

    documents.sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));

    return { documents };
  },
});
