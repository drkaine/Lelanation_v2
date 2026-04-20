CREATE TABLE IF NOT EXISTS agg_champion_summoner_spells (
  champion_stat_id BIGINT NOT NULL,
  spell_id INTEGER NOT NULL,
  count_win INTEGER NOT NULL DEFAULT 0,
  count_game INTEGER NOT NULL DEFAULT 0,
  count_slot0 INTEGER NOT NULL DEFAULT 0,
  count_slot1 INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (champion_stat_id, spell_id)
);

CREATE INDEX IF NOT EXISTS idx_agg_champion_summoner_spells_spell
  ON agg_champion_summoner_spells (spell_id);
