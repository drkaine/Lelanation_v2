-- Rebuild materialized views to aggregate from ingest_matchs / ingest_teams / ingest_match_players.
-- Native lean rows use top-level JSON keys; migrated legacy rows nest Prisma-shaped objects under core|visions|...
CREATE OR REPLACE FUNCTION ingest_mv_int2(s jsonb, top_key text, nest_key text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT LEAST(
    COALESCE(
      (NULLIF(trim(s ->> top_key), ''))::numeric,
      (NULLIF(trim(s -> nest_key ->> top_key), ''))::numeric,
      0
    )::bigint,
    2147483647
  )::int;
$$;

CREATE OR REPLACE FUNCTION ingest_mv_bool(s jsonb, nest_key text, field_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE((s -> nest_key ->> field_key) = 'true' OR (s -> nest_key ->> field_key) = 't', false);
$$;

CREATE OR REPLACE FUNCTION ingest_mv_bool_top_or_objectives(s jsonb, k text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT (
    COALESCE((s ->> k), '') IN ('true', 't', '1', 'True')
    OR COALESCE((s -> 'objectives' ->> k), '') IN ('true', 't', '1', 'True')
  );
$$;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_starter_set_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_summoner_spell_pair_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_side_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_match_outcome_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_team_bucket;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_bans_by_banner;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_bucket;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_summoner_spells;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_spell_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_item_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_runes_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_shard_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_runes_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_shard_solo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_challenge_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_matchup_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_combat_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_vision_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_objectif_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_first_objectif_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_botlane_duo_vs_duo_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_duo_role_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_team_core_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_vs_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_core_stats;

CREATE MATERIALIZED VIEW mv_champion_core_stats AS
WITH base AS (
  SELECT
    imp.champion_id,
    COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier) AS rank_tier,
    ''::text AS rank_division,
    m.game_version,
    imp.role,
    m.region,
    t.win,
    t.team,
    m.game_duration,
    m.game_ended_in_surrender,
    m.game_ended_in_early_surrender,
    t.team_early_surrendered,
    COALESCE(imp.kills, ingest_mv_int2((imp.stats)::jsonb, 'kills', 'core'), 0) AS kills,
    COALESCE(imp.deaths, ingest_mv_int2((imp.stats)::jsonb, 'deaths', 'core'), 0) AS deaths,
    COALESCE(imp.assists, ingest_mv_int2((imp.stats)::jsonb, 'assists', 'core'), 0) AS assists,
    ingest_mv_int2((imp.stats)::jsonb, 'champLevel', 'core') AS champ_level,
    ingest_mv_int2((imp.stats)::jsonb, 'champExperience', 'core') AS champ_experience,
    ingest_mv_int2((imp.stats)::jsonb, 'goldEarned', 'core') AS gold_earned,
    ingest_mv_int2((imp.stats)::jsonb, 'goldSpent', 'core') AS gold_spent,
    ingest_mv_int2((imp.stats)::jsonb, 'totalMinionsKilled', 'core') AS total_minions_killed,
    ingest_mv_int2((imp.stats)::jsonb, 'consumablesPurchased', 'core') AS consumables_purchased,
    ingest_mv_int2((imp.stats)::jsonb, 'itemsPurchased', 'core') AS items_purchased
  FROM ingest_match_players imp
  JOIN ingest_matchs m ON m.id = imp.match_id
  JOIN ingest_teams t ON t.id = imp.team_id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
),
ban_counts AS (
  SELECT
    COALESCE((ban.elem->>'championId')::int, (ban.elem->>'champion_id')::int) AS champion_id,
    m.rank_tier,
    ''::text AS rank_division,
    m.game_version,
    m.region,
    COUNT(*)::int AS cnt
  FROM ingest_teams t
  JOIN ingest_matchs m ON m.id = t.match_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(t.bans_json) = 'array' THEN t.bans_json ELSE '[]'::jsonb END
  ) AS ban(elem)
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  GROUP BY 1, m.rank_tier, m.game_version, m.region
)
SELECT
  core_stat_id(b.champion_id, b.rank_tier, ''::text, b.game_version, b.role, b.region) AS id,
  b.champion_id,
  b.rank_tier,
  b.rank_division,
  b.game_version,
  b.role,
  b.region,
  SUM(CASE WHEN b.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(b.game_duration)::bigint AS sum_game_duration,
  SUM(CASE WHEN b.team = 100 THEN 1 ELSE 0 END)::int AS count_team_100,
  SUM(CASE WHEN b.team = 200 THEN 1 ELSE 0 END)::int AS count_team_200,
  SUM(CASE WHEN b.game_ended_in_surrender THEN 1 ELSE 0 END)::int AS count_game_ended_in_surrender,
  SUM(CASE WHEN b.game_ended_in_early_surrender THEN 1 ELSE 0 END)::int AS count_game_ended_in_early_surrender,
  SUM(CASE WHEN b.team_early_surrendered THEN 1 ELSE 0 END)::int AS count_team_early_surrendered,
  COALESCE(MAX(bc.cnt), 0)::int AS count_ban,
  SUM(COALESCE(b.kills, 0))::bigint AS sum_kills,
  SUM(COALESCE(b.deaths, 0))::bigint AS sum_deaths,
  SUM(COALESCE(b.assists, 0))::bigint AS sum_assists,
  SUM(COALESCE(b.champ_level, 0))::bigint AS sum_champ_level,
  SUM(COALESCE(b.champ_experience, 0))::bigint AS sum_champ_experience,
  SUM(COALESCE(b.gold_earned, 0))::bigint AS sum_gold_earned,
  SUM(COALESCE(b.gold_spent, 0))::bigint AS sum_gold_spent,
  SUM(COALESCE(b.total_minions_killed, 0))::bigint AS sum_total_minions_killed,
  SUM(COALESCE(b.consumables_purchased, 0))::bigint AS sum_consumables_purchased,
  SUM(COALESCE(b.items_purchased, 0))::bigint AS sum_items_purchased
FROM base b
LEFT JOIN ban_counts bc ON bc.champion_id = b.champion_id
  AND bc.rank_tier = b.rank_tier
  AND bc.game_version = b.game_version AND bc.region = b.region
GROUP BY b.champion_id, b.rank_tier, b.rank_division, b.game_version, b.role, b.region
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_core_stats (id);
CREATE UNIQUE INDEX ON mv_champion_core_stats (champion_id, rank_tier, rank_division, game_version, role, region);


CREATE MATERIALIZED VIEW mv_champion_vs_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_stat_id,
  opp.champion_id AS opponent_champion_id,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  imp.role,
  COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier) AS rank_tier,
  m.game_version,
  m.region
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
JOIN ingest_match_players opp ON opp.match_id = imp.match_id AND opp.team_id != imp.team_id AND opp.role = imp.role
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region, opp.champion_id
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_vs_stats (champion_stat_id, opponent_champion_id);


CREATE MATERIALIZED VIEW mv_champion_duo_role_stats AS
SELECT
  core_stat_id(
    imp.champion_id,
    COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier),
    ''::text,
    m.game_version,
    imp.role,
    m.region
  ) AS champion_stat_id,
  ally.champion_id AS ally_champion_id,
  ally.role AS ally_role,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
