import { apiUrl } from '~/utils/apiUrl'
import type { DailyTrendSnapshotPoint } from '~/composables/statistics/useStatisticsDailyTrendCharts'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useStatisticsSurveillanceAlertStore } from '~/stores/StatisticsSurveillanceAlertStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { championKeyFromRouteParam } from '~/utils/championSlug'
import {
  buildDemoAlertScenario,
  buildSurveillanceBaselineKey,
  buildSurveillanceChampionStatsQuery,
  computeTrendReferenceMetrics,
  configuredSurveillanceCohortProfiles,
  evaluateSurveillanceAlerts,
  formatSurveillanceReferenceDate,
  hasConfiguredSurveillanceThresholds,
  resolveSurveillanceCohortLabel,
  resolveSurveillanceReference,
  surveillanceReferenceDateDaysAgo,
  type ChampionMetricSnapshot,
  type SurveillanceAlertCheckResult,
  type SurveillanceAlertTrigger,
  type SurveillanceCaptureResult,
  type SurveillanceCohortProfile,
  type SurveillanceTestBaseline,
} from '~/utils/statisticsSurveillanceAlerts'

type ChampionStatsApiResponse = {
  winrate?: number
  pickrate?: number
  banrate?: number
}

type VersionsCatalogEntry = { patchLabel: string; releaseDate: string }

function emptyCheckResult(): SurveillanceAlertCheckResult {
  return {
    alertCount: 0,
    watchedCount: 0,
    evaluatedCount: 0,
    unresolvedCount: 0,
    fetchFailedCount: 0,
  }
}

let checkInFlight: Promise<SurveillanceAlertCheckResult> | null = null
let checkInFlightDemo = false

function resolveChampionKey(
  rawId: string,
  champions: ReturnType<typeof useChampionsStore>['champions']
): number | null {
  const raw = String(rawId ?? '').trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) {
    const key = parseInt(raw, 10)
    return Number.isFinite(key) && key > 0 ? key : null
  }
  return championKeyFromRouteParam(raw, champions)
}

async function loadVersionsCatalog(): Promise<VersionsCatalogEntry[]> {
  try {
    const versionsData = await $fetch<{
      versions?: Array<{ version?: string; patchLabel?: string; releaseDate?: string }>
    }>('/data/game/versions.json')
    const rows =
      versionsData?.versions
        ?.map(entry => ({
          patchLabel: String(entry.patchLabel ?? entry.version ?? '').trim(),
          releaseDate: String(entry.releaseDate ?? '').trim(),
        }))
        .filter(entry => entry.patchLabel && /^\d{4}-\d{2}-\d{2}$/.test(entry.releaseDate)) ?? []
    return rows.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
  } catch {
    return []
  }
}

function latestPatchReleaseDate(catalog: VersionsCatalogEntry[]): {
  releaseDate: string
  patchLabel: string
} | null {
  if (catalog.length === 0) return null
  const latest = catalog[catalog.length - 1]!
  return { releaseDate: latest.releaseDate, patchLabel: latest.patchLabel }
}

async function fetchChampionCurrentStats(
  championKey: number,
  queryOptions: { version?: string | null; rankTiers?: readonly string[] } = {}
): Promise<ChampionMetricSnapshot | null> {
  try {
    const query = buildSurveillanceChampionStatsQuery(queryOptions)
    const data = await $fetch<ChampionStatsApiResponse>(
      apiUrl(`/api/stats/champions/${championKey}${query}`)
    )
    return {
      winrate: Number(data?.winrate ?? 0),
      pickrate: Number(data?.pickrate ?? 0),
      banrate: Number(data?.banrate ?? 0),
    }
  } catch {
    return null
  }
}

async function fetchPatchTrendPoints(
  championKey: number,
  patchReleaseDate: string,
  rankTiers: readonly string[] = []
): Promise<DailyTrendSnapshotPoint[]> {
  try {
    const params = new URLSearchParams()
    params.set('from', patchReleaseDate)
    params.set('limit', '1200')
    for (const tier of rankTiers) {
      const normalized = String(tier ?? '')
        .trim()
        .toUpperCase()
        .split('_')[0]
      if (normalized) params.append('rankTier', normalized)
    }
    const data = await $fetch<{ points?: DailyTrendSnapshotPoint[] }>(
      apiUrl(`/api/stats/champions/${championKey}/tier-trend-snapshots?${params.toString()}`)
    )
    return Array.isArray(data?.points) ? data.points : []
  } catch {
    return []
  }
}

