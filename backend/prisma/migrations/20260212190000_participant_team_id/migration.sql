-- Add team_id to participants: 100 = blue, 200 = red (Riot convention).
-- New inserts set it from Riot payload; backfill existing rows from match.teams (win -> teamId).
ALTER TABLE participants ADD COLUMN IF NOT EXISTS team_id integer NULL;

-- Backfill: set team_id from match.teams where elem.win = participant.win and elem.teamId in (100, 200)
UPDATE participants p
SET team_id = sub.team_id
FROM (
  SELECT DISTINCT ON (p2.id)
    p2.id AS pid,
    (elem->>'teamId')::int AS team_id
  FROM participants p2
  JOIN matches m ON m.id = p2.match_id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.teams, '[]'::jsonb)) AS elem
  WHERE (elem->>'win')::boolean = p2.win
    AND elem->>'teamId' IS NOT NULL
    AND (elem->>'teamId') ~ '^(100|200)$'
  ORDER BY p2.id
) sub
WHERE p.id = sub.pid AND p.team_id IS NULL;

CREATE INDEX IF NOT EXISTS participants_team_id_idx ON participants (team_id);
