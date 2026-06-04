import type { GatewayStatus } from '../riot-gateway/types.js';

export interface TuningParams {
  batchSize: number;
  /** @deprecated SessionPool ignores fixed sleeps; kept for snapshots */
  discoveryIntervalMs: number;
  maxConcurrentPlayers: number;
  maxConcurrentMatchFetches: number;
  participantRankConcurrency: number;
  maxConcurrentSessions: number;
  rawMaxConcurrentSessions: number;
  maxConcurrentSessionsCap: number;
  sessionDispatchS: number;
  sessionWallClockS: number;
  targetRps: number;
  detectedLimit120s: number;
  detectedLimit1s: number;
  estimatedReqPerPlayer: number;
  warmupActive: boolean;
  sessionsSinceStart: number;
}

export interface TuningContext {
  gatewayStatus: GatewayStatus;
  queueDepth: number;
  availablePlayers: number;
}

export interface SessionFeedback {
  playersCompleted: number;
  totalGatewayRequests: number;
  sessionDurationMs: number;
  matchesFetched: number;
  matchesSkipped: number;
  participantRanksFetched: number;
  participantRanksFromCache: number;
  avgMatchLatencyMs: number;
  wasGatewayQueueCongested: boolean;
}

export interface LimitChangeEvent {
  ts: number;
  previous120s: number;
  current120s: number;
  previous1s: number;
  current1s: number;
  ratio: number;
}

export interface TunerRatchetSnapshot {
  effectiveSafetyMargin: number;
  configuredFloor: number;
  sessionsWithout429: number;
  ratchetActive: boolean;
}

export interface TunerSnapshot {
  params: TuningParams | null;
  ema: {
    reqPerPlayer: number;
    reqPerMatch: number;
    cacheHitRate: number;
    matchLatencyMs: number;
  };
  concurrent: {
    maxConcurrentSessions: number;
    matchLatencyEma: number;
    sessionDispatchS: number;
    sessionWallClockS: number;
  } | null;
  limitHistory: LimitChangeEvent[];
  sessionCount: number;
  ratchet: TunerRatchetSnapshot;
}
