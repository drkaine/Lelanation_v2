<script setup lang="ts">
import { inject } from 'vue'
import type { FastStatChampionEntry } from '~/components/statistics/FastStatChampionRowList.vue'

const p = inject('statisticsPageCtx') as any

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

function progressionWrEntries(
  list: Array<{ championId: number; wrOldest: number; wrSince: number; deltaWr: number }>
): FastStatChampionEntry[] {
  return list.slice(0, 5).map(row => ({
    championId: row.championId,
    value: `${Number(row.deltaWr) > 0 ? '+' : ''}${Number(row.deltaWr).toFixed(2)}%`,
    valueLabel: `${Number(row.wrOldest).toFixed(1)}% → ${Number(row.wrSince).toFixed(1)}%`,
    deltaClass: pctDeltaClass(Number(row.deltaWr)),
  }))
}

function progressionPickEntries(
  list: Array<{
    championId: number
    pickrateOldest: number
    pickrateSince: number
    deltaPick: number
  }>
): FastStatChampionEntry[] {
  return list.slice(0, 5).map(row => ({
    championId: row.championId,
    value: `${Number(row.deltaPick) > 0 ? '+' : ''}${Number(row.deltaPick).toFixed(2)}%`,
    valueLabel: `${Number(row.pickrateOldest).toFixed(1)}% → ${Number(row.pickrateSince).toFixed(1)}%`,
    deltaClass: pctDeltaClass(Number(row.deltaPick)),
  }))
}

function progressionBanEntries(
  list: Array<{
    championId: number
    banrateOldest: number
    banrateSince: number
    deltaBan: number
  }>
): FastStatChampionEntry[] {
  return list.slice(0, 5).map(row => ({
    championId: row.championId,
    value: `${Number(row.deltaBan) > 0 ? '+' : ''}${Number(row.deltaBan).toFixed(2)}%`,
    valueLabel: `${Number(row.banrateOldest).toFixed(1)}% → ${Number(row.banrateSince).toFixed(1)}%`,
    deltaClass: pctDeltaClass(Number(row.deltaBan)),
  }))
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

          <!-- Winrate depuis X -->
          <div class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2">
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.winrateSince')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.winrateSince')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.winrateSince',
                    p.t('statisticsPage.fastStatsWinrateProgression')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.winrateSince') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>
                  {{
                    p.progressionFromVersion
                      ? p.t('statisticsPage.fastStatsWinrateSince', {
                          version: p.progressionFromVersion ?? undefined,
                        })
                      : p.t('statisticsPage.fastStatsWinrateProgression')
                  }}
                </span>
                <span
                  class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsWinrateSince') }}
                  </span>
                </span>
              </span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="progression"
              :entries="progressionWrEntries(asChampionRows(p.overviewTopWinrateSince))"
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoProgression')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div v-if="p.overviewTopWinrateSince.length" class="mt-1 flex justify-center">
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('blueWinrate')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

          <!-- Pickrate depuis X -->
          <div class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2">
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.pickrateSince')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.pickrateSince')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.pickrateSince',
                    p.t('statisticsPage.fastStatsPickrateSinceTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.pickrateSince') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>{{
                  p.t('statisticsPage.fastStatsPickrateSinceTitle', {
                    version: p.progressionFromVersion || '—',
                  })
                }}</span>
                <span
                  class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsPickrateSince') }}
                  </span>
                </span>
              </span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="progression"
              :entries="progressionPickEntries(asChampionRows(p.overviewTopPickrateSince))"
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoProgression')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div v-if="p.overviewTopPickrateSince.length" class="mt-1 flex justify-center">
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('bluePickrate')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

          <!-- Banrate depuis X -->
          <div class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2">
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.banrateSince')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.banrateSince')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.banrateSince',
                    p.t('statisticsPage.fastStatsBanrateSinceTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.banrateSince') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>{{
                  p.t('statisticsPage.fastStatsBanrateSinceTitle', {
                    version: p.progressionFromVersion || '—',
                  })
                }}</span>
                <span
                  class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsBanrateSince') }}
                  </span>
                </span>
              </span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="progression"
              :entries="progressionBanEntries(asChampionRows(p.overviewTopBanrateSince))"
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoProgression')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div v-if="p.overviewTopBanrateSince.length" class="mt-1 flex justify-center">
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToBansTab()"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

          <!-- Winrate depuis X (baisse) -->
          <div class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2">
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.winrateSinceDown')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.winrateSinceDown')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.winrateSinceDown',
                    p.t('statisticsPage.fastStatsWinrateSinceDownTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.winrateSinceDown') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>{{
                  p.t('statisticsPage.fastStatsWinrateSinceDownTitle', {
                    version: p.progressionFromVersion || '—',
                  })
                }}</span>
                <span
                  class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsWinrateSinceDown') }}
                  </span>
                </span>
              </span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="progression"
              :entries="progressionWrEntries(asChampionRows(p.overviewBottomWinrateSince))"
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoProgression')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div v-if="p.overviewBottomWinrateSince.length" class="mt-1 flex justify-center">
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('blueWinrate', 'asc')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

          <!-- Pickrate depuis X (baisse) -->
          <div class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2">
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.pickrateSinceDown')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.pickrateSinceDown')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.pickrateSinceDown',
                    p.t('statisticsPage.fastStatsPickrateSinceDownTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.pickrateSinceDown') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>{{
                  p.t('statisticsPage.fastStatsPickrateSinceDownTitle', {
                    version: p.progressionFromVersion || '—',
                  })
                }}</span>
                <span
                  class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsPickrateSinceDown') }}
                  </span>
                </span>
              </span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="progression"
              :entries="progressionPickEntries(asChampionRows(p.overviewBottomPickrateSince))"
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoProgression')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div v-if="p.overviewBottomPickrateSince.length" class="mt-1 flex justify-center">
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('bluePickrate', 'asc')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

          <!-- Banrate depuis X (baisse) -->
          <div class="team-side-fast-stat fast-stat-card rounded-lg border border-primary/30 p-2">
            <h3
              class="mb-2 flex items-center justify-between gap-2 text-sm font-semibold leading-snug text-text-accent"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.banrateSinceDown')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.banrateSinceDown')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.banrateSinceDown',
                    p.t('statisticsPage.fastStatsBanrateSinceDownTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.banrateSinceDown') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>{{
                  p.t('statisticsPage.fastStatsBanrateSinceDownTitle', {
                    version: p.progressionFromVersion || '—',
                  })
                }}</span>
                <span
                  class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsBanrateSinceDown') }}
                  </span>
                </span>
              </span>
            </h3>
            <StatisticsFastStatChampionRowList
              variant="progression"
              :entries="progressionBanEntries(asChampionRows(p.overviewBottomBanrateSince))"
              :show-cards="false"
              :no-data-text="p.t('statisticsPage.fastStatsNoProgression')"
              :game-version="p.gameVersion"
              :champion-by-key="p.championByKey"
              :champion-name="p.championName"
              :get-champion-image-url="p.getChampionImageUrl"
              :search-query="p.championSearchQuery"
            />
            <div v-if="p.overviewBottomBanrateSince.length" class="mt-1 flex justify-center">
              <button
                type="button"
                class="rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToBansTab()"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

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
