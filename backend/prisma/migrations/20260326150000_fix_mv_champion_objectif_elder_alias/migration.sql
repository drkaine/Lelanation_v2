-- Keep legacy sum_elder_kills meaningful by mapping it to Elder Dragon kills
-- computed from drake_details (same source as drake type counters).
DROP MATERIALIZED VIEW IF EXISTS mv_champion_objectif_stats;

CREATE MATERIALIZED VIEW mv_champion_objectif_stats AS
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
    SUM(CASE WHEN upper(d.drake_type) = 'ELDER_DRAGON' OR lower(d.drake_type) = 'elder' THEN 1 ELSE 0 END)::int AS sum_elder_dragon_kills
  FROM drake_details d
  GROUP BY d.match_id, d.team_id
)
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_core_stat_id,
  0::int AS sum_baron_kills,
  SUM(COALESCE(o.dragon_kills, 0))::int AS sum_dragon_kills,
  SUM(COALESCE(o.turret_kills, 0))::int AS sum_turret_kills,
  0::int AS sum_horde_kills,
  SUM(COALESCE(o.rift_herald_takedowns, 0))::int AS count_rift_herald_kills,
  SUM(COALESCE(o.inhibitor_kills, 0))::int AS sum_inhibitor_kills,
  0::int AS sum_champion_kills,
  SUM(COALESCE(ds.sum_elder_dragon_kills, 0))::int AS sum_elder_kills,
  SUM(COALESCE(ds.sum_elder_dragon_kills, 0))::int AS sum_elder_dragon_kills,
  SUM(COALESCE(o.inhibitor_takedowns, 0))::int AS sum_inhibitor_takedowns,
  SUM(COALESCE(o.inhibitors_lost, 0))::int AS sum_inhibitors_lost,
  SUM(COALESCE(o.objectives_stolen, 0))::int AS sum_objectives_stolen,
  SUM(COALESCE(o.objectives_stolen_assists, 0))::int AS sum_objectives_stolen_assists,
  SUM(COALESCE(o.turret_takedowns, 0))::int AS sum_turret_takedowns,
  SUM(COALESCE(o.turrets_lost, 0))::int AS sum_turrets_lost,
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
  SUM(COALESCE(ds.count_chem_drake_soul, 0))::int AS count_chem_drake_soul,
  SUM(COALESCE(o.dragon_takedowns, 0))::int AS sum_dragon_takedowns,
  SUM(COALESCE(o.earliest_baron, 0))::int AS sum_earliest_baron,
  SUM(COALESCE(o.elder_dragon_kills_with_opposing_soul, 0))::int AS sum_elder_dragon_kills_with_opposing_soul,
  SUM(COALESCE(o.elder_dragon_multikills, 0))::int AS sum_elder_dragon_multikills,
  SUM(COALESCE(o.epic_monster_kills_near_enemy_jungler, 0))::int AS sum_epic_monster_kills_near_enemy_jungler,
  SUM(COALESCE(o.epic_monster_kills_within_30_seconds_of_spawn, 0))::int AS sum_epic_monster_kills_within_30_seconds_of_spawn,
  SUM(COALESCE(o.epic_monster_steals, 0))::int AS sum_epic_monster_steals,
  SUM(COALESCE(o.epic_monster_stolen_without_smite, 0))::int AS sum_epic_monster_stolen_without_smite,
  SUM(COALESCE(o.first_turret_killed_time, 0))::int AS sum_first_turret_killed_time,
  SUM(COALESCE(o.multi_turret_rift_herald_count, 0))::int AS sum_multi_turret_rift_herald_count,
  SUM(COALESCE(o.quick_first_turret, 0))::int AS sum_quick_first_turret,
  SUM(COALESCE(o.rift_herald_takedowns, 0))::int AS sum_rift_herald_takedowns,
  SUM(COALESCE(o.solo_baron_kills, 0))::int AS sum_solo_baron_kills,
  SUM(COALESCE(o.solo_turrets_lategame, 0))::int AS sum_solo_turrets_lategame,
  SUM(COALESCE(o.takedown_on_first_turret, 0))::int AS sum_takedown_on_first_turret,
  SUM(COALESCE(o.turrets_taken_with_rift_herald, 0))::int AS sum_turrets_taken_with_rift_herald
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
LEFT JOIN match_player_objectives o ON o.match_player_id = mp.id
LEFT JOIN team_drake_stats ds ON ds.match_id = mp.match_id AND ds.team_id = mp.team_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_objectif_stats (champion_core_stat_id);

DROP MATERIALIZED VIEW IF EXISTS mv_champion_bucket;

