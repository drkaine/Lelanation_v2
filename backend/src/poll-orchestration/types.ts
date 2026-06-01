export interface DiscoveryPlayer {
  puuid: string;
  region: string;
}

export interface PollerDbConsumerConfig {
  currentPatch: string;
  rankTierForUnranked: string;
  resolveParticipantRanks: boolean;
}

export interface PollOrchestrationEnv {
  /** @deprecated batch size is computed by PollerTuner */
  discoveryBatchSize: number;
  /** @deprecated sleep between cycles is computed by PollerTuner */
  discoveryIntervalMs: number;
  discoveryIdleSleepMs: number;
  /** @deprecated use PollerTuner */
  pollMaxConcurrentPlayers: number;
  /** @deprecated use PollerTuner */
  pollMaxConcurrentMatchFetches: number;
  resolveParticipantRanks: boolean;
  backpressureThreshold: number;
  backpressurePollIntervalMs: number;
}

export function loadPollOrchestrationEnv(): PollOrchestrationEnv {
  return {
    discoveryBatchSize: Number.parseInt(process.env.DISCOVERY_BATCH_SIZE ?? process.env.DISCOVERY_PLAYERS_PER_TICK ?? '20', 10),
    discoveryIntervalMs: Number.parseInt(process.env.DISCOVERY_INTERVAL_MS ?? '5000', 10),
    discoveryIdleSleepMs: Number.parseInt(process.env.DISCOVERY_IDLE_SLEEP_MS ?? '30000', 10),
    pollMaxConcurrentPlayers: Number.parseInt(process.env.POLL_MAX_CONCURRENT_PLAYERS ?? process.env.POLLER_MAX_CONCURRENT_PLAYERS ?? '3', 10),
    pollMaxConcurrentMatchFetches: Number.parseInt(
      process.env.POLL_MAX_CONCURRENT_MATCH_FETCHES ?? process.env.POLLER_MAX_CONCURRENT_MATCH_FETCHES ?? '5',
      10,
    ),
    resolveParticipantRanks: process.env.RESOLVE_PARTICIPANT_RANKS !== 'false' && process.env.POLLER_RESOLVE_PARTICIPANT_RANKS !== 'false',
    backpressureThreshold: Number.parseInt(process.env.BACKPRESSURE_THRESHOLD ?? '500', 10),
    backpressurePollIntervalMs: Number.parseInt(process.env.BACKPRESSURE_POLL_INTERVAL_MS ?? '5000', 10),
  };
}
