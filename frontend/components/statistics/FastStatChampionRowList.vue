<script setup lang="ts">
import { computed } from 'vue'

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

const props = withDefaults(
  defineProps<{
    entries: FastStatChampionEntry[]
    showCards: boolean
    noDataText: string
    gameVersion: string | null | undefined
    championByKey: (id: number) => { image: { full: string } } | null | undefined
    championName: (id: number) => string
    getChampionImageUrl: (version: string, imageFull: string) => string
    searchQuery?: string
    /** default = pick/win/ban ; progression = delta + fourchette ; bans = ban% + delta comparaison */
    variant?: 'default' | 'progression' | 'bans'
  }>(),
  { variant: 'default' }
)

const tablePortraitSize = computed(() => {
  if (props.variant === 'default') return 24
  return 20
})
</script>

<template>
  <div v-if="!entries.length" class="py-3 text-center text-sm text-text/60">{{ noDataText }}</div>
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
  <table v-else class="fast-stat-table w-full text-sm">
    <tbody>
      <tr v-for="(row, idx) in entries" :key="row.championId" class="fast-stat-row">
        <td class="py-1 align-middle">
          <!-- Progression : nom + fourchette, delta à droite -->
          <div v-if="variant === 'progression'" class="flex w-full min-w-0 items-center gap-1">
            <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
            <StatisticsChampionPortrait
              v-if="gameVersion && championByKey(row.championId)"
              :src="getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)"
              :alt="championName(row.championId) || ''"
              :champion-id="row.championId"
              :champion-name="championName(row.championId) || ''"
              :size="tablePortraitSize"
              rounded="full"
            />
            <div class="min-w-0 max-w-[7.5rem] flex-1 shrink">
              <div class="truncate font-medium leading-tight text-text">
                <StatisticsChampionNameHighlight
                  :name="championName(row.championId) || String(row.championId)"
                  :query="searchQuery"
                />
              </div>
              <div
                v-if="row.valueLabel"
                class="whitespace-nowrap text-[10px] tabular-nums leading-tight text-text/70"
              >
                {{ row.valueLabel }}
              </div>
            </div>
            <span
              class="ml-auto w-11 shrink-0 text-right text-sm font-medium tabular-nums"
              :class="row.deltaClass ?? 'text-text'"
            >
              {{ row.value }}
            </span>
          </div>

          <!-- Bans : 2 lignes pour éviter le débordement de la card -->
          <div v-else-if="variant === 'bans'" class="flex w-full min-w-0 flex-col gap-0.5">
            <div class="flex min-w-0 items-center gap-1">
              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
              <StatisticsChampionPortrait
                v-if="gameVersion && championByKey(row.championId)"
                :src="getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)"
                :alt="championName(row.championId) || ''"
                :champion-id="row.championId"
                :champion-name="championName(row.championId) || ''"
                :size="tablePortraitSize"
                rounded="full"
              />
              <span class="min-w-0 flex-1 truncate font-medium text-text">
                <StatisticsChampionNameHighlight
                  :name="championName(row.championId) || String(row.championId)"
                  :query="searchQuery"
                />
              </span>
            </div>
            <div class="flex justify-end gap-2 pl-6 tabular-nums">
              <span class="text-sm font-medium text-text">{{ row.value }}</span>
              <span
                v-if="row.delta != null && row.delta !== ''"
                class="text-[11px] font-medium"
                :class="row.deltaClass"
              >
                {{ row.delta }}
              </span>
            </div>
          </div>

          <!-- Pick / win / ban classiques -->
          <div v-else class="flex w-full min-w-0 items-center gap-1">
            <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
            <StatisticsChampionPortrait
              v-if="gameVersion && championByKey(row.championId)"
              :src="getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)"
              :alt="championName(row.championId) || ''"
              :champion-id="row.championId"
              :champion-name="championName(row.championId) || ''"
              :size="tablePortraitSize"
              rounded="full"
            />
            <span class="min-w-0 flex-1 truncate font-medium text-text">
              <StatisticsChampionNameHighlight
                :name="championName(row.championId) || String(row.championId)"
                :query="searchQuery"
              />
            </span>
            <span class="ml-auto w-12 shrink-0 text-right font-semibold tabular-nums text-text">{{
              row.value
            }}</span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>
