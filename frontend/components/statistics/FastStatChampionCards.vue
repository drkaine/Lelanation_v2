<script setup lang="ts">
import { computed } from 'vue'
import { useMobileViewport } from '~/composables/useMobileViewport'

/**
 * Liste Top 5 en cards (vue mobile « Cards (Top 5) »).
 */
const { isMobileViewport } = useMobileViewport()
const portraitSize = computed(() => (isMobileViewport.value ? 56 : 40))

defineProps<{
  rows: Array<{
    championId: number
    label: string
    value: string
    delta?: string | null
    deltaClass?: string
  }>
  rankOffset?: number
  gameVersion: string | null | undefined
  championByKey: (id: number) => { image: { full: string } } | null | undefined
  championName: (id: number) => string
  getChampionImageUrl: (version: string, imageFull: string) => string
  searchQuery?: string
}>()
</script>

<template>
  <ul class="fast-stat-champion-cards space-y-1.5">
    <li
      v-for="(row, idx) in rows"
      :key="row.championId"
      class="fast-stat-champion-card-item flex items-center gap-2 rounded-md border border-primary/20 bg-black/15 px-2 py-1.5"
    >
      <span class="fast-stat-champion-card-rank w-4 shrink-0 text-xs text-text/60"
        >{{ (rankOffset ?? 0) + idx + 1 }}.</span
      >
      <StatisticsChampionDetailLink
        :champion-id="row.championId"
        class="flex min-w-0 flex-1 items-center gap-2 rounded-sm"
      >
        <StatisticsChampionPortrait
          v-if="gameVersion && championByKey(row.championId)"
          :src="getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)"
          :alt="championName(row.championId) || ''"
          :champion-id="row.championId"
          :champion-name="championName(row.championId) || ''"
          :size="portraitSize"
          rounded="sm"
        />
        <div class="min-w-0 flex-1">
          <div
            class="fast-stat-champion-card-name truncate text-sm font-medium text-accent underline decoration-accent/40 underline-offset-2"
          >
            <StatisticsChampionNameHighlight
              :name="championName(row.championId) || String(row.championId)"
              :query="searchQuery"
            />
          </div>
          <div class="fast-stat-champion-card-label text-[11px] text-text/55">{{ row.label }}</div>
        </div>
      </StatisticsChampionDetailLink>
      <div class="shrink-0 text-right">
        <div class="fast-stat-champion-card-value text-sm font-semibold tabular-nums text-text">
          {{ row.value }}
        </div>
        <div
          v-if="row.delta != null && row.delta !== ''"
          class="fast-stat-champion-card-delta text-[10px] tabular-nums"
          :class="row.deltaClass"
        >
          {{ row.delta }}
        </div>
      </div>
    </li>
  </ul>
</template>
