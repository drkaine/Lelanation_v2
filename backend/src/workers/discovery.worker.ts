import { Worker } from "bullmq";
import { config } from "../config/index.js";
import { sql } from "../db/client.js";
import type { DiscoveryJobData } from "../dto/match.dto.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { hydrationQueue, discoveryQueue } from "../queues/index.js";
import { DISCOVERY_QUEUE } from "../queues/definitions.js";
import { redis } from "../redis/client.js";
import { waitForSlot } from "../redis/rate-limiter.js";
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

async function runDiscoveryCycle(): Promise<void> {
  const startedAt = Date.now();
  const nowSec = Math.floor(startedAt / 1000);
  const patchWindow = await resolveDiscoveryPatchStart(nowSec);
  pollerV2Observability.incDiscoveryCycle();
  await sql.begin(async (tx) => {
    const players = await tx<PlayerRow[]>`
      SELECT puuid, region, last_seen
      FROM players
      WHERE puuid_key_version = ${config.PLAYER_KEY_VERSION}
      ORDER BY last_seen ASC NULLS FIRST
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const player = players[0];
    if (!player) {
      pollerV2Observability.incDiscoveryNoPlayerCycle();
      return;
    }

    pollerV2Observability.recordPlayersPolled(1);
    const lastSeenSec = toEpochSeconds(player.last_seen);
    const discoveryStartTime =
      lastSeenSec == null || lastSeenSec < patchWindow.startTimeSec ? patchWindow.startTimeSec : lastSeenSec;
    const startTime = Math.min(discoveryStartTime, nowSec);
    await waitForSlot(1);
    const matchIds = await riotClient.getMatchlist(player.puuid, player.region, { startTime });

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
    pollerV2Observability.recordDiscoveryMatches(matchIds.length, newMatchIds.length);

    if (newMatchIds.length > 0) {
      await hydrationQueue.addBulk(
        newMatchIds.map((matchId) => ({
          name: "hydrate-match",
          data: {
            matchId,
            region: player.region,
            puuid: player.puuid,
          },
        })),
      );
    }

    await tx`
      UPDATE players
      SET last_seen = NOW()
      WHERE puuid = ${player.puuid}
    `;
    pollerV2Observability.recordPlayersUpdated(1);
  });
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
  await discoveryQueue.add(
    "discovery-tick",
    {
      puuid: "",
      region: "",
    },
    {
      repeat: {
        every: 30_000,
      },
      jobId: "discovery:repeat:30s",
    },
  );
}
