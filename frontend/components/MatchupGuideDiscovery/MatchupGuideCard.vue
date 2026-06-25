<template>
  <NuxtLink :to="detailPath" class="matchup-guide-card" :style="themeVars">
    <MatchupGuideSheetView :guide="guide" variant="card" />
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchupGuide } from '@lelanation/shared-types'
import MatchupGuideSheetView from '~/components/MatchupGuideDiscovery/MatchupGuideSheetView.vue'
import { useBuildCardBorderTheme } from '~/composables/useBuildCardBorderTheme'
import { matchupGuideDetailPath } from '~/utils/matchupGuideSlug'

const props = defineProps<{
  guide: MatchupGuide
}>()

const localePath = useLocalePath()
const detailPath = computed(() => matchupGuideDetailPath(props.guide, localePath))
const { themeVars } = useBuildCardBorderTheme(() => props.guide.champion?.id)
</script>

<style scoped>
.matchup-guide-card {
  display: block;
  min-height: 100%;
  border-radius: 0.75rem;
  border: 2px solid transparent;
  background:
    linear-gradient(rgb(var(--rgb-surface) / 0.45), rgb(var(--rgb-surface) / 0.45)) padding-box,
    var(--card-border-gradient-strong) border-box;
  padding: 0.85rem;
  color: inherit;
  text-decoration: none;
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.matchup-guide-card:hover {
  box-shadow: 0 4px 18px var(--card-border-color-soft);
  transform: translateY(-1px);
}
</style>
