-- Drop view that references participants and players
DROP VIEW IF EXISTS players_with_stats;

-- 1) Recreate players with column order: id, game_name, tag_name, puuid, region, puuid_key_version, last_seen, created_at (no summoner_name)
CREATE TABLE players_new (
  id BIGSERIAL NOT NULL,
  game_name TEXT,
  tag_name TEXT,
  puuid TEXT NOT NULL,
  region TEXT NOT NULL,
  puuid_key_version TEXT,
  last_seen TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT players_new_pkey PRIMARY KEY (id),
  CONSTRAINT players_new_puuid_key UNIQUE (puuid)
);
INSERT INTO players_new (id, game_name, tag_name, puuid, region, puuid_key_version, last_seen, created_at)
SELECT id, game_name, tag_name, puuid, region, puuid_key_version, last_seen, created_at
FROM players;
DROP TABLE players;
ALTER TABLE players_new RENAME TO players;
SELECT setval(pg_get_serial_sequence('players', 'id'), COALESCE((SELECT MAX(id) FROM players), 1));
CREATE INDEX IF NOT EXISTS players_region_idx ON players(region);
CREATE INDEX IF NOT EXISTS players_puuid_key_version_idx ON players(puuid_key_version);
CREATE INDEX IF NOT EXISTS players_last_seen_idx ON players(last_seen);

