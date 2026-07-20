import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Couche DB entièrement mockée : aucun accès réseau/PostgreSQL.
const queryRawUnsafe = vi.fn(async () => [] as unknown[]);
vi.mock('../../../src/db/query.js', () => ({
  queryRawUnsafe,
  isDatabaseConfigured: () => true,
}));
vi.mock('../../../src/services/statsAggArchive.js', () => ({
  matchVersionedAggFrom: vi.fn(async (table: string, _patch: string, alias: string) => `${table} ${alias}`),
  sqlAggUnionAllLiveAndArchives: vi.fn(async (table: string, alias: string) => `${table} ${alias}`),
  normalizePatchMajorMinor: (p: string) => p,
}));

const { getTierList, clearTierListCache, tierListCacheKey } = await import(
  '../../../src/services/TierListService.js'
);

describe('tierListCacheKey', () => {
  it('is stable regardless of rankTier array order and casing', () => {
    const a = tierListCacheKey({ patch: '15.13', rankTier: ['gold', 'PLATINUM'], role: 'mid' });
    const b = tierListCacheKey({ patch: '15.13', rankTier: ['PLATINUM', 'gold'], role: 'MID' });
    expect(a).toBe(b);
  });

  it('distinguishes different filters', () => {
    expect(tierListCacheKey({ patch: '15.13', rankTier: 'all' })).not.toBe(
      tierListCacheKey({ patch: '15.13', rankTier: 'GOLD' }),
    );
  });
});

describe('getTierList caching', () => {
  beforeEach(() => {
    clearTierListCache();
    queryRawUnsafe.mockClear();
  });
  afterEach(() => {
    clearTierListCache();
  });

  it('hits the DB on first call and serves subsequent identical calls from cache', async () => {
    const opts = { patch: '15.13', platformId: null, rankTier: 'all' as const, role: null };

    const first = await getTierList(opts);
    expect(first).not.toBeNull();
    const callsAfterFirst = queryRawUnsafe.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = await getTierList(opts);
    // Same object returned from cache, no additional DB calls.
    expect(second).toBe(first);
    expect(queryRawUnsafe.mock.calls.length).toBe(callsAfterFirst);
  });

  it('uses a separate cache entry for a different rankTier', async () => {
    await getTierList({ patch: '15.13', rankTier: 'all' });
    const callsAfterAll = queryRawUnsafe.mock.calls.length;

    await getTierList({ patch: '15.13', rankTier: 'GOLD' });
    // Different key → recomputed (more DB calls).
    expect(queryRawUnsafe.mock.calls.length).toBeGreaterThan(callsAfterAll);
  });

  it('recomputes after the cache is cleared', async () => {
    await getTierList({ patch: '15.13', rankTier: 'all' });
    const calls1 = queryRawUnsafe.mock.calls.length;
    clearTierListCache();
    await getTierList({ patch: '15.13', rankTier: 'all' });
    expect(queryRawUnsafe.mock.calls.length).toBeGreaterThan(calls1);
  });
});
