//! LCU (League Client Update) API: lockfile, authenticated HTTPS, runes/items/spells export.

mod auto_apply;
mod items;
mod runes;
mod summoners;
pub mod watcher;

use base64::Engine;
use serde::Deserialize;
use std::path::PathBuf;

pub use auto_apply::try_auto_apply;
pub use items::{apply_item_set, ItemSetData};
pub use runes::{apply_rune_page, RunePageData};
pub use summoners::apply_summoner_spells;

/// Parsed lockfile contents: process name, PID, port, password, protocol.
#[derive(Debug, Clone, Deserialize)]
pub struct LockfileData {
    pub port: u16,
    pub password: String,
}

/// Authenticated LCU HTTP client (localhost, self-signed TLS).
#[derive(Debug, Clone)]
pub struct LcuClient {
    port: u16,
    password: String,
    client: reqwest::blocking::Client,
}

impl LcuClient {
    pub fn from_lockfile(data: LockfileData) -> Result<Self, String> {
        let client = reqwest::blocking::Client::builder()
            .danger_accept_invalid_certs(true)
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self {
            port: data.port,
            password: data.password,
            client,
        })
    }

    pub fn connect() -> Result<Self, String> {
        Self::from_lockfile(find_lockfile()?)
    }

    pub fn is_connected(&self) -> bool {
        self.get("/lol-service-status/v1/lcu-info").is_ok()
    }

    pub fn get(&self, path: &str) -> Result<String, String> {
        self.request("GET", path, None)
    }

    pub fn post(&self, path: &str, body: &str) -> Result<String, String> {
        self.request("POST", path, Some(body))
    }

    pub fn put(&self, path: &str, body: &str) -> Result<String, String> {
        self.request("PUT", path, Some(body))
    }

    pub fn patch(&self, path: &str, body: &str) -> Result<String, String> {
        self.request("PATCH", path, Some(body))
    }

    pub fn request(&self, method: &str, path: &str, body: Option<&str>) -> Result<String, String> {
        let url = format!("https://127.0.0.1:{}{}", self.port, path);
        let auth = base64::engine::general_purpose::STANDARD
            .encode(format!("riot:{}", self.password).as_bytes());
        let mut req = self
            .client
            .request(
                method
                    .parse()
                    .map_err(|_| "Invalid HTTP method".to_string())?,
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
}

pub fn find_lockfile() -> Result<LockfileData, String> {
    read_lockfile()
}

fn push_user_league_paths(candidates: &mut Vec<PathBuf>, league_install: Option<&str>) {
    let Some(dir) = league_install.map(str::trim).filter(|s| !s.is_empty()) else {
        return;
    };
    let root = PathBuf::from(dir);
    candidates.push(root.join("lockfile"));
    candidates.push(root.join("Config").join("lockfile"));
    candidates.push(root.join("Game").join("lockfile"));
}

#[cfg(target_os = "windows")]
fn lockfile_candidates(league_install: Option<&str>) -> Vec<PathBuf> {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "".into());
    let mut candidates = Vec::new();
    push_user_league_paths(&mut candidates, league_install);
    if let Ok(custom) = std::env::var("LELANATION_LCU_LOCKFILE") {
        let p = PathBuf::from(custom.trim());
        if !p.as_os_str().is_empty() {
            candidates.push(p);
        }
    }
    let mut lol = PathBuf::from(&local_app_data);
    lol.push("Riot Games");
    lol.push("League of Legends");
    lol.push("Config");
    lol.push("lockfile");
    candidates.push(lol);
    for drive in ["C:", "D:", "E:", "F:"] {
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
    let mut riot = PathBuf::from(&local_app_data);
    riot.push("Riot Games");
    riot.push("Riot Client");
    riot.push("Config");
    riot.push("lockfile");
    candidates.push(riot);
    candidates
}

#[cfg(not(target_os = "windows"))]
fn lockfile_candidates(league_install: Option<&str>) -> Vec<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "".into());
    let mut candidates = Vec::new();
    push_user_league_paths(&mut candidates, league_install);
    if let Ok(custom) = std::env::var("LELANATION_LCU_LOCKFILE") {
        let s = custom.trim();
        if !s.is_empty() {
            let expanded = if s.starts_with("~/") {
                format!("{}/{}", home, &s[2..])
            } else {
                s.to_string()
            };
            candidates.push(PathBuf::from(expanded));
        }
    }
    let mut lol_config = PathBuf::from(&home);
    lol_config.push(".config");
    lol_config.push("Riot Games");
    lol_config.push("League of Legends");
    lol_config.push("Config");
    lol_config.push("lockfile");
    candidates.push(lol_config);
    #[cfg(target_os = "macos")]
    {
        let mut lol_macos = PathBuf::from(&home);
        lol_macos.push("Library");
        lol_macos.push("Application Support");
        lol_macos.push("Riot Games");
        lol_macos.push("League of Legends");
        lol_macos.push("Config");
        lol_macos.push("lockfile");
        candidates.insert(0, lol_macos);
    }
    let mut riot = PathBuf::from(&home);
    riot.push(".config");
    riot.push("Riot Games");
    riot.push("Riot Client");
    riot.push("Config");
    riot.push("lockfile");
    candidates.push(riot);
    #[cfg(target_os = "macos")]
    {
        let mut riot_macos = PathBuf::from(&home);
        riot_macos.push("Library");
        riot_macos.push("Application Support");
        riot_macos.push("Riot Games");
        riot_macos.push("Riot Client");
        riot_macos.push("Config");
        riot_macos.push("lockfile");
        candidates.push(riot_macos);
    }
    candidates
}

