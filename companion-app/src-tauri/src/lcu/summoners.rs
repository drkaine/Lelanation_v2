//! LCU summoner spell application during champion select.

use super::LcuClient;

pub fn validate_summoner_spells(
    gameflow_phase: &str,
    spell1_id: u32,
    spell2_id: u32,
) -> Result<(), String> {
    if gameflow_phase != "ChampSelect" {
        return Err(
            "Summoner spells can only be applied during champion select (ChampSelect phase)"
                .into(),
        );
    }
    if spell1_id == 0 || spell2_id == 0 {
        return Err("Invalid summoner spell id".into());
    }
    if spell1_id == spell2_id {
        return Err("Summoner spells must be different".into());
    }
    Ok(())
}

pub fn apply_summoner_spells(
    client: &LcuClient,
    gameflow_phase: &str,
    spell1_id: u32,
    spell2_id: u32,
) -> Result<(), String> {
    validate_summoner_spells(gameflow_phase, spell1_id, spell2_id)?;

    let body = serde_json::json!({
        "spell1Id": spell1_id,
        "spell2Id": spell2_id,
    })
    .to_string();

    match client.patch("/lol-champ-select/v1/session/my-selection", &body) {
        Ok(_) => return Ok(()),
        Err(primary) => {
            if let Ok(_) = client.patch("/lol-champ-select-legacy/v1/session/my-selection", &body)
            {
                return Ok(());
            }
            Err(primary)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_outside_champ_select() {
        let err = validate_summoner_spells("Lobby", 4, 11).unwrap_err();
        assert!(err.contains("ChampSelect"));
    }

    #[test]
    fn rejects_identical_spells() {
        let err = validate_summoner_spells("ChampSelect", 4, 4).unwrap_err();
        assert!(err.contains("different"));
    }
}
