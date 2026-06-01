import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import {
  cleanupLivePipeline,
  countIngestionJobs,
  countProcessedMatchesForPlayer,
  ensurePlayerInDb,
  hasRankToday,
  initLiveOrchestration,
  resolveTestPuuid,
  sleep,
  waitForGatewayHeadroom,
} from './helpers/liveOrchestrationEnv.js';

const hasLiveApiKey = (): boolean => Boolean(process.env.RIOT_API_KEY?.startsWith('RGAPI-'));
const hasDatabase = (): boolean => Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasLiveApiKey() || !hasDatabase())('livePipeline', () => {
  let testPuuid = '';
  let ingestionJobsBefore = 0;

  beforeAll(async () => {
    testPuuid = await resolveTestPuuid();
    await ensurePlayerInDb(testPuuid, 'euw1');
    ingestionJobsBefore = await countIngestionJobs();
  }, 60_000);

  afterEach(async () => {
    await cleanupLivePipeline(testPuuid);
    await sleep(2_000);
  });

  afterAll(async () => {
    const { PollerEngine } = await import('../../../src/poller/PollerEngine.js');
    const { RiotGateway } = await import('../../../src/riot-gateway/gateway/RiotGateway.js');
    await PollerEngine.resetInstance();
    await RiotGateway.resetInstance();
  });

  test('T1 full pipeline with matchFilter and rankFilter', async () => {
    const { engine, gateway, pollConfig } = await initLiveOrchestration();
    const matchData: Array<{ matchId: string }> = [];
    engine.getEventBus().on('match:data', (event) => matchData.push({ matchId: event.matchId }));

    await waitForGatewayHeadroom(8);

    const jobsBefore = await countIngestionJobs();
    const { stats } = await engine.poll([{ puuid: testPuuid, platform: 'euw1' }], pollConfig);

    expect(stats.playersCompleted).toBeGreaterThanOrEqual(1);
    expect(await hasRankToday(testPuuid, 'euw1')).toBe(true);

    if (matchData.length > 0) {
      expect(await countProcessedMatchesForPlayer(testPuuid)).toBeGreaterThanOrEqual(1);
      const jobsAfter = await countIngestionJobs();
      expect(jobsAfter).toBeGreaterThanOrEqual(jobsBefore);
    }

    expect(gateway.getStatus().metrics.totals.r429).toBe(0);
  }, 300_000);

  test('T2 re-run skips already processed matches and rank', async () => {
    const { engine, pollConfig } = await initLiveOrchestration();

    await waitForGatewayHeadroom(8);
    const first = await engine.poll([{ puuid: testPuuid, platform: 'euw1' }], pollConfig);
    const processedAfterFirst = await countProcessedMatchesForPlayer(testPuuid);
    expect(await hasRankToday(testPuuid, 'euw1')).toBe(true);

    const matchIds: string[] = [];
    engine.getEventBus().on('match:data', (e) => matchIds.push(e.matchId));

    await waitForGatewayHeadroom(8);
    const jobsBeforeSecond = await countIngestionJobs();
    const second = await engine.poll([{ puuid: testPuuid, platform: 'euw1' }], pollConfig);
    const jobsAfterSecond = await countIngestionJobs();

    expect(await countProcessedMatchesForPlayer(testPuuid)).toBe(processedAfterFirst);
    expect(matchIds.length).toBe(0);
    expect(second.stats.matchesFetched).toBeLessThanOrEqual(first.stats.matchesFetched);
    expect(jobsAfterSecond).toBe(jobsBeforeSecond);
  }, 600_000);
});
