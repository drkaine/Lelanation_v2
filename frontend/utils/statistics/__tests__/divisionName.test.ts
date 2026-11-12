import { describe, expect, it } from 'vitest'
import { divisionName } from '~/utils/statistics/divisionName'

describe('divisionName', () => {
  it('nom français des divisions', () => {
    expect(divisionName('IRON', 'fr')).toBe('Fer')
    expect(divisionName('EMERALD', 'fr')).toBe('Émeraude')
    expect(divisionName('GRANDMASTER', 'fr')).toBe('Grand Maître')
  })
  it('anglais et inconnu', () => {
    expect(divisionName('GRANDMASTER', 'en')).toBe('Grandmaster')
    expect(divisionName('unranked', 'fr')).toBe('Unranked')
  })
})
