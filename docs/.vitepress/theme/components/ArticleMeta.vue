<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';

interface ArticleMetadata {
  wordCount: number;
  readingTime: number;
}

const { frontmatter } = useData();
const numberFormatter = new Intl.NumberFormat('zh-CN');

const metadata = computed<ArticleMetadata | null>(() => {
  const data: Record<string, unknown> = frontmatter.value;

  if (data.layout === 'home' || data.articleMeta === false) {
    return null;
  }

  const { wordCount, readingTime } = data;

  if (
    typeof wordCount !== 'number'
    || wordCount <= 0
    || typeof readingTime !== 'number'
    || readingTime < 1
  ) {
    return null;
  }

  return { wordCount, readingTime };
});

const formattedWordCount = computed(() => (
  metadata.value ? numberFormatter.format(metadata.value.wordCount) : ''
));
</script>

<template>
  <p v-if="metadata" class="article-meta">
    约 {{ formattedWordCount }} 字
    <span class="article-meta-separator" aria-hidden="true">·</span>
    预计阅读 {{ metadata.readingTime }} 分钟
  </p>
</template>
