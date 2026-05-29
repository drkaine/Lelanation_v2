import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { riotConfig } from '../../../src/riot-gateway/config/riotConfig.js';
import { getMatchIdsByPUUID } from '../../../src/riot-gateway/routes/matchV5.js';
import {
  get120sAvailable,
  hasLiveApiKey,
  resolveTestPuuid,
  resetGateway,
  sleep,
  teardownGateway,
  waitFor120sHeadroom,
} from './helpers/liveEnv.js';

/**
 * pollerv3 §9 — burst enqueue then drain.
 * personal: up to 10s × 9 req/s, capped by live 120s headroom (99/120s key cap).
 * production: 30s × 9 req/s per spec.
 */
const isProductionKey = (process.env.API_KEY_TYPE ?? 'personal') === 'production';

describe.skipIf(!hasLiveApiKey())('liveThroughput — Real API 9 req/s burst', () => {
  let testPuuid = '';

  beforeAll(async () => {
    testPuuid = await resolveTestPuuid();
  }, 30_000);

  afterEach(async () => {
    await teardownGateway();
  });

  afterAll(async () => {
    await teardownGateway();
  });

  test('should sustain 9 req/s burst without 429', async () => {
    const isProduction = riotConfig.apiKeyType === 'production';
    const rpsTarget = 9;

    const gateway = await resetGateway();
    gateway.setSafetyMargin(riotConfig.safetyMargin);

    await getMatchIdsByPUUID(testPuuid, { count: 1 });

    let enqueueTotal: number;
    let durationSec: number;
    let drainTimeoutMs: number;

    if (isProduction) {
      durationSec = 30;
      enqueueTotal = durationSec * rpsTarget;
      drainTimeoutMs = 600_000;
    } else {
      await waitFor120sHeadroom(gateway, 20);
      const headroom = get120sAvailable(gateway);
      enqueueTotal = Math.min(90, Math.max(9, headroom - 2));
      durationSec = Math.max(1, Math.min(10, Math.ceil(enqueueTotal / rpsTarget)));
      drainTimeoutMs = Math.max(120_000, enqueueTotal * 3_000);
    }

    const enqueueStartedAt = Date.now();
    const pending: Array<Promise<string[]>> = [];
    const perSecondStats: Array<{ second: number; enqueued: number }> = [];
    let enqueued = 0;

    for (let second = 0; second < durationSec && enqueued < enqueueTotal; second += 1) {
      const batchStarted = Date.now();
      const batchSize = Math.min(rpsTarget, enqueueTotal - enqueued);
      for (let i = 0; i < batchSize; i += 1) {
        pending.push(getMatchIdsByPUUID(testPuuid, { count: 1 }));
      }
      enqueued += batchSize;
      perSecondStats.push({ second: second + 1, enqueued: batchSize });
      const elapsed = Date.now() - batchStarted;
      if (elapsed < 1_000) {
        await sleep(1_000 - elapsed);
      }
    }

    const expectedTotal = enqueued;
    const enqueueRps = pending.length / ((Date.now() - enqueueStartedAt) / 1000);

    const drainStartedAt = Date.now();
    const results = await Promise.race([
      Promise.allSettled(pending),
      sleep(drainTimeoutMs).then(() => {
        throw new Error(`Drain phase exceeded ${drainTimeoutMs}ms`);
      }),
    ]);
    const drainSec = (Date.now() - drainStartedAt) / 1000;

    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const status = gateway.getStatus();
    const successRate = status.metrics.totals.requests > 0 ? status.metrics.totals.success / status.metrics.totals.requests : 0;
    const totalWallSec = (Date.now() - enqueueStartedAt) / 1000;
    const burstRps = fulfilled / Math.max(1, durationSec);

    // eslint-disable-next-line no-console -- integration test deliverable output
    console.log(
      JSON.stringify(
        {
          apiKeyType: riotConfig.apiKeyType,
          headroom120s: get120sAvailable(gateway),
          perSecondStats,
          enqueued: pending.length,
          fulfilled,
          enqueueRps,
          burstRps,
          drainSec,
          totalWallSec,
          totalRequests: status.metrics.totals.requests,
          r429: status.metrics.totals.r429,
          successRate,
          latency: status.metrics.latency,
        },
        null,
        2,
      ),
    );

    expect(pending.length).toBe(expectedTotal);
    expect(fulfilled).toBe(expectedTotal);
    expect(status.metrics.totals.r429).toBe(0);
    expect(successRate).toBeGreaterThanOrEqual(0.99);

    if (isProduction) {
      expect(enqueueRps).toBeGreaterThanOrEqual(8);
      expect(enqueueRps).toBeLessThanOrEqual(10.5);
      expect(fulfilled).toBeGreaterThanOrEqual(250);
      expect(fulfilled).toBeLessThanOrEqual(290);
      expect(burstRps).toBeGreaterThanOrEqual(8);
    } else if (expectedTotal >= 45) {
      expect(enqueueRps).toBeGreaterThanOrEqual(8);
      expect(enqueueRps).toBeLessThanOrEqual(10.5);
    }

    await gateway.shutdown(0);
  }, isProductionKey ? 900_000 : 600_000);
});
