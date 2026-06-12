-- champion_vs_stats : une ligne par set d'items (liste triée) + ordre d'achat agrégé en JSONB.

ALTER TABLE champion_vs_stats
  ADD COLUMN IF NOT EXISTS set_item TEXT NOT NULL DEFAULT '';

ALTER TABLE champion_vs_stats
  ADD COLUMN IF NOT EXISTS order_items JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE champion_vs_stats DROP CONSTRAINT IF EXISTS champion_vs_stats_pkey;

ALTER TABLE champion_vs_stats
  ADD PRIMARY KEY (
    patch,
    role,
    rank_tier,
    region,
    champion_id,
    champion_transform,
    opponent_champion_id,
    set_item
  );

COMMENT ON COLUMN champion_vs_stats.set_item IS
  'Set d''items finaux sérialisé et trié (ex. 1001_2003_3031), une ligne par build distinct.';

COMMENT ON COLUMN champion_vs_stats.order_items IS
  'Ordre d''achat (starters + légendaires) → { "1": {"games": N, "wins": W}, ... }';

UPDATE champion_vs_stats
SET order_items = '{}'::jsonb
WHERE jsonb_typeof(order_items) != 'object';
