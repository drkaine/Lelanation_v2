//! Post-game stats from LCU `/lol-end-of-game/v1/eog-stats-block`.

use crate::lcu::LcuClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostGameFetch {
    pub stats: PostGameStats,
    /// Full raw LCU endpoint payloads (dev / debugging).
    pub lcu_raw: Value,
}

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
    #[serde(default)]
    pub region: String,
    #[serde(default)]
    pub game_creation_ms: Option<i64>,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub opponent_champion_id: Option<u32>,
    #[serde(default)]
    pub patch: String,
    #[serde(default)]
    pub gold_spent: u32,
    #[serde(default)]
    pub set_item: String,
    #[serde(default)]
    pub vision_score: u32,
    #[serde(default)]
    pub damage_to_champions: u32,
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
        gold_spent: stat_u32(stats, &["GOLD_SPENT", "goldSpent"]),
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
        vision_score: stat_u32(stats, &["VISION_SCORE", "visionScore"]),
        damage_to_champions: stat_u32(
            stats,
            &[
                "TOTAL_DAMAGE_DEALT_TO_CHAMPIONS",
                "totalDamageDealtToChampions",
            ],
        ),
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

fn fetch_region(client: &LcuClient) -> String {
    let raw = match client.get("/riotclient/region-locale") {
        Ok(r) => r,
        Err(_) => return String::new(),
    };
    let v: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };
    v.get("region")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string()
}

fn fetch_patch(client: &LcuClient) -> String {
    let raw = match client.get("/lol-patch/v1/game-version") {
        Ok(r) => r,
        Err(_) => return String::new(),
    };
    if let Ok(arr) = serde_json::from_str::<Vec<String>>(&raw) {
        return arr.first().cloned().unwrap_or_default();
    }
    if let Ok(s) = serde_json::from_str::<String>(&raw) {
        return s;
    }
    String::new()
}

fn normalize_role(raw: &str) -> String {
    match raw.to_ascii_uppercase().as_str() {
        "TOP" => "top".into(),
        "JUNGLE" | "JGL" => "jungle".into(),
        "MIDDLE" | "MID" | "MIDLANE" => "middle".into(),
        "BOTTOM" | "BOT" | "ADC" => "bottom".into(),
        "UTILITY" | "SUPPORT" | "SUP" => "utility".into(),
        other if !other.is_empty() => other.to_ascii_lowercase(),
        _ => String::new(),
    }
}

fn participant_team_id(participant: &Value) -> Option<u32> {
    participant
        .get("teamId")
        .or_else(|| participant.get("team"))
        .and_then(|x| x.as_u64())
        .map(|n| n as u32)
}

fn participant_id(participant: &Value) -> Option<u32> {
    participant
        .get("participantId")
        .and_then(|x| x.as_u64())
        .map(|n| n as u32)
}

fn lane_role_from_timeline(participant: &Value) -> String {
    let timeline = participant.get("timeline");
    let lane = timeline
        .and_then(|t| t.get("lane"))
        .and_then(|x| x.as_str())
        .unwrap_or("");
    let role = timeline
        .and_then(|t| t.get("role"))
        .and_then(|x| x.as_str())
        .unwrap_or("");

    let lane_upper = lane.to_ascii_uppercase();
    let role_upper = role.to_ascii_uppercase();

    match lane_upper.as_str() {
        "TOP" => normalize_role("TOP"),
        "JUNGLE" => normalize_role("JUNGLE"),
        "MIDDLE" | "MID" => normalize_role("MIDDLE"),
        "BOTTOM" | "BOT" => {
            if role_upper == "SUPPORT" {
                normalize_role("UTILITY")
            } else {
                normalize_role("BOTTOM")
            }
        }
        "NONE" | "" => {
            if role_upper == "SUPPORT" {
                normalize_role("UTILITY")
            } else if role_upper == "DUO" || role_upper == "CARRY" {
                normalize_role("BOTTOM")
            } else {
                String::new()
            }
        }
        _ => normalize_role(&lane_upper),
    }
}

