-- Drop legacy materialized views and pre-agg stats tables if any remain.
-- Safe on already-migrated environments: objects are checked by name + relkind.

DO $$
DECLARE
  obj text;
  kind "char";
BEGIN
  FOREACH obj IN ARRAY ARRAY[
    -- Legacy materialized views
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
    'mv_champion_item_starter_set_stats',

    -- Legacy pre-agg tables (kept here as cleanup guard)
    'champion_core_stats',
    'champion_vs_stats',
    'match_outcome_stats',
    'team_core_stats',
    'champion_side_stats',
    'champion_bans_by_banner',
    'team_bucket',
    'champion_bucket',
    'champion_summoner_spells',
    'champion_runes_stats',
    'champion_runes_solo_stats',
    'champion_shard_solo_stats',
    'champion_item_stats',
    'champion_item_solo_stats',
    'champion_summoner_spell_pair_stats',
    'champion_item_starter_set_stats'
  ]
  LOOP
    SELECT c.relkind
    INTO kind
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = obj
    LIMIT 1;

    IF kind = 'm' THEN
      EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I CASCADE', obj);
    ELSIF kind = 'v' THEN
      EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', obj);
    ELSIF kind IN ('r', 'p') THEN
      EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', obj);
    END IF;

    kind := NULL;
  END LOOP;
END $$;
