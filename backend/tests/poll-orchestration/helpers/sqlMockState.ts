import { vi } from 'vitest';

export type KnownMatchRow = {
  riot_match_id: string;
};

const knownMatches = new Map<string, KnownMatchRow>();
const rankToday = new Set<string>();

export function resetSqlMockState(): void {
  knownMatches.clear();
  rankToday.clear();
}

export function seedKnownMatch(matchId: string): void {
  knownMatches.set(matchId, { riot_match_id: matchId });
}

export function getKnownMatches(): Map<string, KnownMatchRow> {
  return knownMatches;
}

export function getRankTodayKeys(): Set<string> {
  return rankToday;
}

export function createSqlMock() {
  const sqlFn = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = String(strings.join('?')).toLowerCase();

    if (query.includes('from matchs') && query.includes('riot_match_id = any')) {
      const matchIds = values[0] as string[];
      return matchIds
        .filter((id) => knownMatches.has(id))
        .map((riot_match_id) => ({ riot_match_id }));
    }

    if (query.includes('from player_rank_history') && query.includes('current_date')) {
      const puuid = values[0] as string;
      const region = values[1] as string;
      const key = `${puuid}:${region}`;
      if (rankToday.has(key)) return [{ exists: 1 }];
      return [];
    }

    if (query.includes('from player_rank_history') && query.includes('puuid = any')) {
      const puuids = values[0] as string[];
      return puuids
        .filter((puuid) => rankToday.has(`${puuid}:${values[1] ?? ''}`))
        .map((puuid) => ({ puuid, region: values[1] }));
    }

    if (query.includes('insert into player_rank_history')) {
      const puuid = values[0] as string;
      const region = values[2] as string;
      rankToday.add(`${puuid}:${region}`);
      return [];
    }

    if (query.includes('insert into players')) {
      const count = (values[0] as string[])?.length ?? 0;
      return Array.from({ length: count }, (_, i) => ({ puuid: `new-${i}` }));
    }

    if (query.includes('update players') && query.includes('last_seen')) {
      return [];
    }

    if (query.includes('from match_aggregated')) {
      const matchId = values[0] as string;
      return knownMatches.has(matchId) ? [{ riot_match_id: matchId }] : [];
    }

    return [];
  });

  return Object.assign(sqlFn, {
    array: (arr: string[]) => arr,
    begin: async (fn: (tx: typeof sqlFn) => Promise<void>) => fn(sqlFn),
  });
}

/** @deprecated */
export const seedProcessedMatch = seedKnownMatch;
/** @deprecated */
export const getProcessedMatches = getKnownMatches;
