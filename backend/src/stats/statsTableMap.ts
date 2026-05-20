/**
 * Logical `agg_*` names (legacy API) → physical tables in `lelanation_statistiques`.
 */
const LOGICAL_TO_PHYSICAL: Record<string, string> = {
  agg_champion_core_stats: 'champion_stats',
  agg_champion_vs_stats: 'champion_vs_stats',
  agg_champion_bucket: 'champion_bucket',
  agg_team_bucket: 'champion_bucket',
  agg_champion_damage_stats: 'champion_stats',
  agg_champion_duo_role_stats: 'champion_duo_role_stats',
  agg_champion_participant_stats: 'champion_stats',
  agg_champion_spells_stats: 'champion_spell_stats',
  agg_champion_summoner_spells: 'champion_summoner_spells',
  agg_champion_runes_stats: 'champion_runes_stats',
  agg_champion_runes_solo_stats: 'champion_runes_solo_stats',
  agg_champion_shard_solo_stats: 'champion_shard_solo_stats',
  agg_champion_item_stats: 'champion_item_set_stats',
  agg_champion_item_solo_stats: 'champion_item_solo_stats',
  agg_champion_item_starter_set_stats: 'champion_item_set_stats',
  agg_champion_summoner_spell_pair_stats: 'champion_summoner_spell_pair_stats',
  agg_champion_bans_by_banner: 'champion_bans_by_banner',
  agg_champion_bans_by_banner_core: 'champion_bans_by_banner',
  agg_champion_side_stats: 'champion_stats',
  agg_match_outcome_stats: 'match_outcome_stats',
  agg_team_core_stats: 'team_core_stat',
  agg_botlane_duo_vs_duo_stats: 'botlane_duo_vs_duo_stats',
  agg_objective_outcome_stats: 'objective_outcome_histogram',
  agg_champion_team_objective_stats: 'champion_stats',
  agg_champion_pick_order: 'champion_pick_order',
}

export function normalizeAggTableName(rawTableName: string): string {
  const t = String(rawTableName ?? '').trim()
  if (t.startsWith('mv_')) return `agg_${t.slice(3)}`
  return t
}

export function physicalTableName(logicalTableName: string): string {
  const normalized = normalizeAggTableName(logicalTableName)
  return LOGICAL_TO_PHYSICAL[normalized] ?? normalized.replace(/^agg_/, '')
}

export function isSafeIdentSegment(s: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(s)
}
