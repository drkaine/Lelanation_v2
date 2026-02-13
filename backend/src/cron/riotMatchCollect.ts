/**
 * Riot match collection: players table → Phase 0: enrich missing info → Phase 1: crawl by last_seen → Match-v5 → upsert participants into players.
 * See docs/riot-api-match-collection.md for workflow, limits, and TOS.
 * Ranked Solo/Duo (420), EUW1 only. Schedule: every hour (RIOT_MATCH_CRON_SCHEDULE).
 *
 * Flow:
 * 1. Phase 0: if players with missing info (summoner_name) → enrich them first
 * 2. Phase 1: list players by last_seen ASC (null first), EUW1
 * 3. For each player: getMatchIdsByPUUID (queue 420, versions from versions.json, last_seen→now if already polled)
 * 4. Update last_seen, dedupe match IDs vs DB, fetch each match, upsert match+participants→players
 * 5. On match/player error: skip (log, Discord), continue
 * 6. On 401/403 or 5xx: pause with exponential backoff, notify Discord
 */
import axios from 'axios'
import { promises as fs } from 'fs'
import cron from 'node-cron'
import { join } from 'path'
import { getRiotApiService } from '../services/RiotApiService.js'
import { upsertMatchFromRiot, hasMatch } from '../services/MatchCollectService.js'
import { invalidateOverviewDetailCache } from '../services/StatsOverviewService.js'
import {
  enrichPlayers,
  fetchRanksForPuuids,
  backfillRanksForNewMatch,
  backfillParticipantRanks,
  refreshMatchRanks,
  countPlayersMissingSummonerName,
  countParticipantsMissingRank,
} from '../services/StatsPlayersRefreshService.js'
import {
  loadAllowedGameVersions,
  isAllowedGameVersion,
  getPatchTimeWindows,
} from '../services/AllowedGameVersions.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { DiscordService } from '../services/DiscordService.js'
import { isDatabaseConfigured, prisma } from '../db.js'
import type { AppError } from '../utils/errors.js'

const PLATFORM_EUW1 = 'euw1' as const
/** Match IDs requested per summoner (split across patch windows). Higher = more data per player, bounded by request budget. */
const MATCH_IDS_PER_SUMMONER = Math.max(10, parseInt(process.env.RIOT_MATCH_IDS_PER_SUMMONER ?? '20', 10) || 20)
/** Max players to crawl per run (from players table: last_seen IS NULL first, then last_seen ASC). Budget will stop earlier in normal mode. */
const MAX_PUUIDS_PER_RUN = Math.max(20, parseInt(process.env.RIOT_MATCH_MAX_PUUIDS_PER_RUN ?? '50', 10) || 50)
/** Normal mode: cap API requests per cycle to stay under 100/2min. getMatchIds=1, getMatch+ranks=11 per match. */
const REQUEST_BUDGET_PER_CYCLE = Math.min(100, Math.max(50, parseInt(process.env.RIOT_MATCH_REQUEST_BUDGET ?? '95', 10) || 95))
/** When unpoled players exceed this, enable fast mode: 1 patch window, skip rank fetch, more players per run. */
const FAST_BACKLOG_THRESHOLD = Math.max(5000, parseInt(process.env.RIOT_MATCH_FAST_BACKLOG_THRESHOLD ?? '20000', 10) || 20000)
const FAST_MAX_PUUIDS = Math.max(MAX_PUUIDS_PER_RUN, parseInt(process.env.RIOT_MATCH_FAST_PUUIDS ?? '100', 10) || 100)
/** After this many consecutive 5xx on getMatch, skip remaining matches for current player. */
const CONSECUTIVE_5XX_SKIP_THRESHOLD = Math.max(3, parseInt(process.env.RIOT_MATCH_5XX_SKIP_AFTER ?? '5', 10) || 5)
/** Players to enrich (summoner_name) per run. */
const ENRICH_PER_RUN = Math.max(10, parseInt(process.env.RIOT_MATCH_ENRICH_PER_PASS ?? '150', 10) || 150)
/** Participant ranks to backfill per cron run (distinct puuids). 0 = use default 200 (backfill always runs). */
const BACKFILL_RANKS_PER_RUN = Math.max(0, parseInt(process.env.RIOT_BACKFILL_RANKS_PER_RUN ?? '200', 10) || 0)
const BACKFILL_RANKS_DEFAULT_WHEN_ZERO = 200
const BACKFILL_RANKS_MAX_BATCHES = Math.max(1, parseInt(process.env.RIOT_BACKFILL_RANKS_MAX_BATCHES ?? '3', 10) || 1)
const CRON_SCHEDULE = process.env.RIOT_MATCH_CRON_SCHEDULE ?? '0 * * * *'
/** If lastSuccessAt is older than this (ms), use fallback window. */
const LAST_SUCCESS_MAX_AGE_MS = 12 * 60 * 60 * 1000
const FALLBACK_WINDOW_SEC = 24 * 60 * 60

