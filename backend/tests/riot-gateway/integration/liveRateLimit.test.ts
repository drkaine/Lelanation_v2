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

const REQUEST_HANG_MS = 60_000;

function matchIdsWithTimeout(puuid: string): Promise<string[]> {
  return Promise.race([
    getMatchIdsByPUUID(puuid, { count: 1 }),
    sleep(REQUEST_HANG_MS).then(() => Promise.reject(new Error(`match-ids hung >${REQUEST_HANG_MS}ms`))),
  ]);
}

describe.skipIf(!hasLiveApiKey())('liveRateLimit — Real API 429 reaction', () => {
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

  test('should receive a 429, back off, and successfully recover', async () => {
    const gateway = await resetGateway();
    gateway.setSafetyMargin(0);

    await matchIdsWithTimeout(testPuuid);
    await waitFor120sHeadroom(gateway, 5, 60_000);

    const pending = Array.from({ length: 25 }, () => matchIdsWithTimeout(testPuuid));

    let saw429 = false;
    for (let i = 0; i < 40; i += 1) {
      if (gateway.getStatus().metrics.totals.r429 >= 1) {
        saw429 = true;
        break;
      }
      await sleep(500);
    }
    expect(saw429).toBe(true);

    await Promise.race([Promise.allSettled(pending), sleep(90_000)]);

    await gateway.shutdown(0);
    const freshGateway = await resetGateway();
    freshGateway.setSafetyMargin(riotConfig.safetyMargin);

    const recovery = await matchIdsWithTimeout(testPuuid);
    expect(Array.isArray(recovery)).toBe(true);

    // eslint-disable-next-line no-console -- integration test deliverable snapshot
    console.log(JSON.stringify(freshGateway.getStatus(), null, 2));
    await freshGateway.shutdown(0);
  }, 300_000);

  test('should not emit a 429 under normal personal key usage', async () => {
    const gateway = await resetGateway();
    gateway.setSafetyMargin(riotConfig.safetyMargin);

    await matchIdsWithTimeout(testPuuid);
    await waitFor120sHeadroom(gateway, 3, 125_000);

    const oneSecondLimit = riotConfig.fallbackLimits.personal.app.find((w) => w.windowMs === 1_000)?.limit ?? 19;
    const perSecondSafe = Math.max(1, Math.floor(oneSecondLimit * (1 - riotConfig.safetyMargin)));
    const requestCount = Math.min(perSecondSafe, get120sAvailable(gateway));
    expect(requestCount).toBeGreaterThanOrEqual(1);

    const delayMs = Math.floor(5_000 / requestCount);
    for (let i = 0; i < requestCount; i += 1) {
      const response = await matchIdsWithTimeout(testPuuid);
      expect(Array.isArray(response)).toBe(true);
      if (i < requestCount - 1) {
        await sleep(delayMs);
      }
    }

    expect(gateway.getStatus().metrics.totals.r429).toBe(0);
    await gateway.shutdown(0);
  }, 180_000);
});
