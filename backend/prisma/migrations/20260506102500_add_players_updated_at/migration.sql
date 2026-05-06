ALTER TABLE "players"
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION set_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_players_updated_at ON "players";
CREATE TRIGGER trg_players_updated_at
BEFORE UPDATE ON "players"
FOR EACH ROW
EXECUTE FUNCTION set_players_updated_at();
