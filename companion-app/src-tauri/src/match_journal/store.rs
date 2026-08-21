use super::MatchJournalEntry;
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

fn journal_path() -> PathBuf {
    data_dir().join("match_journal.json")
}

fn write_all(entries: &[MatchJournalEntry]) {
    if let Some(parent) = journal_path().parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(entries) {
        let _ = std::fs::write(journal_path(), json);
    }
}

pub fn load_all() -> Vec<MatchJournalEntry> {
    let path = journal_path();
    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn save_entry(entry: MatchJournalEntry) -> Vec<MatchJournalEntry> {
    let mut all = load_all();
    if let Some(game_id) = entry.game_id {
        if let Some(idx) = all.iter().position(|e| e.game_id == Some(game_id)) {
            all[idx] = entry;
            write_all(&all);
            return all;
        }
    }
    if let Some(idx) = all.iter().position(|e| e.id == entry.id) {
        all[idx] = entry;
    } else {
        all.insert(0, entry);
    }
    write_all(&all);
    all
}

pub fn delete_entry(id: &str) -> Vec<MatchJournalEntry> {
    let mut all = load_all();
    all.retain(|e| e.id != id);
    write_all(&all);
    all
}
