<script setup lang="ts">
import { computed } from 'vue';
import { withBase } from 'vitepress';
import { getCorePrinciple } from '../../data/core-principles';

const props = defineProps<{
  code: string;
}>();

const corePrinciple = computed(() => getCorePrinciple(props.code));
const href = computed(() => withBase(`/core-principles/${props.code}`));
</script>

<template>
  <a
    v-if="corePrinciple"
    class="core-principle-tag"
    :href="href"
    :style="{ '--core-principle-color': corePrinciple.color }"
    :title="corePrinciple.description"
  >
    {{ corePrinciple.name }}
  </a>
</template>
