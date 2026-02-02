/**
 * Riot match collection cron: Ranked Solo/Duo (420) for EUW + EUNE.
 * Fetches Challenger / Grandmaster / Master leagues, then match IDs and match details; stores in PostgreSQL.
 * Schedule: every 3 hours (configurable).
 */
import cron from 'node-cron'
import { getRiotApiService } from '../services/RiotApiService.js'
import { upsertMatchFromRiot, hasMatch } from '../services/MatchCollectService.js'
import { refreshPlayersAndChampionStats } from '../services/StatsPlayersRefreshService.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { isDatabaseConfigured } from '../db.js'

const MAX_SUMMONERS_PER_PLATFORM = 10
const MATCH_IDS_PER_SUMMONER = 10
const CRON_SCHEDULE = process.env.RIOT_MATCH_CRON_SCHEDULE ?? '0 */3 * * *' // every 3 hours

type Platform = 'euw1' | 'eun1'

export function setupRiotMatchCollect(): void {
  const riotApi = getRiotApiService()
  const cronStatus = new CronStatusService()

  cron.schedule(CRON_SCHEDULE, async () => {
    const startTime = new Date()
    console.log('[Cron] Starting Riot match collection...')

    if (!isDatabaseConfigured()) {
      console.warn('[Cron] Riot match collect skipped: DATABASE_URL not set')
      return
    }

    try {
      await cronStatus.markStart('riotMatchCollect')

      const apiKey = await import('../utils/riotApiKey.js').then((m) => m.getRiotApiKeyAsync())
      if (!apiKey) {
        await cronStatus.markFailure('riotMatchCollect', new Error('RIOT_API_KEY not configured'))
        console.warn('[Cron] Riot match collect skipped: no API key')
        return
      }

      const platforms: Platform[] = ['euw1', 'eun1']
      let collected = 0
      let errors = 0

      for (const platform of platforms) {
        const entries: Array<{ summonerId: string }> = []

        const challenger = await riotApi.getChallengerLeague(platform)
        if (challenger.isOk()) entries.push(...challenger.unwrap().slice(0, 4))

        const grandmaster = await riotApi.getGrandmasterLeague(platform)
        if (grandmaster.isOk()) entries.push(...grandmaster.unwrap().slice(0, 3))

        const master = await riotApi.getMasterLeague(platform)
        if (master.isOk()) entries.push(...master.unwrap().slice(0, 3))

        const toProcess = entries.slice(0, MAX_SUMMONERS_PER_PLATFORM)
        for (const entry of toProcess) {
          const summonerResult = await riotApi.getSummonerById(platform, entry.summonerId)
          if (summonerResult.isErr()) {
            errors++
            continue
          }
          const puuid = summonerResult.unwrap().puuid

          const matchIdsResult = await riotApi.getMatchIdsByPuuid(puuid, {
            count: MATCH_IDS_PER_SUMMONER,
            queue: 420,
          })
          if (matchIdsResult.isErr()) {
            errors++
            continue
          }
          const matchIds = matchIdsResult.unwrap()

          for (const matchId of matchIds) {
            try {
              const exists = await hasMatch(matchId)
              if (exists) continue
              const matchResult = await riotApi.getMatch(matchId)
              if (matchResult.isErr()) {
                if ((matchResult.unwrapErr() as { details?: { status?: number } }).details?.status === 404) continue
                errors++
                continue
              }
              const { inserted } = await upsertMatchFromRiot(platform, matchResult.unwrap())
              if (inserted) collected++
            } catch (e) {
              errors++
            }
          }
        }
      }

      if (collected > 0) {
        try {
          const refresh = await refreshPlayersAndChampionStats()
          console.log(
            `[Cron] Players refresh: ${refresh.playersUpserted} players, ${refresh.championStatsUpserted} champion stats`
          )
        } catch (e) {
          console.warn('[Cron] Players refresh failed:', e)
        }
      }
      const duration = Math.round((Date.now() - startTime.getTime()) / 1000)
      console.log(`[Cron] Riot match collect done: ${collected} new matches, ${errors} errors, ${duration}s`)
      await cronStatus.markSuccess('riotMatchCollect')
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error('[Cron] Riot match collect failed:', error)
      await cronStatus.markFailure('riotMatchCollect', error)
    }
  })

  console.log('[Cron] Riot match collection scheduled:', CRON_SCHEDULE)
}