-- 2) Recreate participants with column order: id, player_id, match_id, ... (no puuid)
CREATE TABLE participants_new (
  id BIGSERIAL NOT NULL,
  player_id BIGINT NOT NULL,
  match_id BIGINT NOT NULL,
  team_id INTEGER,
  champion_id INTEGER NOT NULL,
  win BOOLEAN NOT NULL,
  role TEXT,
  rank_tier TEXT,
  rank_division TEXT,
  rank_lp INTEGER,
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  champ_level INTEGER,
  gold_earned INTEGER,
  total_damage_dealt_to_champions INTEGER,
  total_minions_killed INTEGER,
  vision_score INTEGER,
  first_blood_kill BOOLEAN,
  first_blood_assist BOOLEAN,
  first_tower_assist BOOLEAN,
  first_tower_kill BOOLEAN,
  game_ended_in_surrender BOOLEAN,
  game_ended_in_early_surrender BOOLEAN,
  team_early_surrendered BOOLEAN,
  baron_kills INTEGER,
  consumables_purchased INTEGER,
  damage_dealt_to_buildings INTEGER,
  damage_dealt_to_epic_monsters INTEGER,
  damage_dealt_to_objectives INTEGER,
  damage_dealt_to_turrets INTEGER,
  damage_self_mitigated INTEGER,
  double_kills INTEGER,
  dragon_kills INTEGER,
  gold_spent INTEGER,
  inhibitor_kills INTEGER,
  inhibitor_takedowns INTEGER,
  inhibitors_lost INTEGER,
  items_purchased INTEGER,
  killing_sprees INTEGER,
  largest_critical_strike INTEGER,
  largest_killing_spree INTEGER,
  largest_multi_kill INTEGER,
  longest_time_spent_living INTEGER,
  magic_damage_dealt INTEGER,
  magic_damage_dealt_to_champions INTEGER,
  magic_damage_taken INTEGER,
  neutral_minions_killed INTEGER,
  objectives_stolen INTEGER,
  objectives_stolen_assists INTEGER,
  penta_kills INTEGER,
  physical_damage_dealt INTEGER,
  physical_damage_dealt_to_champions INTEGER,
  physical_damage_taken INTEGER,
  placement INTEGER,
  quadra_kills INTEGER,
  role_bound_item INTEGER,
  sight_wards_bought_in_game INTEGER,
  time_ccing_others INTEGER,
  total_ally_jungle_minions_killed INTEGER,
  total_damage_dealt INTEGER,
  total_damage_shielded_on_teammates INTEGER,
  total_damage_taken INTEGER,
  total_enemy_jungle_minions_killed INTEGER,
  total_heal INTEGER,
  total_heals_on_teammates INTEGER,
  total_time_cc_dealt INTEGER,
  total_time_spent_dead INTEGER,
  total_units_healed INTEGER,
  triple_kills INTEGER,
  true_damage_dealt INTEGER,
  true_damage_dealt_to_champions INTEGER,
  true_damage_taken INTEGER,
  turret_kills INTEGER,
  turret_takedowns INTEGER,
  turrets_lost INTEGER,
  unreal_kills INTEGER,
  vision_wards_bought_in_game INTEGER,
  wards_killed INTEGER,
  wards_placed INTEGER,
  spell1_casts INTEGER,
  spell2_casts INTEGER,
  spell3_casts INTEGER,
  spell4_casts INTEGER,
  summoner1_casts INTEGER,
  summoner2_casts INTEGER,
  stat_perks JSONB,
  items JSONB,
  runes JSONB,
  summoner_spells JSONB,
  challenges JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT participants_new_pkey PRIMARY KEY (id),
  CONSTRAINT participants_new_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT participants_new_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO participants_new (
  id, player_id, match_id, team_id, champion_id, win, role, rank_tier, rank_division, rank_lp,
  kills, deaths, assists, champ_level, gold_earned, total_damage_dealt_to_champions, total_minions_killed, vision_score,
  first_blood_kill, first_blood_assist, first_tower_assist, first_tower_kill, game_ended_in_surrender, game_ended_in_early_surrender, team_early_surrendered,
  baron_kills, consumables_purchased, damage_dealt_to_buildings, damage_dealt_to_epic_monsters, damage_dealt_to_objectives, damage_dealt_to_turrets, damage_self_mitigated,
  double_kills, dragon_kills, gold_spent, inhibitor_kills, inhibitor_takedowns, inhibitors_lost, items_purchased,
  killing_sprees, largest_critical_strike, largest_killing_spree, largest_multi_kill, longest_time_spent_living,
  magic_damage_dealt, magic_damage_dealt_to_champions, magic_damage_taken, neutral_minions_killed, objectives_stolen, objectives_stolen_assists,
  penta_kills, physical_damage_dealt, physical_damage_dealt_to_champions, physical_damage_taken, placement, quadra_kills, role_bound_item,
  sight_wards_bought_in_game, time_ccing_others, total_ally_jungle_minions_killed, total_damage_dealt, total_damage_shielded_on_teammates, total_damage_taken,
  total_enemy_jungle_minions_killed, total_heal, total_heals_on_teammates, total_time_cc_dealt, total_time_spent_dead, total_units_healed,
  triple_kills, true_damage_dealt, true_damage_dealt_to_champions, true_damage_taken, turret_kills, turret_takedowns, turrets_lost, unreal_kills,
  vision_wards_bought_in_game, wards_killed, wards_placed, spell1_casts, spell2_casts, spell3_casts, spell4_casts, summoner1_casts, summoner2_casts,
  stat_perks, items, runes, summoner_spells, challenges, created_at
)
SELECT
  id, player_id, match_id, team_id, champion_id, win, role, rank_tier, rank_division, rank_lp,
  kills, deaths, assists, champ_level, gold_earned, total_damage_dealt_to_champions, total_minions_killed, vision_score,
  first_blood_kill, first_blood_assist, first_tower_assist, first_tower_kill, game_ended_in_surrender, game_ended_in_early_surrender, team_early_surrendered,
  baron_kills, consumables_purchased, damage_dealt_to_buildings, damage_dealt_to_epic_monsters, damage_dealt_to_objectives, damage_dealt_to_turrets, damage_self_mitigated,
  double_kills, dragon_kills, gold_spent, inhibitor_kills, inhibitor_takedowns, inhibitors_lost, items_purchased,
  killing_sprees, largest_critical_strike, largest_killing_spree, largest_multi_kill, longest_time_spent_living,
  magic_damage_dealt, magic_damage_dealt_to_champions, magic_damage_taken, neutral_minions_killed, objectives_stolen, objectives_stolen_assists,
  penta_kills, physical_damage_dealt, physical_damage_dealt_to_champions, physical_damage_taken, placement, quadra_kills, role_bound_item,
  sight_wards_bought_in_game, time_ccing_others, total_ally_jungle_minions_killed, total_damage_dealt, total_damage_shielded_on_teammates, total_damage_taken,
  total_enemy_jungle_minions_killed, total_heal, total_heals_on_teammates, total_time_cc_dealt, total_time_spent_dead, total_units_healed,
  triple_kills, true_damage_dealt, true_damage_dealt_to_champions, true_damage_taken, turret_kills, turret_takedowns, turrets_lost, unreal_kills,
  vision_wards_bought_in_game, wards_killed, wards_placed, spell1_casts, spell2_casts, spell3_casts, spell4_casts, summoner1_casts, summoner2_casts,
  stat_perks, items, runes, summoner_spells, challenges, created_at
FROM participants;
DROP TABLE participants;
ALTER TABLE participants_new RENAME TO participants;
ALTER TABLE participants RENAME CONSTRAINT participants_new_pkey TO participants_pkey;
ALTER TABLE participants RENAME CONSTRAINT participants_new_match_id_fkey TO participants_match_id_fkey;
ALTER TABLE participants RENAME CONSTRAINT participants_new_player_id_fkey TO participants_player_id_fkey;
CREATE INDEX IF NOT EXISTS participants_match_id_idx ON participants(match_id);
CREATE INDEX IF NOT EXISTS participants_player_id_idx ON participants(player_id);
CREATE INDEX IF NOT EXISTS participants_champion_id_idx ON participants(champion_id);
CREATE INDEX IF NOT EXISTS participants_rank_tier_idx ON participants(rank_tier);
CREATE INDEX IF NOT EXISTS participants_role_idx ON participants(role);
CREATE INDEX IF NOT EXISTS participants_champion_id_rank_tier_idx ON participants(champion_id, rank_tier);
CREATE INDEX IF NOT EXISTS participants_team_id_idx ON participants(team_id);
CREATE INDEX IF NOT EXISTS participants_role_match_id_idx ON participants(role, match_id) WHERE role IS NOT NULL;
CREATE INDEX IF NOT EXISTS participants_game_ended_in_surrender_idx ON participants(game_ended_in_surrender);
SELECT setval(pg_get_serial_sequence('participants', 'id'), COALESCE((SELECT MAX(id) FROM participants), 1));

-- Recreate view: aggregate total_games/total_wins from participants by player_id
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
  SELECT player_id, COUNT(*) AS games, COUNT(*) FILTER (WHERE win) AS wins
  FROM participants
  GROUP BY player_id
) agg ON pl.id = agg.player_id;

