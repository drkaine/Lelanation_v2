export type ChampionMatchupCoreDominanceKey =
  | 'early'
  | 'laneEconomy'
  | 'kills'
  | 'level'
  | 'cs'
  | 'vision'

export type ChampionMatchupDominanceKey =
  | ChampionMatchupCoreDominanceKey
  | 'items'
  | 'objectives'
  | 'pressure'

export type LaneSumRow = Record<string, number | bigint | string | null | undefined>

function sumNum(row: LaneSumRow, field: string): number {
  return Number(row[field] ?? 0)
}

function perGame(row: LaneSumRow, games: number, ...fields: string[]): number {
  if (games <= 0) return 0
  let total = 0
  for (const field of fields) total += sumNum(row, field)
  return total / games
}

function perGameDiff(
  row: LaneSumRow,
  games: number,
  selfField: string,
  oppField: string,
): number {
  return perGame(row, games, selfField) - perGame(row, games, oppField)
}

function hasTimelineGold(row: LaneSumRow): boolean {
  return sumNum(row, 'sum_gold_difference_5min') !== 0 || sumNum(row, 'sum_gold_difference_15min') !== 0
}

/** Colonnes SUM utilisées dans les requêtes matchups-extended. */
export const CHAMPION_MATCHUP_LANE_SUM_COLUMNS = [
  // Timeline lane diffs vs lane opponent (detail + dominance)
  'sum_gold_difference_5min',
  'sum_gold_difference_10min',
  'sum_gold_difference_15min',
  'sum_kill_opponent_5min',
  'sum_kill_opponent_10min',
  'sum_kill_opponent_15min',
  'sum_death_by_opponent_5min',
  'sum_death_by_opponent_10min',
  'sum_death_by_opponent_15min',
  'sum_cs_difference_5min',
  'sum_cs_difference_10min',
  'sum_cs_difference_15min',
  'sum_vision_score_difference_5min',
  'sum_vision_score_difference_10min',
  'sum_vision_score_difference_15min',
  'sum_level_5min',
  'sum_level_10min',
  'sum_level_15min',
  'sum_level_opponent_5min',
  'sum_level_opponent_10min',
  'sum_level_opponent_15min',
  'sum_xp_5min',
  'sum_xp_10min',
  'sum_xp_15min',
  'sum_xp_opponent_5min',
  'sum_xp_opponent_10min',
  'sum_xp_opponent_15min',

  // Items timing (detail + dominance)
  'sum_have_legendary_item_first',
  'sum_opponent_have_legendary_item_first',
  'sum_buy_legendary_item_timestamp',
  'sum_opponent_buy_legendary_item_timestamp',
  'sum_have_boots_item_first',
  'sum_opponent_have_boots_item_first',
  'sum_buy_boots_item_timestamp',
  'sum_opponent_buy_boots_item_timestamp',
  'sum_have_boots_tier2_item_first',
  'sum_opponent_have_boots_tier2_item_first',
  'sum_buy_boots_tier2_item_timestamp',
  'sum_opponent_buy_boots_tier2_item_timestamp',
  'sum_consumable_item_bought',
  'sum_consumable_item_bought_by_opponent',

  // Objectives (detail + dominance)
  'sum_drake_kill',
  'sum_drake_assist',
  'sum_herald_kill',
  'sum_herald_assist',
  'sum_void_kill',
  'sum_void_assist',
  'sum_drake_kill_by_opponent',
  'sum_drake_assist_by_opponent',
  'sum_herald_kill_by_opponent',
  'sum_herald_assist_by_opponent',
  'sum_void_kill_by_opponent',
  'sum_void_assist_by_opponent',

  // Map tempo / structures (detail + dominance)
  'sum_first_tower',
  'sum_first_tower_by_opponent',
  'sum_turret_plate_taken',
  'sum_turret_plate_taken_by_opponent',

  // Gank / dive / roaming (detail + dominance)
  'sum_kill_by_dive',
  'sum_death_by_dive',
  'sum_kill_by_gank',
  'sum_death_by_gank',
  'sum_kill_by_roaming',
  'sum_death_by_roaming',

  // Legacy fallback lane economy/pressure keys
  'sum_max_level_lead_lane_opponent',
  'sum_max_kill_deficit',
  'sum_max_cs_advantage_on_lane_opponent',
  'sum_vision_score_advantage_lane_opponent',
  'sum_laning_phase_gold_exp_advantage',
  'sum_early_laning_phase_gold_exp_advantage',
] as const

