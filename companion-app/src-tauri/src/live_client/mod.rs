//! Live Client Data API (port 2999) — CS sampling during an active game.

use crate::postgame::PostGameStats;
use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::Value;
use std::time::Duration;

const LIVE_CLIENT_BASE: &str = "https://127.0.0.1:2999";

#[derive(Debug, Clone, Default)]
pub struct LiveCsSnapshot {
    pub cs_at_5: Option<u32>,
    pub cs_at_10: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct ActivePlayer {
    #[serde(rename = "summonerName")]
    summoner_name: String,
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())
}

fn get_json(client: &Client, path: &str) -> Result<Value, String> {
    let url = format!("{LIVE_CLIENT_BASE}{path}");
    let resp = client.get(&url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Live client HTTP {}", resp.status()));
    }
    resp.json::<Value>().map_err(|e| e.to_string())
}

#[allow(dead_code)]
pub fn is_available() -> bool {
    let Ok(client) = http_client() else {
        return false;
    };
    get_json(&client, "/liveclientdata/gamestats").is_ok()
}

pub fn active_summoner_name() -> Option<String> {
    let client = http_client().ok()?;
    let v = get_json(&client, "/liveclientdata/activeplayer").ok()?;
    if let Ok(p) = serde_json::from_value::<ActivePlayer>(v) {
        if !p.summoner_name.is_empty() {
            return Some(p.summoner_name);
        }
    }
    None
}

pub fn game_time_seconds() -> Option<f64> {
    let client = http_client().ok()?;
    let v = get_json(&client, "/liveclientdata/gamestats").ok()?;
    v.get("gameTime").and_then(|t| t.as_f64())
}

fn player_scores(summoner_name: &str) -> Option<Value> {
    let client = http_client().ok()?;
    let path = format!(
        "/liveclientdata/playerscores?summonerName={}",
        urlencoding_encode(summoner_name)
    );
    get_json(&client, &path).ok()
}

fn creep_score_for(summoner_name: &str) -> Option<u32> {
    player_scores(summoner_name)?
        .get("creepScore")
        .and_then(|x| x.as_u64())
        .map(|n| n as u32)
}

/// Partial stats while a game is in progress (Live Client API).
pub fn fetch_live_stats(cs_snapshot: &LiveCsSnapshot) -> Option<PostGameStats> {
    let name = active_summoner_name()?;
    let scores = player_scores(&name)?;
    let game_time = game_time_seconds().unwrap_or(0.0) as u32;

    Some(PostGameStats {
        game_duration_seconds: game_time,
        cs_at_5: cs_snapshot.cs_at_5,
        cs_at_10: cs_snapshot.cs_at_10,
        cs_total: scores
            .get("creepScore")
            .and_then(|x| x.as_u64())
            .unwrap_or(0) as u32,
        kills: scores
            .get("kills")
            .and_then(|x| x.as_u64())
            .unwrap_or(0) as u32,
        deaths: scores
            .get("deaths")
            .and_then(|x| x.as_u64())
            .unwrap_or(0) as u32,
        assists: scores
            .get("assists")
            .and_then(|x| x.as_u64())
            .unwrap_or(0) as u32,
        wards_placed: scores
            .get("wardScore")
            .and_then(|x| x.as_f64())
            .map(|n| n.round() as u32)
            .unwrap_or(0),
        ..Default::default()
    })
}

fn urlencoding_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Sample CS at ~5:00 and ~10:00 game time (±20s tolerance).
pub fn sample_cs_milestones(snapshot: &mut LiveCsSnapshot) {
    let Some(game_time) = game_time_seconds() else {
        return;
    };
    let Some(name) = active_summoner_name() else {
        return;
    };
    let Some(cs) = creep_score_for(&name) else {
        return;
    };

    if snapshot.cs_at_5.is_none() && (280.0..=320.0).contains(&game_time) {
        snapshot.cs_at_5 = Some(cs);
    }
    if snapshot.cs_at_10.is_none() && (580.0..=620.0).contains(&game_time) {
        snapshot.cs_at_10 = Some(cs);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_encode_summoner_name() {
        assert_eq!(urlencoding_encode("Player One"), "Player%20One");
    }
}
