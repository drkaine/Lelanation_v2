//! LCU custom item set create/update logic.

use super::LcuClient;
use serde::{Deserialize, Serialize};

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

fn parse_item_sets(raw: &str) -> Vec<ItemSet> {
    if let Ok(arr) = serde_json::from_str::<Vec<ItemSet>>(raw) {
        return arr;
    }
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(raw) {
        for key in ["itemSets", "sets"] {
            if let Some(arr) = v.get(key).and_then(|x| x.as_array()) {
                if let Ok(sets) = serde_json::from_value::<Vec<ItemSet>>(serde_json::Value::Array(
                    arr.clone(),
                )) {
                    return sets;
                }
            }
        }
    }
    Vec::new()
}

pub fn apply_item_set(
    client: &LcuClient,
    build_name: &str,
    champion_id: u32,
    items: &ItemSetData,
) -> Result<(), String> {
    let summoner_id = resolve_summoner_id(client)?;
    let path = format!("/lol-item-sets/v1/item-sets/{summoner_id}/sets");

    let mut existing = match client.get(&path) {
        Ok(raw) => parse_item_sets(&raw),
        Err(_) => Vec::new(),
    };

    let new_set = build_item_set(build_name, champion_id, items);
    let title = new_set.title.clone();

    if let Some(idx) = existing.iter().position(|s| {
        s.title == title
            && (champion_id == 0
                || s.associated_champions.is_empty()
                || s.associated_champions.contains(&champion_id))
    }) {
        existing[idx] = new_set.clone();
    } else {
        existing.push(new_set.clone());
    }

    let body = serde_json::to_string(&existing).map_err(|e| e.to_string())?;
    if client.put(&path, &body).is_ok() {
        return Ok(());
    }

    // Fallback: some LCU builds accept POST of a single set payload.
    let single = serde_json::to_string(&new_set).map_err(|e| e.to_string())?;
    client.post(&path, &single)?;
    Ok(())
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
        let title = new_set.title.clone();
        let champion_id = 103u32;
        if let Some(idx) = existing.iter().position(|s| {
            s.title == title
                && (champion_id == 0
                    || s.associated_champions.is_empty()
                    || s.associated_champions.contains(&champion_id))
        }) {
            existing[idx] = new_set;
        } else {
            existing.push(new_set);
        }
        assert_eq!(existing.len(), 2);
        assert_eq!(existing[0].blocks[0].items[0].id, "3135");
    }
}
