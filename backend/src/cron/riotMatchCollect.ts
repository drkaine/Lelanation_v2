/**
 * Riot match collection: players table (admin + League-v4 + discovered from matches) → crawl by last_seen → Match-v5 → upsert participants into players.
 * See docs/riot-api-match-collection.md for workflow, limits, and TOS.
 * Ranked Solo/Duo (420), EUW + EUNE. Schedule: every hour (RIOT_MATCH_CRON_SCHEDULE).
 */
import axios from 'axios'
import cron from 'node-cron'
import { getRiotApiService } from '../services/RiotApiService.js'
import { upsertMatchFromRiot, hasMatch } from '../services/MatchCollectService.js'
import { refreshPlayersAndChampionStats, enrichPlayers } from '../services/StatsPlayersRefreshService.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { DiscordService } from '../services/DiscordService.js'
import { isDatabaseConfigured, prisma } from '../db.js'
import type { AppError } from '../utils/errors.js'

const MAX_SUMMONERS_PER_PLATFORM = 10
const MATCH_IDS_PER_SUMMONER = 10
/** Max players to crawl per run (from players table, ordered by last_seen asc nulls first). */
const MAX_PUUIDS_PER_RUN = Math.max(20, parseInt(process.env.RIOT_MATCH_MAX_PUUIDS_PER_RUN ?? '50', 10) || 50)
/** Players to enrich (summoner_name) per run. */
const ENRICH_PER_RUN = Math.max(10, parseInt(process.env.RIOT_MATCH_ENRICH_PER_PASS ?? '150', 10) || 150)
const CRON_SCHEDULE = process.env.RIOT_MATCH_CRON_SCHEDULE ?? '0 * * * *' // every hour at minute 0

type Platform = 'euw1' | 'eun1'

interface CrawlRow {
  puuid: string
  region: string
}

function isRiotAuthError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)
}

const LOG_PREFIX = '[Riot match collect]'

/**
 * Run one full Riot match collection pass (EUW + EUNE, leagues + matches + refresh).
 * Used by the cron and by the npm script `riot:collect`.
 */
