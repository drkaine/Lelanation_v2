-- Stocker uniquement major.minor dans matchs.game_version (ex. "16.4" au lieu de "16.4.748.682").

UPDATE matchs
SET game_version = split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2)
WHERE game_version IS NOT NULL
  AND position('.' IN game_version) > 0
  AND game_version <> (split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2));

CREATE OR REPLACE FUNCTION matchs_normalize_game_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.game_version IS NOT NULL AND position('.' IN NEW.game_version) > 0 THEN
    NEW.game_version := split_part(NEW.game_version, '.', 1) || '.' || split_part(NEW.game_version, '.', 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS matchs_game_version_before_ins_upd ON matchs;
CREATE TRIGGER matchs_game_version_before_ins_upd
  BEFORE INSERT OR UPDATE OF game_version ON matchs
  FOR EACH ROW
  EXECUTE PROCEDURE matchs_normalize_game_version();
