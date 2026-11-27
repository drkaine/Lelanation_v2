import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../../src/db/client.js', () => ({ sql: Object.assign(vi.fn(), { array: (v: unknown[]) => v }) }));
vi.mock('../../../../src/queues/index.js', () => ({ rankQueue: {} }));
vi.mock('../../../../src/redis/rate-budget.js', () => ({ WINDOW_MS: 120_000 }));

import { todayIsoDate } from '../../../../src/queues/rank-jobs-shared.js';
import { rankInflightKey } from '../../../../src/services/rank-inflight.js';

/** 00:30 local le 27/11 : jour du balayage 27/11, date UTC encore 26/11. */
const LOCAL_0030 = new Date(2026, 10, 27, 0, 30, 0);

describe('même date pour tout le poller : jour du balayage (local, 00:01)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(LOCAL_0030);
  });
  afterEach(() => vi.useRealTimers());

  test('job ids et clés en vol des rangs', () => {
    expect(todayIsoDate()).toBe('2026-11-27');
    expect(rankInflightKey('p', 'euw1')).toMatch(/:2026-11-27$/);
  });

  test('plus de date UTC ni de CURRENT_DATE pour « aujourd’hui »', () => {
    const src = (p: string) => readFileSync(new URL(`../../../../src/${p}`, import.meta.url), 'utf8');
    for (const p of [
      'lib/adaptiveBudget.ts',
      'services/rank-inflight.ts',
      'poll-orchestration/DuoRefresh.ts',
      'observability/poller-metrics/ExtendedSnapshotBuilder.ts',
    ]) {
      expect(src(p), p).not.toMatch(/CURRENT_DATE|new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
    }
    const worker = src('workers/ingestion.worker.ts');
    const rankFn = worker.slice(worker.indexOf('async function upsertPlayerRankHistoryFromParticipants'));
    expect(rankFn.slice(0, rankFn.indexOf('\n}\n'))).not.toContain('toISOString().slice(0, 10)');
  });
});
