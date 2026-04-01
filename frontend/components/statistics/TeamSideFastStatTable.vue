<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { getChampionImageUrl } from '~/utils/imageUrl'

const props = defineProps<{
  title: string
  borderClass: string
  variant: 'pick' | 'wr' | 'ban' | 'dWr' | 'dPick' | 'dBan'
  rows: readonly Record<string, unknown>[]
}>()

const { t } = useI18n()
const { version: gameVersion } = useGameVersion()
const championsStore = useChampionsStore()

function championByKey(championId: number): (typeof championsStore.champions)[0] | null {
  const champ = championsStore.champions.find(c => c.key === String(championId))
  return champ ?? null
}

function championName(championId: number): string | null {
  return championByKey(championId)?.name ?? null
}

const metricForRow = (row: Record<string, unknown>): number => {
  switch (props.variant) {
    case 'pick':
      return Number(row.pickrate ?? 0)
    case 'wr':
      return Number(row.winrate ?? 0)
    case 'ban':
      return Number(row.count ?? 0)
    case 'dWr':
      return Number(row.deltaWr ?? 0)
    case 'dPick':
      return Number(row.deltaPick ?? 0)
    case 'dBan':
      return Number(row.deltaBan ?? 0)
    default:
      return 0
  }
}

const displayValue = (row: Record<string, unknown>): string => {
  switch (props.variant) {
    case 'pick':
    case 'wr':
      return `${Number(metricForRow(row)).toFixed(2)}%`
    case 'ban':
      return String(row.count ?? 0)
    case 'dWr':
    case 'dPick':
    case 'dBan':
      return `+${Number(metricForRow(row)).toFixed(2)}%`
    default:
      return ''
  }
}

const barClass = computed(() => {
  switch (props.variant) {
    case 'pick':
    case 'dPick':
      return 'bg-accent'
    case 'wr':
    case 'dWr':
      return 'bg-success'
    case 'ban':
    case 'dBan':
      return 'bg-amber-500/90'
    default:
      return 'bg-accent'
  }
})

const valueCellClass = computed(() => {
  if (props.variant === 'dWr') return 'w-10 shrink-0 text-right font-medium text-success'
  if (props.variant === 'dPick') return 'w-10 shrink-0 text-right font-medium text-accent'
  if (props.variant === 'dBan') return 'w-10 shrink-0 text-right font-medium text-amber-200'
  if (props.variant === 'ban') return 'w-8 shrink-0 text-right font-medium text-text'
  return 'w-9 shrink-0 text-right font-medium text-text'
})

const topFive = computed(() => props.rows.slice(0, 5))

const barDenom = computed(() => {
  const vals = topFive.value.map(r => metricForRow(r))
  return Math.max(...vals, props.variant === 'ban' ? 1 : 0.01)
})

const isProgression = computed(
  () => props.variant === 'dWr' || props.variant === 'dPick' || props.variant === 'dBan'
)
</script>

<template>
  <div class="fast-stat-card w-full max-w-full rounded-lg bg-surface/30 p-2" :class="borderClass">
    <h3 class="fast-stat-title mb-1 text-sm font-semibold text-text">
      {{ title }}
    </h3>
    <table v-if="topFive.length" class="fast-stat-table w-full text-xs">
      <tbody>
        <tr v-for="(row, idx) in topFive" :key="'r-' + row.championId" class="fast-stat-row">
          <td class="py-0.5 align-middle">
            <div class="flex items-center gap-0.5">
              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
              <img
                v-if="gameVersion && championByKey(Number(row.championId))"
                :src="
                  getChampionImageUrl(
                    gameVersion,
                    championByKey(Number(row.championId))!.image.full
                  )
                "
                :alt="championName(Number(row.championId)) || ''"
                class="h-5 w-5 shrink-0 rounded-full object-cover"
              />
              <span class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">{{
                championName(Number(row.championId)) || row.championId
              }}</span>
              <div
                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
              >
                <div
                  class="h-full rounded transition-[width]"
                  :class="barClass"
                  :style="{
                    width: Math.min(100, (metricForRow(row) / barDenom) * 100) + '%',
                  }"
                />
              </div>
              <span :class="valueCellClass">{{ displayValue(row) }}</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="py-3 text-center text-text/60">
      {{
        isProgression
          ? t('statisticsPage.fastStatsNoProgression')
          : t('statisticsPage.fastStatsNoData')
      }}
    </div>
  </div>
</template>
