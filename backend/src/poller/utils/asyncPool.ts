export async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  task: (item: T) => Promise<R>,
  taskTimeoutMs?: number,
): Promise<Array<{ item: T; result?: R; error?: unknown }>> {
  if (items.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const results: Array<{ item: T; result?: R; error?: unknown }> = [];
  let index = 0;

  async function runOne(item: T): Promise<void> {
    try {
      const work = task(item);
      const result = taskTimeoutMs != null
        ? await Promise.race([
            work,
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`asyncPool task timeout after ${taskTimeoutMs}ms`)), taskTimeoutMs);
            }),
          ])
        : await work;
      results.push({ item, result });
    } catch (error) {
      results.push({ item, error });
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await runOne(current);
    }
  });

  await Promise.all(workers);
  return results;
}
