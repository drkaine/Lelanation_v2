import { inject } from 'vue'
import type { RunesDetailPayload, SpellsDetailPayload } from '~/types/statisticsIndexPage'
import type StatisticsIndexPage from '~/components/statistics/pages/StatisticsIndexPage.vue'
import type StatisticsTierListPage from '~/pages/statistics/tier-list.vue'
import type StatisticsMetaChartPage from '~/pages/statistics/meta-chart.vue'

/**
 * Statistics pages expose their setup state to tab components through a Proxy
 * (`provide('statisticsPageCtx', …)`) that unwraps refs one level.
 * Each consumer declares the slice it reads as a typed interface.
 */
export const STATISTICS_PAGE_CTX_KEY = 'statisticsPageCtx'

export type StatisticsT = (key: string, named?: Record<string, unknown>) => string

export function injectStatisticsPageCtx<T extends object>(): T {
  const ctx = inject<T | null>(STATISTICS_PAGE_CTX_KEY, null)
  if (!ctx) throw new Error('statisticsPageCtx is not provided')
  return ctx
}

/** Exact context provided by the statistics index page (derived from its exposed `statisticsPageCtx`). */
export type StatisticsIndexPageCtx = InstanceType<typeof StatisticsIndexPage>['statisticsPageCtx']

/** Exact context provided by the tier list page (pages/statistics/tier-list.vue). */
export type StatisticsTierListPageCtx = InstanceType<
  typeof StatisticsTierListPage
>['statisticsPageCtx']

/** Fields `K` as provided by either the index page or the tier list page (components mounted on both). */
export type IndexOrTierListCtx<
  K extends keyof StatisticsIndexPageCtx & keyof StatisticsTierListPageCtx,
> = Pick<StatisticsIndexPageCtx, K> | Pick<StatisticsTierListPageCtx, K>

/** Exact context provided by the meta chart page (pages/statistics/meta-chart.vue). */
export type StatisticsMetaChartPageCtx = InstanceType<
  typeof StatisticsMetaChartPage
>['statisticsPageCtx']

/** Fields `K` as provided by either the tier list page or the meta chart page. */
export type TierListOrMetaChartCtx<
  K extends keyof StatisticsTierListPageCtx & keyof StatisticsMetaChartPageCtx,
> = Pick<StatisticsTierListPageCtx, K> | Pick<StatisticsMetaChartPageCtx, K>

/**
 * Context of the runes / summoner spells tabs, provided by the index page and by the champion page.
 * The champion page fills `overviewDetail*Data` with the payload of the active tab only (runes or spells).
 */
export type RunesSpellsTabCtx = Pick<
  StatisticsIndexPageCtx,
  | 't'
  | 'gameVersion'
  | 'versionStore'
  | 'spellsModeFilter'
  | 'championSearchQuery'
  | 'PAGE_SIZE_OPTIONS'
  | 'overviewDetailBaselinePending'
  | 'overviewDetailComparisonVersion'
  | 'overviewDetailError'
  | 'overviewDetailPending'
  | 'retryOverviewDetail'
> & {
  overviewDetailData: RunesDetailPayload | SpellsDetailPayload | null
  overviewDetailBaselineData: RunesDetailPayload | SpellsDetailPayload | null
}
