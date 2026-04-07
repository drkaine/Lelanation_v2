-- Enforce MV-only runtime sources for statistics page endpoints.
-- Adds dedicated MVs used by stats services (no direct reads from raw tables at request time).

DROP MATERIALIZED VIEW IF EXISTS mv_match_outcome_stats;
CREATE MATERIALIZED VIEW mv_match_outcome_stats AS
WITH remake_matches AS (
  SELECT
    mp.match_id
  FROM match_players mp
  GROUP BY mp.match_id
  HAVING BOOL_OR(
    mp.items IS NULL
    OR jsonb_typeof(mp.items) <> 'array'
    OR jsonb_array_length(mp.items) = 0
  )
)
SELECT
  m.game_version,
  m.rank_tier,
  COUNT(*)::bigint AS count_match,
  SUM(CASE WHEN m.game_ended_in_early_surrender THEN 1 ELSE 0 END)::bigint AS count_early_surrender,
  SUM(CASE WHEN m.game_ended_in_surrender THEN 1 ELSE 0 END)::bigint AS count_surrender,
  SUM(CASE WHEN rm.match_id IS NOT NULL THEN 1 ELSE 0 END)::bigint AS count_remake
FROM matchs m
LEFT JOIN remake_matches rm ON rm.match_id = m.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
  SELECT game_version FROM active_patches
)
GROUP BY m.game_version, m.rank_tier;

CREATE UNIQUE INDEX mv_match_outcome_stats_uidx
  ON mv_match_outcome_stats (game_version, rank_tier);

DROP MATERIALIZED VIEW IF EXISTS mv_champion_side_stats;
CREATE MATERIALIZED VIEW mv_champion_side_stats AS
SELECT
  m.game_version,
  m.rank_tier,
  COALESCE(NULLIF(UPPER(TRIM(mp.role)), ''), 'UNKNOWN') AS role_norm,
  t.team AS team_num,
  mp.champion_id,
  COUNT(*)::bigint AS count_game,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::bigint AS count_win,
  SUM(COALESCE(c.physical_damage_dealt_to_champions, 0))::bigint AS sum_phys_dmg_to_champ,
  SUM(COALESCE(c.magic_damage_dealt_to_champions, 0))::bigint AS sum_magic_dmg_to_champ,
  SUM(COALESCE(c.true_damage_dealt_to_champions, 0))::bigint AS sum_true_dmg_to_champ,
  SUM(COALESCE(c.physical_damage_taken, 0))::bigint AS sum_phys_dmg_taken,
  SUM(COALESCE(c.magic_damage_taken, 0))::bigint AS sum_magic_dmg_taken,
  SUM(COALESCE(c.true_damage_taken, 0))::bigint AS sum_true_dmg_taken,
  SUM(COALESCE(c.total_damage_taken, 0))::bigint AS sum_total_dmg_taken,
  SUM(COALESCE(k.kills, 0))::bigint AS sum_kills,
  SUM(COALESCE(k.deaths, 0))::bigint AS sum_deaths,
  SUM(COALESCE(k.assists, 0))::bigint AS sum_assists
FROM match_players mp
INNER JOIN teams t ON t.id = mp.team_id
INNER JOIN matchs m ON m.id = mp.match_id
LEFT JOIN match_player_combats c ON c.match_player_id = mp.id
LEFT JOIN match_player_core k ON k.match_player_id = mp.id
WHERE t.team IN (100, 200)
  AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
    SELECT game_version FROM active_patches
  )
GROUP BY
  m.game_version,
  m.rank_tier,
  role_norm,
  t.team,
  mp.champion_id;

CREATE UNIQUE INDEX mv_champion_side_stats_uidx
  ON mv_champion_side_stats (game_version, rank_tier, role_norm, team_num, champion_id);

DROP MATERIALIZED VIEW IF EXISTS mv_champion_summoner_spell_pair_stats;
CREATE MATERIALIZED VIEW mv_champion_summoner_spell_pair_stats AS
SELECT
  m.game_version,
  m.rank_tier,
  COALESCE(NULLIF(UPPER(TRIM(mp.role)), ''), 'UNKNOWN') AS role_norm,
  mp.champion_id,
  mp.summoner_spells[1]::int AS spell_d,
  mp.summoner_spells[2]::int AS spell_f,
  COUNT(*)::bigint AS count_game,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::bigint AS count_win
