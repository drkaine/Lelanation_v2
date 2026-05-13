-- PK sur spell_order (TEXT très long) dépasse la limite btree (~2704 octets).
-- Clé logique : md5(spell_order) (32 caractères) + dimensions ; spell_order reste stocké pour l’API.
-- Idempotent : bases déjà alignées (colonne / PK) sans entrée journal correspondante.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'champion_spell_stats'
      AND column_name = 'spell_order_hash'
  ) THEN
    ALTER TABLE champion_spell_stats
      ADD COLUMN spell_order_hash text GENERATED ALWAYS AS (md5(spell_order)) STORED;
  END IF;
END $$;

ALTER TABLE champion_spell_stats DROP CONSTRAINT IF EXISTS champion_spell_stats_pkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'champion_spell_stats'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE champion_spell_stats
      ADD PRIMARY KEY (patch, role, rank_tier, region, champion_id, spell_order_hash);
  END IF;
END $$;