fn participant_lane_role(participant: &Value) -> String {
    for key in ["teamPosition", "individualPosition", "selectedPosition", "lane", "role"] {
        if let Some(raw) = participant.get(key).and_then(|x| x.as_str()) {
            let normalized = normalize_role(raw);
            if !normalized.is_empty() {
                return normalized;
            }
        }
    }
    lane_role_from_timeline(participant)
}

fn find_local_participant_id(game: &Value, summoner_id: u64) -> Option<u32> {
    if let Some(identities) = game.get("participantIdentities").and_then(|x| x.as_array()) {
        for identity in identities {
            let sid = identity
                .get("player")
                .and_then(|p| p.get("summonerId"))
                .and_then(|x| x.as_u64());
            if sid == Some(summoner_id) {
                return identity
                    .get("participantId")
                    .and_then(|x| x.as_u64())
                    .map(|n| n as u32);
            }
        }
    }
    None
}

fn find_local_participant<'a>(
    participants: &'a [Value],
    game: &Value,
    summoner_id: u64,
) -> Option<&'a Value> {
    if let Some(pid) = find_local_participant_id(game, summoner_id) {
        if let Some(p) = participants
            .iter()
            .find(|p| participant_id(p) == Some(pid))
        {
            return Some(p);
        }
    }

    participants.iter().find(|p| {
        p.get("summonerId")
            .and_then(|x| x.as_u64())
            .map(|sid| sid == summoner_id)
            .unwrap_or(false)
    })
}

fn opponent_champion_by_role(
    participants: &[Value],
    local_team: u32,
    local_role: &str,
) -> Option<u32> {
    if local_role.is_empty() {
        return None;
    }
    for p in participants {
        let Some(team) = participant_team_id(p) else {
            continue;
        };
        if team == local_team {
            continue;
        }
        let role = participant_lane_role(p);
        if !role.is_empty() && role == local_role {
            return p
                .get("championId")
                .and_then(|x| x.as_u64())
                .map(|n| n as u32);
        }
    }
    None
}

fn opponent_champion_by_index(
    participants: &[Value],
    local: &Value,
    local_team: u32,
) -> Option<u32> {
    let local_pid = participant_id(local)?;
    let mut team100: Vec<&Value> = participants
        .iter()
        .filter(|p| participant_team_id(p) == Some(100))
        .collect();
    let mut team200: Vec<&Value> = participants
        .iter()
        .filter(|p| participant_team_id(p) == Some(200))
        .collect();
    team100.sort_by_key(|p| participant_id(p).unwrap_or(0));
    team200.sort_by_key(|p| participant_id(p).unwrap_or(0));

    let (my_team, enemy_team) = if local_team == 100 {
        (&team100, &team200)
    } else {
        (&team200, &team100)
    };

    let idx = my_team
        .iter()
        .position(|p| participant_id(p) == Some(local_pid))?;

    enemy_team.get(idx).and_then(|p| {
        p.get("championId")
            .and_then(|x| x.as_u64())
            .map(|n| n as u32)
    })
}

fn item_ids_from_participant(participant: &Value) -> Vec<u32> {
    let mut ids = Vec::new();
    let stats = participant.get("stats").unwrap_or(participant);
    for source in [participant, stats] {
        for i in 0..=6 {
            let key = format!("item{i}");
            if let Some(id) = source.get(&key).and_then(|x| x.as_u64()) {
                if id > 0 {
                    ids.push(id as u32);
                }
            }
        }
    }
    ids.sort_unstable();
    ids.dedup();
    ids
}

fn build_set_item_key(item_ids: &[u32]) -> String {
    item_ids
        .iter()
        .map(|id| id.to_string())
        .collect::<Vec<_>>()
        .join("_")
}

