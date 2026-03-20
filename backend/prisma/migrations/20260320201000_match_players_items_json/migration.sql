ALTER TABLE "match_players"
ADD COLUMN IF NOT EXISTS "items" JSONB NOT NULL DEFAULT '[]'::jsonb;

WITH items_agg AS (
  SELECT
    i.match_player_id,
    jsonb_agg(
      jsonb_build_object(
        'itemId', i.item_id,
        'starter', i.starter,
        'core', i.core,
        'order', i."order",
        'timestampMs', i.timestamp_ms
      )
      ORDER BY i."order" ASC, i.timestamp_ms ASC, i.id ASC
    ) AS items_json
  FROM match_player_items i
  GROUP BY i.match_player_id
)
UPDATE match_players mp
SET items = ia.items_json
FROM items_agg ia
WHERE mp.id = ia.match_player_id;