JOIN ingest_match_players ally
  ON ally.match_id = imp.match_id AND ally.team_id = imp.team_id AND ally.id != imp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY
  core_stat_id(
    imp.champion_id,
    COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier),
    ''::text,
    m.game_version,
    imp.role,
    m.region
  ),
  ally.champion_id,
  ally.role;
CREATE UNIQUE INDEX ON mv_champion_duo_role_stats (champion_stat_id, ally_champion_id, ally_role);


CREATE MATERIALIZED VIEW mv_botlane_duo_vs_duo_stats AS
WITH botlane_duos AS (
  SELECT
    m.id AS match_id,
    m.region,
    m.game_version,
    m.rank_tier,
    t.id AS team_id,
    t.win AS team_win,
    MAX(CASE WHEN upper(imp.role) IN ('BOTTOM', 'ADC') THEN imp.champion_id END) AS adc_id,
    MAX(CASE WHEN upper(imp.role) = 'SUPPORT' THEN imp.champion_id END) AS support_id
  FROM ingest_matchs m
  JOIN ingest_teams t ON t.match_id = m.id
  JOIN ingest_match_players imp ON imp.match_id = m.id AND imp.team_id = t.id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  GROUP BY m.id, m.region, m.game_version, m.rank_tier, t.id, t.win
  HAVING
    COUNT(*) FILTER (WHERE upper(imp.role) IN ('BOTTOM', 'ADC')) = 1
    AND COUNT(*) FILTER (WHERE upper(imp.role) = 'SUPPORT') = 1
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
  JOIN botlane_duos b ON b.match_id = a.match_id AND b.team_id != a.team_id
  WHERE a.adc_id IS NOT NULL AND a.support_id IS NOT NULL AND b.adc_id IS NOT NULL AND b.support_id IS NOT NULL
)
SELECT
  adc_id, support_id, opp_adc_id, opp_support_id, rank_tier, game_version, region,
  SUM(CASE WHEN team_win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM duo_vs_duo
GROUP BY adc_id, support_id, opp_adc_id, opp_support_id, rank_tier, game_version, region
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_botlane_duo_vs_duo_stats (
  adc_id, support_id, opp_adc_id, opp_support_id, rank_tier, game_version, region
);


CREATE MATERIALIZED VIEW mv_team_core_stats AS
WITH
team_drake_stats AS (
  SELECT
    it.match_id,
    it.id AS team_id,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('EARTH_DRAGON', 'MOUNTAIN_DRAGON') THEN 1 ELSE 0 END)::int AS count_earth_drake,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('WATER_DRAGON', 'OCEAN_DRAGON') THEN 1 ELSE 0 END)::int AS count_water_drake,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('AIR_DRAGON', 'WIND_DRAGON', 'CLOUD_DRAGON') THEN 1 ELSE 0 END)::int AS count_wind_drake,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('FIRE_DRAGON', 'INFERNAL_DRAGON') THEN 1 ELSE 0 END)::int AS count_fire_drake,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('HEXTECH_DRAGON', 'HEXTEC_DRAGON') THEN 1 ELSE 0 END)::int AS count_hextec_drake,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('CHEMTECH_DRAGON', 'CHEM_DRAGON') THEN 1 ELSE 0 END)::int AS count_chem_drake,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('MOUNTAIN', 'EARTH_DRAGON', 'MOUNTAIN_DRAGON', 'EARTH_DRAGON_SOUL', 'MOUNTAIN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_earth_drake_soul,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('OCEAN', 'WATER_DRAGON', 'OCEAN_DRAGON', 'WATER_DRAGON_SOUL', 'OCEAN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_water_drake_soul,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('CLOUD', 'AIR_DRAGON', 'WIND_DRAGON', 'CLOUD_DRAGON', 'AIR_DRAGON_SOUL', 'WIND_DRAGON_SOUL', 'CLOUD_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_wind_drake_soul,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('INFERNAL', 'FIRE_DRAGON', 'INFERNAL_DRAGON', 'FIRE_DRAGON_SOUL', 'INFERNAL_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_fire_drake_soul,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('HEXTECH', 'HEXTECH_DRAGON', 'HEXTEC_DRAGON', 'HEXTECH_DRAGON_SOUL', 'HEXTEC_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_hextec_drake_soul,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('CHEMTECH', 'CHEMTECH_DRAGON', 'CHEM_DRAGON', 'CHEMTECH_DRAGON_SOUL', 'CHEM_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_chem_drake_soul,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) = 'ELDER_DRAGON' OR lower(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) = 'elder' THEN 1 ELSE 0 END)::int AS sum_elder_dragon_kills
  FROM ingest_teams it
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(it.drakes_json) = 'array' THEN it.drakes_json ELSE '[]'::jsonb END
  ) AS elem
  GROUP BY it.match_id, it.id
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
  SUM(COALESCE(ds.sum_elder_dragon_kills, 0) + COALESCE(t.elder_kills, 0))::int AS sum_elder_kills,
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
FROM ingest_matchs m
JOIN ingest_teams t ON t.match_id = m.id
LEFT JOIN team_drake_stats ds ON ds.match_id = t.match_id AND ds.team_id = t.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY t.team, m.rank_tier, m.game_version, m.region
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_team_core_stats (id);
CREATE UNIQUE INDEX ON mv_team_core_stats (team, rank_tier, rank_division, game_version, region);


