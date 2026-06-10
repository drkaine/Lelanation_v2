/**
 * Colonnes ping `champion_stats` (alignées sur championStatsMetricColumns + match-v5 participant).
 */
export const CHAMPION_PING_METRIC_KEYS = [
  'allIn',
  'assistMe',
  'basic',
  'command',
  'danger',
  'enemyMissing',
  'enemyVision',
  'getBack',
  'hold',
  'needVision',
  'onMyWay',
  'push',
  'retreat',
  'visionCleared',
] as const

export type ChampionPingMetricKey = (typeof CHAMPION_PING_METRIC_KEYS)[number]

/** Colonnes SQL `sum_*_pings` correspondantes. */
export const CHAMPION_PING_SQL_COLUMN: Record<ChampionPingMetricKey, string> = {
  allIn: 'sum_all_in_pings',
  assistMe: 'sum_assist_me_pings',
  basic: 'sum_basic_pings',
  command: 'sum_command_pings',
  danger: 'sum_danger_pings',
  enemyMissing: 'sum_enemy_missing_pings',
  enemyVision: 'sum_enemy_vision_pings',
  getBack: 'sum_get_back_pings',
  hold: 'sum_hold_pings',
  needVision: 'sum_need_vision_pings',
  onMyWay: 'sum_on_my_way_pings',
  push: 'sum_push_pings',
  retreat: 'sum_retreat_pings',
  visionCleared: 'sum_vision_cleared_pings',
}
