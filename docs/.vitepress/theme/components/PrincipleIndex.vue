<script setup lang="ts">
import { withBase } from 'vitepress';
import { data } from '../../data/principles.data';
import PrincipleTag from './PrincipleTag.vue';
</script>

<template>
  <div class="principle-grid">
    <article
      v-for="group in data.groups"
      :key="group.principle.code"
      class="principle-card"
    >
      <div class="principle-card-heading">
        <PrincipleTag :code="group.principle.code" />
        <span>{{ group.articles.length }} 篇文章</span>
      </div>

      <p>{{ group.principle.description }}</p>

      <a
        class="principle-card-link"
        :href="withBase(`/thinking/${group.principle.code}`)"
      >
        查看相关文章 →
      </a>
    </article>
  </div>
</template>