async function evaluateChampionAlertsForProfile(input: {
  championKey: number
  profile: SurveillanceCohortProfile
  referenceReleaseDate: string
  referenceLabel: string
  statsVersion?: string | null
  referenceOverride?: ChampionMetricSnapshot | null
  referenceOverrideLabel?: string
}): Promise<{ triggers: SurveillanceAlertTrigger[]; statsAvailable: boolean }> {
  const cohortLabel = resolveSurveillanceCohortLabel(input.profile)
  const [current, trendPoints] = await Promise.all([
    fetchChampionCurrentStats(input.championKey, {
      version: input.statsVersion,
      rankTiers: input.profile.rankTiers,
    }),
    input.referenceOverride
      ? Promise.resolve([] as DailyTrendSnapshotPoint[])
      : fetchPatchTrendPoints(
          input.championKey,
          input.referenceReleaseDate,
          input.profile.rankTiers
        ),
  ])
  if (!current) return { triggers: [], statsAvailable: false }

  const referenceMetrics =
    input.referenceOverride ?? computeTrendReferenceMetrics(trendPoints, input.referenceReleaseDate)
  return {
    statsAvailable: true,
    triggers: evaluateSurveillanceAlerts({
      current,
      patchStart: referenceMetrics,
      thresholds: input.profile.thresholds,
      patchLabel: input.referenceOverrideLabel ?? input.referenceLabel,
      cohortKey: input.profile.cohortKey,
      cohortLabel,
    }),
  }
}

