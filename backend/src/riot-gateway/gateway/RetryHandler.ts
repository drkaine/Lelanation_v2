import type { RetryReason } from '../types.js';

const BACKOFF_MS: Record<number, number> = {
  1: 500,
  2: 1_000,
  3: 2_000,
};

export function getRetryBackoffMs(attempt: number): number {
  return BACKOFF_MS[Math.min(Math.max(attempt, 1), 3)] ?? 2_000;
}

export function parseRetryAfterMs(headers: Record<string, string>, fallbackMs = 2_000): number {
  const raw = headers['retry-after'];
  const sec = Number.parseInt(raw ?? '', 10);
  if (Number.isFinite(sec) && sec > 0) return sec * 1_000;
  return fallbackMs;
}

export function classifyRetryReason(statusCode: number, isNetwork: boolean): RetryReason | null {
  if (isNetwork) return 'network';
  if (statusCode === 429) return '429';
  if (statusCode >= 500) return '5xx';
  return null;
}
