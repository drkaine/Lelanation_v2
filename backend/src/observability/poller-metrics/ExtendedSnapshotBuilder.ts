import type { Queue } from 'bullmq';
import { sql } from '../../db/client.js';
import { getSessionPoolStatus } from '../../poll-orchestration/sessionPoolStatus.js';
import { PollerTuner } from '../../tuner/PollerTuner.js';
import type { AlertDetector } from './AlertDetector.js';
import { mean } from './math.js';
import type { MetricsStore } from './MetricsStore.js';
import { timedDbOp } from './timedDbOp.js';
import type {
  DataQualityObservability,
  FullSnapshot,
  IngestionThroughputObservability,
  PatchObservability,
  PlayerPoolObservability,
  SessionPoolObservability,
  TunerObservability,
  WindowLabel,
} from './types.js';
import { WINDOW_MS } from './types.js';

function scaleToPerHour(value: number, window: WindowLabel): number {
  const windowHours = WINDOW_MS[window] / (60 * 60 * 1000);
  return windowHours > 0 ? value / windowHours : 0;
}

function backpressureThreshold(): number {
  return Number.parseInt(process.env.BACKPRESSURE_THRESHOLD ?? '500', 10);
}

export class ExtendedSnapshotBuilder {
  constructor(
    private readonly store: MetricsStore,
    private readonly alertDetector: AlertDetector,
  ) {}

  async enrich(snapshot: FullSnapshot): Promise<FullSnapshot> {
    const tuner = this.buildTuner();
    const sessionPool = this.buildSessionPool(snapshot);
    const dataQuality = this.buildDataQuality(snapshot);
    const alertHistory = this.alertDetector.getAlertHistory(WINDOW_MS['24h']);
    const ingestionThroughput = await this.buildIngestionThroughput(snapshot);

    const includeDbSections = snapshot.window === '10m' || snapshot.window === '1h';
    const [playerPool, byPatch] = includeDbSections
      ? await Promise.all([this.buildPlayerPool(snapshot), this.buildByPatch()])
      : [undefined, undefined];

    return {
      ...snapshot,
      tuner,
      sessionPool,
      playerPool,
      dataQuality,
      ingestionThroughput,
      byPatch,
      alertHistory,
    };
  }

  private buildTuner(): TunerObservability {
    const snap = PollerTuner.getInstance().getSnapshot();
    const params = snap.params;
    return {
      batchSize: params?.batchSize ?? 0,
      maxConcurrentSessions: params?.maxConcurrentSessions ?? snap.concurrent?.maxConcurrentSessions ?? 0,
      maxConcurrentMatchFetches: params?.maxConcurrentMatchFetches ?? 0,
      ema_reqPerPlayer: snap.ema.reqPerPlayer,
      ema_matchLatencyMs: snap.ema.matchLatencyMs,
      utilizationCorrection: snap.utilizationCorrection,
      ratchetActive: snap.ratchet.ratchetActive,
      effectiveSafetyMargin: snap.ratchet.effectiveSafetyMargin,
      sessionCount: snap.sessionCount,
      warmupActive: params?.warmupActive ?? false,
    };
  }

  private buildSessionPool(snapshot: FullSnapshot): SessionPoolObservability {
    const windowMs = WINDOW_MS[snapshot.window];
    const completed = this.store.sessionPool
      .inWindow(windowMs)
      .filter((e) => e.type === 'session_completed');

    const durations = completed.map((e) => e.durationMs ?? 0).filter((d) => d > 0);
    const requests = completed.map((e) => e.gatewayRequests ?? 0);
    const playersCompleted = completed.reduce((sum, e) => sum + (e.playersCompleted ?? 0), 0);
    const totalDurationMs = durations.reduce((sum, d) => sum + d, 0);

    const live = getSessionPoolStatus();

    return {
      sessionAvgDurationMs: mean(durations),
      sessionAvgRequests: mean(requests),
      sessionThroughputPlayersPerMin:
        totalDurationMs > 0 ? playersCompleted / (totalDurationMs / 60_000) : 0,
      playerQueueRefills: live?.playerQueueRefills ?? 0,
      playerQueueHighWaterMark: live?.playerQueueHighWaterMark ?? 0,
      gatewayQueuePeakDuringSession:
        completed.length > 0
          ? Math.max(...completed.map((e) => e.gatewayQueuePeak ?? 0))
          : 0,
      activeSessions: live?.activeSessions ?? 0,
      playerQueueSize: live?.queueSize ?? 0,
    };
  }

