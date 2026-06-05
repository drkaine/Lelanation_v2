import { getLatestResolvedSince } from '../../poll-orchestration/sinceContext.js';
import { riotConfig } from '../../riot-gateway/config/riotConfig.js';
import { PollerTuner } from '../../tuner/PollerTuner.js';
import { pollerMetricsLogger } from './logger.js';
import type { MetricsStore } from './MetricsStore.js';
import type {
  Alert,
  AlertHistoryObservability,
  AlertSeverity,
  AlertType,
  FullSnapshot,
  IngestionSkipReason,
} from './types.js';
import { INGESTION_SKIP_REASONS } from './types.js';

function backpressureThreshold(): number {
  return Number.parseInt(process.env.BACKPRESSURE_THRESHOLD ?? '500', 10);
}

function dbSlowThresholdMs(): number {
  return Number.parseInt(process.env.DB_SLOW_THRESHOLD_MS ?? '1000', 10);
}

function pollStallThresholdMs(): number {
  return Number.parseInt(process.env.POLL_STALL_THRESHOLD_MS ?? '300000', 10);
}

function warmupSessions(): number {
  return Number.parseInt(process.env.TUNER_WARMUP_SESSIONS ?? '5', 10);
}

export class AlertDetector {
  private readonly active = new Map<AlertType, Alert>();
  private prevQueueDepthAvg = 0;
  private fullHistoryAlertFired = false;

  constructor(private readonly store: MetricsStore) {}

  check(snapshot: FullSnapshot): Alert[] {
    this.evaluate(snapshot);
    return this.getActive();
  }

  getActive(): Alert[] {
    return [...this.active.values()];
  }

