-- Champs ping Riot obsolètes (toujours 0) + danger_pings remplacé par get_back_pings.

ALTER TABLE participants
  DROP COLUMN IF EXISTS basic_pings,
  DROP COLUMN IF EXISTS danger_pings,
  DROP COLUMN IF EXISTS hold_pings,
  DROP COLUMN IF EXISTS vision_cleared_pings;

ALTER TABLE champion_stats
  DROP COLUMN IF EXISTS sum_basic_pings,
  DROP COLUMN IF EXISTS sum_danger_pings,
  DROP COLUMN IF EXISTS sum_hold_pings,
  DROP COLUMN IF EXISTS sum_vision_cleared_pings;
