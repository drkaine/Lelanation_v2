<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export type MatchupsExtDominanceKey =
  | 'early'
  | 'laneEconomy'
  | 'kills'
  | 'level'
  | 'cs'
  | 'vision'
  | 'items'
  | 'objectives'
  | 'pressure'

export type MatchupsExtSignalLevel =
  | 'bigAdvantage'
  | 'mediumAdvantage'
  | 'smallAdvantage'
  | 'even'
  | 'smallDisadvantage'
  | 'mediumDisadvantage'
  | 'bigDisadvantage'

export type MatchupsExtRow = {
  rank: number
  opponentChampionId: number
  role: string
  games: number
  wins: number
  winrate: number
  winrateDeltaVsReference?: number | null
  matchupScore: number
  matchupScoreDeltaVsReference?: number | null
  pickrate: number
  pickrateDeltaVsReference?: number | null
  delta1?: number
  delta2?: number
  laneScore: number
  laneScoreDeltaVsReference?: number | null
  dominanceKeys: MatchupsExtDominanceKey[]
  weaknessKeys?: MatchupsExtDominanceKey[]
  laneProfileByKey?: Partial<Record<MatchupsExtDominanceKey, MatchupsExtSignalLevel>>
  matchupDetail?: {
    lane: {
      goldDiff5Min: number
      goldDiff10Min: number
      goldDiff15Min: number
      csDiff5Min: number
      csDiff10Min: number
      csDiff15Min: number
      visionDiff5Min: number
      visionDiff10Min: number
      visionDiff15Min: number
      levelDiff15Min: number
      xpDiff15Min: number
      killsVsOpponent5Min: number
      killsVsOpponent10Min: number
      killsVsOpponent15Min: number
      deathsVsOpponent5Min: number
      deathsVsOpponent10Min: number
      deathsVsOpponent15Min: number
    }
    gankDiveRoam: {
      gankKillsPerGame: number
      gankDeathsPerGame: number
      diveKillsPerGame: number
      diveDeathsPerGame: number
      roamingKillsPerGame: number
      roamingDeathsPerGame: number
    }
    itemsFirst: {
      legendaryFirstRate: number
      opponentLegendaryFirstRate: number
      legendaryFirstAvgTimestampMs: number
      opponentLegendaryFirstAvgTimestampMs: number
      bootsFirstRate: number
      opponentBootsFirstRate: number
      bootsFirstAvgTimestampMs: number
      opponentBootsFirstAvgTimestampMs: number
      bootsTier2FirstRate: number
      opponentBootsTier2FirstRate: number
      bootsTier2FirstAvgTimestampMs: number
      opponentBootsTier2FirstAvgTimestampMs: number
      consumablesBoughtPerGame: number
      opponentConsumablesBoughtPerGame: number
    }
    objectivesAndMap: {
      drakeKillsPerGame: number
      drakeAssistsPerGame: number
      heraldKillsPerGame: number
      heraldAssistsPerGame: number
      voidKillsPerGame: number
      voidAssistsPerGame: number
      firstTowerRate: number
      opponentFirstTowerRate: number
      platesTakenPerGame: number
      opponentPlatesTakenPerGame: number
    }
  }
}

const props = withDefaults(
  defineProps<{
    row: MatchupsExtRow
    displayRank: number
    expanded: boolean
    selected?: boolean
    showRole: boolean
    portraitSrc: string | null
    championName: string
    roleLabel: string
    roleIconSrc: string | null
    referenceVersion?: string | null
    /** Libellé colonne score (matchup ou synergie). */
    scoreColumnLabelKey?: string
    /** Titre section profil de lane / duo. */
    profileSectionLabelKey?: string
    /** Sous-titre forces (champion ou duo). */
    strengthSideLabelKey?: string
    /** Sous-titre vigilance (adversaire ou duo). */
    weaknessSideLabelKey?: string
    /** Contexte des tooltips profil : matchup ou synergie. */
    profileContext?: 'matchup' | 'synergy'
  }>(),
  {
    selected: false,
    referenceVersion: null,
    roleIconSrc: null,
    portraitSrc: null,
    scoreColumnLabelKey: 'statisticsPage.championMatchupColScore',
    profileSectionLabelKey: 'statisticsPage.championMatchupColDominance',
    strengthSideLabelKey: 'statisticsPage.championMatchupProfileChampion',
    weaknessSideLabelKey: 'statisticsPage.championMatchupProfileOpponent',
    profileContext: 'matchup',
  }
)

const emit = defineEmits<{ toggle: [] }>()

const { t } = useI18n()

const patchRefLabel = computed(() => props.referenceVersion?.trim() || null)

const roleSubtitle = computed(() => {
  if (!props.showRole) return null
  return props.roleLabel
})

function formatSignedDelta(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}

function deltaClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'text-text/55'
  if (v > 0) return 'text-emerald-300'
  if (v < 0) return 'text-rose-300'
  return 'text-text/70'
}

