<script setup lang="ts">
import { computed } from 'vue';
import { withBase } from 'vitepress';
import { getOrientation } from '../../data/orientations';

const props = defineProps<{
  code: string;
}>();

const orientation = computed(() => getOrientation(props.code));
const href = computed(() => withBase(`/orientations/${props.code}`));
</script>

<template>
  <a
    v-if="orientation"
    class="orientation-tag"
    :href="href"
    :style="{ '--orientation-color': orientation.color }"
    :title="orientation.description"
  >
    {{ orientation.name }}
  </a>
</template>
