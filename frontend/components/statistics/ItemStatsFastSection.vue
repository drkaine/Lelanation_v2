<script setup lang="ts">
/**
 * Cartes rapides objets pour une tranche (starter / core / bottes / finaux) :
 * plus / moins pick, meilleur / pire WR, deltas pick et WR dans les deux sens.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useItemsStore } from '~/stores/ItemsStore'
import { useStatisticsCustomStore } from '~/stores/StatisticsCustomStore'
import { getItemImageUrl } from '~/utils/imageUrl'

export type ItemSliceCategory = 'starter' | 'core' | 'boots' | 'final' | 'solo'

export type ItemAggRow = {
  itemId: number
  games: number
  wins: number
  pickrate: number
  winrate: number
}

type EnrichedRow = ItemAggRow & {
  deltaWr?: number
  deltaPick?: number
}

const props = defineProps<{
  slice: ItemSliceCategory
  rows: ItemAggRow[]
  baselineRows?: ItemAggRow[] | null
  totalParticipants: number
  gameVersion: string | null
  refVersionLabel: string | null
  baselinePending?: boolean
}>()

const { t } = useI18n()
const itemsStore = useItemsStore()
const statisticsCustomStore = useStatisticsCustomStore()

const SLICE_I18N: Record<ItemSliceCategory, string> = {
  starter: 'statisticsPage.itemFastSliceStarter',
  core: 'statisticsPage.itemFastSliceCore',
  boots: 'statisticsPage.itemFastSliceBoots',
  final: 'statisticsPage.itemFastSliceFinal',
  solo: 'statisticsPage.itemFastSliceSolo',
}

function itemName(itemId: number): string | null {
  return itemsStore.items.find(i => i.id === String(itemId))?.name ?? null
}

function itemImageName(itemId: number): string | null {
  return itemsStore.items.find(i => i.id === String(itemId))?.image?.full ?? null
}

const sliceLabel = computed(() => t(SLICE_I18N[props.slice]))

const favoritePrefix = computed(() => `items.slice.${props.slice}`)

const minGames = computed(() => {
  const tp = props.totalParticipants
  return Math.min(800, Math.max(100, Math.floor(tp * 0.0008)))
})

const enriched = computed((): EnrichedRow[] => {
  const base = props.baselineRows
  if (!base?.length) return props.rows.map(r => ({ ...r }))
  const m = new Map(base.map(r => [r.itemId, r]))
  return props.rows.map(r => {
    const b = m.get(r.itemId)
    return {
      ...r,
      deltaWr: b != null ? r.winrate - b.winrate : undefined,
      deltaPick: b != null ? r.pickrate - b.pickrate : undefined,
    }
  })
})

const hasBaseline = computed(() => !!props.baselineRows?.length && !!props.refVersionLabel?.trim())

const ITEM_FAST_ROWS = 5

/** Remplit jusqu’à n lignes en assouplissant progressivement le plancher de parties. */
function takeItemTopNByMinGames(sorted: ItemAggRow[], n: number, preferMin: number): ItemAggRow[] {
  const thresholds = [preferMin, 50, 20, 10, 1]
  const seen = new Set<number>()
  const out: ItemAggRow[] = []
  for (const minG of thresholds) {
    for (const r of sorted) {
      if (r.games < minG || seen.has(r.itemId)) continue
      seen.add(r.itemId)
      out.push(r)
      if (out.length >= n) return out
    }
  }
  return out
}

function takeDeltaTopN(
  rows: EnrichedRow[],
  field: 'deltaPick' | 'deltaWr',
  wantPositive: boolean,
  n: number,
  minG: number
): EnrichedRow[] {
  const base = rows.filter(r => r[field] != null && r.games >= minG)
  const thresholds = [0.02, 0.01, 0.005, 0.001, 0]
  for (const thr of thresholds) {
    const cand = base.filter(r => {
      const v = r[field]!
      return wantPositive ? v > thr : v < -thr
    })
    const sorted = [...cand].sort((a, b) => {
      const av = a[field]!
      const bv = b[field]!
      return wantPositive ? bv - av : av - bv
    })
    if (sorted.length >= n) return sorted.slice(0, n)
  }
  return []
}

const topPick = computed(() =>
  [...props.rows].sort((a, b) => b.pickrate - a.pickrate).slice(0, ITEM_FAST_ROWS)
)

