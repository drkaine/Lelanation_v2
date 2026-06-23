import EventEmitter from 'node:events'
import { AlertManager } from './AlertManager.js'
import { RingBuffer } from './RingBuffer.js'
import { WindowAccumulator } from './WindowAccumulator.js'
import type {
  DBWriteEvent,
  DBWriteSample,
  ErrorSample,
  HourlySummary,
  MetricsSnapshot,
  ObsErrorEvent,
  QueueDepthEvent,
  RateLimit429Event,
  RateLimitEvent,
  RateLimitSyncEvent,
  StageItemEvent,
  StageItemSample,
  StageName,
  WindowSnapshot,
} from './types.js'

const STAGES: StageName[] = [
  'PlayerSource',
  'RankFetcher',
  'MatchListFetcher',
  'MatchFilter',
  'MatchDataFetcher',
  'ParticipantHandler',
  'AggregateWriter',
  'Gateway',
]

function startOfCurrentHourMs(now = Date.now()): number {
  return Math.floor(now / 3_600_000) * 3_600_000
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? 0
}

type HourlyCounters = {
  apiRequests: number
  count429s: number
  matchesProcessed: number
  playersUpdated: number
  ranksFetched: number
  dbRowsWritten: number
  totalErrors: number
}

function freshHourlyCounters(): HourlyCounters {
  return {
    apiRequests: 0,
    count429s: 0,
    matchesProcessed: 0,
    playersUpdated: 0,
    ranksFetched: 0,
    dbRowsWritten: 0,
    totalErrors: 0,
  }
}

export class MetricsCollector extends EventEmitter {
  private static instance: MetricsCollector | null = null

  private readonly windowAccumulator = new WindowAccumulator()
  private readonly windowHistory = new RingBuffer<WindowSnapshot>(60)
  private readonly stageBuffers = new Map<StageName, RingBuffer<StageItemSample>>()
  private readonly queueDepths = new Map<StageName, number>()
  private readonly dbWriteBuffer = new RingBuffer<DBWriteSample>(500)
  private readonly errorBuffer = new RingBuffer<ErrorSample>(200)

  private hourlyStart = startOfCurrentHourMs()
  private hourlyCounters = freshHourlyCounters()

