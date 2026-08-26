-- Patch 16.17: Riot removed firstTurretKilledTime / teleportTakedowns; added baron/ace/afk fields.

ALTER TABLE participants
  DROP COLUMN IF EXISTS first_turret_killed_time,
  DROP COLUMN IF EXISTS teleport_takedowns;

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS baron_buff_gold_advantage_over_threshold BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shortest_time_to_ace_from_first_takedown BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS was_afk BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS challenges_extra JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE champion_stats
  DROP COLUMN IF EXISTS sum_first_turret_killed_time,
  DROP COLUMN IF EXISTS sum_teleport_takedowns;

ALTER TABLE champion_stats
  ADD COLUMN IF NOT EXISTS sum_baron_buff_gold_advantage_over_threshold DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_shortest_time_to_ace_from_first_takedown DOUBLE PRECISION NOT NULL DEFAULT 0;
