import { fetchLeagueEntriesByPUUID } from './gatewayRoutes.js';
import { pollerLogger } from './logger.js';
import { MatchIdPaginator } from './MatchIdPaginator.js';
import { MatchProcessor } from './MatchProcessor.js';
import type { ParticipantRankCache } from './ParticipantRankCache.js';
import type { PollerEventBus } from './PollerEventBus.js';
import {
  recordMatchDiscovery,
  recordPlayer,
  recordRank,
} from '../observability/poller-metrics/instrumentation.js';
import { asyncPool } from './utils/asyncPool.js';
import type { Player, PlayerPollStats, PollConfig, SessionError } from './types.js';

export class PlayerPoller {
  constructor(
    private readonly player: Player,
    private readonly config: PollConfig,
    private readonly eventBus: PollerEventBus,
    private readonly rankCache: ParticipantRankCache,
    private readonly processedMatchIds: Set<string>,
    private readonly sessionId: string,
    private readonly onSessionError: (error: SessionError) => void,
    private readonly onStatsDelta: (delta: {
      matchIdsDiscovered?: number;
      matchIdsSkipped?: number;
      matchesFetched?: number;
      timelinesFetched?: number;
      participantRanksFetched?: number;
      participantRanksFromCache?: number;
    }) => void,
    private readonly isCancelled: () => boolean,
  ) {}

