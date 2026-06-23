import { sql } from '../db/client.js';
import { timedDbOp } from '../observability/poller-metrics/timedDbOp.js';
import { orchestrationLogger } from './logger.js';

export class MatchFilter {
  async filterNew(matchIds: string[]): Promise<string[]> {
    if (matchIds.length === 0) return [];

    const unique = Array.from(new Set(matchIds.map((id) => id.trim()).filter(Boolean)));
    const knownRows = await timedDbOp('match_filter_query', () =>
      sql<{ riot_match_id: string }[]>`
        SELECT riot_match_id
        FROM matchs
        WHERE riot_match_id = ANY(${sql.array(unique, 25)})
      `,
    );

    const known = new Set(knownRows.map((row) => row.riot_match_id));
    const result = unique.filter((id) => !known.has(id));

    orchestrationLogger.debug(
      {
        component: 'MatchFilter',
        total: unique.length,
        known: known.size,
        new: result.length,
      },
      'match filter query',
    );

    return result;
  }
}
