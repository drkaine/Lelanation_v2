<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  MatchupsExtRow,
  MatchupsExtSignalLevel,
} from '~/components/statistics/ChampionMatchupMobileCard.vue'
import {
  buildChampionMatchupInsights,
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

const tabOptions = [
  [
    'profile',
    'statisticsPage.championMatchupDetailTabProfile',
    'from-violet-500/20 to-fuchsia-500/10',
  ],
  ['lane', 'statisticsPage.championMatchupDetailTabLane', 'from-sky-500/20 to-cyan-500/10'],
  [
    'gankDiveRoam',
    'statisticsPage.championMatchupDetailTabGankDive',
    'from-rose-500/20 to-orange-500/10',
  ],
  [
    'itemsFirst',
    'statisticsPage.championMatchupDetailTabItems',
    'from-amber-500/20 to-yellow-500/10',
  ],
  [
    'objectivesAndMap',
    'statisticsPage.championMatchupDetailTabObjectives',
    'from-emerald-500/20 to-teal-500/10',
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
  if (v > 0) return 'text-emerald-300'
  if (v < 0) return 'text-rose-300'
  return 'text-text/80'
}

function levelPillClass(level: MatchupsExtSignalLevel, side: 'strength' | 'weakness'): string {
  const base = 'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
  if (side === 'strength') {
    if (level === 'bigAdvantage') return `${base} bg-emerald-500/35 text-emerald-50`
    if (level === 'mediumAdvantage') return `${base} bg-emerald-600/25 text-emerald-100`
    return `${base} bg-emerald-700/20 text-emerald-200`
  }
  if (level === 'bigDisadvantage') return `${base} bg-rose-500/35 text-rose-50`
  if (level === 'mediumDisadvantage') return `${base} bg-rose-600/25 text-rose-100`
  return `${base} bg-orange-600/20 text-orange-100`
}

function insightCardClass(insight: MatchupInsight): string {
  const colors = MATCHUP_CATEGORY_COLORS[insight.category]
  const sideRing = insight.side === 'strength' ? 'ring-emerald-500/25' : 'ring-rose-500/25'
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
    class="champion-matchup-detail-panel overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-[#0a1224] via-[#0b1528] to-[#08101f] shadow-lg shadow-black/30"
  >
    <div
      class="border-b border-primary/20 bg-gradient-to-r from-primary/15 via-violet-500/10 to-cyan-500/10 px-3 py-3 sm:px-4"
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
              :class="
                row.matchupScore >= 0
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'bg-rose-500/15 text-rose-200'
              "
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
          v-if="!insights.strengths.length && !insights.weaknesses.length"
          class="rounded-lg border border-primary/15 bg-white/[0.03] px-3 py-2 text-sm text-text/65"
        >
          {{ t('statisticsPage.championMatchupDetailProfileBalanced') }}
        </div>

        <div v-else class="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div
            class="rounded-lg border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-emerald-900/10 p-2.5"
          >
            <div
              class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300"
            >
              <span class="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
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
            class="rounded-lg border border-rose-500/25 bg-gradient-to-br from-rose-500/10 to-rose-900/10 p-2.5"
          >
            <div
              class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-300"
            >
              <span class="h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />
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
        <div v-if="!detail" class="text-sm text-text/65">
          {{ t('statisticsPage.championMatchupDetailUnavailable') }}
        </div>

        <div v-else-if="tab === 'lane'" class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div
            class="rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-900/5 p-3"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
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
            class="rounded-lg border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-sky-900/5 p-3"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-200">
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
            class="rounded-lg border border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-rose-900/5 p-3 md:col-span-2"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-200">
              {{ t('statisticsPage.championMatchupDetailKillsDeathsVs') }}
            </div>
            <div class="grid grid-cols-3 gap-2 text-center text-sm">
              <div v-for="minute in [5, 10, 15] as const" :key="minute">
                <div class="text-[10px] text-text/50">{{ minute }}m</div>
                <div class="tabular-nums">
                  <span class="font-semibold text-emerald-300">
                    {{
                      minute === 5
                        ? detail.lane.killsVsOpponent5Min.toFixed(2)
                        : minute === 10
                          ? detail.lane.killsVsOpponent10Min.toFixed(2)
                          : detail.lane.killsVsOpponent15Min.toFixed(2)
                    }}
                  </span>
                  <span class="text-text/45"> / </span>
                  <span class="font-semibold text-rose-300">
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
                title: 'text-red-200',
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
                <span class="font-semibold tabular-nums text-emerald-300">{{
                  card.kills.toFixed(2)
                }}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-text/60">{{
                  t('statisticsPage.championMatchupDetailDeathsPerGame')
                }}</span>
                <span class="font-semibold tabular-nums text-rose-300">{{
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
                class="bg-gradient-to-r from-emerald-500 to-emerald-400"
                :style="{ width: `${comparePct(itemCard.you, itemCard.opp).youWidth}%` }"
              />
              <div
                class="bg-gradient-to-r from-rose-400 to-rose-500"
                :style="{ width: `${comparePct(itemCard.you, itemCard.opp).oppWidth}%` }"
              />
            </div>
            <div class="flex justify-between text-sm tabular-nums">
              <span
                :class="
                  itemCard.you >= itemCard.opp ? 'font-semibold text-emerald-300' : 'text-text/70'
                "
              >
                {{ (itemCard.you * 100).toFixed(1) }}%
              </span>
              <span
                :class="
                  itemCard.opp > itemCard.you ? 'font-semibold text-rose-300' : 'text-text/70'
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
                <strong class="text-emerald-300">{{
                  detail.itemsFirst.consumablesBoughtPerGame.toFixed(2)
                }}</strong>
              </span>
              <span>
                {{ t('statisticsPage.championMatchupDetailOpponentShort') }}:
                <strong class="text-rose-300">{{
                  detail.itemsFirst.opponentConsumablesBoughtPerGame.toFixed(2)
                }}</strong>
              </span>
            </div>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div
            class="rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-900/5 p-3"
          >
            <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-200">
              {{ t('statisticsPage.championMatchupDetailDrakes') }}
            </div>
            <div class="text-sm tabular-nums">
              <span class="font-semibold text-emerald-300">{{
                detail.objectivesAndMap.drakeKillsPerGame.toFixed(2)
              }}</span>
              {{ t('statisticsPage.championMatchupDetailKillsPerGame') }} ·
              <span class="font-semibold text-sky-300">{{
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
                <span class="text-emerald-300">{{
                  detail.objectivesAndMap.heraldKillsPerGame.toFixed(2)
                }}</span>
                /
                <span class="text-sky-300">{{
                  detail.objectivesAndMap.heraldAssistsPerGame.toFixed(2)
                }}</span>
              </div>
              <div>
                Void:
                <span class="text-emerald-300">{{
                  detail.objectivesAndMap.voidKillsPerGame.toFixed(2)
                }}</span>
                /
                <span class="text-sky-300">{{
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
                <span class="font-semibold text-emerald-300">
                  {{ (detail.objectivesAndMap.firstTowerRate * 100).toFixed(1) }}%
                </span>
                · {{ t('statisticsPage.championMatchupDetailOpponentShort') }}:
                <span class="font-semibold text-rose-300">
                  {{ (detail.objectivesAndMap.opponentFirstTowerRate * 100).toFixed(1) }}%
                </span>
              </div>
              <div class="text-sm">
                {{ t('statisticsPage.championMatchupDetailPlates') }}:
                <span class="font-semibold text-emerald-300">
                  {{ detail.objectivesAndMap.platesTakenPerGame.toFixed(2) }}
                </span>
                /
                {{ t('statisticsPage.championMatchupDetailPerGame') }} ·
                {{ t('statisticsPage.championMatchupDetailOpponentShort') }}
                <span class="font-semibold text-rose-300">
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
