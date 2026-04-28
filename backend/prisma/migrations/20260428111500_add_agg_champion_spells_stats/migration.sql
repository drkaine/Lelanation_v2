CREATE TABLE IF NOT EXISTS agg_champion_spells_stats (
  champion_stat_id BIGINT PRIMARY KEY,
  spell1_casts INTEGER NOT NULL DEFAULT 0,
  spell2_casts INTEGER NOT NULL DEFAULT 0,
  spell3_casts INTEGER NOT NULL DEFAULT 0,
  spell4_casts INTEGER NOT NULL DEFAULT 0,
  spell_order JSONB NOT NULL DEFAULT '{}'::jsonb,
  count_game INTEGER NOT NULL DEFAULT 0,
  count_win INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agg_champion_spells_stats_updated_at
  ON agg_champion_spells_stats (updated_at);

CREATE TABLE IF NOT EXISTS archive_agg_champion_spells_stats
  (LIKE agg_champion_spells_stats INCLUDING ALL);

CREATE INDEX IF NOT EXISTS idx_archive_cspells_csid
  ON archive_agg_champion_spells_stats (champion_stat_id);

-- Keep this additional satellite archived without rewriting close_patch().
CREATE OR REPLACE FUNCTION archive_spell_stats_on_patch_archive()
RETURNS TRIGGER AS $$
DECLARE
  v_like_patch TEXT;
BEGIN
  IF NEW.archived_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF length(NEW.game_version) > 0 AND position('.' in NEW.game_version) > 0 THEN
    v_like_patch := NEW.game_version || '.%';
  ELSE
    v_like_patch := NEW.game_version || '%';
  END IF;

  INSERT INTO archive_agg_champion_spells_stats
  SELECT s.*
  FROM agg_champion_spells_stats s
  INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
  WHERE c.game_version = NEW.game_version OR c.game_version LIKE v_like_patch
  ON CONFLICT DO NOTHING;

  DELETE FROM agg_champion_spells_stats
  WHERE champion_stat_id IN (
    SELECT id FROM agg_champion_core_stats
    WHERE game_version = NEW.game_version OR game_version LIKE v_like_patch
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_archive_spell_stats_on_patch_archive ON active_patches;
CREATE TRIGGER trg_archive_spell_stats_on_patch_archive
AFTER UPDATE OF archived_at ON active_patches
FOR EACH ROW
EXECUTE FUNCTION archive_spell_stats_on_patch_archive();
