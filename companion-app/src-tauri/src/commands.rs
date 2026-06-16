//! Tauri commands for LCU build export.

use crate::app_config::load_companion_config;
use crate::checklist::{
    delete_entry, load_all, recalculate_score, save_entry, to_saved_checklist, SavedChecklist,
};
use crate::progression::{self, ProgressionSave};
use crate::live_client;
use crate::lcu::{
    apply_item_set, apply_rune_page, apply_summoner_spells, fetch_gameflow_phase,
    resolve_champion_numeric_id, write_recommended_item_set, LcuClient,
};
use crate::state::{AppState, ApplyResult, BuildPayload, LcuStatus};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

/// Called from lelanation.fr iframe (injected bridge or remote ACL invoke).
#[tauri::command]
pub fn companion_import_build(build: serde_json::Value, app: AppHandle) -> Result<(), String> {
    app.emit(
        "companion-import-build",
        serde_json::json!({ "build": build, "via": "tauri-invoke" }),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn resolve_champion_id(champion_folder: String) -> Result<u32, String> {
    let client = LcuClient::connect()?;
    if !client.is_connected() {
        return Err("League Client is not reachable".into());
    }
    let id = resolve_champion_numeric_id(&client, 0, Some(champion_folder.trim()));
    if id == 0 {
        return Err(format!(
            "Cannot resolve champion id for '{}'",
            champion_folder.trim()
        ));
    }
    Ok(id)
}

#[tauri::command]
pub fn get_lcu_status(state: State<'_, Arc<AppState>>) -> LcuStatus {
    state.lcu_status()
}

#[tauri::command]
pub fn get_pending_build(state: State<'_, Arc<AppState>>) -> Option<BuildPayload> {
    state
        .pending_build
        .lock()
        .ok()
        .and_then(|p| p.clone())
}

#[tauri::command]
pub fn apply_build(build: BuildPayload, state: State<'_, Arc<AppState>>) -> Result<ApplyResult, String> {
    let client = LcuClient::connect()?;
    if !client.is_connected() {
        return Err("League Client is not reachable".into());
    }

    let phase = fetch_gameflow_phase(&client).unwrap_or_else(|_| "None".into());
    if let Ok(mut g) = state.gameflow_phase.lock() {
        *g = phase.clone();
    }
    if let Ok(mut c) = state.connected.lock() {
        *c = true;
    }

    let mut result = ApplyResult {
        runes: false,
        items: false,
        summoners: false,
        summoners_pending: false,
        errors: Vec::new(),
    };

    let champion_id = resolve_champion_numeric_id(
        &client,
        build.champion_id,
        build.champion_folder.as_deref(),
    );
    if build.import_runes {
        if let Some(ref runes) = build.runes {
            match apply_rune_page(&client, &build.name, runes) {
                Ok(_) => result.runes = true,
                Err(e) => result.errors.push(format!("Runes: {e}")),
            }
        }
    }

    if build.import_items {
        if let Some(ref items) = build.items {
            match apply_item_set(&client, &build.name, champion_id, items) {
                Ok(()) => result.items = true,
                Err(e) => result.errors.push(format!("Items: {e}")),
            }

            let cfg = load_companion_config();
            if let Some(league_root) = cfg
                .league_install_path
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                let champion_folder = build.champion_folder.as_deref().unwrap_or("");
                let build_id = build.build_id.as_deref().unwrap_or("");
                match write_recommended_item_set(
                    league_root,
                    champion_folder,
                    champion_id,
                    build_id,
                    &build.name,
                    items,
                ) {
                    Ok(_) => {
                        result.items = true;
                    }
                    Err(e) => result.errors.push(format!("Items file: {e}")),
                }
            } else if !result.items {
                result.errors
                    .push("Items file: League install folder not configured.".into());
            }
        }
    }

    if build.import_summoner_spells {
        if let Some(spells) = build.summoner_spells {
            if phase == "ChampSelect" {
                match apply_summoner_spells(&client, &phase, spells[0], spells[1]) {
                    Ok(()) => result.summoners = true,
                    Err(e) => result.errors.push(format!("Summoner spells: {e}")),
                }
            } else {
                if let Ok(mut pending) = state.pending_build.lock() {
                    *pending = Some(build.clone());
                }
                result.summoners_pending = true;
            }
        }
    }

    if !result.runes && !result.items && !result.summoners && !result.summoners_pending {
        if result.errors.is_empty() {
            return Err("Nothing to import in build payload".into());
        }
        return Err(result.errors.join("; "));
    }

    Ok(result)
}

#[tauri::command]
pub fn get_checklist_history() -> Vec<SavedChecklist> {
    load_all()
}

#[tauri::command]
pub fn get_checklist_draft(state: State<'_, Arc<AppState>>) -> Option<SavedChecklist> {
    let snap = state.live_cs_snapshot.lock().ok().map(|s| s.clone());
    if let Some(snap) = snap {
        if let Some(stats) = live_client::fetch_live_stats(&snap) {
            let draft = to_saved_checklist(stats, false);
            if let Ok(mut d) = state.checklist_draft.lock() {
                *d = Some(draft.clone());
            }
            return Some(draft);
        }
    }
    state
        .checklist_draft
        .lock()
        .ok()
        .and_then(|d| d.clone())
}

#[tauri::command]
pub fn save_checklist(mut entry: SavedChecklist) -> Result<Vec<SavedChecklist>, String> {
    if entry.id.is_empty() {
        entry.id = format!("cl-{}", crate::checklist::evaluator::now_millis());
    }
    if entry.saved_at_ms == 0 {
        entry.saved_at_ms = crate::checklist::evaluator::now_millis();
    }
    entry.auto_saved = false;
    let (score, measured_count, checked_count) = recalculate_score(&entry.items);
    entry.score = score;
    entry.measured_count = measured_count;
    entry.checked_count = checked_count;
    Ok(save_entry(entry))
}

#[tauri::command]
pub fn update_checklist(mut entry: SavedChecklist) -> Result<Vec<SavedChecklist>, String> {
    if entry.id.is_empty() {
        return Err("Checklist id is required".into());
    }
    let (score, measured_count, checked_count) = recalculate_score(&entry.items);
    entry.score = score;
    entry.measured_count = measured_count;
    entry.checked_count = checked_count;
    Ok(save_entry(entry))
}

#[tauri::command]
pub fn delete_checklist(id: String) -> Vec<SavedChecklist> {
    delete_entry(&id)
}

/// Runs app connectivity test and sets `base_stable_internet` from the result.
fn apply_internet_check(data: &mut ProgressionSave) {
    progression::apply_internet_result(data, progression::check_internet());
}

#[tauri::command]
pub fn load_progression() -> ProgressionSave {
    progression::store::load()
}

#[tauri::command]
pub fn get_progression() -> ProgressionSave {
    let mut data = progression::store::load();
    apply_internet_check(&mut data);
    data.updated_at_ms = crate::checklist::evaluator::now_millis();
    progression::store::save(data.clone())
}

#[tauri::command]
pub fn test_internet_for_progression() -> ProgressionSave {
    let mut data = progression::store::load();
    apply_internet_check(&mut data);
    data.updated_at_ms = crate::checklist::evaluator::now_millis();
    progression::store::save(data.clone())
}

#[tauri::command]
pub fn confirm_internet_for_progression(online: bool) -> ProgressionSave {
    let mut data = progression::store::load();
    progression::apply_internet_result(&mut data, online);
    data.updated_at_ms = crate::checklist::evaluator::now_millis();
    progression::store::save(data.clone())
}

#[tauri::command]
pub fn save_progression(mut data: ProgressionSave) -> Result<ProgressionSave, String> {
    data.updated_at_ms = crate::checklist::evaluator::now_millis();
    Ok(progression::store::save(data))
}

#[tauri::command]
pub fn check_internet_connection() -> bool {
    progression::check_internet()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lcu::ItemSetData;

    #[test]
    fn build_payload_deserializes() {
        let raw = r#"{
            "name": "Test",
            "championId": 103,
            "runes": {
                "primaryPath": 8000,
                "secondaryPath": 8200,
                "perks": {
                    "primaryPerks": [8005, 9111, 9104, 8014],
                    "secondaryPerks": [8234, 8236],
                    "shards": [5008, 5008, 5001]
                }
            },
            "items": { "core": [3157] },
            "summonerSpells": [4, 14]
        }"#;
        let payload: BuildPayload = serde_json::from_str(raw).unwrap();
        assert_eq!(payload.name, "Test");
        assert_eq!(payload.champion_id, 103);
        assert!(payload.runes.is_some());
    }

    #[test]
    fn empty_payload_has_defaults() {
        let payload = BuildPayload {
            name: "X".into(),
            champion_id: 1,
            champion_folder: None,
            build_id: None,
            runes: None,
            items: None,
            summoner_spells: None,
            import_runes: true,
            import_items: true,
            import_summoner_spells: true,
        };
        assert!(payload.runes.is_none());
        assert!(ItemSetData::default().core.is_empty());
    }
}
