<script setup lang="ts">
/**
 * Liste Top 5 en cards (vue mobile « Cards (Top 5) »).
 */
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
      class="flex items-center gap-2 rounded-md border border-primary/20 bg-black/15 px-2 py-1.5"
    >
      <span class="w-4 shrink-0 text-xs text-text/60">{{ (rankOffset ?? 0) + idx + 1 }}.</span>
      <StatisticsChampionPortrait
        v-if="gameVersion && championByKey(row.championId)"
        :src="getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)"
        :alt="championName(row.championId) || ''"
        :champion-id="row.championId"
        :champion-name="championName(row.championId) || ''"
        :size="40"
        rounded="sm"
      />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-text">
          <StatisticsChampionNameHighlight
            :name="championName(row.championId) || String(row.championId)"
            :query="searchQuery"
          />
        </div>
        <div class="text-[11px] text-text/55">{{ row.label }}</div>
      </div>
      <div class="shrink-0 text-right">
        <div class="text-sm font-semibold tabular-nums text-text">{{ row.value }}</div>
        <div
          v-if="row.delta != null && row.delta !== ''"
          class="text-[10px] tabular-nums"
          :class="row.deltaClass"
        >
          {{ row.delta }}
        </div>
      </div>
    </li>
  </ul>
</template>
