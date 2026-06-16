//! Post-game stats from LCU `/lol-end-of-game/v1/eog-stats-block`.

use crate::lcu::LcuClient;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PostGameStats {
    pub game_id: Option<u64>,
    pub game_duration_seconds: u32,
    pub cs_at_5: Option<u32>,
    pub cs_at_10: Option<u32>,
    pub cs_total: u32,
    pub gold_earned: u32,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub wards_placed: u32,
    pub vision_wards_bought: u32,
    pub wards_killed: u32,
    pub champion_id: u32,
    pub win: bool,
    pub team_dragon_kills: u32,
    pub team_baron_kills: u32,
    #[serde(default)]
    pub queue_id: Option<u32>,
    #[serde(default)]
    pub queue_type: String,
    #[serde(default)]
    pub game_mode: String,
    #[serde(default)]
    pub game_type: String,
    #[serde(default)]
    pub ranked: bool,
    #[serde(default)]
    pub player_rank: String,
    #[serde(default)]
    pub player_lp: Option<i32>,
    #[serde(default)]
    pub lp_change: Option<i32>,
    #[serde(default)]
    pub player_elo: Option<i32>,
    #[serde(default)]
    pub ally_team_avg_elo: Option<i32>,
    #[serde(default)]
    pub enemy_team_avg_elo: Option<i32>,
    #[serde(default)]
    pub game_avg_elo: Option<i32>,
}

fn local_summoner_id(client: &LcuClient) -> Option<u64> {
    let raw = client.get("/lol-login/v1/session").ok()?;
    let v: Value = serde_json::from_str(&raw).ok()?;
    v.get("summonerId").and_then(|x| x.as_u64())
}

fn stat_u32(stats: &Value, keys: &[&str]) -> u32 {
    for key in keys {
        if let Some(n) = stats.get(*key).and_then(|x| x.as_u64()) {
            return n as u32;
        }
        if let Some(s) = stats.get(*key).and_then(|x| x.as_str()) {
            if let Ok(n) = s.parse::<u32>() {
                return n;
            }
        }
    }
    0
}

fn i32_from(v: &Value, keys: &[&str]) -> Option<i32> {
    for key in keys {
        if let Some(n) = v.get(*key).and_then(|x| x.as_i64()) {
            return Some(n as i32);
        }
    }
    None
}

fn player_summoner_id(player: &Value) -> Option<u64> {
    player
        .get("summonerId")
        .or_else(|| player.get("SUMMONER_ID"))
        .and_then(|x| x.as_u64())
}

fn find_in_players<'a>(players: &'a [Value], summoner_id: u64) -> Option<&'a Value> {
    players
        .iter()
        .find(|p| player_summoner_id(p) == Some(summoner_id))
}

fn find_local_player<'a>(root: &'a Value, summoner_id: u64) -> Option<&'a Value> {
    if player_summoner_id(root) == Some(summoner_id) {
        return Some(root);
    }
    if let Some(players) = root.get("players").and_then(|p| p.as_array()) {
        if let Some(p) = find_in_players(players, summoner_id) {
            return Some(p);
        }
    }
    if let Some(players) = root.get("playerStats").and_then(|p| p.as_array()) {
        if let Some(p) = find_in_players(players, summoner_id) {
            return Some(p);
        }
    }
    if let Some(teams) = root.get("teams").and_then(|t| t.as_array()) {
        for team in teams {
            if let Some(players) = team.get("players").and_then(|p| p.as_array()) {
                if let Some(p) = find_in_players(players, summoner_id) {
                    return Some(p);
                }
            }
        }
    }
    None
}

fn parse_player_stats(player: &Value, team_won: bool) -> PostGameStats {
    let stats = player
        .get("stats")
        .or_else(|| player.get("playerStats"))
        .unwrap_or(player);

    let cs_minions = stat_u32(stats, &["TOTAL_MINIONS_KILLED", "minionsKilled", "cs"]);
    let cs_jungle = stat_u32(
        stats,
        &[
            "NEUTRAL_MINIONS_KILLED",
            "neutralMinionsKilled",
            "jungleMinionsKilled",
        ],
    );

    PostGameStats {
        game_duration_seconds: stat_u32(
            stats,
            &["TIME_PLAYED", "gameDuration", "gameLength"],
        ),
        cs_total: cs_minions.saturating_add(cs_jungle),
        gold_earned: stat_u32(stats, &["GOLD_EARNED", "goldEarned"]),
        kills: stat_u32(stats, &["CHAMPIONS_KILLED", "kills"]),
        deaths: stat_u32(stats, &["NUM_DEATHS", "deaths"]),
        assists: stat_u32(stats, &["ASSISTS", "assists"]),
        wards_placed: stat_u32(stats, &["WARD_PLACED", "wardsPlaced", "wardPlaced"]),
        vision_wards_bought: stat_u32(
            stats,
            &[
                "VISION_WARDS_BOUGHT_IN_GAME",
                "visionWardsBoughtInGame",
                "visionWardsBought",
            ],
        ),
        wards_killed: stat_u32(stats, &["WARD_KILLED", "wardsKilled", "wardKilled"]),
        champion_id: stat_u32(stats, &["SKIN", "championId"]).max(
            player
                .get("championId")
                .and_then(|x| x.as_u64())
                .unwrap_or(0) as u32,
        ),
        win: player
            .get("win")
            .and_then(|x| x.as_bool())
            .unwrap_or(team_won),
        ..Default::default()
    }
}