/** When 5xx errors exceed this, pause the poller. */
const SERVER_ERROR_5XX_THRESHOLD = Math.max(20, parseInt(process.env.RIOT_MATCH_5XX_PAUSE_THRESHOLD ?? '50', 10) || 50)

/** Cap du nombre de matchs par vieille version (hors dernière version autorisée). Défaut 100_000. 0 = pas de plafond. */
const MAX_MATCHES_OLD_VERSION = Math.max(0, parseInt(process.env.RIOT_MAX_MATCHES_OLD_VERSION ?? '100000', 10) || 100000)

interface CrawlRow {
  puuid: string
  region: string
  lastSeen: Date | null
}

function isRiotAuthError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)
}

function isRateLimitError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && cause.response?.status === 429
}

/** Extract error code (Prisma P2002, HTTP status, etc.) and source for Discord context. */
function extractErrorContext(err: unknown): Record<string, unknown> {
  const ctx: Record<string, unknown> = {}
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.code === 'string') ctx.errorCode = e.code
    if (typeof e.message === 'string') ctx.errorMessage = e.message
    const cause = e.cause
    if (axios.isAxiosError(cause) && cause.response) {
      ctx.httpStatus = cause.response.status
      ctx.httpData = typeof cause.response.data === 'object' ? JSON.stringify(cause.response.data).slice(0, 500) : String(cause.response.data).slice(0, 500)
    }
  }
  return ctx
}

const LOG_PREFIX = '[Riot match collect]'

/**
 * Run one full Riot match collection pass (EUW1 only).
 * Returns { collected, errors, rateLimitHit, serverError5xx, authError?: boolean }.
 */
