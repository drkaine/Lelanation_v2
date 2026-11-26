import { describe, expect, it } from 'vitest'
import { emptyOtpCompare, otpGroupSummary, parseOtpCompare } from './otpCompare'

const valid = {
  groups: [
    { group: 'otp', games: 100, winRate: 52, kda: 3, avgKills: 6, afkRate: 1, champions: 20 },
    {
      group: 'others',
      games: 1000,
      winRate: 50,
      kda: 2.5,
      avgKills: 5,
      afkRate: 2,
      champions: 160,
    },
  ],
  top: [{ group: 'otp', picked: [{ championId: 1, rate: 30, games: 30 }], winrate: [] }],
  spreads: {
    pickRate: [
      { championId: 1, byRegion: { otp: 30, others: 3 }, spread: 27, high: 'otp', low: 'others' },
    ],
    winRate: [],
  },
}

describe('parseOtpCompare', () => {
  it('réponse valide conservée', () => {
    expect(parseOtpCompare(valid)).toEqual(valid)
  })
  it('réponse invalide → vide', () => {
    expect(parseOtpCompare(null)).toEqual(emptyOtpCompare())
    expect(parseOtpCompare({ groups: [] })).toEqual(emptyOtpCompare())
    expect(parseOtpCompare({ ...valid, spreads: { pickRate: [] } })).toEqual(emptyOtpCompare())
  })
})

describe('otpGroupSummary', () => {
  it('trouve le groupe ou null', () => {
    expect(otpGroupSummary(parseOtpCompare(valid), 'otp')?.games).toBe(100)
    expect(otpGroupSummary(emptyOtpCompare(), 'others')).toBeNull()
  })
})
