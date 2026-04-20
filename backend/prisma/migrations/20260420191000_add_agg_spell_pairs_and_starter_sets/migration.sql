CREATE TABLE IF NOT EXISTS agg_champion_summoner_spell_pair_stats (
  game_version TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  role_norm TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  spell_d INTEGER NOT NULL,
  spell_f INTEGER NOT NULL,
  count_game BIGINT NOT NULL DEFAULT 0,
  count_win BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_version, rank_tier, role_norm, champion_id, spell_d, spell_f)
);

CREATE TABLE IF NOT EXISTS agg_champion_item_starter_set_stats (
  game_version TEXT NOT NULL,
  rank_tier TEXT NOT NULL,
  role_norm TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  starter_key TEXT NOT NULL,
  count_game BIGINT NOT NULL DEFAULT 0,
  count_win BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_version, rank_tier, role_norm, champion_id, starter_key)
);

CREATE INDEX IF NOT EXISTS idx_agg_spell_pair_spells
  ON agg_champion_summoner_spell_pair_stats (spell_d, spell_f);
