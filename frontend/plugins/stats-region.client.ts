import { STATS_REGION_COOKIE, parseStatsRegions, setStatsRegions } from '~/utils/statsRegion'
import {
  STATS_OTP_PLAYERS_COOKIE,
  parseStatsOtpPlayers,
  setStatsOtpPlayers,
} from '~/utils/statsOtpPlayers'

/** Régions et filtre OTP des stats (cookies) posés avant les premiers appels API client. */
export default defineNuxtPlugin(() => {
  setStatsRegions(parseStatsRegions(useCookie<string | null>(STATS_REGION_COOKIE).value))
  setStatsOtpPlayers(parseStatsOtpPlayers(useCookie<string | null>(STATS_OTP_PLAYERS_COOKIE).value))
})
