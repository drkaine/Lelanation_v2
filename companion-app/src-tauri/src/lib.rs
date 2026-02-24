//! Lelanation Companion: LCU integration and Tauri commands.

mod lcu;

use serde::Serialize;
#[cfg(target_os = "windows")]
use std::path::Path;
#[cfg(target_os = "windows")]
use std::process::Command;

#[derive(Serialize)]
pub struct LcuConnectionResult {
    pub ok: bool,
    pub port: Option<u16>,
    pub error: Option<String>,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_lcu_connection,
            lcu_request,
            create_desktop_shortcut
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
