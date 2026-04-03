<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useItemsStore } from '~/stores/ItemsStore'
import { useStatisticsCustomStore } from '~/stores/StatisticsCustomStore'
import { getItemImageUrl } from '~/utils/imageUrl'

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
  sectionTitle: string
  rows: ItemAggRow[]
  baselineRows?: ItemAggRow[] | null
  totalParticipants: number
  gameVersion: string | null
  favoritePrefix: string
  /** Libellé version de référence pour les cartes Δ (ex. progressionFromVersion) */
  refVersionLabel: string | null
  baselinePending?: boolean
}>()

const { t } = useI18n()
const itemsStore = useItemsStore()
const statisticsCustomStore = useStatisticsCustomStore()

function itemName(itemId: number): string | null {
  return itemsStore.items.find(i => i.id === String(itemId))?.name ?? null
}

function itemImageName(itemId: number): string | null {
  return itemsStore.items.find(i => i.id === String(itemId))?.image?.full ?? null
}

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

const topPick = computed(() => [...props.rows].sort((a, b) => b.pickrate - a.pickrate).slice(0, 5))

const bestWr = computed(() =>
  [...props.rows]
    .filter(r => r.games >= minGames.value)
    .sort((a, b) => b.winrate - a.winrate)
    .slice(0, 5)
)

/** Plus bas winrate parmi une pickrate relativement basse (moitié inférieure), sinon pire winrate global filtré. */
const worstLowPick = computed(() => {
  const elig = props.rows.filter(r => r.games >= minGames.value)
  if (!elig.length) return []
  const byPickAsc = [...elig].sort((a, b) => a.pickrate - b.pickrate)
  const mid = Math.floor(byPickAsc.length / 2)
  const medianPick = byPickAsc[mid]?.pickrate ?? 0
  const lowPick = elig.filter(r => r.pickrate <= medianPick)
  const pool = lowPick.length >= 3 ? lowPick : elig
  return [...pool].sort((a, b) => a.winrate - b.winrate).slice(0, 5)
})

const deltaWrUp = computed(() => {
  const list = enriched.value.filter(
    r => r.deltaWr != null && r.games >= minGames.value && r.deltaWr > 0.02
  )
  return [...list].sort((a, b) => (b.deltaWr ?? 0) - (a.deltaWr ?? 0)).slice(0, 5)
})

const deltaPickUp = computed(() => {
  const list = enriched.value.filter(
    r => r.deltaPick != null && r.games >= minGames.value && r.deltaPick > 0.02
  )
  return [...list].sort((a, b) => (b.deltaPick ?? 0) - (a.deltaPick ?? 0)).slice(0, 5)
})

function cardIsFavorite(id: string): boolean {
  return statisticsCustomStore.isFavorite(id)
}

