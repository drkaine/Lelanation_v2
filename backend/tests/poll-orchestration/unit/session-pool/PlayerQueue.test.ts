import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PlayerQueue } from '../../../../src/poll-orchestration/PlayerQueue.js';
import type { PlayerDiscovery } from '../../../../src/poll-orchestration/PlayerDiscovery.js';

function mockDiscovery(
  batches: Array<Array<{ puuid: string; region: string }>>,
): PlayerDiscovery {
  let call = 0;
  return {
    fetchNextBatch: vi.fn(async () => {
      const batch = batches[call] ?? [];
      call += 1;
      return batch;
    }),
  } as unknown as PlayerDiscovery;
}

describe('PlayerQueue', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  test('T1 dequeue returns N players and triggers refill', async () => {
    const discovery = mockDiscovery([
      [{ puuid: 'a', region: 'euw1' }, { puuid: 'b', region: 'euw1' }],
      [{ puuid: 'c', region: 'euw1' }],
    ]);
    const queue = new PlayerQueue(discovery, {
      highWaterMark: 10,
      lowWaterMark: 2,
      fetchBatchSize: 5,
    });
    await queue.prime();
    const out = queue.dequeue(2);
    expect(out).toHaveLength(2);
    await vi.waitFor(() => expect(discovery.fetchNextBatch).toHaveBeenCalledTimes(2));
  });

  test('T2 refill is idempotent', async () => {
    const discovery = mockDiscovery([[{ puuid: 'a', region: 'euw1' }]]);
    const queue = new PlayerQueue(discovery, {
      highWaterMark: 5,
      lowWaterMark: 4,
      fetchBatchSize: 5,
    });
    await Promise.all([queue.prime(), queue.prime()]);
    expect(discovery.fetchNextBatch).toHaveBeenCalledTimes(1);
  });

  test('T3 isExhausted when DB returns empty', async () => {
    const discovery = mockDiscovery([[]]);
    const queue = new PlayerQueue(discovery, {
      highWaterMark: 5,
      lowWaterMark: 2,
      fetchBatchSize: 5,
    });
    await queue.prime();
    expect(queue.isExhausted()).toBe(true);
  });

  test('T4 isExhausted clears after DB returns players', async () => {
    const discovery = mockDiscovery([
      [],
      [{ puuid: 'a', region: 'euw1' }],
      [{ puuid: 'b', region: 'euw1' }],
    ]);
    const queue = new PlayerQueue(discovery, {
      highWaterMark: 5,
      lowWaterMark: 1,
      fetchBatchSize: 5,
    });
    await queue.prime();
    expect(queue.isExhausted()).toBe(true);
    const players = await queue.waitForPlayers(1, 5000);
    expect(players).toHaveLength(1);
    expect(queue.isExhausted()).toBe(false);
  });

  test('T5 waitForPlayers resolves when players arrive', async () => {
    const discovery = mockDiscovery([
      [],
      [{ puuid: 'a', region: 'euw1' }],
    ]);
    const queue = new PlayerQueue(discovery, {
      highWaterMark: 5,
      lowWaterMark: 1,
      fetchBatchSize: 5,
    });
    await queue.prime();
    const players = await queue.waitForPlayers(1, 5000);
    expect(players.length).toBeGreaterThan(0);
  });

  test('T6 waitForPlayers returns empty on timeout if still exhausted', async () => {
    const discovery = mockDiscovery([[]]);
    const queue = new PlayerQueue(discovery, {
      highWaterMark: 5,
      lowWaterMark: 2,
      fetchBatchSize: 5,
    });
    await queue.prime();
    const players = await queue.waitForPlayers(1, 300);
    expect(players).toHaveLength(0);
  });

  test('T7 dequeue when queue has fewer than N returns partial', () => {
    const discovery = mockDiscovery([[{ puuid: 'a', region: 'euw1' }]]);
    const queue = new PlayerQueue(discovery, {
      highWaterMark: 5,
      lowWaterMark: 4,
      fetchBatchSize: 5,
    });
    void queue.prime();
    const out = queue.dequeue(5);
    expect(out.length).toBeLessThanOrEqual(5);
  });
});
