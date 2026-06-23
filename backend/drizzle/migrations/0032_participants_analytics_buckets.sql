-- Buckets analytiques 5 min (vision décomposée, CC, économie, pression objectifs).
-- turret_damage_buckets / objective_damage_buckets : proxies timeline (pas de damage structure par frame côté Riot).

ALTER TABLE participants ADD COLUMN IF NOT EXISTS ward_placed_buckets INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE participants ADD COLUMN IF NOT EXISTS ward_killed_buckets INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE participants ADD COLUMN IF NOT EXISTS cc_time_buckets INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE participants ADD COLUMN IF NOT EXISTS gold_spent_buckets INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE participants ADD COLUMN IF NOT EXISTS turret_damage_buckets INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE participants ADD COLUMN IF NOT EXISTS objective_damage_buckets INTEGER[] NOT NULL DEFAULT '{}';