pub fn parse_lockfile_contents(contents: &str) -> Result<LockfileData, String> {
    let parts: Vec<&str> = contents.trim().split(':').collect();
    if parts.len() < 5 {
        return Err("Invalid lockfile format".into());
    }
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

#[cfg(any(target_os = "windows", target_os = "macos"))]
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
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let processes = ["LeagueClientUx.exe", "LeagueClient.exe"];
    for proc_name in processes {
        let filter = format!("Name='{}'", proc_name);
        let cmd = format!(
            "Get-CimInstance Win32_Process -Filter \"{}\" | Select-Object -ExpandProperty CommandLine",
            filter
        );
        if let Ok(output) = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &cmd,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let line = line.trim();
                    if !line.is_empty()
                        && line.contains("--app-port=")
                        && line.contains("--remoting-auth-token=")
                    {
                        if let Some(data) = parse_process_commandline(line) {
                            return Some(data);
                        }
                    }
                }
            }
        }
    }
    for proc_name in processes {
        if let Ok(output) = Command::new("cmd")
            .args([
                "/C",
                &format!(
                    "wmic process where name=\"{}\" get commandline 2>nul",
                    proc_name
                ),
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines().skip(1) {
                    let line = line.trim();
                    if !line.is_empty()
                        && line.contains("--app-port=")
                        && line.contains("--remoting-auth-token=")
                    {
                        if let Some(data) = parse_process_commandline(line) {
                            return Some(data);
                        }
                    }
                }
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn read_from_process() -> Option<LockfileData> {
    use std::process::Command;
    let pgrep = Command::new("pgrep")
        .args(["-x", "LeagueClientUx"])
        .output()
        .ok()?;
    let pid = String::from_utf8_lossy(&pgrep.stdout).trim().to_string();
    if pid.is_empty() {
        return None;
    }
    let ps = Command::new("ps")
        .args(["-p", &pid, "-o", "args="])
        .output()
        .ok()?;
    if !ps.status.success() {
        return None;
    }
    let line = String::from_utf8_lossy(&ps.stdout);
    if line.contains("--app-port=") && line.contains("--remoting-auth-token=") {
        parse_process_commandline(&line)
    } else {
        None
    }
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn read_from_process() -> Option<LockfileData> {
    None
}

pub fn debug_info() -> Result<String, String> {
    let cfg = crate::app_config::load_companion_config();
    let user_dir = cfg.league_install_path.as_deref();
    let mut lines = Vec::new();
    for path in lockfile_candidates(user_dir) {
        let exists = path.exists();
        let mut info = format!(
            "{}: {}",
            path.display(),
            if exists { "exists" } else { "absent" }
        );
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
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        if let Some(data) = read_from_process() {
            lines.push(format!("Process LeagueClientUx: port={} (use this)", data.port));
        } else {
            #[cfg(target_os = "windows")]
            lines.push("Process LeagueClientUx.exe / LeagueClient.exe: not found".into());
            #[cfg(target_os = "macos")]
            lines.push("Process LeagueClientUx: not found".into());
        }
    }
    Ok(lines.join("\n"))
}

pub fn read_lockfile() -> Result<LockfileData, String> {
    let cfg = crate::app_config::load_companion_config();
    let user_dir = cfg.league_install_path.as_deref();
    for path in lockfile_candidates(user_dir) {
        if let Ok(contents) = std::fs::read_to_string(&path) {
            if let Ok(data) = parse_lockfile_contents(&contents) {
                return Ok(data);
            }
        }
    }
    if let Some(data) = read_from_process() {
        return Ok(data);
    }
    let tried: Vec<String> = lockfile_candidates(user_dir)
        .into_iter()
        .map(|p| p.display().to_string())
        .collect();
    Err(format!(
        "League Client not found. Ensure League of Legends is open (home screen). Tried: {}",
        tried.join(", ")
    ))
}

/// Legacy helper used by existing commands.
pub fn lcu_request(
    port: u16,
    password: &str,
    method: &str,
    path: &str,
    body: Option<&str>,
) -> Result<String, String> {
    let client = LcuClient::from_lockfile(LockfileData {
        port,
        password: password.to_string(),
    })?;
    client.request(method, path, body)
}

/// Current gameflow phase from LCU, or `"None"` if unavailable.
pub fn fetch_gameflow_phase(client: &LcuClient) -> Result<String, String> {
    let raw = client.get("/lol-gameflow/v1/gameflow-phase")?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid gameflow phase JSON: {e}"))
}

/// Local player's champion id during champ select, if detectable.
pub fn fetch_local_champion_id(client: &LcuClient) -> Option<u32> {
    let raw = client.get("/lol-champ-select/v1/session").ok()?;
    let session: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let local_cell = session.get("localPlayerCellId")?.as_i64()?;
    let my_team = session.get("myTeam")?.as_array()?;
    for member in my_team {
        if member.get("cellId")?.as_i64()? == local_cell {
            return member.get("championId")?.as_u64().map(|id| id as u32);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_lockfile() {
        let data = parse_lockfile_contents("LeagueClient:1234:54321:secret-token:https").unwrap();
        assert_eq!(data.port, 54321);
        assert_eq!(data.password, "secret-token");
    }

    #[test]
    fn reject_riot_client_lockfile() {
        let err = parse_lockfile_contents("RiotClient:1:2:pw:https").unwrap_err();
        assert!(err.contains("Riot Client"));
    }

    #[test]
    fn reject_invalid_lockfile_format() {
        assert!(parse_lockfile_contents("too:few").is_err());
    }
}