CREATE MATERIALIZED VIEW mv_champion_first_objectif_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_core_stat_id,
  SUM(CASE WHEN t.baron_first THEN 1 ELSE 0 END)::int AS count_baron_first,
  SUM(CASE WHEN t.dragon_first THEN 1 ELSE 0 END)::int AS count_dragon_first,
  SUM(CASE WHEN t.tower_first THEN 1 ELSE 0 END)::int AS count_tower_first,
  SUM(CASE WHEN t.horde_first THEN 1 ELSE 0 END)::int AS count_horde_first,
  SUM(CASE WHEN t.rift_herald_first THEN 1 ELSE 0 END)::int AS count_rift_herald_first,
  SUM(CASE WHEN t.first_blood THEN 1 ELSE 0 END)::int AS count_first_blood,
  SUM(CASE WHEN ingest_mv_bool_top_or_objectives((imp.stats)::jsonb, 'firstBloodKill') THEN 1 ELSE 0 END)::int AS count_first_blood_kill,
  SUM(CASE WHEN ingest_mv_bool_top_or_objectives((imp.stats)::jsonb, 'firstBloodAssist') THEN 1 ELSE 0 END)::int AS count_first_blood_assist,
  SUM(CASE WHEN ingest_mv_bool_top_or_objectives((imp.stats)::jsonb, 'firstTowerKill') THEN 1 ELSE 0 END)::int AS count_first_tower_kill,
  SUM(CASE WHEN ingest_mv_bool_top_or_objectives((imp.stats)::jsonb, 'firstTowerAssist') THEN 1 ELSE 0 END)::int AS count_first_tower_assist
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_first_objectif_stats (champion_core_stat_id);


CREATE MATERIALIZED VIEW mv_champion_objectif_stats AS
WITH
team_drake_stats AS (
  SELECT
    it.match_id,
    it.id AS team_id,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('EARTH_DRAGON', 'MOUNTAIN_DRAGON') THEN 1 ELSE 0 END)::int AS count_earth_drake,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('WATER_DRAGON', 'OCEAN_DRAGON') THEN 1 ELSE 0 END)::int AS count_water_drake,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('AIR_DRAGON', 'WIND_DRAGON', 'CLOUD_DRAGON') THEN 1 ELSE 0 END)::int AS count_wind_drake,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('FIRE_DRAGON', 'INFERNAL_DRAGON') THEN 1 ELSE 0 END)::int AS count_fire_drake,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('HEXTECH_DRAGON', 'HEXTEC_DRAGON') THEN 1 ELSE 0 END)::int AS count_hextec_drake,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) IN ('CHEMTECH_DRAGON', 'CHEM_DRAGON') THEN 1 ELSE 0 END)::int AS count_chem_drake,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('MOUNTAIN', 'EARTH_DRAGON', 'MOUNTAIN_DRAGON', 'EARTH_DRAGON_SOUL', 'MOUNTAIN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_earth_drake_soul,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('OCEAN', 'WATER_DRAGON', 'OCEAN_DRAGON', 'WATER_DRAGON_SOUL', 'OCEAN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_water_drake_soul,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('CLOUD', 'AIR_DRAGON', 'WIND_DRAGON', 'CLOUD_DRAGON', 'AIR_DRAGON_SOUL', 'WIND_DRAGON_SOUL', 'CLOUD_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_wind_drake_soul,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('INFERNAL', 'FIRE_DRAGON', 'INFERNAL_DRAGON', 'FIRE_DRAGON_SOUL', 'INFERNAL_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_fire_drake_soul,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('HEXTECH', 'HEXTECH_DRAGON', 'HEXTEC_DRAGON', 'HEXTECH_DRAGON_SOUL', 'HEXTEC_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_hextec_drake_soul,
    MAX(CASE WHEN upper(trim(COALESCE(elem->>'soul', ''))) IN ('CHEMTECH', 'CHEMTECH_DRAGON', 'CHEM_DRAGON', 'CHEMTECH_DRAGON_SOUL', 'CHEM_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_chem_drake_soul,
    SUM(CASE WHEN upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) = 'ELDER_DRAGON' OR lower(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) = 'elder' THEN 1 ELSE 0 END)::int AS sum_elder_dragon_kills
  FROM ingest_teams it
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(it.drakes_json) = 'array' THEN it.drakes_json ELSE '[]'::jsonb END
  ) AS elem
  GROUP BY it.match_id, it.id
)
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_core_stat_id,
  0::int AS sum_baron_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'dragonKills', 'objectives'))::int AS sum_dragon_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'turretKills', 'objectives'))::int AS sum_turret_kills,
  0::int AS sum_horde_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'riftHeraldTakedowns', 'objectives'))::int AS count_rift_herald_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'inhibitorKills', 'objectives'))::int AS sum_inhibitor_kills,
  0::int AS sum_champion_kills,
  SUM(COALESCE(ds.sum_elder_dragon_kills, 0))::int AS sum_elder_kills,
  SUM(COALESCE(ds.sum_elder_dragon_kills, 0))::int AS sum_elder_dragon_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'inhibitorTakedowns', 'objectives'))::int AS sum_inhibitor_takedowns,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'inhibitorsLost', 'objectives'))::int AS sum_inhibitors_lost,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'objectivesStolen', 'objectives'))::int AS sum_objectives_stolen,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'objectivesStolenAssists', 'objectives'))::int AS sum_objectives_stolen_assists,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'turretTakedowns', 'objectives'))::int AS sum_turret_takedowns,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'turretsLost', 'objectives'))::int AS sum_turrets_lost,
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
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'dragonTakedowns', 'objectives'))::int AS sum_dragon_takedowns,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'earliestBaron', 'objectives'))::int AS sum_earliest_baron,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'elderDragonKillsWithOpposingSoul', 'objectives'))::int AS sum_elder_dragon_kills_with_opposing_soul,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'elderDragonMultikills', 'objectives'))::int AS sum_elder_dragon_multikills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'epicMonsterKillsNearEnemyJungler', 'objectives'))::int AS sum_epic_monster_kills_near_enemy_jungler,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'epicMonsterKillsWithin30SecondsOfSpawn', 'objectives'))::int AS sum_epic_monster_kills_within_30_seconds_of_spawn,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'epicMonsterSteals', 'objectives'))::int AS sum_epic_monster_steals,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'epicMonsterStolenWithoutSmite', 'objectives'))::int AS sum_epic_monster_stolen_without_smite,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'firstTurretKilledTime', 'objectives'))::int AS sum_first_turret_killed_time,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'multiTurretRiftHeraldCount', 'objectives'))::int AS sum_multi_turret_rift_herald_count,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'quickFirstTurret', 'objectives'))::int AS sum_quick_first_turret,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'riftHeraldTakedowns', 'objectives'))::int AS sum_rift_herald_takedowns,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'soloBaronKills', 'objectives'))::int AS sum_solo_baron_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'soloTurretsLategame', 'objectives'))::int AS sum_solo_turrets_lategame,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'takedownOnFirstTurret', 'objectives'))::int AS sum_takedown_on_first_turret,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'turretsTakenWithRiftHerald', 'objectives'))::int AS sum_turrets_taken_with_rift_herald
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
LEFT JOIN team_drake_stats ds ON ds.match_id = imp.match_id AND ds.team_id = imp.team_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_objectif_stats (champion_core_stat_id);