function toggleFavorite(id: string, title: string): void {
  statisticsCustomStore.toggleFavorite(id, title)
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

function deltaWrBarWidth(row: EnrichedRow, list: EnrichedRow[]): string {
  const max = Math.max(...list.map(r => Math.abs(r.deltaWr ?? 0)), 0.01)
  return Math.min(100, ((row.deltaWr ?? 0) / max) * 100) + '%'
}

function deltaPickBarWidth(row: EnrichedRow, list: EnrichedRow[]): string {
  const max = Math.max(...list.map(r => Math.abs(r.deltaPick ?? 0)), 0.01)
  return Math.min(100, ((row.deltaPick ?? 0) / max) * 100) + '%'
}
</script>

<template>
  <section class="space-y-3">
    <h3 class="text-base font-semibold text-text-accent">{{ sectionTitle }}</h3>
    <div class="flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[10px] pb-2">
      <!-- Plus pickés -->
      <div class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 p-2">
        <h4 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
          <button
            type="button"
            class="text-base leading-none transition-colors"
            :class="
              cardIsFavorite(favoritePrefix + '.mostPicked')
                ? 'text-amber-300 hover:text-amber-200'
                : 'text-text/45 grayscale hover:text-text/75'
            "
            :title="
              cardIsFavorite(favoritePrefix + '.mostPicked')
                ? 'Retirer des favoris'
                : 'Ajouter aux favoris'
            "
            @click="
              toggleFavorite(
                favoritePrefix + '.mostPicked',
                sectionTitle + ' — ' + t('statisticsPage.itemsCardMostPicked')
              )
            "
          >
            {{ cardIsFavorite(favoritePrefix + '.mostPicked') ? '★' : '☆' }}
          </button>
          <span>{{ t('statisticsPage.itemsCardMostPicked') }}</span>
        </h4>
        <table v-if="topPick.length" class="fast-stat-table w-full text-xs">
          <tbody>
            <tr v-for="(row, idx) in topPick" :key="'mp-' + row.itemId" class="fast-stat-row">
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
                    class="min-w-[4.5rem] max-w-[6rem] shrink-0 truncate font-medium text-text"
                    >{{ itemName(row.itemId) || row.itemId }}</span
                  >
                  <div
                    class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                  >
                    <div
                      class="h-full rounded bg-accent transition-[width]"
                      :style="{ width: pickBarWidth(row, topPick) }"
                    />
                  </div>
                  <span class="w-9 shrink-0 text-right font-medium text-text"
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
      <div class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 p-2">
        <h4 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                sectionTitle + ' — ' + t('statisticsPage.itemsCardBestWinrate')
              )
            "
          >
            {{ cardIsFavorite(favoritePrefix + '.bestWr') ? '★' : '☆' }}
          </button>
          <span>{{ t('statisticsPage.itemsCardBestWinrate') }}</span>
        </h4>
        <table v-if="bestWr.length" class="fast-stat-table w-full text-xs">
          <tbody>
            <tr v-for="(row, idx) in bestWr" :key="'bw-' + row.itemId" class="fast-stat-row">
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
                    class="min-w-[4.5rem] max-w-[6rem] shrink-0 truncate font-medium text-text"
                    >{{ itemName(row.itemId) || row.itemId }}</span
                  >
                  <div
                    class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                  >
                    <div
                      class="h-full rounded bg-success transition-[width]"
                      :style="{ width: bestWrBarWidth(row, bestWr) }"
                    />
                  </div>
                  <span class="w-9 shrink-0 text-right font-medium text-success"
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

      <!-- Plus bas winrate (pick modérée) -->
      <div class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 p-2">
        <h4 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                sectionTitle + ' — ' + t('statisticsPage.itemsCardLowestWinrateLowPick')
              )
            "
          >
            {{ cardIsFavorite(favoritePrefix + '.worstWr') ? '★' : '☆' }}
          </button>
          <span class="inline-flex flex-1 flex-wrap items-center gap-1">
            {{ t('statisticsPage.itemsCardLowestWinrateLowPick') }}
            <span
              class="group/stat-tip relative inline-flex cursor-help text-text/50"
              aria-hidden="true"
            >
              ⓘ
              <span
                role="tooltip"
                class="fast-stat-tooltip-popover hidden w-48 group-hover/stat-tip:block"
              >
                {{ t('statisticsPage.tooltipItemsLowestWinrateLowPick') }}
              </span>
            </span>
          </span>
        </h4>
        <table v-if="worstLowPick.length" class="fast-stat-table w-full text-xs">
          <tbody>
            <tr v-for="(row, idx) in worstLowPick" :key="'ww-' + row.itemId" class="fast-stat-row">
              <td class="py-0.5 align-middle">
                <div class="flex items-center gap-0.5">
                  <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                  <img
                    v-if="gameVersion && itemImageName(row.itemId)"
                    :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                    :alt="itemName(row.itemId) || ''"
                    class="h-5 w-5 shrink-0 rounded object-cover"
                  />
                  <div class="min-w-0 max-w-[5.5rem] shrink-0">
                    <div class="truncate font-medium leading-tight text-text">
                      {{ itemName(row.itemId) || row.itemId }}
                    </div>
                    <div class="whitespace-nowrap text-[9px] tabular-nums text-text/70">
                      {{ Number(row.pickrate).toFixed(1) }}% pick
                    </div>
                  </div>
                  <div
                    class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                  >
                    <div
                      class="h-full rounded bg-error transition-[width]"
                      :style="{ width: worstWrBarWidth(row, worstLowPick) }"
                    />
                  </div>
                  <span class="w-9 shrink-0 text-right font-medium text-error"
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

      <!-- Δ winrate -->
      <div class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 p-2">
        <h4 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
          <button
            type="button"
            class="text-base leading-none transition-colors"
            :class="
              cardIsFavorite(favoritePrefix + '.deltaWr')
                ? 'text-amber-300 hover:text-amber-200'
                : 'text-text/45 grayscale hover:text-text/75'
            "
            @click="
              toggleFavorite(
                favoritePrefix + '.deltaWr',
                sectionTitle + ' — ' + t('statisticsPage.itemsCardDeltaWinrate')
              )
            "
          >
            {{ cardIsFavorite(favoritePrefix + '.deltaWr') ? '★' : '☆' }}
          </button>
          <span class="flex min-w-0 flex-1 flex-wrap gap-1">
            {{
              t('statisticsPage.itemsCardDeltaWinrate', {
                version: refVersionLabel || '—',
              })
            }}
          </span>
        </h4>
        <div v-if="baselinePending" class="py-2 text-center text-xs text-text/60">
          {{ t('statisticsPage.loading') }}
        </div>
        <table v-else-if="hasBaseline && deltaWrUp.length" class="fast-stat-table w-full text-xs">
          <tbody>
            <tr v-for="(row, idx) in deltaWrUp" :key="'dw-' + row.itemId" class="fast-stat-row">
              <td class="py-0.5 align-middle">
                <div class="flex items-center gap-0.5">
                  <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                  <img
                    v-if="gameVersion && itemImageName(row.itemId)"
                    :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                    :alt="itemName(row.itemId) || ''"
                    class="h-5 w-5 shrink-0 rounded object-cover"
                  />
                  <div class="min-w-0 max-w-[5.5rem] shrink-0">
                    <div class="truncate font-medium leading-tight text-text">
                      {{ itemName(row.itemId) || row.itemId }}
                    </div>
                    <div class="whitespace-nowrap text-[9px] tabular-nums text-text/70">
                      {{ Number(row.winrate).toFixed(1) }}% WR
                    </div>
                  </div>
                  <div
                    class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                  >
                    <div
                      class="h-full rounded bg-success transition-[width]"
                      :style="{ width: deltaWrBarWidth(row, deltaWrUp) }"
                    />
                  </div>
                  <span class="w-10 shrink-0 text-right font-medium text-success"
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

      <!-- Δ pickrate -->
      <div class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 p-2">
        <h4 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
          <button
            type="button"
            class="text-base leading-none transition-colors"
            :class="
              cardIsFavorite(favoritePrefix + '.deltaPick')
                ? 'text-amber-300 hover:text-amber-200'
                : 'text-text/45 grayscale hover:text-text/75'
            "
            @click="
              toggleFavorite(
                favoritePrefix + '.deltaPick',
                sectionTitle + ' — ' + t('statisticsPage.itemsCardDeltaPickrate')
              )
            "
          >
            {{ cardIsFavorite(favoritePrefix + '.deltaPick') ? '★' : '☆' }}
          </button>
          <span class="flex min-w-0 flex-1 flex-wrap gap-1">
            {{
              t('statisticsPage.itemsCardDeltaPickrate', {
                version: refVersionLabel || '—',
              })
            }}
          </span>
        </h4>
        <div v-if="baselinePending" class="py-2 text-center text-xs text-text/60">
          {{ t('statisticsPage.loading') }}
        </div>
        <table v-else-if="hasBaseline && deltaPickUp.length" class="fast-stat-table w-full text-xs">
          <tbody>
            <tr v-for="(row, idx) in deltaPickUp" :key="'dp-' + row.itemId" class="fast-stat-row">
              <td class="py-0.5 align-middle">
                <div class="flex items-center gap-0.5">
                  <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                  <img
                    v-if="gameVersion && itemImageName(row.itemId)"
                    :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                    :alt="itemName(row.itemId) || ''"
                    class="h-5 w-5 shrink-0 rounded object-cover"
                  />
                  <div class="min-w-0 max-w-[5.5rem] shrink-0">
                    <div class="truncate font-medium leading-tight text-text">
                      {{ itemName(row.itemId) || row.itemId }}
                    </div>
                    <div class="whitespace-nowrap text-[9px] tabular-nums text-text/70">
                      {{ Number(row.pickrate).toFixed(1) }}% pick
                    </div>
                  </div>
                  <div
                    class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                  >
                    <div
                      class="h-full rounded bg-accent transition-[width]"
                      :style="{ width: deltaPickBarWidth(row, deltaPickUp) }"
                    />
                  </div>
                  <span class="w-10 shrink-0 text-right font-medium text-accent"
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
    </div>
  </section>
</template>
