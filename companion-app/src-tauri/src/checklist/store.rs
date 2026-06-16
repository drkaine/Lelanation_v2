//! Persist saved checklists to AppData (unlimited history).

use super::evaluator::SavedChecklist;
use std::path::PathBuf;

fn data_dir() -> PathBuf {
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

fn checklists_path() -> PathBuf {
    data_dir().join("checklists.json")
}

fn write_all(entries: &[SavedChecklist]) {
    if let Some(parent) = checklists_path().parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(entries) {
        let _ = std::fs::write(checklists_path(), json);
    }
}

pub fn load_all() -> Vec<SavedChecklist> {
    let path = checklists_path();
    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn save_entry(entry: SavedChecklist) -> Vec<SavedChecklist> {
    let mut all = load_all();
    if let Some(idx) = all.iter().position(|e| e.id == entry.id) {
        all[idx] = entry;
    } else {
        all.insert(0, entry);
    }
    write_all(&all);
    all
}

pub fn delete_entry(id: &str) -> Vec<SavedChecklist> {
    let mut all = load_all();
    all.retain(|e| e.id != id);
    write_all(&all);
    all
}