CREATE MATERIALIZED VIEW mv_champion_vision_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_core_stat_id,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'detectorWardsPlaced', 'visions'))::int AS sum_detector_wards_placed,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'visionScore', 'visions'))::int AS sum_vision_score,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'visionWardsBoughtInGame', 'visions'))::int AS sum_vision_wards_bought_in_game,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'wardsKilled', 'visions'))::int AS sum_wards_killed,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'wardsPlaced', 'visions'))::int AS sum_wards_placed,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'controlWardsPlaced', 'visions'))::int AS sum_control_wards_placed,
  0::int AS sum_stealth_wards_placed,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'unseenRecalls', 'visions'))::int AS sum_unseen_recalls,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'visionScoreAdvantageLaneOpponent', 'visions'))::int AS sum_vision_score_advantage_lane_opponent,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'wardTakedowns', 'visions'))::int AS sum_ward_takedowns,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'wardTakedownsBefore20M', 'visions'))::int AS sum_ward_takedowns_before_20_m,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'wardsGuarded', 'visions'))::int AS sum_wards_guarded
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_vision_stats (champion_core_stat_id);


CREATE MATERIALIZED VIEW mv_champion_combat_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_core_stat_id,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'damageDealtToBuildings', 'combats'))::int AS sum_damage_dealt_to_buildings,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'damageDealtToEpicMonsters', 'combats'))::int AS sum_damage_dealt_to_epic_monsters,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'damageDealtToObjectives', 'combats'))::int AS sum_damage_dealt_to_objectives,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'damageDealtToTurrets', 'combats'))::int AS sum_damage_dealt_to_turrets,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'damageSelfMitigated', 'combats'))::int AS sum_damage_self_mitigated,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'doubleKills', 'combats'))::int AS sum_double_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'killingSprees', 'combats'))::int AS sum_killing_sprees,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'largestCriticalStrike', 'combats'))::int AS sum_largest_critical_strike,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'largestKillingSpree', 'combats'))::int AS sum_largest_killing_spree,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'longestTimeSpentLiving', 'combats'))::int AS sum_longest_time_spent_living,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'magicDamageDealt', 'combats'))::int AS sum_magic_damage_dealt,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'magicDamageDealtToChampions', 'combats'))::int AS sum_magic_damage_dealt_to_champions,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'magicDamageTaken', 'combats'))::int AS sum_magic_damage_taken,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'pentaKills', 'combats'))::int AS sum_penta_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'physicalDamageDealt', 'combats'))::int AS sum_physical_damage_dealt,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'physicalDamageDealtToChampions', 'combats'))::int AS sum_physical_damage_dealt_to_champions,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'physicalDamageTaken', 'combats'))::int AS sum_physical_damage_taken,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'quadraKills', 'combats'))::int AS sum_quadra_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'timeCcingOthers', 'combats'))::int AS sum_time_ccing_others,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'totalDamageShieldedOnTeammates', 'combats'))::int AS sum_total_damage_shielded_on_teammates,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'totalDamageTaken', 'combats'))::int AS sum_total_damage_taken,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'totalHeal', 'combats'))::int AS sum_total_heal,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'totalHealsOnTeammates', 'combats'))::int AS sum_total_heals_on_teammates,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'totalTimeCcDealt', 'combats'))::int AS sum_total_time_cc_dealt,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'totalUnitsHealed', 'combats'))::int AS sum_total_units_healed,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'tripleKills', 'combats'))::int AS sum_triple_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'trueDamageDealt', 'combats'))::int AS sum_true_damage_dealt,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'trueDamageDealtToChampions', 'combats'))::int AS sum_true_damage_dealt_to_champions,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'trueDamageTaken', 'combats'))::int AS sum_true_damage_taken,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'effectiveHealAndShielding', 'combats'))::int AS sum_effective_heal_and_shielding,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'enemyChampionImmobilizations', 'combats'))::int AS sum_immobilize_and_kill_with_ally,
  0::int AS sum_outnumbered_kills
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_combat_stats (champion_core_stat_id);


CREATE MATERIALIZED VIEW mv_champion_matchup_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_core_stat_id,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'totalEnemyJungleMinionsKilled', 'matchup'))::int AS sum_total_enemy_jungle_minions_killed,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'neutralMinionsKilled', 'matchup'))::int AS sum_neutral_minions_killed,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'totalAllyJungleMinionsKilled', 'matchup'))::int AS sum_total_ally_jungle_minions_killed,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'bountyGold', 'matchup'))::int AS sum_bounty_gold,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'completeSupportQuestInTime', 'matchup'))::int AS sum_complete_support_quest_in_time,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'deathsByEnemyChamps', 'matchup'))::int AS sum_deaths_by_enemy_champs,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'earlyLaningPhaseGoldExpAdvantage', 'matchup'))::int AS sum_early_laning_phase_gold_exp_advantage,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'initialCrabCount', 'matchup'))::int AS sum_initial_crab_count,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'jungleCsBefore10Minutes', 'matchup'))::int AS sum_jungle_cs_before_10_minutes,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'killsNearEnemyTurret', 'matchup'))::int AS sum_kills_near_enemy_turret,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'killsOnOtherLanesEarlyJungleAsLaner', 'matchup'))::int AS sum_kills_on_other_lanes_early_jungle_as_laner,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'killsUnderOwnTurret', 'matchup'))::int AS sum_kills_under_own_turret,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'landSkillShotsEarlyGame', 'matchup'))::int AS sum_land_skill_shots_early_game,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'laneMinionsFirst10Minutes', 'matchup'))::int AS sum_lane_minions_first_10_minutes,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'laningPhaseGoldExpAdvantage', 'matchup'))::int AS sum_laning_phase_gold_exp_advantage,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'maxCsAdvantageOnLaneOpponent', 'matchup'))::int AS sum_max_cs_advantage_on_lane_opponent,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'maxKillDeficit', 'matchup'))::int AS sum_max_kill_deficit,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'maxLevelLeadLaneOpponent', 'matchup'))::int AS sum_max_level_lead_lane_opponent,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'moreEnemyJungleThanOpponent', 'matchup'))::int AS sum_more_enemy_jungle_than_opponent,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'turretPlatesTaken', 'objectives'))::int AS sum_turret_plates_taken,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'takedownsAfterGainingLevelAdvantage', 'matchup'))::int AS sum_takedowns_after_gaining_level_advantage
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_matchup_stats (champion_core_stat_id);


