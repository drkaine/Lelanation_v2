<template>
  <MatchupSheetsIndexPageView tab="favoris" />
</template>

<script setup lang="ts">
import MatchupSheetsIndexPageView from '~/components/matchups/MatchupSheetsIndexPageView.vue'

definePageMeta({
  middleware: 'matchup-guides-admin',
})
</script>