fn enrich_from_participants(stats: &mut PostGameStats, game: &Value, summoner_id: u64) {
    let Some(participants) = game.get("participants").and_then(|x| x.as_array()) else {
        return;
    };

    let Some(local) = find_local_participant(participants, game, summoner_id) else {
        return;
    };

    let local_team = participant_team_id(local);
    let local_role = participant_lane_role(local);
    let local_items = item_ids_from_participant(local);

    if stats.champion_id == 0 {
        stats.champion_id = local
            .get("championId")
            .and_then(|x| x.as_u64())
            .unwrap_or(0) as u32;
    }

    if let Some(ps) = local.get("stats") {
        if stats.gold_spent == 0 {
            stats.gold_spent = stat_u32(ps, &["GOLD_SPENT", "goldSpent"]);
        }
    }

    if !local_role.is_empty() {
        stats.role = local_role.clone();
    }

    if let Some(team) = local_team {
        stats.opponent_champion_id = opponent_champion_by_role(participants, team, &local_role)
            .or_else(|| opponent_champion_by_index(participants, local, team));
    }

    if !local_items.is_empty() {
        stats.set_item = build_set_item_key(&local_items);
    }
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
    if let Some(ms) = game
        .get("gameCreationDate")
        .or_else(|| game.get("gameCreation"))
        .and_then(|x| x.as_i64())
    {
        stats.game_creation_ms = Some(ms);
    }
}