CREATE MATERIALIZED VIEW mv_champion_challenge_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_core_stat_id,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'healFromMapSources', 'challenges'))::int AS sum_heal_from_map_sources,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'baronTakedowns', 'objectives'))::int AS sum_baron_takedowns,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'buffsStolen', 'challenges'))::int AS sum_buffs_stolen,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'dodgeSkillShotsSmallWindow', 'challenges'))::int AS sum_dodge_skill_shots_small_window,
  0::int AS sum_get_takedowns_in_all_lanes_early_jungle_as_laner,
  SUM(CASE WHEN ingest_mv_int2((imp.stats)::jsonb, 'hadOpenNexus', 'challenges') != 0 THEN 1 ELSE 0 END)::int AS count_had_open_nexus,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'junglerTakedownsNearDamagedEpicMonster', 'challenges'))::int AS sum_jungler_takedowns_near_damaged_epic_monster,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'killAfterHiddenWithAlly', 'challenges'))::int AS sum_kill_after_hidden_with_ally,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'killedChampTookFullTeamDamageSurvived', 'challenges'))::int AS sum_killed_champ_took_full_team_damage_survived,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'killsWithHelpFromEpicMonster', 'challenges'))::int AS sum_kills_with_help_from_epic_monster,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'knockEnemyIntoTeamAndKill', 'challenges'))::int AS sum_knock_enemy_into_team_and_kill,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'mejaisFullStackInTime', 'challenges'))::int AS sum_mejais_full_stack_in_time,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'multikillsAfterAggressiveFlash', 'challenges'))::int AS sum_multikills_after_aggressive_flash,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'quickCleanse', 'challenges'))::int AS sum_quick_cleanse,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'quickSoloKills', 'matchup'))::int AS sum_quick_solo_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'saveAllyFromDeath', 'challenges'))::int AS sum_save_ally_from_death,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'scuttleCrabKills', 'challenges'))::int AS sum_scuttle_crab_kills,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'skillshotsDodged', 'challenges'))::int AS sum_skillshots_dodged,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'skillshotsHit', 'challenges'))::int AS sum_skillshots_hit,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'survivedSingleDigitHpCount', 'challenges'))::int AS sum_survived_single_digit_hp_count,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'survivedThreeImmobilizesInFight', 'challenges'))::int AS sum_survived_three_immobilizes_in_fight,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'takedownsBeforeJungleMinionSpawn', 'challenges'))::int AS sum_takedowns_before_jungle_minion_spawn,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'takedownsInAlcove', 'challenges'))::int AS sum_takedowns_in_alcove,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'takedownsInEnemyFountain', 'challenges'))::int AS sum_takedowns_in_enemy_fountain,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'tookLargeDamageSurvived', 'challenges'))::int AS sum_took_large_damage_survived
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_challenge_stats (champion_core_stat_id);


CREATE MATERIALIZED VIEW mv_champion_shard_solo_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_stat_id,
  s.shard_id,
  (s.slot - 1)::int AS slot,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
JOIN LATERAL unnest(COALESCE(imp.shards, ARRAY[]::int[])) WITH ORDINALITY AS s(shard_id, slot) ON TRUE
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region, s.shard_id, (s.slot - 1)
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_shard_solo_stats (champion_stat_id, shard_id, slot);


CREATE MATERIALIZED VIEW mv_champion_runes_solo_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_stat_id,
  r.perk_id,
  0::int AS style,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
JOIN LATERAL unnest(COALESCE(imp.runes, ARRAY[]::int[])) AS r(perk_id) ON TRUE
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region, r.perk_id
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_runes_solo_stats (champion_stat_id, perk_id, style);


CREATE MATERIALIZED VIEW mv_champion_shard_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_stat_id,
  COALESCE(array_to_string(imp.shards, ','), '') AS shard_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region, COALESCE(array_to_string(imp.shards, ','), '')
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_shard_stats (champion_stat_id, shard_list);


CREATE MATERIALIZED VIEW mv_champion_runes_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_stat_id,
  COALESCE('[' || array_to_string(imp.runes, ',') || ']', '[]') AS rune_list,
  COALESCE(array_to_string(imp.shards, ','), '') AS shard_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY
  imp.champion_id,
  COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier),
  m.game_version,
  imp.role,
  m.region,
  COALESCE('[' || array_to_string(imp.runes, ',') || ']', '[]'),
  COALESCE(array_to_string(imp.shards, ','), '')
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_runes_stats (champion_stat_id, rune_list, shard_list);


CREATE MATERIALIZED VIEW mv_champion_item_solo_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_stat_id,
  ((i.elem ->> 'itemId')::int) AS item_id,
  SUM(CASE WHEN COALESCE((i.elem ->> 'starter')::boolean, false) THEN 1 ELSE 0 END)::int AS count_starter,
  SUM(CASE WHEN COALESCE((i.elem ->> 'core')::boolean, false) THEN 1 ELSE 0 END)::int AS count_core,
  SUM(
    CASE
      WHEN NOT COALESCE((i.elem ->> 'starter')::boolean, false)
        AND NOT COALESCE((i.elem ->> 'core')::boolean, false)
      THEN 1 ELSE 0 END
  )::int AS count_final,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  LEAST(SUM(COALESCE((i.elem ->> 'timestampMs')::bigint, 0)), 2147483647::bigint)::int AS sum_timestamp_ms
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
JOIN LATERAL jsonb_array_elements(COALESCE(imp.items::jsonb, '[]'::jsonb)) AS i(elem)
  ON COALESCE((i.elem ->> 'order')::int, -1) < 6
 AND COALESCE((i.elem ->> 'itemId')::int, 0) > 0
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region, ((i.elem ->> 'itemId')::int)
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_item_solo_stats (champion_stat_id, item_id);


