import { Worker } from "bullmq";
import { config } from "../config/index.js";
import { sql } from "../db/client.js";
import type { DiscoveryJobData } from "../dto/match.dto.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { bullmqJobId } from "../queues/bullmq-job-id.js";
import { maxRankBacklogBeforePipelinePause, shouldPauseMatchPipelines } from "../queues/rank-backlog-policy.js";
import { discoveryQueue, getQueueMetrics, getRankBacklogCount, hydrationQueue } from "../queues/index.js";
import { enqueueHydrationMatchIfAbsent } from "../queues/hydration-enqueue.js";
import { enqueueRankPrefetchJob } from "../queues/rank-jobs.js";
import { hasTodayRankSnapshot } from "../services/rank-inflight.js";
import { DISCOVERY_QUEUE } from "../queues/definitions.js";
import { redis } from "../redis/client.js";
import { waitForDiscoverySlot } from "../redis/rate-scheduler.js";
import { RiotClient } from "../riot/client.js";

type PlayerRow = {
  puuid: string;
  region: string;
  last_seen: Date | string | null;
  created_at: Date | string;
};

/** Prefetch rank discovery réservé aux joueurs ajoutés aujourd'hui (corpus bootstrap). */
export function isNewlyAddedPlayer(player: Pick<PlayerRow, "created_at">, now = new Date()): boolean {
  const created =
    player.created_at instanceof Date ? player.created_at : new Date(String(player.created_at));
  if (!Number.isFinite(created.getTime())) return false;
  const todayIso = now.toISOString().slice(0, 10);
  return created.toISOString().slice(0, 10) === todayIso;
}

const riotClient = new RiotClient();
const HYDRATION_RANK_BACKPRESSURE_WC = 150;
const HYDRATION_RANK_BACKPRESSURE_TOTAL = 2_000;
const QUEUED_MATCH_TTL_SEC = 86_400;
/** Max matchs enfilés par joueur par cycle — évite monopolisation discovery/hydration. */
const MAX_MATCHES_PER_PLAYER_PER_TICK = 20;
const RIOT_MATCHLIST_PAGE_SIZE = 20;
const MATCHLIST_WINDOW_24H_SEC = 24 * 60 * 60;
const EUROPE_PLATFORM_KEYS = ["euw1", "euw", "eun1", "eune", "tr1", "tr", "ru"] as const;

function queuedMatchKey(matchId: string): string {
  return `rl:queued:${matchId}`;
}

function toEpochSeconds(value: Date | string | null): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

async function filterMatchIdsNotAlreadyQueued(matchIds: string[]): Promise<string[]> {
  if (matchIds.length === 0) {
    return [];
  }

  const pipeline = redis.pipeline();
  for (const matchId of matchIds) {
    pipeline.exists(queuedMatchKey(matchId));
  }
  const results = await pipeline.exec();

  const toEnqueue: string[] = [];
  for (let i = 0; i < matchIds.length; i += 1) {
    const exists = results?.[i]?.[1];
    if (exists !== 1) {
      toEnqueue.push(matchIds[i]!);
    }
  }
  return toEnqueue;
}

async function markMatchIdsQueued(matchIds: string[]): Promise<void> {
  if (matchIds.length === 0) {
    return;
  }

  const pipeline = redis.pipeline();
  for (const matchId of matchIds) {
    pipeline.set(queuedMatchKey(matchId), "1", "EX", QUEUED_MATCH_TTL_SEC);
  }
  await pipeline.exec();
}

async function selectPlayersBatch(limit: number): Promise<PlayerRow[]> {
  return sql.begin(async (tx) => {
    return tx<PlayerRow[]>`
      SELECT puuid, region, last_seen, created_at
      FROM players
      WHERE LENGTH(TRIM(puuid)) > 0
        AND LOWER(TRIM(COALESCE(region, ''))) = ANY(${sql.array([...EUROPE_PLATFORM_KEYS], 25)})
      ORDER BY last_seen DESC NULLS LAST
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
  });
}

async function getNextPlayer(): Promise<PlayerRow | null> {
  const rows = await sql.begin(async (tx) => {
    return tx<PlayerRow[]>`
      SELECT puuid, region, last_seen, created_at
      FROM players
      WHERE LENGTH(TRIM(puuid)) > 0
        AND LOWER(TRIM(COALESCE(region, ''))) = ANY(${sql.array([...EUROPE_PLATFORM_KEYS], 25)})
      ORDER BY last_seen DESC NULLS LAST
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
  });
  return rows[0] ?? null;
}