  private buildDataQuality(snapshot: FullSnapshot): DataQualityObservability {
    const { poll, ingestion } = snapshot;
    const tuner = PollerTuner.getInstance().getSnapshot();
    const naturalLatencyMs = tuner.ema.matchLatencyMs;

    const matchDiscovered = Math.max(1, poll.match_ids_discovered);
    const matchFetched = poll.matches_fetched_success + poll.matches_fetched_failed;
    const matchesQueued = Math.max(1, ingestion.matches_queued);

    const errors24h = this.store.ingestionWorker.inWindow(WINDOW_MS['24h']);
    const outcomeErrors = new Map<string, number>();
    for (const event of errors24h.filter((e) => e.type === 'failed')) {
      const message = String(event.errorMessage ?? 'unknown').trim() || 'unknown';
      outcomeErrors.set(message, (outcomeErrors.get(message) ?? 0) + 1);
    }
    const topErrorsLast24h = [...outcomeErrors.entries()]
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const observedP50 = poll.match_fetch_latency_p50_ms;
    const queueWait = Math.max(0, observedP50 - naturalLatencyMs);

    return {
      matchReuseRatePct:
        ((poll.match_ids_skipped_memory + poll.match_ids_skipped_db) / matchDiscovered) * 100,
      matchFetchSuccessRatePct:
        matchFetched > 0 ? (poll.matches_fetched_success / matchFetched) * 100 : 100,
      unrankedMatchRatePct: (ingestion.rank_unranked_fallback / matchesQueued) * 100,
      rankDbFallbackRatePct: (ingestion.rank_resolved_from_db / matchesQueued) * 100,
      ingestionRetryRateAvg:
        ingestion.matches_ingested > 0
          ? ingestion.matches_failed_attempts / ingestion.matches_ingested
          : 0,
      topErrorsLast24h,
      matchNaturalLatencyEstimateMs: naturalLatencyMs,
      matchQueueWaitEstimateMs: queueWait,
    };
  }

  private async buildIngestionThroughput(
    snapshot: FullSnapshot,
  ): Promise<IngestionThroughputObservability> {
    const windowMs = WINDOW_MS[snapshot.window];
    const workers = this.store.ingestionWorker.inWindow(windowMs);
    const completed = workers.filter((e) => e.type === 'completed');
    const completedDurations = completed.map((e) => e.durationMs ?? 0).filter((d) => d > 0);

    let champStatsRows = 0;
    for (const event of completed) {
      champStatsRows += event.tablesWritten?.participants ?? 0;
    }
    if (champStatsRows === 0 && snapshot.ingestion.ingested_processed > 0) {
      champStatsRows = snapshot.ingestion.ingested_processed * 20;
    }

    const threshold = backpressureThreshold();
    const saturation =
      threshold > 0 ? (snapshot.ingestion.queue_depth_peak / threshold) * 100 : 0;

    let failedJobsAccumulated = 0;
    let failedJobsOldestAgeSec: number | null = null;

    if (snapshot.window === '10m' || snapshot.window === '1h') {
      try {
        const { ingestionQueue } = await import('../../queues/index.js');
        const counts = await ingestionQueue.getJobCounts('failed');
        failedJobsAccumulated = counts.failed ?? 0;
        if (failedJobsAccumulated > 0) {
          failedJobsOldestAgeSec = await this.oldestFailedJobAgeSec(ingestionQueue);
        }
      } catch {
        // Redis/BullMQ unavailable — leave defaults
      }
    }

    return {
      matchesProcessedPerHour: scaleToPerHour(snapshot.ingestion.ingested_processed, snapshot.window),
      champStatsRowsWrittenPerHour: scaleToPerHour(champStatsRows, snapshot.window),
      ingestionWorkerAvgMs: mean(completedDurations),
      ingestionQueueSaturationPct: saturation,
      failedJobsAccumulated,
      failedJobsOldestAgeSec,
    };
  }

