import { describe, expect, it } from 'vitest'
import { teamFirstObjectiveMetricValue } from '../src/parsers/teamFirstObjectives.js'

describe('teamFirstObjectiveMetricValue', () => {
  const flags = {
    teamFirstBaron: true,
    teamFirstDragon: false,
    teamFirstTower: true,
    teamFirstInhibitor: false,
    teamFirstRiftHerald: false,
    teamFirstHorde: false,
  }

  it('increments win column when team secured first and won', () => {
    expect(teamFirstObjectiveMetricValue(flags, 'count_team_first_baron_win', true)).toBe(1)
    expect(teamFirstObjectiveMetricValue(flags, 'count_team_first_baron_loss', true)).toBe(0)
  })

  it('increments loss column when team secured first and lost', () => {
    expect(teamFirstObjectiveMetricValue(flags, 'count_team_first_baron_win', false)).toBe(0)
    expect(teamFirstObjectiveMetricValue(flags, 'count_team_first_baron_loss', false)).toBe(1)
  })
})
