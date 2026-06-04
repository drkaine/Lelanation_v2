import crypto from 'node:crypto';
import type { ObservabilityOrchestrator } from '../observability/poller-metrics/ObservabilityOrchestrator.js';
import { recordSessionPool } from '../observability/poller-metrics/instrumentation.js';
import type { RiotGateway } from '../riot-gateway/gateway/RiotGateway.js';
import { PollerEngine } from '../poller/PollerEngine.js';
import type { Platform, Player, PollConfig, SessionStats } from '../poller/types.js';
import { PollerTuner } from '../tuner/PollerTuner.js';
import type { BackpressureMonitor } from './BackpressureMonitor.js';
import { orchestrationLogger } from './logger.js';
import type { PlayerQueue } from './PlayerQueue.js';
import type { PollerDbConsumer } from './PollerDbConsumer.js';
import type { RankFilter } from './RankFilter.js';
import { PatchResolver } from './PatchResolver.js';
import { applySinceModeTransition } from './sinceModeTransition.js';
import { setLatestResolvedSince } from './sinceContext.js';
import { assertPollConfigFiltersWired } from './startupPollConfigCheck.js';
import type { SinceMode, SinceTimestampResolver } from './SinceTimestampResolver.js';
import {
  avgMatchLatencyMsForWindow,
  buildSessionFeedback,
  getTokenPct120s,
} from './sessionPoolFeedback.js';
import { setSessionPoolStatusGetter } from './sessionPoolStatus.js';

const SLOT_WAIT_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPlatform(region: string): Platform {
  return region.trim().toLowerCase() as Platform;
}

export interface SessionPoolConfig {
  maxConcurrentSessions: number;
  batchSize: number;
  pollConfig: Partial<PollConfig>;
}

export interface SessionPoolStatus {
  activeSessions: number;
  maxConcurrentSessions: number;
  queueSize: number;
  isExhausted: boolean;
  isShuttingDown: boolean;
  totalSessionsLaunched: number;
  totalSessionsCompleted: number;
}

