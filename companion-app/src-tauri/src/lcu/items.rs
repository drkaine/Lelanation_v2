//! LCU custom item set create/update logic.

use super::LcuClient;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ItemSetData {
    #[serde(default)]
    pub starter: Vec<u32>,
    #[serde(default)]
    pub core: Vec<u32>,
    #[serde(default)]
    pub boots: Vec<u32>,
    #[serde(default)]
    pub optional: Vec<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ItemSetEntry {
    id: String,
    count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ItemSetBlock {
    #[serde(rename = "type")]
    block_type: String,
    items: Vec<ItemSetEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ItemSet {
    title: String,
    #[serde(default)]
    associated_champions: Vec<u32>,
    #[serde(default)]
    associated_maps: Vec<u32>,
    blocks: Vec<ItemSetBlock>,
    map: String,
    mode: String,
    #[serde(default)]
    preferred_item_slots: Vec<serde_json::Value>,
    sortrank: u32,
    started_from: String,
    #[serde(rename = "type")]
    set_type: String,
}

fn resolve_summoner_id(client: &LcuClient) -> Result<u64, String> {
    if let Ok(raw) = client.get("/lol-login/v1/session") {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(id) = v.get("summonerId").and_then(|x| x.as_u64()) {
                return Ok(id);
            }
        }
    }
    let raw = client.get("/lol-summoner/v1/current-summoner")?;
    let v: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("Invalid summoner JSON: {e}"))?;
    let id = v
        .get("summonerId")
        .or_else(|| v.get("id"))
        .and_then(|x| x.as_u64())
        .ok_or_else(|| "Cannot resolve current summoner id".to_string())?;
    Ok(id)
}

fn item_rows(ids: &[u32]) -> Vec<ItemSetEntry> {
    ids.iter()
        .filter(|id| **id > 0)
        .map(|id| ItemSetEntry {
            id: id.to_string(),
            count: 1,
        })
        .collect()
}

fn build_item_set(name: &str, champion_id: u32, items: &ItemSetData) -> ItemSet {
    let title = name.trim().chars().take(80).collect::<String>();
    let title = if title.is_empty() {
        "Lelanation".to_string()
    } else {
        title
    };

    let mut blocks = Vec::new();
    let groups = [
        ("Départ", &items.starter),
        ("Core", &items.core),
        ("Bottes", &items.boots),
        ("Optionnel", &items.optional),
    ];
    for (label, ids) in groups {
        let rows = item_rows(ids);
        if !rows.is_empty() {
            blocks.push(ItemSetBlock {
                block_type: label.to_string(),
                items: rows,
            });
        }
    }
    if blocks.is_empty() {
        blocks.push(ItemSetBlock {
            block_type: "Lelanation".to_string(),
            items: vec![],
        });
    }

    ItemSet {
        title,
        associated_champions: if champion_id > 0 {
            vec![champion_id]
        } else {
            vec![]
        },
        associated_maps: vec![11, 12],
        blocks,
        map: "any".into(),
        mode: "any".into(),
        preferred_item_slots: vec![],
        sortrank: 1,
        started_from: "blank".into(),
        set_type: "custom".into(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ItemSetsEnvelope {
    #[serde(default)]
    account_id: u64,
    #[serde(default)]
    item_sets: Vec<ItemSet>,
    #[serde(default)]
    timestamp: u64,
}

fn parse_item_sets_envelope(raw: &str) -> ItemSetsEnvelope {
    if let Ok(env) = serde_json::from_str::<ItemSetsEnvelope>(raw) {
        return env;
    }
    if let Ok(arr) = serde_json::from_str::<Vec<ItemSet>>(raw) {
        return ItemSetsEnvelope {
            item_sets: arr,
            ..Default::default()
        };
    }
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(raw) {
        for key in ["itemSets", "sets"] {
            if let Some(arr) = v.get(key).and_then(|x| x.as_array()) {
                if let Ok(sets) = serde_json::from_value::<Vec<ItemSet>>(serde_json::Value::Array(
                    arr.clone(),
                )) {
                    return ItemSetsEnvelope {
                        account_id: v
                            .get("accountId")
                            .and_then(|x| x.as_u64())
                            .unwrap_or(0),
                        item_sets: sets,
                        timestamp: v
                            .get("timestamp")
                            .and_then(|x| x.as_u64())
                            .unwrap_or(0),
                    };
                }
            }
        }
    }
    ItemSetsEnvelope::default()
}

fn champion_matches(set: &ItemSet, champion_id: u32) -> bool {
    champion_id == 0
        || set.associated_champions.is_empty()
        || set.associated_champions.contains(&champion_id)
}

fn merge_item_set(
    item_sets: &mut Vec<ItemSet>,
    new_set: &ItemSet,
    champion_id: u32,
) {
    let title = new_set.title.trim();
    let title_lower = title.to_ascii_lowercase();
    if let Some(idx) = item_sets.iter().position(|s| {
        champion_matches(s, champion_id)
            && (s.title == title || s.title.to_ascii_lowercase() == title_lower)
    }) {
        item_sets[idx] = new_set.clone();
    } else {
        item_sets.push(new_set.clone());
    }
}

pub fn apply_item_set(
    client: &LcuClient,
    build_name: &str,
    champion_id: u32,
    items: &ItemSetData,
) -> Result<(), String> {
    let summoner_id = resolve_summoner_id(client)?;
    let path = format!("/lol-item-sets/v1/item-sets/{summoner_id}/sets");

    let raw = client.get(&path).unwrap_or_else(|_| "{}".into());
    let mut envelope = parse_item_sets_envelope(&raw);

    let new_set = build_item_set(build_name, champion_id, items);
    merge_item_set(&mut envelope.item_sets, &new_set, champion_id);

    let body = serde_json::to_string(&envelope).map_err(|e| e.to_string())?;
    if client.put(&path, &body).is_ok() {
        return Ok(());
    }

    // Fallback: some LCU builds accept POST of a single set payload.
    let single = serde_json::to_string(&new_set).map_err(|e| e.to_string())?;
    if client.post(&path, &single).is_ok() {
        return Ok(());
    }

    Err("LCU item-sets API rejected the payload".into())
}

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

fn sanitize_champion_folder(name: &str) -> Option<String> {
    let safe: String = name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    if safe.is_empty() {
        None
    } else {
        Some(safe)
    }
}

fn champion_recommended_dirs(
    league_root: &Path,
    champion_folder: &str,
    champion_id: u32,
) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(folder) = sanitize_champion_folder(champion_folder) {
        dirs.push(
            league_root
                .join("Config")
                .join("Champions")
                .join(folder)
                .join("Recommended"),
        );
    }
    if champion_id > 0 {
        let numeric = league_root
            .join("Config")
            .join("Champions")
            .join(champion_id.to_string())
            .join("Recommended");
        if !dirs.contains(&numeric) {
            dirs.push(numeric);
        }
    }
    dirs
}

/// Riot shop format written under `Config/Champions/<Champ>/Recommended/`.
pub fn build_recommended_file_json(title: &str, items: &ItemSetData) -> String {
    let mut ids: Vec<u32> = Vec::new();
    ids.extend_from_slice(&items.starter);
    ids.extend_from_slice(&items.core);
    ids.extend_from_slice(&items.boots);
    ids.extend_from_slice(&items.optional);
    let rows: Vec<serde_json::Value> = ids
        .iter()
        .filter(|id| **id > 0)
        .map(|id| serde_json::json!({ "id": id.to_string(), "count": 1 }))
        .collect();
    let display_title: String = title.trim().chars().take(80).collect();
    let display_title = if display_title.is_empty() {
        "Lelanation".to_string()
    } else {
        display_title
    };
    serde_json::json!({
        "title": display_title,
        "type": "custom",
        "map": "any",
        "mode": "any",
        "priority": true,
        "sortrank": 1,
        "blocks": [{
            "type": "Lelanation",
            "recMath": false,
            "minSummonerLevel": -1,
            "maxSummonerLevel": -1,
            "showIfSummonerSpell": "",
            "hideIfSummonerSpell": "",
            "items": rows,
        }],
    })
    .to_string()
}

/// Writes `lelanation_<stem>.json` for the in-game shop item dropdown.
pub fn write_recommended_item_set(
    league_root: &str,
    champion_folder: &str,
    champion_id: u32,
    build_id: &str,
    build_name: &str,
    items: &ItemSetData,
) -> Result<String, String> {
    let root = PathBuf::from(league_root.trim());
    if root.as_os_str().is_empty() {
        return Err("League of Legends install folder is not configured.".into());
    }
    let dirs = champion_recommended_dirs(&root, champion_folder, champion_id);
    if dirs.is_empty() {
        return Err("Invalid champion folder for item set path.".into());
    }

    let stem_source = if build_id.trim().is_empty() {
        build_name.to_string()
    } else {
        format!("{}_{}", build_id.trim(), build_name.trim())
    };
    let stem = sanitize_item_set_stem(&stem_source);
    let json = build_recommended_file_json(build_name, items);
    let mut last_err = String::new();

    for dir in dirs {
        if let Err(e) = std::fs::create_dir_all(&dir) {
            last_err = format!("Cannot create {}: {e}", dir.display());
            continue;
        }
        let path = dir.join(format!("lelanation_{stem}.json"));
        match std::fs::write(&path, json.as_bytes()) {
            Ok(()) => return Ok(path.display().to_string()),
            Err(e) => last_err = format!("Cannot write {}: {e}", path.display()),
        }
    }

    Err(if last_err.is_empty() {
        "Could not write item set file.".into()
    } else {
        last_err
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_item_set_blocks() {
        let items = ItemSetData {
            starter: vec![1055],
            core: vec![3153, 3074],
            boots: vec![3006],
            optional: vec![],
        };
        let set = build_item_set("Test Build", 266, &items);
        assert_eq!(set.title, "Test Build");
        assert_eq!(set.associated_champions, vec![266]);
        assert_eq!(set.blocks.len(), 3);
        assert_eq!(set.blocks[0].block_type, "Départ");
    }

    #[test]
    fn merge_replaces_same_title_and_champion() {
        let mut existing = vec![
            build_item_set("Build A", 103, &ItemSetData { core: vec![3157], ..Default::default() }),
            build_item_set("Build B", 103, &ItemSetData { core: vec![3089], ..Default::default() }),
        ];
        let new_set = build_item_set("Build A", 103, &ItemSetData { core: vec![3135], ..Default::default() });
        merge_item_set(&mut existing, &new_set, 103);
        assert_eq!(existing.len(), 2);
        assert_eq!(existing[0].blocks[0].items[0].id, "3135");
    }

    #[test]
    fn recommended_file_json_contains_items() {
        let items = ItemSetData {
            core: vec![3157, 3089],
            ..Default::default()
        };
        let raw = build_recommended_file_json("My Build", &items);
        let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(v["title"], "My Build");
        assert_eq!(v["blocks"][0]["items"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn parse_envelope_from_lcu_json() {
        let raw = r#"{"accountId":226833561,"itemSets":[],"timestamp":1648384885360}"#;
        let env = parse_item_sets_envelope(raw);
        assert_eq!(env.account_id, 226833561);
        assert!(env.item_sets.is_empty());
        assert_eq!(env.timestamp, 1648384885360);
    }
}
