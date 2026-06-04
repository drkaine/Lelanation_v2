<script setup lang="ts">
/**
 * Top 5 champions : même gabarit tableau que TeamSideFastStatTable (text-xs, portrait 20px).
 */
export type FastStatChampionEntry = {
  championId: number
  value: string
  valueLabel?: string
  delta?: string | null
  deltaClass?: string
}

withDefaults(
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
  { variant: 'default', searchQuery: '' }
)
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
  <table v-else class="fast-stat-table w-full text-xs">
    <tbody>
      <tr v-for="(row, idx) in entries" :key="row.championId" class="fast-stat-row">
        <td class="py-0.5 align-middle">
          <div
            class="flex w-full min-w-0 gap-0.5"
            :class="variant === 'bans' ? 'items-start' : 'items-center'"
          >
            <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
            <StatisticsChampionDetailLink
              :champion-id="row.championId"
              class="flex min-w-0 flex-1 items-center gap-0.5"
              :class="variant === 'bans' ? 'flex-col items-start' : 'items-center'"
            >
              <img
                v-if="gameVersion && championByKey(row.championId)"
                :src="getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)"
                :alt="championName(row.championId) || ''"
                class="h-5 w-5 shrink-0 rounded-full object-cover"
              />
              <span v-else class="h-5 w-5 shrink-0" aria-hidden="true" />
              <template v-if="variant === 'progression'">
                <div class="min-w-0 max-w-[6.5rem] shrink-0">
                  <div
                    class="truncate font-medium leading-tight text-accent underline decoration-accent/40 underline-offset-2"
                  >
                    {{ championName(row.championId) || row.championId }}
                  </div>
                  <div
                    v-if="row.valueLabel"
                    class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                  >
                    {{ row.valueLabel }}
                  </div>
                </div>
              </template>
              <div v-else-if="variant === 'bans'" class="min-w-0 flex-1 flex-col gap-0.5">
                <span
                  class="block truncate font-medium leading-tight text-accent underline decoration-accent/40 underline-offset-2"
                >
                  {{ championName(row.championId) || row.championId }}
                </span>
              </div>
              <template v-else>
                <span
                  class="min-w-0 flex-1 truncate font-medium text-accent underline decoration-accent/40 underline-offset-2"
                >
                  {{ championName(row.championId) || row.championId }}
                </span>
              </template>
            </StatisticsChampionDetailLink>
            <template v-if="variant === 'progression'">
              <span
                class="ml-auto w-10 shrink-0 text-right font-medium tabular-nums"
                :class="row.deltaClass ?? 'text-text'"
              >
                {{ row.value }}
              </span>
            </template>
            <div
              v-else-if="variant === 'bans'"
              class="flex min-w-0 shrink-0 justify-end gap-2 tabular-nums"
            >
              <span class="shrink-0 text-xs font-medium text-text">{{ row.value }}</span>
              <span
                v-if="row.delta != null && row.delta !== ''"
                class="shrink-0 text-[10px] font-medium"
                :class="row.deltaClass"
              >
                {{ row.delta }}
              </span>
              <span v-else class="shrink-0 text-[10px] text-text/40">—</span>
            </div>
            <span v-else class="ml-auto w-9 shrink-0 text-right font-medium tabular-nums text-text">
              {{ row.value }}
            </span>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>
