pub mod metrics;
pub mod store;

use crate::checklist::evaluator::now_millis;
use crate::postgame::PostGameStats;
use metrics::build_metrics;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchJournalEntry {
    pub id: String,
    pub saved_at_ms: i64,
    pub played_at_ms: i64,
    pub game_id: Option<u64>,
    pub region: String,
    pub queue_id: Option<u32>,
    pub queue_type: String,
    pub game_mode: String,
    pub game_type: String,
    pub ranked: bool,
    pub champion_id: u32,
    pub opponent_champion_id: Option<u32>,
    pub role: String,
    pub patch: String,
    pub rank_tier: String,
    pub set_item: String,
    pub win: bool,
    pub stats: PostGameStats,
    pub metrics: HashMap<String, Option<f64>>,
    #[serde(default)]
    pub notes: String,
    /// Full LCU API payloads captured at end-of-game (for dev inspection).
    #[serde(default)]
    pub lcu_raw: Option<Value>,
}

pub fn from_postgame(stats: PostGameStats, lcu_raw: Option<Value>) -> MatchJournalEntry {
    let played_at_ms = stats
        .game_creation_ms
        .filter(|&ms| ms > 0)
        .unwrap_or_else(now_millis);
    let id = stats
        .game_id
        .map(|gid| format!("mj-{gid}"))
        .unwrap_or_else(|| format!("mj-{}", now_millis()));

    MatchJournalEntry {
        id,
        saved_at_ms: now_millis(),
        played_at_ms,
        game_id: stats.game_id,
        region: stats.region.clone(),
        queue_id: stats.queue_id,
        queue_type: stats.queue_type.clone(),
        game_mode: stats.game_mode.clone(),
        game_type: stats.game_type.clone(),
        ranked: stats.ranked,
        champion_id: stats.champion_id,
        opponent_champion_id: stats.opponent_champion_id,
        role: stats.role.clone(),
        patch: stats.patch.clone(),
        rank_tier: stats.player_rank.clone(),
        set_item: stats.set_item.clone(),
        win: stats.win,
        metrics: build_metrics(&stats),
        stats,
        notes: String::new(),
        lcu_raw,
    }
}
