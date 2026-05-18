import "dotenv/config";
import { Queue } from "bullmq";
import Redis from "ioredis";
import postgres from "postgres";
import { HYDRATION_QUEUE } from "../src/queues/definitions.js";

const DUPLICATE_THRESHOLD = 0.1;
const ALREADY_IN_DB_THRESHOLD = 0.1;
const DB_BATCH_SIZE = 500;

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
/** `processed_matches` vit sur la base statistiques (même URL que le poller). */
const databaseUrl = process.env.DATABASE_URL_STATISTIQUES ?? process.env.DATABASE_URL;

const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const hydrationQueue = new Queue(HYDRATION_QUEUE, { connection: redis });

type HydrationJobData = {
  matchId?: string;
  region?: string;
  puuid?: string;
};

async function countKnownInDb(matchIds: string[]): Promise<number> {
  if (matchIds.length === 0 || !databaseUrl) {
    return 0;
  }

  const sql = postgres(databaseUrl);
  const known = new Set<string>();

  try {
    for (let offset = 0; offset < matchIds.length; offset += DB_BATCH_SIZE) {
      const chunk = matchIds.slice(offset, offset + DB_BATCH_SIZE);
      const rows = await sql<{ riot_match_id: string }[]>`
        SELECT riot_match_id
        FROM processed_matches
        WHERE riot_match_id = ANY(${sql.array(chunk)})
      `;
      for (const row of rows) {
        known.add(row.riot_match_id);
      }
    }
    return known.size;
  } finally {
    await sql.end();
  }
}

async function main(): Promise<void> {
  const jobs = await hydrationQueue.getWaiting(0, -1);
  const matchIds = jobs
    .map((job) => (job.data as HydrationJobData).matchId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const unique = new Set(matchIds);
  const duplicateCount = matchIds.length - unique.size;

  const summary = {
    total: matchIds.length,
    unique: unique.size,
    duplicates: duplicateCount,
  };
  console.log(summary);

  if (matchIds.length === 0) {
    console.log(JSON.stringify({ msg: "queue_empty", action: "none" }));
    return;
  }

  let alreadyInDb = 0;
  if (!databaseUrl) {
    console.warn("DATABASE_URL / DATABASE_URL_STATISTIQUES not set — skip processed_matches check");
  } else {
    try {
      alreadyInDb = await countKnownInDb([...unique]);
      console.log({
        alreadyInDb,
        uniqueChecked: unique.size,
      });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      console.warn(
        `processed_matches check failed (${code}) — use DATABASE_URL_STATISTIQUES. Only duplicate rate will decide obliterate.`,
      );
    }
  }

  const duplicateRate = duplicateCount / matchIds.length;
  const alreadyInDbRate = unique.size > 0 ? alreadyInDb / unique.size : 0;

  const shouldObliterate =
    duplicateRate > DUPLICATE_THRESHOLD || alreadyInDbRate > ALREADY_IN_DB_THRESHOLD;

  console.log({
    duplicateRate: Math.round(duplicateRate * 1000) / 10,
    alreadyInDbRate: Math.round(alreadyInDbRate * 1000) / 10,
    thresholds: {
      duplicatePct: DUPLICATE_THRESHOLD * 100,
      alreadyInDbPct: ALREADY_IN_DB_THRESHOLD * 100,
    },
    shouldObliterate,
  });

  if (shouldObliterate) {
    await hydrationQueue.obliterate({ force: true });
    console.info(
      JSON.stringify({
        msg: "queue_obliterated",
        reason: "too_many_duplicates",
        duplicateRate,
        alreadyInDbRate,
        alreadyInDb,
        ...summary,
      }),
    );
    return;
  }

  console.log(
    JSON.stringify({
      msg: "queue_ok_drain_naturally",
      duplicateRate,
      alreadyInDbRate,
    }),
  );
}

main()
  .catch((error) => {
    console.error("check-queue-duplicates failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await hydrationQueue.close();
    await redis.quit();
  });