const leastPick = computed(() =>
  takeItemTopNByMinGames(
    [...props.rows].sort((a, b) => a.pickrate - b.pickrate),
    ITEM_FAST_ROWS,
    minGames.value
  )
)

const bestWr = computed(() =>
  takeItemTopNByMinGames(
    [...props.rows].sort((a, b) => b.winrate - a.winrate),
    ITEM_FAST_ROWS,
    minGames.value
  )
)

const worstWr = computed(() =>
  takeItemTopNByMinGames(
    [...props.rows].sort((a, b) => a.winrate - b.winrate),
    ITEM_FAST_ROWS,
    minGames.value
  )
)

const deltaPickUp = computed(() =>
  takeDeltaTopN(enriched.value, 'deltaPick', true, ITEM_FAST_ROWS, minGames.value)
)

const deltaPickDown = computed(() =>
  takeDeltaTopN(enriched.value, 'deltaPick', false, ITEM_FAST_ROWS, minGames.value)
)

const deltaWrUp = computed(() =>
  takeDeltaTopN(enriched.value, 'deltaWr', true, ITEM_FAST_ROWS, minGames.value)
)

const deltaWrDown = computed(() =>
  takeDeltaTopN(enriched.value, 'deltaWr', false, ITEM_FAST_ROWS, minGames.value)
)

function cardIsFavorite(id: string): boolean {
  return statisticsCustomStore.isFavorite(id)
}

function toggleFavorite(id: string, title: string): void {
  statisticsCustomStore.toggleFavorite(id, title)
}

function cardHeading(metricI18nKey: string): string {
  return `${sliceLabel.value} ${t(metricI18nKey)}`
}

function cardHeadingDelta(metricI18nKey: string): string {
  return `${sliceLabel.value} ${t(metricI18nKey, { version: props.refVersionLabel || '—' })}`
}

function pickBarWidth(row: ItemAggRow, list: ItemAggRow[]): string {
  const max = Math.max(...list.map(r => r.pickrate), 1)
  return Math.min(100, (row.pickrate / max) * 100) + '%'
}

function bestWrBarWidth(row: ItemAggRow, list: ItemAggRow[]): string {
  const max = Math.max(...list.map(r => r.winrate), 1)
  return Math.min(100, (row.winrate / max) * 100) + '%'
}

function worstWrBarWidth(row: ItemAggRow, list: ItemAggRow[]): string {
  const drops = list.map(r => 100 - r.winrate)
  const max = Math.max(...drops, 0.01)
  return Math.min(100, ((100 - row.winrate) / max) * 100) + '%'
}

function deltaBarWidth(
  row: EnrichedRow,
  list: EnrichedRow[],
  field: 'deltaWr' | 'deltaPick'
): string {
  const max = Math.max(...list.map(r => Math.abs(r[field] ?? 0)), 0.01)
  const v = Math.abs(row[field] ?? 0)
  return Math.min(100, (v / max) * 100) + '%'
}
</script>

