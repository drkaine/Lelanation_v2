import { Worker } from "bullmq";
import { config } from "../config/index.js";
import { sql } from "../db/client.js";
import type { DiscoveryJobData } from "../dto/match.dto.js";
import { hydrationQueue, discoveryQueue } from "../queues/index.js";
import { DISCOVERY_QUEUE } from "../queues/definitions.js";
import { redis } from "../redis/client.js";
import { waitForSlot } from "../redis/rate-limiter.js";
import { RiotClient } from "../riot/client.js";

type PlayerRow = {
  puuid: string;
  region: string;
};

const riotClient = new RiotClient();

async function runDiscoveryCycle(): Promise<void> {
  await sql.begin(async (tx) => {
    const players = await tx<PlayerRow[]>`
      SELECT puuid, region
      FROM players
      WHERE puuid_key_version = ${config.ENV}
      ORDER BY last_seen ASC NULLS FIRST
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const player = players[0];
    if (!player) {
      return;
    }

    await waitForSlot(1);
    const matchIds = await riotClient.getMatchlist(player.puuid, player.region);

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
  });
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
