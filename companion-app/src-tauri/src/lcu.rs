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
    // 1. League of Legends Config (AppData)
    let mut lol = PathBuf::from(&local_app_data);
    lol.push("Riot Games");
    lol.push("League of Legends");
    lol.push("Config");
    lol.push("lockfile");
    candidates.push(lol);
    // 2. Installation directory (default C:\Riot Games\League of Legends)
    for drive in ["C:", "D:", "E:"] {
        let mut root = PathBuf::from(drive);
        root.push("Riot Games");
        root.push("League of Legends");
        root.push("lockfile");
        candidates.push(root);
        let mut config = PathBuf::from(drive);
        config.push("Riot Games");
        config.push("League of Legends");
        config.push("Config");
        config.push("lockfile");
        candidates.push(config);
    }
    // 3. Riot Client last (we reject it, but list for debug)
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
    // Only accept League Client lockfile - Riot Client has different APIs (no /lol-summoner etc.)
    let process = parts[0].to_lowercase();
    if (process.contains("riot") || process.contains("riotclient")) && !process.contains("league") {
        return Err("Riot Client lockfile (not League Client)".into());
    }
    let port: u16 = parts[2].parse().map_err(|_| "Invalid port in lockfile")?;
    Ok(LockfileData {
        port,
        password: parts[3].to_string(),
    })
}

fn parse_process_commandline(line: &str) -> Option<LockfileData> {
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

#[cfg(target_os = "windows")]
fn read_from_process() -> Option<LockfileData> {
    use std::process::Command;
    let processes = ["LeagueClientUx.exe", "LeagueClient.exe"];
    for proc_name in processes {
        let filter = format!("Name='{}'", proc_name);
        let cmd = format!(
            "Get-CimInstance Win32_Process -Filter \"{}\" | Select-Object -ExpandProperty CommandLine",
            filter
        );
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &cmd])
            .output()
            .ok()?;
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let line = line.trim();
                if !line.is_empty() && line.contains("--app-port=") && line.contains("--remoting-auth-token=") {
                    if let Some(data) = parse_process_commandline(line) {
                        return Some(data);
                    }
                }
            }
        }
    }
    // Fallback: WMIC
    for proc_name in processes {
        let output = Command::new("cmd")
            .args([
                "/C",
                &format!("wmic process where name=\"{}\" get commandline 2>nul", proc_name),
            ])
            .output()
            .ok()?;
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().skip(1) {
                let line = line.trim();
                if !line.is_empty() && line.contains("--app-port=") && line.contains("--remoting-auth-token=") {
                    if let Some(data) = parse_process_commandline(line) {
                        return Some(data);
                    }
                }
            }
        }
    }
    None
}

#[cfg(not(target_os = "windows"))]
fn read_from_process() -> Option<LockfileData> {
    None
}

/// Debug info for troubleshooting connection issues.
pub fn debug_info() -> Result<String, String> {
    let mut lines = Vec::new();
    for path in lockfile_candidates() {
        let exists = path.exists();
        let mut info = format!("{}: {}", path.display(), if exists { "exists" } else { "absent" });
        if exists {
            if let Ok(contents) = std::fs::read_to_string(&path) {
                let preview = contents.trim();
                let first = preview.split(':').next().unwrap_or("");
                info.push_str(&format!(" process={}", first));
                match parse_lockfile_contents(preview) {
                    Ok(d) => info.push_str(&format!(" port={} (League Client)", d.port)),
                    Err(e) => info.push_str(&format!(" parse_err={}", e)),
                }
            }
        }
        lines.push(info);
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(data) = read_from_process() {
            lines.push(format!("Process LeagueClient/Ux: port={} (use this)", data.port));
        } else {
            lines.push("Process LeagueClientUx.exe / LeagueClient.exe: not found".into());
        }
    }
    Ok(lines.join("\n"))
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
