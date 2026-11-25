import { STATS_REGION_COOKIE, parseStatsRegions, setStatsRegions } from '~/utils/statsRegion'

/** Régions stats du cookie posées avant les premiers appels API client. */
export default defineNuxtPlugin(() => {
  setStatsRegions(parseStatsRegions(useCookie<string | null>(STATS_REGION_COOKIE).value))
})
