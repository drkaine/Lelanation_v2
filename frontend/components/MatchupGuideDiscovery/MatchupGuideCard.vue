<template>
  <div class="matchup-guide-card" :style="themeVars">
    <MatchupGuideSheetView :guide="guide" variant="card" />
  </div>
</template>

<script setup lang="ts">
import type { MatchupGuide } from '@lelanation/shared-types'
import MatchupGuideSheetView from '~/components/MatchupGuideDiscovery/MatchupGuideSheetView.vue'
import { useBuildCardBorderTheme } from '~/composables/useBuildCardBorderTheme'

const props = defineProps<{
  guide: MatchupGuide
}>()

const { themeVars } = useBuildCardBorderTheme(() => props.guide.champion?.id)
</script>

<style scoped>
.matchup-guide-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 100%;
  border-radius: 6px;
  border: 2px solid transparent;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--card-border-gradient-strong) border-box;
  padding: 10px;
  color: inherit;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  transition: box-shadow 0.2s ease;
}

.matchup-guide-card-link:hover .matchup-guide-card {
  box-shadow: 0 4px 18px var(--card-border-color-soft);
}

.matchup-guide-card :deep(.matchup-sheet) {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
