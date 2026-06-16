<script setup lang="ts">
/**
 * Sets d'items complets — mêmes cartes que les sets de runes (taille / grille 6).
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useItemsStore } from '~/stores/ItemsStore'
import { getItemImageUrl } from '~/utils/imageUrl'

const SET_CARD_LIMIT = 6

type ItemSetRow = {
  items: number[]
  games: number
  wins: number
  pickrate: number
  winrate: number
}

type DetailPayload = {
  totalParticipants: number
  itemSets: ItemSetRow[]
}

const props = defineProps<{
  gameVersion: string
  data: DetailPayload | null
  baseline: DetailPayload | null
  baselinePending: boolean
  comparisonVersion: string | null
}>()

const { t } = useI18n()
const itemsStore = useItemsStore()

function itemName(itemId: number): string {
  return itemsStore.items.find(i => i.id === String(itemId))?.name ?? String(itemId)
}

function itemImageName(itemId: number): string | null {
  return itemsStore.items.find(i => i.id === String(itemId))?.image?.full ?? null
}

function itemSetKey(set: ItemSetRow): string {
  return set.items.join(',')
}

const baselineByKey = computed(() => {
  const m = new Map<string, { pickrate: number; winrate: number }>()
  for (const s of props.baseline?.itemSets ?? []) {
    m.set(itemSetKey(s), { pickrate: s.pickrate, winrate: s.winrate })
  }
  return m
})

function baselineForSet(set: ItemSetRow) {
  return baselineByKey.value.get(itemSetKey(set))
}

function wrClass(wr: number): string {
  if (wr > 51) return 'text-green-400/90'
  if (wr < 49) return 'text-red-400/90'
  return 'text-text/80'
}

function formatDelta(cur: number, old: number | undefined): string {
  if (old === undefined || !Number.isFinite(old)) return '—'
  const d = Math.round((cur - old) * 10) / 10
  if (d === 0) return '0'
  return (d > 0 ? '+' : '') + d.toFixed(1)
}

function deltaClass(cur: number, old: number | undefined): string {
  if (old === undefined || !Number.isFinite(old)) return 'text-text/40'
  const d = cur - old
  if (d > 0.05) return 'text-sky-400/90'
  if (d < -0.05) return 'text-red-400/80'
  return 'text-text/55'
}

const topItemSets = computed(() => {
  const sets = props.data?.itemSets ?? []
  return [...sets].sort((a, b) => b.games - a.games).slice(0, SET_CARD_LIMIT)
})
</script>

<template>
  <div class="stats-item-sets-panel flex w-full flex-col gap-3">
    <h3 class="text-sm font-semibold text-text">
      {{ t('statisticsPage.overviewDetailItemSets') }}
    </h3>
    <div v-if="topItemSets.length" class="build-set-cards-grid">
      <div
        v-for="(set, idx) in topItemSets"
        :key="'item-set-' + itemSetKey(set)"
        class="build-set-card statistics-overview-surface relative min-w-0 rounded-lg border border-primary/30 px-4 pb-3 pt-5"
      >
        <span
          class="absolute left-0 top-0 z-10 flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/30 px-1 text-[10px] font-bold tabular-nums text-text/90"
          aria-hidden="true"
        >
          {{ idx + 1 }}
        </span>
        <div class="build-set-build-strip flex w-full min-w-0 flex-col items-center gap-2">
          <div class="build-set-items-row">
            <img
              v-for="itemId in set.items"
              v-show="gameVersion && itemImageName(itemId)"
              :key="itemId"
              :src="getItemImageUrl(gameVersion, itemImageName(itemId)!)"
              :alt="itemName(itemId)"
              :title="itemName(itemId)"
              class="build-set-item-icon"
              width="32"
              height="32"
            />
          </div>
        </div>
        <div
          class="build-set-stats mt-3 flex w-full flex-wrap items-baseline justify-center gap-x-5 gap-y-2 pt-1 text-center"
        >
          <span class="inline-flex flex-wrap items-baseline justify-center gap-x-1">
            <span class="build-set-stat-label text-text/55">WR:</span>
            <span
              class="build-set-stat-value font-semibold tabular-nums"
              :class="wrClass(set.winrate)"
            >
              {{ Number(set.winrate).toFixed(2) }}%
            </span>
          </span>
          <span class="inline-flex flex-wrap items-baseline justify-center gap-x-1">
            <span class="build-set-stat-label text-text/55">pR:</span>
            <span class="build-set-stat-value font-semibold tabular-nums">
              {{ Number(set.pickrate).toFixed(2) }}%
            </span>
          </span>
          <template v-if="comparisonVersion && !baselinePending">
            <span
              class="build-set-stat-delta tabular-nums"
              :class="deltaClass(set.pickrate, baselineForSet(set)?.pickrate)"
            >
              ΔP {{ formatDelta(set.pickrate, baselineForSet(set)?.pickrate) }}
            </span>
            <span
              class="build-set-stat-delta tabular-nums"
              :class="deltaClass(set.winrate, baselineForSet(set)?.winrate)"
            >
              ΔWR {{ formatDelta(set.winrate, baselineForSet(set)?.winrate) }}
            </span>
          </template>
        </div>
      </div>
    </div>
    <p v-else class="text-xs text-text/50">{{ t('statisticsPage.overviewNoData') }}</p>
  </div>
</template>

<style>
@import '~/assets/css/statistics-build-set-cards.css';
</style>