  getAlertHistory(windowMs: number): AlertHistoryObservability {
    const events = this.store.alertLifecycle.inWindow(windowMs);
    const raisedAt = new Map<AlertType, number>();
    const firstSeenAt = new Map<AlertType, number>();
    const counts = new Map<AlertType, number>();
    const durations = new Map<AlertType, number>();

    for (const event of events) {
      if (event.event === 'raised') {
        if (!firstSeenAt.has(event.type)) {
          firstSeenAt.set(event.type, event.ts);
        }
        raisedAt.set(event.type, event.ts);
        counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
      } else if (event.event === 'cleared') {
        const start = raisedAt.get(event.type);
        if (start != null) {
          durations.set(event.type, (durations.get(event.type) ?? 0) + (event.ts - start));
          raisedAt.delete(event.type);
        }
      }
    }

    const last24h = [...counts.entries()]
      .map(([type, count]) => ({
        type,
        count,
        totalDurationMs: durations.get(type) ?? 0,
        firstSeen: new Date(firstSeenAt.get(type) ?? Date.now()).toISOString(),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      last24h,
      mostFrequent: last24h[0]?.type ?? null,
    };
  }

  private evaluate(snapshot: FullSnapshot): void {
    const g = snapshot.gateway;
    const p = snapshot.poll;
    const ing = snapshot.ingestion;

    this.checkTooMany429s(g.total_429s, g.total_wait_ms_from_429);
    this.checkTokenUnderutilized(snapshot);
    this.checkTokenNearLimit(g.avg_token_pct_120s, g.peak_req_per_120s, g.times_limit_reached);
    this.checkIngestionLag(ing.queue_depth_peak, ing.queue_depth_avg, ing.matches_queued, ing.matches_ingested);
    this.checkIngestionFailureRate(
      ing.ingestion_success_rate_pct,
      ing.matches_ingested,
      ing.matches_failed_terminal,
      ing.matches_failed_attempts,
    );
    this.checkRankGap(p.ranks_failed, p.ranks_fetched);
    this.checkMatchSkipRateHigh(p.match_skip_rate_pct, p.match_ids_discovered, p.match_ids_new);
    this.checkPollStall();
    this.checkDbSlow(ing.slowest_db_ops);
    this.checkIngestionMissingData(ing.skip_breakdown, ing.matches_queued, ing.matches_skipped_total);
    this.checkFullHistoryModeReached();

    snapshot.active_alerts = this.getActive();
  }

  private checkFullHistoryModeReached(): void {
    const currentMode = getLatestResolvedSince()?.mode;
    if (currentMode === 'prod_full_history' && !this.fullHistoryAlertFired) {
      this.fullHistoryAlertFired = true;
      pollerMetricsLogger.info(
        {
          component: 'AlertDetector',
          event: 'full_history_mode_reached',
        },
        'All players polled within 24h — now fetching full history since FULL_HISTORY_SINCE_DATE',
      );
    }
  }

  private raise(type: AlertType, severity: AlertSeverity, message: string, data: Record<string, unknown>): void {
    if (this.active.has(type)) return;
    const now = Date.now();
    const alert: Alert = { type, severity, message, since: now, data };
    this.active.set(type, alert);
    this.store.pushAlertLifecycle({ ts: now, type, event: 'raised' });
    pollerMetricsLogger[severity === 'error' ? 'error' : 'warn'](
      { component: 'AlertDetector', alert: type, ...data },
      message,
    );
  }

  private clear(type: AlertType): void {
    if (this.active.delete(type)) {
      this.store.pushAlertLifecycle({ ts: Date.now(), type, event: 'cleared' });
      pollerMetricsLogger.info({ component: 'AlertDetector', alert: type }, 'alert cleared');
    }
  }

  private checkTooMany429s(total429s: number, totalWaitMs: number): void {
    if (total429s > 0) {
      this.raise(
        'too_many_429s',
        total429s > 5 ? 'error' : 'warn',
        '429s detected in last 10 minutes',
        { count: total429s, total_wait_ms: totalWaitMs },
      );
    } else {
      this.clear('too_many_429s');
    }
  }

  private checkTokenUnderutilized(snapshot: FullSnapshot): void {
    const avgPct = snapshot.gateway.avg_token_pct_120s;
    const tuner = PollerTuner.getInstance().getSnapshot();
    const sessionCount = tuner.sessionCount;
    const emaReq = tuner.ema.reqPerPlayer;
    const sinceMode = snapshot.since?.mode ?? 'unknown';
    const underutilizationActionable = sinceMode !== 'personal_24h';

    const personal = riotConfig.apiKeyType === 'personal';
    const targetPct = personal ? riotConfig.personalTargetUtilizationPct * 100 : 30;
    const warnBelow = personal ? targetPct - 7 : targetPct;
    const underThreshold = avgPct < warnBelow && sessionCount > warmupSessions();

    if (underThreshold && underutilizationActionable) {
      this.raise('token_underutilized', 'warn', 'tokens under-utilized — possible EMA miscalibration or pool exhausted', {
        avg_pct: avgPct,
        sinceMode,
        target_pct: targetPct,
        ema_reqPerPlayer: emaReq,
      });
    } else if (underThreshold && !underutilizationActionable) {
      if (this.active.has('token_underutilized')) {
        this.clear('token_underutilized');
        pollerMetricsLogger.info(
          {
            component: 'AlertDetector',
            event: 'token_underutilized_suppressed',
            sinceMode,
            avg_pct: avgPct,
          },
          'token underutilized in personal_24h mode — expected, not alerting',
        );
      }
    } else if (avgPct >= warnBelow) {
      this.clear('token_underutilized');
    }
  }

  private checkTokenNearLimit(avgPct: number, peakReq: number, timesLimit: number): void {
    if (avgPct > 90) {
      this.raise('token_near_limit', 'warn', 'approaching rate limit — consider raising SAFETY_MARGIN', {
        avg_pct: avgPct,
        peak_req_per_120s: peakReq,
        times_limit_reached: timesLimit,
      });
    } else if (avgPct < 85) {
      this.clear('token_near_limit');
    }
  }

  private checkIngestionLag(peak: number, avg: number, queued: number, ingested: number): void {
    const threshold = backpressureThreshold();
    const growing = this.prevQueueDepthAvg > 0 && avg > this.prevQueueDepthAvg * 1.2;
    this.prevQueueDepthAvg = avg;

    if (peak > threshold * 0.8 && growing) {
      this.raise(
        'ingestion_lag',
        peak >= threshold ? 'error' : 'warn',
        'ingestion queue building up — possible worker slowdown',
        { queue_depth_peak: peak, queue_depth_avg: avg, matches_queued: queued, matches_ingested: ingested },
      );
    } else if (avg < threshold * 0.5) {
      this.clear('ingestion_lag');
    }
  }

  private checkIngestionFailureRate(
    successPct: number,
    ingested: number,
    terminalFailed: number,
    failedAttempts: number,
  ): void {
    const total = ingested + terminalFailed;
    if (successPct < 95 && total > 10 && terminalFailed > 0) {
      this.raise('ingestion_failure_rate', 'error', 'ingestion failure rate above threshold', {
        success_rate_pct: successPct,
        failures_terminal: terminalFailed,
        failures_attempts: failedAttempts,
        sample_size: total,
      });
    } else if (successPct >= 98 || terminalFailed === 0) {
      this.clear('ingestion_failure_rate');
    }
  }

  private checkRankGap(failed: number, fetched: number): void {
    const rate = (failed / Math.max(1, fetched + failed)) * 100;
    if (rate > 10) {
      this.raise('rank_gap', 'warn', 'rank fetch failure rate elevated', {
        failed,
        fetched,
        failure_rate_pct: rate,
      });
    } else if (rate < 5) {
      this.clear('rank_gap');
    }
  }

  private checkMatchSkipRateHigh(skipPct: number, discovered: number, newMatches: number): void {
    if (skipPct > 98 && discovered > 50) {
      this.raise('match_skip_rate_high', 'warn', 'nearly all matches already in DB — pool may be up to date or stalled', {
        skip_rate_pct: skipPct,
        discovered,
        new: newMatches,
      });
    } else if (skipPct < 95) {
      this.clear('match_skip_rate_high');
    }
  }

  private checkPollStall(): void {
    const last = this.store.pollSession.latest();
    const ago = last ? Date.now() - last.ts : Number.POSITIVE_INFINITY;
    if (ago > pollStallThresholdMs()) {
      this.raise('poll_stall', 'error', 'no poll session completed in 5 minutes', {
        last_session_ago_ms: ago,
        last_session_id: last?.sessionId,
      });
    } else {
      this.clear('poll_stall');
    }
  }

  private checkDbSlow(slowest: Array<{ operation: string; p95_ms: number }>): void {
    const threshold = dbSlowThresholdMs();
    const worst = slowest[0];
    if (worst && worst.p95_ms > threshold) {
      this.raise(
        'db_slow',
        worst.p95_ms >= 2000 ? 'error' : 'warn',
        'DB operation slow',
        { operation: worst.operation, p95_ms: worst.p95_ms },
      );
    } else if (!worst || worst.p95_ms < threshold * 0.8) {
      this.clear('db_slow');
    }
  }

  private checkIngestionMissingData(
    breakdown: Record<IngestionSkipReason, number>,
    matchesQueued: number,
    matchesSkippedTotal: number,
  ): void {
    const skipRatePct = (matchesSkippedTotal / Math.max(1, matchesQueued)) * 100;
    const entries = INGESTION_SKIP_REASONS.map((reason) => ({ reason, count: breakdown[reason] ?? 0 }));
    const totalSkipped = entries.reduce((sum, e) => sum + e.count, 0);

    if (skipRatePct > 5 && totalSkipped > 0) {
      const top = [...entries].sort((a, b) => b.count - a.count)[0]!;
      this.raise('ingestion_missing_data', 'warn', 'ingestion queue skip rate above threshold', {
        skip_breakdown: breakdown,
        most_common_reason: top.reason,
        count: top.count,
        skip_rate_pct: skipRatePct,
        matches_queued: matchesQueued,
        matches_skipped_total: matchesSkippedTotal,
      });
    } else {
      this.clear('ingestion_missing_data');
    }
  }
}
