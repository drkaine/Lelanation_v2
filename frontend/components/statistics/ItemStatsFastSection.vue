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

/**
 * Plancher « préféré » pour les cartes Δ : solo/bottes utilisent le même `games` que les achats totaux ;
 * starter/core/final comptent des occurrences **dans la tranche** (souvent 5–20× plus faibles) — même
 * `minGames` qu’en vue d’ensemble excluait quasiment toutes les lignes.
 */
const minGamesPreferredForDeltas = computed(() => {
  const m = minGames.value
  if (props.slice === 'solo' || props.slice === 'boots') return m
  return Math.max(15, Math.min(180, Math.floor(m * 0.22)))
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
  preferredMinG: number
): EnrichedRow[] {
  const minGTiers = [
    preferredMinG,
    Math.max(8, Math.floor(preferredMinG * 0.5)),
    40,
    30,
    20,
    15,
    10,
    5,
    1,
  ]
  const thrTiers = [0.02, 0.01, 0.005, 0.001, 0.0001, 0]
  let best: EnrichedRow[] = []
  for (const minG of minGTiers) {
    const base = rows.filter(r => r[field] != null && r.games >= minG)
    for (const thr of thrTiers) {
      const cand = base.filter(r => {
        const v = r[field]!
        return wantPositive ? v >= thr : v <= -thr
      })
      const sorted = [...cand].sort((a, b) => {
        const av = a[field]!
        const bv = b[field]!
        return wantPositive ? bv - av : av - bv
      })
      if (sorted.length >= n) return sorted.slice(0, n)
      if (sorted.length > best.length) best = sorted
    }
  }
  if (best.length === 0) {
    const all = rows
      .filter(r => r[field] != null)
      .sort((a, b) => {
        const av = a[field]!
        const bv = b[field]!
        return wantPositive ? bv - av : av - bv
      })
    return all.slice(0, n)
  }
  return best.slice(0, n)
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
  takeDeltaTopN(enriched.value, 'deltaPick', true, ITEM_FAST_ROWS, minGamesPreferredForDeltas.value)
)

const deltaPickDown = computed(() =>
  takeDeltaTopN(
    enriched.value,
    'deltaPick',
    false,
    ITEM_FAST_ROWS,
    minGamesPreferredForDeltas.value
  )
)

const deltaWrUp = computed(() =>
  takeDeltaTopN(enriched.value, 'deltaWr', true, ITEM_FAST_ROWS, minGamesPreferredForDeltas.value)
)

const deltaWrDown = computed(() =>
  takeDeltaTopN(enriched.value, 'deltaWr', false, ITEM_FAST_ROWS, minGamesPreferredForDeltas.value)
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

function formatSigned(value?: number): string {
  if (value == null) return '—'
  const n = Number(value)
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function scrollToItemsFullTable(): void {
  if (typeof document === 'undefined') return
  document
    .getElementById('statistics-items-full-table')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <!-- 8 cartes par tranche ; racines multiples pour s’intégrer au flex parent -->
  <!-- Plus pickés -->
  <div
    class="fast-stat-card fast-stat-card-items w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.mostPick')
            ? 'text-text-accent hover:text-accent-light'
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
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">
        {{ cardHeading('statisticsPage.itemFastMetricMostPick') }}
        <span
          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
          aria-hidden="true"
        >
          ⓘ
          <span role="tooltip" class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block">
            {{ t('statisticsPage.tooltipItemFastMostPick') }}
          </span>
        </span>
      </span>
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
                class="h-5 w-5 shrink-0 rounded-full object-cover"
              />
              <span class="min-w-0 flex-1 truncate font-medium text-text">{{
                itemName(row.itemId) || row.itemId
              }}</span>
              <span class="ml-2 w-16 shrink-0 text-right font-medium tabular-nums text-text"
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
    <div v-if="topPick.length" class="mt-1 text-center">
      <button
        type="button"
        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
        @click="scrollToItemsFullTable"
      >
        {{ t('statisticsPage.fastStatsSeeMore') }}
      </button>
    </div>
  </div>

  <!-- Moins pickés -->
  <div
    class="fast-stat-card fast-stat-card-items w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.leastPick')
            ? 'text-text-accent hover:text-accent-light'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        :title="
          cardIsFavorite(favoritePrefix + '.leastPick')
            ? 'Retirer des favoris'
            : 'Ajouter aux favoris'
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
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">
        {{ cardHeading('statisticsPage.itemFastMetricLeastPick') }}
        <span
          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
          aria-hidden="true"
        >
          ⓘ
          <span role="tooltip" class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block">
            {{ t('statisticsPage.tooltipItemFastLeastPick') }}
          </span>
        </span>
      </span>
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
                class="h-5 w-5 shrink-0 rounded-full object-cover"
              />
              <span class="min-w-0 flex-1 truncate font-medium text-text">{{
                itemName(row.itemId) || row.itemId
              }}</span>
              <span class="ml-2 w-16 shrink-0 text-right font-medium tabular-nums text-text"
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
    <div v-if="leastPick.length" class="mt-1 text-center">
      <button
        type="button"
        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
        @click="scrollToItemsFullTable"
      >
        {{ t('statisticsPage.fastStatsSeeMore') }}
      </button>
    </div>
  </div>

  <!-- Meilleur winrate -->
  <div
    class="fast-stat-card fast-stat-card-items w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.bestWr')
            ? 'text-text-accent hover:text-accent-light'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        :title="
          cardIsFavorite(favoritePrefix + '.bestWr') ? 'Retirer des favoris' : 'Ajouter aux favoris'
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
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">
        {{ cardHeading('statisticsPage.itemFastMetricBestWr') }}
        <span
          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
          aria-hidden="true"
        >
          ⓘ
          <span role="tooltip" class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block">
            {{ t('statisticsPage.tooltipItemFastBestWr') }}
          </span>
        </span>
      </span>
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
                class="h-5 w-5 shrink-0 rounded-full object-cover"
              />
              <span class="min-w-0 flex-1 truncate font-medium text-text">{{
                itemName(row.itemId) || row.itemId
              }}</span>
              <span class="ml-2 w-16 shrink-0 text-right font-medium tabular-nums text-text"
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
    <div v-if="bestWr.length" class="mt-1 text-center">
      <button
        type="button"
        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
        @click="scrollToItemsFullTable"
      >
        {{ t('statisticsPage.fastStatsSeeMore') }}
      </button>
    </div>
  </div>

  <!-- Pire winrate -->
  <div
    class="fast-stat-card fast-stat-card-items w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.worstWr')
            ? 'text-text-accent hover:text-accent-light'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        :title="
          cardIsFavorite(favoritePrefix + '.worstWr')
            ? 'Retirer des favoris'
            : 'Ajouter aux favoris'
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
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">
        {{ cardHeading('statisticsPage.itemFastMetricWorstWr') }}
        <span
          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
          aria-hidden="true"
        >
          ⓘ
          <span role="tooltip" class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block">
            {{ t('statisticsPage.tooltipItemFastWorstWr') }}
          </span>
        </span>
      </span>
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
                class="h-5 w-5 shrink-0 rounded-full object-cover"
              />
              <span
                class="min-w-0 flex-1 truncate font-medium text-text"
                :title="Number(row.pickrate).toFixed(1) + '% pick'"
                >{{ itemName(row.itemId) || row.itemId }}</span
              >
              <span class="ml-2 w-16 shrink-0 text-right font-medium tabular-nums text-error"
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
    <div v-if="worstWr.length" class="mt-1 text-center">
      <button
        type="button"
        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
        @click="scrollToItemsFullTable"
      >
        {{ t('statisticsPage.fastStatsSeeMore') }}
      </button>
    </div>
  </div>

  <!-- Δ pickrate + -->
  <div
    class="fast-stat-card fast-stat-card-items w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.deltaPickUp')
            ? 'text-text-accent hover:text-accent-light'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        :title="
          cardIsFavorite(favoritePrefix + '.deltaPickUp')
            ? 'Retirer des favoris'
            : 'Ajouter aux favoris'
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
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">
        {{ cardHeadingDelta('statisticsPage.itemFastMetricDeltaPickUp') }}
        <span
          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
          aria-hidden="true"
        >
          ⓘ
          <span role="tooltip" class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block">
            {{
              t('statisticsPage.tooltipItemFastDeltaPickUp', {
                version: refVersionLabel || '—',
              })
            }}
          </span>
        </span>
      </span>
    </h3>
    <div v-if="baselinePending" class="py-2 text-center text-xs text-text/60">
      {{ t('statisticsPage.loading') }}
    </div>
    <template v-else-if="hasBaseline && deltaPickUp.length">
      <table class="fast-stat-table w-full text-xs">
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
                  class="h-5 w-5 shrink-0 rounded-full object-cover"
                />
                <span
                  class="min-w-0 flex-1 truncate font-medium text-text"
                  :title="Number(row.pickrate).toFixed(1) + '% pick'"
                  >{{ itemName(row.itemId) || row.itemId }}</span
                >
                <span class="ml-2 w-16 shrink-0 text-right font-medium tabular-nums text-accent">{{
                  formatSigned(row.deltaPick)
                }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="mt-1 text-center">
        <button
          type="button"
          class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
          @click="scrollToItemsFullTable"
        >
          {{ t('statisticsPage.fastStatsSeeMore') }}
        </button>
      </div>
    </template>
    <div v-else-if="!hasBaseline" class="py-3 text-center text-text/60">
      {{ t('statisticsPage.itemsDeltaNeedRefVersion') }}
    </div>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoProgression') }}
    </div>
  </div>

  <!-- Δ pickrate − -->
  <div
    class="fast-stat-card fast-stat-card-items w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.deltaPickDown')
            ? 'text-text-accent hover:text-accent-light'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        :title="
          cardIsFavorite(favoritePrefix + '.deltaPickDown')
            ? 'Retirer des favoris'
            : 'Ajouter aux favoris'
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
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">
        {{ cardHeadingDelta('statisticsPage.itemFastMetricDeltaPickDown') }}
        <span
          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
          aria-hidden="true"
        >
          ⓘ
          <span role="tooltip" class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block">
            {{
              t('statisticsPage.tooltipItemFastDeltaPickDown', {
                version: refVersionLabel || '—',
              })
            }}
          </span>
        </span>
      </span>
    </h3>
    <div v-if="baselinePending" class="py-2 text-center text-xs text-text/60">
      {{ t('statisticsPage.loading') }}
    </div>
    <template v-else-if="hasBaseline && deltaPickDown.length">
      <table class="fast-stat-table w-full text-xs">
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
                  class="h-5 w-5 shrink-0 rounded-full object-cover"
                />
                <span
                  class="min-w-0 flex-1 truncate font-medium text-text"
                  :title="Number(row.pickrate).toFixed(1) + '% pick'"
                  >{{ itemName(row.itemId) || row.itemId }}</span
                >
                <span class="ml-2 w-16 shrink-0 text-right font-medium tabular-nums text-error">{{
                  formatSigned(row.deltaPick)
                }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="mt-1 text-center">
        <button
          type="button"
          class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
          @click="scrollToItemsFullTable"
        >
          {{ t('statisticsPage.fastStatsSeeMore') }}
        </button>
      </div>
    </template>
    <div v-else-if="!hasBaseline" class="py-3 text-center text-text/60">
      {{ t('statisticsPage.itemsDeltaNeedRefVersion') }}
    </div>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoProgression') }}
    </div>
  </div>

  <!-- Δ winrate + -->
  <div
    class="fast-stat-card fast-stat-card-items w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.deltaWrUp')
            ? 'text-text-accent hover:text-accent-light'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        :title="
          cardIsFavorite(favoritePrefix + '.deltaWrUp')
            ? 'Retirer des favoris'
            : 'Ajouter aux favoris'
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
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">
        {{ cardHeadingDelta('statisticsPage.itemFastMetricDeltaWrUp') }}
        <span
          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
          aria-hidden="true"
        >
          ⓘ
          <span role="tooltip" class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block">
            {{
              t('statisticsPage.tooltipItemFastDeltaWrUp', {
                version: refVersionLabel || '—',
              })
            }}
          </span>
        </span>
      </span>
    </h3>
    <div v-if="baselinePending" class="py-2 text-center text-xs text-text/60">
      {{ t('statisticsPage.loading') }}
    </div>
    <template v-else-if="hasBaseline && deltaWrUp.length">
      <table class="fast-stat-table w-full text-xs">
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
                  class="h-5 w-5 shrink-0 rounded-full object-cover"
                />
                <span
                  class="min-w-0 flex-1 truncate font-medium text-text"
                  :title="Number(row.winrate).toFixed(1) + '% WR'"
                  >{{ itemName(row.itemId) || row.itemId }}</span
                >
                <span class="ml-2 w-16 shrink-0 text-right font-medium tabular-nums text-success">{{
                  formatSigned(row.deltaWr)
                }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="mt-1 text-center">
        <button
          type="button"
          class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
          @click="scrollToItemsFullTable"
        >
          {{ t('statisticsPage.fastStatsSeeMore') }}
        </button>
      </div>
    </template>
    <div v-else-if="!hasBaseline" class="py-3 text-center text-text/60">
      {{ t('statisticsPage.itemsDeltaNeedRefVersion') }}
    </div>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoProgression') }}
    </div>
  </div>

  <!-- Δ winrate − -->
  <div
    class="fast-stat-card fast-stat-card-items w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
  >
    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
      <button
        type="button"
        class="text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoritePrefix + '.deltaWrDown')
            ? 'text-text-accent hover:text-accent-light'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        :title="
          cardIsFavorite(favoritePrefix + '.deltaWrDown')
            ? 'Retirer des favoris'
            : 'Ajouter aux favoris'
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
      <span class="inline-flex min-w-0 flex-1 items-center leading-tight">
        {{ cardHeadingDelta('statisticsPage.itemFastMetricDeltaWrDown') }}
        <span
          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
          aria-hidden="true"
        >
          ⓘ
          <span role="tooltip" class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block">
            {{
              t('statisticsPage.tooltipItemFastDeltaWrDown', {
                version: refVersionLabel || '—',
              })
            }}
          </span>
        </span>
      </span>
    </h3>
    <div v-if="baselinePending" class="py-2 text-center text-xs text-text/60">
      {{ t('statisticsPage.loading') }}
    </div>
    <template v-else-if="hasBaseline && deltaWrDown.length">
      <table class="fast-stat-table w-full text-xs">
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
                  class="h-5 w-5 shrink-0 rounded-full object-cover"
                />
                <span
                  class="min-w-0 flex-1 truncate font-medium text-text"
                  :title="Number(row.winrate).toFixed(1) + '% WR'"
                  >{{ itemName(row.itemId) || row.itemId }}</span
                >
                <span class="ml-2 w-16 shrink-0 text-right font-medium tabular-nums text-error">{{
                  formatSigned(row.deltaWr)
                }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="mt-1 text-center">
        <button
          type="button"
          class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
          @click="scrollToItemsFullTable"
        >
          {{ t('statisticsPage.fastStatsSeeMore') }}
        </button>
      </div>
    </template>
    <div v-else-if="!hasBaseline" class="py-3 text-center text-text/60">
      {{ t('statisticsPage.itemsDeltaNeedRefVersion') }}
    </div>
    <div v-else class="py-3 text-center text-text/60">
      {{ t('statisticsPage.fastStatsNoProgression') }}
    </div>
  </div>
</template>