fn fetch_game_detail(client: &LcuClient, game_id: u64) -> Option<Value> {
    let path = format!("/lol-match-history/v1/games/{game_id}");
    let raw = client.get(&path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn enrich_from_lcu(client: &LcuClient, summoner_id: u64, stats: &mut PostGameStats) {
    stats.region = fetch_region(client);
    if stats.patch.is_empty() {
        stats.patch = fetch_patch(client);
    }
    let (rank, lp) = fetch_player_rank(client, summoner_id);
    if !rank.is_empty() {
        stats.player_rank = rank;
        stats.player_lp = lp;
    }
    if let Some(gid) = stats.game_id {
        if let Some(game) = fetch_game_detail(client, gid) {
            apply_game_detail(stats, &game);
            enrich_from_participants(stats, &game, summoner_id);
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

fn parse_lcu_body(raw: &str) -> Value {
    serde_json::from_str(raw).unwrap_or_else(|_| json!({ "rawText": raw }))
}

fn capture_get(client: &LcuClient, endpoints: &mut Map<String, Value>, key: &str, path: &str) {
    endpoints.insert(
        key.to_string(),
        match client.get(path) {
            Ok(raw) => parse_lcu_body(&raw),
            Err(e) => json!({ "error": e }),
        },
    );
}

fn build_lcu_raw_capture(
    client: &LcuClient,
    summoner_id: u64,
    game_id: Option<u64>,
    eog_raw: &str,
) -> Value {
    let mut endpoints = Map::new();
    endpoints.insert("eogStatsBlock".into(), parse_lcu_body(eog_raw));
    capture_get(client, &mut endpoints, "loginSession", "/lol-login/v1/session");
    capture_get(
        client,
        &mut endpoints,
        "matchHistoryLatest",
        "/lol-match-history/v1/games?begIndex=0&endIndex=1",
    );
    if let Some(gid) = game_id {
        capture_get(
            client,
            &mut endpoints,
            "matchHistoryGameDetail",
            &format!("/lol-match-history/v1/games/{gid}"),
        );
    }
    capture_get(client, &mut endpoints, "regionLocale", "/riotclient/region-locale");
    capture_get(client, &mut endpoints, "gameVersion", "/lol-patch/v1/game-version");
    capture_get(
        client,
        &mut endpoints,
        "rankedOverview",
        &format!("/lol-ranked/v1/ranked-overview/{summoner_id}"),
    );

    json!({
        "capturedAtMs": crate::checklist::evaluator::now_millis(),
        "summonerId": summoner_id,
        "gameId": game_id,
        "endpoints": endpoints,
    })
}

/// Fetch post-game stats with retries (EOG screen may load slowly).
pub fn fetch_postgame_stats(client: &LcuClient) -> Result<PostGameFetch, String> {
    let summoner_id =
        local_summoner_id(client).ok_or_else(|| "Cannot resolve summoner id".to_string())?;

    let mut last_err = String::from("eog-stats-block not ready");
    for attempt in 0..6 {
        if attempt > 0 {
            thread::sleep(Duration::from_secs(2));
        }
        match client.get("/lol-end-of-game/v1/eog-stats-block") {
            Ok(raw) if !raw.trim().is_empty() && raw.trim() != "{}" => {
                let eog_raw = raw;
                match parse_eog_stats_block(&eog_raw, summoner_id) {
                    Ok(mut stats) => {
                        if let Some((summary, game_id)) = fetch_latest_game_summary(client) {
                            stats.game_id = Some(game_id);
                            apply_game_detail(&mut stats, &summary);
                        }
                        enrich_from_lcu(client, summoner_id, &mut stats);
                        let lcu_raw =
                            build_lcu_raw_capture(client, summoner_id, stats.game_id, &eog_raw);
                        return Ok(PostGameFetch { stats, lcu_raw });
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

    #[test]
    fn resolves_lane_opponent_from_lcu_timeline() {
        let game = json!({
            "participantIdentities": [
                { "participantId": 1, "player": { "summonerId": 111 } },
                { "participantId": 6, "player": { "summonerId": 666 } }
            ],
            "participants": [
                {
                    "participantId": 1,
                    "teamId": 100,
                    "championId": 86,
                    "timeline": { "lane": "TOP", "role": "SOLO" }
                },
                {
                    "participantId": 2,
                    "teamId": 100,
                    "championId": 64,
                    "timeline": { "lane": "JUNGLE", "role": "NONE" }
                },
                {
                    "participantId": 6,
                    "teamId": 200,
                    "championId": 238,
                    "timeline": { "lane": "TOP", "role": "SOLO" }
                },
                {
                    "participantId": 7,
                    "teamId": 200,
                    "championId": 121,
                    "timeline": { "lane": "JUNGLE", "role": "NONE" }
                }
            ]
        });

        let mut stats = PostGameStats::default();
        enrich_from_participants(&mut stats, &game, 111);
        assert_eq!(stats.role, "top");
        assert_eq!(stats.opponent_champion_id, Some(238));

        let mut stats_mid = PostGameStats::default();
        let mid_game = json!({
            "participantIdentities": [
                { "participantId": 3, "player": { "summonerId": 333 } },
                { "participantId": 8, "player": { "summonerId": 888 } }
            ],
            "participants": [
                {
                    "participantId": 3,
                    "teamId": 100,
                    "championId": 7,
                    "timeline": { "lane": "MIDDLE", "role": "SOLO" }
                },
                {
                    "participantId": 8,
                    "teamId": 200,
                    "championId": 61,
                    "timeline": { "lane": "MIDDLE", "role": "SOLO" }
                }
            ]
        });
        enrich_from_participants(&mut stats_mid, &mid_game, 333);
        assert_eq!(stats_mid.role, "middle");
        assert_eq!(stats_mid.opponent_champion_id, Some(61));
    }

    #[test]
    fn resolves_bot_lane_adc_vs_support_roles() {
        let game = json!({
            "participantIdentities": [
                { "participantId": 5, "player": { "summonerId": 555 } },
                { "participantId": 10, "player": { "summonerId": 1010 } }
            ],
            "participants": [
                {
                    "participantId": 5,
                    "teamId": 100,
                    "championId": 22,
                    "timeline": { "lane": "BOTTOM", "role": "CARRY" }
                },
                {
                    "participantId": 10,
                    "teamId": 200,
                    "championId": 51,
                    "timeline": { "lane": "BOTTOM", "role": "CARRY" }
                }
            ]
        });

        let mut stats = PostGameStats::default();
        enrich_from_participants(&mut stats, &game, 555);
        assert_eq!(stats.role, "bottom");
        assert_eq!(stats.opponent_champion_id, Some(51));
    }
}
