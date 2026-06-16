//! Poll LCU gameflow phase and emit Tauri events.

use super::{fetch_gameflow_phase, fetch_local_champion_id, try_auto_apply, LcuClient};
use crate::checklist::{merge_user_edits, save_entry, to_saved_checklist};
use crate::live_client::{self, LiveCsSnapshot};
use crate::postgame;
use crate::state::AppState;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const POLL_INTERVAL: Duration = Duration::from_secs(2);
const POSTGAME_INITIAL_DELAY: Duration = Duration::from_secs(4);

pub fn start(app: AppHandle, state: Arc<AppState>) {
    thread::spawn(move || watcher_loop(app, state));
}

fn reset_live_snapshot(state: &AppState) {
    if let Ok(mut snap) = state.live_cs_snapshot.lock() {
        *snap = LiveCsSnapshot::default();
    }
}

fn merge_live_cs(state: &AppState, stats: &mut postgame::PostGameStats) {
    if let Ok(snap) = state.live_cs_snapshot.lock() {
        if stats.cs_at_5.is_none() {
            stats.cs_at_5 = snap.cs_at_5;
        }
        if stats.cs_at_10.is_none() {
            stats.cs_at_10 = snap.cs_at_10;
        }
    }
}

fn refresh_live_draft(app: &AppHandle, state: &AppState) {
    let snap = state.live_cs_snapshot.lock().ok().map(|s| s.clone());
    let Some(snap) = snap else {
        return;
    };
    let Some(stats) = live_client::fetch_live_stats(&snap) else {
        return;
    };
    let mut draft = to_saved_checklist(stats, false);
    draft.auto_saved = false;
    if let Ok(mut d) = state.checklist_draft.lock() {
        *d = Some(draft.clone());
    }
    let _ = app.emit("lcu:checklist-draft", &draft);
}

fn handle_postgame(app: &AppHandle, state: &Arc<AppState>) {
    let app = app.clone();
    let state = Arc::clone(state);
    thread::spawn(move || {
        thread::sleep(POSTGAME_INITIAL_DELAY);
        let Ok(client) = LcuClient::connect() else {
            return;
        };
        if !client.is_connected() {
            return;
        }
        match postgame::fetch_postgame_stats(&client) {
            Ok(mut stats) => {
                merge_live_cs(&state, &mut stats);
                let _ = app.emit("lcu:postgame-stats", &stats);

                let mut saved = to_saved_checklist(stats, true);
                if let Ok(draft) = state.checklist_draft.lock() {
                    if let Some(prev) = draft.as_ref() {
                        merge_user_edits(&mut saved, prev);
                    }
                }
                if let Ok(mut draft) = state.checklist_draft.lock() {
                    *draft = Some(saved.clone());
                }
                let history = save_entry(saved.clone());
                let _ = app.emit("lcu:checklist-saved", &saved);
                let _ = app.emit("lcu:checklist-history", &history);
            }
            Err(e) => {
                let _ = app.emit(
                    "lcu:postgame-error",
                    serde_json::json!({ "message": e }),
                );
            }
        }
        reset_live_snapshot(&state);
    });
}

fn sample_live_cs(state: &AppState) {
    if let Ok(mut snap) = state.live_cs_snapshot.lock() {
        live_client::sample_cs_milestones(&mut snap);
    }
}

fn watcher_loop(app: AppHandle, state: Arc<AppState>) {
    let mut was_connected = false;
    let mut last_phase = String::new();
    let mut last_draft_emit = std::time::Instant::now()
        .checked_sub(Duration::from_secs(60))
        .unwrap_or_else(std::time::Instant::now);

    loop {
        thread::sleep(POLL_INTERVAL);

        let client_result = LcuClient::connect();
        let client = match client_result {
            Ok(c) => c,
            Err(_) => {
                if was_connected {
                    was_connected = false;
                    if let Ok(mut c) = state.connected.lock() {
                        *c = false;
                    }
                    let _ = app.emit("lcu:disconnected", ());
                }
                continue;
            }
        };

        if !client.is_connected() {
            if was_connected {
                was_connected = false;
                if let Ok(mut c) = state.connected.lock() {
                    *c = false;
                }
                let _ = app.emit("lcu:disconnected", ());
            }
            continue;
        }

        if !was_connected {
            was_connected = true;
            if let Ok(mut c) = state.connected.lock() {
                *c = true;
            }
            let _ = app.emit("lcu:connected", ());
        }

        let phase = fetch_gameflow_phase(&client).unwrap_or_else(|_| "None".into());
        if phase != last_phase {
            let previous = last_phase.clone();
            last_phase = phase.clone();
            if let Ok(mut g) = state.gameflow_phase.lock() {
                *g = phase.clone();
            }
            let _ = app.emit("lcu:phase-changed", phase.clone());

            if phase == "InProgress" {
                reset_live_snapshot(&state);
                if let Ok(mut d) = state.checklist_draft.lock() {
                    *d = None;
                }
            }

            if phase == "EndOfGame" || phase == "PreEndOfGame" {
                if previous != "EndOfGame" && previous != "PreEndOfGame" {
                    handle_postgame(&app, &state);
                }
            }

            if phase == "ChampSelect" {
                let champ_id = fetch_local_champion_id(&client);
                if let Some(id) = champ_id {
                    if let Ok(mut c) = state.champion_id.lock() {
                        *c = Some(id);
                    }
                    let _ = app.emit("lcu:champion-selected", id);
                }
                try_auto_apply(&app, &state, &client, champ_id);
            }
        } else if phase == "ChampSelect" {
            if let Some(champ_id) = fetch_local_champion_id(&client) {
                let changed = state
                    .champion_id
                    .lock()
                    .map(|mut c| {
                        if c.as_ref() != Some(&champ_id) {
                            *c = Some(champ_id);
                            true
                        } else {
                            false
                        }
                    })
                    .unwrap_or(false);
                if changed {
                    let _ = app.emit("lcu:champion-selected", champ_id);
                }
            }
        }

        if phase == "InProgress" {
            sample_live_cs(&state);
            if last_draft_emit.elapsed() >= Duration::from_secs(30) {
                refresh_live_draft(&app, &state);
                last_draft_emit = std::time::Instant::now();
            }
        }
    }
}
