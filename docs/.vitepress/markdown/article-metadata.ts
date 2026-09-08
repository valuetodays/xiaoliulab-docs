import type MarkdownIt from 'markdown-it';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type Token from 'markdown-it/lib/token.mjs';

const READING_SPEED = 250;
const HAN_CHARACTER_PATTERN = /\p{Script=Han}/gu;
const WORD_PATTERN = /[\p{Script=Latin}\p{N}]+(?:['’._+/-][\p{Script=Latin}\p{N}]+)*/gu;
const COUNTED_INLINE_TOKEN_TYPES = new Set(['text', 'code_inline']);

interface MarkdownEnvironment {
  frontmatter?: Record<string, unknown>;
  articleMetaInjected?: boolean;
}

function extractReadableText(tokens: Token[]): string {
  const segments: string[] = [];

  for (const token of tokens) {
    if (token.children) {
      segments.push(extractReadableText(token.children));
      continue;
    }

    if (COUNTED_INLINE_TOKEN_TYPES.has(token.type)) {
      segments.push(token.content);
    }
  }

  return segments.join(' ');
}

function countWords(text: string): number {
  const hanCharacterCount = text.match(HAN_CHARACTER_PATTERN)?.length ?? 0;
  const latinAndNumberWordCount = text.match(WORD_PATTERN)?.length ?? 0;

  return hanCharacterCount + latinAndNumberWordCount;
}

function collectArticleMetadata(state: StateCore): void {
  const environment = state.env as MarkdownEnvironment;

  if (!environment.frontmatter) {
    return;
  }

  const wordCount = countWords(extractReadableText(state.tokens));

  environment.frontmatter.wordCount = wordCount;
  environment.frontmatter.readingTime = Math.max(
    1,
    Math.ceil(wordCount / READING_SPEED),
  );
}

export function articleMetadataPlugin(markdown: MarkdownIt): void {
  markdown.core.ruler.push('article_metadata', collectArticleMetadata);

  const defaultHeadingCloseRenderer = markdown.renderer.rules.heading_close;

  markdown.renderer.rules.heading_close = (tokens, index, options, environment, self) => {
    const renderedHeading = defaultHeadingCloseRenderer
      ? defaultHeadingCloseRenderer(tokens, index, options, environment, self)
      : self.renderToken(tokens, index, options);
    const markdownEnvironment = environment as MarkdownEnvironment;
    const frontmatter = markdownEnvironment.frontmatter;

    if (
      tokens[index].tag !== 'h1'
      || markdownEnvironment.articleMetaInjected
      || !frontmatter
      || frontmatter.layout === 'home'
      || frontmatter.articleMeta === false
    ) {
      return renderedHeading;
    }

    markdownEnvironment.articleMetaInjected = true;
    return `${renderedHeading}<ArticleMeta />\n`;
  };
}
