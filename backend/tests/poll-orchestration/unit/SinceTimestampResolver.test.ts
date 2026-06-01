import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PatchResolver } from '../../../src/poll-orchestration/PatchResolver.js';
import { SinceTimestampResolver } from '../../../src/poll-orchestration/SinceTimestampResolver.js';
import type { PlayerDiscovery } from '../../../src/poll-orchestration/PlayerDiscovery.js';
import type { LastSeenStats } from '../../../src/poll-orchestration/types.js';
import { applySinceModeTransition } from '../../../src/poll-orchestration/sinceModeTransition.js';
import { orchestrationLogger } from '../../../src/poll-orchestration/logger.js';

const mockGetStats = vi.fn<() => Promise<LastSeenStats>>();

const riotConfigMock = vi.hoisted(() => ({
  apiKeyType: 'production' as 'personal' | 'production',
}));

vi.mock('../../../src/riot-gateway/config/riotConfig.js', () => ({
  riotConfig: riotConfigMock,
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() =>
    JSON.stringify({
      versions: [
        { version: '16.11.1', releaseDate: '2026-05-27', patchLabel: '16.11' },
        { version: '16.10.1', releaseDate: '2026-05-12', patchLabel: '16.10' },
      ],
    }),
  ),
}));

function discovery(): PlayerDiscovery {
  return { getOldestLastSeenStats: mockGetStats } as unknown as PlayerDiscovery;
}

const FULL_HISTORY_TS = Math.floor(new Date('2026-01-08T00:00:00Z').getTime() / 1000);
const PATCH_START_TS = Math.floor(new Date('2026-05-27T00:00:00Z').getTime() / 1000);

