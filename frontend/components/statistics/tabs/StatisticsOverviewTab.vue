<script setup lang="ts">
import { computed, ref } from 'vue'
import { overviewKeyFigures } from '~/utils/statistics/overviewKeyFigures'
import { TREND_METRICS, trendRows, type TrendMetric } from '~/utils/statistics/overviewTrends'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import type { FastStatChampionEntry } from '~/components/statistics/FastStatChampionRowList.vue'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

const keyFigures = computed(() =>
  overviewKeyFigures({
    total: p.overviewMatchOutcomeTotal,
    surrenderOnly: p.overviewSurrenderOnlyCount,
    early: p.overviewEarlySurrenderCount,
    topBan: asChampionRows(p.overviewEffectiveTopBanrateChampions),
    topWinrateRise: asChampionRows(p.overviewTopWinrateSince),
  })
)

const trendMetric = ref<TrendMetric>('winrate')
const trendCols = computed(() => {
  const m = trendMetric.value
  const src = {
    winrate: [p.overviewTopWinrateSince, p.overviewBottomWinrateSince],
    pickrate: [p.overviewTopPickrateSince, p.overviewBottomPickrateSince],
    banrate: [p.overviewTopBanrateSince, p.overviewBottomBanrateSince],
  }[m]
  const r = trendRows(m, asChampionRows(src[0]), asChampionRows(src[1]))
  return [
    { key: 'ups' as const, rows: r.ups },
    { key: 'downs' as const, rows: r.downs },
  ]
})

function asChampionRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? rows : []
}

function pickrateEntries(
  list: Array<{ championId: number; pickrate: number }>
): FastStatChampionEntry[] {
  return list.map(row => ({
    championId: row.championId,
    value: `${Number(row.pickrate).toFixed(2)}%`,
  }))
}

function winrateEntries(
  list: Array<{ championId: number; winrate: number }>
): FastStatChampionEntry[] {
  return list.map(row => ({
    championId: row.championId,
    value: `${Number(row.winrate).toFixed(2)}%`,
  }))
}

function banrateEntries(
  list: Array<{ championId: number; banRatePercent?: string; banrate?: number }>
): FastStatChampionEntry[] {
  return list.map(row => {
    const pct =
      typeof row.banRatePercent === 'string'
        ? parseFloat(row.banRatePercent)
        : Number(row.banrate ?? 0)
    return {
      championId: row.championId,
      value: `${Number.isFinite(pct) ? pct.toFixed(2) : '0.00'}%`,
    }
  })
}

function totalBansTop20(
  data: { bans?: { top20Total?: Array<{ count?: number }> } } | null | undefined
): number {
  return (data?.bans?.top20Total ?? []).reduce((s, r) => s + Number(r.count ?? 0), 0)
}

function banSharePercent(count: number, totalBans: number): number {
  if (totalBans <= 0) return 0
  return Math.round((count / totalBans) * 1000) / 10
}

function parseBanRatePercent(value: string | undefined): number | null {
  if (!value || value === '—') return null
  const n = parseFloat(String(value).replace('%', '').trim())
  return Number.isFinite(n) ? n : null
}

function bansOutcomeDeltaPct(championId: number, outcome: 'win' | 'loss'): number | null {
  const baseline = p.overviewTeamsBaselineData
  if (!baseline) return null

  const currentRows =
    outcome === 'win'
      ? (p.overviewTeamsData?.bans?.byWin ?? [])
      : (p.overviewTeamsData?.bans?.byLoss ?? [])
  const baselineRows =
    outcome === 'win' ? (baseline.bans?.byWin ?? []) : (baseline.bans?.byLoss ?? [])

  const currTotal = totalBansTop20(p.overviewTeamsData)
  const refTotal = totalBansTop20(baseline)
  if (currTotal <= 0 || refTotal <= 0) return null

  const currRow = currentRows.find(
    (row: { championId: number }) => Number(row.championId) === championId
  )
  const refRow = baselineRows.find(
    (row: { championId: number }) => Number(row.championId) === championId
  )

  const currCount = Number(currRow?.count ?? 0)
  const refCount = Number(refRow?.count ?? 0)
  const currPct =
    parseBanRatePercent(currRow?.banRatePercent) ?? banSharePercent(currCount, currTotal)
  const refPct = parseBanRatePercent(refRow?.banRatePercent) ?? banSharePercent(refCount, refTotal)
  return Math.round((currPct - refPct) * 10) / 10
}

function pctDeltaClass(delta: number): string {
  if (delta > 0) return 'text-success'
  if (delta < 0) return 'text-error'
  return 'text-text/60'
}

