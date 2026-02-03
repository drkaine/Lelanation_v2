/**
 * Riot match collection: seed (Admin seed players + League-v4) → PUUID queue → Match-v5 IDs → match details → expand queue from participants.
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
import type { PuuidCrawlQueue } from '../generated/prisma/index.js'
import type { AppError } from '../utils/errors.js'

const MAX_SUMMONERS_PER_PLATFORM = 10
const MATCH_IDS_PER_SUMMONER = 10
/** Max PUUIDs to process per run (seed + expansion from match participants). */
const MAX_PUUIDS_PER_RUN = Math.max(20, parseInt(process.env.RIOT_MATCH_MAX_PUUIDS_PER_RUN ?? '50', 10) || 50)
const CRON_SCHEDULE = process.env.RIOT_MATCH_CRON_SCHEDULE ?? '0 * * * *' // every hour at minute 0

type Platform = 'euw1' | 'eun1'

interface PuuidItem {
  platform: Platform
  puuid: string
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
    await discordService.sendSuccess(
      '🔄 Stats LoL – Démarrage',
      'Le cron de récupération des matchs Ranked Solo/Duo (EUW + EUNE) a démarré.',
      {
        startedAt: startTime.toISOString(),
        schedule: CRON_SCHEDULE,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    )
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
    const puuidQueue: PuuidItem[] = []
    const seenPuuids = new Set<string>()
    /** PUUIDs discovered from match participants to persist for future runs. */
    const toPersistQueue: PuuidItem[] = []
    let collected = 0
    let errors = 0

    /** Match IDs requested in (matchStartTime, matchEndTime] to avoid duplicates: first run = recent only; next runs = since last success. */
    const matchEndTime = Math.floor(Date.now() / 1000)
    const matchStartTime = lastSuccessAt
      ? Math.floor(new Date(lastSuccessAt).getTime() / 1000)
      : undefined

    // 0) Admin seed players from DB (Riot ID or summoner name) → PUUID queue
    const seedPlayers = await prisma.seedPlayer.findMany({ orderBy: { createdAt: 'asc' } })
    for (const player of seedPlayers) {
      const label = typeof player.label === 'string' ? player.label.trim() : ''
      const platform = player.platform === 'eun1' ? 'eun1' : 'euw1'
      if (!label) continue
      try {
        if (label.includes('#')) {
          const [gameName, tagLine] = label.split('#').map((s: string) => s.trim())
          if (!gameName || !tagLine) {
            console.warn(`${LOG_PREFIX} Invalid Riot ID format: ${label}`)
            continue
          }
          const accountResult = await riotApi.getAccountByRiotId(gameName, tagLine)
          if (accountResult.isErr()) {
            if (isRiotAuthError(accountResult.unwrapErr())) throw accountResult.unwrapErr()
            errors++
            continue
          }
          const puuid = accountResult.unwrap().puuid
          if (!seenPuuids.has(puuid)) {
            seenPuuids.add(puuid)
            puuidQueue.push({ platform, puuid })
          }
        } else {
          const summonerResult = await riotApi.getSummonerByName(platform, label)
          if (summonerResult.isErr()) {
            const err = summonerResult.unwrapErr()
            const status = err?.cause && axios.isAxiosError(err.cause) ? err.cause.response?.status : undefined
            if (status === 403) {
              console.warn(
                `${LOG_PREFIX} Seed "${label}" (${platform}): Riot no longer allows lookup by summoner name. Use Riot ID (Name#Tag) in Admin.`
              )
              errors++
              continue
            }
            if (isRiotAuthError(err)) throw err
            errors++
            continue
          }
          const puuid = summonerResult.unwrap().puuid
          if (!seenPuuids.has(puuid)) {
            seenPuuids.add(puuid)
            puuidQueue.push({ platform, puuid })
          }
        }
      } catch (e) {
        if (isRiotAuthError(e)) throw e
        console.warn(`${LOG_PREFIX} Seed player ${label} (${platform}):`, e)
        errors++
      }
    }

    // 0b) Drain persistent PUUID queue from DB (discovered in previous runs)
    const drained = await prisma.puuidCrawlQueue.findMany({
      orderBy: { addedAt: 'asc' },
      take: MAX_PUUIDS_PER_RUN,
    })
    if (drained.length > 0) {
      await prisma.puuidCrawlQueue.deleteMany({
        where: { puuid: { in: drained.map((r: PuuidCrawlQueue) => r.puuid) } },
      })
      for (const r of drained as PuuidCrawlQueue[]) {
        const platform = (r.platform === 'eun1' ? 'eun1' : 'euw1') as Platform
        if (!seenPuuids.has(r.puuid)) {
          seenPuuids.add(r.puuid)
          puuidQueue.push({ platform, puuid: r.puuid })
        }
      }
      console.log(`${LOG_PREFIX} Drained ${drained.length} PUUIDs from crawl queue`)
    }

    // 1) Seed: League-v4 → Summoner-v4 → PUUID queue
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
          const puuid = summonerResult.unwrap().puuid
          if (!seenPuuids.has(puuid)) {
            seenPuuids.add(puuid)
            puuidQueue.push({ platform, puuid })
          }
        }
      }

    // 2) Process PUUID queue (seed + expansion from match participants), bounded
    let processedCount = 0
    while (puuidQueue.length > 0 && processedCount < MAX_PUUIDS_PER_RUN) {
      const item = puuidQueue.shift()!
      processedCount++

      const matchIdsResult = await riotApi.getMatchIdsByPuuid(item.puuid, {
        count: MATCH_IDS_PER_SUMMONER,
        queue: 420,
        endTime: matchEndTime,
        ...(matchStartTime != null && { startTime: matchStartTime }),
      })
      if (matchIdsResult.isErr()) {
        errors++
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
          const { inserted } = await upsertMatchFromRiot(item.platform, matchData)
          if (inserted) {
            collected++
            const participants = matchData.info?.participants ?? []
            for (const p of participants) {
              const participantPuuid = typeof p.puuid === 'string' ? p.puuid.trim() : ''
              if (participantPuuid && !seenPuuids.has(participantPuuid)) {
                seenPuuids.add(participantPuuid)
                const entry: PuuidItem = { platform: item.platform, puuid: participantPuuid }
                puuidQueue.push(entry)
                toPersistQueue.push(entry)
              }
            }
          }
        } catch (e) {
          errors++
        }
      }
    }

    // Persist discovered PUUIDs for future runs (skipDuplicates for already-queued)
    if (toPersistQueue.length > 0) {
      try {
        const { count } = await prisma.puuidCrawlQueue.createMany({
          data: toPersistQueue.map(({ platform, puuid }) => ({ platform, puuid })),
          skipDuplicates: true,
        })
        if (count > 0) console.log(`${LOG_PREFIX} Queued ${count} new PUUIDs for future crawl`)
      } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to persist PUUID queue:`, e)
      }
    }

    let playersUpserted = 0
    let championStatsUpserted = 0
    let playersEnriched = 0
    if (collected > 0) {
      try {
        const refresh = await refreshPlayersAndChampionStats()
        playersUpserted = refresh.playersUpserted
        championStatsUpserted = refresh.championStatsUpserted
        console.log(
          `${LOG_PREFIX} Players refresh: ${refresh.playersUpserted} players, ${refresh.championStatsUpserted} champion stats`
        )
      } catch (e) {
        console.warn(`${LOG_PREFIX} Players refresh failed:`, e)
      }
    }
    try {
      const enrich = await enrichPlayers(25)
      playersEnriched = enrich.enriched
      if (playersEnriched > 0) {
        console.log(`${LOG_PREFIX} Players enriched: ${playersEnriched} (summoner_name, rank)`)
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} Players enrichment failed:`, e)
    }
    const duration = Math.round((Date.now() - startTime.getTime()) / 1000)
    console.log(
      `${LOG_PREFIX} Done: ${collected} new matches, ${errors} errors, ${processedCount} PUUIDs processed, ${duration}s`
    )
    await cronStatus.markSuccess('riotMatchCollect')
    await discordService.sendSuccess(
      '✅ Stats LoL – Récupération terminée',
      collected > 0
        ? `${collected} nouveau(x) match(s) collecté(s). Rafraîchissement joueurs : ${playersUpserted} joueurs, ${championStatsUpserted} stats par champion.`
        : 'Aucun nouveau match (déjà en base ou pas de nouveaux matchs).',
      {
        collected,
        errors,
        duration: `${duration}s`,
        playersUpserted,
        championStatsUpserted,
        finishedAt: new Date().toISOString(),
      }
    )
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