CREATE MATERIALIZED VIEW mv_champion_item_stats AS
WITH item_lists AS (
  SELECT
    imp.id AS match_player_id,
    COALESCE(
      '[' || string_agg((i.elem ->> 'itemId'), ',' ORDER BY COALESCE((i.elem ->> 'order')::int, 0)) || ']',
      '[]'
    ) AS item_list,
    LEAST(
      COALESCE(SUM(COALESCE((i.elem ->> 'timestampMs')::bigint, 0)), 0),
      2147483647::bigint
    )::int AS ts
  FROM ingest_match_players imp
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(imp.items::jsonb, '[]'::jsonb)) AS i(elem)
    ON COALESCE((i.elem ->> 'order')::int, -1) < 6
   AND COALESCE((i.elem ->> 'itemId')::int, 0) > 0
  GROUP BY imp.id
)
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_stat_id,
  COALESCE(il.item_list, '[]') AS item_list,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  LEAST(SUM(COALESCE(il.ts, 0)::bigint), 2147483647::bigint)::int AS sum_timestamp_ms
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
LEFT JOIN item_lists il ON il.match_player_id = imp.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region, COALESCE(il.item_list, '[]')
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_item_stats (champion_stat_id, item_list);


CREATE MATERIALIZED VIEW mv_champion_spell_solo_stats AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_stat_id,
  so.spell_slot,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  MIN(so.first_up_order)::int AS first_up_order,
  MAX(so.max_order)::int AS max_order
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
JOIN LATERAL (
  SELECT
    (e.spell_slot_text)::int AS spell_slot,
    MIN(e.ord)::int AS first_up_order,
    MAX(e.ord)::int AS max_order
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(imp.skill_order) = 'array' THEN imp.skill_order ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS e(spell_slot_text, ord)
  WHERE e.spell_slot_text ~ '^[0-9]+$'
  GROUP BY (e.spell_slot_text)::int
) so ON TRUE
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region, so.spell_slot
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_spell_solo_stats (champion_stat_id, spell_slot);


CREATE MATERIALIZED VIEW mv_champion_summoner_spells AS
WITH spells_per_player AS (
  SELECT
    core_stat_id(
      imp.champion_id,
      COALESCE(NULLIF(TRIM(imp.rank_tier), ''), m.rank_tier),
      ''::text,
      m.game_version,
      imp.role,
      m.region
    ) AS champion_stat_id,
    t.win,
    imp.summoner_spells[1]::int AS spell_d,
    imp.summoner_spells[2]::int AS spell_f
  FROM ingest_match_players imp
  INNER JOIN ingest_teams t ON t.id = imp.team_id
  INNER JOIN ingest_matchs m ON m.id = imp.match_id
  WHERE cardinality(imp.summoner_spells) >= 2
    AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
),
spell_rows AS (
  SELECT champion_stat_id, win, spell_d AS spell_id, 1::int AS slot0, 0::int AS slot1 FROM spells_per_player
  UNION ALL
  SELECT champion_stat_id, win, spell_f AS spell_id, 0::int AS slot0, 1::int AS slot1 FROM spells_per_player
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
CREATE UNIQUE INDEX mv_champion_summoner_spells_uidx ON mv_champion_summoner_spells (champion_stat_id, spell_id);


CREATE MATERIALIZED VIEW mv_champion_bucket AS
SELECT
  core_stat_id(imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), ''::text, m.game_version, imp.role, m.region) AS champion_stat_id,
  COALESCE((b.elem->>'durationBucket')::int, (b.elem->>'duration_bucket')::int) AS duration_bucket,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game,
  SUM(COALESCE((b.elem->>'currentGold')::int, (b.elem->>'current_gold')::int, 0))::int AS sum_current_gold,
  SUM(COALESCE((b.elem->>'magicDamageDone')::int, (b.elem->>'magic_damage_done')::int, 0))::int AS sum_magic_damage_done,
  SUM(COALESCE((b.elem->>'magicDamageDoneToChampion')::int, (b.elem->>'magic_damage_done_to_champion')::int, 0))::int AS sum_magic_damage_done_to_champion,
  SUM(COALESCE((b.elem->>'magicDamageTaken')::int, (b.elem->>'magic_damage_taken')::int, 0))::int AS sum_magic_damage_taken,
  SUM(COALESCE((b.elem->>'physicalDamageDone')::int, (b.elem->>'physical_damage_done')::int, 0))::int AS sum_physical_damage_done,
  SUM(COALESCE((b.elem->>'physicalDamageDoneToChampion')::int, (b.elem->>'physical_damage_done_to_champion')::int, 0))::int AS sum_physical_damage_done_to_champion,
  SUM(COALESCE((b.elem->>'physicalDamageTaken')::int, (b.elem->>'physical_damage_taken')::int, 0))::int AS sum_physical_damage_taken,
  SUM(COALESCE((b.elem->>'totalDamageDone')::int, (b.elem->>'total_damage_done')::int, 0))::int AS sum_total_damage_done,
  SUM(COALESCE((b.elem->>'totalDamageDoneToChampion')::int, (b.elem->>'total_damage_done_to_champion')::int, 0))::int AS sum_total_damage_done_to_champion,
  SUM(COALESCE((b.elem->>'totalDamageTaken')::int, (b.elem->>'total_damage_taken')::int, 0))::int AS sum_total_damage_taken,
  SUM(COALESCE((b.elem->>'trueDamageDone')::int, (b.elem->>'true_damage_done')::int, 0))::int AS sum_true_damage_done,
  SUM(COALESCE((b.elem->>'trueDamageDoneToChampion')::int, (b.elem->>'true_damage_done_to_champion')::int, 0))::int AS sum_true_damage_done_to_champion,
  SUM(COALESCE((b.elem->>'trueDamageTaken')::int, (b.elem->>'true_damage_taken')::int, 0))::int AS sum_true_damage_taken,
  SUM(COALESCE((b.elem->>'goldPerSecond')::int, (b.elem->>'gold_per_second')::int, 0))::int AS sum_gold_per_second,
  SUM(COALESCE((b.elem->>'jungleMinionsKilled')::int, (b.elem->>'jungle_minions_killed')::int, 0))::int AS sum_jungle_minions_killed,
  SUM(COALESCE((b.elem->>'level')::int, 0))::int AS sum_level,
  SUM(COALESCE((b.elem->>'minionsKilled')::int, (b.elem->>'minions_killed')::int, 0))::int AS sum_minions_killed,
  SUM(COALESCE((b.elem->>'timeEnemySpentControlled')::int, (b.elem->>'time_enemy_spent_controlled')::int, 0))::int AS sum_time_enemy_spent_controlled,
  SUM(COALESCE((b.elem->>'totalGold')::int, (b.elem->>'total_gold')::int, 0))::int AS sum_total_gold,
  SUM(COALESCE((b.elem->>'xp')::int, 0))::int AS sum_xp,
  SUM(
    CASE
      WHEN COALESCE((b.elem->>'durationBucket')::int, (b.elem->>'duration_bucket')::int)
        = ((FLOOR(COALESCE(m.game_duration, 0)::numeric / 60)::int / 5) * 5) THEN 1
      ELSE 0
    END
  )::int AS count_game_finished_at_bucket
