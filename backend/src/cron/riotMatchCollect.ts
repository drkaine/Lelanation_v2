/**
 * Riot match collection: players table (admin + League-v4 + discovered from matches) → crawl by last_seen → Match-v5 → upsert participants into players.
 * See docs/riot-api-match-collection.md for workflow, limits, and TOS.
 * Ranked Solo/Duo (420), EUW + EUNE. Schedule: every hour (RIOT_MATCH_CRON_SCHEDULE).
 */
import axios from 'axios'
import { promises as fs } from 'fs'
import cron from 'node-cron'
import { join } from 'path'
import { getRiotApiService } from '../services/RiotApiService.js'
import { upsertMatchFromRiot, hasMatch } from '../services/MatchCollectService.js'
import {
  refreshPlayersAndChampionStats,
  enrichPlayers,
  fetchRanksForPuuids,
  backfillParticipantRanks,
  refreshMatchRanks,
  countPlayersMissingSummonerName,
  countParticipantsMissingRank,
} from '../services/StatsPlayersRefreshService.js'
import {
  loadAllowedGameVersions,
  isAllowedGameVersion,
  getPatchTimeWindows,
  getVersionPrefixesSortedByReleaseDate,
} from '../services/AllowedGameVersions.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { DiscordService } from '../services/DiscordService.js'
import { isDatabaseConfigured, prisma } from '../db.js'
import type { AppError } from '../utils/errors.js'

const MAX_SUMMONERS_PER_PLATFORM = 10
const MATCH_IDS_PER_SUMMONER = 10
/** Max players to crawl per run (from players table: last_seen IS NULL first, then last_seen ASC). */
const MAX_PUUIDS_PER_RUN = Math.max(20, parseInt(process.env.RIOT_MATCH_MAX_PUUIDS_PER_RUN ?? '50', 10) || 50)
/** Players to enrich (summoner_name) per run. */
const ENRICH_PER_RUN = Math.max(10, parseInt(process.env.RIOT_MATCH_ENRICH_PER_PASS ?? '150', 10) || 150)
/** Participant ranks to backfill per cron run (League API by puuid). 0 = disabled. Batch size per backfill call. */
const BACKFILL_RANKS_PER_RUN = Math.max(0, parseInt(process.env.RIOT_BACKFILL_RANKS_PER_RUN ?? '200', 10) || 0)
/** Max backfill batches per cron run (drain backlog of participants without rank). */
const BACKFILL_RANKS_MAX_BATCHES = Math.max(1, parseInt(process.env.RIOT_BACKFILL_RANKS_MAX_BATCHES ?? '3', 10) || 1)
const CRON_SCHEDULE = process.env.RIOT_MATCH_CRON_SCHEDULE ?? '0 * * * *' // every hour at minute 0
/** If lastSuccessAt is older than this (ms), use a fallback window so we still fetch recent matches. */
const LAST_SUCCESS_MAX_AGE_MS = 12 * 60 * 60 * 1000 // 12 hours
/** Fallback window: fetch matches from (now - this) when lastSuccessAt is too old. */
const FALLBACK_WINDOW_SEC = 24 * 60 * 60 // 24 hours

type Platform = 'euw1' | 'eun1'

interface CrawlRow {
  puuid: string
  region: string
}

function isRiotAuthError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)
}

function isRateLimitError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && cause.response?.status === 429
}

const LOG_PREFIX = '[Riot match collect]'

/**
 * Run one full Riot match collection pass (EUW + EUNE, leagues + matches + refresh).
 * Used by the cron, the worker, and the npm script `riot:collect`.
 * Returns { collected, errors } on success; throws on failure.
 */
