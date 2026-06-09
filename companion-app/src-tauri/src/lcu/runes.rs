//! LCU rune page create/update logic.

use super::LcuClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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

#[derive(Debug, Clone)]
struct StatShardRows {
    offense: Vec<u32>,
    flex: Vec<u32>,
    defense: Vec<u32>,
}

fn default_stat_shard_rows() -> StatShardRows {
    StatShardRows {
        offense: vec![5008, 5005, 5007],
        flex: vec![5008, 5010, 5001],
        defense: vec![5011, 5013, 5001],
    }
}

fn parse_stat_rows_from_styles(raw: &str) -> Option<StatShardRows> {
    let styles: Vec<Value> = serde_json::from_str(raw).ok()?;
    let slots = styles.first()?.get("slots")?.as_array()?;
    let stat_slots: Vec<&Value> = slots
        .iter()
        .filter(|slot| slot.get("type").and_then(|t| t.as_str()) == Some("kStatMod"))
        .collect();
    if stat_slots.len() < 3 {
        return None;
    }
    let parse_ids = |slot: &Value| -> Vec<u32> {
        slot.get("perks")
            .and_then(|p| p.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_u64().map(|n| n as u32))
                    .collect()
            })
            .unwrap_or_default()
    };
    Some(StatShardRows {
        offense: parse_ids(stat_slots[0]),
        flex: parse_ids(stat_slots[1]),
        defense: parse_ids(stat_slots[2]),
    })
}

fn load_stat_shard_rows(client: &LcuClient) -> StatShardRows {
    client
        .get("/lol-perks/v1/styles")
        .ok()
        .and_then(|raw| parse_stat_rows_from_styles(&raw))
        .unwrap_or_else(default_stat_shard_rows)
}

fn allowed_for_slot<'a>(rows: &'a StatShardRows, slot: usize) -> &'a [u32] {
    match slot {
        0 => &rows.offense,
        1 => &rows.flex,
        2 => &rows.defense,
        _ => &[],
    }
}

/// Site legacy ids (e.g. 5002 = PV croissance in slot défense) → ids acceptés par le client actuel.
fn legacy_shard_alias(slot: usize, id: u32) -> u32 {
    match (slot, id) {
        (_, 5006) => 5010,
        (0, 5001 | 5002 | 5003) => 5008,
        (1, 5002 | 5003) => 5001,
        (2, 5002 | 5012) => 5001,
        (2, 5003) => 5013,
        _ => id,
    }
}

fn pick_fallback(allowed: &[u32], preferred: u32) -> u32 {
    if allowed.contains(&preferred) {
        return preferred;
    }
    allowed.first().copied().unwrap_or(5008)
}

fn normalize_shard_for_row(slot: usize, id: u32, rows: &StatShardRows) -> u32 {
    let allowed = allowed_for_slot(rows, slot);
    if allowed.is_empty() {
        return id;
    }
    let aliased = legacy_shard_alias(slot, id);
    if allowed.contains(&aliased) {
        return aliased;
    }
    if allowed.contains(&id) {
        return id;
    }
    match (slot, id) {
        (2, 5002) => pick_fallback(allowed, 5001),
        (2, 5003) => pick_fallback(allowed, 5013),
        (1, 5002 | 5003) => pick_fallback(allowed, 5001),
        (0, _) => pick_fallback(allowed, 5008),
        (1, _) => pick_fallback(allowed, 5008),
        (2, _) => pick_fallback(allowed, 5011),
        _ => allowed[0],
    }
}

fn normalize_shards(raw: [u32; 3], rows: &StatShardRows) -> [u32; 3] {
    [
        normalize_shard_for_row(0, raw[0], rows),
        normalize_shard_for_row(1, raw[1], rows),
        normalize_shard_for_row(2, raw[2], rows),
    ]
}

fn build_selected_perk_ids_with_rows(perks: &RunePerksData, rows: &StatShardRows) -> Vec<u32> {
    let shards = normalize_shards(perks.shards, rows);
    let mut ids = Vec::with_capacity(9);
    ids.extend_from_slice(&perks.primary_perks);
    ids.extend_from_slice(&perks.secondary_perks);
    ids.extend_from_slice(&shards);
    ids
}

fn page_name(build_name: &str) -> String {
    let name = build_name.trim();
    let name = if name.is_empty() { "Lelanation" } else { name };
    name.chars().take(48).collect()
}

fn page_id(page: &Value) -> Result<i64, String> {
    page.get("id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Rune page id missing in LCU response".into())
}

