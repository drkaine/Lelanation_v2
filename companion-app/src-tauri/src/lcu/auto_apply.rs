//! Auto-apply pending build when entering champion select.

use super::{apply_summoner_spells, LcuClient};
use crate::state::AppState;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

pub fn try_auto_apply(
    app: &AppHandle,
    state: &Arc<AppState>,
    client: &LcuClient,
    local_champion_id: Option<u32>,
) {
    let build = {
        let mut pending = state.pending_build.lock().expect("pending_build lock");
        pending.take()
    };

    let Some(build) = build else {
        return;
    };

    let Some(spells) = build.summoner_spells else {
        let _ = app.emit("lcu:auto-applied", serde_json::json!({ "summoners": false }));
        return;
    };

    if local_champion_id.is_some_and(|id| id != build.champion_id) {
        let expected = build.champion_id;
        // Put build back so user can retry or override.
        let mut pending = state.pending_build.lock().expect("pending_build lock");
        *pending = Some(build);
        let _ = app.emit(
            "lcu:champion-mismatch",
            serde_json::json!({
                "expected": expected,
                "selected": local_champion_id,
            }),
        );
        return;
    }

    let phase = state
        .gameflow_phase
        .lock()
        .map(|g| g.clone())
        .unwrap_or_else(|_| "ChampSelect".into());

    match apply_summoner_spells(client, &phase, spells[0], spells[1]) {
        Ok(()) => {
            let _ = app.emit(
                "lcu:auto-applied",
                serde_json::json!({ "summoners": true, "buildName": build.name }),
            );
        }
        Err(e) => {
            let mut pending = state.pending_build.lock().expect("pending_build lock");
            *pending = Some(build);
            let _ = app.emit(
                "lcu:auto-apply-failed",
                serde_json::json!({ "error": e }),
            );
        }
    }
}
