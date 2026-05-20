<script setup lang="ts">
/**
 * Top 5 champions : tableau desktop ou cards (vue mobile « Cards (Top 5) »).
 */
export type FastStatChampionEntry = {
  championId: number
  value: string
  valueLabel?: string
  delta?: string | null
  deltaClass?: string
}

defineProps<{
  entries: FastStatChampionEntry[]
  showCards: boolean
  noDataText: string
  gameVersion: string | null | undefined
  championByKey: (id: number) => { image: { full: string } } | null | undefined
  championName: (id: number) => string
  getChampionImageUrl: (version: string, imageFull: string) => string
  searchQuery?: string
}>()
</script>

<template>
  <div v-if="!entries.length" class="py-3 text-center text-text/60">{{ noDataText }}</div>
  <StatisticsFastStatChampionCards
    v-else-if="showCards"
    :rows="
      entries.map(e => ({
        championId: e.championId,
        label: e.valueLabel || '',
        value: e.value,
        delta: e.delta,
        deltaClass: e.deltaClass,
      }))
    "
    :game-version="gameVersion"
    :champion-by-key="championByKey"
    :champion-name="championName"
    :get-champion-image-url="getChampionImageUrl"
    :search-query="searchQuery"
  />
  <table v-else class="fast-stat-table w-full text-xs">
    <tbody>
      <tr v-for="(row, idx) in entries" :key="row.championId" class="fast-stat-row">
        <td class="py-0.5 align-middle">
          <div class="flex w-full min-w-0 items-center gap-0.5">
            <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
            <StatisticsChampionPortrait
              v-if="gameVersion && championByKey(row.championId)"
              :src="getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)"
              :alt="championName(row.championId) || ''"
              :champion-id="row.championId"
              :champion-name="championName(row.championId) || ''"
              :size="20"
              rounded="full"
            />
            <span class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">
              <StatisticsChampionNameHighlight
                :name="championName(row.championId) || String(row.championId)"
                :query="searchQuery"
              />
            </span>
            <span class="ml-auto w-9 shrink-0 text-right font-medium text-text">{{
              row.value
            }}</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>
