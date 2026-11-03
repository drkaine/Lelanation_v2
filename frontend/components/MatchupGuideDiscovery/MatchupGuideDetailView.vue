<template>
  <div
    class="matchup-guide-detail text-text"
    :class="
      embedded
        ? 'matchup-guide-detail--embedded'
        : 'min-h-screen overflow-x-clip px-3 pb-8 sm:px-5 lg:px-6'
    "
  >
    <div class="w-full">
      <article class="matchup-guide-detail__panel" :style="themeVars">
        <MatchupGuideSheetView :guide="guide" variant="detail" />
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MatchupGuide } from '@lelanation/shared-types'
import MatchupGuideSheetView from '~/components/MatchupGuideDiscovery/MatchupGuideSheetView.vue'
import { useBuildCardBorderTheme } from '~/composables/useBuildCardBorderTheme'

const props = withDefaults(
  defineProps<{
    guide: MatchupGuide
    embedded?: boolean
  }>(),
  { embedded: false }
)

const { themeVars } = useBuildCardBorderTheme(() => props.guide.champion?.id)
</script>

<style scoped>
.matchup-guide-detail--embedded {
  width: 100%;
  overflow-x: clip;
}

.matchup-guide-detail__panel {
  border-radius: 6px;
  border: 2px solid transparent;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--card-border-gradient-strong) border-box;
  padding: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}
</style>
