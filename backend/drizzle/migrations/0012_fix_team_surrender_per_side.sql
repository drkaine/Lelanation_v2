-- Données legacy : count_team_surrendered / count_team_early_surrendered dupliqués sur team 100 et 200.
-- Réattribue par côté (blue=100, red=200). Les nouvelles ingestions utilisent surrenderedTeam100/200.

-- Early surrender : source champion_stats (sum_team_early_surrendered par joueur, /5 par équipe).
UPDATE team_core_stat t
SET count_team_early_surrendered = GREATEST(0, cs.early_cnt)
FROM (
  SELECT
    patch,
    rank_tier,
    region,
    team,
    ROUND(SUM(sum_team_early_surrendered)::numeric / 5)::integer AS early_cnt
  FROM champion_stats
  WHERE team IN (100, 200)
  GROUP BY patch, rank_tier, region, team
) cs
WHERE t.patch = cs.patch
  AND t.rank_tier = cs.rank_tier
  AND t.region = cs.region
  AND t.team = cs.team
  AND cs.early_cnt > 0;

-- Surrender normal : si les deux côtés ont le même compteur (>0), répartir S sur 100/200
-- (S = nb de parties en surrender ; chaque côté ne doit compter que ses propres surrenders).
WITH mirrored AS (
  SELECT
    patch,
    rank_tier,
    region,
    MAX(CASE WHEN team = 100 THEN count_team_surrendered END)::numeric AS s,
    MAX(CASE WHEN team = 100 THEN GREATEST(count_game - count_win, 0) END)::numeric AS side100,
    MAX(CASE WHEN team = 200 THEN GREATEST(count_game - count_win, 0) END)::numeric AS side200
  FROM team_core_stat
  WHERE team IN (100, 200)
  GROUP BY patch, rank_tier, region
  HAVING
    MAX(CASE WHEN team = 100 THEN count_team_surrendered END) > 0
    AND MAX(CASE WHEN team = 100 THEN count_team_surrendered END)
      = MAX(CASE WHEN team = 200 THEN count_team_surrendered END)
),
split AS (
  SELECT
    patch,
    rank_tier,
    region,
    s,
    GREATEST(0, ROUND(s * side100 / NULLIF(side100 + side200, 0))::integer) AS surr100,
    GREATEST(
      0,
      s::integer
        - ROUND(s * side100 / NULLIF(side100 + side200, 0))::integer
    ) AS surr200
  FROM mirrored
)
UPDATE team_core_stat t
SET count_team_surrendered = CASE
  WHEN t.team = 100 THEN sp.surr100
  WHEN t.team = 200 THEN sp.surr200
  ELSE t.count_team_surrendered
END
FROM split sp
WHERE t.patch = sp.patch
  AND t.rank_tier = sp.rank_tier
  AND t.region = sp.region
  AND t.team IN (100, 200);
