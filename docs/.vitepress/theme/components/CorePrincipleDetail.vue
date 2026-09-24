<script setup lang="ts">
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';
import { data } from '../../data/core-principles.data';

const { params } = useData();
const group = computed(() => data.groups.find(
  (item) => item.corePrinciple.code === params.value?.code,
));
</script>

<template>
  <div v-if="group" class="core-principle-detail">
    <a class="core-principle-back-link" :href="withBase('/orientations/')">
      ← 全部
    </a>

    <h1>{{ group.corePrinciple.name }}</h1>

    <p class="core-principle-detail-description">
      {{ group.corePrinciple.description }}
    </p>

    <h2>相关文章</h2>

    <ul v-if="group.articles.length" class="core-principle-article-list">
      <li v-for="article in group.articles" :key="article.link">
        <a :href="withBase(article.link)">{{ article.title }}</a>
      </li>
    </ul>

    <p v-else class="core-principle-empty">暂无相关文章。</p>
  </div>
</template>