CREATE MATERIALIZED VIEW mv_champion_bucket AS
SELECT
  core_stat_id(mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, mp.role, m.region) AS champion_stat_id,
  b.duration_bucket,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(COALESCE(b.current_gold, 0))::int AS sum_current_gold,
  SUM(COALESCE(b.magic_damage_done, 0))::int AS sum_magic_damage_done,
  SUM(COALESCE(b.magic_damage_done_to_champion, 0))::int AS sum_magic_damage_done_to_champion,
  SUM(COALESCE(b.magic_damage_taken, 0))::int AS sum_magic_damage_taken,
  SUM(COALESCE(b.physical_damage_done, 0))::int AS sum_physical_damage_done,
  SUM(COALESCE(b.physical_damage_done_to_champion, 0))::int AS sum_physical_damage_done_to_champion,
  SUM(COALESCE(b.physical_damage_taken, 0))::int AS sum_physical_damage_taken,
  SUM(COALESCE(b.total_damage_done, 0))::int AS sum_total_damage_done,
  SUM(COALESCE(b.total_damage_done_to_champion, 0))::int AS sum_total_damage_done_to_champion,
  SUM(COALESCE(b.total_damage_taken, 0))::int AS sum_total_damage_taken,
  SUM(COALESCE(b.true_damage_done, 0))::int AS sum_true_damage_done,
  SUM(COALESCE(b.true_damage_done_to_champion, 0))::int AS sum_true_damage_done_to_champion,
  SUM(COALESCE(b.true_damage_taken, 0))::int AS sum_true_damage_taken,
  SUM(COALESCE(b.gold_per_second, 0))::int AS sum_gold_per_second,
  SUM(COALESCE(b.jungle_minions_killed, 0))::int AS sum_jungle_minions_killed,
  SUM(COALESCE(b.level, 0))::int AS sum_level,
  SUM(COALESCE(b.minions_killed, 0))::int AS sum_minions_killed,
  SUM(COALESCE(b.time_enemy_spent_controlled, 0))::int AS sum_time_enemy_spent_controlled,
  SUM(COALESCE(b.total_gold, 0))::int AS sum_total_gold,
  SUM(COALESCE(b.xp, 0))::int AS sum_xp,
  SUM(
    CASE
      WHEN b.duration_bucket = ((FLOOR(COALESCE(m.game_duration, 0)::numeric / 60)::int / 5) * 5) THEN 1
      ELSE 0
    END
  )::int AS count_game_finished_at_bucket
FROM match_players mp
JOIN matchs m ON m.id = mp.match_id
JOIN teams t ON t.id = mp.team_id
JOIN match_player_bucket b ON b.match_player_id = mp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY mp.champion_id, COALESCE(NULLIF(trim(mp.rank_tier), ''), m.rank_tier), m.game_version, mp.role, m.region, b.duration_bucket
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_champion_bucket (champion_stat_id, duration_bucket);

DROP MATERIALIZED VIEW IF EXISTS mv_team_bucket;

CREATE MATERIALIZED VIEW mv_team_bucket AS
WITH elder_by_team AS (
  SELECT
    d.match_id,
    d.team_id,
    SUM(CASE WHEN upper(d.drake_type) = 'ELDER_DRAGON' OR lower(d.drake_type) = 'elder' THEN 1 ELSE 0 END)::int AS elder_kills
  FROM drake_details d
  GROUP BY d.match_id, d.team_id
),
objective_buckets AS (
  SELECT
    team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region) AS team_stat_id,
    'baron'::text AS objective_key,
    COALESCE(t.baron_kills, 0)::int AS objective_bucket,
    t.win
  FROM teams t
  JOIN matchs m ON m.id = t.match_id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT
    team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region),
    'dragon'::text,
    COALESCE(t.dragon_kills, 0)::int,
    t.win
  FROM teams t
  JOIN matchs m ON m.id = t.match_id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT
    team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region),
    'elder'::text,
    COALESCE(e.elder_kills, 0)::int,
    t.win
  FROM teams t
  JOIN matchs m ON m.id = t.match_id
  LEFT JOIN elder_by_team e ON e.match_id = t.match_id AND e.team_id = t.id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT
    team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region),
    'tower'::text,
    COALESCE(t.tower_kills, 0)::int,
    t.win
  FROM teams t
  JOIN matchs m ON m.id = t.match_id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT
    team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region),
    'inhibitor'::text,
    COALESCE(t.inhibitor_kills, 0)::int,
    t.win
  FROM teams t
  JOIN matchs m ON m.id = t.match_id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT
    team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region),
    'riftHerald'::text,
    COALESCE(t.rift_herald_kills, 0)::int,
    t.win
  FROM teams t
  JOIN matchs m ON m.id = t.match_id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT
    team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region),
    'horde'::text,
    COALESCE(t.horde_kills, 0)::int,
    t.win
  FROM teams t
  JOIN matchs m ON m.id = t.match_id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
)
SELECT
  team_stat_id,
  objective_key,
  objective_bucket,
  SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM objective_buckets
GROUP BY team_stat_id, objective_key, objective_bucket
WITH NO DATA;

CREATE UNIQUE INDEX ON mv_team_bucket (team_stat_id, objective_key, objective_bucket);
