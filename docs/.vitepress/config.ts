import { createContentLoader, defineConfig, type HeadConfig } from 'vitepress';
import { getCorePrinciple } from './data/core-principles';
import { articleMetadataPlugin } from './markdown/article-metadata';
import { deepDrawdownSidebar } from './sidebar/lab-fortune/deep-drawdown';
import { experimentsSidebar } from './sidebar/lab-fortune/experiments';
import { financialHistorySidebar } from './sidebar/lab-fortune/financial-history';
import { foundationSidebar } from './sidebar/lab-fortune/foundation';
import { labDataSidebar } from './sidebar/lab-fortune/lab-data';
import { financeExplorationSidebar } from './sidebar/lab-fortune/lab-finance-exploration';
import { labFortuneSidebar } from './sidebar/lab-fortune/index';
import { labZuotSidebar } from './sidebar/lab-fortune/lab-zuot';
import { labTechExplorationSidebar } from './sidebar/lab-tech-exploration';
import { labTechnologySidebar } from './sidebar/lab-technology';
import { wechatSidebar } from './sidebar/wechat';
import { getPageModeInitScript } from './theme/utils/page-mode';
import { megaMenuTriggerTexts } from './theme/mega-menu';

const siteHostname = 'docs.xiaoliulab.com';
const siteUrl = `https://${siteHostname}`;

// 已迁移页面的旧路径。
// 旧页面仅用于历史链接跳转，不加入 sitemap。
const sitemapExcludedPaths = [
  'lab-tech-exploration/maven-pom-simplification-history',
  'lab-tech-exploration/https-certificate-secondary-validation-dns-timeout',
];

// refer https://vitepress.dev/reference/site-config for details
export default defineConfig({
  lang: 'zh-CN',
  title: '小刘实验室',
  cleanUrls: true,
  description: '记录真实实验、真实验证与持续迭代的技术和金融实践。',
  base: '/',
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['script', {}, getPageModeInitScript()],
    [
      'script',
      {},
      `
        (() => {
          const isAllowedHost = window.location.hostname === '${siteHostname}';

          if (
            !isAllowedHost ||
            document.querySelector('[data-website-id="a-web-xiaoliulab-docs"]')
          ) {
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://myanalytics.pages.dev/tracker.min.js';
          script.defer = true;
          script.dataset.websiteId = 'a-web-xiaoliulab-docs';
          document.head.appendChild(script);
        })();
      `,
    ],
    [
      'script',
      {},
      `
        (() => {
          const isAllowedHost = window.location.hostname === '${siteHostname}';

          if (
            !isAllowedHost ||
            document.querySelector('[data-website-id="db0bb7bc-ca11-4a48-8f3f-6688967e6711"]')
          ) {
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://analytics.seenext.cn/script.js';
          script.defer = true;
          script.dataset.websiteId = 'db0bb7bc-ca11-4a48-8f3f-6688967e6711';
          document.head.appendChild(script);
        })();
      `,
    ],
  ],
  sitemap: {
    hostname: `${siteUrl}/`,
    async transformItems(items) {
      const sitemapItemByUrl = new Map(
        items.map((item) => [item.url.replace(/^\/+/, ''), item]),
      );
      const pages = await createContentLoader('**/*.md').load();
      const latestArticleByCorePrinciple = new Map<
        string,
        { item: (typeof items)[number]; timestamp: number }
      >();

      for (const page of pages) {
        const articleCorePrinciples = page.frontmatter['core-principles'];

        if (!Array.isArray(articleCorePrinciples)) {
          continue;
        }

        const sitemapItem = sitemapItemByUrl.get(page.url.replace(/^\/+/, ''));
        const lastmod = sitemapItem?.lastmod;
        const timestamp = lastmod instanceof Date
          ? lastmod.getTime()
          : typeof lastmod === 'number'
            ? lastmod
            : typeof lastmod === 'string'
              ? Date.parse(lastmod)
              : 0;

        if (!(timestamp > 0) || !sitemapItem) {
          continue;
        }

        for (const code of articleCorePrinciples) {
          if (typeof code !== 'string' || !getCorePrinciple(code)) {
            continue;
          }

          const current = latestArticleByCorePrinciple.get(code);

          if (!current || timestamp > current.timestamp) {
            latestArticleByCorePrinciple.set(code, { item: sitemapItem, timestamp });
          }
        }
      }

      for (const [code, latestArticle] of latestArticleByCorePrinciple) {
        const detailItem = sitemapItemByUrl.get(`orientations/${code}`);

        if (detailItem) {
          detailItem.lastmod = latestArticle.item.lastmod;
        }
      }

      return items.filter((item) => !sitemapExcludedPaths.includes(item.url));
    },
  },
  transformHead({ pageData }) {
    const relativePath = pageData.relativePath
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '');
    const frontmatterCanonical = pageData.frontmatter.head?.find(
      ([tag, attrs]) => tag === 'link' && attrs.rel === 'canonical',
    );
    const canonicalUrl = frontmatterCanonical?.[1].href ?? `${siteUrl}/${relativePath}`;
    const canonicalHead: HeadConfig[] = frontmatterCanonical
      ? []
      : [['link', { rel: 'canonical', href: canonicalUrl }]];

    return [
      ...canonicalHead,
      ['meta', { property: 'og:type', content: 'article' }],
      ['meta', { property: 'og:locale', content: 'zh_CN' }],
      ['meta', { property: 'og:site_name', content: '小刘实验室' }],
      ['meta', { property: 'og:title', content: pageData.title }],
      ['meta', { property: 'og:description', content: pageData.description }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
    ];
  },
  vite: {
    server: {
      allowedHosts: ['v200'],
    },
  },
  markdown: {
    math: true,
    config(markdown) {
      markdown.use(articleMetadataPlugin);
    },
  },

  themeConfig: {
    outline: [2, 3],

    footer: {
      message: `
        <span class="beian-links">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
            ICP备案号：京ICP备17040585号-6
          </a>
          <span class="beian-public-security">
            <span class="beian-separator" aria-hidden="true">|</span>
            <a
              href="https://beian.mps.gov.cn/#/query/webSearch?code=11010802049380"
              target="_blank"
              rel="noopener noreferrer"
              class="beian-link"
            >
              <img src="/images/gaba-icon.png" alt="" />
              京公网安备 11010802049380号
            </a>
          </span>
        </span>
      `,
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },

    nav: [
      { text: '首页', link: '/' },
      { text: '微信支付', link: '/wechat/' },
      ...megaMenuTriggerTexts.map((text) => ({
        component: 'MegaMenuTrigger',
        props: { text },
      })),
    ],

    sidebar: {
      '/lab-tech-exploration/': labTechExplorationSidebar,
      '/wechat/': wechatSidebar,
      '/lab-technology/': labTechnologySidebar,
      '/lab-fortune/deep-drawdown/': deepDrawdownSidebar,
      '/lab-fortune/financial-history/': financialHistorySidebar,
      '/lab-fortune/foundation/': foundationSidebar,
      '/lab-fortune/lab-data/': labDataSidebar,
      '/lab-fortune/lab-finance-exploration/': financeExplorationSidebar,
      '/lab-fortune/lab-zuot/': labZuotSidebar,
      '/lab-fortune/experiments/': experimentsSidebar,
      '/lab-fortune/': labFortuneSidebar,
    },
  },
});
