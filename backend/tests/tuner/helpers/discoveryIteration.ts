import type { Platform, PollConfig } from '../../../src/poller/types.js';
import type { DiscoveryPlayer } from '../../../src/poll-orchestration/types.js';
import type { BackpressureMonitor } from '../../../src/poll-orchestration/BackpressureMonitor.js';
import type { GatewayStatus } from '../../../src/riot-gateway/types.js';
import { PollerTuner, TUNER_MAX_DISCOVERY_FETCH } from '../../../src/tuner/PollerTuner.js';
import type { SessionFeedback, TuningParams } from '../../../src/tuner/types.js';

export type DiscoveryIterationResult = {
  polled: boolean;
  tuned: TuningParams | null;
  playersPolled: number;
  sessionFeedback: SessionFeedback | null;
};

/**
 * One discovery-loop iteration (mirrors src/main.ts) for e2e tests.
 */
export async function runDiscoveryIteration(deps: {
  backpressure: Pick<BackpressureMonitor, 'waitForHeadroom' | 'getDepth'>;
  fetchPlayers: (limit: number) => Promise<DiscoveryPlayer[]>;
  gatewayStatus: () => GatewayStatus;
  poll: (
    players: Array<{ puuid: string; platform: Platform }>,
    config: Partial<PollConfig>,
  ) => Promise<{
    stats: {
      playersCompleted: number;
      matchesFetched: number;
      matchIdsSkipped: number;
      participantRanksFetched: number;
      participantRanksFromCache: number;
      elapsedMs?: number;
    };
  }>;
  requestsAtSessionStart: number;
  gatewayRequests: () => number;
  resolveParticipantRanks?: boolean;
}): Promise<DiscoveryIterationResult> {
  await deps.backpressure.waitForHeadroom();
  const { total: queueDepth } = await deps.backpressure.getDepth();

  const discovered = await deps.fetchPlayers(TUNER_MAX_DISCOVERY_FETCH);
  if (discovered.length === 0) {
    return { polled: false, tuned: null, playersPolled: 0, sessionFeedback: null };
  }

  const tuner = PollerTuner.getInstance();
  const tuned = tuner.compute({
    gatewayStatus: deps.gatewayStatus(),
    queueDepth,
    availablePlayers: discovered.length,
  });

  const players = discovered.slice(0, tuned.batchSize).map((p) => ({
    puuid: p.puuid,
    platform: p.region.trim().toLowerCase() as Platform,
  }));

  const { stats } = await deps.poll(players, {
    sinceTimestamp: 1_700_000_000,
    maxConcurrentPlayers: tuned.maxConcurrentPlayers,
    maxConcurrentMatchFetches: tuned.maxConcurrentMatchFetches,
    participantRankConcurrency: tuned.participantRankConcurrency,
    resolveParticipantRanks: deps.resolveParticipantRanks ?? true,
  });

  const requestsUsed = deps.gatewayRequests() - deps.requestsAtSessionStart;
  const sessionFeedback: SessionFeedback = {
    playersCompleted: stats.playersCompleted,
    totalGatewayRequests: requestsUsed,
    sessionDurationMs: stats.elapsedMs ?? 0,
    matchesFetched: stats.matchesFetched,
    matchesSkipped: stats.matchIdsSkipped,
    participantRanksFetched: stats.participantRanksFetched,
    participantRanksFromCache: stats.participantRanksFromCache,
    avgMatchLatencyMs: 0,
    wasGatewayQueueCongested: false,
  };
  tuner.recordSession(sessionFeedback);

  return {
    polled: true,
    tuned,
    playersPolled: players.length,
    sessionFeedback,
  };
}
