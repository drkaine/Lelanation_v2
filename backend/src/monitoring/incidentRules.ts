/**
 * Pure detection rules for monitoring incidents.
 * Inputs come from the poller 10m aggregates (unified log) and the API HTTP tracker.
 */

export type IncidentSeverity = 'critical' | 'warning'

export type DetectedIncident = {
  code: string
  severity: IncidentSeverity
  title: string
  message: string
  context?: Record<string, string | number>
}

export type PollerWindowSummary = {
  atMs: number
  uptimeMs: number
  requests: number
  count429: number
  matchesFetchedOk: number
  matchesFetchedFailed: number
  matchesIngested: number
  matchesFailed: number
  topErrors: Array<{ message: string; count: number }>
}

export type HttpWindowStats = {
  total: number
  errors5xx: number
  topRoutes: Array<{ route: string; count: number }>
}

export type MonitoringThresholds = {
  pollerSilentMinutes: number
  rateLimitPerWindow: number
  failureRatioPct: number
  minFailuresPerWindow: number
  ingestionStalledWindows: number
  httpMinRequests: number
  httpDownRatioPct: number
  httpErrorsWarning: number
}

export const DEFAULT_MONITORING_THRESHOLDS: MonitoringThresholds = {
  pollerSilentMinutes: 25,
  rateLimitPerWindow: 5,
  failureRatioPct: 50,
  minFailuresPerWindow: 5,
  ingestionStalledWindows: 3,
  httpMinRequests: 10,
  httpDownRatioPct: 80,
  httpErrorsWarning: 20,
}

/** A window aggregated right after a restart is not representative. */
const WARMUP_MS = 10 * 60_000

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function parseTopErrors(v: unknown): Array<{ message: string; count: number }> {
  if (!Array.isArray(v)) return []
  return v.flatMap((e) => {
    const o = obj(e)
    if (!o) return []
    const message = String(o.error ?? o.message ?? '').trim()
    return message ? [{ message, count: num(o.count) }] : []
  })
}

export function parsePollerSummary(atIso: string, json: Record<string, unknown>): PollerWindowSummary | null {
  const gateway = obj(json.gateway)
  const atMs = Date.parse(atIso)
  if (!gateway || !Number.isFinite(atMs)) return null
  const poll = obj(json.poll) ?? {}
  const ingestion = obj(json.ingestion) ?? {}
  return {
    atMs,
    uptimeMs: num(json.uptime_ms),
    requests: num(gateway.total_requests),
    count429: num(gateway.total_429s),
    matchesFetchedOk: num(poll.matches_fetched_success),
    matchesFetchedFailed: num(poll.matches_fetched_failed),
    matchesIngested: num(ingestion.matches_ingested),
    matchesFailed: num(ingestion.matches_failed),
    topErrors: parseTopErrors(ingestion.failure_top_errors),
  }
}

function mostlyFailing(ok: number, failed: number, t: MonitoringThresholds): boolean {
  const total = ok + failed
  return failed >= t.minFailuresPerWindow && total > 0 && (failed / total) * 100 >= t.failureRatioPct
}

function lastN<T>(items: T[], n: number): T[] | null {
  return items.length >= n ? items.slice(-n) : null
}

