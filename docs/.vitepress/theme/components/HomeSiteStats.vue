<script setup lang="ts">
import { data } from '../../data/site-stats.data';

const numberFormatter = new Intl.NumberFormat('zh-CN');

function formatWordCount(wordCount: number): string {
  if (wordCount >= 100_000_000) {
    return `${(Math.floor(wordCount / 10_000_000) / 10).toFixed(1)}亿`;
  }

  if (wordCount >= 10_000) {
    return `${(Math.floor(wordCount / 1_000) / 10).toFixed(1)}万`;
  }

  return numberFormatter.format(wordCount);
}
</script>

<template>
  <p class="home-site-stats" aria-label="本站内容统计">
    <span>全站共 <strong>{{ numberFormatter.format(data.articleCount) }}</strong> 篇文章</span>
    <span class="home-site-stats-separator" aria-hidden="true">·</span>
    <span :title="`${numberFormatter.format(data.wordCount)} 字`">约 <strong>{{ formatWordCount(data.wordCount) }}</strong> 字</span>
  </p>
</template>

<style scoped>
.home-site-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin-top: 20px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 24px;
}

.home-site-stats strong {
  color: var(--vp-c-text-1);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.home-site-stats-separator {
  color: var(--vp-c-text-3);
}
</style>