function winrateClass(v: number): string {
  if (v >= 52) return 'text-emerald-300'
  if (v <= 48) return 'text-rose-300'
  return 'text-text'
}

function scoreClass(v: number): string {
  if (v > 0.5) return 'text-emerald-300'
  if (v < -0.5) return 'text-rose-300'
  return 'text-text'
}

const laneProfileChipBase =
  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] leading-tight tabular-nums'

function laneProfileSignalChipClass(
  level: MatchupsExtSignalLevel,
  side: 'strength' | 'weakness'
): string {
  if (side === 'strength') {
    if (level === 'bigAdvantage') {
      return `${laneProfileChipBase} border-emerald-400/75 bg-emerald-500/35 font-semibold text-emerald-50`
    }
    if (level === 'mediumAdvantage') {
      return `${laneProfileChipBase} border-emerald-500/55 bg-emerald-500/22 text-emerald-100`
    }
    if (level === 'smallAdvantage') {
      return `${laneProfileChipBase} border-emerald-600/40 bg-emerald-600/12 text-emerald-200`
    }
    return `${laneProfileChipBase} border-primary/30 bg-white/[0.04] text-text/65`
  }
  if (level === 'bigDisadvantage') {
    return `${laneProfileChipBase} border-rose-400/75 bg-rose-500/35 font-semibold text-rose-50`
  }
  if (level === 'mediumDisadvantage') {
    return `${laneProfileChipBase} border-rose-500/55 bg-rose-500/22 text-rose-100`
  }
  if (level === 'smallDisadvantage') {
    return `${laneProfileChipBase} border-orange-500/45 bg-orange-600/14 text-orange-100`
  }
  return `${laneProfileChipBase} border-primary/30 bg-white/[0.04] text-text/65`
}

function laneProfileChipTitle(
  key: MatchupsExtDominanceKey,
  level: MatchupsExtSignalLevel | undefined,
  side: 'strength' | 'weakness'
): string {
  const lvl =
    level ??
    (side === 'strength' ? ('smallAdvantage' as MatchupsExtSignalLevel) : 'smallDisadvantage')
  const who = side === 'strength' ? t(props.strengthSideLabelKey) : t(props.weaknessSideLabelKey)
  return `${who} — ${t(`statisticsPage.championMatchupDominance.${key}`)} (${t(`statisticsPage.championMatchupSignalLevel.${lvl}`)}): ${t(`statisticsPage.championMatchupDominanceDetail.${key}`)}`
}
</script>

