<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { useStatisticsCustomStore } from '~/stores/StatisticsCustomStore'

const props = withDefaults(
  defineProps<{
    title: string
    /** Texte du ⓘ (même pattern que les fast-stats vue d’ensemble). */
    tooltip?: string
    /** Bordure + teinte des barres : bleu (côté blue) / rouge (côté red). */
    side?: 'blue' | 'red'
    variant: 'pick' | 'wr' | 'ban' | 'dWr' | 'dPick' | 'dBan'
    rows: readonly Record<string, unknown>[]
    /** Id widget statistiques personnalisées (étoile), ex. team.blueMostPicked */
    favoriteCardId?: string
  }>(),
  { tooltip: '', side: undefined, favoriteCardId: '' }
)

const { t } = useI18n()
const statisticsCustomStore = useStatisticsCustomStore()

function cardIsFavorite(cardId: string): boolean {
  return statisticsCustomStore.isFavorite(cardId)
}
function toggleFavoriteCard(cardId: string, title: string): void {
  statisticsCustomStore.toggleFavorite(cardId, title)
}
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
      return Number(row.banrate ?? 0)
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
      return `${Number(row.banrate ?? 0).toFixed(2)}%`
    case 'dWr':
    case 'dPick':
    case 'dBan': {
      const v = Number(metricForRow(row))
      if (!Number.isFinite(v)) return '0.00%'
      const sign = v > 0 ? '+' : v < 0 ? '' : ''
      return `${sign}${v.toFixed(2)}%`
    }
    default:
      return ''
  }
}

const cardBorderClass = computed(() => {
  if (props.side === 'blue') return 'border-[1.5px] border-blue-500/50'
  if (props.side === 'red') return 'border-[1.5px] border-red-500/50'
  return 'border border-primary/30'
})

/** Comme `.fast-stat-title` vue d’ensemble (mb-2), teinte bleu/rouge côté Teams. */
const headingClass = computed(() => {
  const base = 'mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug'
  if (props.side === 'blue') return `${base} text-sky-300`
  if (props.side === 'red') return `${base} text-rose-300`
  return `${base} team-side-fast-stat-title-default`
})

const tooltipTriggerClass = computed(() => {
  if (props.side === 'blue')
    return 'group/stat-tip relative ml-1 inline-flex cursor-help text-sky-400/55'
  if (props.side === 'red')
    return 'group/stat-tip relative ml-1 inline-flex cursor-help text-rose-400/55'
  return 'group/stat-tip relative ml-1 inline-flex cursor-help text-text/50'
})

const barClass = computed(() => {
  if (props.side === 'blue') {
    switch (props.variant) {
      case 'pick':
      case 'dPick':
        return 'bg-sky-400/95'
      case 'wr':
      case 'dWr':
        return 'bg-blue-500/95'
      case 'ban':
      case 'dBan':
        return 'bg-blue-700/90'
      default:
        return 'bg-blue-500/95'
    }
  }
  if (props.side === 'red') {
    switch (props.variant) {
      case 'pick':
      case 'dPick':
        return 'bg-rose-400/95'
      case 'wr':
      case 'dWr':
        return 'bg-red-500/95'
      case 'ban':
      case 'dBan':
        return 'bg-red-700/90'
      default:
        return 'bg-red-500/95'
    }
  }
  switch (props.variant) {
    case 'pick':
    case 'dPick':
      return 'bg-accent'
    case 'wr':
    case 'dWr':
      return 'bg-success'
    case 'ban':
    case 'dBan':
      return 'bg-error'
    default:
      return 'bg-accent'
  }
})

/** Même largeurs que la page stats : w-9 (pick/wr/ban), w-10 (deltas) + couleurs bleu/rouge. */
const valueCellClass = computed(() => {
  const s = 'w-9 shrink-0 text-right font-medium tabular-nums'
  const d = 'w-10 shrink-0 text-right font-medium tabular-nums'
  if (props.variant === 'dWr') {
    if (props.side === 'blue') return `${d} text-sky-300`
    if (props.side === 'red') return `${d} text-rose-300`
    return `${d} text-success`
  }
  if (props.variant === 'dPick') {
    if (props.side === 'blue') return `${d} text-sky-200`
    if (props.side === 'red') return `${d} text-rose-200`
    return `${d} text-accent`
  }
  if (props.variant === 'dBan') {
    if (props.side === 'blue') return `${d} text-blue-200`
    if (props.side === 'red') return `${d} text-red-200`
    return `${d} text-error`
  }
  if (props.variant === 'ban') {
    if (props.side === 'blue') return `${s} text-blue-200`
    if (props.side === 'red') return `${s} text-red-200`
    return `${s} text-text`
  }
  if (props.side === 'blue') return `${s} text-sky-200`
  if (props.side === 'red') return `${s} text-rose-200`
  return `${s} text-text`
})

