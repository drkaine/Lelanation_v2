import { describe, expect, it } from 'vitest';
import { laneGatewayQueueThreshold } from '../../../../src/poll-orchestration/SessionPool.js';

describe('laneGatewayQueueThreshold (file gateway globale, un pool par région)', () => {
  it('seuil multiplié par le nombre de voies : le retard d’une région ne bloque pas les autres', () => {
    expect(laneGatewayQueueThreshold(3, 10)).toBe(30);
  });
  it('une voie (ou 0) = seuil de base', () => {
    expect(laneGatewayQueueThreshold(1, 10)).toBe(10);
    expect(laneGatewayQueueThreshold(0, 10)).toBe(10);
  });
});
