ALTER TABLE matchs
  ADD COLUMN IF NOT EXISTS game_date timestamptz NULL;

ALTER TABLE active_patches
  ADD COLUMN IF NOT EXISTS games_number integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS game_number_max integer NOT NULL DEFAULT 0;

