-- Remove unused columns from players: summoner_id, total_games, total_wins, updated_at
-- Create view players_with_stats for total_games/total_wins aggregated from participants

-- Step 1: Create the view (before dropping columns, so we can reference current structure)
CREATE OR REPLACE VIEW players_with_stats AS
SELECT
  p.puuid,
  p.summoner_name,
  p.region,
  p.last_seen,
  p.created_at,
  COALESCE(agg.games, 0)::int AS total_games,
  COALESCE(agg.wins, 0)::int AS total_wins
FROM players p
LEFT JOIN (
  SELECT puuid, COUNT(*) AS games, COUNT(*) FILTER (WHERE win) AS wins
  FROM participants
  GROUP BY puuid
) agg ON p.puuid = agg.puuid;

COMMENT ON VIEW players_with_stats IS 'Players with total_games/total_wins aggregated from participants (source of truth)';

-- Step 2: Drop columns from players
ALTER TABLE players DROP COLUMN IF EXISTS summoner_id;
ALTER TABLE players DROP COLUMN IF EXISTS total_games;
ALTER TABLE players DROP COLUMN IF EXISTS total_wins;
ALTER TABLE players DROP COLUMN IF EXISTS updated_at;