fn team_objective_kills(root: &Value, local_team_id: Option<u32>, key: &str) -> u32 {
    let teams = root.get("teams").and_then(|t| t.as_array());
    let Some(teams) = teams else {
        return 0;
    };
    for team in teams {
        if let Some(tid) = local_team_id {
            let team_id = team
                .get("teamId")
                .or_else(|| team.get("TEAM"))
                .and_then(|x| x.as_u64())
                .unwrap_or(0) as u32;
            if team_id != tid {
                continue;
            }
        }
        return team
            .get(key)
            .or_else(|| team.get(&key.to_ascii_lowercase()))
            .and_then(|x| x.as_u64())
            .unwrap_or(0) as u32;
    }
    0
}

fn player_elo_value(player: &Value) -> Option<i32> {
    player
        .get("elo")
        .and_then(|x| x.as_i64())
        .map(|n| n as i32)
        .filter(|&e| e > 0)
}

fn avg_i32(values: &[i32]) -> Option<i32> {
    if values.is_empty() {
        return None;
    }
    Some(values.iter().sum::<i32>() / values.len() as i32)
}

fn push_player_elo(
    ally: &mut Vec<i32>,
    enemy: &mut Vec<i32>,
    all: &mut Vec<i32>,
    player: &Value,
    local_team: Option<u32>,
    team_id: Option<u32>,
) {
    let Some(elo) = player_elo_value(player) else {
        return;
    };
    all.push(elo);
    match (local_team, team_id) {
        (Some(lt), Some(tid)) if lt == tid => ally.push(elo),
        (Some(_), Some(_)) => enemy.push(elo),
        _ => {}
    }
}

fn collect_team_elos(root: &Value, local_team: Option<u32>) -> (Vec<i32>, Vec<i32>, Vec<i32>) {
    let mut ally = Vec::new();
    let mut enemy = Vec::new();
    let mut all = Vec::new();

    if let Some(teams) = root.get("teams").and_then(|t| t.as_array()) {
        for team in teams {
            let team_id = team
                .get("teamId")
                .or_else(|| team.get("TEAM"))
                .and_then(|x| x.as_u64())
                .map(|n| n as u32);
            if let Some(players) = team.get("players").and_then(|p| p.as_array()) {
                for player in players {
                    push_player_elo(&mut ally, &mut enemy, &mut all, player, local_team, team_id);
                }
            }
        }
    }

    if all.is_empty() {
        if let Some(players) = root.get("players").and_then(|p| p.as_array()) {
            for player in players {
                let team_id = player
                    .get("team")
                    .or_else(|| player.get("teamId"))
                    .and_then(|x| x.as_u64())
                    .map(|n| n as u32);
                push_player_elo(&mut ally, &mut enemy, &mut all, player, local_team, team_id);
            }
        }
    }

    (ally, enemy, all)
}

fn apply_eog_metadata(root: &Value, player: &Value, stats: &mut PostGameStats) {
    if stats.game_duration_seconds == 0 {
        stats.game_duration_seconds = root
            .get("gameLength")
            .and_then(|x| x.as_u64())
            .map(|n| n as u32)
            .unwrap_or(0);
    }

    stats.queue_type = root
        .get("queueType")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    stats.game_mode = root
        .get("gameMode")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    stats.game_type = root
        .get("gameType")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    stats.ranked = root.get("ranked").and_then(|x| x.as_bool()).unwrap_or(false);

    stats.lp_change = i32_from(root, &["eloChange", "leaguePointsDelta"]);
    stats.player_elo = i32_from(root, &["elo"]);

    if stats.lp_change.is_none() {
        stats.lp_change = i32_from(player, &["eloChange", "leaguePointsDelta"]);
    }
    if stats.player_elo.is_none() {
        stats.player_elo = player_elo_value(player);
    }

    let local_team = player
        .get("team")
        .or_else(|| player.get("teamId"))
        .and_then(|x| x.as_u64())
        .map(|n| n as u32);
    let (ally, enemy, all) = collect_team_elos(root, local_team);
    stats.ally_team_avg_elo = avg_i32(&ally);
    stats.enemy_team_avg_elo = avg_i32(&enemy);
    stats.game_avg_elo = avg_i32(&all);
}

