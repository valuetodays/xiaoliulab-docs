<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import ArticleMeta from './components/ArticleMeta.vue';

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #doc-before>
      <ArticleMeta />
    </template>
  </Layout>
</template>