export async function runRiotMatchCollectOnce(): Promise<{
  collected: number
  errors: number
  rateLimitHit?: boolean
  serverError5xx?: boolean
  authError?: boolean
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
    return { collected: 0, errors: 0, rateLimitHit: false, serverError5xx: false }
  }

  try {
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
      return { collected: 0, errors: 0, rateLimitHit: false, serverError5xx: false }
    }

    let collected = 0
    let errors = 0
    const matchEndTime = Math.floor(Date.now() / 1000)

    // ——— Phase 0: players with missing info (summoner_name) ———
    const missingCount = await countPlayersMissingSummonerName()
    if (missingCount > 0) {
      console.log(`${LOG_PREFIX} Phase 0: ${missingCount} player(s) missing summoner_name, enriching...`)
      try {
        const enrich = await enrichPlayers(ENRICH_PER_RUN)
        console.log(`${LOG_PREFIX} Phase 0: enriched ${enrich.enriched} player(s)`)
      } catch (e) {
        console.warn(`${LOG_PREFIX} Phase 0 enrich failed:`, e)
        await discordService.sendAlert(
          '⚠️ Poller Riot – Enrichissement échoué',
          'Erreur lors de l’enrichissement des joueurs (summoner_name).',
          e instanceof Error ? e : new Error(String(e)),
          { phase: 'enrich', timestamp: new Date().toISOString() }
        )
      }
    }

    // ——— Phase 1: crawl players by last_seen ASC (null first) ———
    const unpoledCount = await prisma.player.count({ where: { lastSeen: null, region: PLATFORM_EUW1 } })
    const fastMode = unpoledCount >= FAST_BACKLOG_THRESHOLD
    const effectiveMaxPuuids = fastMode ? FAST_MAX_PUUIDS : MAX_PUUIDS_PER_RUN
    if (fastMode) {
      console.log(`${LOG_PREFIX} Fast mode: ${unpoledCount} unpoled players (≥${FAST_BACKLOG_THRESHOLD}), ${effectiveMaxPuuids} players/run`)
    }

    const { allowedVersions } = await loadAllowedGameVersions()
    const sortedAllowedVersions = [...allowedVersions].sort()
    const latestAllowedVersion =
      sortedAllowedVersions.length > 0 ? sortedAllowedVersions[sortedAllowedVersions.length - 1]! : null
    /** Cache du nombre de matchs par version (pour plafond vieilles versions). */
    const versionMatchCountCache = new Map<string, number>()
    if (allowedVersions.size > 0) {
      console.log(`${LOG_PREFIX} Allowed game versions: ${sortedAllowedVersions.join(', ')}`)
    }

    // Patch windows for unpoled players; for already polled: [last_seen, now]
    let patchWindows = await getPatchTimeWindows(matchEndTime)
    if (patchWindows.length === 0) {
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
    }
    if (fastMode && patchWindows.length > 1) {
      patchWindows = [patchWindows[patchWindows.length - 1]!]
    }

    // Ne pas repoller les joueurs déjà pollés aujourd'hui (UTC)
    const startOfTodayUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
    const playersToCrawl = await prisma.$queryRaw<CrawlRow[]>`
      SELECT puuid, region, last_seen AS "lastSeen"
      FROM players
      WHERE region = ${PLATFORM_EUW1}
        AND (last_seen IS NULL OR last_seen < ${startOfTodayUtc})
      ORDER BY (last_seen IS NULL) DESC, last_seen ASC NULLS LAST
      LIMIT ${effectiveMaxPuuids}
    `

    let rateLimitHit = false
    let skippedAlreadyInDb = 0
    let skippedVersionFilter = 0
    let skippedCapOldVersion = 0
    const errorStatusCounts = new Map<number, number>()
    const versionFilteredExamples = new Set<string>()
    const matchIdsPerPlayer =
      patchWindows.length > 0 ? Math.max(1, Math.floor(MATCH_IDS_PER_SUMMONER / patchWindows.length)) : MATCH_IDS_PER_SUMMONER

    /** Normal mode only: count API requests to stay under 100/2min (getMatchIds=1, getMatch+fetchRanks=11 per match). */
    let requestCount = 0
    let requestBudgetExhausted = false

    for (const row of playersToCrawl) {
      if (requestBudgetExhausted) break
      const processedIdx = playersToCrawl.indexOf(row) + 1
      if (processedIdx % 20 === 1 || processedIdx === playersToCrawl.length) {
        console.log(`${LOG_PREFIX} Crawling player ${processedIdx}/${playersToCrawl.length}…`)
      }

      let matchIdsFetchFailed = false
      const allMatchIds = new Set<string>()

      // Build match windows: if last_seen set → [last_seen, now]; else → patch windows
      const windows: { startTime: number; endTime: number }[] = []
      if (row.lastSeen) {
        const lastSeenSec = Math.floor(new Date(row.lastSeen).getTime() / 1000)
        windows.push({ startTime: lastSeenSec, endTime: matchEndTime })
      } else {
        for (const w of patchWindows) {
          windows.push({ startTime: w.startTime, endTime: w.endTime })
        }
      }

      if (windows.length === 0) {
        windows.push({ startTime: matchEndTime - FALLBACK_WINDOW_SEC, endTime: matchEndTime })
      }

      for (const win of windows) {
        if (!fastMode && requestCount >= REQUEST_BUDGET_PER_CYCLE) {
          requestBudgetExhausted = true
          console.log(`${LOG_PREFIX} Request budget reached (${requestCount}/${REQUEST_BUDGET_PER_CYCLE}), next cycle in 2 min`)
          break
        }
        const matchIdsResult = await riotApi.getMatchIdsByPuuid(row.puuid, {
          count: matchIdsPerPlayer,
          queue: 420,
          startTime: win.startTime,
          endTime: win.endTime,
        })
        if (!fastMode) requestCount++
        if (matchIdsResult.isErr()) {
          const err = matchIdsResult.unwrapErr() as AppError & { cause?: unknown }
          const status = err.cause && axios.isAxiosError(err.cause) ? err.cause.response?.status : undefined
          if (isRiotAuthError(err)) {
            riotApi.invalidateKeyCache()
            await cronStatus.markFailure('riotMatchCollect', err)
            await discordService.sendAlert(
              '🔑 Stats LoL – Clé API Riot invalide ou expirée',
              'Riot a renvoyé 401/403. Vérifiez la clé dans l’onglet Admin ou renouvelez-la sur le portail développeur Riot.',
              err,
              { platform: PLATFORM_EUW1, startedAt: startTime.toISOString() }
            )
            return { collected, errors, rateLimitHit: false, serverError5xx: false, authError: true }
          }
          if (isRateLimitError(err)) {
            rateLimitHit = true
            console.warn(`${LOG_PREFIX} Rate limit (429) on getMatchIds, pausing poller`)
          } else if (status != null) {
            errorStatusCounts.set(status, (errorStatusCounts.get(status) ?? 0) + 1)
          }
          errors++
          matchIdsFetchFailed = true
          break
        }
        for (const id of matchIdsResult.unwrap()) allMatchIds.add(id)
      }

      if (matchIdsFetchFailed) {
        if (rateLimitHit) break
        await prisma.player.update({ where: { puuid: row.puuid }, data: { lastSeen: new Date() } })
        continue
      }

      if (allMatchIds.size === 0 && windows.length > 0) {
        await prisma.player.update({ where: { puuid: row.puuid }, data: { lastSeen: new Date() } })
        continue
      }

      // Deduplicate vs DB
      const matchIds = [...allMatchIds]
      const toFetch: string[] = []
      for (const id of matchIds) {
        if (await hasMatch(id)) {
          skippedAlreadyInDb++
        } else {
          toFetch.push(id)
        }
      }

      let consecutive5xx = 0
      for (const matchId of toFetch) {
        if (!fastMode && requestCount + 11 > REQUEST_BUDGET_PER_CYCLE) {
          requestBudgetExhausted = true
          console.log(`${LOG_PREFIX} Request budget reached (${requestCount}/${REQUEST_BUDGET_PER_CYCLE}), next cycle in 2 min`)
          break
        }
        try {
          const matchResult = await riotApi.getMatch(matchId)
          if (matchResult.isErr()) {
            const err = matchResult.unwrapErr() as AppError & { cause?: unknown }
            const status = err.cause && axios.isAxiosError(err.cause) ? err.cause.response?.status : undefined
            if (status === 404) {
              consecutive5xx = 0
              if (!fastMode) requestCount += 1
              continue
            }
            if (status === 429) {
              rateLimitHit = true
              console.warn(`${LOG_PREFIX} Rate limit (429) on getMatch, pausing poller`)
              break
            }
            if (status != null && status >= 500 && status < 600) {
              consecutive5xx++
              if (consecutive5xx >= CONSECUTIVE_5XX_SKIP_THRESHOLD) {
                console.warn(
                  `${LOG_PREFIX} ${consecutive5xx} consecutive 5xx for current player, skipping remaining matches`
                )
                break
              }
            } else {
              consecutive5xx = 0
            }
            if (!fastMode) requestCount += 1
            errorStatusCounts.set(status ?? 0, (errorStatusCounts.get(status ?? 0) ?? 0) + 1)
            errors++
            console.warn(`${LOG_PREFIX} getMatch failed for ${matchId}: ${(err as Error).message}`)
            const apiCtx = { matchId, status, timestamp: new Date().toISOString(), ...extractErrorContext(err) }
            await discordService.sendAlert(
              '⚠️ Poller Riot – Erreur getMatch',
              `Échec getMatch pour ${matchId}. Match ignoré.`,
              err instanceof Error ? err : new Error(String(err)),
              apiCtx
            )
            continue
          }
          consecutive5xx = 0
          const matchData = matchResult.unwrap()
          const gameVersion = typeof matchData.info?.gameVersion === 'string' ? matchData.info.gameVersion : ''
          if (allowedVersions.size > 0 && !isAllowedGameVersion(gameVersion, allowedVersions)) {
            if (!fastMode) requestCount += 1
            skippedVersionFilter++
            if (versionFilteredExamples.size < 5) versionFilteredExamples.add(gameVersion || '(empty)')
            continue
          }
          // Plafond vieilles versions: ne pas dépasser MAX_MATCHES_OLD_VERSION par version (hors dernière autorisée)
          if (
            MAX_MATCHES_OLD_VERSION > 0 &&
            latestAllowedVersion != null &&
            gameVersion !== '' &&
            gameVersion !== latestAllowedVersion
          ) {
            let count = versionMatchCountCache.get(gameVersion)
            if (count === undefined) {
              count = await prisma.match.count({ where: { gameVersion } })
              versionMatchCountCache.set(gameVersion, count)
            }
            if (count >= MAX_MATCHES_OLD_VERSION) {
              if (!fastMode) requestCount += 1
              skippedCapOldVersion++
              continue
            }
          }
          const participants = matchData.info?.participants ?? []
          const puuids = participants
            .map((p: { puuid?: string }) => (typeof p.puuid === 'string' ? p.puuid.trim() : ''))
            .filter((puuid: string) => puuid !== '')
          let rankByPuuid: Map<string, { tier: string; rank: string; leaguePoints: number } | null> | undefined
          let rankFetchFailed = false
          if (!fastMode && puuids.length > 0) {
            try {
              rankByPuuid = await fetchRanksForPuuids(PLATFORM_EUW1, puuids)
              requestCount += 10
            } catch (rankErr) {
              rankFetchFailed = true
              errors++
            }
          }
          if (!fastMode) requestCount += 1
          const { inserted } = await upsertMatchFromRiot(PLATFORM_EUW1, matchData, rankByPuuid)
          if (inserted && gameVersion) {
            const cached = versionMatchCountCache.get(gameVersion)
            if (cached !== undefined) versionMatchCountCache.set(gameVersion, cached + 1)
          }
          if (inserted && puuids.length > 0) {
            const needBackfill = fastMode || rankFetchFailed
            if (needBackfill) {
              try {
                await backfillRanksForNewMatch(matchId, PLATFORM_EUW1, puuids)
              } catch (backfillErr) {
                console.warn(`${LOG_PREFIX} Backfill ranks for new match ${matchId} failed:`, backfillErr)
              }
            }
          }
          if (inserted) {
            collected++
            for (const p of participants) {
              const participantPuuid = typeof p.puuid === 'string' ? p.puuid.trim() : ''
              if (!participantPuuid) continue
              await prisma.player.upsert({
                where: { puuid: participantPuuid },
                create: { puuid: participantPuuid, region: PLATFORM_EUW1, lastSeen: null },
                update: {},
              })
            }
          }
        } catch (e) {
          if (!fastMode) requestCount += 1
          if (isRateLimitError(e)) {
            rateLimitHit = true
            console.warn(`${LOG_PREFIX} Rate limit (429) on getMatch (catch), pausing poller`)
            break
          }
          errors++
          console.warn(`${LOG_PREFIX} getMatch exception for ${matchId}:`, e)
          const errObj = e as Record<string, unknown>
          const isPrismaUnique = errObj?.code === 'P2002'
          const source = isPrismaUnique ? 'upsertMatch (DB)' : 'getMatch/upsertMatch'
          const title = isPrismaUnique
            ? '⚠️ Poller Riot – Match déjà en base (race)'
            : '⚠️ Poller Riot – Exception traitement match'
          const message = isPrismaUnique
            ? `Contrainte unique sur ${matchId}. Match déjà inséré par un autre worker. Ignoré.`
            : `Exception lors du traitement du match ${matchId}. Match ignoré.`
          const errCtx = { matchId, source, timestamp: new Date().toISOString(), ...extractErrorContext(e) }
          await discordService.sendAlert(title, message, e instanceof Error ? e : new Error(String(e)), errCtx)
        }
      }
      if (rateLimitHit) break
      // Update last_seen after processing (so if we hit budget we retry same player next cycle and continue fetching)
      await prisma.player.update({ where: { puuid: row.puuid }, data: { lastSeen: new Date() } })
    }

    if (collected > 0) {
      console.log(`${LOG_PREFIX} ${collected} new matches, stats via view players_with_stats`)
    }

    // Fin de cycle: backfill des participants sans rank seulement si nécessaire (vérif manquants → skip si 0)
    const effectiveBackfillLimit = BACKFILL_RANKS_PER_RUN > 0 ? BACKFILL_RANKS_PER_RUN : BACKFILL_RANKS_DEFAULT_WHEN_ZERO
    try {
      const missingRankCount = await countParticipantsMissingRank()
      if (missingRankCount === 0) {
        console.log(`${LOG_PREFIX} Backfill participants sans rank: skip (0 manquants)`)
      } else {
        let totalUpdated = 0
        let totalErrors = 0
        for (let batch = 0; batch < BACKFILL_RANKS_MAX_BATCHES; batch++) {
          const backfill = await backfillParticipantRanks(effectiveBackfillLimit)
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

    try {
      const matchRanks = await refreshMatchRanks()
      if (matchRanks.matchesUpdated > 0) {
        console.log(`${LOG_PREFIX} Matchs sans rank remplis: ${matchRanks.matchesUpdated} matchs`)
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} Refresh match ranks failed:`, e)
    }

    const duration = Math.round((Date.now() - startTime.getTime()) / 1000)
    console.log(
      `${LOG_PREFIX} Done: ${collected} new matches, ${errors} errors, ${playersToCrawl.length} players processed, ${duration}s`
    )
    if (skippedCapOldVersion > 0) {
      console.log(
        `${LOG_PREFIX} Plafond vieilles versions: ${skippedCapOldVersion} match(s) ignoré(s) (max ${MAX_MATCHES_OLD_VERSION}/version)`
      )
    }
    if (
      collected === 0 &&
      (errors > 0 || skippedAlreadyInDb > 0 || skippedVersionFilter > 0 || skippedCapOldVersion > 0)
    ) {
      const errSummary =
        errorStatusCounts.size > 0
          ? `, errorStatuses=${JSON.stringify(Object.fromEntries(errorStatusCounts))}`
          : ''
      console.log(
        `${LOG_PREFIX} Diagnostic: skippedAlreadyInDb=${skippedAlreadyInDb}, skippedVersionFilter=${skippedVersionFilter}, skippedCapOldVersion=${skippedCapOldVersion}${errSummary}`
      )
      if (versionFilteredExamples.size > 0) {
        console.warn(
          `${LOG_PREFIX} Version-filtered examples: ${[...versionFilteredExamples].join(', ')}`
        )
      }
    }
    await cronStatus.markSuccess('riotMatchCollect')
    // Rafraîchir la vue matérialisée overview-detail (runes/items/sorts) en arrière-plan
    if (collected > 0) {
      prisma
        .$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overview_detail_base')
        .then(() => {
          invalidateOverviewDetailCache()
          console.log(`${LOG_PREFIX} mv_overview_detail_base refreshed`)
        })
        .catch((e) => console.warn(`${LOG_PREFIX} mv_overview_detail_base refresh failed:`, e))
    }
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
    const total5xx = [...errorStatusCounts.entries()].reduce(
      (sum, [status, count]) => (status >= 500 && status < 600 ? sum + count : sum),
      0
    )
    const serverError5xx = total5xx >= SERVER_ERROR_5XX_THRESHOLD
    return { collected, errors, rateLimitHit, serverError5xx }
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
