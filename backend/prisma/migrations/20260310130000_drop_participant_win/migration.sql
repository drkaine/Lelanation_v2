-- Drop participants.win; win is already on match_teams.
-- Drop views that depend on participants.win, then recreate them using match_teams.win.

DROP VIEW IF EXISTS stats_champion_winrate CASCADE;
DROP VIEW IF EXISTS players_with_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_overview_detail_base CASCADE;

CREATE MATERIALIZED VIEW mv_overview_detail_base AS
SELECT
  p.id,
  p.match_id,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', rune_styles.style_id,
        'selections', rune_styles.sel
      )
      ORDER BY rune_styles.min_slot
    )
    FROM (
      SELECT
        pr.style_id,
        jsonb_agg(jsonb_build_object('perk', pr.perk_id) ORDER BY pr.slot) AS sel,
        MIN(pr.slot) AS min_slot
      FROM participant_runes pr
      WHERE pr.participant_id = p.id
      GROUP BY pr.style_id
    ) rune_styles
  ), '[]'::jsonb) AS runes,
  COALESCE((
    SELECT jsonb_agg(pi.item_id ORDER BY pi.item_slot)
    FROM participant_items pi
    WHERE pi.participant_id = p.id
  ), '[]'::jsonb) AS items,
  COALESCE((
    SELECT jsonb_agg(pss.spell_id ORDER BY pss.spell_slot)
    FROM participant_summoner_spells pss
    WHERE pss.participant_id = p.id
  ), '[]'::jsonb) AS summoner_spells,
  mt.win,
  m.game_version,
  m.rank
FROM participants p
INNER JOIN matches m ON m.id = p.match_id
INNER JOIN (
  SELECT id, match_id,
    CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
  FROM participants
) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id;

CREATE UNIQUE INDEX idx_mv_overview_detail_base_id ON mv_overview_detail_base (id);
CREATE INDEX idx_mv_overview_detail_base_version_rank ON mv_overview_detail_base (game_version, rank)
  WHERE game_version IS NOT NULL AND rank IS NOT NULL;
CREATE INDEX idx_mv_overview_detail_base_version ON mv_overview_detail_base (game_version)
  WHERE game_version IS NOT NULL;
CREATE INDEX idx_mv_overview_detail_base_rank ON mv_overview_detail_base (rank)
  WHERE rank IS NOT NULL;

ALTER TABLE participants DROP COLUMN IF EXISTS win;

-- Recreate stats_champion_winrate using match_teams.win (team from participant order: first 5 = 100, next 5 = 200)
CREATE OR REPLACE VIEW stats_champion_winrate AS
SELECT
  p.champion_id,
  COUNT(*)::bigint AS games,
  SUM(CASE WHEN mt.win THEN 1 ELSE 0 END)::bigint AS wins,
  ROUND(100.0 * SUM(CASE WHEN mt.win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS winrate,
  ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM participants), 0), 2) AS pickrate
FROM participants p
INNER JOIN (
  SELECT id, match_id,
    CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
  FROM participants
) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
GROUP BY p.champion_id;

COMMENT ON VIEW stats_champion_winrate IS 'Champion games/wins/winrate/pickrate from participants for stats and overview';

-- Recreate players_with_stats using match_teams.win (team from participant order: first 5 = 100, next 5 = 200)
CREATE OR REPLACE VIEW players_with_stats AS
SELECT
  pl.id,
  pl.puuid,
  pl.game_name,
  pl.tag_name,
  pl.region,
  pl.last_seen,
  pl.created_at,
  COALESCE(agg.games, 0)::int AS total_games,
  COALESCE(agg.wins, 0)::int AS total_wins
FROM players pl
LEFT JOIN (
  SELECT p.player_id, COUNT(*) AS games, COUNT(*) FILTER (WHERE mt.win) AS wins
  FROM participants p
  INNER JOIN (
    SELECT id, match_id,
      CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
    FROM participants
  ) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
  INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
  GROUP BY p.player_id
) agg ON pl.id = agg.player_id;

COMMENT ON VIEW players_with_stats IS 'Players with total_games/total_wins aggregated from participants (by player_id)';
