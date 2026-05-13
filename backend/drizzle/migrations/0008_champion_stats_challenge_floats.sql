-- Métriques challenges / Riot potentiellement non entières (cf. scripts/analyzeParsedMetricFractions.ts
-- sur data/api-riot/match-id.json + timeline.json). Évite invalid input syntax for type bigint.

-- champion_stats
ALTER TABLE champion_stats
  ALTER COLUMN sum_bounty_gold TYPE double precision USING sum_bounty_gold::double precision,
  ALTER COLUMN sum_max_level_lead_lane_opponent TYPE double precision USING sum_max_level_lead_lane_opponent::double precision,
  ALTER COLUMN sum_max_kill_deficit TYPE double precision USING sum_max_kill_deficit::double precision,
  ALTER COLUMN sum_more_enemy_jungle_than_opponent TYPE double precision USING sum_more_enemy_jungle_than_opponent::double precision,
  ALTER COLUMN sum_max_cs_advantage_on_lane_opponent TYPE double precision USING sum_max_cs_advantage_on_lane_opponent::double precision,
  ALTER COLUMN sum_vision_score_advantage_lane_opponent TYPE double precision USING sum_vision_score_advantage_lane_opponent::double precision,
  ALTER COLUMN sum_laning_phase_gold_exp_advantage TYPE double precision USING sum_laning_phase_gold_exp_advantage::double precision,
  ALTER COLUMN sum_early_laning_phase_gold_exp_advantage TYPE double precision USING sum_early_laning_phase_gold_exp_advantage::double precision,
  ALTER COLUMN sum_damage_per_minute TYPE double precision USING sum_damage_per_minute::double precision,
  ALTER COLUMN sum_effective_heal_and_shielding TYPE double precision USING sum_effective_heal_and_shielding::double precision,
  ALTER COLUMN sum_earliest_baron TYPE double precision USING sum_earliest_baron::double precision,
  ALTER COLUMN sum_first_turret_killed_time TYPE double precision USING sum_first_turret_killed_time::double precision,
  ALTER COLUMN sum_game_length TYPE double precision USING sum_game_length::double precision,
  ALTER COLUMN sum_gold_per_minute TYPE double precision USING sum_gold_per_minute::double precision,
  ALTER COLUMN sum_vision_score_per_minute TYPE double precision USING sum_vision_score_per_minute::double precision;

-- champion_vs_stats (économie de lane alignée champion_stats)
ALTER TABLE champion_vs_stats
  ALTER COLUMN sum_max_level_lead_lane_opponent TYPE double precision USING sum_max_level_lead_lane_opponent::double precision,
  ALTER COLUMN sum_max_kill_deficit TYPE double precision USING sum_max_kill_deficit::double precision,
  ALTER COLUMN sum_more_enemy_jungle_than_opponent TYPE double precision USING sum_more_enemy_jungle_than_opponent::double precision,
  ALTER COLUMN sum_max_cs_advantage_on_lane_opponent TYPE double precision USING sum_max_cs_advantage_on_lane_opponent::double precision,
  ALTER COLUMN sum_vision_score_advantage_lane_opponent TYPE double precision USING sum_vision_score_advantage_lane_opponent::double precision,
  ALTER COLUMN sum_laning_phase_gold_exp_advantage TYPE double precision USING sum_laning_phase_gold_exp_advantage::double precision,
  ALTER COLUMN sum_early_laning_phase_gold_exp_advantage TYPE double precision USING sum_early_laning_phase_gold_exp_advantage::double precision;

-- champion_duo_role_stats
ALTER TABLE champion_duo_role_stats
  ALTER COLUMN sum_max_level_lead_lane_opponent TYPE double precision USING sum_max_level_lead_lane_opponent::double precision,
  ALTER COLUMN sum_max_kill_deficit TYPE double precision USING sum_max_kill_deficit::double precision,
  ALTER COLUMN sum_more_enemy_jungle_than_opponent TYPE double precision USING sum_more_enemy_jungle_than_opponent::double precision,
  ALTER COLUMN sum_max_cs_advantage_on_lane_opponent TYPE double precision USING sum_max_cs_advantage_on_lane_opponent::double precision,
  ALTER COLUMN sum_vision_score_advantage_lane_opponent TYPE double precision USING sum_vision_score_advantage_lane_opponent::double precision,
  ALTER COLUMN sum_laning_phase_gold_exp_advantage TYPE double precision USING sum_laning_phase_gold_exp_advantage::double precision,
  ALTER COLUMN sum_early_laning_phase_gold_exp_advantage TYPE double precision USING sum_early_laning_phase_gold_exp_advantage::double precision;

-- botlane_duo_vs_duo_stats (lane / challenges ADC + support)
ALTER TABLE botlane_duo_vs_duo_stats
  ALTER COLUMN sum_adc_max_level_lead_lane_opponent TYPE double precision USING sum_adc_max_level_lead_lane_opponent::double precision,
  ALTER COLUMN sum_adc_max_kill_deficit TYPE double precision USING sum_adc_max_kill_deficit::double precision,
  ALTER COLUMN sum_adc_max_cs_advantage_on_lane_opponent TYPE double precision USING sum_adc_max_cs_advantage_on_lane_opponent::double precision,
  ALTER COLUMN sum_adc_vision_score_advantage_lane_opponent TYPE double precision USING sum_adc_vision_score_advantage_lane_opponent::double precision,
  ALTER COLUMN sum_adc_laning_phase_gold_exp_advantage TYPE double precision USING sum_adc_laning_phase_gold_exp_advantage::double precision,
  ALTER COLUMN sum_adc_early_laning_phase_gold_exp_advantage TYPE double precision USING sum_adc_early_laning_phase_gold_exp_advantage::double precision,
  ALTER COLUMN sum_support_max_level_lead_lane_opponent TYPE double precision USING sum_support_max_level_lead_lane_opponent::double precision,
  ALTER COLUMN sum_support_max_kill_deficit TYPE double precision USING sum_support_max_kill_deficit::double precision,
  ALTER COLUMN sum_support_max_cs_advantage_on_lane_opponent TYPE double precision USING sum_support_max_cs_advantage_on_lane_opponent::double precision,
  ALTER COLUMN sum_support_vision_score_advantage_lane_opponent TYPE double precision USING sum_support_vision_score_advantage_lane_opponent::double precision,
  ALTER COLUMN sum_support_laning_phase_gold_exp_advantage TYPE double precision USING sum_support_laning_phase_gold_exp_advantage::double precision,
  ALTER COLUMN sum_support_early_laning_phase_gold_exp_advantage TYPE double precision USING sum_support_early_laning_phase_gold_exp_advantage::double precision;
