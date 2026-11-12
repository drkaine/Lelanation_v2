import { describe, expect, it } from 'vitest'
import { mobileFilterChips } from '~/utils/statistics/mobileFilterChips'

const base = {
  compareVersion: '16.20',
  otp: 'non' as const,
  role: '',
  divisions: [] as string[],
  showRole: true,
  showDivision: true,
  showOtp: true,
}

describe('mobileFilterChips', () => {
  it('maquette : vs patch, sans OTP, + rôle', () => {
    expect(mobileFilterChips(base)).toEqual([
      { id: 'compare', value: '16.20' },
      { id: 'otp', value: 'non' },
      { id: 'addRole', value: '' },
    ])
  })
  it('rôle et divisions choisis, OTP inclus masqué', () => {
    expect(
      mobileFilterChips({
        ...base,
        compareVersion: '',
        otp: 'oui',
        role: 'TOP',
        divisions: ['GOLD', 'PLATINUM'],
      })
    ).toEqual([
      { id: 'role', value: 'TOP' },
      { id: 'division', value: 'GOLD,PLATINUM' },
    ])
  })
  it('filtres non pertinents pour l’onglet ignorés', () => {
    expect(
      mobileFilterChips({ ...base, showRole: false, showOtp: false, showDivision: false })
    ).toEqual([{ id: 'compare', value: '16.20' }])
  })
})
