<script setup lang="ts">
import { withBase } from 'vitepress';
import { data } from '../../data/core-principles.data';
import CorePrincipleTag from './CorePrincipleTag.vue';
</script>

<template>
  <div class="core-principle-grid">
    <article
      v-for="group in data.groups"
      :key="group.corePrinciple.code"
      class="core-principle-card"
    >
      <div class="core-principle-card-heading">
        <CorePrincipleTag :code="group.corePrinciple.code" />
        <span>{{ group.articles.length }} 篇文章</span>
      </div>

      <p>{{ group.corePrinciple.description }}</p>

      <a
        class="core-principle-card-link"
        :href="withBase(`/core-principles/${group.corePrinciple.code}`)"
      >
        查看相关文章 →
      </a>
    </article>
  </div>
</template>
