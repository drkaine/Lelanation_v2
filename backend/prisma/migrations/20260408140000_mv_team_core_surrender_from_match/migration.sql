-- Surrenders par côté (bleu/rouge) : s’appuyer sur matchs.game_ended_in_* + équipe perdante,
-- car team_early_surrendered (participants) est souvent faux alors que le match porte bien les flags.
-- Ajoute count_team_surrendered (tous FF) distinct de count_team_early_surrendered.

DROP MATERIALIZED VIEW IF EXISTS mv_team_core_stats;

CREATE MATERIALIZED VIEW mv_team_core_stats AS
WITH team_drake_stats AS (
  SELECT
    d.match_id,
    d.team_id,
    SUM(CASE WHEN upper(d.drake_type) IN ('EARTH_DRAGON', 'MOUNTAIN_DRAGON') THEN 1 ELSE 0 END)::int AS count_earth_drake,
    SUM(CASE WHEN upper(d.drake_type) IN ('WATER_DRAGON', 'OCEAN_DRAGON') THEN 1 ELSE 0 END)::int AS count_water_drake,
    SUM(CASE WHEN upper(d.drake_type) IN ('AIR_DRAGON', 'WIND_DRAGON', 'CLOUD_DRAGON') THEN 1 ELSE 0 END)::int AS count_wind_drake,
    SUM(CASE WHEN upper(d.drake_type) IN ('FIRE_DRAGON', 'INFERNAL_DRAGON') THEN 1 ELSE 0 END)::int AS count_fire_drake,
    SUM(CASE WHEN upper(d.drake_type) IN ('HEXTECH_DRAGON', 'HEXTEC_DRAGON') THEN 1 ELSE 0 END)::int AS count_hextec_drake,
    SUM(CASE WHEN upper(d.drake_type) IN ('CHEMTECH_DRAGON', 'CHEM_DRAGON') THEN 1 ELSE 0 END)::int AS count_chem_drake,
    MAX(CASE WHEN upper(trim(d.soul)) IN ('MOUNTAIN', 'EARTH_DRAGON', 'MOUNTAIN_DRAGON', 'EARTH_DRAGON_SOUL', 'MOUNTAIN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_earth_drake_soul,
    MAX(CASE WHEN upper(trim(d.soul)) IN ('OCEAN', 'WATER_DRAGON', 'OCEAN_DRAGON', 'WATER_DRAGON_SOUL', 'OCEAN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_water_drake_soul,
    MAX(CASE WHEN upper(trim(d.soul)) IN ('CLOUD', 'AIR_DRAGON', 'WIND_DRAGON', 'CLOUD_DRAGON', 'AIR_DRAGON_SOUL', 'WIND_DRAGON_SOUL', 'CLOUD_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_wind_drake_soul,
    MAX(CASE WHEN upper(trim(d.soul)) IN ('INFERNAL', 'FIRE_DRAGON', 'INFERNAL_DRAGON', 'FIRE_DRAGON_SOUL', 'INFERNAL_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_fire_drake_soul,
    MAX(CASE WHEN upper(trim(d.soul)) IN ('HEXTECH', 'HEXTECH_DRAGON', 'HEXTEC_DRAGON', 'HEXTECH_DRAGON_SOUL', 'HEXTEC_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_hextec_drake_soul,
    MAX(CASE WHEN upper(trim(d.soul)) IN ('CHEMTECH', 'CHEMTECH_DRAGON', 'CHEM_DRAGON', 'CHEMTECH_DRAGON_SOUL', 'CHEM_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_chem_drake_soul,
    SUM(CASE WHEN upper(d.drake_type) = 'ELDER_DRAGON' THEN 1 ELSE 0 END)::int AS sum_elder_kills
  FROM drake_details d
  GROUP BY d.match_id, d.team_id
)
SELECT
  team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region) AS id,
  t.team,
  m.rank_tier,
  ''::text AS rank_division,
  m.game_version,
  m.region,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(CASE WHEN NOT t.win AND m.game_ended_in_early_surrender THEN 1 ELSE 0 END)::int AS count_team_early_surrendered,
  SUM(CASE WHEN NOT t.win AND m.game_ended_in_surrender THEN 1 ELSE 0 END)::int AS count_team_surrendered,
  SUM(t.baron_kills)::int AS sum_baron_kills,
  SUM(CASE WHEN t.baron_first THEN 1 ELSE 0 END)::int AS count_baron_first,
  SUM(t.dragon_kills)::int AS sum_dragon_kills,
  SUM(CASE WHEN t.dragon_first THEN 1 ELSE 0 END)::int AS count_dragon_first,
  SUM(t.tower_kills)::int AS sum_tower_kills,
  SUM(CASE WHEN t.tower_first THEN 1 ELSE 0 END)::int AS count_tower_first,
  SUM(t.horde_kills)::int AS sum_horde_kills,
  SUM(CASE WHEN t.horde_first THEN 1 ELSE 0 END)::int AS count_horde_first,
  SUM(t.rift_herald_kills)::int AS sum_rift_herald_kills,
  SUM(CASE WHEN t.rift_herald_first THEN 1 ELSE 0 END)::int AS count_rift_herald_first,
  SUM(t.inhibitor_kills)::int AS sum_inhibitor_kills,
  SUM(t.champion_kills)::int AS sum_champion_kills,
  SUM(CASE WHEN t.first_blood THEN 1 ELSE 0 END)::int AS count_first_blood,
  SUM(COALESCE(ds.sum_elder_kills, 0))::int AS sum_elder_kills,
  SUM(COALESCE(ds.count_earth_drake, 0))::int AS count_earth_drake,
  SUM(COALESCE(ds.count_water_drake, 0))::int AS count_water_drake,
  SUM(COALESCE(ds.count_wind_drake, 0))::int AS count_wind_drake,
  SUM(COALESCE(ds.count_fire_drake, 0))::int AS count_fire_drake,
  SUM(COALESCE(ds.count_hextec_drake, 0))::int AS count_hextec_drake,
  SUM(COALESCE(ds.count_chem_drake, 0))::int AS count_chem_drake,
  SUM(COALESCE(ds.count_earth_drake_soul, 0))::int AS count_earth_drake_soul,
  SUM(COALESCE(ds.count_water_drake_soul, 0))::int AS count_water_drake_soul,
  SUM(COALESCE(ds.count_wind_drake_soul, 0))::int AS count_wind_drake_soul,
  SUM(COALESCE(ds.count_fire_drake_soul, 0))::int AS count_fire_drake_soul,
  SUM(COALESCE(ds.count_hextec_drake_soul, 0))::int AS count_hextec_drake_soul,
  SUM(COALESCE(ds.count_chem_drake_soul, 0))::int AS count_chem_drake_soul
FROM matchs m
JOIN teams t ON t.match_id = m.id
LEFT JOIN team_drake_stats ds ON ds.match_id = t.match_id AND ds.team_id = t.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY t.team, m.rank_tier, m.game_version, m.region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_team_core_stats (id);
CREATE UNIQUE INDEX ON mv_team_core_stats (team, rank_tier, rank_division, game_version, region);
