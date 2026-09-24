---
articleMeta: false
search: false
comments: false
---

<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { params } = useData()
const target = computed(() => withBase(`/core-principles/${params.value?.code}`))
</script>

# 页面已移动

该页面已移动到新地址：

<a :href="target">前往新页面</a>
