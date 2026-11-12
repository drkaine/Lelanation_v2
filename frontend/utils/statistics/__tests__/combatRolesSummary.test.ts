import { describe, expect, it } from 'vitest'
import { combatKpis, combatRoleRows } from '../combatRolesSummary'

const metrics = {
  kills: 1.24,
  deaths: 5.1,
  assists: 14.3,
  kda: 3.05,
  damage: 9800,
  mitigated: 24500,
  gold: 8900,
  csPerMin: 1.1,
}

describe('combatRolesSummary', () => {
  it('six cartes KPI dans l’ordre de la maquette', () => {
    const k = combatKpis(metrics)
    expect(k.map(x => x.key)).toEqual(['kda3', 'kda', 'damage', 'mitigated', 'gold', 'csPerMin'])
    expect(k[0]!.value).toBe('1,2 / 5,1 / 14,3')
    expect(k[1]!.value).toBe('3,05')
    expect(k[2]!.value).toBe('9 800')
  })
  it('métrique absente → tiret', () => {
    expect(combatKpis({}).every(x => x.value === '—')).toBe(true)
  })
  it('rôles triés par parties, peu fiable sous le seuil', () => {
    const rows = combatRoleRows(
      [
        {
          role: 'TOP',
          games: 40,
          winrate: 0.5,
          kills: 1,
          deaths: 2,
          assists: 3,
          kda: 2,
          gold: 1,
          csPerMin: 1,
          damage: 1,
        },
        {
          role: 'UTILITY',
          games: 9000,
          winrate: 0.52,
          kills: 1,
          deaths: 2,
          assists: 3,
          kda: 2,
          gold: 1,
          csPerMin: 1,
          damage: 1,
        },
      ],
      100
    )
    expect(rows.map(r => r.role)).toEqual(['UTILITY', 'TOP'])
    expect(rows.map(r => r.lowSample)).toEqual([false, true])
  })
})
