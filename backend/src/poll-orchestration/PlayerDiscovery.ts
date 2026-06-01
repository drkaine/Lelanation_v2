import { sql } from '../db/client.js';
import { timedDbOp } from '../observability/poller-metrics/timedDbOp.js';
import type { DiscoveryPlayer } from './types.js';
import { orchestrationLogger } from './logger.js';

export class PlayerDiscovery {
  async fetchNextBatch(limit: number): Promise<DiscoveryPlayer[]> {
    const safeLimit = Math.max(1, limit);
    const rows = await timedDbOp('player_discovery_fetch', () =>
      sql<DiscoveryPlayer[]>`
        SELECT puuid, region
        FROM players
        WHERE region IS NOT NULL
          AND LENGTH(TRIM(puuid)) > 0
        ORDER BY last_seen ASC NULLS FIRST
        LIMIT ${safeLimit}
        FOR UPDATE SKIP LOCKED
      `,
    );

    const nullLastSeen = rows.filter((row) => row.puuid).length;
    orchestrationLogger.debug(
      {
        component: 'PlayerDiscovery',
        count: rows.length,
        limit: safeLimit,
        hasNullLastSeen: nullLastSeen,
      },
      'discovery batch fetched',
    );

    if (rows.length === 0) {
      orchestrationLogger.warn({ component: 'PlayerDiscovery' }, 'discovery batch empty — no players in DB');
    }

    return rows.map((row) => ({
      puuid: row.puuid,
      region: String(row.region ?? '').trim().toLowerCase(),
    }));
  }

  async updateLastSeen(puuid: string): Promise<void> {
    await timedDbOp('update_last_seen', () =>
      sql`
        UPDATE players
        SET last_seen = NOW(), updated_at = NOW()
        WHERE puuid = ${puuid}
      `,
    );
    orchestrationLogger.info({ component: 'PlayerDiscovery', puuid }, 'player last_seen updated');
  }
}
