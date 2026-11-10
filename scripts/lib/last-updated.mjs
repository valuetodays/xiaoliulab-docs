import { parse } from '@babel/parser';
import { createMarkdownRenderer } from 'vitepress';
import { countArticleWords } from '../../docs/.vitepress/markdown/article-metadata.ts';
import { getDemoUrls, isArticlePage } from '../../docs/.vitepress/data/content-sources.ts';

export const explicitDocuments = new Set([
  'docs/index.md', 'docs/demos/index.md', 'docs/core-principles/index.md',
]);
export const definitionFile = 'docs/.vitepress/data/core-principles.ts';
const detailTemplate = 'docs/core-principles/[code].md';
const detailComponent = 'docs/.vitepress/theme/components/CorePrincipleDetail.vue';
const overviewComponent = 'docs/.vitepress/theme/components/CorePrincipleIndex.vue';

export function isSnapshotFile(file) {
  return (/^docs\/(?!\.vitepress\/|public\/).*\.md$/.test(file)
    || [definitionFile, detailComponent, overviewComponent].includes(file));
}

function unwrap(node) {
  while (node?.type === 'TSAsExpression' || node?.type === 'TSSatisfiesExpression') {
    node = node.expression;
  }
  return node;
}

// 只读静态数据，不执行暂存区或旧版本中的 TypeScript。
export function readDefinitions(source) {
  if (!source) return [];
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript'] });
  const declarations = ast.program.body.flatMap((node) => (
    (node.type === 'ExportNamedDeclaration' ? node.declaration : node)?.declarations ?? []
  ));
  const array = unwrap(declarations.find((node) => node.id.name === 'corePrinciples')?.init);
  if (array?.type !== 'ArrayExpression') {
    throw new Error(definitionFile + ': corePrinciples 必须是静态对象数组');
  }
  const seen = new Set();
  return array.elements.map((element) => {
    const object = unwrap(element);
    if (object?.type !== 'ObjectExpression') throw new Error('思想定义必须是静态对象');
    const result = {};
    for (const property of object.properties) {
      if (property.type !== 'ObjectProperty' || property.computed) {
        throw new Error('思想定义不支持展开、方法或计算属性');
      }
      const key = property.key.name ?? property.key.value;
      const value = unwrap(property.value);
      if (value.type !== 'StringLiteral') throw new Error('思想字段必须是字符串：' + key);
      result[key] = value.value;
    }
    for (const key of ['code', 'name', 'color', 'description']) {
      if (typeof result[key] !== 'string') throw new Error('思想定义缺少字段：' + key);
    }
    if (seen.has(result.code)) throw new Error('重复思想代码：' + result.code);
    seen.add(result.code);
    return result;
  });
}

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function tokensView(tokens) {
  const result = [];
  for (const token of tokens) {
    if (token.hidden || token.type === 'frontmatter') continue;
    let type = token.type;
    let content = token.content;
    if (type === 'softbreak') { type = 'text'; content = ' '; }
    if (type.startsWith('html')) {
      content = content.replace(/<!--[\s\S]*?-->/g, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
      if (!content.trim()) continue;
    }
    if (!['fence', 'code_block', 'code_inline'].includes(type)) {
      content = content.replace(/\s+/g, ' ');
    }
    if (type === 'text' && result.at(-1)?.type === 'text') {
      result.at(-1).content = (result.at(-1).content + content).replace(/\s+/g, ' ');
      continue;
    }
    result.push({
      type, tag: token.tag, nesting: token.nesting, attrs: token.attrs,
      content: token.children ? undefined : content,
      children: token.children ? tokensView(token.children) : undefined,
    });
  }
  return result;
}

function pageView(page) {
  const { lastUpdated, wordCount, readingTime, ...frontmatter } = page.frontmatter;
  return { frontmatter, content: tokensView(page.tokens) };
}

function stripAstMetadata(value) {
  if (Array.isArray(value)) return value.map(stripAstMetadata);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['start', 'end', 'loc', 'extra', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key))
    .map(([key, child]) => [key, stripAstMetadata(child)]));
}

function componentView(source = '') {
  const template = source.match(/<template(?:\s[^>]*)?>([\s\S]*)<\/template>/)?.[1] ?? '';
  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => stripAstMetadata(parse(match[1], {
      sourceType: 'module', plugins: ['typescript'],
    }).program));
  return {
    template: template.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim(),
    scripts,
  };
}