const topFive = computed(() => props.rows.slice(0, 5))

const isProgression = computed(
  () => props.variant === 'dWr' || props.variant === 'dPick' || props.variant === 'dBan'
)

const barDenom = computed(() => {
  const vals = topFive.value.map(r =>
    isProgression.value ? Math.abs(metricForRow(r)) : metricForRow(r)
  )
  return Math.max(...vals, 0.01)
})

function barWidthPct(row: Record<string, unknown>): number {
  const m = metricForRow(row)
  const prog = isProgression.value
  const base = prog ? Math.abs(m) : m
  const d = barDenom.value
  return Math.min(100, (base / d) * 100)
}

/** Même sous-ligne que la vue d’ensemble (patch réf. → patch filtré). */
function progressionBeforeAfterLine(row: Record<string, unknown>): string {
  switch (props.variant) {
    case 'dWr':
      return `${Number(row.wrOldest ?? 0).toFixed(1)}% → ${Number(row.wrSince ?? 0).toFixed(1)}%`
    case 'dPick':
      return `${Number(row.pickrateOldest ?? 0).toFixed(1)}% → ${Number(row.pickrateSince ?? 0).toFixed(1)}%`
    case 'dBan':
      return `${Number(row.banrateOldest ?? 0).toFixed(1)}% → ${Number(row.banrateSince ?? 0).toFixed(1)}%`
    default:
      return ''
  }
}
</script>

<template>
  <div class="team-side-fast-stat rounded-lg p-2" :class="cardBorderClass">
    <h3 :class="headingClass">
      <button
        v-if="favoriteCardId"
        type="button"
        class="shrink-0 text-base leading-none transition-colors"
        :class="
          cardIsFavorite(favoriteCardId)
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-text/45 grayscale hover:text-text/75'
        "
        :title="
          cardIsFavorite(favoriteCardId)
            ? t('buildDiscovery.removeFavorite')
            : t('buildDiscovery.addFavorite')
        "
        @click="toggleFavoriteCard(favoriteCardId, title)"
      >
        {{ cardIsFavorite(favoriteCardId) ? '★' : '☆' }}
      </button>
      <span class="inline-flex min-w-0 flex-1 items-center">
        {{ title }}
        <span v-if="tooltip" :class="tooltipTriggerClass" aria-hidden="true">
          ⓘ
          <span role="tooltip" class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block">
            {{ tooltip }}
          </span>
        </span>
      </span>
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
              <span v-else class="h-5 w-5 shrink-0" aria-hidden="true" />
              <div v-if="isProgression" class="min-w-0 max-w-[6.5rem] shrink-0">
                <div class="truncate font-medium leading-tight text-text">
                  {{ championName(Number(row.championId)) || row.championId }}
                </div>
                <div class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70">
                  {{ progressionBeforeAfterLine(row) }}
                </div>
              </div>
              <span v-else class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">
                {{ championName(Number(row.championId)) || row.championId }}
              </span>
              <div
                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
              >
                <div
                  class="h-full rounded transition-[width]"
                  :class="barClass"
                  :style="{ width: barWidthPct(row) + '%' }"
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

<style scoped>
/* Même gabarit que `.fast-stat-card` (page stats scoped — non hérité par ce composant). */
.team-side-fast-stat {
  width: 313px !important;
  min-width: 313px;
  max-width: 313px;
  height: 325px;
  min-height: 325px;
  margin-left: auto;
  margin-right: auto;
  flex: 0 0 313px;
  background: #08101f !important;
  justify-self: center;
  overflow: visible;
}
.team-side-fast-stat-title-default {
  line-height: 1.4;
  color: rgb(252 211 77) !important;
}
/* Comme `.fast-stat-table` / `.fast-stat-bar-container` sur la page stats (scoped). */
.team-side-fast-stat .fast-stat-table {
  border-collapse: collapse;
}
.team-side-fast-stat .fast-stat-row {
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.1);
}
.team-side-fast-stat .fast-stat-row:last-child {
  border-bottom: none;
}
.team-side-fast-stat .fast-stat-bar-container {
  flex-shrink: 0;
  min-width: 32px !important;
  max-width: 54px !important;
  margin-right: 5px;
}

/* Même bulle que la page stats (composant isolé, pas de styles scoped parent). */
.fast-stat-tooltip-popover {
  pointer-events: none;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  margin-bottom: 0.35rem;
  min-width: 16rem;
  max-width: min(28rem, calc(100vw - 1.5rem));
  padding: 0.55rem 0.85rem;
  border-radius: 0.375rem;
  border: 1px solid rgb(148 163 184 / 0.45);
  background: rgb(15 23 42);
  color: rgb(241 245 249);
  font-size: 0.75rem;
  line-height: 1.5;
  font-weight: 400;
  text-align: left;
  white-space: normal;
  word-break: break-word;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
}
</style>
