import { insertRankHistory } from '../../db/queries/ranks.js';
import { updatePlayerLastSeen } from '../../db/queries/players.js';
import { ingestionQueue } from '../../queues/index.js';
import { pollerV2Observability } from '../../observability/poller-v2-observability.js';
import { normalizePlatformRegion } from '../../riot/platform-region.js';
import type { LeagueEntryDto } from '../../riot-gateway/routes/dto.js';
import { pollerLogger } from '../logger.js';
import type { PollerEventBus } from '../PollerEventBus.js';
import type { MatchDataEvent, PollerEvents } from '../types.js';
import {
  buildIngestionPayloadFromMatchData,
  isMatchAlreadyIngested,
} from '../../services/matchIngestionPayload.js';
import { rankHistoryFromLeagueEntries } from '../../services/rankFromLeagueEntries.js';
import type { MatchDto, MatchTimelineDto } from '../../riot/types.js';

type PendingMatch = {
  event: MatchDataEvent;
  requiredPuuids: string[];
};

export type PollerDbConsumerOptions = {
  resolveParticipantRanks?: boolean;
};

export class PollerDbConsumer {
  private readonly rankByPuuid = new Map<string, LeagueEntryDto[]>();
  private readonly pendingMatches = new Map<string, PendingMatch>();
  private readonly resolveParticipantRanks: boolean;
  private attached = false;

  constructor(options?: PollerDbConsumerOptions) {
    this.resolveParticipantRanks = options?.resolveParticipantRanks ?? true;
  }

  attach(eventBus: PollerEventBus): void {
    if (this.attached) return;
    this.attached = true;

    eventBus.on('player:rank', (event) => {
      void this.onPlayerRank(event);
    });
    eventBus.on('participant:rank', (event) => {
      void this.onParticipantRank(event);
    });
    eventBus.on('match:data', (event) => {
      void this.onMatchData(event);
    });
    eventBus.on('player:complete', (event) => {
      void this.onPlayerComplete(event);
    });
    eventBus.on('session:complete', () => {
      void this.flushPendingMatches('session:complete');
    });
    eventBus.on('poller:error', (event) => {
      pollerLogger.warn(
        {
          component: 'PollerDbConsumer',
          sessionId: event.sessionId,
          stage: event.error.stage,
          error: event.error.error,
        },
        'poller error',
      );
    });
  }

  resetSessionState(): void {
    this.rankByPuuid.clear();
    this.pendingMatches.clear();
  }

  private async onPlayerRank(event: PollerEvents['player:rank']): Promise<void> {
    const region = normalizePlatformRegion(event.player.platform);
    await this.persistRank(event.player.puuid, region, event.entries, new Date(event.fetchedAt));
  }

  private async onParticipantRank(event: PollerEvents['participant:rank']): Promise<void> {
    const region = normalizePlatformRegion(event.participant.platform);
    this.rankByPuuid.set(event.participant.puuid, event.entries);
    await this.persistRank(event.participant.puuid, region, event.entries, new Date(event.fetchedAt));
    await this.tryFlushMatch(event.triggerMatchId);
  }

  private async persistRank(
    puuid: string,
    region: string,
    entries: LeagueEntryDto[],
    rankedAt: Date,
  ): Promise<void> {
    this.rankByPuuid.set(puuid, entries);
    try {
      await insertRankHistory(rankHistoryFromLeagueEntries(puuid, region, entries, rankedAt));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pollerLogger.warn(
        { component: 'PollerDbConsumer', puuid, region, error: message },
        'rank history insert failed',
      );
    }
  }

  private async onMatchData(event: MatchDataEvent): Promise<void> {
    const matchId = event.matchId;
    if (await isMatchAlreadyIngested(matchId)) {
      pollerV2Observability.recordHydrationSkippedAlreadyDone();
      return;
    }

    if (!this.resolveParticipantRanks) {
      await this.ingestMatch(event);
      return;
    }

    const requiredPuuids = extractParticipantPuuids(event.match);
    this.pendingMatches.set(matchId, { event, requiredPuuids });
    await this.tryFlushMatch(matchId);
  }

  private async onPlayerComplete(event: PollerEvents['player:complete']): Promise<void> {
    await updatePlayerLastSeen(event.player.puuid);
    const pendingForPlayer = [...this.pendingMatches.values()].filter(
      (pending) => pending.event.player.puuid === event.player.puuid,
    );
    for (const pending of pendingForPlayer) {
      await this.tryFlushMatch(pending.event.matchId, true);
    }
  }

  private async tryFlushMatch(matchId: string, force = false): Promise<void> {
    const pending = this.pendingMatches.get(matchId);
    if (!pending) return;

    if (!force && !this.allRanksResolved(pending.requiredPuuids)) {
      return;
    }

    this.pendingMatches.delete(matchId);
    await this.ingestMatch(pending.event);
  }

  private async flushPendingMatches(reason: string): Promise<void> {
    const ids = [...this.pendingMatches.keys()];
    for (const matchId of ids) {
      pollerLogger.debug(
        { component: 'PollerDbConsumer', matchId, reason },
        'flushing pending match',
      );
      await this.tryFlushMatch(matchId, true);
    }
  }

  private allRanksResolved(puuids: string[]): boolean {
    return puuids.every((puuid) => this.rankByPuuid.has(puuid));
  }

  private async ingestMatch(event: MatchDataEvent): Promise<void> {
    const matchId = event.matchId;
    if (await isMatchAlreadyIngested(matchId)) {
      pollerV2Observability.recordHydrationSkippedAlreadyDone();
      return;
    }

    try {
      const payload = await buildIngestionPayloadFromMatchData({
        match: event.match as unknown as MatchDto,
        timeline: event.timeline as unknown as MatchTimelineDto,
        queueRegion: event.player.platform,
        rankByPuuid: this.rankByPuuid,
        resolveParticipantRanks: this.resolveParticipantRanks,
      });

      if (!payload) {
        pollerLogger.info(
          {
            component: 'PollerDbConsumer',
            sessionId: event.sessionId,
            matchId,
            resolveParticipantRanks: this.resolveParticipantRanks,
          },
          'match skipped (rank gate not ready)',
        );
        return;
      }

      await ingestionQueue.add('ingest-match', payload, {
        jobId: `ingest:${payload.teamStats.matchId}`,
      });
      pollerV2Observability.recordHydrationSuccess(1);
      pollerV2Observability.recordHydrationRankGate(matchId, true);
      pollerLogger.info(
        {
          component: 'PollerDbConsumer',
          sessionId: event.sessionId,
          matchId,
          participants: payload.participants.length,
        },
        'match enqueued for ingestion',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pollerV2Observability.recordHydrationFailure(error);
      pollerLogger.error(
        { component: 'PollerDbConsumer', sessionId: event.sessionId, matchId, error: message },
        'match ingestion enqueue failed',
      );
    }
  }
}

function extractParticipantPuuids(match: MatchDataEvent['match']): string[] {
  return Array.from(
    new Set(
      (match.info?.participants ?? [])
        .map((participant) => String(participant.puuid ?? '').trim())
        .filter(Boolean),
    ),
  );
}
