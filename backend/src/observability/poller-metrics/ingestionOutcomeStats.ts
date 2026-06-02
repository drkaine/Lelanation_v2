import type { IngestionWorkerEvent } from './types.js';

export type IngestionOutcomeStats = {
  /** Raw failed worker events (includes retries before success). */
  matches_failed_attempts: number;
  /** Failed matchIds with no successful completion in the window. */
  matches_failed_terminal: number;
  failure_top_errors: Array<{ message: string; count: number }>;
};

/** Per matchId: terminal failure only when failed and never completed in window. */
export function computeIngestionOutcomeStats(
  workers: IngestionWorkerEvent[],
): IngestionOutcomeStats {
  const failedAttempts = workers.filter((e) => e.type === 'failed');
  const byMatch = new Map<string, { failed: boolean; succeeded: boolean }>();

  for (const event of workers) {
    const matchId = String(event.matchId ?? '').trim();
    if (!matchId) continue;
    const state = byMatch.get(matchId) ?? { failed: false, succeeded: false };
    if (event.type === 'completed') state.succeeded = true;
    if (event.type === 'failed') state.failed = true;
    byMatch.set(matchId, state);
  }

  let terminal = 0;
  for (const state of byMatch.values()) {
    if (state.failed && !state.succeeded) terminal += 1;
  }

  const errorCounts = new Map<string, number>();
  for (const event of failedAttempts) {
    const message = String(event.errorMessage ?? 'unknown').trim() || 'unknown';
    errorCounts.set(message, (errorCounts.get(message) ?? 0) + 1);
  }
  const failure_top_errors = [...errorCounts.entries()]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    matches_failed_attempts: failedAttempts.length,
    matches_failed_terminal: terminal,
    failure_top_errors,
  };
}
