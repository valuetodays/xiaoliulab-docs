<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { data } from '../../data/site-stats.data';
import { getLatestPublicationTime } from '../utils/site-publication';

const deployedAt = ref<string | null>(null);
const publishedAt = computed(() => deployedAt.value ?? data.builtAt);
let publicationRequest: AbortController | undefined;

onMounted(async () => {
  publicationRequest = new AbortController();
  const timeout = setTimeout(() => publicationRequest?.abort(), 10_000);

  try {
    deployedAt.value = await getLatestPublicationTime(publicationRequest.signal);
  } catch {
    // 网络异常、超时或接口限流时，继续显示构建时间。
  } finally {
    clearTimeout(timeout);
  }
});

onUnmounted(() => publicationRequest?.abort());

const numberFormatter = new Intl.NumberFormat('zh-CN');
const publicationTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function formatPublicationTime(value: string): string {
  const parts = Object.fromEntries(
    publicationTimeFormatter.formatToParts(new Date(value))
      .map(({ type, value }) => [type, value]),
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

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
    <span class="home-site-stats-separator" aria-hidden="true">·</span>
    <span>
      最后发布时间
      <time :datetime="publishedAt" :title="deployedAt ? '北京时间，GitHub 记录的部署成功时间' : '北京时间，站点构建时间'">{{ formatPublicationTime(publishedAt) }}</time>
    </span>
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
