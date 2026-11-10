import type { LeagueEntryDto } from '../riot-gateway/routes/dto.js';
import type { RankSnapshot } from '../db/query.js';

const SOLO_QUEUE = 'RANKED_SOLO_5x5';

export function soloLeagueEntry(entries: LeagueEntryDto[]): LeagueEntryDto | undefined {
  return entries.find((entry) => entry.queueType === SOLO_QUEUE);
}

export function rankSnapshotFromLeagueEntries(
  entries: LeagueEntryDto[],
  snapshotDate: Date,
): RankSnapshot {
  const solo = soloLeagueEntry(entries);
  const tier = String(solo?.tier ?? '')
    .trim()
    .toUpperCase();
  if (!tier) {
    return {
      rankTier: 'UNRANKED',
      rankDivision: 'UNRANKED',
      rankLp: 0,
      date: snapshotDate,
    };
  }
  return {
    rankTier: tier,
    rankDivision: String(solo?.rank ?? '').trim(),
    rankLp: Number(solo?.leaguePoints ?? 0),
    date: snapshotDate,
  };
}

export function rankHistoryFromLeagueEntries(
  puuid: string,
  region: string,
  entries: LeagueEntryDto[],
  rankedAt: Date,
): {
  puuid: string;
  region: string;
  rankTier: string;
  rankDivision: string;
  rankLp: number;
  rankedAt: Date;
} {
  const snapshot = rankSnapshotFromLeagueEntries(entries, rankedAt);
  return {
    puuid,
    region,
    rankTier: snapshot.rankTier,
    rankDivision: snapshot.rankDivision,
    rankLp: snapshot.rankLp,
    rankedAt,
  };
}

/**
 * Snapshots issus des events poller. Les listes vides (rang déjà en base, fetch
 * échoué) sont ignorées : elles ne doivent pas écraser le snapshot DB par UNRANKED.
 */
export function eventRankSnapshots(
  puuids: readonly string[],
  eventRankByPuuid: ReadonlyMap<string, LeagueEntryDto[]>,
  gameDate: Date,
): Map<string, RankSnapshot> {
  const out = new Map<string, RankSnapshot>();
  for (const raw of puuids) {
    const puuid = String(raw ?? '').trim();
    const entries = puuid ? eventRankByPuuid.get(puuid) : undefined;
    if (!entries || entries.length === 0) continue;
    out.set(puuid, rankSnapshotFromLeagueEntries(entries, gameDate));
  }
  return out;
}
