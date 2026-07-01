<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  MatchupsExtRow,
  MatchupsExtSignalLevel,
} from '~/components/statistics/ChampionMatchupMobileCard.vue'
import {
  buildChampionMatchupInsights,
  hasUsableMatchupDetailMetrics,
  MATCHUP_CATEGORY_COLORS,
  type MatchupInsight,
} from '~/utils/championMatchupInsights'

export type MatchupDetailTabId =
  | 'profile'
  | 'lane'
  | 'gankDiveRoam'
  | 'itemsFirst'
  | 'objectivesAndMap'

const props = defineProps<{
  row: MatchupsExtRow
  championLabel: string
  roleLabel: string
}>()

const tab = defineModel<MatchupDetailTabId>('tab', { required: true })

const { t } = useI18n()

const detail = computed(() => props.row.matchupDetail)
const insights = computed(() => buildChampionMatchupInsights(props.row))
const hasLaneMetricData = computed(() => hasUsableMatchupDetailMetrics(detail.value))
const showProfileBalanced = computed(
  () =>
    !insights.value.strengths.length && !insights.value.weaknesses.length && hasLaneMetricData.value
)
const showProfileNoTimeline = computed(
  () =>
    !insights.value.strengths.length &&
    !insights.value.weaknesses.length &&
    !hasLaneMetricData.value
)

const tabOptions = [
  [
    'profile',
    'statisticsPage.championMatchupDetailTabProfile',
    'from-violet-500/20 to-fuchsia-500/10',
  ],
  ['lane', 'statisticsPage.championMatchupDetailTabLane', 'from-info/20 to-info/10'],
  ['gankDiveRoam', 'statisticsPage.championMatchupDetailTabGankDive', 'from-error/20 to-error/10'],
  ['itemsFirst', 'statisticsPage.championMatchupDetailTabItems', 'from-accent/20 to-accent/10'],
  [
    'objectivesAndMap',
    'statisticsPage.championMatchupDetailTabObjectives',
    'from-info/20 to-info/10',
  ],
] as const

function formatSignedInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const rounded = Math.round(v)
  return `${rounded > 0 ? '+' : ''}${rounded.toString()}`
}

function formatGameMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—'
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

function signedClass(v: number): string {
  if (v > 0) return 'text-info'
  if (v < 0) return 'text-error/70'
  return 'text-text/80'
}

function levelPillClass(level: MatchupsExtSignalLevel, side: 'strength' | 'weakness'): string {
  const base = 'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
  if (side === 'strength') {
    if (level === 'bigAdvantage') return `${base} bg-info/35 text-primary-light`
    if (level === 'mediumAdvantage') return `${base} bg-info/25 text-primary-light`
    return `${base} bg-info/20 text-info`
  }
  if (level === 'bigDisadvantage') return `${base} bg-error/35 text-error/90`
  if (level === 'mediumDisadvantage') return `${base} bg-error/25 text-error/80`
  return `${base} bg-orange-600/20 text-orange-100`
}

function insightCardClass(insight: MatchupInsight): string {
  const colors = MATCHUP_CATEGORY_COLORS[insight.category]
  const sideRing = insight.side === 'strength' ? 'ring-info/25' : 'ring-error/25'
  return `rounded-lg border ${colors.border} ${colors.bg} p-2.5 ring-1 ${sideRing}`
}

function categoryLabel(insight: MatchupInsight): string {
  const key = insight.category
  if (key === 'goldHoard') {
    return t(`statisticsPage.championMatchupInsight.category.${key}`)
  }
  return t(`statisticsPage.championMatchupDominanceShort.${key}`)
}

function comparePct(you: number, opp: number): { youWidth: number; oppWidth: number } {
  const total = Math.max(you + opp, 0.001)
  return {
    youWidth: Math.round((you / total) * 100),
    oppWidth: Math.round((opp / total) * 100),
  }
}
</script>