export function evaluateIngestionHealth(
  summaries: PollerWindowSummary[],
  nowMs: number,
  t: MonitoringThresholds
): DetectedIncident[] {
  const sorted = [...summaries].sort((a, b) => a.atMs - b.atMs)
  const latest = sorted.at(-1)
  const silentMs = t.pollerSilentMinutes * 60_000
  if (!latest || nowMs - latest.atMs > silentMs) {
    const since = latest ? `${Math.round((nowMs - latest.atMs) / 60_000)} min` : 'jamais'
    return [
      {
        code: 'POLLER_SILENT',
        severity: 'critical',
        title: 'Poller silencieux',
        message: `Aucun résumé poller depuis ${since} : le process d'ingestion est probablement arrêté ou bloqué.`,
        context: { dernierResume: latest ? new Date(latest.atMs).toISOString() : 'aucun' },
      },
    ]
  }

  const warm = sorted.filter((s) => s.uptimeMs >= WARMUP_MS)
  const incidents: DetectedIncident[] = []

  const last2 = lastN(warm, 2)
  if (last2) {
    if (last2.every((s) => s.requests === 0)) {
      incidents.push({
        code: 'RIOT_UNREACHABLE',
        severity: 'critical',
        title: 'Plus aucune requête Riot',
        message: 'Le poller tourne mais n’envoie plus aucune requête à l’API Riot depuis 2 fenêtres de 10 min.',
      })
    }
    if (last2.every((s) => s.count429 >= t.rateLimitPerWindow)) {
      incidents.push({
        code: 'RATE_LIMIT_LOOP',
        severity: 'critical',
        title: '429 en boucle',
        message: `Rate limit Riot atteint en continu (≥ ${t.rateLimitPerWindow} × 429 par fenêtre de 10 min).`,
        context: { derniers429: last2.map((s) => s.count429).join(' → ') },
      })
    }
    if (last2.every((s) => mostlyFailing(s.matchesFetchedOk, s.matchesFetchedFailed, t))) {
      incidents.push({
        code: 'RIOT_FETCH_FAILING',
        severity: 'critical',
        title: 'Récupération des matchs en échec',
        message: `Plus de ${t.failureRatioPct}% des matchs Riot échouent depuis 2 fenêtres.`,
        context: { echecs: last2.map((s) => s.matchesFetchedFailed).join(' → ') },
      })
    }
    if (last2.every((s) => mostlyFailing(s.matchesIngested, s.matchesFailed, t))) {
      const top = last2.at(-1)?.topErrors[0]?.message
      incidents.push({
        code: 'INGESTION_FAILING',
        severity: 'critical',
        title: 'Ingestion en échec',
        message: `Plus de ${t.failureRatioPct}% des matchs échouent à l’ingestion en base.`,
        context: { echecs: last2.map((s) => s.matchesFailed).join(' → '), ...(top ? { erreur: top } : {}) },
      })
    }
  }

  const stalled = lastN(warm, t.ingestionStalledWindows)
  if (stalled && stalled.every((s) => s.matchesIngested === 0)) {
    incidents.push({
      code: 'INGESTION_STALLED',
      severity: 'critical',
      title: 'Plus d’ingestion',
      message: `Aucun match ingéré depuis ${t.ingestionStalledWindows * 10} min.`,
    })
  }

  return incidents
}

export function evaluateHttpHealth(stats: HttpWindowStats, t: MonitoringThresholds): DetectedIncident[] {
  if (stats.total < t.httpMinRequests) return []
  const ratio = (stats.errors5xx / stats.total) * 100
  const context = {
    requetes: stats.total,
    erreurs5xx: stats.errors5xx,
    ...(stats.topRoutes.length > 0
      ? { routes: stats.topRoutes.slice(0, 5).map((r) => `${r.route} (${r.count})`).join(', ') }
      : {}),
  }
  if (ratio >= t.httpDownRatioPct) {
    return [
      {
        code: 'API_DOWN',
        severity: 'critical',
        title: 'API en panne',
        message: `${Math.round(ratio)}% des requêtes API répondent en 5xx sur les 5 dernières minutes.`,
        context,
      },
    ]
  }
  if (stats.errors5xx >= t.httpErrorsWarning) {
    return [
      {
        code: 'API_ERRORS',
        severity: 'warning',
        title: 'Erreurs API fréquentes',
        message: `${stats.errors5xx} réponses 5xx sur les 5 dernières minutes.`,
        context,
      },
    ]
  }
  return []
}

export type CronJobHealthInput = {
  job: string
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastFailureMessage: string | null
}

/** Expected interval of each scheduled cron (see src/cron/*). Unknown jobs are only checked for failures. */
const CRON_INTERVAL_MS: Record<string, number> = {
  dataDragonSync: 3_600_000,
  youtubeSync: 3_600_000,
  socialLinksHealthCheck: 6 * 3_600_000,
  diskSpaceAlert: 15 * 60_000,
}
const CRON_STALE_INTERVALS = 3

export function evaluateCronHealth(
  jobs: CronJobHealthInput[],
  nowMs: number,
  processUptimeMs: number
): DetectedIncident[] {
  const incidents: DetectedIncident[] = []
  for (const j of jobs) {
    if (j.lastFailureAt) {
      incidents.push({
        code: `CRON_FAILED_${j.job}`,
        severity: 'critical',
        title: `Cron ${j.job} en échec`,
        message: `La dernière exécution de ${j.job} a échoué (${j.lastFailureAt}).`,
        context: { erreur: (j.lastFailureMessage ?? 'inconnue').slice(0, 500) },
      })
      continue
    }
    const interval = CRON_INTERVAL_MS[j.job]
    if (!interval) continue
    const staleMs = interval * CRON_STALE_INTERVALS
    if (processUptimeMs < staleMs) continue
    const lastSuccess = j.lastSuccessAt ? Date.parse(j.lastSuccessAt) : Number.NaN
    if (Number.isFinite(lastSuccess) && nowMs - lastSuccess <= staleMs) continue
    incidents.push({
      code: `CRON_STALE_${j.job}`,
      severity: 'critical',
      title: `Cron ${j.job} ne tourne plus`,
      message: `Aucun succès de ${j.job} depuis plus de ${Math.round(staleMs / 60_000)} min.`,
      context: { dernierSucces: j.lastSuccessAt ?? 'jamais' },
    })
  }
  return incidents
}
