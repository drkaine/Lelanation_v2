/**
 * Vues agrégées pour l’admin à partir du snapshot `poller-v2-observability.json`
 * (deltas des fenêtres 30m / 1h + fenêtre glissante 2 min).
 */

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export type PollerV2DashboardRolling = {
  windowMinutes: 2
  httpRequestsTotal: number
  httpRequestsPerMinuteAvg: number
}

export type PollerV2DashboardWindow = {
  key: 'last30m' | 'last1h'
  labelFr: string
  windowMinutes: number
  atIso: string | null
  httpRequestsTotal: number
  httpRequestsPerMinuteAvg: number
  httpRequestsPerTwoMinuteAvg: number
  /** Coût accordé (limiter) sur la fenêtre — somme des `cost` des slots accordés. */
  rateLimitGrantedCostDelta: number
  /** Plafond local 120 s (ex. 95 en dev). */
  tokenBudget120: number
  /**
   * Charge moyenne vs plafond : (delta coût / nombre de tranches 2 min dans la fenêtre) / tokenBudget.
   * À comparer au `rolling2m.tokenUsagePct` du même bloc (pic sur 2 min au moment du tick).
   */
  avgTokenLoadPct: number
  /** Compteurs internes poller (delta depuis le tick précédent). */
  playersPolledDelta: number
  playersUpdatedDelta: number
  playersAddedDelta: number
  /** Agrégat DB sur la fenêtre (tick métriques), quand présent. */
  playersPolledDb: number | null
  playersUpdatedDb: number | null
  playersAddedDb: number | null
  matchesAddedDb: number | null
  rankLeagueFetchesSucceeded: number
  rankLeagueFetchesFailed: number
  matchIdsFetched: number
  matchesQueuedHydration: number
  hydrationJobsSucceeded: number
  hydrationJobsSkippedOldPatch: number
  hydrationJobsNotFound: number
  hydrationJobsFailed: number
  ingestionJobsSucceeded: number
  ingestionJobsDuplicate: number
  /** Hydratation complète mais ingestion ignorée (match déjà traité). */
  wasteIngestionDuplicate: number
  /** Match + timeline récupérés puis jetés (patch trop ancien). */
  wasteSkippedOldPatch: number
}

export type PollerV2DashboardView = {
  rolling2m: PollerV2DashboardRolling | null
  last30m: PollerV2DashboardWindow | null
  last1h: PollerV2DashboardWindow | null
}

function buildWindow(
  key: 'last30m' | 'last1h',
  labelFr: string,
  windowMinutes: number,
  block: unknown,
  tokenBudgetHint: number,
): PollerV2DashboardWindow | null {
  if (!block || typeof block !== 'object') return null
  const b = block as Record<string, unknown>
  const deltaRaw = b['delta']
  const delta = deltaRaw && typeof deltaRaw === 'object' ? (deltaRaw as Record<string, unknown>) : {}
  const dbRaw = b['dbWindow']
  const db = dbRaw && typeof dbRaw === 'object' ? (dbRaw as Record<string, unknown>) : null

  const httpRequestsTotal = num(delta['apiRequests'])
  const rateLimitGrantedCostDelta = num(delta['rateLimitGrantedCost'])
  const tokenBudget120 =
    num(b['tokenBudget120']) > 0 ? num(b['tokenBudget120']) : tokenBudgetHint > 0 ? tokenBudgetHint : 95
  const intervals2m = windowMinutes > 0 ? windowMinutes / 2 : 1
  const avgGrantedPer2m = intervals2m > 0 ? rateLimitGrantedCostDelta / intervals2m : 0
  const avgTokenLoadPct =
    tokenBudget120 > 0 ? round1((avgGrantedPer2m / tokenBudget120) * 100) : 0

  const playersPolledDelta = num(delta['playersPolled'])
  const playersUpdatedDelta = num(delta['playersUpdated'])
  const playersAddedDelta = num(delta['playersAdded'])
  const rankLeagueFetchesSucceeded = num(delta['rankLeagueFetchesSucceeded'])
  const rankLeagueFetchesFailed = num(delta['rankLeagueFetchesFailed'])
  const matchIdsFetched = num(delta['matchIdsFetched'])
  const matchesQueuedHydration = num(delta['matchesQueuedHydration'])
  const hydrationJobsSucceeded = num(delta['hydrationJobsSucceeded'])
  const hydrationJobsSkippedOldPatch = num(delta['hydrationJobsSkippedOldPatch'])
  const hydrationJobsNotFound = num(delta['hydrationJobsNotFound'])
  const hydrationJobsFailed = num(delta['hydrationJobsFailed'])
  const ingestionJobsSucceeded = num(delta['ingestionJobsSucceeded'])
  const ingestionJobsDuplicate = num(delta['ingestionJobsDuplicate'])

  const atIso = typeof b['atIso'] === 'string' ? b['atIso'] : null

  return {
    key,
    labelFr,
    windowMinutes,
    atIso,
    httpRequestsTotal,
    httpRequestsPerMinuteAvg: windowMinutes > 0 ? round1(httpRequestsTotal / windowMinutes) : 0,
    httpRequestsPerTwoMinuteAvg: windowMinutes > 0 ? round1((httpRequestsTotal / windowMinutes) * 2) : 0,
    rateLimitGrantedCostDelta,
    tokenBudget120,
    avgTokenLoadPct,
    playersPolledDelta,
    playersUpdatedDelta,
    playersAddedDelta,
    playersPolledDb: db ? num(db['playersPolled']) : null,
    playersUpdatedDb: db ? num(db['playersUpdated']) : null,
    playersAddedDb: db ? num(db['playersAdded']) : null,
    matchesAddedDb: db ? num(db['matchesAdded']) : null,
    rankLeagueFetchesSucceeded,
    rankLeagueFetchesFailed,
    matchIdsFetched,
    matchesQueuedHydration,
    hydrationJobsSucceeded,
    hydrationJobsSkippedOldPatch,
    hydrationJobsNotFound,
    hydrationJobsFailed,
    ingestionJobsSucceeded,
    ingestionJobsDuplicate,
    wasteIngestionDuplicate: ingestionJobsDuplicate,
    wasteSkippedOldPatch: hydrationJobsSkippedOldPatch,
  }
}

export function computePollerV2Dashboard(snapshot: Record<string, unknown>): PollerV2DashboardView {
  const rollingRaw = snapshot['rolling2m']
  const roll = rollingRaw && typeof rollingRaw === 'object' ? (rollingRaw as Record<string, unknown>) : null
  const http2m = roll ? num(roll['apiRequests']) : 0
  const rolling2m: PollerV2DashboardRolling | null = roll
    ? {
        windowMinutes: 2,
        httpRequestsTotal: http2m,
        httpRequestsPerMinuteAvg: round1(http2m / 2),
      }
    : null

  const tokenBudgetHint = roll ? num(roll['tokenBudget120']) : 0

  const summariesRaw = snapshot['summaries']
  const summaries =
    summariesRaw && typeof summariesRaw === 'object' ? (summariesRaw as Record<string, unknown>) : null

  return {
    rolling2m,
    last30m: buildWindow('last30m', 'Dernière fenêtre ~30 min', 30, summaries?.['last30m'], tokenBudgetHint),
    last1h: buildWindow('last1h', 'Dernière fenêtre ~1 h', 60, summaries?.['last1h'], tokenBudgetHint),
  }
}
