import { sql } from '../db/client.js';
import { timedDbOp } from '../observability/poller-metrics/timedDbOp.js';
import { normalizePlatformRegion } from '../riot/platform-region.js';
import { orchestrationLogger } from './logger.js';

function cacheKey(puuid: string, region: string, todayIso: string): string {
  return `${puuid}:${normalizePlatformRegion(region)}:${todayIso}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export class RankFilter {
  private readonly cache = new Map<string, boolean>();

  async isKnownToday(puuid: string, region: string): Promise<boolean> {
    const key = cacheKey(puuid, region, todayIso());
    if (this.cache.get(key) === true) {
      orchestrationLogger.trace({ component: 'RankFilter', puuid, region }, 'rank filter cache hit');
      return true;
    }

    const normalizedRegion = normalizePlatformRegion(region);
    const rows = await timedDbOp('rank_filter_query', () =>
      sql<{ exists: number }[]>`
        SELECT 1 AS exists
        FROM player_rank_history
        WHERE puuid = ${puuid}
          AND region = ${normalizedRegion}
          AND date = CURRENT_DATE
        LIMIT 1
      `,
    );

    if (rows.length > 0) {
      this.cache.set(key, true);
      orchestrationLogger.debug({ component: 'RankFilter', puuid, region }, 'rank known in DB today');
      return true;
    }

    orchestrationLogger.trace({ component: 'RankFilter', puuid, region }, 'rank filter DB miss');
    return false;
  }

  async prefetchBatch(pairs: Array<{ puuid: string; region: string }>): Promise<void> {
    const day = todayIso();
    const toQuery = pairs.filter((pair) => {
      const puuid = pair.puuid.trim();
      if (!puuid) return false;
      return this.cache.get(cacheKey(puuid, pair.region, day)) !== true;
    });

    if (toQuery.length === 0) return;

    const puuids = Array.from(new Set(toQuery.map((p) => p.puuid)));
    const rows = await timedDbOp('rank_filter_prefetch', () =>
      sql<{ puuid: string; region: string }[]>`
        SELECT prh.puuid, prh.region
        FROM player_rank_history prh
        WHERE prh.date = CURRENT_DATE
          AND prh.puuid = ANY(${sql.array(puuids, 25)})
      `,
    );

    const pairSet = new Set(
      toQuery.map((p) => `${p.puuid}:${normalizePlatformRegion(p.region)}`),
    );

    for (const row of rows) {
      const key = `${row.puuid}:${normalizePlatformRegion(row.region)}`;
      if (!pairSet.has(key)) continue;
      this.cache.set(cacheKey(row.puuid, row.region, day), true);
    }

    orchestrationLogger.debug(
      {
        component: 'RankFilter',
        pairs: toQuery.length,
        alreadyKnown: rows.length,
      },
      'rank filter prefetch',
    );
  }

  clearCache(): void {
    this.cache.clear();
  }
}
