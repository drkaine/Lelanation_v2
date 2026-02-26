//! LCU (League Client Update) API: lockfile and authenticated HTTPS to localhost.
//!
//! The League Client (LCU) creates a lockfile when running. We try multiple locations:
//! 1. League of Legends Config (AppData) - LCU lockfile when at LoL home screen
//! 2. Riot Client Config (AppData) - used when Riot Client embeds League
//! 3. Process method (Windows): parse LeagueClientUx.exe command line for --app-port and --remoting-auth-token

use base64::Engine;
use serde::Deserialize;
use std::path::PathBuf;

#[cfg(target_os = "windows")]
fn lockfile_candidates() -> Vec<PathBuf> {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "".into());
    let mut candidates = Vec::new();
    // 1. League of Legends Config - LCU lockfile (when at LoL home screen)
    let mut lol = PathBuf::from(&local_app_data);
    lol.push("Riot Games");
    lol.push("League of Legends");
    lol.push("Config");
    lol.push("lockfile");
    candidates.push(lol);
    // 2. Riot Client Config - used when Riot Client hosts the League UI
    let mut riot = PathBuf::from(&local_app_data);
    riot.push("Riot Games");
    riot.push("Riot Client");
    riot.push("Config");
    riot.push("lockfile");
    candidates.push(riot);
    candidates
}

#[cfg(not(target_os = "windows"))]
fn lockfile_candidates() -> Vec<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "".into());
    let mut candidates = Vec::new();
    let mut lol = PathBuf::from(&home);
    lol.push(".config");
    lol.push("Riot Games");
    lol.push("League of Legends");
    lol.push("Config");
    lol.push("lockfile");
    candidates.push(lol);
    let mut riot = PathBuf::from(&home);
    riot.push(".config");
    riot.push("Riot Games");
    riot.push("Riot Client");
    riot.push("Config");
    riot.push("lockfile");
    candidates.push(riot);
    candidates
}

/// Parsed lockfile contents: process name, PID, port, password, protocol.
#[derive(Debug, Clone, Deserialize)]
pub struct LockfileData {
    pub port: u16,
    pub password: String,
}

fn parse_lockfile_contents(contents: &str) -> Result<LockfileData, String> {
    let parts: Vec<&str> = contents.trim().split(':').collect();
    if parts.len() < 5 {
        return Err("Invalid lockfile format".into());
    }
    let port: u16 = parts[2].parse().map_err(|_| "Invalid port in lockfile")?;
    Ok(LockfileData {
        port,
        password: parts[3].to_string(),
    })
}

#[cfg(target_os = "windows")]
fn read_from_process() -> Option<LockfileData> {
    use std::process::Command;
    // Get LeagueClientUx.exe command line (contains --app-port and --remoting-auth-token)
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.lines().next()?.trim();
    if line.is_empty() {
        return None;
    }
    // Parse --app-port=12345 and --remoting-auth-token=xxxx
    let port = line
        .split_whitespace()
        .find(|s| s.starts_with("--app-port="))?
        .strip_prefix("--app-port=")?
        .parse::<u16>()
        .ok()?;
    let password = line
        .split_whitespace()
        .find(|s| s.starts_with("--remoting-auth-token="))?
        .strip_prefix("--remoting-auth-token=")?
        .to_string();
    Some(LockfileData { port, password })
}

#[cfg(not(target_os = "windows"))]
fn read_from_process() -> Option<LockfileData> {
    None
}

/// Read and parse the LCU lockfile. Tries lockfile paths first, then process method on Windows.
pub fn read_lockfile() -> Result<LockfileData, String> {
    for path in lockfile_candidates() {
        if let Ok(contents) = std::fs::read_to_string(&path) {
            if let Ok(data) = parse_lockfile_contents(&contents) {
                return Ok(data);
            }
        }
    }
    if let Some(data) = read_from_process() {
        return Ok(data);
    }
    let tried: Vec<String> = lockfile_candidates()
        .into_iter()
        .map(|p| p.display().to_string())
        .collect();
    Err(format!(
        "League Client not found. Ensure League of Legends is open (home screen). Tried: {}",
        tried.join(", ")
    ))
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
    let auth = base64::engine::general_purpose::STANDARD
        .encode(format!("riot:{}", password).as_bytes());
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