export function buildChampionMatchupLaneSumSelect(alias: string): string {
  return CHAMPION_MATCHUP_LANE_SUM_COLUMNS.map(
    (col) => `SUM(${alias}.${col})::double precision AS "${col}"`,
  ).join(',\n      ')
}

export function computeLaneDominanceValue(
  key: ChampionMatchupDominanceKey,
  row: LaneSumRow,
  games: number,
): number {
  const g = Math.max(0, games)
  switch (key) {
    case 'early':
      if (hasTimelineGold(row)) return perGame(row, g, 'sum_gold_difference_5min')
      return perGame(row, g, 'sum_early_laning_phase_gold_exp_advantage')
    case 'laneEconomy':
      if (hasTimelineGold(row)) return perGame(row, g, 'sum_gold_difference_15min')
      return perGame(row, g, 'sum_laning_phase_gold_exp_advantage')
    case 'kills':
      if (sumNum(row, 'sum_kill_opponent_15min') > 0 || sumNum(row, 'sum_death_by_opponent_15min') > 0) {
        return (
          perGame(row, g, 'sum_kill_opponent_15min') - perGame(row, g, 'sum_death_by_opponent_15min')
        )
      }
      return -perGame(row, g, 'sum_max_kill_deficit')
    case 'cs':
      if (sumNum(row, 'sum_cs_difference_15min') !== 0) {
        return perGame(row, g, 'sum_cs_difference_15min')
      }
      return perGame(row, g, 'sum_max_cs_advantage_on_lane_opponent')
    case 'vision':
      if (sumNum(row, 'sum_vision_score_difference_15min') !== 0) {
        return perGame(row, g, 'sum_vision_score_difference_15min')
      }
      return perGame(row, g, 'sum_vision_score_advantage_lane_opponent')
    case 'level':
      if (sumNum(row, 'sum_level_15min') > 0 || sumNum(row, 'sum_level_opponent_15min') > 0) {
        return perGameDiff(row, g, 'sum_level_15min', 'sum_level_opponent_15min')
      }
      return perGame(row, g, 'sum_max_level_lead_lane_opponent')
    case 'items': {
      const firstRate =
        perGame(row, g, 'sum_have_legendary_item_first') -
        perGame(row, g, 'sum_opponent_have_legendary_item_first')
      const selfTs = perGame(row, g, 'sum_buy_legendary_item_timestamp')
      const oppTs = perGame(row, g, 'sum_opponent_buy_legendary_item_timestamp')
      const timingEdge = selfTs > 0 && oppTs > 0 ? (oppTs - selfTs) / 60_000 : 0
      return firstRate * 10 + timingEdge
    }
    case 'objectives': {
      const selfObj =
        perGame(row, g, 'sum_drake_kill', 'sum_drake_assist', 'sum_herald_kill', 'sum_herald_assist', 'sum_void_kill', 'sum_void_assist')
      const oppObj =
        perGame(
          row,
          g,
          'sum_drake_kill_by_opponent',
          'sum_drake_assist_by_opponent',
          'sum_herald_kill_by_opponent',
          'sum_herald_assist_by_opponent',
          'sum_void_kill_by_opponent',
          'sum_void_assist_by_opponent',
        )
      return selfObj - oppObj
    }
    case 'pressure':
      return (
        perGame(row, g, 'sum_first_tower') +
        perGame(row, g, 'sum_turret_plate_taken') * 0.25 +
        perGame(row, g, 'sum_kill_by_roaming') * 0.5 +
        perGame(row, g, 'sum_kill_by_gank') * 0.5
      )
    default:
      return 0
  }
}

export const CHAMPION_MATCHUP_DOMINANCE_KEYS: ChampionMatchupDominanceKey[] = [
  'early',
  'laneEconomy',
  'kills',
  'level',
  'cs',
  'vision',
  'items',
  'objectives',
  'pressure',
]
