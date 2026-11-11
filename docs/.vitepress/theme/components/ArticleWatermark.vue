<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue';
import { useRoute } from 'vitepress';

const route = useRoute();
const watermarkStyle = ref<CSSProperties | null>(null);
let article: HTMLElement | null = null;
let resizeObserver: ResizeObserver | undefined;
let animationFrame = 0;

function updateBounds() {
  animationFrame = 0;

  if (!article) {
    watermarkStyle.value = null;
    return;
  }

  const bounds = article.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  if (bounds.width <= 0 || bounds.bottom <= 0 || bounds.top >= viewportHeight) {
    watermarkStyle.value = null;
    return;
  }

  // Only the clipping changes on scroll; the pattern's viewport origin is fixed.
  watermarkStyle.value = {
    left: `${bounds.left}px`,
    width: `${bounds.width}px`,
    clipPath: `inset(${Math.max(0, bounds.top)}px 0 ${Math.max(0, viewportHeight - bounds.bottom)}px 0)`,
  };
}

function scheduleUpdate() {
  if (!animationFrame) {
    animationFrame = window.requestAnimationFrame(updateBounds);
  }
}

async function observeArticle() {
  await nextTick();
  resizeObserver?.disconnect();
  article = document.querySelector<HTMLElement>('.VPDoc .vp-doc');

  if (article) {
    resizeObserver?.observe(article);
  }

  scheduleUpdate();
}

onMounted(() => {
  resizeObserver = new ResizeObserver(scheduleUpdate);
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  void observeArticle();
});

watch(() => [route.path, route.query], observeArticle, { flush: 'post' });

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('scroll', scheduleUpdate);
  window.removeEventListener('resize', scheduleUpdate);
  window.cancelAnimationFrame(animationFrame);
});
</script>

<template>
  <div
    v-if="watermarkStyle"
    class="article-watermark"
    :style="watermarkStyle"
    aria-hidden="true"
  />
</template>
