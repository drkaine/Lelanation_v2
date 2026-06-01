import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PlayerDiscovery } from '../../../src/poll-orchestration/PlayerDiscovery.js';
import * as timedDbOpModule from '../../../src/observability/poller-metrics/timedDbOp.js';

const sqlMock = vi.fn();

vi.mock('../../../src/db/client.js', () => ({
  sql: (...args: unknown[]) => sqlMock(...args),
}));

vi.mock('../../../src/observability/poller-metrics/timedDbOp.js', async (importOriginal) => {
  const actual = await importOriginal<typeof timedDbOpModule>();
  return {
    ...actual,
    timedDbOp: vi.fn(actual.timedDbOp),
  };
});

describe('PlayerDiscovery.getOldestLastSeenStats', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    vi.mocked(timedDbOpModule.timedDbOp).mockImplementation(async (_op, fn) => fn());
  });

  test('T17 returns correct oldest_last_seen from DB result', async () => {
    sqlMock.mockResolvedValue([
      { oldest_last_seen: '2026-01-10T08:00:00.000Z', never_seen_count: 0 },
    ]);
    const discovery = new PlayerDiscovery();
    const result = await discovery.getOldestLastSeenStats();
    expect(result.oldestLastSeen?.toISOString()).toBe('2026-01-10T08:00:00.000Z');
    expect(result.neverSeenCount).toBe(0);
  });

  test('T18 returns null oldestLastSeen when all players have NULL last_seen', async () => {
    sqlMock.mockResolvedValue([{ oldest_last_seen: null, never_seen_count: 5 }]);
    const discovery = new PlayerDiscovery();
    const result = await discovery.getOldestLastSeenStats();
    expect(result.oldestLastSeen).toBeNull();
    expect(result.neverSeenCount).toBe(5);
  });

  test('T19 wraps query in timedDbOp get_oldest_last_seen', async () => {
    sqlMock.mockResolvedValue([{ oldest_last_seen: null, never_seen_count: 0 }]);
    const discovery = new PlayerDiscovery();
    await discovery.getOldestLastSeenStats();
    expect(timedDbOpModule.timedDbOp).toHaveBeenCalledWith('get_oldest_last_seen', expect.any(Function));
  });
});
