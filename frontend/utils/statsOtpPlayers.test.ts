import { describe, expect, it } from 'vitest'
import {
  STATS_OTP_PLAYERS_SEGMENTS,
  otpPlayersFromCookieHeader,
  parseStatsOtpPlayers,
  withStatsOtpPlayers,
} from './statsOtpPlayers'

describe('parseStatsOtpPlayers', () => {
  it('exclude / only reconnus, le reste = all (défaut : OTP inclus)', () => {
    expect(parseStatsOtpPlayers('exclude')).toBe('exclude')
    expect(parseStatsOtpPlayers(' ONLY ')).toBe('only')
    expect(parseStatsOtpPlayers('oui')).toBe('all')
    expect(parseStatsOtpPlayers(null)).toBe('all')
  })
})

describe('otpPlayersFromCookieHeader', () => {
  it('lit le cookie stats_otp_players', () => {
    expect(otpPlayersFromCookieHeader('a=1; stats_otp_players=only')).toBe('only')
    expect(otpPlayersFromCookieHeader(undefined)).toBe('all')
  })
})

describe('withStatsOtpPlayers', () => {
  it('ajoute otpPlayers= sur /api/stats seulement, rien pour all', () => {
    expect(withStatsOtpPlayers('/api/stats/x?a=1', 'only')).toBe('/api/stats/x?a=1&otpPlayers=only')
    expect(withStatsOtpPlayers('/api/stats/x', 'exclude')).toBe('/api/stats/x?otpPlayers=exclude')
    expect(withStatsOtpPlayers('/api/stats/x?otpPlayers=only', 'exclude')).toBe(
      '/api/stats/x?otpPlayers=exclude'
    )
    expect(withStatsOtpPlayers('/api/stats/x', 'all')).toBe('/api/stats/x')
    expect(withStatsOtpPlayers('/api/builds', 'only')).toBe('/api/builds')
  })
  it("ne touche pas l'ancien paramètre otp (champion peu joué)", () => {
    expect(withStatsOtpPlayers('/api/stats/x?otp=solo', 'only')).toBe(
      '/api/stats/x?otp=solo&otpPlayers=only'
    )
  })
})

describe('STATS_OTP_PLAYERS_SEGMENTS', () => {
  it('Avec (défaut) / Sans / Seulement', () => {
    expect(STATS_OTP_PLAYERS_SEGMENTS.map(s => s.value)).toEqual(['all', 'exclude', 'only'])
  })
})
