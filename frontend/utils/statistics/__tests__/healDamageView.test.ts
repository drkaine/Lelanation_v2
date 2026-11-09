import { describe, expect, it } from 'vitest'
import { damageSplit, healingBars } from '../healDamageView'

describe('healDamageView', () => {
  it('soins triés, barre relative au max', () => {
    const rows = healingBars([
      { key: 'healsOnTeammates', avgPerGame: 500 },
      { key: 'totalHeal', avgPerGame: 4000 },
      { key: 'zero', avgPerGame: 0 },
    ])
    expect(rows.map(r => [r.key, r.pct])).toEqual([
      ['totalHeal', 100],
      ['healsOnTeammates', 12.5],
    ])
  })
  it('dégâts : magiques, physiques, bruts, total et parts', () => {
    const s = damageSplit([
      { key: 'physicalDone', avgPerGame: 25 },
      { key: 'magicDone', avgPerGame: 50 },
      { key: 'trueDone', avgPerGame: 25 },
    ])
    expect(s.total).toBe(100)
    expect(s.parts.map(p => [p.key, p.pct])).toEqual([
      ['magicDone', 50],
      ['physicalDone', 25],
      ['trueDone', 25],
    ])
  })
  it('dégâts absents → total 0, parts à 0', () => {
    expect(damageSplit([]).total).toBe(0)
    expect(damageSplit([]).parts.every(p => p.pct === 0)).toBe(true)
  })
})