function markdownTime(page) {
  const header = page.src.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? '';
  return {
    raw: header.match(/^lastUpdated:[ \t]*(.*?)[ \t]*(?:#.*)?$/m)?.[1]?.trim(),
    parsed: page.frontmatter.lastUpdated,
    markdown: true,
  };
}

export async function createProjector(root) {
  const markdown = await createMarkdownRenderer(root + '/docs', { math: true });
  return (files) => {
    const pages = [...files].filter(([file]) => /^docs\/(?!\.vitepress\/|public\/).*\.md$/.test(file))
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([file, src]) => {
        const environment = {};
        const tokens = markdown.parse(src, environment);
        return {
          file, src, tokens, frontmatter: environment.frontmatter ?? {},
          url: '/' + file.slice(5).replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, ''),
        };
      });
    const pageByFile = new Map(pages.map((page) => [page.file, page]));
    const definitions = readDefinitions(files.get(definitionFile));
    const members = (code) => pages.filter((page) => (
      Array.isArray(page.frontmatter['core-principles'])
      && page.frontmatter['core-principles'].includes(code)
    ));
    const records = new Map();
    for (const file of explicitDocuments) {
      const page = pageByFile.get(file);
      if (page) records.set(page.url, {
        url: page.url, location: file, time: markdownTime(page), view: pageView(page),
      });
    }
    const overview = records.get('/core-principles/');
    if (overview) Object.assign(overview.view, {
      groups: definitions.map(({ lastUpdated, ...definition }) => ({
        ...definition, count: members(definition.code).length,
      })),
      component: componentView(files.get(overviewComponent)),
    });
    const template = pageByFile.get(detailTemplate);
    for (const definition of definitions) {
      const url = '/core-principles/' + definition.code;
      records.set(url, {
        url, location: definitionFile + ' [' + definition.code + ']',
        time: { raw: definition.lastUpdated, parsed: definition.lastUpdated, markdown: false },
        view: {
          name: definition.name, description: definition.description,
          articles: members(definition.code).map((page) => ({
            title: typeof page.frontmatter.title === 'string' ? page.frontmatter.title : page.url,
            link: page.url,
          })),
          template: template ? pageView(template) : null,
          component: componentView(files.get(detailComponent)),
        },
      });
    }
    const home = records.get('/');
    if (home) {
      const articles = pages.filter((page) => isArticlePage(page) && page.src.trim());
      home.view.stats = {
        articleCount: articles.length,
        // 首页的 title 提示也展示完整字数，因此比较完整字数而非只有四舍五入后的文本。
        wordCount: articles.reduce((sum, page) => sum + countArticleWords(page.tokens), 0),
      };
    }
    const demos = records.get('/demos/');
    if (demos) demos.view.documents = pages.flatMap((page) => {
      const attachments = getDemoUrls(page.src);
      return attachments.length ? [{
        title: typeof page.frontmatter.title === 'string' ? page.frontmatter.title : page.url,
        description: typeof page.frontmatter.description === 'string' ? page.frontmatter.description : undefined,
        link: page.url, attachments,
      }] : [];
    }).sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
    return {
      records,
      ordinaryExplicit: pages.filter((page) => (
        !explicitDocuments.has(page.file) && Object.hasOwn(page.frontmatter, 'lastUpdated')
      )).map((page) => page.file),
    };
  };
}

function timestamp(time, now) {
  const match = time.raw?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/);
  if (!match) throw new Error('lastUpdated 必须是带时区的 ISO 8601 时间');
  if (time.markdown && !(time.parsed instanceof Date)) {
    throw new Error('Frontmatter 的 lastUpdated 必须是不加引号的日期值');
  }
  const [, year, month, day, hour, minute, second] = match.map((value, i) => i > 0 && i < 7 ? Number(value) : value);
  if (month < 1 || month > 12 || day < 1
    || day > new Date(Date.UTC(year, month, 0)).getUTCDate()
    || hour > 23 || minute > 59 || second > 59) {
    throw new Error('lastUpdated 包含无效的日期或时间');
  }
  const result = Date.parse(time.raw);
  if (!Number.isFinite(result)) throw new Error('lastUpdated 不是有效时间');
  if (result > now) throw new Error('lastUpdated 不能是未来时间');
  return result;
}

export function validateProjects(before, after, { now = Date.now(), allowUnchangedTimestamp = false } = {}) {
  const errors = after.ordinaryExplicit.map((file) => file + ': 普通文档应使用 Git 时间，请移除显式 lastUpdated');
  for (const [url, current] of after.records) {
    try {
      const nextTime = timestamp(current.time, now);
      const previous = before.records.get(url);
      // 新页面、首次添加显式字段允许初始化，不要求伪造一次展示内容变化。
      if (!previous?.time.raw) continue;
      let previousTime;
      try { previousTime = timestamp(previous.time, Infinity); }
      catch { continue; } // 允许把历史非法字段修正为有效值。
      if (previousTime > now) continue;
      const changed = JSON.stringify(canonical(previous.view)) !== JSON.stringify(canonical(current.view));
      if (nextTime < previousTime) throw new Error('lastUpdated 不能倒退');
      if (changed && nextTime <= previousTime) {
        throw new Error('展示内容已变化，请将 lastUpdated 更新为晚于原值的实际修改时间');
      }
      if (!changed && nextTime !== previousTime && !allowUnchangedTimestamp) {
        throw new Error('展示内容未变化，请保留原 lastUpdated');
      }
    } catch (error) {
      errors.push(url + ' → ' + current.location + ': ' + error.message);
    }
  }
  return errors;
}
