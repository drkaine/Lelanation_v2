import { vi } from 'vitest';

export type ProcessedMatchRow = {
  riot_match_id: string;
  status: string;
  patch?: string;
};

const processedMatches = new Map<string, ProcessedMatchRow>();
const rankToday = new Set<string>();

export function resetSqlMockState(): void {
  processedMatches.clear();
  rankToday.clear();
}

export function seedProcessedMatch(matchId: string, status: string): void {
  processedMatches.set(matchId, { riot_match_id: matchId, status });
}

export function getProcessedMatches(): Map<string, ProcessedMatchRow> {
  return processedMatches;
}

export function getRankTodayKeys(): Set<string> {
  return rankToday;
}

function isKnownStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === 'done' || normalized === 'pending';
}

export function createSqlMock() {
  const sqlFn = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = String(strings.join('?')).toLowerCase();

    if (query.includes('from processed_matches') && query.includes('riot_match_id = any')) {
      const matchIds = values[0] as string[];
      const known = matchIds.filter((id) => {
        const row = processedMatches.get(id);
        return row != null && isKnownStatus(row.status);
      });
      return known.map((riot_match_id) => ({ riot_match_id }));
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

    if (query.includes('insert into processed_matches')) {
      const matchId = values[2] as string;
      if (processedMatches.has(matchId)) return [];
      processedMatches.set(matchId, { riot_match_id: matchId, status: 'pending' });
      return [{ riot_match_id: matchId }];
    }

    if (query.includes('update processed_matches') && query.includes("status = 'error'")) {
      const matchId = values[1] as string;
      const row = processedMatches.get(matchId);
      if (row) row.status = 'error';
      return [];
    }

    if (query.includes('update processed_matches') && query.includes('set rank')) {
      return [];
    }

    if (query.includes('insert into players')) {
      const count = (values[0] as string[])?.length ?? 0;
      return Array.from({ length: count }, (_, i) => ({ puuid: `new-${i}` }));
    }

    if (query.includes('update players') && query.includes('last_seen')) {
      return [];
    }

    if (query.includes("status = 'done'")) {
      const matchId = values[0] as string;
      const row = processedMatches.get(matchId);
      return row?.status.toLowerCase() === 'done' ? [{ riot_match_id: matchId }] : [];
    }

    return [];
  });

  return Object.assign(sqlFn, {
    array: (values: unknown[]) => values,
    begin: async (cb: (tx: typeof sqlFn) => Promise<unknown>) => cb(sqlFn),
  });
}
