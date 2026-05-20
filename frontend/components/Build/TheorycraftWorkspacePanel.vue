<template>
  <div
    class="theorycraft-workspace rounded-xl bg-surface p-4"
    :class="{ 'theorycraft-workspace--spells': activePanel === 'theorycraft' }"
  >
    <div v-if="headerTitle" class="mb-4">
      <h2 class="text-lg font-semibold text-text">{{ headerTitle }}</h2>
    </div>

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
import { computed } from 'vue'
import ChampionSelector from '~/components/Build/ChampionSelector.vue'
import ItemSelector from '~/components/Build/ItemSelector.vue'
import RuneSelector from '~/components/Build/RuneSelector.vue'
import TheorycraftSpellPanel from '~/components/Build/TheorycraftSpellPanel.vue'
import type { TheorycraftBuildStats } from '~/types/theorycraft'

export type TheorycraftPanel = 'champion' | 'items' | 'runes' | 'theorycraft' | null

const props = defineProps<{
  activePanel: TheorycraftPanel
  championId: string | null
  championData: Record<string, unknown> | null
  level: number
  buildStats: TheorycraftBuildStats | null
}>()

const { t } = useI18n()

const headerTitle = computed(() => {
  switch (props.activePanel) {
    case 'theorycraft':
      return ''
    case 'champion':
      return t('theorycraft.panel.champion')
    case 'items':
      return t('theorycraft.panel.items')
    case 'runes':
      return t('theorycraft.panel.runes')
    default:
      return ''
  }
})
</script>

<style scoped>
.theorycraft-workspace--spells {
  padding-top: 0.75rem;
}
</style>
