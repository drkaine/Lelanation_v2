//! Shared application state for LCU export.

use crate::lcu::{ItemSetData, RunePageData};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildPayload {
    pub name: String,
    pub champion_id: u32,
    #[serde(default)]
    pub runes: Option<RunePageData>,
    #[serde(default)]
    pub items: Option<ItemSetData>,
    #[serde(default)]
    pub summoner_spells: Option<[u32; 2]>,
    #[serde(default = "default_true")]
    pub import_runes: bool,
    #[serde(default = "default_true")]
    pub import_items: bool,
    #[serde(default = "default_true")]
    pub import_summoner_spells: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LcuStatus {
    pub connected: bool,
    pub phase: String,
    pub champion_id: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub runes: bool,
    pub items: bool,
    pub summoners: bool,
    pub summoners_pending: bool,
    pub errors: Vec<String>,
}

pub struct AppState {
    pub connected: Mutex<bool>,
    pub gameflow_phase: Mutex<String>,
    pub champion_id: Mutex<Option<u32>>,
    pub pending_build: Mutex<Option<BuildPayload>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            connected: Mutex::new(false),
            gameflow_phase: Mutex::new("None".into()),
            champion_id: Mutex::new(None),
            pending_build: Mutex::new(None),
        }
    }

    pub fn lcu_status(&self) -> LcuStatus {
        LcuStatus {
            connected: self.connected.lock().map(|c| *c).unwrap_or(false),
            phase: self
                .gameflow_phase
                .lock()
                .map(|p| p.clone())
                .unwrap_or_else(|_| "None".into()),
            champion_id: self.champion_id.lock().ok().and_then(|c| *c),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
