-- Single source of truth for "first" objectives: which team got it is in match_teams;
-- who got the kill/assist is here (replaces participant first_blood_* / first_tower_*).

CREATE TABLE IF NOT EXISTS "match_team_first_objectives" (
  "id" BIGSERIAL NOT NULL,
  "match_team_id" BIGINT NOT NULL,
  "objective_type" TEXT NOT NULL,
  "participant_id" BIGINT NOT NULL,
  "is_kill" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "match_team_first_objectives_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "match_team_first_objectives_match_team_id_fkey" FOREIGN KEY ("match_team_id") REFERENCES "match_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "match_team_first_objectives_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "match_team_first_objectives_match_team_id_objective_type_participant_id_key" UNIQUE ("match_team_id", "objective_type", "participant_id")
);

CREATE INDEX IF NOT EXISTS "match_team_first_objectives_match_team_id_idx" ON "match_team_first_objectives"("match_team_id");
CREATE INDEX IF NOT EXISTS "match_team_first_objectives_participant_id_idx" ON "match_team_first_objectives"("participant_id");
CREATE INDEX IF NOT EXISTS "match_team_first_objectives_objective_type_idx" ON "match_team_first_objectives"("objective_type");

-- Backfill from participants (first blood = champion, first tower = tower).
-- Team derived from participant order: first 5 = 100, next 5 = 200 (participants.team_id may not exist).
INSERT INTO "match_team_first_objectives" ("match_team_id", "objective_type", "participant_id", "is_kill")
SELECT mt.id, 'champion', p.id, true
FROM participants p
INNER JOIN (
  SELECT id, match_id,
    CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
  FROM participants
) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
WHERE p.first_blood_kill = true
ON CONFLICT ("match_team_id", "objective_type", "participant_id") DO NOTHING;

INSERT INTO "match_team_first_objectives" ("match_team_id", "objective_type", "participant_id", "is_kill")
SELECT mt.id, 'champion', p.id, false
FROM participants p
INNER JOIN (
  SELECT id, match_id,
    CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
  FROM participants
) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
WHERE p.first_blood_assist = true
ON CONFLICT ("match_team_id", "objective_type", "participant_id") DO NOTHING;

INSERT INTO "match_team_first_objectives" ("match_team_id", "objective_type", "participant_id", "is_kill")
SELECT mt.id, 'tower', p.id, true
FROM participants p
INNER JOIN (
  SELECT id, match_id,
    CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
  FROM participants
) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
WHERE p.first_tower_kill = true
ON CONFLICT ("match_team_id", "objective_type", "participant_id") DO NOTHING;

INSERT INTO "match_team_first_objectives" ("match_team_id", "objective_type", "participant_id", "is_kill")
SELECT mt.id, 'tower', p.id, false
FROM participants p
INNER JOIN (
  SELECT id, match_id,
    CASE WHEN ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id) <= 5 THEN 100 ELSE 200 END AS team_id
  FROM participants
) p_team ON p_team.id = p.id AND p_team.match_id = p.match_id
INNER JOIN match_teams mt ON mt.match_id = p.match_id AND mt.team_id = p_team.team_id
WHERE p.first_tower_assist = true
ON CONFLICT ("match_team_id", "objective_type", "participant_id") DO NOTHING;

ALTER TABLE "participants" DROP COLUMN IF EXISTS "first_blood_kill";
ALTER TABLE "participants" DROP COLUMN IF EXISTS "first_blood_assist";
ALTER TABLE "participants" DROP COLUMN IF EXISTS "first_tower_kill";
ALTER TABLE "participants" DROP COLUMN IF EXISTS "first_tower_assist";
