//! Lelanation Companion: LCU integration and Tauri commands.

mod app_config;
mod commands;
mod image_cache;
mod import_bridge;
mod lcu;
mod state;

use app_config::{load_companion_config, save_companion_config, CompanionConfig};
use commands::{
    apply_build, companion_import_build, get_lcu_status, get_pending_build, resolve_champion_id,
};
use image_cache::ImageCacheState;
use lcu::watcher;
use serde::Serialize;
use state::AppState;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::WebviewWindowBuilder;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use std::path::Path;
#[cfg(target_os = "windows")]
use std::process::Command;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn sanitize_item_set_stem(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars().take(48) {
        if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
            out.push(c);
        } else if c.is_whitespace() {
            out.push('_');
        }
    }
    if out.is_empty() {
        "build".into()
    } else {
        out
    }
}

/// Writes an official-format item set JSON under
/// `<League>/Config/Champions/<ChampionId>/Recommended/lelanation_<stem>.json`.
#[tauri::command]
fn companion_write_champion_item_set(
    champion_key: String,
    title_stem: String,
    json_content: String,
) -> Result<String, String> {
    let cfg = load_companion_config();
    let root = cfg
        .league_install_path
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            "League of Legends install folder is not configured (complete onboarding)."
                .to_string()
        })?;

    let safe_champ: String = champion_key
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    if safe_champ.is_empty() {
        return Err("Invalid champion id for item set file path.".into());
    }

    let stem = sanitize_item_set_stem(&title_stem);
    let dir = PathBuf::from(root)
        .join("Config")
        .join("Champions")
        .join(&safe_champ)
        .join("Recommended");

    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create League Recommended folder: {e}"))?;

    let path = dir.join(format!("lelanation_{stem}.json"));
    std::fs::write(&path, json_content.as_bytes())
        .map_err(|e| format!("Cannot write item set file: {e}"))?;

    Ok(path.display().to_string())
}

#[derive(Serialize)]
pub struct LcuConnectionResult {
    pub ok: bool,
    pub port: Option<u16>,
    pub error: Option<String>,
}

#[tauri::command]
fn companion_get_config() -> CompanionConfig {
    let mut cfg = load_companion_config();
    if let Some(p) = app_config::take_installer_league_path_hint() {
        let path_empty = cfg
            .league_install_path
            .as_deref()
            .map(|s| s.trim().is_empty())
            .unwrap_or(true);
        if path_empty {
            cfg.league_install_path = Some(p);
            let _ = save_companion_config(&cfg);
        }
    }
    cfg
}

#[tauri::command]
fn companion_save_config(cfg: CompanionConfig) -> Result<(), String> {
    save_companion_config(&cfg)
}

#[derive(Serialize)]
pub struct ShortcutResult {
    pub ok: bool,
    pub message: String,
}

/// Returns LCU connection info if the client is running (port only; token never sent to frontend).
#[tauri::command]
fn get_lcu_connection() -> LcuConnectionResult {
    match lcu::read_lockfile() {
        Ok(data) => LcuConnectionResult {
            ok: true,
            port: Some(data.port),
            error: None,
        },
        Err(e) => LcuConnectionResult {
            ok: false,
            port: None,
            error: Some(e),
        },
    }
}

/// Performs an authenticated request to the LCU API. Token is read from lockfile in Rust only.
#[tauri::command]
fn lcu_request(method: String, path: String, body: Option<String>) -> Result<String, String> {
    let data = lcu::read_lockfile()?;
    lcu::lcu_request(data.port, &data.password, &method, &path, body.as_deref())
}

/// Returns debug info for LCU connection (paths tried, process result).
#[tauri::command]
fn lcu_debug() -> Result<String, String> {
    lcu::debug_info()
}

