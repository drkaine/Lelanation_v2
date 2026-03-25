-- Recreate mv_botlane_duo_vs_duo_stats without rank_division
-- rank_division is not needed for botlane duo vs duo aggregations.

DROP MATERIALIZED VIEW IF EXISTS mv_botlane_duo_vs_duo_stats;

CREATE MATERIALIZED VIEW mv_botlane_duo_vs_duo_stats AS
WITH botlane_duos AS (
  SELECT
    m.id AS match_id,
    m.region,
    m.game_version,
    m.rank_tier,
    t.id AS team_id,
    t.win AS team_win,
    MAX(CASE WHEN mp.role = 'ADC' THEN mp.champion_id END) AS adc_id,
    MAX(CASE WHEN mp.role = 'SUPPORT' THEN mp.champion_id END) AS support_id
  FROM matchs m
  JOIN teams t ON t.match_id = m.id
  JOIN match_players mp ON mp.match_id = m.id AND mp.team_id = t.id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
    SELECT game_version FROM active_patches
  )
  GROUP BY m.id, m.region, m.game_version, m.rank_tier, t.id, t.win
  HAVING
    COUNT(*) FILTER (WHERE mp.role = 'ADC') = 1
    AND COUNT(*) FILTER (WHERE mp.role = 'SUPPORT') = 1
),
duo_vs_duo AS (
  SELECT
    a.region,
    a.game_version,
    a.rank_tier,
    a.adc_id,
    a.support_id,
    b.adc_id AS opp_adc_id,
    b.support_id AS opp_support_id,
    a.team_win
  FROM botlane_duos a
  JOIN botlane_duos b
    ON b.match_id = a.match_id
   AND b.team_id != a.team_id
  WHERE a.adc_id IS NOT NULL
    AND a.support_id IS NOT NULL
    AND b.adc_id IS NOT NULL
    AND b.support_id IS NOT NULL
)
SELECT
  adc_id,
  support_id,
  opp_adc_id,
  opp_support_id,
  rank_tier,
  game_version,
  region,
  SUM(CASE WHEN team_win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM duo_vs_duo
GROUP BY
  adc_id,
  support_id,
  opp_adc_id,
  opp_support_id,
  rank_tier,
  game_version,
  region;

CREATE UNIQUE INDEX ON mv_botlane_duo_vs_duo_stats (
  adc_id, support_id, opp_adc_id, opp_support_id, rank_tier, game_version, region
);