FROM match_players mp
INNER JOIN teams t ON t.id = mp.team_id
INNER JOIN matchs m ON m.id = mp.match_id
WHERE cardinality(mp.summoner_spells) >= 2
  AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
    SELECT game_version FROM active_patches
  )
GROUP BY
  m.game_version,
  m.rank_tier,
  role_norm,
  mp.champion_id,
  mp.summoner_spells[1],
  mp.summoner_spells[2];

CREATE UNIQUE INDEX mv_champion_spell_pair_stats_uidx
  ON mv_champion_summoner_spell_pair_stats (game_version, rank_tier, role_norm, champion_id, spell_d, spell_f);

DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_starter_set_stats;
CREATE MATERIALIZED VIEW mv_champion_item_starter_set_stats AS
WITH starter_rows AS (
  SELECT
    m.game_version,
    m.rank_tier,
    COALESCE(NULLIF(UPPER(TRIM(mp.role)), ''), 'UNKNOWN') AS role_norm,
    mp.champion_id,
    t.win,
    COALESCE(
      (
        SELECT
          '[' || string_agg((e ->> 'itemId')::text, ',' ORDER BY (e ->> 'order')::int, (e ->> 'timestampMs')::bigint) || ']'
        FROM jsonb_array_elements(mp.items) AS e
        WHERE COALESCE((e ->> 'starter')::boolean, false)
          AND (e ->> 'itemId')::int NOT IN (
            3340, 3364, 3363, 2055,
            2003, 2009, 2010, 2031, 2032, 2033, 2060, 2138, 2139, 2140
          )
      ),
      '[]'
    ) AS starter_key
  FROM match_players mp
  INNER JOIN teams t ON t.id = mp.team_id
  INNER JOIN matchs m ON m.id = mp.match_id
  WHERE jsonb_typeof(mp.items) = 'array'
    AND jsonb_array_length(mp.items) > 0
    AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
      SELECT game_version FROM active_patches
    )
)
SELECT
  game_version,
  rank_tier,
  role_norm,
  champion_id,
  starter_key,
  COUNT(*)::bigint AS count_game,
  SUM(CASE WHEN win THEN 1 ELSE 0 END)::bigint AS count_win
FROM starter_rows
WHERE starter_key <> '[]'
GROUP BY game_version, rank_tier, role_norm, champion_id, starter_key;

CREATE UNIQUE INDEX mv_champion_item_starter_set_stats_uidx
  ON mv_champion_item_starter_set_stats (game_version, rank_tier, role_norm, champion_id, starter_key);

REFRESH MATERIALIZED VIEW mv_match_outcome_stats;
REFRESH MATERIALIZED VIEW mv_champion_side_stats;
REFRESH MATERIALIZED VIEW mv_champion_summoner_spell_pair_stats;
REFRESH MATERIALIZED VIEW mv_champion_item_starter_set_stats;

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
DECLARE
  mv_name TEXT;
BEGIN
  FOREACH mv_name IN ARRAY ARRAY[
    'mv_champion_core_stats',
    'mv_champion_vs_stats',
    'mv_champion_duo_role_stats',
    'mv_botlane_duo_vs_duo_stats',
    'mv_team_core_stats',
    'mv_champion_first_objectif_stats',
    'mv_champion_objectif_stats',
    'mv_champion_vision_stats',
    'mv_champion_combat_stats',
    'mv_champion_matchup_stats',
    'mv_champion_challenge_stats',
    'mv_champion_shard_solo_stats',
    'mv_champion_runes_solo_stats',
    'mv_champion_shard_stats',
    'mv_champion_runes_stats',
    'mv_champion_item_solo_stats',
    'mv_champion_item_stats',
    'mv_champion_spell_solo_stats',
    'mv_champion_summoner_spells',
    'mv_champion_bucket',
    'mv_champion_bans_by_banner',
    'mv_team_bucket',
    'mv_match_outcome_stats',
    'mv_champion_side_stats',
    'mv_champion_summoner_spell_pair_stats',
    'mv_champion_item_starter_set_stats'
  ]
  LOOP
    BEGIN
      EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', mv_name);
    EXCEPTION
      WHEN OTHERS THEN
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', mv_name);
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
