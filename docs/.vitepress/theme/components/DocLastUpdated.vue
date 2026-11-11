<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';

const { page, theme } = useData();
const date = computed(() => new Date(page.value.lastUpdated!));
const isoDatetime = computed(() => date.value.toISOString());
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const datetime = computed(() => {
  // 显式拼接分隔符，避免日期样式随浏览器语言或运行环境变化。
  const parts = Object.fromEntries(
    formatter.formatToParts(date.value).map(({ type, value }) => [type, value]),
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
});
</script>

<template>
  <p class="VPLastUpdated">
    {{ theme.lastUpdated?.text || theme.lastUpdatedText || '最后更新于' }}:
    <time :datetime="isoDatetime" title="北京时间（Asia/Shanghai）">{{ datetime }}</time>（北京时间）
  </p>
</template>

<style scoped>
.VPLastUpdated {
  line-height: 24px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

@media (min-width: 640px) {
  .VPLastUpdated {
    line-height: 32px;
  }
}
</style>