FROM ingest_match_players imp
JOIN ingest_matchs m ON m.id = imp.match_id
JOIN ingest_teams t ON t.id = imp.team_id
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof((imp.stats)::jsonb -> 'timelineBuckets') = 'array'
    THEN (imp.stats)::jsonb -> 'timelineBuckets'
    ELSE '[]'::jsonb
  END
) AS b(elem)
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY imp.champion_id, COALESCE(NULLIF(trim(imp.rank_tier), ''), m.rank_tier), m.game_version, imp.role, m.region,
  COALESCE((b.elem->>'durationBucket')::int, (b.elem->>'duration_bucket')::int)
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_champion_bucket (champion_stat_id, duration_bucket);


CREATE MATERIALIZED VIEW mv_champion_bans_by_banner AS
WITH ban_rows AS (
  SELECT
    m.game_version,
    m.rank_tier,
    COALESCE((ban.elem->>'championId')::int, (ban.elem->>'champion_id')::int) AS banned_champion_id,
    t.team AS team_num,
    CASE
      WHEN UPPER(TRIM(COALESCE(x.role_raw, 'UNKNOWN'))) = 'MID' THEN 'MIDDLE'
      WHEN UPPER(TRIM(COALESCE(x.role_raw, 'UNKNOWN'))) = 'ADC' THEN 'BOTTOM'
      WHEN UPPER(TRIM(COALESCE(x.role_raw, 'UNKNOWN'))) IN ('SUPPORT', 'UTILITY') THEN 'SUPPORT'
      ELSE UPPER(TRIM(COALESCE(x.role_raw, 'UNKNOWN')))
    END AS banner_role_norm
  FROM ingest_teams t
  INNER JOIN ingest_matchs m ON m.id = t.match_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(t.bans_json) = 'array' THEN t.bans_json ELSE '[]'::jsonb END
  ) AS ban(elem)
  INNER JOIN LATERAL (
    SELECT slot.role_raw AS role_raw
    FROM (
      SELECT
        imp_slot.role AS role_raw,
        ROW_NUMBER() OVER (ORDER BY imp_slot.participant_id) AS team_slot
      FROM ingest_match_players imp_slot
      WHERE imp_slot.match_id = m.id AND imp_slot.team_id = t.id
    ) slot
    WHERE slot.team_slot = COALESCE((ban.elem->>'pickOrder')::int, (ban.elem->>'pick_order')::int)
  ) x ON true
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
    SELECT game_version FROM active_patches
  )
)
SELECT
  game_version,
  rank_tier,
  banned_champion_id,
  team_num,
  banner_role_norm,
  COUNT(*)::bigint AS ban_count
FROM ban_rows
GROUP BY game_version, rank_tier, banned_champion_id, team_num, banner_role_norm;
CREATE UNIQUE INDEX mv_champion_bans_by_banner_uidx ON mv_champion_bans_by_banner (
  game_version, rank_tier, banned_champion_id, team_num, banner_role_norm
);


CREATE MATERIALIZED VIEW mv_team_bucket AS
WITH elder_by_team AS (
  SELECT
    it.match_id,
    it.id AS team_id,
    (COALESCE(it.elder_kills, 0) + COALESCE((
      SELECT COUNT(*)::int FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(it.drakes_json) = 'array' THEN it.drakes_json ELSE '[]'::jsonb END
      ) elem
      WHERE upper(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) = 'ELDER_DRAGON'
         OR lower(COALESCE(elem->>'drakeType', elem->>'drake_type', '')) = 'elder'
    ), 0))::int AS elder_kills
  FROM ingest_teams it
),
objective_buckets AS (
  SELECT
    team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region) AS team_stat_id,
    'baron'::text AS objective_key,
    COALESCE(t.baron_kills, 0)::int AS objective_bucket,
    t.win
  FROM ingest_teams t
  JOIN ingest_matchs m ON m.id = t.match_id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region), 'dragon'::text, COALESCE(t.dragon_kills, 0)::int, t.win
  FROM ingest_teams t JOIN ingest_matchs m ON m.id = t.match_id WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region), 'elder'::text, COALESCE(e.elder_kills, 0)::int, t.win
  FROM ingest_teams t JOIN ingest_matchs m ON m.id = t.match_id
  LEFT JOIN elder_by_team e ON e.match_id = t.match_id AND e.team_id = t.id
  WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region), 'tower'::text, COALESCE(t.tower_kills, 0)::int, t.win
  FROM ingest_teams t JOIN ingest_matchs m ON m.id = t.match_id WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region), 'inhibitor'::text, COALESCE(t.inhibitor_kills, 0)::int, t.win
  FROM ingest_teams t JOIN ingest_matchs m ON m.id = t.match_id WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region), 'riftHerald'::text, COALESCE(t.rift_herald_kills, 0)::int, t.win
  FROM ingest_teams t JOIN ingest_matchs m ON m.id = t.match_id WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
  UNION ALL
  SELECT team_stat_id(t.team, m.rank_tier, ''::text, m.game_version, m.region), 'horde'::text, COALESCE(t.horde_kills, 0)::int, t.win
  FROM ingest_teams t JOIN ingest_matchs m ON m.id = t.match_id WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
)
SELECT team_stat_id, objective_key, objective_bucket,
  SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS count_win,
  COUNT(*)::int AS count_game