function bansByOutcomeEntries(
  list: Array<{ championId: number; banRatePercent: string }>,
  outcome: 'win' | 'loss',
  limit: number
): FastStatChampionEntry[] {
  return list.slice(0, limit).map(b => {
    const d = bansOutcomeDeltaPct(b.championId, outcome)
    return {
      championId: b.championId,
      value: b.banRatePercent,
      delta: d != null ? `${d > 0 ? '+' : ''}${d.toFixed(2)}%` : null,
      deltaClass: d != null ? pctDeltaClass(d) : undefined,
    }
  })
}
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-lg">
      <div v-if="p.overviewPending" class="text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div
        v-else-if="p.overviewError"
        class="rounded border border-error/50 bg-error/10 p-4 text-error"
      >
        <p class="mb-2">{{ p.overviewError }}</p>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
          @click="p.loadOverview()"
        >
          {{ p.t('statisticsPage.retry') }}
        </button>
      </div>
      <div v-else-if="p.overviewData" class="space-y-[10px]">
        <ul class="ov-keys" :aria-label="p.t('statisticsPage.overviewKeysAria')">
          <li class="ov-key">
            <span class="ov-key-label">{{ p.t('statisticsPage.overviewKeyGames') }}</span>
            <span class="ov-key-value">{{ keyFigures.games.toLocaleString() }}</span>
          </li>
          <li class="ov-key">
            <span class="ov-key-label">{{ p.t('statisticsPage.overviewKeySurrender') }}</span>
            <span class="ov-key-value">{{
              keyFigures.surrenderPct != null ? `${keyFigures.surrenderPct.toFixed(1)} %` : '—'
            }}</span>
            <span v-if="keyFigures.earlyPct != null" class="ov-key-sub">{{
              p.t('statisticsPage.overviewKeyEarly', { pct: keyFigures.earlyPct.toFixed(1) })
            }}</span>
          </li>
          <li class="ov-key">
            <span class="ov-key-label">{{ p.t('statisticsPage.overviewKeyTopBan') }}</span>
            <span class="ov-key-value">{{
              keyFigures.topBan
                ? (p.championName(keyFigures.topBan.championId) ?? keyFigures.topBan.championId)
                : '—'
            }}</span>
            <span v-if="keyFigures.topBan" class="ov-key-sub"
              >{{ keyFigures.topBan.banrate.toFixed(1) }} % banrate</span
            >
          </li>
          <li class="ov-key">
            <span class="ov-key-label">{{ p.t('statisticsPage.overviewKeyTopRise') }}</span>
            <span class="ov-key-value">{{
              keyFigures.topRise
                ? (p.championName(keyFigures.topRise.championId) ?? keyFigures.topRise.championId)
                : '—'
            }}</span>
            <span v-if="keyFigures.topRise" class="ov-key-sub ov-key-up"
              >▲ +{{ keyFigures.topRise.delta.toFixed(1) }} pts ·
              {{ keyFigures.topRise.winrate.toFixed(1) }} %</span
            >
          </li>
        </ul>
        <!-- Fast Stats : même gabarit que TeamSideFastStatTable -->
        <div
          class="statistics-fast-stat-grid flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[10px] pb-[10px]"
        >
          <!-- Champions les plus choisis -->
          <div class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2">
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.mostPicked')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.mostPicked')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.mostPicked',
                    p.t('statisticsPage.fastStatsMostPicked')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.mostPicked') ? '★' : '☆' }}
              </button>
              <span class="inline-flex min-w-0 flex-1 items-center">
                {{ p.t('statisticsPage.fastStatsMostPicked') }}
                <span
                  class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsMostPicked') }}
                  </span>
                </span>
              </span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="default"
              :entries="pickrateEntries(asChampionRows(p.overviewTopPickrateChampionsFiltered))"
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoData')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div
              v-if="p.overviewTopPickrateChampionsFiltered.length"
              class="mt-1 flex justify-center"
            >
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToTierListWithSort('pickrate')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

          <!-- Meilleurs champions -->
          <div class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2">
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.bestWinrate')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.bestWinrate')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.bestWinrate',
                    p.t('statisticsPage.fastStatsBestWinrate')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.bestWinrate') ? '★' : '☆' }}
              </button>
              <span class="inline-flex flex-1 items-center">
                {{ p.t('statisticsPage.fastStatsBestWinrate') }}
                <span
                  class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsBestWinrate') }}
                  </span>
                </span>
              </span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="default"
              :entries="winrateEntries(asChampionRows(p.overviewEffectiveTopWinrateChampions))"
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoData')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div
              v-if="p.overviewEffectiveTopWinrateChampions.length"
              class="mt-1 flex justify-center"
            >
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToTierListWithSort('winrate')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

          <!-- Champions les plus bannis -->
          <div class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2">
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.mostBanned')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.mostBanned')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.mostBanned',
                    p.t('statisticsPage.fastStatsMostBanned')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.mostBanned') ? '★' : '☆' }}
              </button>
              <span class="inline-flex flex-1 items-center">
                {{ p.t('statisticsPage.fastStatsMostBanned') }}
                <span
                  class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsMostBanned') }}
                  </span>
                </span>
              </span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="default"
              :entries="
                banrateEntries(
                  asChampionRows(p.overviewEffectiveTopBanrateChampions) as Array<{
                    championId: number
                    banrate: number
                  }>
                )
              "
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoData')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div
              v-if="p.overviewEffectiveTopBanrateChampions.length"
              class="mt-1 flex justify-center"
            >
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToBansTab()"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

          <!-- Tendances depuis X : hausse / baisse, onglets métrique -->
          <section class="ov-trends w-full">
            <header class="ov-trends-head">
              <div>
                <h3 class="ov-trends-title">
                  {{
                    p.t('statisticsPage.overviewTrendsTitle', {
                      version: p.progressionFromVersion || '—',
                    })
                  }}
                </h3>
                <span class="ov-trends-sub">{{ p.t('statisticsPage.overviewTrendsSub') }}</span>
              </div>
              <div
                role="tablist"
                class="ov-trends-tabs"
                :aria-label="p.t('statisticsPage.overviewTrendsAria')"
              >
                <button
                  v-for="m in TREND_METRICS"
                  :key="m"
                  type="button"
                  role="tab"
                  class="ov-trends-tab"
                  :class="{ 'is-active': trendMetric === m }"
                  :aria-selected="trendMetric === m"
                  @click="trendMetric = m"
                >
                  {{ p.t(`statisticsPage.overviewTrendsMetric_${m}`) }}
                </button>
              </div>
            </header>
            <div class="ov-trends-cols">
              <div v-for="col in trendCols" :key="col.key" class="ov-trends-col">
                <h4 class="ov-trends-col-title" :class="col.key === 'ups' ? 'is-up' : 'is-down'">
                  {{ col.key === 'ups' ? '▲' : '▼' }}
                  {{ p.t(`statisticsPage.overviewTrends_${col.key}`) }}
                </h4>
                <p v-if="!col.rows.length" class="text-xs text-text/60">
                  {{ p.t('statisticsPage.fastStatsNoProgression') }}
                </p>
                <div v-for="row in col.rows" :key="row.championId" class="ov-trend-row">
                  <StatisticsChampionDetailLink
                    :champion-id="row.championId"
                    class="ov-trend-champ"
                  >
                    <img
                      v-if="p.gameVersion && p.championByKey(row.championId)"
                      loading="lazy"
                      decoding="async"
                      :src="
                        p.getChampionImageUrl(
                          p.gameVersion,
                          p.championByKey(row.championId)!.image.full
                        )
                      "
                      :alt="p.championName(row.championId) || ''"
                      class="h-6 w-6 shrink-0 rounded-full object-cover"
                    />
                    <span class="truncate">{{
                      p.championName(row.championId) || row.championId
                    }}</span>
                  </StatisticsChampionDetailLink>
                  <span class="ov-trend-fromto">
                    {{ row.from.toFixed(1) }} → <strong>{{ row.to.toFixed(1) }}</strong>
                  </span>
                  <div class="ov-trend-bar" :class="col.key === 'ups' ? 'is-up' : 'is-down'">
                    <div class="ov-trend-track">
                      <div class="ov-trend-fill" :style="{ width: `${row.barPct}%` }" />
                    </div>
                    <span class="ov-trend-delta"
                      >{{ row.delta > 0 ? '+' : '−' }}{{ Math.abs(row.delta).toFixed(1) }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Répartition des parties (global uniquement) — donut SVG comme Solo/Duo -->
          <div class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2">
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.matchOutcome')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.matchOutcome')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.matchOutcome',
                    p.t('statisticsPage.overviewMatchOutcomesTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.matchOutcome') ? '★' : '☆' }}
              </button>
              <span class="inline-flex min-w-0 flex-1 items-center">{{
                p.t('statisticsPage.overviewMatchOutcomesTitle')
              }}</span>
            </h3>
            <div
              v-if="p.overviewAbandonsPending || p.overviewPending"
              class="py-3 text-center text-text/60"
            >
              {{ p.t('statisticsPage.loading') }}
            </div>
            <div
              v-else-if="p.overviewMatchOutcomeTotal > 0"
              class="flex flex-col items-center gap-3 sm:flex-row sm:items-center"
            >
              <StatisticsMatchOutcomeDonut
                :total="p.overviewMatchOutcomeTotal"
                :early="p.overviewEarlySurrenderCount"
                :surrender-only="p.overviewSurrenderOnlyCount"
                :played="p.overviewPlayedCount"
              />
              <div class="min-w-0 space-y-1 text-xs">
                <div class="font-medium text-text">
                  Total: {{ p.overviewMatchOutcomeTotal.toLocaleString() }}
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                  &lt;15 min surrender: {{ p.overviewEarlySurrenderCount.toLocaleString() }} ({{
                    p.overviewEarlySurrenderPct.toFixed(2)
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent-light" />
                  Surrender: {{ p.overviewSurrenderOnlyCount.toLocaleString() }} ({{
                    p.overviewSurrenderOnlyPct.toFixed(2)
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-info" />
                  Jouees: {{ p.overviewPlayedCount.toLocaleString() }} ({{
                    p.overviewPlayedPct.toFixed(2)
                  }}%)
                </div>
              </div>
            </div>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.overviewNoData') }}
            </div>
          </div>

          <!-- Bans par équipe gagnante -->
          <div
            v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0"
            class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2"
          >
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.bansByWin')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.bansByWin')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.bansByWin',
                    p.t('statisticsPage.overviewTeamsBansByWin')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.bansByWin') ? '★' : '☆' }}
              </button>
              <span class="inline-flex min-w-0 flex-1 items-center">{{
                p.t('statisticsPage.overviewTeamsBansByWin')
              }}</span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="bans"
              :entries="
                bansByOutcomeEntries(
                  asChampionRows(p.overviewTeamsData.bans.byWin),
                  'win',
                  p.bansExpandByWin ? 20 : 5
                )
              "
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoData')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div
              v-if="(p.overviewTeamsData.bans.byWin ?? []).length"
              class="mt-1 flex justify-center"
            >
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToBansTab()"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

          <!-- Bans par équipe perdante -->
          <div
            v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0"
            class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2"
          >
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.bansByLoss')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.bansByLoss')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.bansByLoss',
                    p.t('statisticsPage.overviewTeamsBansByLoss')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.bansByLoss') ? '★' : '☆' }}
              </button>
              <span class="inline-flex min-w-0 flex-1 items-center">{{
                p.t('statisticsPage.overviewTeamsBansByLoss')
              }}</span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="bans"
              :entries="
                bansByOutcomeEntries(
                  asChampionRows(p.overviewTeamsData.bans.byLoss),
                  'loss',
                  p.bansExpandByLoss ? 20 : 5
                )
              "
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoData')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div
              v-if="(p.overviewTeamsData.bans.byLoss ?? []).length"
              class="mt-1 flex justify-center"
            >
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToBansTab()"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewNoData') }}</div>
    </div>
  </div>
</template>

<style scoped>
.ov-keys {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 6px;
  padding: 0;
  list-style: none;
}
.ov-key {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid rgb(200 155 60 / 0.3);
  border-radius: 8px;
  background: rgb(10 50 60 / 0.35);
}
.ov-key-label {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-grey-50, #a09b8c);
}
.ov-key-value {
  overflow: hidden;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.1;
  color: var(--color-gold-50, #f0e6d2);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ov-key-sub {
  font-size: 0.75rem;
  color: var(--color-grey-50, #a09b8c);
}
.ov-key-up {
  color: var(--color-blue-100, #0ac8b9);
}
@media (max-width: 768px) {
  .ov-keys {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<style scoped>
.ov-trends {
  border: 1px solid rgb(200 155 60 / 0.3);
  border-radius: 8px;
  padding: 12px;
}
.ov-trends-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.ov-trends-title {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-gold-50, #f0e6d2);
}
.ov-trends-sub {
  font-size: 12px;
  color: var(--color-grey-50, #a09b8c);
}
.ov-trends-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: rgb(10 20 40 / 0.6);
}
.ov-trends-tab {
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  color: var(--color-grey-50, #a09b8c);
  font-size: 13px;
}
.ov-trends-tab.is-active {
  background: #0a323c;
  color: var(--color-gold-50, #f0e6d2);
  font-weight: 600;
}
.ov-trends-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}
.ov-trends-col-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ov-trends-col-title.is-up,
.ov-trend-bar.is-up .ov-trend-delta {
  color: var(--color-blue-100, #0ac8b9);
}
.ov-trends-col-title.is-down,
.ov-trend-bar.is-down .ov-trend-delta {
  color: #e2665a;
}
.ov-trend-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(90px, 140px);
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}
.ov-trend-champ {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}
.ov-trend-fromto {
  font-variant-numeric: tabular-nums;
  color: var(--color-grey-50, #a09b8c);
}
.ov-trend-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ov-trend-track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgb(160 155 140 / 0.15);
  overflow: hidden;
}
.ov-trend-fill {
  height: 100%;
  border-radius: 3px;
}
.ov-trend-bar.is-up .ov-trend-fill {
  background: var(--color-blue-100, #0ac8b9);
}
.ov-trend-bar.is-down .ov-trend-fill {
  background: #e2665a;
}
.ov-trend-delta {
  min-width: 3.2em;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
</style>
