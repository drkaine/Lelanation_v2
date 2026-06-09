//! Tauri commands for LCU build export.

use crate::app_config::load_companion_config;
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
