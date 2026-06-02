import { avgEventsPer120s, mean, peakEventsPer120s, percentileOf } from './math.js';
import type { MetricsStore } from './MetricsStore.js';
import type {
  FullSnapshot,
  GatewayAggregate,
  IngestionAggregate,
  IngestionSkipReason,
  PollAggregate,
  WindowLabel,
} from './types.js';
import { computeIngestionOutcomeStats } from './ingestionOutcomeStats.js';
import { WINDOW_MS, emptySkipBreakdown } from './types.js';

export class AggregateComputer {
  constructor(private readonly store: MetricsStore) {}

  computeGateway(window: WindowLabel, _limit120s: number): GatewayAggregate {
    const windowMs = WINDOW_MS[window];
    const events = this.store.gateway.inWindow(windowMs);
    const tokenSnaps = this.store.tokenSnap.inWindow(windowMs);
    const saturations = this.store.saturation.inWindow(windowMs);

    const latencies = events.map((e) => e.latencyMs);

    return {
      window,
      avg_req_per_120s: avgEventsPer120s(events),
      peak_req_per_120s: peakEventsPer120s(events),
      total_requests: events.length,
      times_limit_reached: saturations.length,
      total_429s: events.filter((e) => e.is429).length,
      total_wait_ms_from_429: saturations.reduce((sum, e) => sum + e.waitMs, 0),
      latency_p50_ms: percentileOf(latencies, 0.5),
      latency_p95_ms: percentileOf(latencies, 0.95),
      latency_p99_ms: percentileOf(latencies, 0.99),
      avg_token_pct_120s: mean(tokenSnaps.map((s) => s.pct_120s)),
      avg_token_pct_1s: mean(tokenSnaps.map((s) => s.pct_1s)),
    };
  }

  computePoll(window: WindowLabel): PollAggregate {
    const windowMs = WINDOW_MS[window];
    const players = this.store.playerEvents.inWindow(windowMs);
    const ranks = this.store.rankEvents.inWindow(windowMs);
    const discoveries = this.store.matchDiscovery.inWindow(windowMs);
    const fetches = this.store.matchFetch.inWindow(windowMs);

    const ranksSkippedDb = ranks.filter((e) => e.type === 'skipped_db').length;
    const ranksSkippedCache = ranks.filter((e) => e.type === 'skipped_cache').length;
    const matchSkippedMemory = discoveries.filter((e) => e.type === 'skipped_memory').length;
    const matchSkippedDb = discoveries.filter((e) => e.type === 'skipped_db').length;
    const matchNew = discoveries.filter((e) => e.type === 'new').length;
    const matchDiscovered = discoveries.length;

    const successFetches = fetches.filter((e) => e.success);
    const successLatencies = successFetches.map((e) => e.latencyMs);

    return {
      window,
      players_polled: players.filter((e) => e.type === 'polled').length,
      players_new_added: players.filter((e) => e.type === 'new_added').length,
      ranks_fetched: ranks.filter((e) => e.type === 'fetched').length,
      ranks_skipped_db: ranksSkippedDb,
      ranks_skipped_cache: ranksSkippedCache,
      ranks_failed: ranks.filter((e) => e.type === 'failed').length,
      rank_skip_rate_pct: (ranksSkippedDb + ranksSkippedCache) / Math.max(1, ranks.length) * 100,
      match_ids_discovered: matchDiscovered,
      match_ids_skipped_memory: matchSkippedMemory,
      match_ids_skipped_db: matchSkippedDb,
      match_ids_new: matchNew,
      match_skip_rate_pct: (matchSkippedMemory + matchSkippedDb) / Math.max(1, matchDiscovered) * 100,
      matches_fetched_success: successFetches.length,
      matches_fetched_failed: fetches.filter((e) => !e.success).length,
      match_fetch_latency_p50_ms: percentileOf(successLatencies, 0.5),
      match_fetch_latency_p95_ms: percentileOf(successLatencies, 0.95),
    };
  }

