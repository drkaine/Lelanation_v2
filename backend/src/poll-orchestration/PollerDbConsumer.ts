import { sql } from '../db/client.js';
import { insertRankHistory } from '../db/queries/ranks.js';
import { ingestionQueue } from '../queues/index.js';
import { normalizePlatformRegion } from '../riot/platform-region.js';
import type { LeagueEntryDto } from '../riot-gateway/routes/dto.js';
import type { PollerEventBus } from '../poller/PollerEventBus.js';
import type { MatchDataEvent, PollerEvents } from '../poller/types.js';
import {
  buildIngestionPayloadFromMatchData,
} from '../services/matchIngestionPayload.js';
import { rankHistoryFromLeagueEntries, soloLeagueEntry } from '../services/rankFromLeagueEntries.js';
import type { MatchDto, MatchTimelineDto } from '../riot/types.js';
import type { ParticipantDiscovery } from './ParticipantDiscovery.js';
import type { PlayerDiscovery } from './PlayerDiscovery.js';
import {
  extractPatchFromMatch,
  insertPendingProcessedMatch,
  markProcessedMatchError,
  updateProcessedMatchRank,
} from './processedMatchWrite.js';
import type { PollerDbConsumerConfig } from './types.js';
import { timedDbOp } from '../observability/poller-metrics/timedDbOp.js';
import type { IngestionRankSource } from '../observability/poller-metrics/types.js';
import {
  recordIngestionQueue,
  recordPlayer,
  recordRank,
} from '../observability/poller-metrics/instrumentation.js';
import { orchestrationLogger } from './logger.js';

type PendingMatch = {
  event: MatchDataEvent;
  requiredPuuids: string[];
};

export class PollerDbConsumer {
  private readonly rankTierCache = new Map<string, string>();
  private readonly rankEntriesCache = new Map<string, LeagueEntryDto[]>();
  private readonly pendingMatches = new Map<string, PendingMatch>();
  private attached = false;

  constructor(
    private readonly participantDiscovery: ParticipantDiscovery,
    private readonly playerDiscovery: PlayerDiscovery,
    private readonly config: PollerDbConsumerConfig,
    private readonly eventBus: PollerEventBus,
  ) {}

  subscribe(): void {
    if (this.attached) return;
    this.attached = true;
    this.eventBus.on('player:rank', (event) => void this.onPlayerRank(event));
    this.eventBus.on('participant:rank', (event) => void this.onParticipantRank(event));
    this.eventBus.on('match:data', (event) => void this.onMatchData(event));
    this.eventBus.on('player:complete', (event) => void this.onPlayerComplete(event));
    this.eventBus.on('session:complete', (event) => void this.onSessionComplete(event));
    this.eventBus.on('poller:error', (event) => void this.onPollerError(event));
  }

  unsubscribe(): void {
    this.eventBus.removeAllListeners();
    this.attached = false;
  }

  resetSessionState(): void {
    this.rankTierCache.clear();
    this.rankEntriesCache.clear();
    this.pendingMatches.clear();
  }

  private tierFromEntries(entries: LeagueEntryDto[]): string {
    const solo = soloLeagueEntry(entries);
    return String(solo?.tier ?? this.config.rankTierForUnranked).trim().toUpperCase() || this.config.rankTierForUnranked;
  }

