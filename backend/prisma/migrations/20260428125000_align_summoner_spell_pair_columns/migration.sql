ALTER TABLE IF EXISTS agg_champion_summoner_spell_pair_stats
  RENAME COLUMN role_norm TO role;

ALTER TABLE IF EXISTS archive_agg_champion_summoner_spell_pair_stats
  RENAME COLUMN role_norm TO role;

ALTER TABLE IF EXISTS agg_champion_summoner_spell_pair_stats
  ALTER COLUMN champion_id TYPE BIGINT USING champion_id::bigint,
  ADD COLUMN IF NOT EXISTS spell1_casts BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spell2_casts BIGINT NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS archive_agg_champion_summoner_spell_pair_stats
  ALTER COLUMN champion_id TYPE BIGINT USING champion_id::bigint,
  ADD COLUMN IF NOT EXISTS spell1_casts BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spell2_casts BIGINT NOT NULL DEFAULT 0;