FROM objective_buckets
GROUP BY team_stat_id, objective_key, objective_bucket
WITH NO DATA;
CREATE UNIQUE INDEX ON mv_team_bucket (team_stat_id, objective_key, objective_bucket);


CREATE MATERIALIZED VIEW mv_match_outcome_stats AS
WITH remake_matches AS (
  SELECT imp.match_id
  FROM ingest_match_players imp
  GROUP BY imp.match_id
  HAVING BOOL_OR(
    imp.items IS NULL
    OR jsonb_typeof(imp.items::jsonb) <> 'array'
    OR jsonb_array_length(imp.items::jsonb) = 0
  )
)
SELECT
  m.game_version,
  m.rank_tier,
  COUNT(*)::bigint AS count_match,
  SUM(CASE WHEN m.game_ended_in_early_surrender THEN 1 ELSE 0 END)::bigint AS count_early_surrender,
  SUM(CASE WHEN m.game_ended_in_surrender THEN 1 ELSE 0 END)::bigint AS count_surrender,
  SUM(CASE WHEN rm.match_id IS NOT NULL THEN 1 ELSE 0 END)::bigint AS count_remake
FROM ingest_matchs m
LEFT JOIN remake_matches rm ON rm.match_id = m.id
WHERE (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (
  SELECT game_version FROM active_patches
)
GROUP BY m.game_version, m.rank_tier;
CREATE UNIQUE INDEX mv_match_outcome_stats_uidx ON mv_match_outcome_stats (game_version, rank_tier);


CREATE MATERIALIZED VIEW mv_champion_side_stats AS
SELECT
  m.game_version,
  m.rank_tier,
  COALESCE(NULLIF(UPPER(TRIM(imp.role)), ''), 'UNKNOWN') AS role_norm,
  t.team AS team_num,
  imp.champion_id,
  COUNT(*)::bigint AS count_game,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::bigint AS count_win,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'physicalDamageDealtToChampions', 'combats'))::bigint AS sum_phys_dmg_to_champ,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'magicDamageDealtToChampions', 'combats'))::bigint AS sum_magic_dmg_to_champ,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'trueDamageDealtToChampions', 'combats'))::bigint AS sum_true_dmg_to_champ,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'physicalDamageTaken', 'combats'))::bigint AS sum_phys_dmg_taken,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'magicDamageTaken', 'combats'))::bigint AS sum_magic_dmg_taken,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'trueDamageTaken', 'combats'))::bigint AS sum_true_dmg_taken,
  SUM(ingest_mv_int2((imp.stats)::jsonb, 'totalDamageTaken', 'combats'))::bigint AS sum_total_dmg_taken,
  SUM(COALESCE(imp.kills, ingest_mv_int2((imp.stats)::jsonb, 'kills', 'core'), 0))::bigint AS sum_kills,
  SUM(COALESCE(imp.deaths, ingest_mv_int2((imp.stats)::jsonb, 'deaths', 'core'), 0))::bigint AS sum_deaths,
  SUM(COALESCE(imp.assists, ingest_mv_int2((imp.stats)::jsonb, 'assists', 'core'), 0))::bigint AS sum_assists
FROM ingest_match_players imp
INNER JOIN ingest_teams t ON t.id = imp.team_id
INNER JOIN ingest_matchs m ON m.id = imp.match_id
WHERE t.team IN (100, 200)
  AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY m.game_version, m.rank_tier, role_norm, t.team, imp.champion_id;
CREATE UNIQUE INDEX mv_champion_side_stats_uidx ON mv_champion_side_stats (game_version, rank_tier, role_norm, team_num, champion_id);


CREATE MATERIALIZED VIEW mv_champion_summoner_spell_pair_stats AS
SELECT
  m.game_version,
  m.rank_tier,
  COALESCE(NULLIF(UPPER(TRIM(imp.role)), ''), 'UNKNOWN') AS role_norm,
  imp.champion_id,
  imp.summoner_spells[1]::int AS spell_d,
  imp.summoner_spells[2]::int AS spell_f,
  COUNT(*)::bigint AS count_game,
  SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::bigint AS count_win
FROM ingest_match_players imp
INNER JOIN ingest_teams t ON t.id = imp.team_id
INNER JOIN ingest_matchs m ON m.id = imp.match_id
WHERE cardinality(imp.summoner_spells) >= 2
  AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
GROUP BY m.game_version, m.rank_tier, role_norm, imp.champion_id, imp.summoner_spells[1], imp.summoner_spells[2];
CREATE UNIQUE INDEX mv_champion_spell_pair_stats_uidx ON mv_champion_summoner_spell_pair_stats (game_version, rank_tier, role_norm, champion_id, spell_d, spell_f);


CREATE MATERIALIZED VIEW mv_champion_item_starter_set_stats AS
WITH starter_rows AS (
  SELECT
    m.game_version,
    m.rank_tier,
    COALESCE(NULLIF(UPPER(TRIM(imp.role)), ''), 'UNKNOWN') AS role_norm,
    imp.champion_id,
    t.win,
    COALESCE(
      (
        SELECT '[' || string_agg((e ->> 'itemId')::text, ',' ORDER BY (e ->> 'order')::int, (e ->> 'timestampMs')::bigint) || ']'
        FROM jsonb_array_elements(imp.items::jsonb) AS e
        WHERE COALESCE((e ->> 'starter')::boolean, false)
          AND (e ->> 'itemId')::int NOT IN (
            3340, 3364, 3363, 2055,
            2003, 2009, 2010, 2031, 2032, 2033, 2060, 2138, 2139, 2140
          )
      ),
      '[]'
    ) AS starter_key
  FROM ingest_match_players imp
  INNER JOIN ingest_teams t ON t.id = imp.team_id
  INNER JOIN ingest_matchs m ON m.id = imp.match_id
  WHERE jsonb_typeof(imp.items::jsonb) = 'array'
    AND jsonb_array_length(imp.items::jsonb) > 0
    AND (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2)) IN (SELECT game_version FROM active_patches)
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
CREATE UNIQUE INDEX mv_champion_item_starter_set_stats_uidx ON mv_champion_item_starter_set_stats (game_version, rank_tier, role_norm, champion_id, starter_key);

