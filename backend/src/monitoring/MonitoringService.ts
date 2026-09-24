/**
 * Monitoring orchestration: periodic health check (critical → Discord now) and daily recap.
 * All I/O goes through `MonitoringDeps` so the logic stays testable.
 */
import { buildDailyRecap, recapToDiscordEmbed, type DailyRecap, type RecapEmbed, type RecapLogEntry } from './dailyRecap.js'
import {
  DEFAULT_MONITORING_THRESHOLDS,
  evaluateCronHealth,
  evaluateHttpHealth,
  evaluateIngestionHealth,
  parsePollerSummary,
  type CronJobHealthInput,
  type DetectedIncident,
  type HttpWindowStats,
  type MonitoringThresholds,
  type PollerWindowSummary,
} from './incidentRules.js'
import {
  EMPTY_INCIDENT_STATE,
  reconcileIncidents,
  type IncidentNotification,
  type IncidentState,
} from './incidentTracker.js'
import { evaluateCodeFreshness, type ProcessInfo } from './processFreshness.js'

export const POLLER_SUMMARY_SCRIPT = 'poller_v3_10m'
const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const CHECK_LOOKBACK_MS = HOUR_MS
const REMINDER_MS = HOUR_MS
const HISTORY_LIMIT = 200

export type MonitoringState = {
  incidents: IncidentState
  lastCheckAt: string | null
  lastRecap: DailyRecap | null
  lastRecapSentAt: string | null
}

export type MonitoringDeps = {
  now: () => number
  readLogEntries: (fromIso: string) => Promise<RecapLogEntry[]>
  httpStats: () => HttpWindowStats
  loadState: () => Promise<MonitoringState | null>
  saveState: (state: MonitoringState) => Promise<void>
  sendEmbed: (embed: RecapEmbed) => Promise<boolean>
  appendLog: (type: 'erreur' | 'warning' | 'info', message: string, json?: Record<string, unknown>) => Promise<void>
  cronJobs: () => Promise<CronJobHealthInput[]>
  uptimeMs: () => number
  processes: () => Promise<ProcessInfo[]>
  codeVersion: () => Promise<{ head: string | null; latestSourceMtime: number }>
}

export type MonitoringSnapshot = {
  state: MonitoringState
  recap24h: DailyRecap
  http: HttpWindowStats
  thresholds: MonitoringThresholds
  processes: Array<ProcessInfo & { stale: boolean }>
  repoHead: string | null
}

const EMPTY_STATE: MonitoringState = {
  incidents: EMPTY_INCIDENT_STATE,
  lastCheckAt: null,
  lastRecap: null,
  lastRecapSentAt: null,
}

function pollerSummaries(entries: RecapLogEntry[]): PollerWindowSummary[] {
  return entries.flatMap((e) => {
    if (e.script !== POLLER_SUMMARY_SCRIPT || !e.json) return []
    const s = parsePollerSummary(e.atIso, e.json)
    return s ? [s] : []
  })
}

