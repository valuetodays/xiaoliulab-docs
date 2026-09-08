<script setup lang="ts">
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';
import { data } from '../../data/orientations.data';
import OrientationTag from './OrientationTag.vue';

const { params } = useData();
const group = computed(() => data.groups.find(
  (item) => item.orientation.code === params.value?.code,
));
</script>

<template>
  <div v-if="group" class="orientation-detail">
    <a class="orientation-back-link" :href="withBase('/orientations/')">
      ← 全部
    </a>

    <h1>{{ group.orientation.name }}</h1>

    <OrientationTag :code="group.orientation.code" />

    <p class="orientation-detail-description">
      {{ group.orientation.description }}
    </p>

    <h2>相关文章</h2>

    <ul v-if="group.articles.length" class="orientation-article-list">
      <li v-for="article in group.articles" :key="article.link">
        <a :href="withBase(article.link)">{{ article.title }}</a>
      </li>
    </ul>

    <p v-else class="orientation-empty">暂无相关文章。</p>
  </div>
</template>