fn format_rank_tier(tier: &str, division: &str) -> String {
    if tier.is_empty() || tier.eq_ignore_ascii_case("UNRANKED") {
        return String::new();
    }
    let tier_lower = tier.to_ascii_lowercase();
    let tier_fmt = tier_lower
        .chars()
        .next()
        .map(|c| c.to_uppercase().collect::<String>())
        .unwrap_or_default()
        + &tier_lower.chars().skip(1).collect::<String>();
    if division.is_empty() {
        tier_fmt
    } else {
        format!("{tier_fmt} {division}")
    }
}

fn fetch_player_rank(client: &LcuClient, summoner_id: u64) -> (String, Option<i32>) {
    let path = format!("/lol-ranked/v1/ranked-overview/{summoner_id}");
    let raw = match client.get(&path) {
        Ok(r) => r,
        Err(_) => return (String::new(), None),
    };
    let v: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return (String::new(), None),
    };

    let queues = v
        .get("queues")
        .and_then(|q| q.as_array())
        .or_else(|| v.as_array());

    let Some(queues) = queues else {
        return (String::new(), None);
    };

    for q in queues {
        let qt = q
            .get("queueType")
            .and_then(|x| x.as_str())
            .unwrap_or("");
        if qt != "RANKED_SOLO_5x5" {
            continue;
        }
        let tier = q.get("tier").and_then(|x| x.as_str()).unwrap_or("");
        let division = q
            .get("division")
            .or_else(|| q.get("rank"))
            .and_then(|x| x.as_str())
            .unwrap_or("");
        let lp = q
            .get("leaguePoints")
            .and_then(|x| x.as_i64())
            .map(|n| n as i32);
        let rank = format_rank_tier(tier, division);
        if !rank.is_empty() {
            return (rank, lp);
        }
    }
    (String::new(), None)
}

fn str_field(v: &Value, keys: &[&str]) -> String {
    for key in keys {
        if let Some(s) = v.get(*key).and_then(|x| x.as_str()) {
            if !s.is_empty() {
                return s.to_string();
            }
        }
    }
    String::new()
}

fn apply_game_detail(stats: &mut PostGameStats, game: &Value) {
    if stats.queue_id.is_none() {
        stats.queue_id = game
            .get("queueId")
            .or_else(|| game.get("gameQueueConfigId"))
            .and_then(|x| x.as_u64())
            .map(|n| n as u32);
    }
    if stats.game_mode.is_empty() {
        stats.game_mode = str_field(game, &["gameMode", "gameModeString"]);
    }
    if stats.game_type.is_empty() {
        stats.game_type = str_field(game, &["gameType", "gameTypeConfig"]);
    }
    if stats.queue_type.is_empty() {
        stats.queue_type = str_field(game, &["queueType", "queueName"]);
    }
    if let Some(ranked) = game.get("ranked").and_then(|x| x.as_bool()) {
        stats.ranked = ranked;
    }
}

