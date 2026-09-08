<script setup lang="ts">
import { withBase } from 'vitepress';
import { data } from '../../data/orientations.data';
import OrientationTag from './OrientationTag.vue';
</script>

<template>
  <div class="orientation-grid">
    <article
      v-for="group in data.groups"
      :key="group.orientation.code"
      class="orientation-card"
    >
      <div class="orientation-card-heading">
        <OrientationTag :code="group.orientation.code" />
        <span>{{ group.articles.length }} 篇文章</span>
      </div>

      <p>{{ group.orientation.description }}</p>

      <a
        class="orientation-card-link"
        :href="withBase(`/orientations/${group.orientation.code}`)"
      >
        查看相关文章 →
      </a>
    </article>
  </div>
</template>