  async run(): Promise<PlayerPollStats> {
    const startedAt = Date.now();
    const errors: SessionError[] = [];

    const recordError = (error: SessionError) => {
      errors.push(error);
      this.onSessionError(error);
    };

    try {
      recordPlayer({ type: 'polled', puuid: this.player.puuid, platform: this.player.platform });
      try {
        let skipPlayerRankFetch = false;
        if (this.config.rankFilter) {
          const alreadyKnown = await this.config.rankFilter(this.player.puuid, this.player.platform);
          if (alreadyKnown) {
            recordRank({
              type: 'skipped_db',
              puuid: this.player.puuid,
              platform: this.player.platform,
            });
            skipPlayerRankFetch = true;
            this.rankCache.reserve(this.player.puuid);
            this.rankCache.set(this.player.puuid, []);
            pollerLogger.debug(
              { component: 'PlayerPoller', sessionId: this.sessionId, puuid: this.player.puuid },
              'player rank already in DB today, skipping fetch',
            );
          }
        }

        if (!skipPlayerRankFetch) {
          const entries = await fetchLeagueEntriesByPUUID(this.player.puuid, this.player.platform, 'high');
          this.rankCache.reserve(this.player.puuid);
          this.rankCache.set(this.player.puuid, entries);
          this.eventBus.emit('player:rank', {
            sessionId: this.sessionId,
            player: this.player,
            entries,
            fetchedAt: Date.now(),
          });
          const solo = entries.find((e) => e.queueType === 'RANKED_SOLO_5x5');
          pollerLogger.info(
            {
              component: 'PlayerPoller',
              sessionId: this.sessionId,
              puuid: this.player.puuid,
              platform: this.player.platform,
              tier: solo?.tier,
              rank: solo?.rank,
              lp: solo?.leaguePoints,
              queueType: solo?.queueType,
            },
            'player rank fetched',
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        recordRank({
          type: 'failed',
          puuid: this.player.puuid,
          platform: this.player.platform,
        });
        pollerLogger.warn(
          {
            component: 'PlayerPoller',
            sessionId: this.sessionId,
            puuid: this.player.puuid,
            error: message,
            continuing: true,
          },
          'player rank failed',
        );
        recordError({
          ts: Date.now(),
          playerPuuid: this.player.puuid,
          stage: 'player_rank',
          error: message,
          retried: false,
          fatal: false,
        });
      }

      if (this.isCancelled()) {
        return this.buildStats(startedAt, errors, 0, 0, 0, 0);
      }

      const paginator = new MatchIdPaginator(this.player, this.config, this.eventBus, this.sessionId);
      const matchIds = await paginator.fetchAll();
      this.onStatsDelta({ matchIdsDiscovered: matchIds.length });

      for (const matchId of matchIds) {
        if (this.processedMatchIds.has(matchId)) {
          recordMatchDiscovery({
            puuid: this.player.puuid,
            matchId,
            type: 'skipped_memory',
          });
        }
      }

      let newMatchIds = matchIds.filter((id) => !this.processedMatchIds.has(id));
      const memorySkipped = matchIds.length - newMatchIds.length;
      let dbSkipped = 0;

      if (this.config.matchFilter) {
        const beforeFilter = newMatchIds.length;
        const afterFilter = await this.config.matchFilter(newMatchIds);
        for (const matchId of newMatchIds) {
          if (!afterFilter.includes(matchId)) {
            recordMatchDiscovery({ puuid: this.player.puuid, matchId, type: 'skipped_db' });
          }
        }
        newMatchIds = afterFilter;
        dbSkipped = beforeFilter - newMatchIds.length;
        pollerLogger.debug(
          {
            component: 'PlayerPoller',
            sessionId: this.sessionId,
            puuid: this.player.puuid,
            dbFiltered: dbSkipped,
            beforeFilter,
          },
          'db match filter applied',
        );
      }

      const skipped = memorySkipped + dbSkipped;
      newMatchIds.forEach((id) => this.processedMatchIds.add(id));

      const toProcess =
        this.config.maxMatchesToProcess != null
          ? newMatchIds.slice(0, Math.max(0, this.config.maxMatchesToProcess))
          : newMatchIds;

      pollerLogger.debug(
        {
          component: 'PlayerPoller',
          sessionId: this.sessionId,
          puuid: this.player.puuid,
          total: matchIds.length,
          new: newMatchIds.length,
          skipped,
        },
        'dedup result',
      );

      if (skipped > 0) {
        this.onStatsDelta({ matchIdsSkipped: skipped });
      }

      pollerLogger.info(
        {
          component: 'PlayerPoller',
          sessionId: this.sessionId,
          puuid: this.player.puuid,
          total: matchIds.length,
          new: newMatchIds.length,
          skipped,
          pages: Math.ceil(matchIds.length / Math.max(1, this.config.matchIdsPerPage)) || (matchIds.length === 0 ? 1 : 0),
        },
        'match ids complete',
      );

      let matchesFetched = 0;
      let participantRanksFetched = 0;

      const poolResults = await asyncPool(
        this.config.maxConcurrentMatchFetches,
        toProcess,
        async (matchId) => {
          const processor = new MatchProcessor(
            this.player,
            this.config,
            this.eventBus,
            this.rankCache,
            this.sessionId,
            recordError,
            () => {
              matchesFetched += 1;
              this.onStatsDelta({ matchesFetched: 1, timelinesFetched: 1 });
            },
            (fromCache) => {
              if (fromCache) {
                this.onStatsDelta({ participantRanksFromCache: 1 });
              } else {
                participantRanksFetched += 1;
                this.onStatsDelta({ participantRanksFetched: 1 });
              }
            },
          );
          await processor.process(matchId);
        },
      );

      for (const result of poolResults) {
        if (result.error) {
          const message = result.error instanceof Error ? result.error.message : String(result.error);
          recordError({
            ts: Date.now(),
            playerPuuid: this.player.puuid,
            matchId: String(result.item),
            stage: 'match_data',
            error: message,
            retried: false,
            fatal: false,
          });
        }
      }

      const stats = this.buildStats(
        startedAt,
        errors,
        matchIds.length,
        skipped,
        matchesFetched,
        participantRanksFetched,
      );

      this.eventBus.emit('player:complete', {
        sessionId: this.sessionId,
        player: this.player,
        stats,
      });

      pollerLogger.info(
        {
          component: 'PlayerPoller',
          sessionId: this.sessionId,
          puuid: this.player.puuid,
          matchesFetched: stats.matchesFetched,
          participantRanksFetched: stats.participantRanksFetched,
          errors: stats.errors.length,
          elapsedMs: stats.elapsedMs,
        },
        'player complete',
      );

      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pollerLogger.error(
        {
          component: 'PlayerPoller',
          sessionId: this.sessionId,
          puuid: this.player.puuid,
          error: message,
          fatalStage: 'match_ids',
        },
        'player poller failed completely',
      );
      recordError({
        ts: Date.now(),
        playerPuuid: this.player.puuid,
        stage: 'match_ids',
        error: message,
        retried: false,
        fatal: true,
      });
      const stats = this.buildStats(startedAt, errors, 0, 0, 0, 0);
      this.eventBus.emit('player:complete', {
        sessionId: this.sessionId,
        player: this.player,
        stats,
      });
      return stats;
    }
  }

  private buildStats(
    startedAt: number,
    errors: SessionError[],
    matchIdsDiscovered: number,
    matchIdsSkipped: number,
    matchesFetched: number,
    participantRanksFetched: number,
  ): PlayerPollStats {
    return {
      matchIdsDiscovered,
      matchIdsSkipped,
      matchesFetched,
      participantRanksFetched,
      elapsedMs: Date.now() - startedAt,
      errors,
    };
  }
}
