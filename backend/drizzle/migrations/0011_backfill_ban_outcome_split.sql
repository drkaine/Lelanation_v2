-- Estimation rétroactive : répartit les bans existants selon le WR moyen par patch/rank/region.
-- Les nouvelles parties ingérées remplacent progressivement ces valeurs via ingestion.worker.
WITH team_wr AS (
  SELECT
    patch,
    rank_tier,
    region,
    CASE
      WHEN SUM(count_game) > 0 THEN SUM(count_win)::numeric / SUM(count_game)::numeric
      ELSE 0.5
    END AS win_rate
  FROM team_core_stat
  GROUP BY patch, rank_tier, region
)
UPDATE champion_bans_by_banner bb
SET
  count_ban_when_team_won = GREATEST(
    0,
    ROUND((bb.count_banner_team_100 + bb.count_banner_team_200) * wr.win_rate)::integer
  ),
  count_ban_when_team_lost = GREATEST(
    0,
    (bb.count_banner_team_100 + bb.count_banner_team_200)
      - ROUND((bb.count_banner_team_100 + bb.count_banner_team_200) * wr.win_rate)::integer
  )
FROM team_wr wr
WHERE bb.patch = wr.patch
  AND bb.rank_tier = wr.rank_tier
  AND bb.region = wr.region
  AND (bb.count_banner_team_100 + bb.count_banner_team_200) > 0
  AND bb.count_ban_when_team_won = 0
  AND bb.count_ban_when_team_lost = 0;
