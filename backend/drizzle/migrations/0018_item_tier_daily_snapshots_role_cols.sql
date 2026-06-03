-- item_tier_daily_snapshots : parties / victoires par rôle (agrégat par item, pas par rôle en PK).

ALTER TABLE item_tier_daily_snapshots
  ADD COLUMN IF NOT EXISTS top_game INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_win INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jungle_game INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jungle_win INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mid_game INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mid_win INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adc_game INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adc_win INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS support_game INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS support_win INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN item_tier_daily_snapshots.top_game IS 'Parties où l''item a été joué par un Top';
COMMENT ON COLUMN item_tier_daily_snapshots.jungle_game IS 'Parties où l''item a été joué par un Jungle';
COMMENT ON COLUMN item_tier_daily_snapshots.mid_game IS 'Parties où l''item a été joué par un Mid';
COMMENT ON COLUMN item_tier_daily_snapshots.adc_game IS 'Parties où l''item a été joué par un ADC';
COMMENT ON COLUMN item_tier_daily_snapshots.support_game IS 'Parties où l''item a été joué par un Support';