#[cfg(target_os = "windows")]
fn ps_escape_single_quoted(input: &str) -> String {
    input.replace('\'', "''")
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn create_desktop_shortcut() -> Result<ShortcutResult, String> {
    let exe_path = std::env::current_exe().map_err(|e| format!("Cannot resolve executable path: {e}"))?;
    let exe_str = exe_path
        .to_str()
        .ok_or_else(|| "Executable path is not valid UTF-8".to_string())?;
    let working_dir = exe_path
        .parent()
        .and_then(Path::to_str)
        .ok_or_else(|| "Cannot resolve executable working directory".to_string())?;
    let shortcut_name = "Lelanation Companion.lnk";
    let icon_location = format!("{exe_str},0");

    let script = format!(
        "$desktop = [Environment]::GetFolderPath('Desktop'); \
         $shortcutPath = Join-Path $desktop '{shortcut}'; \
         $wsh = New-Object -ComObject WScript.Shell; \
         $s = $wsh.CreateShortcut($shortcutPath); \
         $s.TargetPath = '{target}'; \
         $s.WorkingDirectory = '{workdir}'; \
         $s.IconLocation = '{icon}'; \
         $s.Description = 'Lelanation Companion'; \
         $s.Save();",
        shortcut = ps_escape_single_quoted(shortcut_name),
        target = ps_escape_single_quoted(exe_str),
        workdir = ps_escape_single_quoted(working_dir),
        icon = ps_escape_single_quoted(&icon_location)
    );

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to run PowerShell: {e}"))?;

    if output.status.success() {
        Ok(ShortcutResult {
            ok: true,
            message: "Desktop shortcut created.".to_string(),
        })
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "PowerShell failed while creating desktop shortcut.".to_string()
        } else {
            format!("PowerShell error: {stderr}")
        })
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn create_desktop_shortcut() -> Result<ShortcutResult, String> {
    Err("Desktop shortcut creation is only supported on Windows.".to_string())
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn uninstall_app() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| format!("Cannot resolve executable path: {e}"))?;
    let install_dir = exe_path
        .parent()
        .ok_or_else(|| "Cannot resolve install directory".to_string())?;

    let uninstaller = install_dir.join("uninstall.exe");
    if !uninstaller.exists() {
        return Err("Uninstaller not found. The app may have been installed manually.".to_string());
    }

    Command::new(&uninstaller)
        .spawn()
        .map_err(|e| format!("Failed to launch uninstaller: {e}"))?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn uninstall_app() -> Result<(), String> {
    Err("Uninstall is only supported on Windows.".to_string())
}

#[tauri::command]
fn set_image_api_base(state: tauri::State<Arc<ImageCacheState>>, base: String) {
    if let Ok(mut w) = state.api_base.write() {
        *w = base;
    }
}

#[tauri::command]
fn prefetch_images(state: tauri::State<Arc<ImageCacheState>>, paths: Vec<String>) -> Result<u32, String> {
    let api_base = state.api_base.read().map_err(|e| e.to_string())?.clone();
    let client = reqwest::blocking::Client::new();
    let mut count = 0u32;
    for path in &paths {
        let local = state.cache_dir.join(path);
        if local.exists() {
            continue;
        }
        let url = format!("{}/images/game/{}", api_base, path);
        if let Ok(resp) = client.get(&url).send() {
            if resp.status().is_success() {
                if let Ok(bytes) = resp.bytes() {
                    if let Some(parent) = local.parent() {
                        std::fs::create_dir_all(parent).ok();
                    }
                    std::fs::write(&local, &bytes).ok();
                    count += 1;
                }
            }
        }
    }
    Ok(count)
}

#[tauri::command]
fn clear_image_cache(state: tauri::State<Arc<ImageCacheState>>) -> Result<(), String> {
    if state.cache_dir.exists() {
        std::fs::remove_dir_all(&state.cache_dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&state.cache_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let image_cache = Arc::new(ImageCacheState::new());
    let protocol_cache = Arc::clone(&image_cache);
    let app_state = Arc::new(AppState::new());
    let watcher_state = Arc::clone(&app_state);

    tauri::Builder::default()
        .manage(image_cache)
        .manage(app_state)
        .setup(move |app| {
            import_bridge::start(app.handle().clone());
            watcher::start(app.handle().clone(), watcher_state);

            let window_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .or_else(|| app.config().app.windows.first())
                .ok_or("main window config missing")?;

            WebviewWindowBuilder::from_config(app.handle(), window_config)
                .map_err(|e| format!("invalid window config: {e}"))?
                .initialization_script_for_all_frames(include_str!(
                    "../scripts/companion-frame-bridge.js"
                ))
                .build()
                .map_err(|e| format!("failed to create main window: {e}"))?;

            Ok(())
        })
        .register_uri_scheme_protocol("cachedimg", move |_ctx, request| {
            let path = request.uri().path().trim_start_matches('/');

            match protocol_cache.get_or_download(path) {
                Some((bytes, content_type)) => tauri::http::Response::builder()
                    .header("Content-Type", content_type)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(bytes)
                    .unwrap(),
                None => tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap(),
            }
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            companion_get_config,
            companion_save_config,
            companion_write_champion_item_set,
            companion_import_build,
            resolve_champion_id,
            get_lcu_connection,
            get_lcu_status,
            get_pending_build,
            apply_build,
            lcu_request,
            lcu_debug,
            create_desktop_shortcut,
            uninstall_app,
            set_image_api_base,
            prefetch_images,
            clear_image_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
