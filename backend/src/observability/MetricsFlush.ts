import { metrics } from './MetricsCollector.js'
import { obsLogger } from './logger.js'
import {
  insertHourlySummary,
  insertObsError,
  insertRateLimitWindow,
  minuteBucket,
  upsertDBWriteStat,
  upsertPipelineMinute,
} from '../db/queries/observability.js'
import type { ErrorSample, HourlySummary, WindowSnapshot } from './types.js'

let started = false
let stageFlushTimer: NodeJS.Timeout | null = null

async function flushWindow(window: WindowSnapshot): Promise<void> {
  await insertRateLimitWindow({
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    requestsSent: window.requestsSent,
    requestsTarget: window.requestsTarget,
    count429: window.count429,
    avgQueueDepth: window.avgQueueDepth,
    headerSyncs: window.headerSyncs,
    headroomMin: window.headroomMin,
  })
}

async function flushStagesAndDb(): Promise<void> {
  const snap = metrics.getSnapshot()
  const bucketStart = minuteBucket(new Date(snap.ts))

  for (const [stage, stats] of Object.entries(snap.stages)) {
    await upsertPipelineMinute({
      bucketStart,
      stage,
      itemsProcessed: stats.itemsLast60s,
      itemsFailed: stats.failuresLast60s,
      avgDurationMs: stats.avgDurationMs,
      p95DurationMs: stats.p95DurationMs,
      queueDepthAvg: stats.queueDepth,
    })
  }

  const dbStats = metrics.getDBWriteStatsSince(Date.now() - 60_000)
  for (const [tableName, stat] of Object.entries(dbStats)) {
    await upsertDBWriteStat({
      bucketStart,
      tableName,
      rowsWritten: stat.rowsWritten,
      writeErrors: stat.writeErrors,
      avgMs: stat.avgMs,
    })
  }
}

async function flushHourly(summary: HourlySummary): Promise<void> {
  await insertHourlySummary({
    hourStart: summary.hourStart,
    totalApiRequests: summary.apiRequests,
    total429s: summary.total429s,
    totalMatchesProcessed: summary.matchesProcessed,
    totalPlayersUpdated: summary.playersUpdated,
    totalRanksFetched: summary.ranksFetched,
    totalDbRowsWritten: summary.dbRowsWritten,
    totalErrors: summary.errors,
    avgRequestsPer120s: summary.avgRequestsPer120s,
    minRequestsPer120s: summary.minRequestsPer120s,
    maxRequestsPer120s: summary.maxRequestsPer120s,
    headroomAvg: summary.headroomAvg,
  })
}

async function flushError(sample: ErrorSample): Promise<void> {
  await insertObsError({
    stage: sample.stage,
    errorType: sample.errorType,
    message: sample.message,
    context: sample.context,
    matchId: sample.matchId,
    puuid: sample.puuid,
  })
}

export function startMetricsFlush(): void {
  if (started) return
  started = true

  metrics.on('window_complete', (window: WindowSnapshot) => {
    void flushWindow(window).catch((error) => {
      obsLogger.error({ err: error }, '[obs] window flush failed')
    })
  })

  metrics.on('hourly_complete', (summary: HourlySummary) => {
    void flushHourly(summary)
      .then(() => {
        obsLogger.info({ summary }, '[obs] Résumé horaire enregistré')
      })
      .catch((error) => {
        obsLogger.error({ err: error }, '[obs] hourly flush failed')
      })
  })

  metrics.on('error_event', (sample: ErrorSample) => {
    void flushError(sample).catch((error) => {
      obsLogger.error({ err: error }, '[obs] error flush failed')
    })
  })

  stageFlushTimer = setInterval(() => {
    void flushStagesAndDb().catch((error) => {
      obsLogger.error({ err: error }, '[obs] minute flush failed')
    })
  }, 60_000)
}

export function stopMetricsFlush(): void {
  if (stageFlushTimer) {
    clearInterval(stageFlushTimer)
    stageFlushTimer = null
  }
  started = false
}