function durationLabel(fromIso: string, toIso: string): string {
  const min = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

function notificationEmbed(n: IncidentNotification): RecapEmbed {
  const i = n.incident
  const fields = Object.entries(i.context ?? {}).map(([name, value]) => ({
    name,
    value: String(value).slice(0, 1024),
    inline: true,
  }))
  if (n.kind === 'resolved' && 'resolvedAt' in i) {
    return {
      title: `✅ Résolu : ${i.title}`,
      description: `Incident terminé après ${durationLabel(i.openedAt, i.resolvedAt)}.`,
      color: 0x2ecc71,
      fields: [],
    }
  }
  if (n.kind === 'reminder') {
    return {
      title: `⏰ Toujours en cours : ${i.title}`,
      description: `${i.message}\nDepuis ${durationLabel(i.openedAt, i.lastSeenAt)}.`,
      color: 0xe67e22,
      fields,
    }
  }
  return { title: `🚨 ${i.title}`, description: i.message, color: 0xe74c3c, fields }
}

export class MonitoringService {
  constructor(
    private readonly deps: MonitoringDeps,
    private readonly thresholds: MonitoringThresholds = DEFAULT_MONITORING_THRESHOLDS
  ) {}

  async runCheck(): Promise<IncidentNotification[]> {
    const nowMs = this.deps.now()
    const state = (await this.deps.loadState()) ?? EMPTY_STATE
    const entries = await this.deps.readLogEntries(new Date(nowMs - CHECK_LOOKBACK_MS).toISOString())
    const code = await this.codeFreshness()
    const detected: DetectedIncident[] = [
      ...evaluateIngestionHealth(pollerSummaries(entries), nowMs, this.thresholds),
      ...evaluateHttpHealth(this.deps.httpStats(), this.thresholds),
      ...evaluateCronHealth(await this.deps.cronJobs(), nowMs, this.deps.uptimeMs()),
      ...code.incidents,
    ]
    const { state: incidents, notifications } = reconcileIncidents(state.incidents, detected, nowMs, {
      reminderMs: REMINDER_MS,
      historyLimit: HISTORY_LIMIT,
    })
    await this.deps.saveState({ ...state, incidents, lastCheckAt: new Date(nowMs).toISOString() })

    for (const n of notifications) {
      const i = n.incident
      const type = n.kind === 'resolved' ? 'info' : 'erreur'
      await this.deps.appendLog(type, `[${n.kind}] ${i.code} — ${i.title} : ${i.message}`, {
        code: i.code,
        kind: n.kind,
        ...(i.context ?? {}),
      })
      await this.deps.sendEmbed(notificationEmbed(n))
    }
    return notifications
  }

  async runDailyRecap(): Promise<DailyRecap> {
    const nowMs = this.deps.now()
    const recap = await this.buildRecap(nowMs)
    const sent = await this.deps.sendEmbed(recapToDiscordEmbed(recap))
    const state = (await this.deps.loadState()) ?? EMPTY_STATE
    await this.deps.saveState({
      ...state,
      lastRecap: recap,
      lastRecapSentAt: sent ? new Date(nowMs).toISOString() : state.lastRecapSentAt,
    })
    await this.deps.appendLog('info', `Récap quotidien ${sent ? 'envoyé' : 'non envoyé'} (${recap.status})`, {
      errors: recap.errors,
      incidents: recap.incidents.length,
    })
    return recap
  }

  async snapshot(): Promise<MonitoringSnapshot> {
    const nowMs = this.deps.now()
    const code = await this.codeFreshness()
    const staleNames = new Set(code.incidents.map((i) => i.code.replace(/^STALE_CODE_/, '')))
    return {
      state: (await this.deps.loadState()) ?? EMPTY_STATE,
      recap24h: await this.buildRecap(nowMs),
      http: this.deps.httpStats(),
      thresholds: this.thresholds,
      processes: code.processes.map((p) => ({ ...p, stale: staleNames.has(p.name) })),
      repoHead: code.head,
    }
  }

  async sendTestAlert(): Promise<boolean> {
    return this.deps.sendEmbed({
      title: '🧪 Test monitoring',
      description: 'Si ce message arrive, les alertes Discord du monitoring fonctionnent.',
      color: 0x3498db,
      fields: [],
    })
  }

  private async codeFreshness(): Promise<{
    processes: ProcessInfo[]
    head: string | null
    incidents: DetectedIncident[]
  }> {
    const [processes, version] = await Promise.all([this.deps.processes(), this.deps.codeVersion()])
    return {
      processes,
      head: version.head,
      incidents: evaluateCodeFreshness(processes, version.head, version.latestSourceMtime),
    }
  }

  private async buildRecap(nowMs: number): Promise<DailyRecap> {
    const fromIso = new Date(nowMs - DAY_MS).toISOString()
    const entries = await this.deps.readLogEntries(fromIso)
    const state = (await this.deps.loadState()) ?? EMPTY_STATE
    return buildDailyRecap({
      fromIso,
      toIso: new Date(nowMs).toISOString(),
      entries,
      summaries: pollerSummaries(entries),
      incidents: [...state.incidents.active, ...state.incidents.history],
    })
  }
}