export async function runRiotMatchCollectOnce(): Promise<void> {
  const riotApi = getRiotApiService()
  const cronStatus = new CronStatusService()
  const discordService = new DiscordService()
  const startTime = new Date()

  console.log(`${LOG_PREFIX} Starting...`)

  if (!isDatabaseConfigured()) {
    console.warn(`${LOG_PREFIX} Skipped: DATABASE_URL not set`)
    await discordService.sendAlert(
      '⚠️ Stats LoL – Base de données non configurée',
      'Le cron de récupération des stats LoL a été ignoré : DATABASE_URL non défini.',
      undefined,
      { startedAt: startTime.toISOString() }
    )
    return
  }

  try {
    // await discordService.sendSuccess(
    //   '🔄 Stats LoL – Démarrage',
    //   'Le cron de récupération des matchs Ranked Solo/Duo (EUW + EUNE) a démarré.',
    //   {
    //     startedAt: startTime.toISOString(),
    //     schedule: CRON_SCHEDULE,
    //     timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    //   }
    // )
    const statusResult = await cronStatus.getStatus()
    const lastSuccessAt =
      statusResult.isOk() ? statusResult.unwrap().jobs.riotMatchCollect?.lastSuccessAt ?? null : null
    await cronStatus.markStart('riotMatchCollect')

    const apiKey = await import('../utils/riotApiKey.js').then((m) => m.getRiotApiKeyAsync())
    if (!apiKey) {
      const err = new Error('RIOT_API_KEY not configured')
      await cronStatus.markFailure('riotMatchCollect', err)
      console.warn(`${LOG_PREFIX} Skipped: no API key`)
      await discordService.sendAlert(
          '🔑 Stats LoL – Clé API non configurée',
          'Aucune clé API Riot (env ou admin). Configurez RIOT_API_KEY ou définissez la clé dans l’onglet Admin.',
          err,
          { startedAt: startTime.toISOString() }
      )
      return
    }

    const platforms: Platform[] = ['euw1', 'eun1']
    let collected = 0
    let errors = 0

    const matchEndTime = Math.floor(Date.now() / 1000)
    const matchStartTime = lastSuccessAt
      ? Math.floor(new Date(lastSuccessAt).getTime() / 1000)
      : undefined

    // 1) League-v4 seed: Challenger / GM / Master → upsert into players
    for (const platform of platforms) {
        const entries: Array<{ summonerId: string }> = []

        const challenger = await riotApi.getChallengerLeague(platform)
        if (challenger.isErr()) {
          const apiErr = challenger.unwrapErr() as AppError
          if (isRiotAuthError(apiErr)) {
            riotApi.invalidateKeyCache()
            await cronStatus.markFailure('riotMatchCollect', apiErr)
            await discordService.sendAlert(
              '🔑 Stats LoL – Clé API Riot invalide ou expirée',
              'Riot a renvoyé 401/403. Vérifiez la clé dans l’onglet Admin ou renouvelez-la sur le portail développeur Riot.',
              apiErr,
              {
                platform,
                startedAt: startTime.toISOString(),
                hint: 'Mettez à jour la clé API Riot dans Admin > Clé API Riot',
              }
            )
            throw apiErr
          }
          errors++
          continue
        }
        entries.push(...challenger.unwrap().slice(0, 4))

        const grandmaster = await riotApi.getGrandmasterLeague(platform)
        if (grandmaster.isOk()) entries.push(...grandmaster.unwrap().slice(0, 3))

        const master = await riotApi.getMasterLeague(platform)
        if (master.isOk()) entries.push(...master.unwrap().slice(0, 3))

        const toProcess = entries
          .filter((e) => e.summonerId && e.summonerId.trim() !== '')
          .slice(0, MAX_SUMMONERS_PER_PLATFORM)
        for (const entry of toProcess) {
          const summonerResult = await riotApi.getSummonerById(platform, entry.summonerId)
          if (summonerResult.isErr()) {
            if (isRiotAuthError(summonerResult.unwrapErr())) {
              const apiErr = summonerResult.unwrapErr() as AppError
              riotApi.invalidateKeyCache()
              await cronStatus.markFailure('riotMatchCollect', apiErr)
              await discordService.sendAlert(
                '🔑 Stats LoL – Clé API Riot invalide ou expirée',
                'Riot a renvoyé 401/403. Vérifiez la clé dans l’onglet Admin ou renouvelez-la sur le portail développeur Riot.',
                apiErr,
                { platform, startedAt: startTime.toISOString() }
              )
              throw apiErr
            }
            errors++
            continue
          }
          const s = summonerResult.unwrap()
          await prisma.player.upsert({
            where: { puuid: s.puuid },
            create: { puuid: s.puuid, summonerId: s.id || null, summonerName: s.name || null, region: platform, lastSeen: null },
            update: {},
          })
        }
      }

    // 2) Crawl: players ordered by last_seen asc nulls first
    const playersToCrawl = await prisma.$queryRaw<CrawlRow[]>`
      SELECT puuid, region FROM players
      ORDER BY last_seen ASC NULLS FIRST
      LIMIT ${MAX_PUUIDS_PER_RUN}
    `
    let processedCount = 0
    for (const row of playersToCrawl) {
      const platform = (row.region === 'eun1' ? 'eun1' : 'euw1') as Platform
      processedCount++

      const matchIdsResult = await riotApi.getMatchIdsByPuuid(row.puuid, {
        count: MATCH_IDS_PER_SUMMONER,
        queue: 420,
        endTime: matchEndTime,
        ...(matchStartTime != null && { startTime: matchStartTime }),
      })
      if (matchIdsResult.isErr()) {
        errors++
        await prisma.player.update({ where: { puuid: row.puuid }, data: { lastSeen: new Date() } })
        continue
      }
      const matchIds = matchIdsResult.unwrap()

      for (const matchId of matchIds) {
        try {
          if (await hasMatch(matchId)) continue
          const matchResult = await riotApi.getMatch(matchId)
          if (matchResult.isErr()) {
            if ((matchResult.unwrapErr() as { details?: { status?: number } }).details?.status === 404) continue
            errors++
            continue
          }
          const matchData = matchResult.unwrap()
          const patchPrefix = process.env.RIOT_MATCH_PATCH_PREFIX?.trim()
          if (
            patchPrefix &&
            typeof matchData.info?.gameVersion === 'string' &&
            !matchData.info.gameVersion.startsWith(patchPrefix)
          ) {
            continue
          }
          const { inserted } = await upsertMatchFromRiot(platform, matchData)
          if (inserted) {
            collected++
            const participants = matchData.info?.participants ?? []
            for (const p of participants) {
              const participantPuuid = typeof p.puuid === 'string' ? p.puuid.trim() : ''
              if (!participantPuuid) continue
              const summonerId = typeof (p as { summonerId?: string }).summonerId === 'string' ? (p as { summonerId: string }).summonerId : null
              await prisma.player.upsert({
                where: { puuid: participantPuuid },
                create: { puuid: participantPuuid, summonerId, region: platform, lastSeen: null },
                update: { summonerId: summonerId ?? undefined },
              })
            }
          }
        } catch (e) {
          errors++
        }
      }
      await prisma.player.update({ where: { puuid: row.puuid }, data: { lastSeen: new Date() } })
    }

    if (collected > 0) {
      try {
        const refresh = await refreshPlayersAndChampionStats()
        console.log(
          `${LOG_PREFIX} Players refresh: ${refresh.playersUpserted} players, ${refresh.championStatsUpserted} champion stats`
        )
      } catch (e) {
        console.warn(`${LOG_PREFIX} Players refresh failed:`, e)
      }
    }
    try {
      const enrich = await enrichPlayers(ENRICH_PER_RUN)
      console.log(`${LOG_PREFIX} Players enriched: ${enrich.enriched} (summoner_name)`)

    } catch (e) {
      console.warn(`${LOG_PREFIX} Players enrichment failed:`, e)
    }
    const duration = Math.round((Date.now() - startTime.getTime()) / 1000)
    console.log(
      `${LOG_PREFIX} Done: ${collected} new matches, ${errors} errors, ${processedCount} PUUIDs processed, ${duration}s`
    )
    await cronStatus.markSuccess('riotMatchCollect')
    // await discordService.sendSuccess(
    //   '✅ Stats LoL – Récupération terminée',
    //   collected > 0
    //     ? `${collected} nouveau(x) match(s) collecté(s). Rafraîchissement joueurs : ${playersUpserted} joueurs, ${championStatsUpserted} stats par champion.`
    //     : 'Aucun nouveau match (déjà en base ou pas de nouveaux matchs).',
    //   {
    //     collected,
    //     errors,
    //     duration: `${duration}s`,
    //     playersUpserted,
    //     championStatsUpserted,
    //     finishedAt: new Date().toISOString(),
    //   }
    // )
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error(`${LOG_PREFIX} Failed:`, error)
    await cronStatus.markFailure('riotMatchCollect', error)
    await discordService.sendAlert(
      '❌ Stats LoL – Erreur',
      'Le cron de récupération des stats LoL a échoué.',
      error,
      {
        startedAt: startTime.toISOString(),
        finishedAt: new Date().toISOString(),
      }
    )
    throw error
  }
}

export function setupRiotMatchCollect(): void {
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      await runRiotMatchCollectOnce()
    } catch (err) {
      console.error('[Cron] Riot match collect error:', err)
    }
  })
  console.log('[Cron] Riot match collection scheduled:', CRON_SCHEDULE)
}