fn page_is_valid(page: &Value) -> bool {
    page.get("isValid").and_then(|c| c.as_bool()) == Some(true)
}

fn find_page_index(pages: &[Value], name: &str) -> Option<usize> {
    pages.iter().position(|p| {
        p.get("name")
            .and_then(|n| n.as_str())
            .is_some_and(|n| n == name)
    })
}

fn page_order(page: &Value) -> i64 {
    page.get("order")
        .and_then(|v| v.as_i64())
        .unwrap_or(i64::MAX)
}

fn is_editable_page(page: &Value) -> bool {
    page.get("isEditable").and_then(|e| e.as_bool()) == Some(true)
}

/// First custom rune slot (`order` lowest) — keeps the second page intact when max pages reached.
fn find_first_editable_page_index(pages: &[Value]) -> Option<usize> {
    let mut candidates: Vec<(usize, i64)> = pages
        .iter()
        .enumerate()
        .filter(|(_, p)| is_editable_page(p))
        .map(|(idx, p)| (idx, page_order(p)))
        .collect();
    candidates.sort_by_key(|(_, order)| *order);
    candidates.first().map(|(idx, _)| *idx)
}

fn can_add_custom_page(inventory: &Value) -> bool {
    inventory
        .get("canAddCustomPage")
        .and_then(|v| v.as_bool())
        .unwrap_or(true)
}

fn clear_auto_modified_selections(client: &LcuClient, page_id: i64) {
    let path = format!("/lol-perks/v1/pages/{page_id}/auto-modified-selections");
    let _ = client.delete(&path);
}

fn fetch_page(client: &LcuClient, page_id: i64) -> Result<Value, String> {
    let path = format!("/lol-perks/v1/pages/{page_id}");
    let raw = client.get(&path)?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid rune page JSON: {e}"))
}

fn shard_triplet_from_selected(ids: &[u32]) -> Option<[u32; 3]> {
    if ids.len() < 9 {
        return None;
    }
    Some([ids[6], ids[7], ids[8]])
}

/// Minimal PUT body — sending the full LCU page object back can drop stat shards.
fn put_rune_page_minimal(
    client: &LcuClient,
    page_id: i64,
    name: &str,
    runes: &RunePageData,
    selected_perk_ids: &[u32],
) -> Result<i64, String> {
    let body = json!({
        "id": page_id,
        "name": name,
        "primaryStyleId": runes.primary_path,
        "subStyleId": runes.secondary_path,
        "selectedPerkIds": selected_perk_ids,
        "current": true,
        "autoModifiedSelections": [],
    });
    let path = format!("/lol-perks/v1/pages/{page_id}");
    let payload = body.to_string();
    if let Err(e) = client.put(&path, &payload) {
        return Err(e);
    }
    clear_auto_modified_selections(client, page_id);
    Ok(page_id)
}

fn ensure_page_valid(
    client: &LcuClient,
    page_id: i64,
    name: &str,
    runes: &RunePageData,
    rows: &StatShardRows,
    selected_perk_ids: &[u32],
) -> Result<(), String> {
    let page = fetch_page(client, page_id)?;
    if page_is_valid(&page) {
        return Ok(());
    }

    let current = shard_triplet_from_selected(
        page.get("selectedPerkIds")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|x| x.as_u64().map(|n| n as u32)).collect::<Vec<_>>())
            .as_deref()
            .unwrap_or(selected_perk_ids),
    )
    .unwrap_or(normalize_shards(
        [
            selected_perk_ids[6],
            selected_perk_ids[7],
            selected_perk_ids[8],
        ],
        rows,
    ));

    let fixed = normalize_shards(current, rows);
    if fixed == current {
        return Ok(());
    }

    let mut repaired = selected_perk_ids.to_vec();
    repaired[6] = fixed[0];
    repaired[7] = fixed[1];
    repaired[8] = fixed[2];
    put_rune_page_minimal(client, page_id, name, runes, &repaired)?;
    Ok(())
}

fn create_rune_page(
    client: &LcuClient,
    name: &str,
    runes: &RunePageData,
    selected_perk_ids: &[u32],
) -> Result<i64, String> {
    let payload = json!({
        "name": name,
        "primaryStyleId": runes.primary_path,
        "subStyleId": runes.secondary_path,
        "selectedPerkIds": selected_perk_ids,
        "current": true,
        "autoModifiedSelections": [],
    });
    let created_raw = client.post("/lol-perks/v1/pages", &payload.to_string())?;
    if let Ok(created) = serde_json::from_str::<Value>(&created_raw) {
        if let Ok(id) = page_id(&created) {
            return Ok(id);
        }
    }
    let pages_raw = client.get("/lol-perks/v1/pages")?;
    let pages: Vec<Value> = serde_json::from_str(&pages_raw)
        .map_err(|e| format!("Invalid rune pages JSON: {e}"))?;
    if let Some(idx) = find_page_index(&pages, name) {
        return page_id(&pages[idx]);
    }
    Err("Rune page created but id not returned".into())
}

