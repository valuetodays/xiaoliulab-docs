<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';
import GiscusComment from './components/GiscusComment.vue';
import HomeSiteStats from './components/HomeSiteStats.vue';
import MegaMenu from './components/MegaMenu.vue';

const { Layout } = DefaultTheme;
const { page } = useData();
</script>

<template>
  <Layout>
    <template #home-hero-actions-after>
      <HomeSiteStats v-if="page.relativePath === 'index.md'" />
    </template>
    <template #nav-bar-content-after>
      <MegaMenu />
    </template>
    <template #doc-after>
      <GiscusComment />
    </template>
  </Layout>
</template>
