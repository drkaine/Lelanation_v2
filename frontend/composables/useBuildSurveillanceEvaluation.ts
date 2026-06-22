import { useChampionsStore } from '~/stores/ChampionsStore'
import { useStatisticsBuildSurveillanceStore } from '~/stores/StatisticsBuildSurveillanceStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { apiUrl } from '~/utils/apiUrl'
import { championKeyFromRouteParam } from '~/utils/championSlug'
import {
  BUILD_SURVEILLANCE_DISPLAY_LIMIT,
  buildFingerprint,
  buildSurveillanceScopeKey,
  effectiveMaxBuilds,
  effectiveMinGames,
  evaluateBuildSurveillanceAlerts,
  hasConfiguredBuildSurveillanceThresholds,
  isEligibleBuild,
  type BuildMetricSnapshot,
  type BuildRowLike,
  type BuildSurveillanceTrigger,
} from '~/utils/buildSurveillance'

export interface BuildSurveillanceCheckResult {
  watchedCount: number
  evaluatedCount: number
  alertCount: number
  fetchFailedCount: number
  unresolvedCount: number
}

export interface BuildSurveillanceFilterContext {
  rankTiers: readonly string[]
  role: string
  patch: string
}

function emptyResult(): BuildSurveillanceCheckResult {
  return {
    watchedCount: 0,
    evaluatedCount: 0,
    alertCount: 0,
    fetchFailedCount: 0,
    unresolvedCount: 0,
  }
}

function buildBuildsQuery(
  filters: BuildSurveillanceFilterContext,
  minGames: number,
  limit: number
): string {
  const params = new URLSearchParams()
  if (filters.patch) params.set('patch', filters.patch)
  if (filters.role) params.set('role', filters.role)
  for (const tier of filters.rankTiers) {
    const normalized = String(tier ?? '')
      .trim()
      .toUpperCase()
      .split('_')[0]
    if (normalized) params.append('rankTier', normalized)
  }
  params.set('minGames', String(minGames))
  params.set('limit', String(limit))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

function toSnapshot(build: BuildRowLike): BuildMetricSnapshot {
  return {
    winrate: build.winrate,
    pickrate: build.pickrate,
    games: build.games,
  }
}

function resolveChampionKey(
  rawId: string,
  champions: ReturnType<typeof useChampionsStore>['champions']
): number | null {
  const raw = String(rawId ?? '').trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) {
    const key = Number.parseInt(raw, 10)
    return Number.isFinite(key) && key > 0 ? key : null
  }
  return championKeyFromRouteParam(raw, champions)
}

export function useBuildSurveillanceEvaluation() {
  const statisticsUiStore = useStatisticsUiStore()
  const buildStore = useStatisticsBuildSurveillanceStore()
  const championsStore = useChampionsStore()

  async function ensureChampionsLoaded(): Promise<void> {
    if (championsStore.champions.length === 0) {
      const i18n = useNuxtApp().$i18n
      const lang = i18n.locale.value === 'fr' ? 'fr_FR' : 'en_US'
      await championsStore.loadChampions(lang).catch(() => undefined)
    }
  }

  async function fetchChampionBuilds(
    championKey: number,
    filters: BuildSurveillanceFilterContext
  ): Promise<BuildRowLike[] | null> {
    buildStore.init()
    const thresholds = buildStore.thresholds
    const minGames = effectiveMinGames(thresholds)
    const limit = BUILD_SURVEILLANCE_DISPLAY_LIMIT
    try {
      const data = await $fetch<{ builds?: BuildRowLike[] }>(
        apiUrl(
          `/api/stats/champions/${championKey}/builds${buildBuildsQuery(filters, minGames, limit)}`
        )
      )
      return Array.isArray(data?.builds)
        ? data.builds
            .filter(build => isEligibleBuild(build, thresholds))
            .slice(0, effectiveMaxBuilds(thresholds))
        : []
    } catch {
      return null
    }
  }

  function runBuildSurveillanceCheck(
    filters: BuildSurveillanceFilterContext,
    championKeys?: number[]
  ): Promise<BuildSurveillanceCheckResult> {
    if (!import.meta.client) return Promise.resolve(emptyResult())

    const run = async (): Promise<BuildSurveillanceCheckResult> => {
      statisticsUiStore.init()
      buildStore.init()

      const watchedIds = statisticsUiStore.watchedChampionIds
      const result: BuildSurveillanceCheckResult = {
        ...emptyResult(),
        watchedCount: watchedIds.length,
      }

      if (watchedIds.length === 0) {
        buildStore.clearActiveAlerts()
        return result
      }

      if (!hasConfiguredBuildSurveillanceThresholds(buildStore.thresholds)) {
        buildStore.clearActiveAlerts()
        return result
      }

      buildStore.setChecking(true)
      try {
        await ensureChampionsLoaded()

        const activeAlerts: Record<string, BuildSurveillanceTrigger[]> = {}
        const nextBaselines = { ...buildStore.baselines }

        const keysToCheck =
          championKeys ??
          watchedIds
            .map(id => resolveChampionKey(id, championsStore.champions))
            .filter((key): key is number => key !== null)

        if (keysToCheck.length === 0) {
          result.unresolvedCount = watchedIds.length
          return result
        }

        await Promise.all(
          keysToCheck.map(async championKey => {
            const builds = await fetchChampionBuilds(championKey, filters)
            if (builds === null) {
              result.fetchFailedCount++
              return
            }

            const scopeKey = buildSurveillanceScopeKey({
              championKey,
              rankTiers: filters.rankTiers,
              role: filters.role,
              patch: filters.patch,
            })
            const scopeBaselines = { ...(nextBaselines[scopeKey] ?? {}) }
            const scopeHadBaselines = Object.keys(scopeBaselines).length > 0
            const triggers: BuildSurveillanceTrigger[] = []

            for (const build of builds) {
              if (!isEligibleBuild(build, buildStore.thresholds)) continue
              const fingerprint = buildFingerprint(build.items)
              const baseline = scopeBaselines[fingerprint] ?? null
              const isNewBuild = baseline === null && scopeHadBaselines
              const buildTriggers = evaluateBuildSurveillanceAlerts({
                build,
                fingerprint,
                baseline,
                thresholds: buildStore.thresholds,
                isNewBuild,
              })
              if (buildTriggers.length > 0) {
                triggers.push(...buildTriggers)
              }
              scopeBaselines[fingerprint] = toSnapshot(build)
              result.evaluatedCount++
            }

            nextBaselines[scopeKey] = scopeBaselines
            if (triggers.length > 0) {
              activeAlerts[String(championKey)] = triggers
            }
          })
        )

        buildStore.setBaselines(nextBaselines)
        buildStore.setActiveAlerts(activeAlerts)
        result.alertCount = Object.values(activeAlerts).reduce((sum, list) => sum + list.length, 0)
        return result
      } finally {
        buildStore.setChecking(false)
        buildStore.recordCheckCompleted()
      }
    }

    return run()
  }

  return {
    fetchChampionBuilds,
    runBuildSurveillanceCheck,
  }
}
