//! Persisted companion settings (League install path, onboarding, optional stats consent).

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CompanionConfig {
    /// User-selected root folder of the League of Legends install (e.g. .../Riot Games/League of Legends).
    pub league_install_path: Option<String>,
    pub onboarding_complete: bool,
    /// If true, user opted in to sending ranked duo match metadata for site stats (future use).
    pub share_ranked_duo_stats: bool,
}

fn config_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
        PathBuf::from(appdata).join("Lelanation").join("Companion")
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
        PathBuf::from(home)
            .join(".config")
            .join("lelanation-companion")
    }
}

pub fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

/// Sidecar written by the NSIS installer (Windows) so the first launch can prefill the League path.
const INSTALLER_LEAGUE_PATH_FILENAME: &str = "league-path-from-installer.txt";

fn installer_league_path_file() -> PathBuf {
    config_dir().join(INSTALLER_LEAGUE_PATH_FILENAME)
}

/// Reads and deletes the installer hint file, if present.
pub fn take_installer_league_path_hint() -> Option<String> {
    let path = installer_league_path_file();
    let raw = std::fs::read_to_string(&path).ok()?;
    let _ = std::fs::remove_file(&path);
    let s = raw.trim().to_string();
    if s.is_empty() {
        return None;
    }
    Some(s)
}

pub fn load_companion_config() -> CompanionConfig {
    let path = config_path();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(c) = serde_json::from_str(&raw) {
            return c;
        }
    }
    CompanionConfig::default()
}

pub fn save_companion_config(cfg: &CompanionConfig) -> Result<(), String> {
    let dir = config_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let raw = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(config_path(), raw).map_err(|e| e.to_string())
}
