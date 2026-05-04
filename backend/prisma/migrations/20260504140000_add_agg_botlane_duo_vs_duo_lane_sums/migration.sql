-- Lane economy / matchup sums for our botlane (ADC + support) per agg_botlane_duo_vs_duo_stats row.

ALTER TABLE IF EXISTS agg_botlane_duo_vs_duo_stats
  ADD COLUMN IF NOT EXISTS sum_adc_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS archive_agg_botlane_duo_vs_duo_stats
  ADD COLUMN IF NOT EXISTS sum_adc_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_adc_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_gold_earned BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_gold_spent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_max_level_lead_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_max_kill_deficit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_max_cs_advantage_on_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_vision_score_advantage_lane_opponent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sum_support_early_laning_phase_gold_exp_advantage INTEGER NOT NULL DEFAULT 0;
