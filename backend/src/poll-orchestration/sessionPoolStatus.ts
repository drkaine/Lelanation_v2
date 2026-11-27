import type { SessionPoolStatus } from './SessionPool.js';

let getter: (() => SessionPoolStatus | null) | null = null;

export function setSessionPoolStatusGetter(fn: () => SessionPoolStatus | null): void {
  getter = fn;
}

export function getSessionPoolStatus(): SessionPoolStatus | null {
  return getter?.() ?? null;
}

export function clearSessionPoolStatusGetter(): void {
  getter = null;
}

/** Statut agrégé des pools par région : compteurs sommés, file gateway (globale) = max. */
export function mergeSessionPoolStatus(statuses: readonly SessionPoolStatus[]): SessionPoolStatus | null {
  if (statuses.length === 0) return null;
  const sum = (pick: (s: SessionPoolStatus) => number) => statuses.reduce((acc, s) => acc + pick(s), 0);
  return {
    activeSessions: sum((s) => s.activeSessions),
    maxConcurrentSessions: sum((s) => s.maxConcurrentSessions),
    queueSize: sum((s) => s.queueSize),
    gatewayQueueSize: Math.max(...statuses.map((s) => s.gatewayQueueSize)),
    sharedMatchIdsSize: sum((s) => s.sharedMatchIdsSize),
    isExhausted: statuses.every((s) => s.isExhausted),
    isShuttingDown: statuses.some((s) => s.isShuttingDown),
    totalSessionsLaunched: sum((s) => s.totalSessionsLaunched),
    totalSessionsCompleted: sum((s) => s.totalSessionsCompleted),
    playerQueueRefills: sum((s) => s.playerQueueRefills),
    playerQueueHighWaterMark: sum((s) => s.playerQueueHighWaterMark),
  };
}
