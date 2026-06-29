<template>
  <div class="matchup-guide-detail min-h-screen px-[10px] pb-8 text-text">
    <div class="mx-auto max-w-2xl">
      <NuxtLink
        :to="localePath('/matchups/sheets/discover')"
        class="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary transition-colors hover:text-text"
      >
        {{ t('matchupGuidePage.backToSheets') }}
      </NuxtLink>

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

const props = defineProps<{
  guide: MatchupGuide
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const { themeVars } = useBuildCardBorderTheme(() => props.guide.champion?.id)
</script>

<style scoped>
.matchup-guide-detail__panel {
  border-radius: 6px;
  border: 2px solid transparent;
  background:
    linear-gradient(var(--color-blue-500), var(--color-blue-500)) padding-box,
    var(--card-border-gradient-strong) border-box;
  padding: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
</style>