describe('SinceTimestampResolver', () => {
  beforeEach(() => {
    mockGetStats.mockReset();
    vi.useRealTimers();
    delete process.env.FULL_HISTORY_SINCE_DATE;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('personal key', () => {
    beforeEach(() => {
      riotConfigMock.apiKeyType = 'personal';
    });

    test('T1 personal key always returns last 24h regardless of DB state', async () => {
      mockGetStats.mockResolvedValue({ oldestLastSeen: new Date(), neverSeenCount: 99 });
      const now = 1_700_000_000_000;
      vi.setSystemTime(now);
      const resolver = new SinceTimestampResolver(discovery());
      const result = await resolver.resolve();
      expect(result.mode).toBe('personal_24h');
      const expected = Math.floor((now - 86_400_000) / 1000);
      expect(result.sinceTimestamp).toBeGreaterThanOrEqual(expected - 1);
      expect(result.sinceTimestamp).toBeLessThanOrEqual(expected + 1);
    });

    test('T2 personal key does NOT call getOldestLastSeenStats', async () => {
      const resolver = new SinceTimestampResolver(discovery());
      await resolver.resolve();
      expect(mockGetStats).not.toHaveBeenCalled();
    });

    test('T3 personal key: sinceTimestamp moves with time', async () => {
      vi.setSystemTime(1_700_000_000_000);
      const resolver = new SinceTimestampResolver(discovery());
      const result1 = await resolver.resolve();
      vi.setSystemTime(1_700_000_000_000 + 3_600_000);
      const result2 = await resolver.resolve();
      expect(result2.sinceTimestamp).toBe(result1.sinceTimestamp + 3600);
    });

    test('T4 personal key: mode is personal_24h even if FULL_HISTORY_SINCE_DATE is set', async () => {
      process.env.FULL_HISTORY_SINCE_DATE = '2026-01-08';
      const resolver = new SinceTimestampResolver(discovery());
      const result = await resolver.resolve();
      expect(result.mode).toBe('personal_24h');
      expect(result.fullHistoryStartDate).toBeNull();
    });
  });

  describe('production key', () => {
    beforeEach(() => {
      riotConfigMock.apiKeyType = 'production';
      process.env.FULL_HISTORY_SINCE_DATE = '2026-01-08';
    });

    test('T5 production: neverSeenCount > 0 → prod_patch', async () => {
      const resolver = new SinceTimestampResolver(discovery());
      const result = resolver.resolveProduction({
        oldestLastSeen: new Date(),
        neverSeenCount: 5,
      });
      expect(result.mode).toBe('prod_patch');
      expect(result.sinceTimestamp).toBe(PatchResolver.getCurrentPatchStartTimestamp());
    });

    test('T6 production: oldestLastSeen null with neverSeenCount 0 → prod_patch', () => {
      const resolver = new SinceTimestampResolver(discovery());
      const result = resolver.resolveProduction({ oldestLastSeen: null, neverSeenCount: 0 });
      expect(result.mode).toBe('prod_patch');
    });

    test('T7 production: oldestLastSeen 25h ago → prod_patch', () => {
      const resolver = new SinceTimestampResolver(discovery());
      const result = resolver.resolveProduction({
        oldestLastSeen: new Date(Date.now() - 25 * 3_600_000),
        neverSeenCount: 0,
      });
      expect(result.mode).toBe('prod_patch');
    });

    test('T8 production: oldestLastSeen exactly 24h ago → prod_patch', () => {
      const resolver = new SinceTimestampResolver(discovery());
      const result = resolver.resolveProduction({
        oldestLastSeen: new Date(Date.now() - 24 * 3_600_000),
        neverSeenCount: 0,
      });
      expect(result.mode).toBe('prod_patch');
    });

    test('T9 production: mixed never seen and recent → prod_patch', () => {
      const resolver = new SinceTimestampResolver(discovery());
      const result = resolver.resolveProduction({
        oldestLastSeen: new Date(Date.now() - 2 * 3_600_000),
        neverSeenCount: 3,
      });
      expect(result.mode).toBe('prod_patch');
    });

    test('T10 production: all caught up → prod_full_history', () => {
      const resolver = new SinceTimestampResolver(discovery());
      const result = resolver.resolveProduction({
        oldestLastSeen: new Date(Date.now() - 2 * 3_600_000),
        neverSeenCount: 0,
      });
      expect(result.mode).toBe('prod_full_history');
      expect(result.sinceTimestamp).toBe(FULL_HISTORY_TS);
      expect(result.fullHistoryStartDate).toBe('2026-01-08');
    });

    test('T11 prod_full_history sinceTimestamp is UTC midnight of FULL_HISTORY_SINCE_DATE', () => {
      process.env.FULL_HISTORY_SINCE_DATE = '2026-01-08';
      const resolver = new SinceTimestampResolver(discovery());
      const result = resolver.resolveProduction({
        oldestLastSeen: new Date(Date.now() - 60_000),
        neverSeenCount: 0,
      });
      expect(result.sinceTimestamp).toBe(FULL_HISTORY_TS);
    });

    test('T12 prod_full_history: oldestLastSeen 1 minute ago → caught up', () => {
      const resolver = new SinceTimestampResolver(discovery());
      const result = resolver.resolveProduction({
        oldestLastSeen: new Date(Date.now() - 60_000),
        neverSeenCount: 0,
      });
      expect(result.mode).toBe('prod_full_history');
    });

    test('T13 prod_full_history: oldestLastSeen 23h59m ago → caught up', () => {
      const resolver = new SinceTimestampResolver(discovery());
      const result = resolver.resolveProduction({
        oldestLastSeen: new Date(Date.now() - (24 * 3_600 - 60) * 1000),
        neverSeenCount: 0,
      });
      expect(result.mode).toBe('prod_full_history');
    });
  });

  describe('config validation', () => {
    test('T14 invalid FULL_HISTORY_SINCE_DATE throws at construction', () => {
      process.env.FULL_HISTORY_SINCE_DATE = 'not-a-date';
      expect(() => new SinceTimestampResolver(discovery())).toThrow('Invalid FULL_HISTORY_SINCE_DATE');
    });

    test('T15 missing FULL_HISTORY_SINCE_DATE uses default 2026-01-08', () => {
      delete process.env.FULL_HISTORY_SINCE_DATE;
      const resolver = new SinceTimestampResolver(discovery());
      const result = resolver.resolveProduction({
        oldestLastSeen: new Date(),
        neverSeenCount: 0,
      });
      expect(result.sinceTimestamp).toBe(FULL_HISTORY_TS);
    });
  });
});

describe('applySinceModeTransition', () => {
  test('T16 mode transition logged when mode changes', () => {
    const infoSpy = vi.spyOn(orchestrationLogger, 'info').mockImplementation(() => undefined);
    const patch = {
      sinceTimestamp: PATCH_START_TS,
      mode: 'prod_patch' as const,
      reason: 'catching up',
      oldestLastSeen: null,
      neverSeenCount: 1,
      fullHistoryStartDate: null,
    };
    const full = {
      sinceTimestamp: FULL_HISTORY_TS,
      mode: 'prod_full_history' as const,
      reason: 'caught up',
      oldestLastSeen: new Date(),
      neverSeenCount: 0,
      fullHistoryStartDate: '2026-01-08',
    };

    let mode: typeof patch.mode | null = null;
    mode = applySinceModeTransition(mode, patch);
    mode = applySinceModeTransition(mode, full);

    expect(
      infoSpy.mock.calls.some(
        (call) =>
          (call[0] as { event?: string })?.event === 'since_mode_changed' &&
          (call[0] as { newMode?: string })?.newMode === 'prod_full_history',
      ),
    ).toBe(true);
    infoSpy.mockRestore();
  });
});