<template>
  <!-- 8 cartes par tranche ; racines multiples pour s’intégrer au flex parent -->
  <!-- Plus pickés -->
  <div
    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.mostPick')
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        :title="
          cardIsFavorite(favoritePrefix + '.mostPick')
            ? 'Retirer des favoris'
            : 'Ajouter aux favoris'
        "
        @click="
          toggleFavorite(
            favoritePrefix + '.mostPick',
            cardHeading('statisticsPage.itemFastMetricMostPick')
          )
        "
      >
        {{ cardIsFavorite(favoritePrefix + '.mostPick') ? '★' : '☆' }}
      </button>
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">{{
        cardHeading('statisticsPage.itemFastMetricMostPick')
      }}</span>
    </h3>
    <table v-if="topPick.length" class="fast-stat-table w-full text-xs">
      <tbody>
        <tr v-for="(row, idx) in topPick" :key="slice + '-mp-' + row.itemId" class="fast-stat-row">
          <td class="py-0.5 align-middle">
            <div class="flex items-center gap-0.5">
              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
              <img
                v-if="gameVersion && itemImageName(row.itemId)"
                :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                :alt="itemName(row.itemId) || ''"
                class="h-5 w-5 shrink-0 rounded object-cover"
              />
              <span class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">{{
                itemName(row.itemId) || row.itemId
              }}</span>
              <div
                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
              >
                <div
                  class="h-full rounded bg-accent transition-[width]"
                  :style="{ width: pickBarWidth(row, topPick) }"
                />
              </div>
              <span class="w-9 shrink-0 text-right font-medium tabular-nums text-text"
                >{{ Number(row.pickrate).toFixed(2) }}%</span
              >
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoData') }}
    </div>
  </div>

  <!-- Moins pickés -->
  <div
    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.leastPick')
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        @click="
          toggleFavorite(
            favoritePrefix + '.leastPick',
            cardHeading('statisticsPage.itemFastMetricLeastPick')
          )
        "
      >
        {{ cardIsFavorite(favoritePrefix + '.leastPick') ? '★' : '☆' }}
      </button>
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">{{
        cardHeading('statisticsPage.itemFastMetricLeastPick')
      }}</span>
    </h3>
    <table v-if="leastPick.length" class="fast-stat-table w-full text-xs">
      <tbody>
        <tr
          v-for="(row, idx) in leastPick"
          :key="slice + '-lp-' + row.itemId"
          class="fast-stat-row"
        >
          <td class="py-0.5 align-middle">
            <div class="flex items-center gap-0.5">
              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
              <img
                v-if="gameVersion && itemImageName(row.itemId)"
                :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                :alt="itemName(row.itemId) || ''"
                class="h-5 w-5 shrink-0 rounded object-cover"
              />
              <span class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">{{
                itemName(row.itemId) || row.itemId
              }}</span>
              <div
                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
              >
                <div
                  class="h-full rounded bg-accent/70 transition-[width]"
                  :style="{ width: pickBarWidth(row, leastPick) }"
                />
              </div>
              <span class="w-9 shrink-0 text-right font-medium tabular-nums text-text"
                >{{ Number(row.pickrate).toFixed(2) }}%</span
              >
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoData') }}
    </div>
  </div>

  <!-- Meilleur winrate -->
  <div
    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.bestWr')
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        @click="
          toggleFavorite(
            favoritePrefix + '.bestWr',
            cardHeading('statisticsPage.itemFastMetricBestWr')
          )
        "
      >
        {{ cardIsFavorite(favoritePrefix + '.bestWr') ? '★' : '☆' }}
      </button>
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">{{
        cardHeading('statisticsPage.itemFastMetricBestWr')
      }}</span>
    </h3>
    <table v-if="bestWr.length" class="fast-stat-table w-full text-xs">
      <tbody>
        <tr v-for="(row, idx) in bestWr" :key="slice + '-bw-' + row.itemId" class="fast-stat-row">
          <td class="py-0.5 align-middle">
            <div class="flex items-center gap-0.5">
              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
              <img
                v-if="gameVersion && itemImageName(row.itemId)"
                :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                :alt="itemName(row.itemId) || ''"
                class="h-5 w-5 shrink-0 rounded object-cover"
              />
              <span class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">{{
                itemName(row.itemId) || row.itemId
              }}</span>
              <div
                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
              >
                <div
                  class="h-full rounded bg-success transition-[width]"
                  :style="{ width: bestWrBarWidth(row, bestWr) }"
                />
              </div>
              <span class="w-9 shrink-0 text-right font-medium tabular-nums text-success"
                >{{ Number(row.winrate).toFixed(2) }}%</span
              >
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoData') }}
    </div>
  </div>

  <!-- Pire winrate -->
  <div
    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.worstWr')
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        @click="
          toggleFavorite(
            favoritePrefix + '.worstWr',
            cardHeading('statisticsPage.itemFastMetricWorstWr')
          )
        "
      >
        {{ cardIsFavorite(favoritePrefix + '.worstWr') ? '★' : '☆' }}
      </button>
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">{{
        cardHeading('statisticsPage.itemFastMetricWorstWr')
      }}</span>
    </h3>
    <table v-if="worstWr.length" class="fast-stat-table w-full text-xs">
      <tbody>
        <tr v-for="(row, idx) in worstWr" :key="slice + '-ww-' + row.itemId" class="fast-stat-row">
          <td class="py-0.5 align-middle">
            <div class="flex items-center gap-0.5">
              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
              <img
                v-if="gameVersion && itemImageName(row.itemId)"
                :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                :alt="itemName(row.itemId) || ''"
                class="h-5 w-5 shrink-0 rounded object-cover"
              />
              <span
                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                :title="Number(row.pickrate).toFixed(1) + '% pick'"
                >{{ itemName(row.itemId) || row.itemId }}</span
              >
              <div
                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
              >
                <div
                  class="h-full rounded bg-error transition-[width]"
                  :style="{ width: worstWrBarWidth(row, worstWr) }"
                />
              </div>
              <span class="w-9 shrink-0 text-right font-medium tabular-nums text-error"
                >{{ Number(row.winrate).toFixed(2) }}%</span
              >
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoData') }}
    </div>
  </div>

  <!-- Δ pickrate + -->
  <div
    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.deltaPickUp')
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        @click="
          toggleFavorite(
            favoritePrefix + '.deltaPickUp',
            cardHeadingDelta('statisticsPage.itemFastMetricDeltaPickUp')
          )
        "
      >
        {{ cardIsFavorite(favoritePrefix + '.deltaPickUp') ? '★' : '☆' }}
      </button>
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">{{
        cardHeadingDelta('statisticsPage.itemFastMetricDeltaPickUp')
      }}</span>
    </h3>
    <div v-if="baselinePending" class="py-2 text-center text-xs text-text/60">
      {{ t('statisticsPage.loading') }}
    </div>
    <table v-else-if="hasBaseline && deltaPickUp.length" class="fast-stat-table w-full text-xs">
      <tbody>
        <tr
          v-for="(row, idx) in deltaPickUp"
          :key="slice + '-dpu-' + row.itemId"
          class="fast-stat-row"
        >
          <td class="py-0.5 align-middle">
            <div class="flex items-center gap-0.5">
              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
              <img
                v-if="gameVersion && itemImageName(row.itemId)"
                :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                :alt="itemName(row.itemId) || ''"
                class="h-5 w-5 shrink-0 rounded object-cover"
              />
              <span
                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                :title="Number(row.pickrate).toFixed(1) + '% pick'"
                >{{ itemName(row.itemId) || row.itemId }}</span
              >
              <div
                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
              >
                <div
                  class="h-full rounded bg-accent transition-[width]"
                  :style="{ width: deltaBarWidth(row, deltaPickUp, 'deltaPick') }"
                />
              </div>
              <span class="w-9 shrink-0 text-right font-medium tabular-nums text-accent"
                >+{{ Number(row.deltaPick).toFixed(2) }}%</span
              >
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="!hasBaseline" class="py-3 text-center text-text/60">
      {{ t('statisticsPage.itemsDeltaNeedRefVersion') }}
    </div>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoProgression') }}
    </div>
  </div>

  <!-- Δ pickrate − -->
  <div
    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.deltaPickDown')
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        @click="
          toggleFavorite(
            favoritePrefix + '.deltaPickDown',
            cardHeadingDelta('statisticsPage.itemFastMetricDeltaPickDown')
          )
        "
      >
        {{ cardIsFavorite(favoritePrefix + '.deltaPickDown') ? '★' : '☆' }}
      </button>
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">{{
        cardHeadingDelta('statisticsPage.itemFastMetricDeltaPickDown')
      }}</span>
    </h3>
    <div v-if="baselinePending" class="py-2 text-center text-xs text-text/60">
      {{ t('statisticsPage.loading') }}
    </div>
    <table v-else-if="hasBaseline && deltaPickDown.length" class="fast-stat-table w-full text-xs">
      <tbody>
        <tr
          v-for="(row, idx) in deltaPickDown"
          :key="slice + '-dpd-' + row.itemId"
          class="fast-stat-row"
        >
          <td class="py-0.5 align-middle">
            <div class="flex items-center gap-0.5">
              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
              <img
                v-if="gameVersion && itemImageName(row.itemId)"
                :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                :alt="itemName(row.itemId) || ''"
                class="h-5 w-5 shrink-0 rounded object-cover"
              />
              <span
                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                :title="Number(row.pickrate).toFixed(1) + '% pick'"
                >{{ itemName(row.itemId) || row.itemId }}</span
              >
              <div
                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
              >
                <div
                  class="h-full rounded bg-error/90 transition-[width]"
                  :style="{ width: deltaBarWidth(row, deltaPickDown, 'deltaPick') }"
                />
              </div>
              <span class="w-9 shrink-0 text-right font-medium tabular-nums text-error"
                >{{ Number(row.deltaPick).toFixed(2) }}%</span
              >
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="!hasBaseline" class="py-3 text-center text-text/60">
      {{ t('statisticsPage.itemsDeltaNeedRefVersion') }}
    </div>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoProgression') }}
    </div>
  </div>

  <!-- Δ winrate + -->
  <div
    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.deltaWrUp')
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        @click="
          toggleFavorite(
            favoritePrefix + '.deltaWrUp',
            cardHeadingDelta('statisticsPage.itemFastMetricDeltaWrUp')
          )
        "
      >
        {{ cardIsFavorite(favoritePrefix + '.deltaWrUp') ? '★' : '☆' }}
      </button>
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">{{
        cardHeadingDelta('statisticsPage.itemFastMetricDeltaWrUp')
      }}</span>
    </h3>
    <div v-if="baselinePending" class="py-2 text-center text-xs text-text/60">
      {{ t('statisticsPage.loading') }}
    </div>
    <table v-else-if="hasBaseline && deltaWrUp.length" class="fast-stat-table w-full text-xs">
      <tbody>
        <tr
          v-for="(row, idx) in deltaWrUp"
          :key="slice + '-dwu-' + row.itemId"
          class="fast-stat-row"
        >
          <td class="py-0.5 align-middle">
            <div class="flex items-center gap-0.5">
              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
              <img
                v-if="gameVersion && itemImageName(row.itemId)"
                :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                :alt="itemName(row.itemId) || ''"
                class="h-5 w-5 shrink-0 rounded object-cover"
              />
              <span
                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                :title="Number(row.winrate).toFixed(1) + '% WR'"
                >{{ itemName(row.itemId) || row.itemId }}</span
              >
              <div
                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
              >
                <div
                  class="h-full rounded bg-success transition-[width]"
                  :style="{ width: deltaBarWidth(row, deltaWrUp, 'deltaWr') }"
                />
              </div>
              <span class="w-9 shrink-0 text-right font-medium tabular-nums text-success"
                >+{{ Number(row.deltaWr).toFixed(2) }}%</span
              >
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="!hasBaseline" class="py-3 text-center text-text/60">
      {{ t('statisticsPage.itemsDeltaNeedRefVersion') }}
    </div>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoProgression') }}
    </div>
  </div>

  <!-- Δ winrate − -->
  <div
    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.deltaWrDown')
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        @click="
          toggleFavorite(
            favoritePrefix + '.deltaWrDown',
            cardHeadingDelta('statisticsPage.itemFastMetricDeltaWrDown')
          )
        "
      >
        {{ cardIsFavorite(favoritePrefix + '.deltaWrDown') ? '★' : '☆' }}
      </button>
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">{{
        cardHeadingDelta('statisticsPage.itemFastMetricDeltaWrDown')
      }}</span>
    </h3>
    <div v-if="baselinePending" class="py-2 text-center text-xs text-text/60">
      {{ t('statisticsPage.loading') }}
    </div>
    <table v-else-if="hasBaseline && deltaWrDown.length" class="fast-stat-table w-full text-xs">
      <tbody>
        <tr
          v-for="(row, idx) in deltaWrDown"
          :key="slice + '-dwd-' + row.itemId"
          class="fast-stat-row"
        >
          <td class="py-0.5 align-middle">
            <div class="flex items-center gap-0.5">
              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
              <img
                v-if="gameVersion && itemImageName(row.itemId)"
                :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                :alt="itemName(row.itemId) || ''"
                class="h-5 w-5 shrink-0 rounded object-cover"
              />
              <span
                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                :title="Number(row.winrate).toFixed(1) + '% WR'"
                >{{ itemName(row.itemId) || row.itemId }}</span
              >
              <div
                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
              >
                <div
                  class="h-full rounded bg-error/90 transition-[width]"
                  :style="{ width: deltaBarWidth(row, deltaWrDown, 'deltaWr') }"
                />
              </div>
              <span class="w-9 shrink-0 text-right font-medium tabular-nums text-error"
                >{{ Number(row.deltaWr).toFixed(2) }}%</span
              >
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="!hasBaseline" class="py-3 text-center text-text/60">
      {{ t('statisticsPage.itemsDeltaNeedRefVersion') }}
    </div>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoProgression') }}
    </div>
  </div>
</template>
