/** Filtre « joueurs OTP » (flag backend `otp_players`) : `?otpPlayers=` sur /api/stats. Défaut = OTP inclus. */
export type StatsOtpPlayers = 'all' | 'exclude' | 'only'

export const STATS_OTP_PLAYERS_COOKIE = 'stats_otp_players'

export const STATS_OTP_PLAYERS_SEGMENTS: ReadonlyArray<{
  value: StatsOtpPlayers
  labelKey: string
}> = [
  { value: 'all', labelKey: 'statisticsPage.otpPlayersAll' },
  { value: 'exclude', labelKey: 'statisticsPage.otpPlayersExclude' },
  { value: 'only', labelKey: 'statisticsPage.otpPlayersOnly' },
]

export function parseStatsOtpPlayers(value: unknown): StatsOtpPlayers {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return v === 'exclude' || v === 'only' ? v : 'all'
}

export function otpPlayersFromCookieHeader(header: string | undefined): StatsOtpPlayers {
  if (!header) return 'all'
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === STATS_OTP_PLAYERS_COOKIE) return parseStatsOtpPlayers(rest.join('='))
  }
  return 'all'
}

const STATS_PATH = /\/api\/stats(?:[/?#]|$)/
const PARAM = 'otpPlayers'

/** Ajoute ou remplace `otpPlayers=` sur une URL /api/stats ; `all` et autres URL inchangées. */
export function withStatsOtpPlayers(url: string, value: StatsOtpPlayers): string {
  if (value === 'all' || !STATS_PATH.test(url)) return url
  const pair = `${PARAM}=${value}`
  const hashAt = url.indexOf('#')
  const hash = hashAt >= 0 ? url.slice(hashAt) : ''
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url
  const queryAt = base.indexOf('?')
  if (queryAt < 0) return `${base}?${pair}${hash}`
  const params = base
    .slice(queryAt + 1)
    .split('&')
    .filter(Boolean)
  const index = params.findIndex(p => p.split('=')[0] === PARAM)
  if (index >= 0) params[index] = pair
  else params.push(pair)
  return `${base.slice(0, queryAt)}?${params.join('&')}${hash}`
}

/** Valeur côté client (posée par le plugin depuis le cookie). Le SSR lit le cookie de la requête. */
let clientOtpPlayers: StatsOtpPlayers = 'all'

export function getStatsOtpPlayers(): StatsOtpPlayers {
  return clientOtpPlayers
}

export function setStatsOtpPlayers(value: StatsOtpPlayers): void {
  clientOtpPlayers = value
}
