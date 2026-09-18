<script setup lang="ts">
import { withBase } from 'vitepress';
import { data } from '../../data/demos.data';
</script>

<template>
  <div v-if="data.documents.length > 0" class="demo-list">
    <article
      v-for="document in data.documents"
      :key="document.link"
      class="demo-card"
    >
      <h2 class="demo-card-title">
        <a :href="withBase(document.link)">{{ document.title }}</a>
      </h2>

      <p v-if="document.description" class="demo-card-description">
        {{ document.description }}
      </p>

      <div class="demo-card-actions">
        <a :href="withBase(document.link)" class="demo-document-link">
          阅读文档
        </a>
        <a
          v-for="attachment in document.attachments"
          :key="attachment.url"
          :href="attachment.url"
          class="demo-download-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          下载 Demo<span v-if="attachment.format">（{{ attachment.format }}）</span>
        </a>
      </div>
    </article>
  </div>

  <p v-else class="demo-empty">暂时还没有可下载的 Demo。</p>
</template>

<style scoped>
.demo-list {
  display: grid;
  gap: 16px;
  margin-top: 24px;
}

.demo-card {
  padding: 20px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.demo-card:hover {
  border-color: var(--vp-c-brand-2);
  box-shadow: var(--vp-shadow-1);
}

.demo-card-title {
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 18px;
  line-height: 1.5;
}

.demo-card-title a {
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.demo-card-title a:hover {
  color: var(--vp-c-brand-1);
}

.demo-card-description {
  margin: 10px 0 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.7;
}

.demo-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-top: 16px;
  font-size: 14px;
  font-weight: 500;
}

.demo-document-link,
.demo-download-link {
  text-decoration: none;
}

.demo-empty {
  margin-top: 24px;
  color: var(--vp-c-text-2);
}
</style>
