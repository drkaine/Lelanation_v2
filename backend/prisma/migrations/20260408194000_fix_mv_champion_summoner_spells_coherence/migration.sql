-- Rebuild mv_champion_summoner_spells from ordered summoner_spells (D/F)
-- to keep solo spell stats coherent with pair spell stats.

DROP MATERIALIZED VIEW IF EXISTS mv_champion_summoner_spells;

CREATE MATERIALIZED VIEW mv_champion_summoner_spells AS
WITH spells_per_player AS (
  SELECT
    core_stat_id(
      mp.champion_id,
      COALESCE(NULLIF(TRIM(mp.rank_tier), ''), m.rank_tier),
      ''::text,
      m.game_version,
      mp.role,
      m.region
    ) AS champion_stat_id,
    t.win,
    mp.summoner_spells[1]::int AS spell_d,
    mp.summoner_spells[2]::int AS spell_f
  FROM match_players mp
  INNER JOIN teams t ON t.id = mp.team_id
  INNER JOIN matchs m ON m.id = mp.match_id
  WHERE cardinality(mp.summoner_spells) >= 2
    AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
      SELECT game_version FROM active_patches
    )
),
spell_rows AS (
  SELECT champion_stat_id, win, spell_d AS spell_id, 1::int AS slot0, 0::int AS slot1
  FROM spells_per_player
  UNION ALL
  SELECT champion_stat_id, win, spell_f AS spell_id, 0::int AS slot0, 1::int AS slot1
  FROM spells_per_player
)
SELECT
  champion_stat_id,
  spell_id,
  LEAST(SUM(CASE WHEN win THEN 1 ELSE 0 END), 2147483647)::int AS count_win,
  LEAST(COUNT(*), 2147483647)::int AS count_game,
  LEAST(SUM(slot0), 2147483647)::int AS count_slot0,
  LEAST(SUM(slot1), 2147483647)::int AS count_slot1
FROM spell_rows
GROUP BY champion_stat_id, spell_id
WITH NO DATA;

CREATE UNIQUE INDEX mv_champion_summoner_spells_uidx
  ON mv_champion_summoner_spells (champion_stat_id, spell_id);

REFRESH MATERIALIZED VIEW mv_champion_summoner_spells;
