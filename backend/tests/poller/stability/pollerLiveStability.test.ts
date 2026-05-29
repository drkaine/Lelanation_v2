import { afterAll, describe, expect, test } from 'vitest';
import { PollerEngine } from '../../../src/poller/PollerEngine.js';
import {
  initLivePoller,
  livePollOptions,
  resetLivePoller,
  resolveTestPuuid,
  sleep,
  waitForGatewayHeadroom,
} from '../integration/helpers/liveEnv.js';

const useLiveApi = process.env.STABILITY_USE_LIVE_API === 'true';
const hasLiveApiKey = (): boolean => Boolean(process.env.RIOT_API_KEY?.startsWith('RGAPI-'));
const durationMinutes = Number.parseInt(process.env.STABILITY_DURATION_MINUTES ?? '20', 10);
const durationMs = Math.max(1, durationMinutes) * 60_000;

type StabilityCheckpoint = {
  elapsed_s: number;
  sessions_completed: number;
  total_matches_fetched: number;
  total_participant_ranks: number;
  gateway_r429: number;
  gateway_rps_current: number;
  gateway_rps_avg: number;
  gateway_latency_p95: number;
  heap_mb: number;
  queue_depth: number;
  errors: number;
};

describe.skipIf(!useLiveApi || !hasLiveApiKey())('pollerLiveStability', () => {
  let testPuuid = '';

  afterAll(async () => {
    await resetLivePoller();
  });

  test(
    `gateway + poller hold for ${durationMinutes} minutes`,
    async () => {
      testPuuid = await resolveTestPuuid();
      const { engine, gateway } = await initLivePoller();

      const checkpoints: StabilityCheckpoint[] = [];
      let sessionsCompleted = 0;
      let totalMatchesFetched = 0;
      let totalParticipantRanks = 0;
      let pollerErrors = 0;
      let baselineHeap = process.memoryUsage().heapUsed;
      let warmupHeap = baselineHeap;
      const startedAt = Date.now();
      let lastSessionCompleteAt = Date.now();

      const failStall = (): never => {
        throw new Error(
          `STALL DETECTED after 30s without session:complete (sessions=${sessionsCompleted}, checkpoints=${checkpoints.length})`,
        );
      };

      let watchdog = setTimeout(failStall, 30_000);

      engine.getEventBus().on('session:complete', (event) => {
        clearTimeout(watchdog);
        sessionsCompleted += 1;
        totalMatchesFetched += event.stats.matchesFetched;
        lastSessionCompleteAt = Date.now();
        watchdog = setTimeout(failStall, 30_000);
      });
      engine.getEventBus().on('participant:rank', () => {
        totalParticipantRanks += 1;
      });
      engine.getEventBus().on('poller:error', () => {
        pollerErrors += 1;
      });

      const snapshotInterval = setInterval(() => {
        const status = gateway.getStatus();
        const elapsed_s = Math.floor((Date.now() - startedAt) / 1000);
        const heap_mb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        if (elapsed_s >= 60 && warmupHeap === baselineHeap) {
          warmupHeap = process.memoryUsage().heapUsed;
        }
        checkpoints.push({
          elapsed_s,
          sessions_completed: sessionsCompleted,
          total_matches_fetched: totalMatchesFetched,
          total_participant_ranks: totalParticipantRanks,
          gateway_r429: status.metrics.totals.r429,
          gateway_rps_current: status.metrics.rps.current,
          gateway_rps_avg: status.metrics.rps.avg60s,
          gateway_latency_p95: status.metrics.latency.p95,
          heap_mb,
          queue_depth: status.queue.size,
          errors: pollerErrors,
        });
      }, 60_000);

      while (Date.now() - startedAt < durationMs) {
        await waitForGatewayHeadroom(8);
        await engine.poll([{ puuid: testPuuid, platform: 'euw1' }], {
          ...livePollOptions(),
          maxMatchesToProcess: 2,
          resolveParticipantRanks: true,
        });
        await sleep(1_000);
      }

      clearTimeout(watchdog);
      clearInterval(snapshotInterval);

      const finalStatus = gateway.getStatus();
      const finalHeap = process.memoryUsage().heapUsed;
      const heapLimit = Math.max(warmupHeap, baselineHeap) * 2;

      console.table(checkpoints);
      console.log(
        `[stability] sessions=${sessionsCompleted} matches=${totalMatchesFetched} ranks=${totalParticipantRanks} r429=${finalStatus.metrics.totals.r429}`,
      );

      expect(finalStatus.metrics.totals.r429).toBe(0);
      expect(sessionsCompleted).toBeGreaterThanOrEqual(2);
      expect(finalHeap).toBeLessThan(heapLimit);
      expect(Date.now() - lastSessionCompleteAt).toBeLessThan(30_000);
    },
    durationMs + 120_000,
  );
});
