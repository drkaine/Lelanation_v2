/** Flags « first objectif » au niveau équipe (match-v5 `team.objectives.*.first`). */
export type TeamFirstObjectiveFlags = {
  teamFirstBaron: boolean
  teamFirstDragon: boolean
  teamFirstTower: boolean
  teamFirstInhibitor: boolean
  teamFirstRiftHerald: boolean
  teamFirstHorde: boolean
}

export const TEAM_FIRST_OBJECTIVE_METRIC_COLUMNS = [
  'count_team_first_baron_win',
  'count_team_first_baron_loss',
  'count_team_first_dragon_win',
  'count_team_first_dragon_loss',
  'count_team_first_tower_win',
  'count_team_first_tower_loss',
  'count_team_first_inhibitor_win',
  'count_team_first_inhibitor_loss',
  'count_team_first_rift_herald_win',
  'count_team_first_rift_herald_loss',
  'count_team_first_horde_win',
  'count_team_first_horde_loss',
] as const

export type TeamFirstObjectiveMetricColumn = (typeof TEAM_FIRST_OBJECTIVE_METRIC_COLUMNS)[number]

const FLAG_BY_METRIC: Record<TeamFirstObjectiveMetricColumn, keyof TeamFirstObjectiveFlags> = {
  count_team_first_baron_win: 'teamFirstBaron',
  count_team_first_baron_loss: 'teamFirstBaron',
  count_team_first_dragon_win: 'teamFirstDragon',
  count_team_first_dragon_loss: 'teamFirstDragon',
  count_team_first_tower_win: 'teamFirstTower',
  count_team_first_tower_loss: 'teamFirstTower',
  count_team_first_inhibitor_win: 'teamFirstInhibitor',
  count_team_first_inhibitor_loss: 'teamFirstInhibitor',
  count_team_first_rift_herald_win: 'teamFirstRiftHerald',
  count_team_first_rift_herald_loss: 'teamFirstRiftHerald',
  count_team_first_horde_win: 'teamFirstHorde',
  count_team_first_horde_loss: 'teamFirstHorde',
}

export function teamFirstObjectiveMetricValue(
  flags: TeamFirstObjectiveFlags,
  col: TeamFirstObjectiveMetricColumn,
  won: boolean
): number {
  const flagKey = FLAG_BY_METRIC[col]
  const hasFirst = flags[flagKey] === true
  if (!hasFirst) return 0
  const isWinCol = col.endsWith('_win')
  return isWinCol ? (won ? 1 : 0) : won ? 0 : 1
}

export function readTeamFirstObjectiveFlags(
  teamObjectives: Record<string, { first?: boolean } | undefined> | null | undefined
): TeamFirstObjectiveFlags {
  const o = teamObjectives ?? {}
  return {
    teamFirstBaron: o.baron?.first === true,
    teamFirstDragon: o.dragon?.first === true,
    teamFirstTower: o.tower?.first === true,
    teamFirstInhibitor: o.inhibitor?.first === true,
    teamFirstRiftHerald: o.riftHerald?.first === true,
    teamFirstHorde: o.horde?.first === true,
  }
}
