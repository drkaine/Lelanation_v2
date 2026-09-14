<script setup lang="ts">
import ChampionStatsPage from '~/components/statistics/pages/ChampionStatsPage.vue'

definePageMeta({
  layout: 'default',
  validate(route) {
    const raw = route.params.slug
    const slug = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '')
    return slug.length > 0 && !slug.startsWith('_')
  },
})
</script>

<template>
  <ChampionStatsPage />
</template>
