import crypto from 'node:crypto';
import { recordPollSession } from '../observability/poller-metrics/instrumentation.js';
import { pollerLogger } from './logger.js';
import { ParticipantRankCache } from './ParticipantRankCache.js';
import { PlayerPoller } from './PlayerPoller.js';
import type { PollerEventBus } from './PollerEventBus.js';
import { asyncPool } from './utils/asyncPool.js';
import {
  createEmptySessionStats,
  mergePollConfig,
  type Player,
  type PollConfig,
  type SessionStats,
  type SessionStatus,
} from './types.js';

export class PollSession {
  readonly sessionId: string;
  readonly config: PollConfig;
  readonly players: Player[];
  readonly startedAt: number;

  private readonly rankCache = new ParticipantRankCache();
  private readonly processedMatchIds: Set<string>;
  private stats: SessionStats;
  private status: SessionStatus = 'pending';
  private readonly abortController = new AbortController();

  constructor(
    players: Player[],
    config: Partial<PollConfig> | undefined,
    private readonly eventBus: PollerEventBus,
  ) {
    this.sessionId = crypto.randomUUID();
    this.players = players;
    this.config = mergePollConfig(config);
    this.processedMatchIds = this.config.sharedProcessedMatchIds ?? new Set<string>();
    this.startedAt = Date.now();
    this.stats = createEmptySessionStats(players.length, this.startedAt);
  }

  async run(): Promise<SessionStats> {
    this.status = 'running';
    pollerLogger.info(
      {
        component: 'PollSession',
        sessionId: this.sessionId,
        players: this.players.map((p) => ({ puuid: p.puuid, platform: p.platform })),
        config: this.config,
      },
      'session started',
    );

    await asyncPool(this.config.maxConcurrentPlayers, this.players, async (player) => {
      if (this.abortController.signal.aborted) {
        return { skipped: true as const };
      }

      const poller = new PlayerPoller(
        player,
        this.config,
        this.eventBus,
        this.rankCache,
        this.processedMatchIds,
        this.sessionId,
        (error) => {
          this.stats.errors.push(error);
          this.eventBus.emit('poller:error', { sessionId: this.sessionId, error });
        },
        (delta) => {
          if (delta.matchIdsDiscovered) this.stats.matchIdsDiscovered += delta.matchIdsDiscovered;
          if (delta.matchIdsSkipped) this.stats.matchIdsSkipped += delta.matchIdsSkipped;
          if (delta.matchesFetched) this.stats.matchesFetched += delta.matchesFetched;
          if (delta.timelinesFetched) this.stats.timelinesFetched += delta.timelinesFetched;
          if (delta.participantRanksFetched) this.stats.participantRanksFetched += delta.participantRanksFetched;
          if (delta.participantRanksFromCache) this.stats.participantRanksFromCache += delta.participantRanksFromCache;
        },
        () => this.abortController.signal.aborted,
      );

      try {
        const playerStats = await poller.run();
        const hadFatal = playerStats.errors.some((e) => e.fatal);
        if (hadFatal) {
          this.stats.playersFailed += 1;
        } else {
          this.stats.playersCompleted += 1;
        }
        pollerLogger.debug(
          {
            component: 'PollSession',
            sessionId: this.sessionId,
            completedPuuid: player.puuid,
            remaining: this.players.length - this.stats.playersCompleted - this.stats.playersFailed,
          },
          'player slot freed',
        );
        return { skipped: false as const, playerStats };
      } catch (error) {
        this.stats.playersFailed += 1;
        const message = error instanceof Error ? error.message : String(error);
        pollerLogger.error(
          { component: 'PollSession', sessionId: this.sessionId, error: message, stats: this.stats },
          'unrecoverable session error',
        );
        return { skipped: false as const, error: message };
      }
    });

    this.status = this.abortController.signal.aborted ? 'cancelled' : 'completed';
    if (this.status === 'cancelled') {
      pollerLogger.warn(
        {
          component: 'PollSession',
          sessionId: this.sessionId,
          playersRemaining: this.players.length - this.stats.playersCompleted - this.stats.playersFailed,
          status: this.status,
        },
        'session cancelled mid-run',
      );
      this.eventBus.emit('session:cancelled', { sessionId: this.sessionId });
    }

    this.stats.completedAt = Date.now();
    this.stats.elapsedMs = this.stats.completedAt - this.stats.startedAt;

    this.eventBus.emit('session:complete', {
      sessionId: this.sessionId,
      status: this.status,
      stats: this.stats,
    });

    recordPollSession({
      sessionId: this.sessionId,
      durationMs: this.stats.elapsedMs ?? 0,
      playersPolled: this.stats.playersTotal,
      playersCompleted: this.stats.playersCompleted,
      playersFailed: this.stats.playersFailed,
    });

    pollerLogger.info(
      {
        component: 'PollSession',
        sessionId: this.sessionId,
        status: this.status,
        players: {
          total: this.stats.playersTotal,
          completed: this.stats.playersCompleted,
          failed: this.stats.playersFailed,
        },
        matches: {
          discovered: this.stats.matchIdsDiscovered,
          fetched: this.stats.matchesFetched,
          skipped: this.stats.matchIdsSkipped,
        },
        ranks: {
          fetched: this.stats.participantRanksFetched,
          fromCache: this.stats.participantRanksFromCache,
        },
        errors: this.stats.errors.length,
        elapsedMs: this.stats.elapsedMs,
      },
      'session complete',
    );

    return this.stats;
  }

  cancel(): void {
    this.abortController.abort();
    this.status = 'cancelled';
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getStats(): SessionStats {
    return this.stats;
  }

  getRankCache(): ParticipantRankCache {
    return this.rankCache;
  }

  getProcessedMatchIds(): Set<string> {
    return this.processedMatchIds;
  }
}