  computeIngestion(window: WindowLabel): IngestionAggregate {
    const windowMs = WINDOW_MS[window];
    const queued = this.store.ingestionQueue.inWindow(windowMs);
    const workers = this.store.ingestionWorker.inWindow(windowMs);
    const dbOps = this.store.dbOperations.inWindow(windowMs);
    const depths = this.store.queueDepth.inWindow(windowMs);

    const skipBreakdown = emptySkipBreakdown();
    for (const event of queued.filter((e) => e.type === 'skipped' && e.skipReason)) {
      const reason = event.skipReason as IngestionSkipReason;
      skipBreakdown[reason] = (skipBreakdown[reason] ?? 0) + 1;
    }

    const completed = workers.filter((e) => e.type === 'completed');
    const outcomeStats = computeIngestionOutcomeStats(workers);
    const ingested_processed = completed.filter(
      (e) => e.completedReason === 'processed' || e.completedReason === undefined,
    ).length;
    const ingested_already_done = completed.filter(
      (e) => e.completedReason === 'already_done',
    ).length;
    const ingested = ingested_processed + ingested_already_done;
    const failedCount = outcomeStats.matches_failed_terminal;
    const ingestionLatencies = completed.map((e) => e.durationMs ?? 0);
    const dbLatencies = dbOps.filter((e) => e.success).map((e) => e.durationMs);

    const byOp = new Map<string, number[]>();
    for (const op of dbOps) {
      const list = byOp.get(op.operation) ?? [];
      list.push(op.durationMs);
      byOp.set(op.operation, list);
    }
    const slowest_db_ops = [...byOp.entries()]
      .map(([operation, durations]) => ({
        operation,
        p95_ms: percentileOf(durations, 0.95),
      }))
      .sort((a, b) => b.p95_ms - a.p95_ms)
      .slice(0, 5);

    const matchesQueued = queued.filter((e) => e.type === 'queued').length;
    const matchesSkipped = queued.filter((e) => e.type === 'skipped').length;

    return {
      window,
      matches_queued: matchesQueued,
      matches_skipped_total: matchesSkipped,
      skip_breakdown: skipBreakdown,
      queue_skip_rate_pct: matchesSkipped / Math.max(1, matchesQueued + matchesSkipped) * 100,
      matches_ingested: ingested,
      ingested_processed,
      ingested_already_done,
      matches_failed: failedCount,
      matches_failed_attempts: outcomeStats.matches_failed_attempts,
      matches_failed_terminal: outcomeStats.matches_failed_terminal,
      failure_top_errors: outcomeStats.failure_top_errors,
      ingestion_success_rate_pct: ingested / Math.max(1, ingested + failedCount) * 100,
      ingestion_latency_p50_ms: percentileOf(ingestionLatencies, 0.5),
      ingestion_latency_p95_ms: percentileOf(ingestionLatencies, 0.95),
      ingestion_latency_p99_ms: percentileOf(ingestionLatencies, 0.99),
      db_op_latency_p50_ms: percentileOf(dbLatencies, 0.5),
      db_op_latency_p95_ms: percentileOf(dbLatencies, 0.95),
      slowest_db_ops,
      queue_depth_avg: mean(depths.map((d) => d.total)),
      queue_depth_peak: depths.length > 0 ? Math.max(...depths.map((d) => d.total)) : 0,
    };
  }

  computeFull(window: WindowLabel, limit120s: number, _limit1s: number, activeAlerts: FullSnapshot['active_alerts']): FullSnapshot {
    const gateway = this.computeGateway(window, limit120s);
    const poll = this.computePoll(window);
    const ingestion = this.computeIngestion(window);

    const matchesIngestedVsFetched =
      poll.matches_fetched_success > 0
        ? (ingestion.matches_ingested / poll.matches_fetched_success) * 100
        : 100;

    const ranksDenom = poll.ranks_fetched + poll.ranks_skipped_db;

    return {
      ts: Date.now(),
      uptime_ms: this.store.getUptimeMs(),
      window,
      gateway,
      poll,
      ingestion,
      ratios: {
        matches_ingested_vs_fetched_pct: matchesIngestedVsFetched,
        matches_skipped_vs_discovered_pct: poll.match_skip_rate_pct,
        ranks_coverage_pct: ranksDenom > 0 ? (poll.ranks_fetched / ranksDenom) * 100 : 0,
        token_efficiency_pct: gateway.avg_token_pct_120s,
      },
      active_alerts: activeAlerts,
    };
  }
}
