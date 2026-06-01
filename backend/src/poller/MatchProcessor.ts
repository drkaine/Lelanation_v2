import {
  recordMatchFetch,
  recordRank,
} from '../observability/poller-metrics/instrumentation.js';
import { fetchLeagueEntriesByPUUID, fetchMatch, fetchMatchTimeline } from './gatewayRoutes.js';
import { pollerLogger } from './logger.js';
import type { ParticipantRankCache } from './ParticipantRankCache.js';
import type { PollerEventBus } from './PollerEventBus.js';
import { parsePlatformFromMatchId } from './utils/parseMatchId.js';
import { asyncPool } from './utils/asyncPool.js';
import type { Platform, Player, PollConfig, PollStage, SessionError } from './types.js';

function patchFromGameVersion(gameVersion: string | undefined): string {
  const parts = String(gameVersion ?? '').split('.');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0]}.${parts[1]}`;
  }
  return '0.0';
}

export class MatchProcessor {
  constructor(
    private readonly player: Player,
    private readonly config: PollConfig,
    private readonly eventBus: PollerEventBus,
    private readonly rankCache: ParticipantRankCache,
    private readonly sessionId: string,
    private readonly onError: (error: SessionError) => void,
    private readonly onMatchPairFetched: () => void,
    private readonly onParticipantRankFetched: (fromCache: boolean) => void,
  ) {}

  async process(matchId: string): Promise<void> {
    const startedAt = Date.now();
    pollerLogger.debug(
      { component: 'MatchProcessor', sessionId: this.sessionId, matchId, playerPuuid: this.player.puuid },
      'starting match',
    );

    let match;
    let timeline;
    const [matchResult, timelineResult] = await Promise.allSettled([
      fetchMatch(matchId, this.player.platform),
      fetchMatchTimeline(matchId, this.player.platform),
    ]);

    if (matchResult.status === 'rejected' || timelineResult.status === 'rejected') {
      const matchError = matchResult.status === 'rejected' ? matchResult.reason : null;
      const timelineError = timelineResult.status === 'rejected' ? timelineResult.reason : null;
      const stage: PollStage = timelineError && !matchError ? 'match_timeline' : 'match_data';
      const error = (timelineError ?? matchError) as unknown;
      const message = error instanceof Error ? error.message : String(error);
      const errorType =
        matchError && timelineError ? 'both' : timelineError ? 'timeline_fetch' : 'match_fetch';
      recordMatchFetch({
        matchId,
        patch: '0.0',
        success: false,
        latencyMs: Date.now() - startedAt,
        errorType,
      });
      pollerLogger.warn(
        {
          component: 'MatchProcessor',
          sessionId: this.sessionId,
          matchId,
          error: message,
          stage,
          skippingParticipants: true,
        },
        'match fetch failed',
      );
      this.onError({
        ts: Date.now(),
        playerPuuid: this.player.puuid,
        matchId,
        stage,
        error: message,
        retried: false,
        fatal: false,
      });
      return;
    }

    match = matchResult.value;
    timeline = timelineResult.value;
    const patch = patchFromGameVersion(String(match.info?.gameVersion ?? ''));
    recordMatchFetch({
      matchId,
      patch,
      success: true,
      latencyMs: Date.now() - startedAt,
    });
    this.onMatchPairFetched();
    this.eventBus.emit('match:data', {
      sessionId: this.sessionId,
      player: this.player,
      matchId,
      match,
      timeline,
      fetchedAt: Date.now(),
    });

    if (!this.config.resolveParticipantRanks) {
      pollerLogger.info(
        {
          component: 'MatchProcessor',
          sessionId: this.sessionId,
          matchId,
          latencyMs: Date.now() - startedAt,
          participantsFetched: 0,
          participantsFromCache: 0,
        },
        'match processed',
      );
      return;
    }

    const participants = (match.info?.participants ?? [])
      .map((p) => p.puuid)
      .filter((puuid): puuid is string => Boolean(puuid));

    const cachedPuuids: string[] = [];
    const toFetch: string[] = [];

    for (const puuid of participants) {
      if (this.rankCache.has(puuid)) {
        cachedPuuids.push(puuid);
        continue;
      }

      const matchPlatform = parsePlatformFromMatchId(matchId);
      if (this.config.rankFilter) {
        const alreadyKnown = await this.config.rankFilter(puuid, matchPlatform);
        if (alreadyKnown) {
          this.rankCache.reserve(puuid);
          this.rankCache.set(puuid, []);
          this.onParticipantRankFetched(true);
          this.eventBus.emit('participant:rank', {
            sessionId: this.sessionId,
            triggerMatchId: matchId,
            participant: { puuid, platform: matchPlatform },
            entries: [],
            fromCache: true,
            fetchedAt: Date.now(),
          });
          continue;
        }
      }

      this.rankCache.reserve(puuid);
      toFetch.push(puuid);
    }

    pollerLogger.debug(
      {
        component: 'MatchProcessor',
        sessionId: this.sessionId,
        matchId,
        toFetch,
        fromCache: cachedPuuids,
        batchSize: this.config.participantRankConcurrency,
      },
      'participant rank batch',
    );

    let matchPlatform: Platform;
    try {
      matchPlatform = parsePlatformFromMatchId(matchId);
    } catch {
      matchPlatform = this.player.platform;
    }

    await asyncPool(this.config.participantRankConcurrency, toFetch, async (puuid) => {
      try {
        const entries = await fetchLeagueEntriesByPUUID(puuid, matchPlatform);
        this.rankCache.set(puuid, entries);
        this.onParticipantRankFetched(false);
        this.eventBus.emit('participant:rank', {
          sessionId: this.sessionId,
          triggerMatchId: matchId,
          participant: { puuid, platform: matchPlatform },
          entries,
          fromCache: false,
          fetchedAt: Date.now(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        recordRank({
          type: 'failed',
          puuid,
          platform: matchPlatform,
        });
        pollerLogger.warn(
          {
            component: 'MatchProcessor',
            sessionId: this.sessionId,
            matchId,
            participantPuuid: puuid,
            error: message,
            cachedEmpty: true,
          },
          'participant rank failed',
        );
        this.rankCache.set(puuid, []);
        this.onError({
          ts: Date.now(),
          matchId,
          participantPuuid: puuid,
          stage: 'participant_rank',
          error: message,
          retried: false,
          fatal: false,
        });
      }
    });

    for (const puuid of cachedPuuids) {
      const entries = this.rankCache.get(puuid) ?? [];
      let platform: Platform = matchPlatform;
      try {
        platform = parsePlatformFromMatchId(matchId);
      } catch {
        platform = this.player.platform;
      }
      this.onParticipantRankFetched(true);
      this.eventBus.emit('participant:rank', {
        sessionId: this.sessionId,
        triggerMatchId: matchId,
        participant: { puuid, platform },
        entries,
        fromCache: true,
        fetchedAt: Date.now(),
      });
    }

    pollerLogger.info(
      {
        component: 'MatchProcessor',
        sessionId: this.sessionId,
        matchId,
        latencyMs: Date.now() - startedAt,
        participantsFetched: toFetch.length,
        participantsFromCache: cachedPuuids.length,
      },
      'match processed',
    );
  }
}
