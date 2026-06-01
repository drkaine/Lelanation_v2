import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../src/db/client.js', () => ({
  sql: Object.assign(vi.fn(), { array: (values: unknown[]) => values }),
}));

import { sql } from '../../../src/db/client.js';
import { RankFilter } from '../../../src/poll-orchestration/RankFilter.js';

describe('RankFilter', () => {
  beforeEach(() => {
    vi.mocked(sql).mockReset();
  });

  test('isKnownToday returns true when row exists and caches', async () => {
    vi.mocked(sql).mockResolvedValueOnce([{ exists: 1 }]);
    const filter = new RankFilter();
    expect(await filter.isKnownToday('p1', 'euw1')).toBe(true);
    expect(await filter.isKnownToday('p1', 'euw1')).toBe(true);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  test('isKnownToday returns false when missing and does not cache false', async () => {
    vi.mocked(sql).mockResolvedValueOnce([]);
    const filter = new RankFilter();
    expect(await filter.isKnownToday('p2', 'euw1')).toBe(false);
    vi.mocked(sql).mockResolvedValueOnce([]);
    expect(await filter.isKnownToday('p2', 'euw1')).toBe(false);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  test('clearCache resets hits', async () => {
    vi.mocked(sql).mockResolvedValue([{ exists: 1 }]);
    const filter = new RankFilter();
    await filter.isKnownToday('p3', 'euw1');
    filter.clearCache();
    await filter.isKnownToday('p3', 'euw1');
    expect(sql).toHaveBeenCalledTimes(2);
  });

  test('prefetchBatch populates cache', async () => {
    vi.mocked(sql).mockResolvedValueOnce([{ puuid: 'p4', region: 'euw1' }]);
    const filter = new RankFilter();
    await filter.prefetchBatch([
      { puuid: 'p4', region: 'euw1' },
      { puuid: 'p5', region: 'euw1' },
    ]);
    expect(await filter.isKnownToday('p4', 'euw1')).toBe(true);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  test('different regions use separate cache keys', async () => {
    vi.mocked(sql)
      .mockResolvedValueOnce([{ exists: 1 }])
      .mockResolvedValueOnce([]);
    const filter = new RankFilter();
    expect(await filter.isKnownToday('same-puuid', 'euw1')).toBe(true);
    expect(await filter.isKnownToday('same-puuid', 'na1')).toBe(false);
    expect(sql).toHaveBeenCalledTimes(2);
  });
});