export async function runRiotMatchCollectOnce(): Promise<{
  collected: number
  errors: number
  rateLimitHit?: boolean
}> {
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
    return { collected: 0, errors: 0, rateLimitHit: false }
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
      return { collected: 0, errors: 0, rateLimitHit: false }
    }

    const platforms: Platform[] = ['euw1', 'eun1']
    let collected = 0
    let errors = 0

    const matchEndTime = Math.floor(Date.now() / 1000)

    // Allowed game versions (from data/game/versions.json + version.json) for filtering match collection
    const { allowedVersions } = await loadAllowedGameVersions()
    if (allowedVersions.size > 0) {
      console.log(`${LOG_PREFIX} Allowed game versions: ${[...allowedVersions].sort().join(', ')}`)
    }

    // Fenêtres par patch (16.1, 16.2, 16.3…) pour récupérer des matchs de chaque version, pas seulement la plus récente
    let patchWindows = await getPatchTimeWindows(matchEndTime)
    if (patchWindows.length === 0) {
      // Fallback: une seule fenêtre [oldestRelease, now] ou [lastSuccessAt, now]
      const { oldestReleaseEpochSec } = await loadAllowedGameVersions()
      let matchStartTime = lastSuccessAt ? Math.floor(new Date(lastSuccessAt).getTime() / 1000) : undefined
      if (lastSuccessAt != null && Date.now() - new Date(lastSuccessAt).getTime() > LAST_SUCCESS_MAX_AGE_MS) {
        matchStartTime = matchEndTime - FALLBACK_WINDOW_SEC
      }
      if (oldestReleaseEpochSec != null) {
        matchStartTime = matchStartTime != null ? Math.max(matchStartTime, oldestReleaseEpochSec) : oldestReleaseEpochSec
      }
      if (matchStartTime != null) {
        patchWindows = [{ startTime: matchStartTime, endTime: matchEndTime }]
      }
      if (patchWindows.length > 0) {
        const w = patchWindows[0]
        console.log(`${LOG_PREFIX} Match window: ${new Date(w.startTime * 1000).toISOString()} -> ${new Date(w.endTime * 1000).toISOString()}`)
      }
    } else {
      console.log(
        `${LOG_PREFIX} Patch windows: ${patchWindows.length} (${patchWindows.map((w) => `${new Date(w.startTime * 1000).toISOString().slice(0, 10)}→${new Date(w.endTime * 1000).toISOString().slice(0, 10)}`).join(', ')})`
      )
    }

    // Vérif: joueurs avec last_seen qui n'ont des matchs que sur la version la plus récente (ex. 16.3) → reset last_seen pour re-crawl avec toutes les fenêtres (16.1, 16.2, 16.3)
    if (patchWindows.length > 1) {
      const versionPrefixes = await getVersionPrefixesSortedByReleaseDate()
      const oldPrefixes = versionPrefixes.slice(0, -1)
      if (oldPrefixes.length > 0) {
        const participantsWithOldVersion = await prisma.participant.findMany({
          where: {
            match: {
              AND: [
                { gameVersion: { not: null } },
                { OR: oldPrefixes.map((prefix) => ({ gameVersion: { startsWith: `${prefix}.` } })) },
              ],
            },
          },
          select: { puuid: true },
          distinct: ['puuid'],
        })
        const puuidSet = new Set(participantsWithOldVersion.map((r) => r.puuid))
        // Avoid DB param limit: fetch players with lastSeen in pages, filter in memory, then update in batches
        const PAGE_SIZE = 2000
        const UPDATE_BATCH = 500
        const toReset: Array<{ puuid: string }> = []
        let cursor: string | undefined
        do {
          const page = await prisma.player.findMany({
            where: { lastSeen: { not: null } },
            select: { puuid: true },
            take: PAGE_SIZE,
            ...(cursor !== undefined ? { skip: 1, cursor: { puuid: cursor } } : {}),
          })
          for (const r of page) {
            if (!puuidSet.has(r.puuid)) toReset.push(r)
          }
          if (page.length < PAGE_SIZE) break
          cursor = page[page.length - 1].puuid
        } while (true)
        for (let i = 0; i < toReset.length; i += UPDATE_BATCH) {
          const batch = toReset.slice(i, i + UPDATE_BATCH)
          await prisma.player.updateMany({
            where: { puuid: { in: batch.map((r) => r.puuid) } },
            data: { lastSeen: null },
          })
        }
        if (toReset.length > 0) {
          console.log(
            `${LOG_PREFIX} Reset last_seen for ${toReset.length} player(s) with matches only in newest version (re-crawl with all patch windows)`
          )
        }
      }
    }

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

    // 2) Crawl: players with last_seen IS NULL first, then oldest last_seen
    const playersToCrawl = await prisma.$queryRaw<CrawlRow[]>`
      SELECT puuid, region FROM players
      ORDER BY (last_seen IS NULL) DESC, last_seen ASC NULLS LAST
      LIMIT ${MAX_PUUIDS_PER_RUN}
    `
    let processedCount = 0
    let rateLimitHit = false
    const matchIdsPerPlayer = patchWindows.length > 0 ? Math.max(1, Math.floor(MATCH_IDS_PER_SUMMONER / patchWindows.length)) : MATCH_IDS_PER_SUMMONER
    for (const row of playersToCrawl) {
      const platform = (row.region === 'eun1' ? 'eun1' : 'euw1') as Platform
      processedCount++

      let matchIdsFetchFailed = false
      const allMatchIds = new Set<string>()
      for (const win of patchWindows) {
        const matchIdsResult = await riotApi.getMatchIdsByPuuid(row.puuid, {
          count: matchIdsPerPlayer,
          queue: 420,
          startTime: win.startTime,
          endTime: win.endTime,
        })
        if (matchIdsResult.isErr()) {
          const err = matchIdsResult.unwrapErr()
          if (isRateLimitError(err)) {
            rateLimitHit = true
            console.warn(`${LOG_PREFIX} Rate limit (429) on getMatchIds, pausing poller`)
          }
          errors++
          matchIdsFetchFailed = true
          break
        }
        for (const id of matchIdsResult.unwrap()) allMatchIds.add(id)
      }
      if (matchIdsFetchFailed) {
        if (rateLimitHit) break
        // Mark as seen so we don't retry the same player endlessly on API errors. They'll be re-crawled later (last_seen ASC).
        await prisma.player.update({ where: { puuid: row.puuid }, data: { lastSeen: new Date() } })
        continue
      }
      if (allMatchIds.size === 0 && patchWindows.length > 0) {
        await prisma.player.update({ where: { puuid: row.puuid }, data: { lastSeen: new Date() } })
        continue
      }
      const matchIds = [...allMatchIds]

      for (const matchId of matchIds) {
        try {
          if (await hasMatch(matchId)) continue
          const matchResult = await riotApi.getMatch(matchId)
          if (matchResult.isErr()) {
            const err = matchResult.unwrapErr() as AppError & { cause?: unknown }
            const status =
              err.cause && axios.isAxiosError(err.cause) ? err.cause.response?.status : undefined
            if (status === 404) continue
            if (status === 429) {
              rateLimitHit = true
              console.warn(`${LOG_PREFIX} Rate limit (429) on getMatch, pausing poller`)
              break
            }
            errors++
            continue
          }
          const matchData = matchResult.unwrap()
          const gameVersion = typeof matchData.info?.gameVersion === 'string' ? matchData.info.gameVersion : ''
          if (allowedVersions.size > 0 && !isAllowedGameVersion(gameVersion, allowedVersions)) {
            continue
          }
          const participants = matchData.info?.participants ?? []
          const puuids = participants
            .map((p: { puuid?: string }) => (typeof p.puuid === 'string' ? p.puuid.trim() : ''))
            .filter((puuid: string) => puuid !== '')
          let rankByPuuid: Map<string, { tier: string; rank: string; leaguePoints: number } | null> | undefined
          try {
            if (puuids.length > 0) {
              rankByPuuid = await fetchRanksForPuuids(platform, puuids)
            }
          } catch (rankErr) {
            errors++
          }
          const { inserted } = await upsertMatchFromRiot(platform, matchData, rankByPuuid)
          if (inserted) {
            collected++
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
          if (isRateLimitError(e)) {
            rateLimitHit = true
            console.warn(`${LOG_PREFIX} Rate limit (429) on getMatch (catch), pausing poller`)
            break
          }
          errors++
        }
      }
      if (rateLimitHit) break
      // Always update last_seen so we make progress through the queue. Players with fetch errors will be re-crawled later (last_seen ASC).
      await prisma.player.update({ where: { puuid: row.puuid }, data: { lastSeen: new Date() } })
    }

    if (collected > 0) {
      try {
        const refresh = await refreshPlayersAndChampionStats()
        console.log(`${LOG_PREFIX} Players refresh: ${refresh.playersUpserted} players`)
      } catch (e) {
        console.warn(`${LOG_PREFIX} Players refresh failed:`, e)
      }
    }

    // ——— Récupération des données manquantes : participants sans rank, matchs sans rank ———
    // Participants : rank (rankTier/rankDivision/rankLp) absent du payload Match-v5 → backfill via League-v4 by PUUID.
    // Skip backfill when none missing so API quota is reserved for match collection.
    if (BACKFILL_RANKS_PER_RUN > 0) {
      try {
        const missingRankCount = await countParticipantsMissingRank()
        if (missingRankCount === 0) {
          console.log(`${LOG_PREFIX} Backfill participants sans rank: skip (0 manquants)`)
        } else {
          let totalUpdated = 0
          let totalErrors = 0
          for (let batch = 0; batch < BACKFILL_RANKS_MAX_BATCHES; batch++) {
            const backfill = await backfillParticipantRanks(BACKFILL_RANKS_PER_RUN)
            totalUpdated += backfill.updated
            totalErrors += backfill.errors
            if (backfill.updated === 0) break
          }
          if (totalUpdated > 0 || totalErrors > 0) {
            console.log(
              `${LOG_PREFIX} Backfill participants sans rank: ${totalUpdated} mis à jour, ${totalErrors} erreurs`
            )
          }
        }
      } catch (e) {
        console.warn(`${LOG_PREFIX} Backfill participants sans rank failed:`, e)
      }
    }
    // Matchs : rank (moyenne des rangs des participants) recalculé à partir des participants qui ont un rank.
    try {
      const matchRanks = await refreshMatchRanks()
      if (matchRanks.matchesUpdated > 0) {
        console.log(`${LOG_PREFIX} Matchs sans rank remplis: ${matchRanks.matchesUpdated} matchs`)
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} Refresh match ranks failed:`, e)
    }

    try {
      const missingSummonerNameCount = await countPlayersMissingSummonerName()
      if (missingSummonerNameCount === 0) {
        console.log(`${LOG_PREFIX} Enrich summoner_name: skip (0 manquants), quota réservé à la collecte matchs`)
      } else {
        const enrich = await enrichPlayers(ENRICH_PER_RUN)
        console.log(`${LOG_PREFIX} Players enriched: ${enrich.enriched} (summoner_name)`)
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} Players enrichment failed:`, e)
    }
    const duration = Math.round((Date.now() - startTime.getTime()) / 1000)
    console.log(
      `${LOG_PREFIX} Done: ${collected} new matches, ${errors} errors, ${processedCount} PUUIDs processed, ${duration}s`
    )
    await cronStatus.markSuccess('riotMatchCollect')
    // Update heartbeat so admin "Poller" status shows Actif after any successful run (worker, cron, or manual)
    try {
      const dir = join(process.cwd(), 'data', 'cron')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(
        join(dir, 'riot-worker-heartbeat.json'),
        JSON.stringify({ lastBeat: new Date().toISOString() }, null, 0),
        'utf-8'
      )
    } catch {
      // ignore
    }
    return { collected, errors, rateLimitHit }
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