async function resolveMatchGameStartEpoch(matchId: string, region: string): Promise<number | null> {
  try {
    const match = await riotClient.getMatch(matchId, region);
    const gameStartMs =
      Number(match.info.gameStartTimestamp ?? 0) ||
      Number(match.info.gameCreation ?? 0);
    if (!Number.isFinite(gameStartMs) || gameStartMs <= 0) {
      return null;
    }
    return Math.floor(gameStartMs / 1000);
  } catch (error) {
    console.warn(
      JSON.stringify({
        msg: "discovery_match_timestamp_failed",
        matchId,
        region,
        reason: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  }
}

async function resolveLastSeenUpdate(
  matchIds: string[],
  newMatchIds: string[],
  toQueue: string[],
  skipped: number,
  region: string,
): Promise<Date | null> {
  if (toQueue.length > 0) {
    const mightHaveMorePages = matchIds.length >= RIOT_MATCHLIST_PAGE_SIZE;
    if (skipped > 0 || mightHaveMorePages) {
      const lastQueuedMatchId = toQueue[toQueue.length - 1]!;
      const gameStartSec = await resolveMatchGameStartEpoch(lastQueuedMatchId, region);
      if (gameStartSec != null) {
        return new Date(gameStartSec * 1000);
      }
      return null;
    }
    return new Date();
  }

  if (newMatchIds.length === 0) {
    return new Date();
  }

  return null;
}

async function processDiscoveryPlayer(
  player: PlayerRow,
  windowStartTimeSec: number,
  nowSec: number,
): Promise<void> {
  pollerV2Observability.recordPlayersPolled(1);
  const lastSeenSec = toEpochSeconds(player.last_seen);
  const discoveryStartTime =
    lastSeenSec == null ? windowStartTimeSec : Math.max(lastSeenSec, windowStartTimeSec);
  const startTime = Math.min(discoveryStartTime, nowSec);

  await waitForDiscoverySlot();
  const matchIds = await riotClient.getMatchIds(player.puuid, player.region, { startTime });

  const shouldPrefetchRank = isNewlyAddedPlayer(player);
  if (shouldPrefetchRank) {
    const alreadyRankedToday = await hasTodayRankSnapshot(player.puuid, player.region);
    pollerV2Observability.recordDiscoveryRankPrefetch(1, alreadyRankedToday ? 0 : 1);
    if (!alreadyRankedToday) {
      await enqueueRankPrefetchJob(player.puuid, player.region);
    }
  }

  const knownRows =
    matchIds.length > 0
      ? await sql<{ riot_match_id: string }[]>`
          SELECT riot_match_id
          FROM processed_matches
          WHERE riot_match_id = ANY(${sql.array(matchIds, 25)})
        `
      : [];

  const knownIds = new Set(knownRows.map((row) => row.riot_match_id));
  const newMatchIds = matchIds.filter((matchId) => !knownIds.has(matchId));
  const notQueued = await filterMatchIdsNotAlreadyQueued(newMatchIds);
  const toQueue = notQueued.slice(0, MAX_MATCHES_PER_PLAYER_PER_TICK);
  const skipped = notQueued.length - toQueue.length;

  pollerV2Observability.recordDiscoveryMatches(matchIds.length, toQueue.length);

  if (skipped > 0) {
    console.log(
      JSON.stringify({
        msg: "discovery_player_capped",
        puuid: player.puuid,
        totalNew: notQueued.length,
        queued: toQueue.length,
        skipped,
      }),
    );
  }

  if (toQueue.length > 0) {
    await markMatchIdsQueued(toQueue);
    for (const matchId of toQueue) {
      const enqueued = await enqueueHydrationMatchIfAbsent(matchId, player.region, player.puuid);
      if (enqueued) {
        pollerV2Observability.recordMatchQueuedForPipeline(matchId);
      }
    }
  }

  const lastSeenUpdate = await resolveLastSeenUpdate(
    matchIds,
    newMatchIds,
    toQueue,
    skipped,
    player.region,
  );
  if (lastSeenUpdate) {
    await sql`
      UPDATE players
      SET
        last_seen = ${lastSeenUpdate},
        puuid_key_version = ${config.PLAYER_KEY_VERSION}
      WHERE puuid = ${player.puuid}
    `;
    pollerV2Observability.recordPlayersUpdated(1);
  }
}

async function runDiscoveryCycle(): Promise<void> {
  const startedAt = Date.now();
  const rankBacklog = await getRankBacklogCount();
  if (shouldPauseMatchPipelines(rankBacklog)) {
    console.debug(
      JSON.stringify({
        msg: "discovery_paused_rank_backlog",
        rankBacklog,
        threshold: maxRankBacklogBeforePipelinePause(),
      }),
    );
    pollerV2Observability.recordDuration("discoveryCycleMs", Date.now() - startedAt);
    return;
  }

  const hydrationWaiting = await hydrationQueue.getWaitingCount();
  const maxHydrationQueueDepth = config.MAX_HYDRATION_QUEUE_DEPTH;
  const queueMetrics = await getQueueMetrics();
  const hydrationWaitingChildren = queueMetrics.hydration.waitingChildren ?? 0;
  const hydrationPressure = hydrationWaiting + hydrationWaitingChildren;

  if (
    hydrationWaitingChildren > HYDRATION_RANK_BACKPRESSURE_WC ||
    hydrationPressure > HYDRATION_RANK_BACKPRESSURE_TOTAL
  ) {
    console.log(
      JSON.stringify({
        msg: "discovery_paused_hydration_backpressure",
        hydrationWaiting,
        hydrationWaitingChildren,
        hydrationPressure,
        wcThreshold: HYDRATION_RANK_BACKPRESSURE_WC,
        totalThreshold: HYDRATION_RANK_BACKPRESSURE_TOTAL,
      }),
    );
    pollerV2Observability.recordDuration("discoveryCycleMs", Date.now() - startedAt);
    return;
  }

  if (hydrationWaiting > maxHydrationQueueDepth) {
    console.debug(
      JSON.stringify({
        msg: "discovery_paused_queue_full",
        hydrationWaiting,
        limit: maxHydrationQueueDepth,
      }),
    );
    pollerV2Observability.recordDuration("discoveryCycleMs", Date.now() - startedAt);
    return;
  }

  const nowSec = Math.floor(startedAt / 1000);
  const windowStartTimeSec = nowSec - MATCHLIST_WINDOW_24H_SEC;
  const playersPerTick = config.DISCOVERY_PLAYERS_PER_TICK;
  const minQueueDepth = config.DISCOVERY_MIN_QUEUE_DEPTH;

  pollerV2Observability.incDiscoveryCycle();

  const players = await selectPlayersBatch(playersPerTick);
  if (players.length === 0) {
    pollerV2Observability.incDiscoveryNoPlayerCycle();
    pollerV2Observability.recordDuration("discoveryCycleMs", Date.now() - startedAt);
    return;
  }

  for (const player of players) {
    await processDiscoveryPlayer(player, windowStartTimeSec, nowSec);
  }

  const queueDepth = await hydrationQueue.getWaitingCount();
  if (queueDepth < minQueueDepth && players.length === playersPerTick) {
    const bonusPlayer = await getNextPlayer();
    if (bonusPlayer) {
      await processDiscoveryPlayer(bonusPlayer, windowStartTimeSec, nowSec);
    }
  }

  pollerV2Observability.recordDuration("discoveryCycleMs", Date.now() - startedAt);
}

export const discoveryWorker = new Worker<DiscoveryJobData>(
  DISCOVERY_QUEUE,
  async () => {
    await runDiscoveryCycle();
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

export async function scheduleDiscoveryRepeatJob(): Promise<void> {
  const intervalMs = config.DISCOVERY_INTERVAL_MS;
  const repeatables = await discoveryQueue.getRepeatableJobs();
  for (const job of repeatables) {
    if (job.id?.startsWith("discovery_repeat")) {
      await discoveryQueue.removeRepeatableByKey(job.key);
    }
  }

  await discoveryQueue.add(
    "discovery-tick",
    {
      puuid: "",
      region: "",
    },
    {
      repeat: {
        every: intervalMs,
      },
      jobId: bullmqJobId("discovery", "repeat", `${intervalMs}ms`),
    },
  );
}