<template>
  <div
    class="champion-matchup-detail-panel overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-background via-panel to-chrome shadow-lg shadow-black/30"
  >
    <div
      class="border-b border-primary/20 bg-gradient-to-r from-primary/15 via-info/10 to-info/5 px-3 py-3 sm:px-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-base font-semibold text-text">
            {{ championLabel }}
            <span class="font-normal text-text/65">· {{ roleLabel }}</span>
          </div>
          <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text/60">
            <span>{{ t('statisticsPage.championMatchupDetailGames', { count: row.games }) }}</span>
            <span class="rounded-full bg-white/5 px-2 py-0.5 tabular-nums text-text/75">
              WR {{ row.winrate.toFixed(1) }}%
            </span>
            <span
              class="rounded-full px-2 py-0.5 tabular-nums"
              :class="row.matchupScore >= 0 ? 'bg-info/15 text-info' : 'bg-error/15 text-error/80'"
            >
              {{ t('statisticsPage.championMatchupColScore') }} {{ row.matchupScore.toFixed(2) }}
            </span>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="tabOption in tabOptions"
            :key="tabOption[0]"
            type="button"
            :class="[
              'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
              tab === tabOption[0]
                ? `border-primary/50 bg-gradient-to-br ${tabOption[2]} text-text shadow-sm`
                : 'border-primary/15 bg-black/20 text-text/60 hover:border-primary/30 hover:text-text/85',
            ]"
            @click.stop="tab = tabOption[0]"
          >
            {{ t(tabOption[1]) }}
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-3 p-3 sm:p-4">
      <section v-if="tab === 'profile'" class="rounded-xl border border-primary/20 bg-black/25 p-3">
        <div class="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h4 class="text-sm font-semibold text-text">
              {{ t('statisticsPage.championMatchupDetailProfileTitle') }}
            </h4>
            <p class="text-[11px] leading-snug text-text/55">
              {{ t('statisticsPage.championMatchupDetailProfileHint') }}
            </p>
          </div>
        </div>

        <div
          v-if="showProfileBalanced"
          class="rounded-lg border border-primary/15 bg-white/[0.03] px-3 py-2 text-sm text-text/65"
        >
          {{ t('statisticsPage.championMatchupDetailProfileBalanced') }}
        </div>

        <div
          v-else-if="showProfileNoTimeline"
          class="rounded-lg border border-primary/15 bg-white/[0.03] px-3 py-2 text-sm text-text/65"
        >
          {{ t('statisticsPage.championMatchupDetailProfileNoTimeline') }}
        </div>

        <div v-else class="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div
            class="rounded-lg border border-info/25 bg-gradient-to-br from-info/10 to-background/40 p-2.5"
          >
            <div
              class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-info"
            >
              <span class="h-2 w-2 rounded-full bg-info" aria-hidden="true" />
              {{ t('statisticsPage.championMatchupProfileStrengths') }}
            </div>
            <div v-if="!insights.strengths.length" class="text-xs text-text/55">—</div>
            <ul v-else class="space-y-2">
              <li
                v-for="insight in insights.strengths"
                :key="insight.id"
                :class="insightCardClass(insight)"
              >
                <div class="mb-1 flex flex-wrap items-center justify-between gap-1">
                  <span
                    class="inline-flex items-center gap-1.5 text-xs font-semibold"
                    :class="MATCHUP_CATEGORY_COLORS[insight.category].text"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      :class="MATCHUP_CATEGORY_COLORS[insight.category].dot"
                      aria-hidden="true"
                    />
                    {{ categoryLabel(insight) }}
                  </span>
                  <span :class="levelPillClass(insight.level, 'strength')">
                    {{ t(`statisticsPage.championMatchupSignalLevelShort.${insight.level}`) }}
                  </span>
                </div>
                <div class="text-sm font-medium text-text/95">
                  {{ t(insight.titleKey, insight.params) }}
                </div>
                <div class="mt-0.5 text-[11px] leading-snug text-text/65">
                  {{ t(insight.detailKey, insight.params) }}
                </div>
              </li>
            </ul>
          </div>

          <div
            class="rounded-lg border border-error/25 bg-gradient-to-br from-error/10 to-background/40 p-2.5"
          >
            <div
              class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-error/70"
            >
              <span class="h-2 w-2 rounded-full bg-error" aria-hidden="true" />
              {{ t('statisticsPage.championMatchupProfileWarnings') }}
            </div>
            <div v-if="!insights.weaknesses.length" class="text-xs text-text/55">—</div>
            <ul v-else class="space-y-2">
              <li
                v-for="insight in insights.weaknesses"
                :key="insight.id"
                :class="insightCardClass(insight)"
              >
                <div class="mb-1 flex flex-wrap items-center justify-between gap-1">
                  <span
                    class="inline-flex items-center gap-1.5 text-xs font-semibold"
                    :class="MATCHUP_CATEGORY_COLORS[insight.category].text"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      :class="MATCHUP_CATEGORY_COLORS[insight.category].dot"
                      aria-hidden="true"
                    />
                    {{ categoryLabel(insight) }}
                  </span>
                  <span :class="levelPillClass(insight.level, 'weakness')">
                    {{ t(`statisticsPage.championMatchupSignalLevelShort.${insight.level}`) }}
                  </span>
                </div>
                <div class="text-sm font-medium text-text/95">
                  {{ t(insight.titleKey, insight.params) }}
                </div>
                <div class="mt-0.5 text-[11px] leading-snug text-text/65">
                  {{ t(insight.detailKey, insight.params) }}
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <template v-else>
        <div
          v-if="detail && !hasLaneMetricData"
          class="rounded-lg border border-primary/15 bg-white/[0.03] px-3 py-2 text-sm text-text/65"
        >
          {{ t('statisticsPage.championMatchupDetailTimelineEmpty') }}
        </div>

        <div v-if="!detail" class="text-sm text-text/65">
          {{ t('statisticsPage.championMatchupDetailUnavailable') }}
        </div>

        <div v-else-if="tab === 'lane'" class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div
            class="rounded-lg border border-accent/30 bg-gradient-to-br from-accent/10 to-background/40 p-3"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-light">
              {{ t('statisticsPage.championMatchupDetailGoldDiff') }}
            </div>
            <div class="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div class="text-[10px] text-text/50">5m</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.goldDiff5Min)"
                >
                  {{ formatSignedInt(detail.lane.goldDiff5Min) }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-text/50">10m</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.goldDiff10Min)"
                >
                  {{ formatSignedInt(detail.lane.goldDiff10Min) }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-text/50">15m</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.goldDiff15Min)"
                >
                  {{ formatSignedInt(detail.lane.goldDiff15Min) }}
                </div>
              </div>
            </div>
          </div>

          <div
            class="rounded-lg border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-orange-900/5 p-3"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-200">
              {{ t('statisticsPage.championMatchupDetailCsDiff') }}
            </div>
            <div class="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div class="text-[10px] text-text/50">5m</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.csDiff5Min)"
                >
                  {{ formatSignedInt(detail.lane.csDiff5Min) }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-text/50">10m</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.csDiff10Min)"
                >
                  {{ formatSignedInt(detail.lane.csDiff10Min) }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-text/50">15m</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.csDiff15Min)"
                >
                  {{ formatSignedInt(detail.lane.csDiff15Min) }}
                </div>
              </div>
            </div>
          </div>

          <div
            class="rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-violet-900/5 p-3"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-200">
              {{ t('statisticsPage.championMatchupDetailVisionDiff') }}
            </div>
            <div class="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div class="text-[10px] text-text/50">5m</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.visionDiff5Min)"
                >
                  {{ formatSignedInt(detail.lane.visionDiff5Min) }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-text/50">10m</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.visionDiff10Min)"
                >
                  {{ formatSignedInt(detail.lane.visionDiff10Min) }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-text/50">15m</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.visionDiff15Min)"
                >
                  {{ formatSignedInt(detail.lane.visionDiff15Min) }}
                </div>
              </div>
            </div>
          </div>

          <div
            class="rounded-lg border border-info/30 bg-gradient-to-br from-info/10 to-background/40 p-3"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-light">
              {{ t('statisticsPage.championMatchupDetailLevelXp') }}
            </div>
            <div class="flex items-baseline justify-center gap-4 text-sm">
              <div class="text-center">
                <div class="text-[10px] text-text/50">15m lvl</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.levelDiff15Min)"
                >
                  {{ formatSignedInt(detail.lane.levelDiff15Min) }}
                </div>
              </div>
              <div class="text-center">
                <div class="text-[10px] text-text/50">15m XP</div>
                <div
                  class="font-semibold tabular-nums"
                  :class="signedClass(detail.lane.xpDiff15Min)"
                >
                  {{ formatSignedInt(detail.lane.xpDiff15Min) }}
                </div>
              </div>
            </div>
          </div>

          <div
            class="rounded-lg border border-error/30 bg-gradient-to-br from-error/10 to-background/40 p-3 md:col-span-2"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-error/80">
              {{ t('statisticsPage.championMatchupDetailKillsDeathsVs') }}
            </div>
            <div class="grid grid-cols-3 gap-2 text-center text-sm">
              <div v-for="minute in [5, 10, 15] as const" :key="minute">
                <div class="text-[10px] text-text/50">{{ minute }}m</div>
                <div class="tabular-nums">
                  <span class="font-semibold text-info">
                    {{
                      minute === 5
                        ? detail.lane.killsVsOpponent5Min.toFixed(2)
                        : minute === 10
                          ? detail.lane.killsVsOpponent10Min.toFixed(2)
                          : detail.lane.killsVsOpponent15Min.toFixed(2)
                    }}
                  </span>
                  <span class="text-text/45"> / </span>
                  <span class="font-semibold text-error/70">
                    {{
                      minute === 5
                        ? detail.lane.deathsVsOpponent5Min.toFixed(2)
                        : minute === 10
                          ? detail.lane.deathsVsOpponent10Min.toFixed(2)
                          : detail.lane.deathsVsOpponent15Min.toFixed(2)
                    }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="tab === 'gankDiveRoam'" class="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div
            v-for="card in [
              {
                key: 'gank',
                label: t('statisticsPage.championMatchupDetailGanks'),
                kills: detail.gankDiveRoam.gankKillsPerGame,
                deaths: detail.gankDiveRoam.gankDeathsPerGame,
                border: 'border-pink-500/35',
                bg: 'from-pink-500/12 to-pink-900/5',
                title: 'text-pink-200',
              },
              {
                key: 'dive',
                label: t('statisticsPage.championMatchupDetailDives'),
                kills: detail.gankDiveRoam.diveKillsPerGame,
                deaths: detail.gankDiveRoam.diveDeathsPerGame,
                border: 'border-red-500/35',
                bg: 'from-red-500/12 to-red-900/5',
                title: 'text-error/80',
              },
              {
                key: 'roam',
                label: t('statisticsPage.championMatchupDetailRoams'),
                kills: detail.gankDiveRoam.roamingKillsPerGame,
                deaths: detail.gankDiveRoam.roamingDeathsPerGame,
                border: 'border-indigo-500/35',
                bg: 'from-indigo-500/12 to-indigo-900/5',
                title: 'text-indigo-200',
              },
            ]"
            :key="card.key"
            :class="`rounded-lg border ${card.border} bg-gradient-to-br ${card.bg} p-3`"
          >
            <div :class="`mb-2 text-xs font-semibold uppercase tracking-wide ${card.title}`">
              {{ card.label }}
            </div>
            <div class="space-y-1 text-sm">
              <div class="flex items-center justify-between gap-2">
                <span class="text-text/60">{{
                  t('statisticsPage.championMatchupDetailKillsPerGame')
                }}</span>
                <span class="font-semibold tabular-nums text-info">{{
                  card.kills.toFixed(2)
                }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-text/60">{{
                  t('statisticsPage.championMatchupDetailDeathsPerGame')
                }}</span>
                <span class="font-semibold tabular-nums text-error/70">{{
                  card.deaths.toFixed(2)
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="tab === 'itemsFirst'" class="space-y-2">
          <div
            v-for="itemCard in [
              {
                key: 'legendary',
                label: t('statisticsPage.championMatchupDetailLegendaryFirst'),
                you: detail.itemsFirst.legendaryFirstRate,
                opp: detail.itemsFirst.opponentLegendaryFirstRate,
                youTs: detail.itemsFirst.legendaryFirstAvgTimestampMs,
                oppTs: detail.itemsFirst.opponentLegendaryFirstAvgTimestampMs,
                color: 'cyan',
              },
              {
                key: 'boots',
                label: t('statisticsPage.championMatchupDetailBootsFirst'),
                you: detail.itemsFirst.bootsFirstRate,
                opp: detail.itemsFirst.opponentBootsFirstRate,
                youTs: detail.itemsFirst.bootsFirstAvgTimestampMs,
                oppTs: detail.itemsFirst.opponentBootsFirstAvgTimestampMs,
                color: 'amber',
              },
              {
                key: 'bootsT2',
                label: t('statisticsPage.championMatchupDetailBootsTier2'),
                you: detail.itemsFirst.bootsTier2FirstRate,
                opp: detail.itemsFirst.opponentBootsTier2FirstRate,
                youTs: detail.itemsFirst.bootsTier2FirstAvgTimestampMs,
                oppTs: detail.itemsFirst.opponentBootsTier2FirstAvgTimestampMs,
                color: 'yellow',
              },
            ]"
            :key="itemCard.key"
            class="rounded-lg border border-primary/20 bg-black/20 p-3"
          >
            <div class="mb-2 text-xs font-semibold text-text/80">{{ itemCard.label }}</div>
            <div class="mb-1 flex justify-between text-[10px] text-text/55">
              <span>{{ t('statisticsPage.championMatchupDetailYou') }}</span>
              <span>{{ t('statisticsPage.championMatchupDetailOpponentShort') }}</span>
            </div>
            <div class="mb-1 flex h-2 overflow-hidden rounded-full bg-white/5">
              <div
                class="bg-gradient-to-r from-info to-info/80"
                :style="{ width: `${comparePct(itemCard.you, itemCard.opp).youWidth}%` }"
              />
              <div
                class="bg-gradient-to-r from-error/80 to-error"
                :style="{ width: `${comparePct(itemCard.you, itemCard.opp).oppWidth}%` }"
              />
            </div>
            <div class="flex justify-between text-sm tabular-nums">
              <span
                :class="itemCard.you >= itemCard.opp ? 'font-semibold text-info' : 'text-text/70'"
              >
                {{ (itemCard.you * 100).toFixed(1) }}%
              </span>
              <span
                :class="
                  itemCard.opp > itemCard.you ? 'font-semibold text-error/70' : 'text-text/70'
                "
              >
                {{ (itemCard.opp * 100).toFixed(1) }}%
              </span>
            </div>
            <div class="mt-1 text-[11px] text-text/55">
              {{ t('statisticsPage.championMatchupDetailAvgTimestamp') }}:
              {{ formatGameMs(itemCard.youTs) }} · {{ formatGameMs(itemCard.oppTs) }}
            </div>
          </div>

          <div
            class="rounded-lg border border-teal-500/30 bg-gradient-to-br from-teal-500/10 to-teal-900/5 p-3"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-200">
              {{ t('statisticsPage.championMatchupDetailConsumables') }}
            </div>
            <div class="flex justify-between text-sm tabular-nums">
              <span>
                {{ t('statisticsPage.championMatchupDetailYou') }}:
                <strong class="text-info">{{
                  detail.itemsFirst.consumablesBoughtPerGame.toFixed(2)
                }}</strong>
              </span>
              <span>
                {{ t('statisticsPage.championMatchupDetailOpponentShort') }}:
                <strong class="text-error/70">{{
                  detail.itemsFirst.opponentConsumablesBoughtPerGame.toFixed(2)
                }}</strong>
              </span>
            </div>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div
            class="rounded-lg border border-info/30 bg-gradient-to-br from-info/10 to-background/40 p-3"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-info">
              {{ t('statisticsPage.championMatchupDetailDrakes') }}
            </div>
            <div class="text-sm tabular-nums">
              <span class="font-semibold text-info">{{
                detail.objectivesAndMap.drakeKillsPerGame.toFixed(2)
              }}</span>
              {{ t('statisticsPage.championMatchupDetailKillsPerGame') }} ·
              <span class="font-semibold text-info">{{
                detail.objectivesAndMap.drakeAssistsPerGame.toFixed(2)
              }}</span>
              {{ t('statisticsPage.championMatchupDetailAssistsPerGame') }}
            </div>
          </div>
          <div
            class="rounded-lg border border-lime-500/30 bg-gradient-to-br from-lime-500/10 to-lime-900/5 p-3"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-lime-200">
              {{ t('statisticsPage.championMatchupDetailHeraldVoid') }}
            </div>
            <div class="space-y-1 text-sm tabular-nums">
              <div>
                Herald:
                <span class="text-info">{{
                  detail.objectivesAndMap.heraldKillsPerGame.toFixed(2)
                }}</span>
                /
                <span class="text-info">{{
                  detail.objectivesAndMap.heraldAssistsPerGame.toFixed(2)
                }}</span>
              </div>
              <div>
                Void:
                <span class="text-info">{{
                  detail.objectivesAndMap.voidKillsPerGame.toFixed(2)
                }}</span>
                /
                <span class="text-info">{{
                  detail.objectivesAndMap.voidAssistsPerGame.toFixed(2)
                }}</span>
              </div>
            </div>
          </div>
          <div
            class="rounded-lg border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-fuchsia-900/5 p-3 md:col-span-2"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
              {{ t('statisticsPage.championMatchupDetailTowers') }}
            </div>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div class="text-sm">
                {{ t('statisticsPage.championMatchupDetailFirstTower') }}:
                <span class="font-semibold text-info">
                  {{ (detail.objectivesAndMap.firstTowerRate * 100).toFixed(1) }}%
                </span>
                · {{ t('statisticsPage.championMatchupDetailOpponentShort') }}:
                <span class="font-semibold text-error/70">
                  {{ (detail.objectivesAndMap.opponentFirstTowerRate * 100).toFixed(1) }}%
                </span>
              </div>
              <div class="text-sm">
                {{ t('statisticsPage.championMatchupDetailPlates') }}:
                <span class="font-semibold text-info">
                  {{ detail.objectivesAndMap.platesTakenPerGame.toFixed(2) }}
                </span>
                /
                {{ t('statisticsPage.championMatchupDetailPerGame') }} ·
                {{ t('statisticsPage.championMatchupDetailOpponentShort') }}
                <span class="font-semibold text-error/70">
                  {{ detail.objectivesAndMap.opponentPlatesTakenPerGame.toFixed(2) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
