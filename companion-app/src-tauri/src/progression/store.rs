use super::ProgressionSave;
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

fn progression_path() -> PathBuf {
    data_dir().join("progression.json")
}

pub fn load() -> ProgressionSave {
    let path = progression_path();
    let raw = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return ProgressionSave::default(),
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn save(data: ProgressionSave) -> ProgressionSave {
    if let Some(parent) = progression_path().parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&data) {
        let _ = std::fs::write(progression_path(), json);
    }
    data
}
