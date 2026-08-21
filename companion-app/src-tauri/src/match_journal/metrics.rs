//! Maps post-game stats to `champion_vs_stats` sum_* column names.

use crate::postgame::PostGameStats;
use std::collections::HashMap;

pub const LEGACY_METRICS: &[&str] = &[
    "sum_gold_earned",
    "sum_gold_spent",
    "sum_max_level_lead_lane_opponent",
    "sum_max_kill_deficit",
    "sum_more_enemy_jungle_than_opponent",
    "sum_max_cs_advantage_on_lane_opponent",
    "sum_vision_score_advantage_lane_opponent",
    "sum_laning_phase_gold_exp_advantage",
    "sum_early_laning_phase_gold_exp_advantage",
    "sum_physique_damage_done_to_champion_u15",
    "sum_magic_damage_done_to_champion_u15",
    "sum_true_damage_done_to_champion_u15",
    "sum_kill_u15",
    "sum_assist_u15",
    "sum_death_u15",
    "sum_vision_score_u15",
    "sum_shield_and_heal_u15",
    "sum_minions_killed_u15",
];

pub const LANE_METRICS: &[&str] = &[
    "sum_kill_opponent_5min",
    "sum_kill_opponent_10min",
    "sum_kill_opponent_15min",
    "sum_death_by_opponent_5min",
    "sum_death_by_opponent_10min",
    "sum_death_by_opponent_15min",
    "sum_death_by_dive",
    "sum_kill_by_dive",
    "sum_kill_by_gank",
    "sum_death_by_gank",
    "sum_gold_difference_5min",
    "sum_gold_difference_10min",
    "sum_gold_difference_15min",
    "sum_gold_spent_5min",
    "sum_gold_spent_10min",
    "sum_gold_spent_15min",
    "sum_gold_spent_by_opponent_5min",
    "sum_gold_spent_by_opponent_10min",
    "sum_gold_spent_by_opponent_15min",
    "sum_gold_possessed_5min",
    "sum_gold_possessed_10min",
    "sum_gold_possessed_15min",
    "sum_gold_possessed_by_opponent_5min",
    "sum_gold_possessed_by_opponent_10min",
    "sum_gold_possessed_by_opponent_15min",
    "sum_cs_difference_5min",
    "sum_cs_difference_10min",
    "sum_cs_difference_15min",
    "sum_cs_5min",
    "sum_cs_10min",
    "sum_cs_15min",
    "sum_cs_opponent_5min",
    "sum_cs_opponent_10min",
    "sum_cs_opponent_15min",
    "sum_vision_score_difference_5min",
    "sum_vision_score_difference_10min",
    "sum_vision_score_difference_15min",
    "sum_vision_5min",
    "sum_vision_10min",
    "sum_vision_15min",
    "sum_vision_opponent_5min",
    "sum_vision_opponent_10min",
    "sum_vision_opponent_15min",
    "sum_level_5min",
    "sum_level_10min",
    "sum_level_15min",
    "sum_level_opponent_5min",
    "sum_level_opponent_10min",
    "sum_level_opponent_15min",
    "sum_xp_5min",
    "sum_xp_10min",
    "sum_xp_15min",
    "sum_xp_opponent_5min",
    "sum_xp_opponent_10min",
    "sum_xp_opponent_15min",
    "sum_have_legendary_item_first",
    "sum_opponent_have_legendary_item_first",
    "sum_buy_legendary_item_timestamp",
    "sum_opponent_buy_legendary_item_timestamp",
    "sum_have_boots_item_first",
    "sum_opponent_have_boots_item_first",
    "sum_buy_boots_item_timestamp",
    "sum_opponent_buy_boots_item_timestamp",
    "sum_have_boots_tier2_item_first",
    "sum_opponent_have_boots_tier2_item_first",
    "sum_buy_boots_tier2_item_timestamp",
    "sum_opponent_buy_boots_tier2_item_timestamp",
    "sum_consumable_item_bought",
    "sum_consumable_item_bought_by_opponent",
    "sum_kill_by_roaming",
    "sum_kill_by_roaming_by_opponent",
    "sum_death_by_roaming",
    "sum_death_by_roaming_by_opponent",
    "sum_first_tower",
    "sum_first_tower_by_opponent",
    "sum_turret_plate_taken",
    "sum_turret_plate_taken_by_opponent",
    "sum_drake_kill",
    "sum_drake_assist",
    "sum_drake_kill_by_opponent",
    "sum_drake_assist_by_opponent",
    "sum_void_kill",
    "sum_void_assist",
    "sum_void_kill_by_opponent",
    "sum_void_assist_by_opponent",
    "sum_herald_kill",
    "sum_herald_assist",
    "sum_herald_kill_by_opponent",
    "sum_herald_assist_by_opponent",
    "sum_objective_stolen",
    "sum_objective_stolen_by_opponent",
    "sum_kill_on_objective",
    "sum_kill_on_objective_by_opponent",
    "sum_death_on_objective",
    "sum_death_on_objective_by_opponent",
];

fn set(metrics: &mut HashMap<String, Option<f64>>, key: &str, value: Option<f64>) {
    metrics.insert(key.to_string(), value);
}

/// Fills champion_vs_stats metric keys from LCU post-game data (timeline metrics stay empty).
pub fn build_metrics(stats: &PostGameStats) -> HashMap<String, Option<f64>> {
    let mut out = HashMap::new();

    for key in LEGACY_METRICS.iter().chain(LANE_METRICS.iter()) {
        set(&mut out, key, None);
    }

    set(
        &mut out,
        "sum_gold_earned",
        Some(stats.gold_earned as f64),
    );
    if stats.gold_spent > 0 {
        set(
            &mut out,
            "sum_gold_spent",
            Some(stats.gold_spent as f64),
        );
    }

    if let Some(cs) = stats.cs_at_5 {
        set(&mut out, "sum_cs_5min", Some(cs as f64));
    }
    if let Some(cs) = stats.cs_at_10 {
        set(&mut out, "sum_cs_10min", Some(cs as f64));
    }
    if stats.cs_total > 0 {
        set(
            &mut out,
            "sum_minions_killed_u15",
            Some(stats.cs_total as f64),
        );
    }

    set(&mut out, "sum_kill_u15", Some(stats.kills as f64));
    set(&mut out, "sum_death_u15", Some(stats.deaths as f64));
    set(&mut out, "sum_assist_u15", Some(stats.assists as f64));

    if stats.vision_score > 0 {
        set(
            &mut out,
            "sum_vision_score_u15",
            Some(stats.vision_score as f64),
        );
    } else {
        let vision = stats.wards_placed as f64
            + stats.vision_wards_bought as f64
            + stats.wards_killed as f64;
        if vision > 0.0 {
            set(&mut out, "sum_vision_score_u15", Some(vision));
        }
    }

    if stats.damage_to_champions > 0 {
        set(
            &mut out,
            "sum_damage_to_champions",
            Some(stats.damage_to_champions as f64),
        );
    }

    out
}
