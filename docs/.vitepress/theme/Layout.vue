<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import ArticleMeta from './components/ArticleMeta.vue';
import GiscusComment from './components/GiscusComment.vue';

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #doc-before>
      <ArticleMeta />
    </template>

    <template #doc-after>
      <GiscusComment />
    </template>
  </Layout>
</template>
