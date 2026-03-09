-- Manual rollback script for 20260309143000_match_teams_normalization
-- Run only if you need to restore matches.teams JSON storage.

BEGIN;

-- 1) Restore JSON column if missing
ALTER TABLE matches ADD COLUMN IF NOT EXISTS teams jsonb;

-- 2) Restore original JSON payload from backup snapshot
UPDATE matches m
SET teams = b.teams
FROM backup_matches_teams_20260309 b
WHERE b.match_id = m.id;

-- 3) Rebuild JSON from match_teams for rows missing in backup
WITH rebuilt AS (
  SELECT
    mt.match_id,
    jsonb_agg(
      jsonb_build_object(
        'teamId', mt.team_id,
        'win', mt.win,
        'bans', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('championId', b)), '[]'::jsonb)
          FROM unnest(ARRAY[mt.ban_1, mt.ban_2, mt.ban_3, mt.ban_4, mt.ban_5]) AS b
          WHERE b IS NOT NULL
        ),
        'objectives', jsonb_build_object(
          'champion', jsonb_build_object('first', mt.champion_first, 'kills', mt.champion_kills),
          'baron', jsonb_build_object('first', mt.baron_first, 'kills', mt.baron_kills),
          'dragon', jsonb_build_object('first', mt.dragon_first, 'kills', mt.dragon_kills),
          'tower', jsonb_build_object('first', mt.tower_first, 'kills', mt.tower_kills),
          'horde', jsonb_build_object('first', mt.horde_first, 'kills', mt.horde_kills),
          'riftHerald', jsonb_build_object('first', mt.rift_herald_first, 'kills', mt.rift_herald_kills),
          'inhibitor', jsonb_build_object('first', mt.inhibitor_first, 'kills', mt.inhibitor_kills)
        )
      )
      ORDER BY mt.team_id
    ) AS teams_json
  FROM match_teams mt
  GROUP BY mt.match_id
)
UPDATE matches m
SET teams = r.teams_json
FROM rebuilt r
WHERE m.id = r.match_id
  AND m.teams IS NULL;

-- 4) Drop normalized table if full rollback desired
DROP TABLE IF EXISTS match_teams;

COMMIT;

