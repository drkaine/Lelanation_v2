import "dotenv/config";
import { Queue, type Job } from "bullmq";
import Redis from "ioredis";
import { HYDRATION_QUEUE, INGESTION_QUEUE } from "../src/queues/definitions.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

const hydrationQueue = new Queue(HYDRATION_QUEUE, { connection: redis });
const ingestionQueue = new Queue(INGESTION_QUEUE, { connection: redis });

type JobDataLike = {
  matchId?: string;
  patch?: string;
  participants?: Array<{ matchId?: string; patch?: string }>;
  teamStats?: { matchId?: string; patch?: string };
};

type FailedJobRow = {
  id: string | undefined;
  matchId: string | undefined;
  patch: string | undefined;
  failedReason: string;
  stackFirstLine: string | undefined;
  attemptsMade: number;
  finishedOn: string;
};

function extractRow(job: Job): FailedJobRow {
  const data = job.data as JobDataLike;
  const firstParticipant = data.participants?.[0];

  return {
    id: job.id,
    matchId: data.matchId ?? firstParticipant?.matchId ?? data.teamStats?.matchId,
    patch: data.patch ?? firstParticipant?.patch ?? data.teamStats?.patch,
    failedReason: job.failedReason ?? "unknown",
    stackFirstLine: job.stacktrace?.[0]?.split("\n")[1]?.trim(),
    attemptsMade: job.attemptsMade ?? 0,
    finishedOn: new Date(job.finishedOn ?? 0).toISOString(),
  };
}

function reasonKey(failedReason: string): string {
  return failedReason.split("\n")[0]?.trim() || "unknown";
}

function groupByReason(rows: Array<{ row: FailedJobRow; job: Job }>): Map<string, Array<{ row: FailedJobRow; job: Job }>> {
  const groups = new Map<string, Array<{ row: FailedJobRow; job: Job }>>();
  for (const entry of rows) {
    const key = reasonKey(entry.row.failedReason);
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  return groups;
}

function printQueueReport(queueName: string, jobs: Job[]): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`QUEUE: ${queueName} — ${jobs.length} failed job(s)`);
  console.log("=".repeat(72));

  if (jobs.length === 0) {
    console.log("(aucun job en échec)\n");
    return;
  }

  const entries = jobs.map((job) => ({ row: extractRow(job), job }));
  const byReason = new Map<string, number>();
  for (const { row } of entries) {
    const r = reasonKey(row.failedReason);
    byReason.set(r, (byReason.get(r) ?? 0) + 1);
  }

  console.log("\n--- Résumé par failedReason ---\n");
  const sortedReasons = [...byReason.entries()].sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of sortedReasons) {
    console.log(`${count}\t${reason}`);
  }

  const groups = groupByReason(entries);
  console.log("\n--- Exemples (max 3 par groupe) ---\n");

  for (const [reason, groupEntries] of [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    console.log(`\n### ${reason} (${groupEntries.length} total)\n`);
    const examples = groupEntries.slice(0, 3);
    for (const [index, { row, job }] of examples.entries()) {
      console.log(`--- Exemple ${index + 1}/${examples.length} ---`);
      console.log(JSON.stringify(row, null, 2));
      console.log("jobData:");
      console.log(JSON.stringify(job.data, null, 2));
      console.log("stacktrace:");
      if (job.stacktrace?.length) {
        for (const [i, frame] of job.stacktrace.entries()) {
          console.log(`[${i}] ${frame}`);
        }
      } else {
        console.log("(vide)");
      }
      console.log("");
    }
  }
}

async function inspectQueue(queueName: string, queue: Queue): Promise<void> {
  const failed = await queue.getFailed(0, -1);
  printQueueReport(queueName, failed);
}

async function main(): Promise<void> {
  console.log(`inspect-failed-jobs @ ${new Date().toISOString()}`);
  console.log(`REDIS_URL=${redisUrl}`);

  await inspectQueue("hydration", hydrationQueue);
  await inspectQueue("ingestion", ingestionQueue);
}

main()
  .catch((error) => {
    console.error("inspect-failed-jobs failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await hydrationQueue.close();
    await ingestionQueue.close();
    await redis.quit();
  });
