import { describe, expect, it } from 'vitest'
import { statsFilterChips } from '../statsFilterChips'

const allFlags = { division: true, role: true, otp: true, championSearch: true }
const empty = { version: '', divisions: [], role: '', otp: 'non' as const, search: '' }

describe('statsFilterChips', () => {
  it('aucune puce sans filtre actif', () => {
    expect(statsFilterChips(empty, allFlags)).toEqual([])
  })
  it('une puce par filtre actif, dans l’ordre version, division, rôle, otp, recherche', () => {
    const chips = statsFilterChips(
      {
        version: '16.20',
        divisions: ['GOLD', 'PLATINUM'],
        role: 'MID',
        otp: 'oui',
        search: ' ahri ',
      },
      allFlags
    )
    expect(chips).toEqual([
      { key: 'version', value: '16.20' },
      { key: 'division', value: 'GOLD, PLATINUM' },
      { key: 'role', value: 'MID' },
      { key: 'otp', value: 'oui' },
      { key: 'search', value: 'ahri' },
    ])
  })
  it('ignore les filtres que l’onglet n’utilise pas', () => {
    const flags = { division: false, role: false, otp: false, championSearch: false }
    const chips = statsFilterChips(
      { version: '16.20', divisions: ['GOLD'], role: 'MID', otp: 'solo', search: 'x' },
      flags
    )
    expect(chips).toEqual([{ key: 'version', value: '16.20' }])
  })
})