COMMENT ON VIEW players_with_stats IS 'Players with total_games/total_wins aggregated from participants (by player_id)';

-- Update get_stats_overview to use player_id instead of puuid for player count
CREATE OR REPLACE FUNCTION get_stats_overview(p_version text DEFAULT NULL, p_rank_tier text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_matches bigint;
  last_update timestamptz;
  player_count bigint;
  by_division jsonb;
  by_version jsonb;
  top_champs jsonb;
  top_pickrate jsonb;
  top_banrate jsonb;
  version_cond text;
  rank_cond text;
  match_cond text;
  division_cond text;
  key_champion_id text := 'championId';
  key_bans text := 'bans';
  empty_arr text := '(E''\x5b\x5d'')::jsonb';
BEGIN
  IF p_version IS NULL OR p_version = '' THEN
    version_cond := '1=1';
  ELSE
    version_cond := 'm.game_version IS NOT NULL AND m.game_version LIKE ' || quote_literal(p_version || '.%');
  END IF;
  IF p_rank_tier IS NULL OR p_rank_tier = '' THEN
    rank_cond := '1=1';
  ELSE
    rank_cond := 'm.rank IS NOT NULL AND m.rank != '''' AND UPPER(TRIM(split_part(m.rank, ''_'', 1))) = UPPER(TRIM(' || quote_literal(p_rank_tier) || '))';
  END IF;
  match_cond := version_cond || ' AND ' || rank_cond;
  division_cond := version_cond;

  EXECUTE format(
    'SELECT COUNT(*), MAX(m.created_at) FROM matches m WHERE %s',
    match_cond
  ) INTO total_matches, last_update;

  IF total_matches = 0 THEN
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('version', TRIM(version_prefix), 'matchCount', (match_count)::int) ORDER BY version_prefix),
      '[]'::jsonb
    ) INTO by_version FROM stats_matches_by_version;
    RETURN jsonb_build_object(
      'totalMatches', 0,
      'lastUpdate', to_jsonb(last_update),
      'playerCount', 0,
      'matchesByDivision', (
        SELECT jsonb_agg(jsonb_build_object('rankTier', t.rank_tier, 'matchCount', 0) ORDER BY t.ord)
        FROM (VALUES ('IRON',1),('BRONZE',2),('SILVER',3),('GOLD',4),('PLATINUM',5),('EMERALD',6),('DIAMOND',7),('MASTER',8),('GRANDMASTER',9),('CHALLENGER',10),('UNRANKED',11)) AS t(rank_tier, ord)
      ),
      'matchesByVersion', COALESCE(by_version, '[]'::jsonb),
      'topWinrateChampions', '[]'::jsonb,
      'topPickrateChampions', '[]'::jsonb,
      'topBanrateChampions', '[]'::jsonb
    );
  END IF;

  EXECUTE format(
    'SELECT COUNT(DISTINCT p.player_id) FROM participants p INNER JOIN matches m ON m.id = p.match_id WHERE %s',
    match_cond
  ) INTO player_count;

  EXECUTE format(
    $q$
    SELECT jsonb_agg(
      jsonb_build_object('rankTier', t.rank_tier, 'matchCount', COALESCE((d.cnt)::int, 0))
      ORDER BY t.ord
    )
    FROM (VALUES ('IRON',1),('BRONZE',2),('SILVER',3),('GOLD',4),('PLATINUM',5),('EMERALD',6),('DIAMOND',7),('MASTER',8),('GRANDMASTER',9),('CHALLENGER',10),('UNRANKED',11)) AS t(rank_tier, ord)
    LEFT JOIN (
      SELECT UPPER(TRIM(split_part(rank, '_', 1))) AS rank_tier, COUNT(*)::bigint AS cnt
      FROM matches m
      WHERE %s AND rank IS NOT NULL AND rank != ''
      GROUP BY split_part(rank, '_', 1)
    ) d ON d.rank_tier = t.rank_tier
    $q$,
    division_cond
  ) INTO by_division;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('version', TRIM(version_prefix), 'matchCount', (match_count)::int) ORDER BY version_prefix),
    '[]'::jsonb
  ) INTO by_version FROM stats_matches_by_version;

  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          %L, champion_id,
          'games', (games)::int,
          'wins', (wins)::int,
          'winrate', winrate,
          'pickrate', pickrate
        )
        ORDER BY winrate DESC
      ),
      %s
    )
    FROM (
      SELECT p.champion_id,
        COUNT(*)::bigint AS games,
        SUM(p.win::int)::bigint AS wins,
        ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate,
        ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM matches m WHERE %s), 0), 2) AS pickrate
      FROM participants p
      INNER JOIN matches m ON m.id = p.match_id
      WHERE %s
      GROUP BY p.champion_id
      HAVING COUNT(*) >= 20
      ORDER BY winrate DESC
      LIMIT 10
    ) top
    $q$,
    key_champion_id,
    empty_arr,
    match_cond,
    match_cond
  ) INTO top_champs;

  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          %L, champion_id,
          'games', (games)::int,
          'wins', (wins)::int,
          'winrate', winrate,
          'pickrate', pickrate
        )
        ORDER BY pickrate DESC
      ),
      %s
    )
    FROM (
      SELECT p.champion_id,
        COUNT(*)::bigint AS games,
        SUM(p.win::int)::bigint AS wins,
        ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate,
        ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM matches m WHERE %s), 0), 2) AS pickrate
      FROM participants p
      INNER JOIN matches m ON m.id = p.match_id
      WHERE %s
      GROUP BY p.champion_id
      HAVING COUNT(*) >= 20
      ORDER BY pickrate DESC
      LIMIT 5
    ) top
    $q$,
    key_champion_id,
    empty_arr,
    match_cond,
    match_cond
  ) INTO top_pickrate;

  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          %L, champion_id,
          'banCount', (ban_count)::int,
          'banrate', banrate
        )
        ORDER BY banrate DESC
      ),
      %s
    )
    FROM (
      SELECT champion_id,
        ban_count,
        ROUND(100.0 * ban_count / NULLIF((SELECT COUNT(*) FROM matches m WHERE %s), 0), 2) AS banrate
      FROM (
        SELECT (b->>%L)::int AS champion_id,
          COUNT(DISTINCT m.id)::bigint AS ban_count
        FROM matches m,
             jsonb_array_elements(COALESCE(m.teams, %s)) AS team,
             jsonb_array_elements(COALESCE(team->%L, %s)) AS b
        WHERE %s
          AND m.teams IS NOT NULL
          AND jsonb_typeof(team->%L) = 'array'
          AND b->>%L IS NOT NULL AND (b->>%L) ~ '^\d+$'
        GROUP BY (b->>%L)::int
      ) sub
      ORDER BY banrate DESC
      LIMIT 5
    ) top
    $q$,
    key_champion_id,
    empty_arr,
    match_cond,
    key_champion_id,
    empty_arr,
    key_bans,
    empty_arr,
    match_cond,
    key_bans,
    key_champion_id,
    key_champion_id,
    key_champion_id
  ) INTO top_banrate;

  RETURN jsonb_build_object(
    'totalMatches', (total_matches)::int,
    'lastUpdate', to_jsonb(last_update),
    'playerCount', (player_count)::int,
    'matchesByDivision', COALESCE(by_division, '[]'::jsonb),
    'matchesByVersion', by_version,
    'topWinrateChampions', COALESCE(top_champs, '[]'::jsonb),
    'topPickrateChampions', COALESCE(top_pickrate, '[]'::jsonb),
    'topBanrateChampions', COALESCE(top_banrate, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION get_stats_overview(text, text) IS 'Overview stats. playerCount = COUNT(DISTINCT player_id) in participants.';

-- Drop matchup_tier_scores table
DROP TABLE IF EXISTS matchup_tier_scores;

-- Drop stats_precomputed tables
DROP TABLE IF EXISTS stats_precomputed_abandons;
DROP TABLE IF EXISTS stats_precomputed_sides;
DROP TABLE IF EXISTS stats_precomputed_duration_winrate;
DROP TABLE IF EXISTS stats_precomputed_overview_detail;
DROP TABLE IF EXISTS stats_precomputed_overview_teams;
DROP TABLE IF EXISTS stats_precomputed_overview;
DROP TABLE IF EXISTS stats_precomputed_champions;

-- Drop backup tables if they exist (no-op if not present)
DROP TABLE IF EXISTS players_backup_before_puuid_migration;
DROP TABLE IF EXISTS participants_backup_before_puuid_migration;
