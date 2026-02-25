use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

pub struct ImageCacheState {
    pub cache_dir: PathBuf,
    pub api_base: RwLock<String>,
}

impl ImageCacheState {
    pub fn new() -> Self {
        let cache_dir = default_cache_dir();
        fs::create_dir_all(&cache_dir).ok();
        Self {
            cache_dir,
            api_base: RwLock::new("https://www.lelanation.fr".into()),
        }
    }

    pub fn get_or_download(&self, relative: &str) -> Option<(Vec<u8>, &'static str)> {
        let local = self.cache_dir.join(relative);
        let content_type = mime_for(relative);

        if local.exists() {
            return fs::read(&local).ok().map(|b| (b, content_type));
        }

        let base = self.api_base.read().ok()?.clone();
        let url = format!("{}/images/game/{}", base, relative);
        let resp = reqwest::blocking::get(&url).ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let bytes = resp.bytes().ok()?;

        if let Some(parent) = local.parent() {
            fs::create_dir_all(parent).ok();
        }
        fs::write(&local, &bytes).ok();

        Some((bytes.to_vec(), content_type))
    }
}

fn default_cache_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(d) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(d)
                .join("fr.lelanation.companion")
                .join("image-cache");
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(h) = std::env::var("HOME") {
            return PathBuf::from(h)
                .join(".local/share/fr.lelanation.companion/image-cache");
        }
    }
    PathBuf::from("image-cache")
}

fn mime_for(path: &str) -> &'static str {
    if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else if path.ends_with(".webp") {
        "image/webp"
    } else {
        "application/octet-stream"
    }
}