fn fetch_game_detail(client: &LcuClient, game_id: u64) -> Option<Value> {
    let path = format!("/lol-match-history/v1/games/{game_id}");
    let raw = client.get(&path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn enrich_from_lcu(client: &LcuClient, summoner_id: u64, stats: &mut PostGameStats) {
    let (rank, lp) = fetch_player_rank(client, summoner_id);
    if !rank.is_empty() {
        stats.player_rank = rank;
        stats.player_lp = lp;
    }
    if let Some(gid) = stats.game_id {
        if let Some(game) = fetch_game_detail(client, gid) {
            apply_game_detail(stats, &game);
        }
    }
}

/// Parse `/lol-end-of-game/v1/eog-stats-block` for the logged-in summoner.
pub fn parse_eog_stats_block(raw: &str, summoner_id: u64) -> Result<PostGameStats, String> {
    let root: Value =
        serde_json::from_str(raw).map_err(|e| format!("Invalid eog-stats JSON: {e}"))?;

    let player = find_local_player(&root, summoner_id)
        .ok_or_else(|| "Local player not found in eog-stats-block".to_string())?;

    let local_team = player
        .get("team")
        .or_else(|| player.get("teamId"))
        .and_then(|x| x.as_u64())
        .map(|n| n as u32);

    let mut stats = parse_player_stats(player, false);
    stats.team_dragon_kills =
        team_objective_kills(&root, local_team, "dragonKills").max(team_objective_kills(
            &root,
            local_team,
            "TEAM_DRAGON_KILLS",
        ));
    stats.team_baron_kills =
        team_objective_kills(&root, local_team, "baronKills").max(team_objective_kills(
            &root,
            local_team,
            "TEAM_BARON_KILLS",
        ));
    apply_eog_metadata(&root, player, &mut stats);

    Ok(stats)
}

fn fetch_latest_game_summary(client: &LcuClient) -> Option<(Value, u64)> {
    let raw = client
        .get("/lol-match-history/v1/games?begIndex=0&endIndex=1")
        .ok()?;
    let v: Value = serde_json::from_str(&raw).ok()?;
    let games = v.as_array().or_else(|| v.get("games").and_then(|g| g.as_array()))?;
    let game = games.first()?;
    let id = game.get("gameId").and_then(|x| x.as_u64())?;
    Some((game.clone(), id))
}

/// Fetch post-game stats with retries (EOG screen may load slowly).
pub fn fetch_postgame_stats(client: &LcuClient) -> Result<PostGameStats, String> {
    let summoner_id =
        local_summoner_id(client).ok_or_else(|| "Cannot resolve summoner id".to_string())?;

    let mut last_err = String::from("eog-stats-block not ready");
    for attempt in 0..6 {
        if attempt > 0 {
            thread::sleep(Duration::from_secs(2));
        }
        match client.get("/lol-end-of-game/v1/eog-stats-block") {
            Ok(raw) if !raw.trim().is_empty() && raw.trim() != "{}" => {
                match parse_eog_stats_block(&raw, summoner_id) {
                    Ok(mut stats) => {
                        if let Some((summary, game_id)) = fetch_latest_game_summary(client) {
                            stats.game_id = Some(game_id);
                            apply_game_detail(&mut stats, &summary);
                        }
                        enrich_from_lcu(client, summoner_id, &mut stats);
                        return Ok(stats);
                    }
                    Err(e) => last_err = e,
                }
            }
            Ok(_) => last_err = "Empty eog-stats-block".into(),
            Err(e) => last_err = e,
        }
    }
    Err(last_err)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_local_player_stats() {
        let raw = r#"{
            "players": [{
                "summonerId": 12345,
                "team": 100,
                "win": true,
                "stats": {
                    "CHAMPIONS_KILLED": 8,
                    "NUM_DEATHS": 2,
                    "ASSISTS": 11,
                    "TOTAL_MINIONS_KILLED": 140,
                    "NEUTRAL_MINIONS_KILLED": 16,
                    "GOLD_EARNED": 12500,
                    "WARD_PLACED": 12,
                    "VISION_WARDS_BOUGHT_IN_GAME": 2,
                    "WARD_KILLED": 3,
                    "TIME_PLAYED": 1680
                }
            }]
        }"#;
        let stats = parse_eog_stats_block(raw, 12345).unwrap();
        assert_eq!(stats.cs_total, 156);
        assert_eq!(stats.kills, 8);
        assert_eq!(stats.assists, 11);
        assert_eq!(stats.deaths, 2);
        assert_eq!(stats.vision_wards_bought, 2);
        assert!(stats.win);
    }

    #[test]
    fn parses_team_elo_averages() {
        let raw = r#"{
            "gameLength": 1800,
            "queueType": "RANKED_SOLO_5x5",
            "gameMode": "CLASSIC",
            "gameType": "MATCHED_GAME",
            "ranked": true,
            "elo": 1200,
            "eloChange": 18,
            "summonerId": 1,
            "team": 100,
            "stats": { "CHAMPIONS_KILLED": 3, "NUM_DEATHS": 1, "ASSISTS": 5 },
            "teams": [{
                "teamId": 100,
                "players": [
                    { "summonerId": 1, "elo": 1200 },
                    { "summonerId": 2, "elo": 1180 }
                ]
            }, {
                "teamId": 200,
                "players": [
                    { "summonerId": 3, "elo": 1250 },
                    { "summonerId": 4, "elo": 1270 }
                ]
            }]
        }"#;
        let stats = parse_eog_stats_block(raw, 1).unwrap();
        assert_eq!(stats.game_duration_seconds, 1800);
        assert_eq!(stats.queue_type, "RANKED_SOLO_5x5");
        assert_eq!(stats.game_mode, "CLASSIC");
        assert_eq!(stats.game_type, "MATCHED_GAME");
        assert!(stats.ranked);
        assert_eq!(stats.lp_change, Some(18));
        assert_eq!(stats.player_elo, Some(1200));
        assert_eq!(stats.ally_team_avg_elo, Some(1190));
        assert_eq!(stats.enemy_team_avg_elo, Some(1260));
        assert_eq!(stats.game_avg_elo, Some(1225));
    }
}
