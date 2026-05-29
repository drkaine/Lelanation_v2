import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { riotConfig } from '../../../src/riot-gateway/config/riotConfig.js';
import { expectedAverageRps } from '../../../src/riot-gateway/gateway/MetricsCollector.js';
import { getMatchIdsByPUUID } from '../../../src/riot-gateway/routes/matchV5.js';
import {
  hasLiveApiKey,
  resolveTestPuuid,
  resetGateway,
  sleep,
  teardownGateway,
} from './helpers/liveEnv.js';

type SoakCheckpoint = {
  elapsed_s: number;
  total_requests: number;
  rps_current: number;
  rps_avg: number;
  p50: number;
  p95: number;
  p99: number;
  r429: number;
  errors: number;
  token_utilization: unknown;
  queue_depth: number;
  in_flight: number;
};

describe.skipIf(!hasLiveApiKey())('liveSoak — Real API sustained soak', () => {
  let testPuuid = '';

  beforeAll(async () => {
    testPuuid = await resolveTestPuuid();
  }, 30_000);

  afterAll(async () => {
    await teardownGateway();
  });

  test('should sustain maximum safe throughput for SOAK_DURATION_MINUTES', async () => {
    const soakMinutes = Number(process.env.SOAK_DURATION_MINUTES ?? riotConfig.soakDurationMinutes);
    const durationMs = soakMinutes * 60_000;
    const gateway = await resetGateway();
    gateway.setSafetyMargin(riotConfig.safetyMargin);

    const targetQueueDepth = 20;
    const startedAt = Date.now();
    const checkpoints: SoakCheckpoint[] = [];
    const rpsSamples: number[] = [];
    let zeroRpsStreakSec = 0;
    let maxZeroRpsStreakSec = 0;
    const initialHeap = process.memoryUsage().heapUsed;

    const inFlight: Promise<unknown>[] = [];

    const producer = (async () => {
      while (Date.now() - startedAt < durationMs) {
        while (inFlight.length < targetQueueDepth) {
          const task = getMatchIdsByPUUID(testPuuid, { count: 1 })
            .catch((error) => error)
            .finally(() => {
              const idx = inFlight.indexOf(task);
              if (idx >= 0) inFlight.splice(idx, 1);
            });
          inFlight.push(task);
        }
        await sleep(50);
      }
    })();

    let lastCheckpointAt = startedAt;
    while (Date.now() - startedAt < durationMs) {
      await sleep(1_000);
      const status = gateway.getStatus();
      const rpsCurrent = status.metrics.rps.current;
      rpsSamples.push(rpsCurrent);
      if (rpsCurrent <= 0) {
        zeroRpsStreakSec += 1;
        maxZeroRpsStreakSec = Math.max(maxZeroRpsStreakSec, zeroRpsStreakSec);
      } else {
        zeroRpsStreakSec = 0;
      }

      if (Date.now() - lastCheckpointAt >= 60_000) {
        lastCheckpointAt = Date.now();
        checkpoints.push({
          elapsed_s: Math.round((Date.now() - startedAt) / 1000),
          total_requests: status.metrics.totals.requests,
          rps_current: rpsCurrent,
          rps_avg: status.metrics.rps.avg60s,
          p50: status.metrics.latency.p50,
          p95: status.metrics.latency.p95,
          p99: status.metrics.latency.p99,
          r429: status.metrics.totals.r429,
          errors: status.metrics.totals.errors,
          token_utilization: status.metrics.tokenUtilization,
          queue_depth: status.queue.size,
          in_flight: status.inFlight.global,
        });
      }
    }

    await producer;
    await Promise.allSettled(inFlight);

    const finalStatus = gateway.getStatus();
    const totalRequests = finalStatus.metrics.totals.requests;
    const successRate = totalRequests > 0 ? finalStatus.metrics.totals.success / totalRequests : 0;
    const elapsedSec = (Date.now() - startedAt) / 1000;
    const rpsAvgOverall = totalRequests / elapsedSec;
    const expectedRps = expectedAverageRps();
    const heapRatio = process.memoryUsage().heapUsed / initialHeap;

    // eslint-disable-next-line no-console -- integration test deliverable output
    console.log(
      JSON.stringify(
        {
          pass: finalStatus.metrics.totals.r429 === 0 && successRate >= 0.995,
          checkpoints,
          finalStatus,
          rpsAvgOverall,
          expectedRps,
          heapRatio,
        },
        null,
        2,
      ),
    );

    expect(finalStatus.metrics.totals.r429).toBe(0);
    expect(successRate).toBeGreaterThanOrEqual(0.995);
    expect(maxZeroRpsStreakSec).toBeLessThanOrEqual(3);
    expect(rpsAvgOverall).toBeGreaterThanOrEqual(expectedRps * 0.8);
    expect(heapRatio).toBeLessThan(2);

    await gateway.shutdown(0);
  }, 1_800_000);
});