pub fn apply_rune_page(client: &LcuClient, build_name: &str, runes: &RunePageData) -> Result<i64, String> {
    let rows = load_stat_shard_rows(client);
    let selected_perk_ids = build_selected_perk_ids_with_rows(&runes.perks, &rows);
    for id in &selected_perk_ids {
        if *id == 0 {
            return Err("Invalid rune or shard id in build".into());
        }
    }

    let name = page_name(build_name);
    let inventory_raw = client.get("/lol-perks/v1/inventory")?;
    let inventory: Value = serde_json::from_str(&inventory_raw)
        .map_err(|e| format!("Invalid perks inventory JSON: {e}"))?;

    let pages_raw = client.get("/lol-perks/v1/pages")?;
    let pages: Vec<Value> = serde_json::from_str(&pages_raw)
        .map_err(|e| format!("Invalid rune pages JSON: {e}"))?;

    let page_id = if can_add_custom_page(&inventory) {
        if let Some(idx) = find_page_index(&pages, &name) {
            page_id(&pages[idx])?
        } else {
            create_rune_page(client, &name, runes, &selected_perk_ids)?
        }
    } else {
        let target_idx = find_first_editable_page_index(&pages)
            .ok_or_else(|| "All rune pages are locked; free a custom page first.".to_string())?;
        page_id(&pages[target_idx])?
    };

    // Never PUT other pages: a minimal `{ current: false }` body wipes their runes (-1 ids).
    // Setting `current: true` on the target page is enough — LCU deactivates the others safely.
    put_rune_page_minimal(client, page_id, &name, runes, &selected_perk_ids)?;
    ensure_page_valid(client, page_id, &name, runes, &rows, &selected_perk_ids)?;
    Ok(page_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selected_perk_ids_order() {
        let rows = default_stat_shard_rows();
        let perks = RunePerksData {
            primary_perks: [8005, 9111, 9104, 8014],
            secondary_perks: [8234, 8236],
            shards: [5008, 5008, 5001],
        };
        assert_eq!(
            build_selected_perk_ids_with_rows(&perks, &rows),
            vec![8005, 9111, 9104, 8014, 8234, 8236, 5008, 5008, 5001]
        );
    }

    #[test]
    fn legacy_defense_shard_5002_maps_to_5001() {
        let rows = default_stat_shard_rows();
        let perks = RunePerksData {
            primary_perks: [8010, 9111, 9105, 8299],
            secondary_perks: [8224, 8236],
            shards: [5008, 5008, 5002],
        };
        assert_eq!(
            build_selected_perk_ids_with_rows(&perks, &rows),
            vec![8010, 9111, 9105, 8299, 8224, 8236, 5008, 5008, 5001]
        );
    }

    #[test]
    fn legacy_5001_in_offense_row_maps_to_adaptive() {
        let rows = default_stat_shard_rows();
        assert_eq!(normalize_shard_for_row(0, 5001, &rows), 5008);
    }

    #[test]
    fn first_editable_page_is_lowest_order() {
        let pages = vec![
            json!({"id": 2, "order": 2, "isEditable": true, "name": "Keep me"}),
            json!({"id": 1, "order": 1, "isEditable": true, "name": "Replace me"}),
        ];
        assert_eq!(find_first_editable_page_index(&pages), Some(1));
    }

    #[test]
    fn parse_stat_rows_from_lcu_styles_json() {
        let raw = r#"[{"slots":[
            {"type":"kKeyStone","perks":[8005]},
            {"type":"kMixedRegularSplashable","perks":[9111]},
            {"type":"kMixedRegularSplashable","perks":[9104]},
            {"type":"kMixedRegularSplashable","perks":[8014]},
            {"type":"kStatMod","perks":[5008,5005,5007]},
            {"type":"kStatMod","perks":[5008,5010,5001]},
            {"type":"kStatMod","perks":[5011,5013,5001]}
        ]}]"#;
        let rows = parse_stat_rows_from_styles(raw).unwrap();
        assert_eq!(rows.offense, vec![5008, 5005, 5007]);
        assert_eq!(rows.flex, vec![5008, 5010, 5001]);
        assert_eq!(rows.defense, vec![5011, 5013, 5001]);
    }
}
