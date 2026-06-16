//! Post-game checklist scoring (simple LCU/Live Client stats).

use crate::postgame::PostGameStats;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CheckResultKind {
    Checked,
    Partial,
    Failed,
    Unmeasurable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistItem {
    pub id: String,
    pub kind: CheckResultKind,
    pub detail: Option<String>,
    #[serde(default)]
    pub user_kind: Option<CheckResultKind>,
    #[serde(default)]
    pub manual_checked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedChecklist {
    pub id: String,
    pub saved_at_ms: i64,
    pub auto_saved: bool,
    pub items: Vec<ChecklistItem>,
    pub score: f32,
    pub measured_count: u32,
    pub checked_count: u32,
    pub stats: PostGameStats,
    #[serde(default)]
    pub notes: String,
}

const MEASURABLE: &[&str] = &[
    "cs_at_5",
    "cs_at_10",
    "cs_per_min",
    "pink_wards",
    "wards_placed",
    "vision_denied",
    "survival",
    "team_objectives",
];

fn item(id: &str, kind: CheckResultKind, detail: Option<&str>) -> ChecklistItem {
    ChecklistItem {
        id: id.to_string(),
        kind,
        detail: detail.map(str::to_string),
        user_kind: None,
        manual_checked: false,
    }
}

fn checked(id: &str, detail: Option<&str>) -> ChecklistItem {
    item(id, CheckResultKind::Checked, detail)
}

fn partial(id: &str, detail: &str) -> ChecklistItem {
    item(id, CheckResultKind::Partial, Some(detail))
}

fn failed(id: &str, detail: &str) -> ChecklistItem {
    item(id, CheckResultKind::Failed, Some(detail))
}

fn unmeasurable(id: &str) -> ChecklistItem {
    item(id, CheckResultKind::Unmeasurable, None)
}

pub fn is_measurable(id: &str) -> bool {
    MEASURABLE.contains(&id)
}

pub fn effective_kind(entry: &ChecklistItem) -> CheckResultKind {
    if is_measurable(&entry.id) {
        entry.user_kind.clone().unwrap_or(entry.kind.clone())
    } else if entry.manual_checked {
        CheckResultKind::Checked
    } else {
        CheckResultKind::Unmeasurable
    }
}

pub fn recalculate_score(items: &[ChecklistItem]) -> (f32, u32, u32) {
    let measured: Vec<_> = items.iter().filter(|i| is_measurable(&i.id)).collect();
    let measured_count = measured.len() as u32;
    let checked_count = measured
        .iter()
        .filter(|i| effective_kind(i) == CheckResultKind::Checked)
        .count() as u32;
    let partial_count = measured
        .iter()
        .filter(|i| effective_kind(i) == CheckResultKind::Partial)
        .count() as u32;
    let score = if measured_count == 0 {
        0.0
    } else {
        ((checked_count as f32 + partial_count as f32 * 0.5) / measured_count as f32) * 100.0
    };
    (score, measured_count, checked_count)
}

fn eval_cs_at_5(cs: Option<u32>) -> ChecklistItem {
    let Some(cs) = cs else {
        return partial("cs_at_5", "live_client_unavailable");
    };
    if cs >= 44 {
        return checked("cs_at_5", Some(&format!("{cs}")));
    }
    if cs >= 42 {
        return checked("cs_at_5", Some(&format!("{cs}")));
    }
    if cs >= 40 {
        return checked("cs_at_5", Some(&format!("{cs}")));
    }
    if cs >= 35 {
        return partial("cs_at_5", &format!("{cs}"));
    }
    failed("cs_at_5", &format!("{cs}"))
}

fn eval_cs_at_10(cs: Option<u32>) -> ChecklistItem {
    let Some(cs) = cs else {
        return partial("cs_at_10", "live_client_unavailable");
    };
    if cs >= 85 {
        return checked("cs_at_10", Some(&format!("{cs}")));
    }
    if cs >= 78 {
        return partial("cs_at_10", &format!("{cs}"));
    }
    failed("cs_at_10", &format!("{cs}"))
}

fn eval_cs_per_min(stats: &PostGameStats) -> ChecklistItem {
    let mins = stats.game_duration_seconds.max(1) as f32 / 60.0;
    let cs_per_min = stats.cs_total as f32 / mins;
    if cs_per_min >= 8.0 {
        return checked("cs_per_min", Some(&format!("{cs_per_min:.1}")));
    }
    if cs_per_min >= 6.5 {
        return partial("cs_per_min", &format!("{cs_per_min:.1}"));
    }
    failed("cs_per_min", &format!("{cs_per_min:.1}"))
}

pub fn evaluate(stats: PostGameStats) -> Vec<ChecklistItem> {
    let mut items = Vec::new();
    items.push(eval_cs_at_5(stats.cs_at_5));
    items.push(eval_cs_at_10(stats.cs_at_10));
    items.push(eval_cs_per_min(&stats));

    if stats.vision_wards_bought >= 2 {
        items.push(checked(
            "pink_wards",
            Some(&stats.vision_wards_bought.to_string()),
        ));
    } else if stats.vision_wards_bought >= 1 {
        items.push(checked("pink_wards", Some("1")));
    } else {
        items.push(failed("pink_wards", "0"));
    }

    let mins = stats.game_duration_seconds.max(1) as f32 / 60.0;
    let wards_per_min = stats.wards_placed as f32 / mins;
    if wards_per_min >= 1.0 {
        items.push(checked("wards_placed", Some(&format!("{wards_per_min:.1}"))));
    } else if wards_per_min >= 0.5 {
        items.push(partial("wards_placed", &format!("{wards_per_min:.1}")));
    } else {
        items.push(failed("wards_placed", &format!("{wards_per_min:.1}")));
    }

    if stats.wards_killed >= 1 {
        items.push(checked(
            "vision_denied",
            Some(&stats.wards_killed.to_string()),
        ));
    } else {
        items.push(partial("vision_denied", "0"));
    }

    if stats.deaths == 0 {
        items.push(checked("survival", Some("0")));
    } else if stats.deaths <= 2 {
        items.push(checked("survival", Some(&stats.deaths.to_string())));
    } else if stats.deaths <= 4 {
        items.push(partial("survival", &stats.deaths.to_string()));
    } else {
        items.push(failed("survival", &stats.deaths.to_string()));
    }

    if stats.team_dragon_kills > 0 || stats.team_baron_kills > 0 {
        items.push(checked(
            "team_objectives",
            Some(&format!(
                "{}:{}",
                stats.team_dragon_kills, stats.team_baron_kills
            )),
        ));
    } else {
        items.push(partial("team_objectives", "0:0"));
    }

    items.push(unmeasurable("minimap"));
    items.push(unmeasurable("ping_missing"));
    items.push(unmeasurable("wave_management"));
    items.push(unmeasurable("objective_focus"));

    items
}

pub fn merge_user_edits(target: &mut SavedChecklist, source: &SavedChecklist) {
    for t_item in &mut target.items {
        if let Some(s_item) = source.items.iter().find(|i| i.id == t_item.id) {
            t_item.user_kind = s_item.user_kind.clone();
            t_item.manual_checked = s_item.manual_checked;
        }
    }
    if !source.notes.is_empty() {
        target.notes = source.notes.clone();
    }
    let (score, measured_count, checked_count) = recalculate_score(&target.items);
    target.score = score;
    target.measured_count = measured_count;
    target.checked_count = checked_count;
}

pub fn to_saved_checklist(stats: PostGameStats, auto_saved: bool) -> SavedChecklist {
    let items = evaluate(stats.clone());
    let (score, measured_count, checked_count) = recalculate_score(&items);
    let saved_at_ms = now_millis();
    SavedChecklist {
        id: format!("cl-{saved_at_ms}"),
        saved_at_ms,
        auto_saved,
        items,
        score,
        measured_count,
        checked_count,
        stats,
        notes: String::new(),
    }
}

pub fn now_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::postgame::PostGameStats;

    fn perfect_stats() -> PostGameStats {
        PostGameStats {
            game_duration_seconds: 1800,
            cs_at_5: Some(44),
            cs_at_10: Some(90),
            cs_total: 200,
            vision_wards_bought: 2,
            wards_placed: 18,
            wards_killed: 3,
            deaths: 1,
            team_dragon_kills: 2,
            team_baron_kills: 1,
            win: true,
            ..Default::default()
        }
    }

    #[test]
    fn simple_checklist_has_twelve_items() {
        assert_eq!(evaluate(perfect_stats()).len(), 12);
    }

    #[test]
    fn measured_count_is_eight() {
        let saved = to_saved_checklist(perfect_stats(), true);
        assert_eq!(saved.measured_count, 8);
    }
}
