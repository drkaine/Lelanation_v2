/**
 * Colonnes ping `champion_stats` (alignées sur championStatsMetricColumns + match-v5 participant).
 *
 * Champs API obsolètes (toujours 0 chez Riot depuis ~2024) :
 * - basicPings → commandPings (ping générique bleu)
 * - dangerPings → getBackPings (ping prudent jaune)
 * - holdPings, visionClearedPings → plus alimentés en pratique
 *
 * @see https://github.com/RiotGames/developer-relations/issues/870
 * @see https://github.com/RiotGames/developer-relations/issues/871
 */
export const CHAMPION_PING_METRIC_KEYS = [
  'allIn',
  'assistMe',
  'basic',
  'danger',
  'enemyMissing',
  'enemyVision',
  'needVision',
  'onMyWay',
  'push',
  'retreat',
] as const

export type ChampionPingMetricKey = (typeof CHAMPION_PING_METRIC_KEYS)[number]

/** Toutes les colonnes ping distinctes pour le total / partie (sans double-compte). */
export const CHAMPION_PING_TOTAL_SQL_COLUMNS = [
  'sum_all_in_pings',
  'sum_assist_me_pings',
  'sum_command_pings',
  'sum_enemy_missing_pings',
  'sum_enemy_vision_pings',
  'sum_get_back_pings',
  'sum_need_vision_pings',
  'sum_on_my_way_pings',
  'sum_push_pings',
  'sum_retreat_pings',
] as const

export type ChampionPingSqlColumn = (typeof CHAMPION_PING_TOTAL_SQL_COLUMNS)[number]

/** Colonne SQL agrégée pour chaque métrique affichée (peut différer du nom API historique). */
export const CHAMPION_PING_SQL_COLUMN: Record<ChampionPingMetricKey, ChampionPingSqlColumn> = {
  allIn: 'sum_all_in_pings',
  assistMe: 'sum_assist_me_pings',
  basic: 'sum_command_pings',
  danger: 'sum_get_back_pings',
  enemyMissing: 'sum_enemy_missing_pings',
  enemyVision: 'sum_enemy_vision_pings',
  needVision: 'sum_need_vision_pings',
  onMyWay: 'sum_on_my_way_pings',
  push: 'sum_push_pings',
  retreat: 'sum_retreat_pings',
}
