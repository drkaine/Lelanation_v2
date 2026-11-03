<template>
  <MatchupSheetsIndexPageView :tab="tab" />
</template>

<script setup lang="ts">
import MatchupSheetsIndexPageView from '~/components/matchups/MatchupSheetsIndexPageView.vue'
import { MATCHUP_SHEETS_TABS, type MatchupSheetsTab } from '~/utils/matchupSheetsTabs'

const route = useRoute()

const VALID_TABS: readonly MatchupSheetsTab[] = MATCHUP_SHEETS_TABS

const tab = computed(() => {
  const raw = String(route.params.tab ?? '')
  if (VALID_TABS.includes(raw as MatchupSheetsTab)) return raw as MatchupSheetsTab
  return 'my-guides' as MatchupSheetsTab
})

if (!VALID_TABS.includes(String(route.params.tab ?? '') as MatchupSheetsTab)) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
}

definePageMeta({
  key: 'matchup-sheets-library',
})
</script>
