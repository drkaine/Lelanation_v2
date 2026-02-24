//! Lelanation Companion: LCU integration and Tauri commands.

mod lcu;

use serde::Serialize;

#[derive(Serialize)]
pub struct LcuConnectionResult {
    pub ok: bool,
    pub port: Option<u16>,
    pub error: Option<String>,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_lcu_connection, lcu_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
