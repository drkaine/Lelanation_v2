import { describe, expect, it } from 'vitest';
import { mergeSessionPoolStatus } from '../../../../src/poll-orchestration/sessionPoolStatus.js';
import type { SessionPoolStatus } from '../../../../src/poll-orchestration/SessionPool.js';

const status = (over: Partial<SessionPoolStatus> = {}): SessionPoolStatus => ({
  activeSessions: 1,
  maxConcurrentSessions: 4,
  queueSize: 10,
  gatewayQueueSize: 5,
  sharedMatchIdsSize: 100,
  isExhausted: false,
  isShuttingDown: false,
  totalSessionsLaunched: 20,
  totalSessionsCompleted: 18,
  playerQueueRefills: 3,
  playerQueueHighWaterMark: 50,
  ...over,
});

describe('mergeSessionPoolStatus (un pool par région)', () => {
  it('somme les compteurs, file gateway globale = max, épuisé si tous, arrêt si un', () => {
    const merged = mergeSessionPoolStatus([
      status({ isExhausted: true }),
      status({ activeSessions: 3, gatewayQueueSize: 9, isShuttingDown: true, playerQueueHighWaterMark: 70 }),
    ]);
    expect(merged).toEqual({
      activeSessions: 4,
      maxConcurrentSessions: 8,
      queueSize: 20,
      gatewayQueueSize: 9,
      sharedMatchIdsSize: 200,
      isExhausted: false,
      isShuttingDown: true,
      totalSessionsLaunched: 40,
      totalSessionsCompleted: 36,
      playerQueueRefills: 6,
      playerQueueHighWaterMark: 120,
    });
  });

  it('tous épuisés → épuisé ; aucun pool → null', () => {
    expect(mergeSessionPoolStatus([status({ isExhausted: true }), status({ isExhausted: true })])?.isExhausted).toBe(true);
    expect(mergeSessionPoolStatus([])).toBeNull();
  });
});
