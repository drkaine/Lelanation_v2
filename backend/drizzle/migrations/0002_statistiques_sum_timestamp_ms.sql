-- Colonnes pour moyennes de timing (copie / futurs agrégats). Idempotent si déjà présentes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'champion_spell_stats' AND column_name = 'sum_timestamp_ms'
  ) THEN
    ALTER TABLE champion_spell_stats ADD COLUMN sum_timestamp_ms BIGINT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'objective_outcome_histogram' AND column_name = 'sum_timestamp_ms'
  ) THEN
    ALTER TABLE objective_outcome_histogram ADD COLUMN sum_timestamp_ms BIGINT NOT NULL DEFAULT 0;
  END IF;
END $$;
