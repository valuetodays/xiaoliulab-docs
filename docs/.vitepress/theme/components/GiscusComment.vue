<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useData, useRoute } from 'vitepress';
import { isVideoMode } from '../utils/page-mode';

const route = useRoute();
const { frontmatter } = useData();
const videoMode = ref(false);
const commentsEnabled = computed(
  () => frontmatter.value?.comments !== false && !videoMode.value,
);

function loadGiscus() {
  const container = document.querySelector('.giscus-container');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  const script = document.createElement('script');

  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.crossOrigin = 'anonymous';

  script.setAttribute('data-repo', 'valuetodays/xiaoliulab-comments');
  script.setAttribute('data-repo-id', 'R_kgDOUGmh_w');
  script.setAttribute('data-category', 'General');
  script.setAttribute('data-category-id', 'DIC_kwDOUGmh_84DEWOk');
  script.setAttribute('data-mapping', 'pathname');
  script.setAttribute('data-strict', '0');
  script.setAttribute('data-reactions-enabled', '1');
  script.setAttribute('data-emit-metadata', '0');
  script.setAttribute('data-input-position', 'bottom');
  script.setAttribute('data-theme', 'preferred_color_scheme');
  script.setAttribute('data-lang', 'zh-CN');

  container.appendChild(script);
}

async function reload() {
  videoMode.value = isVideoMode();

  if (!commentsEnabled.value) {
    return;
  }

  await nextTick();
  loadGiscus();
}

onMounted(reload);

watch(
  () => [route.path, route.query],
  reload,
);
</script>

<template>
  <div
    v-if="commentsEnabled"
    class="giscus-container"
  />
</template>
