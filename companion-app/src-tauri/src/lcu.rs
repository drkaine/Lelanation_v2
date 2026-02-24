//! LCU (League Client Update) API: lockfile and authenticated HTTPS to localhost.

use serde::Deserialize;
use std::path::PathBuf;

#[cfg(target_os = "windows")]
fn default_lockfile_path() -> PathBuf {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "".into());
    let mut p = PathBuf::from(local_app_data);
    p.push("Riot Games");
    p.push("Riot Client");
    p.push("Config");
    p.push("lockfile");
    p
}

#[cfg(not(target_os = "windows"))]
fn default_lockfile_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "".into());
    let mut p = PathBuf::from(home);
    p.push(".config");
    p.push("Riot Games");
    p.push("Riot Client");
    p.push("Config");
    p.push("lockfile");
    p
}

/// Parsed lockfile contents: process name, PID, port, password, protocol.
#[derive(Debug, Clone, Deserialize)]
pub struct LockfileData {
    pub name: String,
    pub pid: u32,
    pub port: u16,
    pub password: String,
    pub protocol: String,
}

/// Read and parse the Riot Client lockfile.
/// Format: name:pid:port:password:protocol
pub fn read_lockfile() -> Result<LockfileData, String> {
    let path = default_lockfile_path();
    let contents = std::fs::read_to_string(&path).map_err(|e| {
        format!(
            "Lockfile not found or unreadable: {} ({})",
            path.display(),
            e
        )
    })?;
    let parts: Vec<&str> = contents.trim().split(':').collect();
    if parts.len() < 5 {
        return Err("Invalid lockfile format".into());
    }
    let port: u16 = parts[2].parse().map_err(|_| "Invalid port in lockfile")?;
    let pid: u32 = parts[1].parse().map_err(|_| "Invalid PID in lockfile")?;
    Ok(LockfileData {
        name: parts[0].to_string(),
        pid,
        port,
        password: parts[3].to_string(),
        protocol: parts[4].to_string(),
    })
}

/// Perform an authenticated request to the LCU API (localhost, HTTPS, self-signed).
pub fn lcu_request(
    port: u16,
    password: &str,
    method: &str,
    path: &str,
    body: Option<&str>,
) -> Result<String, String> {
    let url = format!("https://127.0.0.1:{}{}", port, path);
    let auth = base64::engine::general_purpose::STANDARD.encode(format!("riot:{}", password).as_bytes());
    let client = reqwest::blocking::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;
    let mut req = client
        .request(
            method
                .parse()
                .map_err(|_| "Invalid HTTP method")?,
            &url,
        )
        .header("Authorization", format!("Basic {}", auth))
        .header("Content-Type", "application/json");
    if let Some(b) = body {
        req = req.body(b.to_string());
    }
    let resp = req.send().map_err(|e| e.to_string())?;
    let status = resp.status();
    let text = resp.text().map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("LCU API error {}: {}", status, text));
    }
    Ok(text)
}
