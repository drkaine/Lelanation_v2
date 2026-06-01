import type { GatewayStatus } from '../riot-gateway/types.js';

export interface TuningParams {
  batchSize: number;
  discoveryIntervalMs: number;
  maxConcurrentPlayers: number;
  maxConcurrentMatchFetches: number;
  participantRankConcurrency: number;
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
}

export interface LimitChangeEvent {
  ts: number;
  previous120s: number;
  current120s: number;
  previous1s: number;
  current1s: number;
  ratio: number;
}

export interface TunerSnapshot {
  params: TuningParams | null;
  ema: {
    reqPerPlayer: number;
    reqPerMatch: number;
    cacheHitRate: number;
  };
  limitHistory: LimitChangeEvent[];
  sessionCount: number;
}
