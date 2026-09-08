<script setup lang="ts">
import { computed } from 'vue';
import { withBase } from 'vitepress';
import { getPrinciple } from '../../data/principles';

const props = defineProps<{
  code: string;
}>();

const principle = computed(() => getPrinciple(props.code));
const href = computed(() => withBase(`/thinking/${props.code}`));
</script>

<template>
  <a
    v-if="principle"
    class="principle-tag"
    :href="href"
    :style="{ '--principle-color': principle.color }"
    :title="principle.description"
  >
    {{ principle.name }}
  </a>
</template>
