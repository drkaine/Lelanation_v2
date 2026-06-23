import { RiotGateway } from '../../../../src/riot-gateway/gateway/RiotGateway.js';
import { MatchFilter } from '../../../../src/poll-orchestration/MatchFilter.js';
import { ParticipantDiscovery } from '../../../../src/poll-orchestration/ParticipantDiscovery.js';
import { PatchResolver } from '../../../../src/poll-orchestration/PatchResolver.js';
import { PlayerDiscovery } from '../../../../src/poll-orchestration/PlayerDiscovery.js';
import { PollerDbConsumer } from '../../../../src/poll-orchestration/PollerDbConsumer.js';
import { RankFilter } from '../../../../src/poll-orchestration/RankFilter.js';
import { PollerEngine } from '../../../../src/poller/PollerEngine.js';
import type { PollConfig } from '../../../../src/poller/types.js';
import { sql } from '../../../../src/db/client.js';
import { ingestionQueue } from '../../../../src/queues/index.js';

export async function cleanupLivePipeline(puuid: string): Promise<void> {
  await sql`
    DELETE FROM participants
    WHERE puuid = ${puuid}
      AND riot_match_id LIKE 'EUW1_%'
  `;
  await sql`
    DELETE FROM player_rank_history
    WHERE puuid = ${puuid}
      AND date = CURRENT_DATE
  `;
}

export async function ensurePlayerInDb(puuid: string, region = 'euw1'): Promise<void> {
  await sql`
    INSERT INTO players (puuid, region, last_seen, updated_at)
    VALUES (${puuid}, ${region}, NOW(), NOW())
    ON CONFLICT (puuid) DO UPDATE SET region = EXCLUDED.region, updated_at = NOW()
  `;
}

export async function countProcessedMatchesForPlayer(puuid: string): Promise<number> {
  const rows = await sql<{ count: number }[]>`
    SELECT COUNT(DISTINCT riot_match_id)::int AS count
    FROM participants
    WHERE puuid = ${puuid}
  `;
  return rows[0]?.count ?? 0;
}

export async function hasRankToday(puuid: string, region: string): Promise<boolean> {
  const rows = await sql<{ exists: number }[]>`
    SELECT 1 AS exists
    FROM player_rank_history
    WHERE puuid = ${puuid}
      AND region = ${region}
      AND date = CURRENT_DATE
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function initLiveOrchestration(): Promise<{
  engine: PollerEngine;
  gateway: RiotGateway;
  matchFilter: MatchFilter;
  rankFilter: RankFilter;
  pollConfig: Partial<PollConfig>;
}> {
  await PollerEngine.resetInstance();
  await RiotGateway.resetInstance();

  const patchInfo = await PatchResolver.resolveCurrentPatchInfo();
  const engine = PollerEngine.getInstance();
  const matchFilter = new MatchFilter();
  const rankFilter = new RankFilter();
  const participantDiscovery = new ParticipantDiscovery();
  const playerDiscovery = new PlayerDiscovery();

  const consumer = new PollerDbConsumer(participantDiscovery, playerDiscovery, {
    currentPatch: patchInfo.patch,
    rankTierForUnranked: 'UNRANKED',
    resolveParticipantRanks: true,
  }, engine.getEventBus());
  consumer.subscribe();

  const sinceDays = Number.parseInt(process.env.POLLER_LIVE_SINCE_DAYS ?? '2', 10);
  const maxMatches = Number.parseInt(process.env.POLLER_LIVE_MAX_MATCHES ?? '2', 10);

  const pollConfig: Partial<PollConfig> = {
    sinceTimestamp: Math.floor(Date.now() / 1000) - sinceDays * 24 * 3600,
    matchIdsPerPage: Math.min(20, Math.max(maxMatches, 1)),
    maxConcurrentMatchFetches: 2,
    participantRankConcurrency: 2,
    maxConcurrentPlayers: 1,
    maxMatchesToProcess: maxMatches,
    matchFilter: (ids) => matchFilter.filterNew(ids),
    rankFilter: (puuid, region) => rankFilter.isKnownToday(puuid, region),
  };

  return {
    engine,
    gateway: RiotGateway.getInstance(),
    matchFilter,
    rankFilter,
    pollConfig,
  };
}

export async function countIngestionJobs(): Promise<number> {
  const counts = await ingestionQueue.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
  return (
    (counts.waiting ?? 0) +
    (counts.active ?? 0) +
    (counts.delayed ?? 0) +
    (counts.prioritized ?? 0)
  );
}

export { resolveTestPuuid, waitForGatewayHeadroom, sleep } from '../../../poller/integration/helpers/liveEnv.js';