  private constructor() {
    super()
    for (const stage of STAGES) {
      this.stageBuffers.set(stage, new RingBuffer<StageItemSample>(6000))
      this.queueDepths.set(stage, 0)
    }
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector()
    }
    return MetricsCollector.instance
  }

  recordRequest(e: RateLimitEvent): void {
    this.rolloverWindowIfNeeded()
    this.windowAccumulator.onRequest(e.windowCount, e.windowLimit)
    this.hourlyCounters.apiRequests += 1
    this.emit('request', e)
    this.checkHourlyRollover()
  }

  record429(e: RateLimit429Event): void {
    this.rolloverWindowIfNeeded()
    this.windowAccumulator.on429()
    this.hourlyCounters.count429s += 1
    this.emit('429', e)
    this.checkHourlyRollover()
  }

  recordHeaderSync(e: RateLimitSyncEvent): void {
    this.rolloverWindowIfNeeded()
    this.windowAccumulator.onHeaderSync(e.windowMs)
    this.emit('sync', e)
    this.checkHourlyRollover()
  }

  recordStageItem(e: StageItemEvent): void {
    this.rolloverWindowIfNeeded()
    const buf = this.stageBuffers.get(e.stage)
    if (buf) buf.push({ ts: Date.now(), durationMs: e.durationMs, success: e.success })

    if (e.success && e.stage === 'RankFetcher') {
      this.hourlyCounters.playersUpdated += 1
      this.hourlyCounters.ranksFetched += 1
    }
    this.checkHourlyRollover()
  }

  recordQueueDepth(e: QueueDepthEvent): void {
    this.rolloverWindowIfNeeded()
    this.queueDepths.set(e.stage, e.depth)
    this.windowAccumulator.onQueueDepth(e.depth)
    this.checkHourlyRollover()
  }

  recordDBWrite(e: DBWriteEvent): void {
    this.rolloverWindowIfNeeded()
    this.dbWriteBuffer.push({
      ts: Date.now(),
      table: e.table,
      rows: e.rows,
      durationMs: e.durationMs,
      ok: true,
    })
    this.hourlyCounters.dbRowsWritten += e.rows
    if (e.table === 'matchs' || e.table === 'match_aggregated') this.hourlyCounters.matchesProcessed += e.rows
    this.checkHourlyRollover()
  }

  recordDBError(table: string, error: Error): void {
    this.rolloverWindowIfNeeded()
    this.dbWriteBuffer.push({
      ts: Date.now(),
      table,
      rows: 0,
      durationMs: 0,
      ok: false,
    })
    this.recordError({ error, context: { table } })
  }

  recordError(e: ObsErrorEvent): void {
    this.rolloverWindowIfNeeded()
    const sample: ErrorSample = {
      ts: Date.now(),
      stage: e.stage,
      errorType: e.error.constructor.name,
      message: e.error.message,
      context: e.context,
      matchId: e.matchId,
      puuid: e.puuid,
    }
    this.errorBuffer.push(sample)
    this.hourlyCounters.totalErrors += 1
    this.emit('error_event', sample)
    this.checkHourlyRollover()
  }

  getDBWriteStatsSince(sinceMs: number): Record<string, { rowsWritten: number; writeErrors: number; avgMs: number }> {
    const data = this.dbWriteBuffer.since(sinceMs)
    const grouped = new Map<string, { rowsWritten: number; writeErrors: number; durations: number[] }>()

    for (const row of data) {
      const entry = grouped.get(row.table) ?? { rowsWritten: 0, writeErrors: 0, durations: [] }
      if (row.ok) {
        entry.rowsWritten += row.rows
        entry.durations.push(row.durationMs)
      } else {
        entry.writeErrors += 1
      }
      grouped.set(row.table, entry)
    }

    const out: Record<string, { rowsWritten: number; writeErrors: number; avgMs: number }> = {}
    for (const [table, stats] of grouped.entries()) {
      out[table] = {
        rowsWritten: stats.rowsWritten,
        writeErrors: stats.writeErrors,
        avgMs: avg(stats.durations),
      }
    }
    return out
  }

  getSnapshot(): MetricsSnapshot {
    this.rolloverWindowIfNeeded()
    const now = Date.now()
    const last60s = now - 60_000

    const current = this.windowAccumulator.snapshot(now)
    const stages = this.buildStageSnapshot(last60s)
    const hourly = this.buildHourlySummary()

    return {
      ts: now,
      rateLimitCurrent: {
        windowStart: current.windowStart,
        requestsSent: current.requestsSent,
        target: current.requestsTarget,
        limit: current.requestsLimit,
        headroom: Math.max(0, current.requestsLimit - current.requestsSent),
        count429: current.count429,
        queueDepth: this.queueDepths.get('Gateway') ?? 0,
      },
      windows120s: this.windowHistory.last(10).map((w) => ({
        start: w.windowStart,
        sent: w.requestsSent,
        count429: w.count429,
        headroomMin: w.headroomMin,
      })),
      stages,
      hourly: {
        apiRequests: hourly.apiRequests,
        matchesProcessed: hourly.matchesProcessed,
        playersUpdated: hourly.playersUpdated,
        rankseFetched: hourly.ranksFetched,
        dbRowsWritten: hourly.dbRowsWritten,
        errors: hourly.errors,
        avgRequestsPer120s: hourly.avgRequestsPer120s,
      },
      alerts: AlertManager.getInstance().getActiveAlerts(),
    }
  }

  private buildStageSnapshot(last60s: number): MetricsSnapshot['stages'] {
    const out = {} as MetricsSnapshot['stages']
    for (const stage of STAGES) {
      const rows = this.stageBuffers.get(stage)?.since(last60s) ?? []
      const durations = rows.map((row) => row.durationMs)
      const failures = rows.filter((row) => !row.success).length
      const items = rows.length
      const failureRate = items > 0 ? (failures / items) * 100 : 0
      const queueDepth = this.queueDepths.get(stage) ?? 0
      AlertManager.getInstance().evaluateStage(stage, failureRate, queueDepth)
      out[stage] = {
        itemsLast60s: items,
        failuresLast60s: failures,
        avgDurationMs: avg(durations),
        p95DurationMs: percentile(durations, 95),
        queueDepth,
      }
    }
    return out
  }

  private buildHourlySummary(): HourlySummary {
    const windows = this.windowHistory.since(this.hourlyStart)
    const sentSeries = windows.map((w) => w.requestsSent)
    const headroomSeries = windows.map((w) => w.headroomMin)

    return {
      hourStart: this.hourlyStart,
      apiRequests: this.hourlyCounters.apiRequests,
      total429s: this.hourlyCounters.count429s,
      matchesProcessed: this.hourlyCounters.matchesProcessed,
      playersUpdated: this.hourlyCounters.playersUpdated,
      ranksFetched: this.hourlyCounters.ranksFetched,
      dbRowsWritten: this.hourlyCounters.dbRowsWritten,
      errors: this.hourlyCounters.totalErrors,
      avgRequestsPer120s: sentSeries.length > 0 ? avg(sentSeries) : 0,
      minRequestsPer120s: sentSeries.length > 0 ? Math.min(...sentSeries) : 0,
      maxRequestsPer120s: sentSeries.length > 0 ? Math.max(...sentSeries) : 0,
      headroomAvg: headroomSeries.length > 0 ? avg(headroomSeries) : 0,
    }
  }

  private rolloverWindowIfNeeded(): void {
    const completed = this.windowAccumulator.maybeRollover()
    if (!completed) return
    this.windowHistory.push(completed)
    AlertManager.getInstance().evaluateWindow(completed)
    this.emit('window_complete', completed)
  }

  private checkHourlyRollover(): void {
    const now = Date.now()
    if (now < this.hourlyStart + 3_600_000) return
    const summary = this.buildHourlySummary()
    AlertManager.getInstance().evaluateHourly(summary)
    this.emit('hourly_complete', summary)
    this.hourlyStart = startOfCurrentHourMs(now)
    this.hourlyCounters = freshHourlyCounters()
  }
}

export const metrics = MetricsCollector.getInstance()
