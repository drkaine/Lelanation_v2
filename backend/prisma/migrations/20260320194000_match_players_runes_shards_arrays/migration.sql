ALTER TABLE "match_players"
ADD COLUMN IF NOT EXISTS "runes" INTEGER[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "rune_style" INTEGER[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "perk" INTEGER[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "shards" INTEGER[] NOT NULL DEFAULT '{}';

-- Backfill from legacy normalized tables.
WITH rune_agg AS (
  SELECT
    r.match_player_id,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.style ORDER BY r.style), NULL) AS rune_style,
    ARRAY_REMOVE(ARRAY_AGG(r.perk_id ORDER BY r.style, r.perk_id), NULL) AS perk
  FROM match_player_runes r
  GROUP BY r.match_player_id
),
shard_agg AS (
  SELECT
    s.match_player_id,
    ARRAY_REMOVE(ARRAY_AGG(s.shard_id ORDER BY s.slot), NULL) AS shards
  FROM match_player_shards s
  GROUP BY s.match_player_id
)
UPDATE match_players mp
SET
  rune_style = COALESCE(ra.rune_style, '{}'),
  perk = COALESCE(ra.perk, '{}'),
  runes = COALESCE(COALESCE(ra.rune_style, '{}') || COALESCE(ra.perk, '{}'), '{}'),
  shards = COALESCE(sa.shards, '{}')
FROM rune_agg ra
FULL OUTER JOIN shard_agg sa ON sa.match_player_id = ra.match_player_id
WHERE mp.id = COALESCE(ra.match_player_id, sa.match_player_id);
