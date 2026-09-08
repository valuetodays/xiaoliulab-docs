<script setup lang="ts">
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';
import { data } from '../../data/principles.data';
import PrincipleTag from './PrincipleTag.vue';

const { params } = useData();
const group = computed(() => data.groups.find(
  (item) => item.principle.code === params.value?.code,
));
</script>

<template>
  <div v-if="group" class="principle-detail">
    <a class="principle-back-link" :href="withBase('/thinking/')">
      ← 全部思维
    </a>

    <h1>{{ group.principle.name }}</h1>

    <PrincipleTag :code="group.principle.code" />

    <p class="principle-detail-description">
      {{ group.principle.description }}
    </p>

    <h2>相关文章</h2>

    <ul v-if="group.articles.length" class="principle-article-list">
      <li v-for="article in group.articles" :key="article.link">
        <a :href="withBase(article.link)">{{ article.title }}</a>
      </li>
    </ul>

    <p v-else class="principle-empty">暂无相关文章。</p>
  </div>
</template>