<template>
  <article
    class="statistics-champion-stats-mobile-card statistics-champion-matchup-mobile-card w-full overflow-hidden rounded-lg border bg-surface/40"
    :class="selected ? 'border-primary/60 ring-1 ring-primary/35' : 'border-primary/30'"
  >
    <div
      class="statistics-champion-stats-mobile-card-header flex w-full min-w-0 items-center gap-3 p-3"
    >
      <StatisticsChampionStatsMobileCardHeader
        :champion-id="row.opponentChampionId"
        :champion-name="championName"
        :role-label="roleSubtitle"
        :role-icon-src="roleIconSrc"
        :portrait-src="portraitSrc"
        :portrait-alt="championName"
      />
      <button
        type="button"
        class="matchup-card-metrics flex min-w-0 flex-1 touch-manipulation justify-end text-right"
        @click="emit('toggle')"
      >
        <div class="matchup-card-metrics-grid min-w-0">
          <div class="matchup-card-metric min-w-0">
            <div class="matchup-card-metric-label">
              {{ t('statisticsPage.winrate') }}
            </div>
            <div class="matchup-card-metric-value tabular-nums" :class="winrateClass(row.winrate)">
              {{ row.winrate.toFixed(2) }}%
            </div>
            <div
              v-if="patchRefLabel && row.winrateDeltaVsReference != null"
              class="matchup-card-metric-delta tabular-nums"
              :class="deltaClass(row.winrateDeltaVsReference)"
            >
              {{ formatSignedDelta(row.winrateDeltaVsReference) }}
            </div>
          </div>
          <div class="matchup-card-metric min-w-0">
            <div class="matchup-card-metric-label truncate" :title="t(scoreColumnLabelKey)">
              {{ t(scoreColumnLabelKey) }}
            </div>
            <div
              class="matchup-card-metric-value tabular-nums"
              :class="scoreClass(row.matchupScore)"
            >
              {{ row.matchupScore.toFixed(2) }}
            </div>
            <div
              v-if="patchRefLabel && row.matchupScoreDeltaVsReference != null"
              class="matchup-card-metric-delta tabular-nums"
              :class="deltaClass(row.matchupScoreDeltaVsReference)"
            >
              {{ formatSignedDelta(row.matchupScoreDeltaVsReference) }}
            </div>
          </div>
        </div>
      </button>
    </div>
    <div
      v-if="expanded"
      class="space-y-2 border-t border-primary/20 bg-black/20 px-3 py-2.5 text-sm text-text/85"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.tierListRank') }}</span>
        <span class="font-medium tabular-nums">{{ displayRank }}</span>
      </div>
      <div v-if="showRole" class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.filterRole') }}</span>
        <span class="inline-flex items-center gap-1 tabular-nums">
          <img
            v-if="roleIconSrc"
            :src="roleIconSrc"
            :alt="roleLabel"
            class="h-4 w-4 object-contain"
            width="16"
            height="16"
          />
          {{ roleLabel }}
        </span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.championMatchupColPickrate') }}</span>
        <span class="tabular-nums">
          {{ row.pickrate.toFixed(2) }}%
          <span
            v-if="patchRefLabel && row.pickrateDeltaVsReference != null"
            class="ml-1 text-xs"
            :class="deltaClass(row.pickrateDeltaVsReference)"
          >
            {{ formatSignedDelta(row.pickrateDeltaVsReference) }}
          </span>
        </span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.championMatchupColDelta1') }}</span>
        <span class="tabular-nums" :class="deltaClass(row.delta1)">
          {{ formatSignedDelta(row.delta1) }}
        </span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.championMatchupColDelta2') }}</span>
        <span class="tabular-nums" :class="deltaClass(row.delta2)">
          {{ formatSignedDelta(row.delta2) }}
        </span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.championMatchupColLaneScore') }}</span>
        <span class="tabular-nums">
          {{ row.laneScore.toFixed(2) }}
          <span
            v-if="patchRefLabel && row.laneScoreDeltaVsReference != null"
            class="ml-1 text-xs"
            :class="deltaClass(row.laneScoreDeltaVsReference)"
          >
            {{ formatSignedDelta(row.laneScoreDeltaVsReference) }}
          </span>
        </span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2 text-text/75">
        <span>{{ t('statisticsPage.tierListGames') }}</span>
        <span class="tabular-nums">{{ row.games.toLocaleString() }}</span>
      </div>
      <div class="border-t border-primary/15 pt-2">
        <div class="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text/55">
          {{ t(profileSectionLabelKey) }}
        </div>
        <div v-if="row.dominanceKeys?.length" class="mb-2">
          <div
            class="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400"
          >
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
            {{ t(strengthSideLabelKey) }}
          </div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="k in row.dominanceKeys"
              :key="'dom-' + k"
              :class="
                laneProfileSignalChipClass(
                  row.laneProfileByKey?.[k] ?? 'smallAdvantage',
                  'strength'
                )
              "
              :title="laneProfileChipTitle(k, row.laneProfileByKey?.[k], 'strength')"
            >
              <span class="font-semibold">{{
                t(`statisticsPage.championMatchupDominanceShort.${k}`)
              }}</span>
              <span class="opacity-70" aria-hidden="true">·</span>
              <span class="opacity-90">{{
                t(
                  `statisticsPage.championMatchupSignalLevelShort.${row.laneProfileByKey?.[k] ?? 'smallAdvantage'}`
                )
              }}</span>
            </span>
          </div>
        </div>
        <div v-if="row.weaknessKeys?.length">
          <div
            class="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-400"
          >
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden="true" />
            {{ t(weaknessSideLabelKey) }}
          </div>
          <p
            v-if="profileContext === 'synergy'"
            class="mb-1.5 text-[10px] leading-snug text-text/55"
          >
            {{ t('statisticsPage.championSynergyProfileWarningsHint') }}
          </p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="k in row.weaknessKeys"
              :key="'weak-' + k"
              :class="
                laneProfileSignalChipClass(
                  row.laneProfileByKey?.[k] ?? 'smallDisadvantage',
                  'weakness'
                )
              "
              :title="laneProfileChipTitle(k, row.laneProfileByKey?.[k], 'weakness')"
            >
              <span class="font-semibold">{{
                t(`statisticsPage.championMatchupDominanceShort.${k}`)
              }}</span>
              <span class="opacity-70" aria-hidden="true">·</span>
              <span class="opacity-90">{{
                t(
                  `statisticsPage.championMatchupSignalLevelShort.${row.laneProfileByKey?.[k] ?? 'smallDisadvantage'}`
                )
              }}</span>
            </span>
          </div>
        </div>
        <div
          v-if="!row.dominanceKeys?.length && !row.weaknessKeys?.length"
          class="text-xs text-text/65"
        >
          {{ t('statisticsPage.championMatchupDominanceBalancedShort') }}
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.matchup-card-metrics-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.35rem 0.5rem;
  width: 100%;
  max-width: 9.5rem;
}

.matchup-card-metric-label {
  font-size: 9px;
  font-weight: 600;
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(var(--rgb-text) / 0.55);
}

.matchup-card-metric-value {
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.15;
}

.matchup-card-metric-delta {
  margin-top: 1px;
  font-size: 10px;
  line-height: 1.1;
}
</style>
