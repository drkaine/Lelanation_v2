<template>
  <div
    class="theorycraft-workspace rounded-xl bg-surface p-4"
    :class="{ 'theorycraft-workspace--spells': activePanel === 'theorycraft' }"
  >
    <TheorycraftSpellPanel
      v-if="activePanel === 'theorycraft'"
      :champion-id="championId"
      :champion-data="championData"
      :level="level"
      :build-stats="buildStats"
    />

    <div v-else-if="activePanel === 'champion'">
      <ChampionSelector />
    </div>

    <div v-else-if="activePanel === 'items'">
      <ItemSelector include-masterwork />
    </div>

    <div v-else-if="activePanel === 'runes'">
      <RuneSelector />
    </div>

    <div
      v-else
      class="border-border/70 text-muted rounded-lg border border-dashed p-8 text-center text-sm"
    >
      {{ t('theorycraft.panel.emptyHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import ChampionSelector from '~/components/Build/ChampionSelector.vue'
import ItemSelector from '~/components/Build/ItemSelector.vue'
import RuneSelector from '~/components/Build/RuneSelector.vue'
import TheorycraftSpellPanel from '~/components/Build/TheorycraftSpellPanel.vue'
import type { TheorycraftBuildStats } from '~/types/theorycraft'

export type TheorycraftPanel = 'champion' | 'items' | 'runes' | 'theorycraft' | null

defineProps<{
  activePanel: TheorycraftPanel
  championId: string | null
  championData: Record<string, unknown> | null
  level: number
  buildStats: TheorycraftBuildStats | null
}>()

const { t } = useI18n()
</script>

<style scoped>
.theorycraft-workspace {
  min-height: 0;
}

.theorycraft-workspace--spells {
  padding: 0.5rem 0 0.5rem 0.5rem;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
