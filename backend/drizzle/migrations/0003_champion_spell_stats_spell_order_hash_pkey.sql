-- PK sur spell_order (TEXT très long) dépasse la limite btree (~2704 octets).
-- Clé logique : md5(spell_order) (32 caractères) + dimensions ; spell_order reste stocké pour l’API.

ALTER TABLE champion_spell_stats
  ADD COLUMN spell_order_hash text GENERATED ALWAYS AS (md5(spell_order)) STORED;

ALTER TABLE champion_spell_stats DROP CONSTRAINT IF EXISTS champion_spell_stats_pkey;

ALTER TABLE champion_spell_stats
  ADD PRIMARY KEY (patch, role, rank_tier, region, champion_id, spell_order_hash);
