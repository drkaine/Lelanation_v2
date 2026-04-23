/**
 * Script 2: League XP — discover new players by Elo bracket.
 *
 * Calls the Riot League v4 entries endpoint for a given queue/tier/division and
 * creates player records for any PUUIDs not already in the database. This is used
 * to seed the database with players from specific Elo brackets so the main poller
 * can start collecting their matches.
 *
 * Default: RANKED_SOLO_5x5 / GOLD / I on euw1, up to 5 pages (200 players/page).
 */
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { prisma, isDatabaseConfigured } from '../db.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { RiotRateLimiter } from '../services/RiotRateLimiter.js'
import { RiotHttpClient } from '../services/RiotHttpClient.js'

export interface LeagueXpOptions {
  /** Riot queue type, e.g. 'RANKED_SOLO_5x5' or 'RANKED_FLEX_SR'. Default: 'RANKED_SOLO_5x5'. */
  queue?: string
  /** Tier, e.g. 'GOLD', 'PLATINUM', 'DIAMOND'. Default: 'GOLD'. */
  tier?: string
  /** Division, e.g. 'I', 'II', 'III', 'IV'. Default: 'I'. */
  division?: string
  /** Platform region: 'euw1' or 'eun1'. Default: 'euw1'. */
  region?: string
  /** Maximum number of pages to fetch (Riot returns up to 205 entries per page). Default: 5. */
  maxPages?: number
}

export interface LeagueXpStatus {
  phase: 'init' | 'running' | 'done' | 'error'
  options: LeagueXpOptions
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
  pagesProcessed: number
  playersFound: number
  playersCreated: number
  requestCount: number
  error429Count: number
}

let _status: LeagueXpStatus = {
  phase: 'init',
  options: {},
  startedAt: null,
  finishedAt: null,
  lastError: null,
  pagesProcessed: 0,
  playersFound: 0,
  playersCreated: 0,
  requestCount: 0,
  error429Count: 0,
}

export function getLeagueXpStatus(): LeagueXpStatus {
  return { ..._status }
}

/**
 * Run the League XP discovery script.
 * @param options      - configuration (queue, tier, division, region, maxPages)
 * @param isShouldStop - function that returns true when the script should stop gracefully
 * @param onUpdate     - optional callback invoked after each status update
 */
export async function runLeagueXpScript(
  options: LeagueXpOptions,
  isShouldStop: () => boolean,
  onUpdate?: (status: LeagueXpStatus) => void
): Promise<void> {
  const {
    queue = 'RANKED_SOLO_5x5',
    tier = 'GOLD',
    division = 'I',
    region = 'euw1',
    maxPages = 5,
  } = options

  const resolvedOptions: LeagueXpOptions = { queue, tier, division, region, maxPages }

  if (!isDatabaseConfigured()) {
    _status = {
      ..._status,
      phase: 'error',
      options: resolvedOptions,
      lastError: 'DATABASE_URL not set',
      finishedAt: new Date().toISOString(),
    }
    onUpdate?.(_status)
    return
  }

  _status = {
    phase: 'running',
    options: resolvedOptions,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lastError: null,
    pagesProcessed: 0,
    playersFound: 0,
    playersCreated: 0,
    requestCount: 0,
    error429Count: 0,
  }
  onUpdate?.(_status)

  const logger = createRiotPollerLogger('league_xp')

  try {
    // Init Riot API client
    const rateLimiter = new RiotRateLimiter()
    const client = new RiotHttpClient(rateLimiter, logger, 'league_xp')

    const activeKeyInfo = client.getActiveKeyInfo()
    if (!activeKeyInfo) {
      throw new Error('No Riot API key configured: No RIOT_API_KEY in env')
    }
    client.setPlatform(region)

    await appendUnifiedLog({
      section: 'back',
      type: 'debut',
      script: 'league_xp',
      message: 'League XP démarré',
      json: { queue, tier, division, region, maxPages },
    })
    await logger.step('League XP start', { queue, tier, division, region, maxPages })

    let lastPulseMs = Date.now()
    let lastPlayersFound = 0
    let lastRequestCount = 0

    for (let page = 1; page <= maxPages && !isShouldStop(); page++) {
      const res = await client.getLeagueEntries(queue, tier, division, page)
      _status.requestCount++

      if (!res.ok) {
        if (res.status === 429) {
          _status.error429Count++
          await logger.info('429 rate limit hit, retrying', { page })
          // Rate limiter handles the wait; retry the same page
          page--
          continue
        }
        await logger.error('League entries request failed', { status: res.status, page })
        break
      }

      const entries = res.data
      if (!entries.length) {
        await logger.step('No more entries, stopping early', { page })
        break
      }

      _status.playersFound += entries.length
      _status.pagesProcessed++

      // Collect PUUIDs from this page
      const puuids = entries.map((e) => e.puuid).filter((p): p is string => Boolean(p))
      if (puuids.length === 0) {
        onUpdate?.(_status)
        continue
      }

      // Find which PUUIDs we already have
      const existing = await prisma.player.findMany({
        where: { puuid: { in: puuids } },
        select: { puuid: true },
      })
      const existingSet = new Set(existing.map((p) => p.puuid))

      // Create records for new players
      const newEntries = entries.filter((e) => e.puuid && !existingSet.has(e.puuid))
      if (newEntries.length > 0) {
        const toCreate = newEntries.map((e) => ({
          puuid: e.puuid!,
          region,
          puuidKeyVersion: activeKeyInfo.clefType,
          gameName: null as string | null,
          tagName: null as string | null,
          lastSeen: null as Date | null,
        }))

        try {
          const result = await prisma.player.createMany({
            data: toCreate,
            skipDuplicates: true,
          })
          _status.playersCreated += result.count
        } catch {
          // Non-fatal: log and continue
          await logger.error('Failed to create player batch', { page, count: newEntries.length })
        }
      }

      onUpdate?.(_status)

      await logger.step('League XP page processed', {
        page,
        total: entries.length,
        newPlayers: newEntries.length,
        cumCreated: _status.playersCreated,
      })

      const now = Date.now()
      if (now - lastPulseMs >= 120_000) {
        await appendUnifiedLog({
          section: 'back',
          type: 'info',
          script: 'league_xp',
          message: 'Snapshot League XP (2 min)',
          json: {
            playersFoundDelta: _status.playersFound - lastPlayersFound,
            requestCountDelta: _status.requestCount - lastRequestCount,
            pagesProcessed: _status.pagesProcessed,
            playersCreated: _status.playersCreated,
          },
        })
        lastPulseMs = now
        lastPlayersFound = _status.playersFound
        lastRequestCount = _status.requestCount
      }
    }

    _status = {
      ..._status,
      phase: 'done',
      finishedAt: new Date().toISOString(),
    }
    onUpdate?.(_status)

    await appendUnifiedLog({
      section: 'back',
      type: 'fin',
      script: 'league_xp',
      message: 'League XP terminé',
      json: {
        pagesProcessed: _status.pagesProcessed,
        playersFound: _status.playersFound,
        playersCreated: _status.playersCreated,
        requestCount: _status.requestCount,
        error429Count: _status.error429Count,
      },
    })
    await logger.step('League XP done', {
      pagesProcessed: _status.pagesProcessed,
      playersFound: _status.playersFound,
      playersCreated: _status.playersCreated,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    _status = {
      ..._status,
      phase: 'error',
      lastError: msg,
      finishedAt: new Date().toISOString(),
    }
    onUpdate?.(_status)
    await logger.error('League XP script error', msg)
    throw err
  }
}
