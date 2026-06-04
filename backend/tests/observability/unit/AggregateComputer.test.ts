import { beforeEach, describe, expect, test } from 'vitest';
import { AggregateComputer } from '../../../src/observability/poller-metrics/AggregateComputer.js';
import { MetricsStore } from '../../../src/observability/poller-metrics/MetricsStore.js';

describe('AggregateComputer', () => {
  beforeEach(() => {
    MetricsStore.resetInstance();
  });

  test('T1 total_requests counts gateway events', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) {
      store.pushGatewayRequest({
        ts: now - i * 1000,
        latencyMs: 100,
        methodKey: 'm',
        statusCode: 200,
        is429: false,
        isError: false,
        tokensUsed_120s: 1,
        tokensUsed_1s: 1,
        limit_120s: 99,
        limit_1s: 19,
      });
    }
    const agg = new AggregateComputer(store).computeGateway('10m', 99);
    expect(agg.total_requests).toBe(5);
  });

  test('rank_resolved_from_db and rank_unranked_fallback from queue rankSource', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) {
      store.pushIngestionQueue({
        ts: now,
        matchId: `DB${i}`,
        patch: '16.11',
        rank: 'GOLD',
        type: 'queued',
        rankSource: 'db_fallback',
      });
    }
    for (let i = 0; i < 2; i += 1) {
      store.pushIngestionQueue({
        ts: now,
        matchId: `UN${i}`,
        patch: '16.11',
        rank: 'UNRANKED',
        type: 'queued',
        rankSource: 'unranked_fallback',
      });
    }
    const ing = new AggregateComputer(store).computeIngestion('10m');
    expect(ing.rank_resolved_from_db).toBe(5);
    expect(ing.rank_unranked_fallback).toBe(2);
  });

  test('T5 skip_breakdown from ingestion queue events', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    store.pushIngestionQueue({
      ts: now,
      matchId: 'M1',
      patch: '16.11',
      rank: 'GOLD',
      type: 'skipped',
      skipReason: 'missing_rank',
    });
    store.pushIngestionQueue({
      ts: now,
      matchId: 'M2',
      patch: '16.11',
      rank: 'GOLD',
      type: 'queued',
    });
    const ing = new AggregateComputer(store).computeIngestion('10m');
    expect(ing.skip_breakdown.missing_rank).toBe(1);
    expect(ing.matches_queued).toBe(1);
  });

  test('T2 total_429s counts gateway 429 events', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    store.pushGatewayRequest({
      ts: now,
      latencyMs: 1,
      methodKey: 'm',
      statusCode: 429,
      is429: true,
      isError: true,
      tokensUsed_120s: 0,
      tokensUsed_1s: 0,
      limit_120s: 99,
      limit_1s: 19,
    });
    store.pushGatewayRequest({
      ts: now,
      latencyMs: 1,
      methodKey: 'm',
      statusCode: 200,
      is429: false,
      isError: false,
      tokensUsed_120s: 1,
      tokensUsed_1s: 1,
      limit_120s: 99,
      limit_1s: 19,
    });
    const agg = new AggregateComputer(store).computeGateway('10m', 99);
    expect(agg.total_429s).toBe(1);
  });

  test('T6 match_skip_rate 100% when all skipped', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    store.pushMatchDiscovery({ ts: now, puuid: 'p', matchId: 'M1', type: 'skipped_db' });
    store.pushMatchDiscovery({ ts: now, puuid: 'p', matchId: 'M2', type: 'skipped_memory' });
    const poll = new AggregateComputer(store).computePoll('10m');
    expect(poll.match_skip_rate_pct).toBe(100);
  });

  test('T7 match_skip_rate 0% when all new', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    store.pushMatchDiscovery({ ts: now, puuid: 'p', matchId: 'M1', type: 'new' });
    store.pushMatchDiscovery({ ts: now, puuid: 'p', matchId: 'M2', type: 'new' });
    const poll = new AggregateComputer(store).computePoll('10m');
    expect(poll.match_skip_rate_pct).toBe(0);
  });

  test('T8 matches_ingested_vs_fetched ratio', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    for (let i = 0; i < 10; i += 1) {
      store.pushMatchFetch({
        ts: now,
        matchId: `M${i}`,
        patch: '16.11',
        success: true,
        latencyMs: 100,
      });
    }
    for (let i = 0; i < 9; i += 1) {
      store.pushIngestionWorker({
        ts: now,
        matchId: `M${i}`,
        patch: '16.11',
        rank: 'GOLD',
        type: 'completed',
        durationMs: 50,
      });
    }
    const snap = new AggregateComputer(store).computeFull('10m', 99, 19, []);
    expect(snap.poll.matches_fetched_success).toBe(10);
    expect(snap.ingestion.matches_ingested).toBe(9);
    expect(snap.ratios.matches_ingested_vs_fetched_pct).toBe(90);
  });

  test('T9 slowest_db_ops sorted by p95', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    for (let i = 0; i < 10; i += 1) {
      store.pushDbOperation({ ts: now, operation: 'fast_op', durationMs: 10, success: true });
    }
    for (let i = 0; i < 10; i += 1) {
      store.pushDbOperation({ ts: now, operation: 'slow_op', durationMs: 2000, success: true });
    }
    const ing = new AggregateComputer(store).computeIngestion('10m');
    expect(ing.slowest_db_ops[0]?.operation).toBe('slow_op');
    expect(ing.slowest_db_ops.length).toBeLessThanOrEqual(5);
  });

  test('T10 empty window has zero counts', () => {
    const store = MetricsStore.getInstance();
    const snap = new AggregateComputer(store).computeFull('10m', 99, 19, []);
    expect(snap.gateway.total_requests).toBe(0);
    expect(snap.poll.players_polled).toBe(0);
    expect(snap.poll.concurrent_sessions_avg).toBe(0);
    expect(snap.ingestion.matches_ingested).toBe(0);
    expect(snap.ingestion.ingested_processed).toBe(0);
    expect(snap.ingestion.ingested_already_done).toBe(0);
  });

  test('T_ingestion_1 matches_ingested counts both processed and already_done', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    for (let i = 0; i < 3; i += 1) {
      store.pushIngestionWorker({
        ts: now,
        matchId: `P${i}`,
        patch: '16.11',
        rank: 'GOLD',
        type: 'completed',
        completedReason: 'processed',
        durationMs: 10,
      });
    }
    for (let i = 0; i < 2; i += 1) {
      store.pushIngestionWorker({
        ts: now,
        matchId: `A${i}`,
        patch: '16.11',
        rank: 'GOLD',
        type: 'completed',
        completedReason: 'already_done',
        durationMs: 5,
      });
    }
    store.pushIngestionWorker({
      ts: now,
      matchId: 'F0',
      patch: '16.11',
      rank: 'GOLD',
      type: 'failed',
      durationMs: 1,
      errorMessage: 'err',
    });
    const result = new AggregateComputer(store).computeIngestion('10m');
    expect(result.matches_ingested).toBe(5);
    expect(result.ingested_processed).toBe(3);
    expect(result.ingested_already_done).toBe(2);
    expect(result.matches_failed).toBe(1);
    expect(result.matches_failed_attempts).toBe(1);
    expect(result.matches_failed_terminal).toBe(1);
    expect(result.ingestion_success_rate_pct).toBeCloseTo(83.3, 1);
  });

  test('T_ingestion_4 retry failure then success is not terminal failure', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    store.pushIngestionWorker({
      ts: now - 2000,
      matchId: 'M-retry',
      patch: '16.11',
      rank: 'GOLD',
      type: 'failed',
      durationMs: 100,
      errorMessage: 'transient',
    });
    store.pushIngestionWorker({
      ts: now,
      matchId: 'M-retry',
      patch: '16.11',
      rank: 'GOLD',
      type: 'completed',
      completedReason: 'processed',
      durationMs: 50,
    });
    const result = new AggregateComputer(store).computeIngestion('10m');
    expect(result.matches_failed_attempts).toBe(1);
    expect(result.matches_failed_terminal).toBe(0);
    expect(result.matches_ingested).toBe(1);
    expect(result.ingestion_success_rate_pct).toBe(100);
  });

  test('T_ingestion_2 matches_ingested is 0 when only started events', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    for (let i = 0; i < 3; i += 1) {
      store.pushIngestionWorker({
        ts: now,
        matchId: `S${i}`,
        patch: '16.11',
        rank: 'GOLD',
        type: 'started',
      });
    }
    const result = new AggregateComputer(store).computeIngestion('10m');
    expect(result.matches_ingested).toBe(0);
  });

  test('T_ingestion_3 completedReason undefined treated as processed', () => {
    const store = MetricsStore.getInstance();
    const now = Date.now();
    store.pushIngestionWorker({
      ts: now,
      matchId: 'M1',
      patch: '16.11',
      rank: 'GOLD',
      type: 'completed',
      durationMs: 10,
    });
    const result = new AggregateComputer(store).computeIngestion('10m');
    expect(result.ingested_processed).toBe(1);
    expect(result.ingested_already_done).toBe(0);
  });
});
