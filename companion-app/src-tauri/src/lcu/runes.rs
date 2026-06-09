//! LCU rune page create/update logic.

use super::LcuClient;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunePerksData {
    pub primary_perks: [u32; 4],
    pub secondary_perks: [u32; 2],
    pub shards: [u32; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunePageData {
    pub primary_path: u32,
    pub secondary_path: u32,
    pub perks: RunePerksData,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PerksInventory {
    #[serde(default)]
    page_max: u32,
    #[serde(default)]
    page_max_reached: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RunePage {
    id: i64,
    name: String,
    #[serde(default)]
    is_editable: bool,
    primary_style_id: u32,
    sub_style_id: u32,
    selected_perk_ids: Vec<u32>,
    #[serde(default)]
    current: bool,
}

/// Build selectedPerkIds in strict LCU order.
pub fn build_selected_perk_ids(perks: &RunePerksData) -> Vec<u32> {
    let mut ids = Vec::with_capacity(9);
    ids.extend_from_slice(&perks.primary_perks);
    ids.extend_from_slice(&perks.secondary_perks);
    ids.extend_from_slice(&perks.shards);
    ids
}

pub fn apply_rune_page(client: &LcuClient, build_name: &str, runes: &RunePageData) -> Result<i64, String> {
    let selected_perk_ids = build_selected_perk_ids(&runes.perks);
    for id in &selected_perk_ids {
        if *id == 0 {
            return Err("Invalid rune or shard id in build".into());
        }
    }

    let inventory_raw = client.get("/lol-perks/v1/inventory")?;
    let inventory: PerksInventory = serde_json::from_str(&inventory_raw)
        .map_err(|e| format!("Invalid perks inventory JSON: {e}"))?;
    let max_pages = if inventory.page_max > 0 {
        inventory.page_max
    } else {
        25
    };

    let pages_raw = client.get("/lol-perks/v1/pages")?;
    let pages: Vec<RunePage> = serde_json::from_str(&pages_raw)
        .map_err(|e| format!("Invalid rune pages JSON: {e}"))?;

    let name = build_name.trim();
    let name = if name.is_empty() { "Lelanation" } else { name };
    let name = name.chars().take(48).collect::<String>();

    let payload = serde_json::json!({
        "name": name,
        "primaryStyleId": runes.primary_path,
        "subStyleId": runes.secondary_path,
        "selectedPerkIds": selected_perk_ids,
        "current": true,
    });

    if let Some(existing) = pages.iter().find(|p| p.name == name) {
        let mut merged = existing.clone();
        merged.primary_style_id = runes.primary_path;
        merged.sub_style_id = runes.secondary_path;
        merged.selected_perk_ids = build_selected_perk_ids(&runes.perks);
        merged.current = true;
        let body = serde_json::to_string(&merged).map_err(|e| e.to_string())?;
        client.put(&format!("/lol-perks/v1/pages/{}", existing.id), &body)?;
        return Ok(existing.id);
    }

    if (pages.len() as u32) < max_pages {
        let body = payload.to_string();
        let created_raw = client.post("/lol-perks/v1/pages", &body)?;
        if let Ok(created) = serde_json::from_str::<RunePage>(&created_raw) {
            return Ok(created.id);
        }
        // Some LCU versions return empty body on POST — re-fetch by name.
        let pages_raw = client.get("/lol-perks/v1/pages")?;
        let pages: Vec<RunePage> = serde_json::from_str(&pages_raw).map_err(|e| e.to_string())?;
        if let Some(p) = pages.iter().find(|p| p.name == name) {
            return Ok(p.id);
        }
        return Err("Rune page created but id not returned".into());
    }

    let replace = pages
        .iter()
        .find(|p| p.is_editable)
        .ok_or_else(|| "All rune pages are locked; free a custom page first.".to_string())?;

    let old_name = replace.name.clone();
    let mut merged = replace.clone();
    merged.name = name.clone();
    merged.primary_style_id = runes.primary_path;
    merged.sub_style_id = runes.secondary_path;
    merged.selected_perk_ids = build_selected_perk_ids(&runes.perks);
    merged.current = true;
    let body = serde_json::to_string(&merged).map_err(|e| e.to_string())?;
    client.put(&format!("/lol-perks/v1/pages/{}", replace.id), &body)?;
    eprintln!("[lcu/runes] Page overwritten (was \"{old_name}\") → \"{name}\"");
    Ok(replace.id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selected_perk_ids_order() {
        let perks = RunePerksData {
            primary_perks: [8005, 9111, 9104, 8014],
            secondary_perks: [8234, 8236],
            shards: [5008, 5008, 5001],
        };
        assert_eq!(
            build_selected_perk_ids(&perks),
            vec![8005, 9111, 9104, 8014, 8234, 8236, 5008, 5008, 5001]
        );
    }
}
