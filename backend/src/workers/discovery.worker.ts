import { Worker } from "bullmq";
import { config } from "../config/index.js";
import { sql } from "../db/client.js";
import type { DiscoveryJobData } from "../dto/match.dto.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { bullmqJobId } from "../queues/bullmq-job-id.js";
import { maxRankBacklogBeforePipelinePause, shouldPauseMatchPipelines } from "../queues/rank-backlog-policy.js";
import { discoveryQueue, getRankBacklogCount, hydrationQueue } from "../queues/index.js";
import { enqueueHydrationMatchIfAbsent } from "../queues/hydration-enqueue.js";
import { DISCOVERY_QUEUE } from "../queues/definitions.js";
import { redis } from "../redis/client.js";
import { waitForDiscoverySlot } from "../redis/rate-scheduler.js";
import { RiotClient } from "../riot/client.js";
import {
  findPreviousPatchEntry,
  getPatchFromVersion,
  loadCurrentGameVersion,
  loadGameVersionsRecap,
  releaseDateToStartOfDayUtcSeconds,
} from "../services/RiotConfigService.js";

type PlayerRow = {
  puuid: string;
  region: string;
  last_seen: Date | string | null;
};

const riotClient = new RiotClient();
const PATCH_SWITCH_GRACE_DAYS = 2;
const QUEUED_MATCH_TTL_SEC = 86_400;

function queuedMatchKey(matchId: string): string {
  return `rl:queued:${matchId}`;
}

function toEpochSeconds(value: Date | string | null): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

async function resolveDiscoveryPatchStart(nowSec: number): Promise<{ startTimeSec: number }> {
  const fallbackStart = nowSec - 14 * 86400;
  const currentRes = await loadCurrentGameVersion();
  if (currentRes.isErr()) {
    return { startTimeSec: fallbackStart };
  }
  const current = currentRes.unwrap();
  if (!current) {
    return { startTimeSec: fallbackStart };
  }
  const currentPatch = getPatchFromVersion(current.currentVersion);
  const currentReleaseStart = releaseDateToStartOfDayUtcSeconds(String(current.releaseDate ?? ""));
  if (!Number.isFinite(currentReleaseStart)) {
    return { startTimeSec: fallbackStart };
  }

  const currentPatchCutoff = currentReleaseStart + PATCH_SWITCH_GRACE_DAYS * 86400;
  let effectiveReleaseStart = currentReleaseStart;

  if (nowSec < currentPatchCutoff && currentPatch) {
    const recapRes = await loadGameVersionsRecap();
    if (!recapRes.isErr()) {
      const previous = findPreviousPatchEntry(recapRes.unwrap(), currentPatch);
      if (previous) {
        const previousReleaseStart = releaseDateToStartOfDayUtcSeconds(previous.releaseDate);
        if (Number.isFinite(previousReleaseStart)) {
          effectiveReleaseStart = previousReleaseStart;
        }
      }
    }
  }

  return {
    startTimeSec: effectiveReleaseStart + PATCH_SWITCH_GRACE_DAYS * 86400,
  };
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
      SELECT puuid, region, last_seen
      FROM players
      WHERE LENGTH(TRIM(puuid)) > 0
      ORDER BY last_seen ASC NULLS FIRST
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
  });
}

async function getNextPlayer(): Promise<PlayerRow | null> {
  const rows = await sql.begin(async (tx) => {
    return tx<PlayerRow[]>`
      SELECT puuid, region, last_seen
      FROM players
      WHERE LENGTH(TRIM(puuid)) > 0
      ORDER BY last_seen ASC NULLS FIRST
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
  });
  return rows[0] ?? null;
}

async function processDiscoveryPlayer(
  player: PlayerRow,
  patchWindow: { startTimeSec: number },
  nowSec: number,
): Promise<void> {
  pollerV2Observability.recordPlayersPolled(1);
  const lastSeenSec = toEpochSeconds(player.last_seen);
  const discoveryStartTime =
    lastSeenSec == null || lastSeenSec < patchWindow.startTimeSec ? patchWindow.startTimeSec : lastSeenSec;
  const startTime = Math.min(discoveryStartTime, nowSec);

  await waitForDiscoverySlot();
  const matchIds = await riotClient.getMatchlist(player.puuid, player.region, { startTime });

  await sql.begin(async (tx) => {
    const knownRows =
      matchIds.length > 0
        ? await tx<{ riot_match_id: string }[]>`
            SELECT riot_match_id
            FROM processed_matches
            WHERE riot_match_id = ANY(${tx.array(matchIds, 25)})
          `
        : [];

    const knownIds = new Set(knownRows.map((row) => row.riot_match_id));
    const newMatchIds = matchIds.filter((matchId) => !knownIds.has(matchId));
    const toEnqueue = await filterMatchIdsNotAlreadyQueued(newMatchIds);

    pollerV2Observability.recordDiscoveryMatches(matchIds.length, toEnqueue.length);

    if (toEnqueue.length > 0) {
      await markMatchIdsQueued(toEnqueue);
      for (const matchId of toEnqueue) {
        const enqueued = await enqueueHydrationMatchIfAbsent(matchId, player.region, player.puuid);
        if (enqueued) {
          pollerV2Observability.recordMatchQueuedForPipeline(matchId);
        }
      }
    }

    await tx`
      UPDATE players
      SET
        last_seen = NOW(),
        puuid_key_version = ${config.PLAYER_KEY_VERSION}
      WHERE puuid = ${player.puuid}
    `;
    pollerV2Observability.recordPlayersUpdated(1);
  });
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
  const patchWindow = await resolveDiscoveryPatchStart(nowSec);
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
    await processDiscoveryPlayer(player, patchWindow, nowSec);
  }

  const queueDepth = await hydrationQueue.getWaitingCount();
  if (queueDepth < minQueueDepth && players.length === playersPerTick) {
    const bonusPlayer = await getNextPlayer();
    if (bonusPlayer) {
      await processDiscoveryPlayer(bonusPlayer, patchWindow, nowSec);
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
