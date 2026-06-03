import { Queue } from 'bullmq';
import IORedis from 'ioredis';

/** Minimal Redis client — avoids loading full app config when retrying jobs. */
async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379';
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue('ingestion', { connection });

  const counts = await queue.getJobCounts('failed', 'waiting', 'active', 'completed');
  const failed = await queue.getJobs(['failed'], 0, 10_000);
  let retried = 0;
  for (const job of failed) {
    await job.retry();
    retried += 1;
  }
  console.log('[retry-failed-ingestion] queue counts before retry:', counts);
  console.log(`[retry-failed-ingestion] retried ${retried} job(s)`);
  await queue.close();
  await connection.quit();
  process.exit(0);
}

main().catch((error) => {
  console.error('[retry-failed-ingestion] failed', error);
  process.exit(1);
});
