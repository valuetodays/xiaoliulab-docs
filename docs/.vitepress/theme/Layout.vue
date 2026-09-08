<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import GiscusComment from './components/GiscusComment.vue';
import MegaMenu from './components/MegaMenu.vue';

const { Layout } = DefaultTheme;
</script>

<template>
  <Layout>
    <template #nav-bar-content-after>
      <MegaMenu />
    </template>
    <template #doc-after>
      <GiscusComment />
    </template>
  </Layout>
</template>