  private async onPlayerRank(event: PollerEvents['player:rank']): Promise<void> {
    const region = normalizePlatformRegion(event.player.platform);
    const tier = this.tierFromEntries(event.entries);
    recordRank({ type: 'fetched', puuid: event.player.puuid, platform: region, tier });
    this.rankTierCache.set(event.player.puuid, tier);
    this.rankEntriesCache.set(event.player.puuid, event.entries);

    try {
      await insertRankHistory(rankHistoryFromLeagueEntries(event.player.puuid, region, event.entries, new Date(event.fetchedAt)));
      orchestrationLogger.debug(
        { component: 'PollerDbConsumer', puuid: event.player.puuid, tier, region },
        'player rank stored',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      orchestrationLogger.warn({ component: 'PollerDbConsumer', puuid: event.player.puuid, error: message }, 'player rank insert failed');
    }
  }

  private async onParticipantRank(event: PollerEvents['participant:rank']): Promise<void> {
    if (event.fromCache && event.entries.length === 0) {
      recordRank({
        type: 'skipped_db',
        puuid: event.participant.puuid,
        platform: normalizePlatformRegion(event.participant.platform),
      });
      orchestrationLogger.trace(
        { component: 'PollerDbConsumer', puuid: event.participant.puuid },
        'participant rank skipped (already in DB)',
      );
      if (!this.rankTierCache.has(event.participant.puuid)) {
        this.rankTierCache.set(event.participant.puuid, this.config.rankTierForUnranked);
        this.rankEntriesCache.set(event.participant.puuid, []);
      }
      await this.tryFlushMatch(event.triggerMatchId);
      return;
    }

    const region = normalizePlatformRegion(event.participant.platform);
    const tier = this.tierFromEntries(event.entries);
    recordRank({
      type: event.fromCache ? 'skipped_cache' : 'fetched',
      puuid: event.participant.puuid,
      platform: region,
      tier,
    });
    this.rankTierCache.set(event.participant.puuid, tier);
    this.rankEntriesCache.set(event.participant.puuid, event.entries);

    try {
      await insertRankHistory(
        rankHistoryFromLeagueEntries(event.participant.puuid, region, event.entries, new Date(event.fetchedAt)),
      );
      orchestrationLogger.debug(
        { component: 'PollerDbConsumer', puuid: event.participant.puuid, tier, fromCache: event.fromCache },
        'participant rank stored',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      orchestrationLogger.warn(
        { component: 'PollerDbConsumer', puuid: event.participant.puuid, error: message },
        'participant rank insert failed',
      );
    }

    await this.tryFlushMatch(event.triggerMatchId);
  }

  private async onMatchData(event: MatchDataEvent): Promise<void> {
    if (!this.config.resolveParticipantRanks) {
      await this.processMatchData(event);
      return;
    }

    const requiredPuuids = extractParticipantPuuids(event.match);
    this.pendingMatches.set(event.matchId, { event, requiredPuuids });
    await this.tryFlushMatch(event.matchId);
  }

  private async tryFlushMatch(matchId: string, force = false): Promise<void> {
    const pending = this.pendingMatches.get(matchId);
    if (!pending) return;
    if (!force && !pending.requiredPuuids.every((puuid) => this.rankTierCache.has(puuid))) {
      return;
    }
    this.pendingMatches.delete(matchId);
    await this.processMatchData(pending.event);
  }

  /**
   * Fetch rank_tier from player_rank_history for puuids not in rankTierCache.
   * Single batch query; populates rankTierCache for session reuse.
   */
  private async fetchRankTiersFromDb(puuids: string[]): Promise<Set<string>> {
    const filled = new Set<string>();
    if (puuids.length === 0) return filled;

    const rows = await timedDbOp('rank_history_fallback_query', () =>
      sql<{ puuid: string; rank_tier: string }[]>`
        SELECT DISTINCT ON (puuid)
          puuid,
          rank_tier
        FROM player_rank_history
        WHERE puuid = ANY(${sql.array(puuids, 25)})
          AND date = CURRENT_DATE
          AND rank_tier IS NOT NULL
          AND rank_tier <> 'UNRANKED'
        ORDER BY puuid, date DESC
      `,
    );

    for (const row of rows) {
      const puuid = String(row.puuid ?? '').trim();
      const tier = String(row.rank_tier ?? '').trim().toUpperCase();
      if (!puuid || !tier) continue;
      if (!this.rankTierCache.has(puuid)) {
        this.rankTierCache.set(puuid, tier);
        filled.add(puuid);
        orchestrationLogger.debug(
          { component: 'PollerDbConsumer', event: 'rank_resolved_from_db', puuid, tier },
          'rank resolved from player_rank_history',
        );
      }
    }

    return filled;
  }

  private async resolveMatchRank(
    event: MatchDataEvent,
  ): Promise<{ rank: string; rankSource: IngestionRankSource }> {
    const playerPuuid = event.player.puuid;
    const participantPuuids = extractParticipantPuuids(event.match);

    const playerRank = this.rankTierCache.get(playerPuuid);
    if (playerRank) {
      return { rank: playerRank, rankSource: 'player_cache' };
    }

    for (const puuid of participantPuuids) {
      const cached = this.rankTierCache.get(puuid);
      if (cached) {
        return { rank: cached, rankSource: 'participant_cache' };
      }
    }

    const allPuuids = [playerPuuid, ...participantPuuids];
    const unknownPuuids = Array.from(new Set(allPuuids.filter((p) => p && !this.rankTierCache.has(p))));
    let dbFilled = new Set<string>();

    if (unknownPuuids.length > 0) {
      dbFilled = await this.fetchRankTiersFromDb(unknownPuuids);

      const afterDbPlayer = this.rankTierCache.get(playerPuuid);
      if (afterDbPlayer) {
        return {
          rank: afterDbPlayer,
          rankSource: dbFilled.has(playerPuuid) ? 'db_fallback' : 'player_cache',
        };
      }

      for (const puuid of participantPuuids) {
        const cached = this.rankTierCache.get(puuid);
        if (cached) {
          return {
            rank: cached,
            rankSource: dbFilled.has(puuid) ? 'db_fallback' : 'participant_cache',
          };
        }
      }
    }

    orchestrationLogger.warn(
      {
        component: 'PollerDbConsumer',
        event: 'rank_fallback_unranked',
        matchId: event.matchId,
        playerPuuid,
        participantPuuids: participantPuuids.slice(0, 3),
        reason: 'no rank in cache or player_rank_history today',
      },
      'match rank resolved to UNRANKED fallback',
    );
    return { rank: this.config.rankTierForUnranked, rankSource: 'unranked_fallback' };
  }

  private async processMatchData(event: MatchDataEvent): Promise<void> {
    const matchId = event.matchId;
    const patch = extractPatchFromMatch(event.match, this.config.currentPatch);
    let queued = false;

    try {
      const { rank, rankSource } = await this.resolveMatchRank(event);
      orchestrationLogger.debug(
        { component: 'PollerDbConsumer', matchId, rank, rankSource, event: 'match_rank_resolved' },
        'match rank resolved',
      );

      const payload = await buildIngestionPayloadFromMatchData({
        match: event.match as unknown as MatchDto,
        timeline: event.timeline as unknown as MatchTimelineDto,
        queueRegion: event.player.platform,
        rankByPuuid: this.rankEntriesCache,
        resolveParticipantRanks: this.config.resolveParticipantRanks,
      });

      if (!payload) {
        recordIngestionQueue({
          matchId,
          patch,
          rank,
          type: 'skipped',
          skipReason: 'missing_rank',
          rankSource,
        });
        orchestrationLogger.info({ component: 'PollerDbConsumer', matchId }, 'match skipped (rank gate not ready for ingestion)');
        return;
      }

      const inserted = await insertPendingProcessedMatch({
        matchId,
        match: event.match,
        currentPatch: this.config.currentPatch,
        rank,
      });

      if (!inserted) {
        recordIngestionQueue({
          matchId,
          patch,
          rank,
          type: 'skipped',
          skipReason: 'conflict_already_done',
          rankSource,
        });
        orchestrationLogger.debug({ component: 'PollerDbConsumer', matchId }, 'match already in processed_matches, skipping');
        return;
      }

      await updateProcessedMatchRank(patch, matchId, rank);

      try {
      await ingestionQueue.add('ingest-match', payload, {
        jobId: matchId,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
      queued = true;

      recordIngestionQueue({ matchId, patch, rank, type: 'queued', rankSource });
      orchestrationLogger.info(
        { component: 'PollerDbConsumer', matchId, patch, rank, queueJobId: matchId },
        'match queued for ingestion',
      );

      try {
        const participants = this.participantDiscovery.extractFromMatch(matchId, event.match);
        const newCount = await this.participantDiscovery.upsertParticipants(participants);
        if (newCount > 0) {
          recordPlayer({ type: 'new_added', puuid: '(batch)', platform: event.player.platform });
        }
        orchestrationLogger.debug(
          { component: 'PollerDbConsumer', matchId, newPlayers: newCount },
          'participant discovery complete',
        );
      } catch (participantError) {
        const participantMessage = participantError instanceof Error ? participantError.message : String(participantError);
        orchestrationLogger.warn(
          { component: 'PollerDbConsumer', matchId, error: participantMessage, queued: true },
          'participant discovery failed after queueing ingestion',
        );
      }
      } catch (queueError) {
        recordIngestionQueue({
          matchId,
          patch,
          rank,
          type: 'skipped',
          skipReason: 'queue_add_failed',
          rankSource,
        });
        throw queueError;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      orchestrationLogger.error({ component: 'PollerDbConsumer', matchId, error: message, stage: 'onMatchData' }, 'onMatchData failed');
      if (queued) {
        orchestrationLogger.warn(
          { component: 'PollerDbConsumer', matchId, patch, error: message },
          'match already queued; skipping processed_matches error status update',
        );
        return;
      }
      try {
        await markProcessedMatchError(patch, matchId);
      } catch (updateError) {
        const updateMessage = updateError instanceof Error ? updateError.message : String(updateError);
        orchestrationLogger.error(
          { component: 'PollerDbConsumer', matchId, error: updateMessage },
          'processed_matches status update failed',
        );
      }
    }
  }

  private async onPlayerComplete(event: PollerEvents['player:complete']): Promise<void> {
    await this.playerDiscovery.updateLastSeen(event.player.puuid);

    orchestrationLogger.info(
      {
        component: 'PollerDbConsumer',
        puuid: event.player.puuid,
        matchesFetched: event.stats.matchesFetched,
        errors: event.stats.errors.length,
      },
      'player last_seen updated',
    );

    const pendingForPlayer = [...this.pendingMatches.values()].filter(
      (pending) => pending.event.player.puuid === event.player.puuid,
    );
    for (const pending of pendingForPlayer) {
      await this.tryFlushMatch(pending.event.matchId, true);
    }
  }

  private async onSessionComplete(event: PollerEvents['session:complete']): Promise<void> {
    const flushed = this.pendingMatches.size;
    for (const matchId of [...this.pendingMatches.keys()]) {
      await this.tryFlushMatch(matchId, true);
    }

    orchestrationLogger.info(
      {
        component: 'PollerDbConsumer',
        sessionId: event.sessionId,
        status: event.status,
        players: event.stats.playersTotal,
        matches: event.stats.matchesFetched,
        ranks: event.stats.participantRanksFetched,
        errors: event.stats.errors.length,
        elapsedMs: event.stats.elapsedMs,
        flushedPending: flushed,
      },
      'session complete',
    );

    this.rankTierCache.clear();
    this.rankEntriesCache.clear();
    this.pendingMatches.clear();
  }

  private onPollerError(event: PollerEvents['poller:error']): void {
    orchestrationLogger.error(
      {
        component: 'PollerDbConsumer',
        sessionId: event.sessionId,
        stage: event.error.stage,
        error: event.error.error,
        fatal: event.error.fatal,
      },
      'poller error received',
    );
  }
}

/** @deprecated Use subscribe() on PollerDbConsumer */
export function attachPollerDbConsumer(_eventBus: PollerEventBus, consumer: PollerDbConsumer): void {
  consumer.subscribe();
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
