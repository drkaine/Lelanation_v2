/**
 * Retire les jobs rank en attente dont le snapshot du jour existe déjà en DB.
 * Réduit le backlog sans appel API (League v4 = rang du jour uniquement).
 */
import "dotenv/config";
import { Queue } from "bullmq";
import Redis from "ioredis";
import postgres from "postgres";
import { RANK_QUEUE } from "../src/queues/definitions.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const databaseUrl = process.env.DATABASE_URL;
const BATCH = 500;

const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const rankQueue = new Queue(RANK_QUEUE, { connection: redis });

type RankJobData = { puuid?: string; region?: string };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL required");
  }

  const sql = postgres(databaseUrl);
  const today = todayIso();
  let start = 0;
  let scanned = 0;
  let removed = 0;

  try {
    while (true) {
      const jobs = await rankQueue.getJobs(["waiting", "delayed"], start, start + BATCH - 1, true);
      if (jobs.length === 0) break;

      const entries: Array<{ jobId: string; puuid: string; region: string }> = [];
      for (const job of jobs) {
        const data = job.data as RankJobData;
        const puuid = String(data.puuid ?? "").trim();
        const region = String(data.region ?? "").trim().toLowerCase();
        if (!puuid || !region) continue;
        entries.push({ jobId: job.id!, puuid, region });
      }

      if (entries.length > 0) {
        const puuids = [...new Set(entries.map((e) => e.puuid))];
        const rows = await sql<{ puuid: string; region: string }[]>`
          SELECT puuid, region
          FROM player_rank_history
          WHERE date = ${today}::date
            AND puuid IN ${sql(puuids)}
        `;
        const satisfied = new Set(rows.map((r) => `${r.puuid}|${r.region}`));

        for (const entry of entries) {
          if (!satisfied.has(`${entry.puuid}|${entry.region}`)) continue;
          const job = jobs.find((j) => j.id === entry.jobId);
          if (job) {
            await job.remove();
            removed += 1;
          }
        }
      }

      scanned += jobs.length;
      start += BATCH;
      if (jobs.length < BATCH) break;
      console.log(JSON.stringify({ scanned, removed }));
    }

    const counts = await rankQueue.getJobCounts("waiting", "delayed", "active", "failed");
    console.log(JSON.stringify({ msg: "prune_rank_queue_done", scanned, removed, counts }));
  } finally {
    await sql.end();
    await rankQueue.close();
    await redis.quit();
  }
}

await main();
