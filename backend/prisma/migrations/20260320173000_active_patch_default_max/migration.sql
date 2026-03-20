ALTER TABLE active_patches
  ALTER COLUMN game_number_max SET DEFAULT 1000000;

UPDATE active_patches
SET game_number_max = 1000000
WHERE game_number_max = 0;

