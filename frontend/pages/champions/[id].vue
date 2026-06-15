<template>
  <div />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { championBuildsPath } from '~/composables/useChampionBuildsPage'

const route = useRoute()
const localePath = useLocalePath()
const championSlug = computed(() => String(route.params.id ?? '').toLowerCase())

useAsyncData(
  () => `champions-redirect-${championSlug.value}`,
  async () => {
    const target = localePath(championBuildsPath(championSlug.value))
    await navigateTo(target, { redirectCode: 301 })
    return target
  },
  { watch: [championSlug] }
)
</script>