  private async oldestFailedJobAgeSec(queue: Queue): Promise<number | null> {
    const jobs = await queue.getJobs(['failed'], 0, 99, true);
    if (jobs.length === 0) return null;
    const oldestTs = Math.min(
      ...jobs.map((job) => job.finishedOn ?? job.processedOn ?? job.timestamp ?? Date.now()),
    );
    return Math.max(0, Math.floor((Date.now() - oldestTs) / 1000));
  }

  private async buildPlayerPool(_snapshot: FullSnapshot): Promise<PlayerPoolObservability> {
    const players24h = this.store.playerEvents
      .inWindow(WINDOW_MS['24h'])
      .filter((e) => e.type === 'polled').length;
    const newPlayers24h = this.store.playerEvents
      .inWindow(WINDOW_MS['24h'])
      .filter((e) => e.type === 'new_added').length;

    const rows = await timedDbOp('obs_player_pool_stats', () =>
      sql<
        Array<{
          total: number;
          never_seen: number;
          avg_age_hours: number | string | null;
          oldest_age_hours: number | string | null;
        }>
      >`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE last_seen IS NULL)::int AS never_seen,
          AVG(EXTRACT(EPOCH FROM (NOW() - last_seen)) / 3600)
            FILTER (WHERE last_seen IS NOT NULL) AS avg_age_hours,
          MAX(EXTRACT(EPOCH FROM (NOW() - last_seen)) / 3600)
            FILTER (WHERE last_seen IS NOT NULL) AS oldest_age_hours
        FROM players
        WHERE region IS NOT NULL
          AND LENGTH(TRIM(puuid)) > 0
      `,
    );

    const row = rows[0];
    const totalPlayersInDb = Number(row?.total ?? 0);
    const playersPolledLast24h = players24h;
    const playersPerHour = playersPolledLast24h / 24;

    return {
      totalPlayersInDb,
      playersPolledLast24h,
      poolCoverage24hPct:
        totalPlayersInDb > 0 ? (playersPolledLast24h / totalPlayersInDb) * 100 : 0,
      cycleTimeEstimatedHours:
        playersPerHour > 0 ? totalPlayersInDb / playersPerHour : 0,
      newPlayersDiscoveryRatePct:
        playersPolledLast24h > 0 ? (newPlayers24h / playersPolledLast24h) * 100 : 0,
      avgLastSeenAgeHours: Number(row?.avg_age_hours ?? 0),
      oldestLastSeenAgeHours: Number(row?.oldest_age_hours ?? 0),
      neverSeenCount: Number(row?.never_seen ?? 0),
    };
  }

  private async buildByPatch(): Promise<Record<string, PatchObservability>> {
    const [patchRows, playersWithRankToday] = await Promise.all([
      timedDbOp('obs_by_patch_stats', () =>
        sql<
          Array<{
            patch: string;
            matches_processed: number;
            matches_failed: number;
            matches_pending: number;
            first_seen_at: Date | string | null;
          }>
        >`
          SELECT
            patch,
            COUNT(*) FILTER (WHERE UPPER(TRIM(status)) = 'DONE')::int AS matches_processed,
            COUNT(*) FILTER (WHERE UPPER(TRIM(status)) = 'ERROR')::int AS matches_failed,
            COUNT(*) FILTER (WHERE LOWER(TRIM(status)) IN ('pending', 'p'))::int AS matches_pending,
            MIN(created_at) AS first_seen_at
          FROM processed_matches
          GROUP BY patch
          ORDER BY patch DESC
        `,
      ),
      timedDbOp('obs_players_rank_today', () =>
        sql<Array<{ count: number }>>`
          SELECT COUNT(DISTINCT puuid)::int AS count
          FROM player_rank_history
          WHERE date = CURRENT_DATE
        `,
      ),
    ]);

    const rankToday = Number(playersWithRankToday[0]?.count ?? 0);
    const byPatch: Record<string, PatchObservability> = {};

    for (const row of patchRows) {
      const patch = String(row.patch ?? '').trim();
      if (!patch) continue;
      const firstSeen = row.first_seen_at;
      byPatch[patch] = {
        matchesProcessed: Number(row.matches_processed ?? 0),
        matchesFailed: Number(row.matches_failed ?? 0),
        matchesPending: Number(row.matches_pending ?? 0),
        playersWithRankToday: rankToday,
        firstSeenAt: firstSeen != null ? new Date(firstSeen).toISOString() : null,
      };
    }

    return byPatch;
  }
}
