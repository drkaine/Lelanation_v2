import { MetricsStore } from './MetricsStore.js';

export async function timedDbOp<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const store = MetricsStore.getInstance();
  const start = Date.now();
  try {
    const result = await fn();
    store.pushDbOperation({
      ts: Date.now(),
      operation,
      durationMs: Date.now() - start,
      success: true,
    });
    return result;
  } catch (error) {
    store.pushDbOperation({
      ts: Date.now(),
      operation,
      durationMs: Date.now() - start,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
