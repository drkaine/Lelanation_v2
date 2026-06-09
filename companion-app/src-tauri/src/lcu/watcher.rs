//! Poll LCU gameflow phase and emit Tauri events.

use super::{fetch_gameflow_phase, fetch_local_champion_id, try_auto_apply, LcuClient};
use crate::state::AppState;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const POLL_INTERVAL: Duration = Duration::from_secs(2);

pub fn start(app: AppHandle, state: Arc<AppState>) {
    thread::spawn(move || watcher_loop(app, state));
}

fn watcher_loop(app: AppHandle, state: Arc<AppState>) {
    let mut was_connected = false;
    let mut last_phase = String::new();

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
            last_phase = phase.clone();
            if let Ok(mut g) = state.gameflow_phase.lock() {
                *g = phase.clone();
            }
            let _ = app.emit("lcu:phase-changed", phase.clone());

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
            // Champion pick can change without phase transition.
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
    }
}
