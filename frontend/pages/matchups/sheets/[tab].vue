<template>
  <MatchupSheetsIndexPageView :tab="tab" />
</template>

<script setup lang="ts">
import MatchupSheetsIndexPageView from '~/components/matchups/MatchupSheetsIndexPageView.vue'
import type { MatchupSheetsTab } from '~/composables/useMatchupSheetsIndexPage'

const route = useRoute()

const VALID_TABS: MatchupSheetsTab[] = ['discover', 'my-guides', 'favoris']

const tab = computed(() => {
  const raw = String(route.params.tab ?? '')
  if (VALID_TABS.includes(raw as MatchupSheetsTab)) return raw as MatchupSheetsTab
  return 'discover' as MatchupSheetsTab
})

if (!VALID_TABS.includes(String(route.params.tab ?? '') as MatchupSheetsTab)) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

definePageMeta({
  key: 'matchup-sheets-library',
})
</script>
