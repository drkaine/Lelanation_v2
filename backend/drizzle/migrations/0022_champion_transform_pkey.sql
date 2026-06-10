-- Sépare les stats par forme de champion (Kayn/Rhaast, etc.) via champion_transform dans la PK.
-- champion_bans_by_banner exclu (banned_champion_id, pas champion_id joueur).
-- champion_bucket inclut aussi transform_timestamp_ms (ms depuis début de partie).

DO $$
DECLARE
  tbl text;
  pk_cols text;
BEGIN
  FOR tbl, pk_cols IN
    SELECT * FROM (VALUES
      ('champion_stats', '(patch, role, rank_tier, region, champion_id, champion_transform, team)'),
      ('champion_vs_stats', '(patch, role, rank_tier, region, champion_id, champion_transform, opponent_champion_id)'),
      ('champion_duo_role_stats', '(patch, role, rank_tier, region, champion_id, champion_transform, ally_champion_id, ally_role)'),
      ('champion_spell_stats', '(patch, role, rank_tier, region, champion_id, champion_transform, spell_order_hash)'),
      ('champion_item_set_stats', '(patch, role, rank_tier, region, champion_id, champion_transform, phase, item_set_key)'),
      ('champion_item_solo_stats', '(patch, role, rank_tier, region, champion_id, champion_transform, item_id)'),
      ('champion_pick_order', '(patch, role, rank_tier, region, champion_id, champion_transform, team, pick_order)'),
      ('champion_runes_solo_stats', '(patch, role, rank_tier, region, champion_id, champion_transform, perk_id)'),
      ('champion_runes_stats', '(patch, role, rank_tier, region, champion_id, champion_transform, rune_list, shard_list)'),
      ('champion_shard_solo_stats', '(patch, role, rank_tier, region, champion_id, champion_transform, shard_id, slot)'),
      ('champion_tier_daily_snapshots', '(patch, role, rank_tier, region, champion_id, champion_transform, date_of_game)'),
      ('champion_summoner_spell_pair_stats', '(patch, role, rank_tier, region, champion_id, champion_transform, spell_d, spell_f)'),
      ('champion_summoner_spells', '(patch, role, rank_tier, region, champion_id, champion_transform, spell_id)')
    ) AS t(table_name, pk_definition)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'champion_transform'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN champion_transform SMALLINT NOT NULL DEFAULT 0',
        tbl
      );
    END IF;

    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_pkey');

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = tbl
        AND c.contype = 'p'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY %s', tbl, pk_cols);
    END IF;
  END LOOP;
END $$;

-- champion_bucket : champion_transform + transform_timestamp_ms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'champion_bucket'
      AND column_name = 'champion_transform'
  ) THEN
    ALTER TABLE champion_bucket
      ADD COLUMN champion_transform SMALLINT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'champion_bucket'
      AND column_name = 'transform_timestamp_ms'
  ) THEN
    ALTER TABLE champion_bucket
      ADD COLUMN transform_timestamp_ms BIGINT NOT NULL DEFAULT 0;
  END IF;
END $$;

ALTER TABLE champion_bucket DROP CONSTRAINT IF EXISTS champion_bucket_pkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'champion_bucket'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE champion_bucket
      ADD PRIMARY KEY (
        patch, role, rank_tier, region, champion_id,
        champion_transform, transform_timestamp_ms, duration_bucket
      );
  END IF;
END $$;