export function useSurveillanceAlertEvaluation() {
  const statisticsUiStore = useStatisticsUiStore()
  const alertStore = useStatisticsSurveillanceAlertStore()
  const championsStore = useChampionsStore()

  async function ensureChampionsLoaded(): Promise<void> {
    if (championsStore.champions.length === 0) {
      const i18n = useNuxtApp().$i18n
      const lang = i18n.locale.value === 'fr' ? 'fr_FR' : 'en_US'
      await championsStore.loadChampions(lang).catch(() => undefined)
    }
  }

  async function captureTestReference(
    daysAgo = 1,
    cohortKey?: string
  ): Promise<SurveillanceCaptureResult> {
    const empty: SurveillanceCaptureResult = {
      captured: 0,
      watchedCount: 0,
      unresolvedCount: 0,
      fetchFailedCount: 0,
    }
    if (!import.meta.client) return empty
    statisticsUiStore.init()
    alertStore.init()

    const watchedIds = statisticsUiStore.watchedChampionIds
    const result: SurveillanceCaptureResult = {
      captured: 0,
      watchedCount: watchedIds.length,
      unresolvedCount: 0,
      fetchFailedCount: 0,
    }
    if (watchedIds.length === 0) return result

    const profiles = cohortKey
      ? alertStore.thresholdProfiles.filter(p => p.cohortKey === cohortKey)
      : alertStore.thresholdProfiles

    if (profiles.length === 0) return result

    alertStore.setChecking(true)
    try {
      await ensureChampionsLoaded()
      const catalog = await loadVersionsCatalog()
      const patch = latestPatchReleaseDate(catalog)
      const statsVersion = patch?.patchLabel ?? null
      const capturedAt = surveillanceReferenceDateDaysAgo(daysAgo)
      const nextBaselines = { ...alertStore.testBaselines }

      await Promise.all(
        watchedIds.flatMap(watchedId =>
          profiles.map(async profile => {
            const championKey = resolveChampionKey(watchedId, championsStore.champions)
            if (!championKey) {
              result.unresolvedCount++
              return
            }
            const current = await fetchChampionCurrentStats(championKey, {
              version: statsVersion,
              rankTiers: profile.rankTiers,
            })
            if (!current) {
              result.fetchFailedCount++
              return
            }
            const baselineKey = buildSurveillanceBaselineKey(championKey, profile.cohortKey)
            const baseline: SurveillanceTestBaseline = {
              snapshot: current,
              capturedAt,
              patchLabel: formatSurveillanceReferenceDate(capturedAt),
              cohortKey: profile.cohortKey,
            }
            nextBaselines[baselineKey] = baseline
            result.captured++
          })
        )
      )

      alertStore.setTestBaselines(nextBaselines)
      return result
    } finally {
      alertStore.setChecking(false)
    }
  }

  function runSurveillanceAlertCheck(options?: {
    useTestBaselines?: boolean
    demoMode?: boolean
    cohortKey?: string
  }): Promise<SurveillanceAlertCheckResult> {
    if (!import.meta.client) return Promise.resolve(emptyCheckResult())

    const useTestBaselines = options?.useTestBaselines ?? false
    const demoMode = options?.demoMode ?? false

    if (checkInFlight && !demoMode && !useTestBaselines && !checkInFlightDemo) {
      return checkInFlight
    }

    const shouldRecordCheck = !demoMode && !useTestBaselines

    const run = async (): Promise<SurveillanceAlertCheckResult> => {
      try {
        statisticsUiStore.init()

        const watchedIds = statisticsUiStore.watchedChampionIds
        const result: SurveillanceAlertCheckResult = {
          ...emptyCheckResult(),
          watchedCount: watchedIds.length,
        }

        if (watchedIds.length === 0) {
          alertStore.clearActiveAlerts()
          return result
        }

        const profiles = (() => {
          const all = options?.cohortKey
            ? alertStore.thresholdProfiles.filter(p => p.cohortKey === options.cohortKey)
            : configuredSurveillanceCohortProfiles(alertStore.thresholdProfiles)
          return demoMode ? alertStore.thresholdProfiles : all
        })()

        if (profiles.length === 0) {
          return result
        }

        if (
          !demoMode &&
          !profiles.some(profile => hasConfiguredSurveillanceThresholds(profile.thresholds))
        ) {
          alertStore.clearActiveAlerts()
          return result
        }

        alertStore.setChecking(true)

        await ensureChampionsLoaded()

        const catalog = await loadVersionsCatalog()
        const latestPatch = latestPatchReleaseDate(catalog)
        const reference = resolveSurveillanceReference(alertStore.referenceSettings, catalog)
        if (!latestPatch && !useTestBaselines && !demoMode) {
          return result
        }
        if (!useTestBaselines && !demoMode && !reference) {
          return result
        }

        const activeAlerts: Record<string, SurveillanceAlertTrigger[]> = {}

        await Promise.all(
          watchedIds.flatMap(watchedId =>
            profiles.map(async profile => {
              const championKey = resolveChampionKey(watchedId, championsStore.champions)
              if (!championKey) {
                result.unresolvedCount++
                return
              }

              const key = String(championKey)

              if (demoMode) {
                if (!hasConfiguredSurveillanceThresholds(profile.thresholds)) return
                const demoScenario = buildDemoAlertScenario(profile.thresholds)
                const triggers = evaluateSurveillanceAlerts({
                  current: demoScenario.current,
                  patchStart: demoScenario.reference,
                  thresholds: profile.thresholds,
                  patchLabel: 'demo',
                  cohortKey: profile.cohortKey,
                  cohortLabel: resolveSurveillanceCohortLabel(profile),
                })
                result.evaluatedCount++
                if (triggers.length > 0) {
                  activeAlerts[key] = [...(activeAlerts[key] ?? []), ...triggers]
                }
                return
              }

              let referenceOverride: ChampionMetricSnapshot | null | undefined
              let referenceLabel: string | undefined

              if (useTestBaselines) {
                const baselineKey = buildSurveillanceBaselineKey(key, profile.cohortKey)
                const baseline = alertStore.testBaselines[baselineKey]
                if (!baseline) return
                referenceOverride = baseline.snapshot
                referenceLabel =
                  baseline.patchLabel ?? formatSurveillanceReferenceDate(baseline.capturedAt)
              }

              const { triggers, statsAvailable } = await evaluateChampionAlertsForProfile({
                championKey,
                profile,
                referenceReleaseDate: reference?.releaseDate ?? '',
                referenceLabel: reference?.label ?? '—',
                statsVersion: latestPatch?.patchLabel ?? null,
                referenceOverride,
                referenceOverrideLabel: referenceLabel,
              })

              if (!statsAvailable) result.fetchFailedCount++

              result.evaluatedCount++
              if (triggers.length > 0) {
                activeAlerts[key] = [...(activeAlerts[key] ?? []), ...triggers]
              }
            })
          )
        )

        alertStore.setActiveAlerts(activeAlerts)
        result.alertCount = Object.keys(activeAlerts).length
        return result
      } finally {
        alertStore.setChecking(false)
        if (shouldRecordCheck) {
          alertStore.recordCheckCompleted()
        }
      }
    }

    checkInFlightDemo = demoMode || useTestBaselines
    checkInFlight = run().finally(() => {
      checkInFlight = null
      checkInFlightDemo = false
    })

    return checkInFlight
  }

  return {
    captureTestReference,
    runSurveillanceAlertCheck,
  }
}