export class SessionPool {
  private readonly activeSessions = new Map<
    string,
    Promise<{ sessionId: string; stats: SessionStats }>
  >();
  private isShuttingDown = false;
  private config: SessionPoolConfig;
  private currentSinceMode: SinceMode | null = null;
  private totalSessionsLaunched = 0;
  private totalSessionsCompleted = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly playerQueue: PlayerQueue,
    private readonly pollerEngine: PollerEngine,
    private readonly tuner: PollerTuner,
    private readonly backpressure: BackpressureMonitor,
    private readonly sinceResolver: SinceTimestampResolver,
    private readonly gateway: RiotGateway,
    private readonly observability: ObservabilityOrchestrator,
    private readonly dbConsumer: PollerDbConsumer | null,
    private readonly rankFilter: RankFilter,
    initialConfig: SessionPoolConfig,
  ) {
    this.config = { ...initialConfig };
  }

  getStatus(): SessionPoolStatus {
    return {
      activeSessions: this.activeSessions.size,
      maxConcurrentSessions: this.config.maxConcurrentSessions,
      queueSize: this.playerQueue.size,
      isExhausted: this.playerQueue.isExhausted(),
      isShuttingDown: this.isShuttingDown,
      totalSessionsLaunched: this.totalSessionsLaunched,
      totalSessionsCompleted: this.totalSessionsCompleted,
    };
  }

  async start(): Promise<void> {
    setSessionPoolStatusGetter(() => this.getStatus());
    this.heartbeatTimer = setInterval(() => this.logHeartbeat(), 60_000);
    orchestrationLogger.info({ component: 'SessionPool' }, 'session pool started');

    while (!this.isShuttingDown) {
      try {
        await this.loopIteration();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        orchestrationLogger.error({ component: 'SessionPool', error: message }, 'session pool loop error');
        await sleep(1000);
      }
    }

    orchestrationLogger.info({ component: 'SessionPool' }, 'session pool loop exited');
  }

  async shutdown(timeoutMs = 60_000): Promise<void> {
    this.isShuttingDown = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    const pending = [...this.activeSessions.values()];
    if (pending.length === 0) return;

    orchestrationLogger.info(
      { component: 'SessionPool', active: pending.length, timeoutMs },
      'session pool shutting down — waiting for active sessions',
    );

    await Promise.race([
      Promise.allSettled(pending),
      sleep(timeoutMs).then(() => {
        orchestrationLogger.warn(
          { component: 'SessionPool', active: this.activeSessions.size },
          'session pool shutdown timeout — forcing exit',
        );
      }),
    ]);
  }

  private async loopIteration(): Promise<void> {
    const params = this.tuner.compute({
      gatewayStatus: this.gateway.getStatus(),
      queueDepth: (await this.backpressure.getDepth()).total,
      availablePlayers: Math.max(this.playerQueue.size, 1),
    });

    this.config.maxConcurrentSessions = params.maxConcurrentSessions;
    this.config.batchSize = params.batchSize;

    if (await this.backpressure.isOverloaded()) {
      await this.backpressure.waitForHeadroom();
      return;
    }

    const slotsAvailable = this.config.maxConcurrentSessions - this.activeSessions.size;

    if (slotsAvailable <= 0) {
      await Promise.race([...this.activeSessions.values()]);
      return;
    }

    let players = this.playerQueue.dequeue(this.config.batchSize);

    if (players.length === 0) {
      if (this.playerQueue.isExhausted()) {
        orchestrationLogger.info(
          { component: 'SessionPool' },
          'player pool exhausted — waiting for new players or last_seen to age',
        );
        recordSessionPool({
          type: 'pool_exhausted',
          activeSessions: this.activeSessions.size,
          maxSessions: this.config.maxConcurrentSessions,
          queueSize: this.playerQueue.size,
        });
        players = await this.playerQueue.waitForPlayers(1, 30_000);
        if (players.length === 0) return;
        recordSessionPool({
          type: 'pool_recovered',
          activeSessions: this.activeSessions.size,
          maxSessions: this.config.maxConcurrentSessions,
          queueSize: this.playerQueue.size,
        });
      } else {
        await sleep(SLOT_WAIT_MS);
        return;
      }
    }

    const resolved = await this.sinceResolver.resolve();
    setLatestResolvedSince(resolved);
    this.currentSinceMode = applySinceModeTransition(this.currentSinceMode, resolved);

    const patchInfo = await PatchResolver.resolveCurrentPatchInfo();
    const pollConfig: Partial<PollConfig> = {
      ...this.config.pollConfig,
      sinceTimestamp: resolved.sinceTimestamp,
      maxConcurrentPlayers: params.maxConcurrentPlayers,
      maxConcurrentMatchFetches: params.maxConcurrentMatchFetches,
      participantRankConcurrency: params.participantRankConcurrency,
    };
    assertPollConfigFiltersWired(pollConfig, orchestrationLogger);

    const pollerPlayers: Player[] = players.map((p) => ({
      puuid: p.puuid,
      platform: toPlatform(p.region),
    }));

    this.dbConsumer?.resetSessionState();
    this.rankFilter.clearCache();

    const sessionId = crypto.randomUUID();
    const requestsAtStart = this.gateway.getStatus().metrics.totals.requests;
    const sessionStartedAt = Date.now();
    this.totalSessionsLaunched += 1;

    recordSessionPool({
      type: 'session_started',
      activeSessions: this.activeSessions.size + 1,
      maxSessions: this.config.maxConcurrentSessions,
      queueSize: this.playerQueue.size,
      sessionId,
    });

    orchestrationLogger.debug(
      {
        component: 'SessionPool',
        sessionId,
        players: players.length,
        activeNow: this.activeSessions.size + 1,
        maxAllowed: this.config.maxConcurrentSessions,
        patch: patchInfo.patch,
        sinceMode: resolved.mode,
      },
      'session started',
    );

    const sessionPromise = this.pollerEngine
      .poll(pollerPlayers, pollConfig)
      .then((result) => {
        const endedAt = Date.now();
        const requestsUsed =
          this.gateway.getStatus().metrics.totals.requests - requestsAtStart;
        const avgMatchLatencyMs = avgMatchLatencyMsForWindow(
          this.observability.getStore(),
          sessionStartedAt,
          endedAt,
        );
        this.tuner.recordSession(
          buildSessionFeedback(result.stats, requestsUsed, avgMatchLatencyMs),
        );
        this.tuner.recordUtilization(getTokenPct120s(this.gateway));
        this.totalSessionsCompleted += 1;
        recordSessionPool({
          type: 'session_completed',
          activeSessions: this.activeSessions.size - 1,
          maxSessions: this.config.maxConcurrentSessions,
          queueSize: this.playerQueue.size,
          sessionId: result.sessionId,
        });
        orchestrationLogger.info(
          {
            component: 'SessionPool',
            sessionId: result.sessionId,
            players: result.stats.playersTotal,
            matchesFetched: result.stats.matchesFetched,
            elapsedMs: result.stats.elapsedMs,
          },
          'session complete',
        );
        return result;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        orchestrationLogger.error(
          { component: 'SessionPool', sessionId, error: message },
          'session error',
        );
        throw error;
      })
      .finally(() => {
        this.activeSessions.delete(sessionId);
      });

    this.activeSessions.set(sessionId, sessionPromise);
  }

  private logHeartbeat(): void {
    const status = this.gateway.getStatus();
    const bucket120 = status.buckets.find((b) => b.windowMs === 120_000);
    const pct = bucket120 && bucket120.limit > 0 ? (bucket120.used / bucket120.limit) * 100 : 0;

    if (this.activeSessions.size > 0) {
      this.tuner.recordUtilization(getTokenPct120s(this.gateway));
    }

    orchestrationLogger.info(
      {
        component: 'SessionPool',
        event: 'session_pool_heartbeat',
        active: this.activeSessions.size,
        max: this.config.maxConcurrentSessions,
        queue: this.playerQueue.size,
        launched: this.totalSessionsLaunched,
        completed: this.totalSessionsCompleted,
        gateway_rps: status.metrics.rps.current,
        token_pct: pct,
      },
      'session pool heartbeat',
    );
  }
}
