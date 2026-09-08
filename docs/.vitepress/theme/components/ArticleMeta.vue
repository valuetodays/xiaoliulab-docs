<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import { getOrientation } from '../../data/orientations';
import OrientationTag from './OrientationTag.vue';

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

const currentOrientations = computed(() => {
  const value = frontmatter.value.orientations;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((code): code is string => (
    typeof code === 'string' && Boolean(getOrientation(code))
  ));
});
</script>

<template>
  <div v-if="metadata || currentOrientations.length" class="article-meta">
    <p v-if="metadata" class="article-meta-reading">
      约 {{ formattedWordCount }} 字
      <span class="article-meta-separator" aria-hidden="true">·</span>
      预计阅读 {{ metadata.readingTime }} 分钟
    </p>

    <div v-if="currentOrientations.length" class="article-orientations">
      <OrientationTag
        v-for="code in currentOrientations"
        :key="code"
        :code="code"
      />
    </div>
  </div>
</template>
