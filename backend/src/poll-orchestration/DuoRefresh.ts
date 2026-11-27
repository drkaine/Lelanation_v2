import { sql } from '../db/client.js';
import { POLLER_PLATFORMS, toDbRegions } from '../poller/utils/pollerScope.js';
import { sweepDay } from './leagueSweep.js';
import { DUO_MIN_GAMES, DUO_MIN_SHARE, DUO_RETENTION_DAYS } from './duoRules.js';

export interface DuoRefreshResult {
  pairs: number;
  gamesInserted: number;
  pairsDeleted: number;
}

/**
 * Rafraîchissement incrémental des duos. Curseur = `matchs.created_at` (ingestion) dans
 * `duo_refresh_state` : un match ingéré en retard avec une vieille game_date est quand même vu.
 * Seuls les joueurs présents dans les matchs ingérés depuis le dernier passage sont recomptés,
 * sur la fenêtre de rétention (DUO_RETENTION_DAYS) : plus de self-join sur tout `participants`.
 * Une paire est un duo si elle a ≥ DUO_MIN_GAMES parties en équipe et ≥ DUO_MIN_SHARE des parties
 * de chacun. Ses parties sont copiées dans `player_duo_games` avec le rang à la date du match.
 */
export async function refreshPlayerDuos(): Promise<DuoRefreshResult> {
  const regions = toDbRegions(POLLER_PLATFORMS);
  const today = sweepDay(new Date());
  return sql.begin(async (tx) => {
    const [cursor] = await tx<{ since: Date | null; until: Date | null }[]>`
      SELECT (SELECT last_match_created_at FROM duo_refresh_state WHERE id = 1) AS since,
             (SELECT MAX(created_at) FROM matchs) AS until
    `;
    const since = cursor?.since ?? null;
    const until = cursor?.until ?? null;

    const purge = async (): Promise<number> => {
      const deleted = await tx<{ puuid_a: string }[]>`
        DELETE FROM player_duos
        WHERE COALESCE(last_game_at, updated_at::date) < ${today}::date - ${DUO_RETENTION_DAYS}::int
        RETURNING puuid_a
      `;
      return deleted.length;
    };

    if (until === null || (since !== null && until.getTime() <= since.getTime())) {
      return { pairs: 0, gamesInserted: 0, pairsDeleted: await purge() };
    }

    const sinceTs = since ?? new Date(0);
    const pairs = await tx<{ puuid_a: string; puuid_b: string }[]>`
      WITH fresh AS (
        SELECT DISTINCT pa.puuid
        FROM matchs m
        JOIN participants pa ON pa.riot_match_id = m.riot_match_id
        WHERE m.created_at > ${sinceTs} AND m.created_at <= ${until}
          AND m.region = ANY(${regions}::lol_region[])
          AND m.early_surrender IS NOT TRUE
          AND pa.puuid IS NOT NULL
      ),
      team AS (
        SELECT pa.riot_match_id, pa.team_id, pa.puuid, m.region
        FROM fresh f
        JOIN participants pa ON pa.puuid = f.puuid
        JOIN matchs m ON m.riot_match_id = pa.riot_match_id
        WHERE m.region = ANY(${regions}::lol_region[])
          AND m.early_surrender IS NOT TRUE
          AND m.game_date >= ${today}::date - ${DUO_RETENTION_DAYS}::int
      ),
      player_games AS (
        SELECT puuid, COUNT(*)::int AS n FROM team GROUP BY puuid
      ),
      pairs AS (
        SELECT x.puuid AS a, y.puuid AS b, MIN(x.region::text) AS region, COUNT(*)::int AS n
        FROM team x
        JOIN team y ON y.riot_match_id = x.riot_match_id AND y.team_id = x.team_id AND x.puuid < y.puuid
        GROUP BY x.puuid, y.puuid
        HAVING COUNT(*) >= ${DUO_MIN_GAMES}
      )
      INSERT INTO player_duos (puuid_a, puuid_b, region, games_a, games_b, updated_at)
      SELECT p.a, p.b, p.region::lol_region, ga.n, gb.n, NOW()
      FROM pairs p
      JOIN player_games ga ON ga.puuid = p.a
      JOIN player_games gb ON gb.puuid = p.b
      WHERE p.n >= ${DUO_MIN_SHARE}::float8 * ga.n AND p.n >= ${DUO_MIN_SHARE}::float8 * gb.n
      ON CONFLICT (puuid_a, puuid_b) DO UPDATE
        SET games_a = EXCLUDED.games_a, games_b = EXCLUDED.games_b, updated_at = NOW()
      RETURNING puuid_a, puuid_b
    `;

    const touchedA = pairs.map((p) => p.puuid_a);
    const touchedB = pairs.map((p) => p.puuid_b);
    let gamesInserted = 0;

    if (pairs.length > 0) {
      const games = await tx<{ riot_match_id: string }[]>`
        INSERT INTO player_duo_games (
          riot_match_id, puuid_a, puuid_b, region, patch, game_date, win,
          role_a, role_b, champion_a, champion_b,
          kills_a, deaths_a, assists_a, kills_b, deaths_b, assists_b,
          tier_a, division_a, lp_a, tier_b, division_b, lp_b
        )
        SELECT
          x.riot_match_id, d.puuid_a, d.puuid_b, m.region, m.patch, m.game_date, x.win,
          x.team_position, y.team_position, x.champion_id, y.champion_id,
          x.kills, x.deaths, x.assists, y.kills, y.deaths, y.assists,
          ra.rank_tier, ra.rank_division, ra.rank_lp, rb.rank_tier, rb.rank_division, rb.rank_lp
        FROM unnest(${touchedA}::text[], ${touchedB}::text[]) AS d(puuid_a, puuid_b)
        JOIN participants x ON x.puuid = d.puuid_a
        JOIN participants y
          ON y.riot_match_id = x.riot_match_id AND y.puuid = d.puuid_b AND y.team_id = x.team_id
        JOIN matchs m ON m.riot_match_id = x.riot_match_id AND m.early_surrender IS NOT TRUE
        LEFT JOIN LATERAL (
          SELECT r.rank_tier, r.rank_division, r.rank_lp FROM player_rank_history r
          WHERE r.puuid = d.puuid_a AND r.date <= m.game_date ORDER BY r.date DESC LIMIT 1
        ) ra ON TRUE
        LEFT JOIN LATERAL (
          SELECT r.rank_tier, r.rank_division, r.rank_lp FROM player_rank_history r
          WHERE r.puuid = d.puuid_b AND r.date <= m.game_date ORDER BY r.date DESC LIMIT 1
        ) rb ON TRUE
        ON CONFLICT DO NOTHING
        RETURNING riot_match_id
      `;
      gamesInserted = games.length;

      await tx`
        UPDATE player_duos d
        SET games_together = g.games, wins_together = g.wins,
            first_game_at = g.first_game, last_game_at = g.last_game
        FROM (
          SELECT dg.puuid_a, dg.puuid_b, COUNT(*)::int AS games, COUNT(*) FILTER (WHERE dg.win)::int AS wins,
                 MIN(dg.game_date) AS first_game, MAX(dg.game_date) AS last_game
          FROM player_duo_games dg
          JOIN unnest(${touchedA}::text[], ${touchedB}::text[]) AS t(puuid_a, puuid_b)
            ON t.puuid_a = dg.puuid_a AND t.puuid_b = dg.puuid_b
          GROUP BY dg.puuid_a, dg.puuid_b
        ) g
        WHERE d.puuid_a = g.puuid_a AND d.puuid_b = g.puuid_b
      `;
    }

    const pairsDeleted = await purge();

    await tx`
      INSERT INTO duo_refresh_state (id, last_match_created_at) VALUES (1, ${until})
      ON CONFLICT (id) DO UPDATE SET last_match_created_at = EXCLUDED.last_match_created_at
    `;

    return { pairs: pairs.length, gamesInserted, pairsDeleted };
  });
}
