import { Queue } from 'bullmq';
import IORedis from 'ioredis';

/** Minimal Redis client — avoids loading full app config when retrying jobs. */
async function main(): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379';
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue('ingestion', { connection });

  const countsBefore = await queue.getJobCounts('failed', 'waiting', 'active', 'completed');
  const failedBefore = countsBefore.failed ?? 0;

  if (failedBefore > 0) {
    await queue.retryJobs({ state: 'failed' });
  }

  const countsAfter = await queue.getJobCounts('failed', 'waiting', 'active', 'completed');
  console.log('[retry-failed-ingestion] counts before:', countsBefore);
  console.log('[retry-failed-ingestion] counts after:', countsAfter);
  console.log(`[retry-failed-ingestion] retried ${failedBefore} job(s)`);
  await queue.close();
  await connection.quit();
  process.exit(0);
}

main().catch((error) => {
  console.error('[retry-failed-ingestion] failed', error);
  process.exit(1);
});
