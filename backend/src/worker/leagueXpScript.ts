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
import { sql } from '../db/client.js'
import { isDatabaseConfigured } from '../db/query.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { riotGateway, type RiotGatewayError } from '../services/RiotGateway.js'
import type { RiotLeagueEntryDto } from './riotIngestTypes.js'

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
    riotGateway.setPlatform(region)

    const activeKeyInfo = riotGateway.getActiveKeyInfo()
    if (!process.env.RIOT_API_KEY?.trim()) {
      throw new Error('No Riot API key configured: No RIOT_API_KEY in env')
    }

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
      let entries: RiotLeagueEntryDto[]
      try {
        const res = await riotGateway.getLeagueEntries(queue, tier, division, page, region)
        _status.requestCount++
        entries = res.data
      } catch (err) {
        _status.requestCount++
        const status = (err as RiotGatewayError).status
        if (status === 429) {
          _status.error429Count++
          await logger.info('429 rate limit hit, retrying', { page })
          page--
          continue
        }
        await logger.error('League entries request failed', { status, page })
        break
      }

      if (!entries.length) {
        await logger.step('No more entries, stopping early', { page })
        break
      }

      _status.playersFound += entries.length
      _status.pagesProcessed++

      // Collect PUUIDs from this page
      const puuids = entries.map((e: RiotLeagueEntryDto) => e.puuid).filter((p): p is string => Boolean(p))
      if (puuids.length === 0) {
        onUpdate?.(_status)
        continue
      }

      // Find which PUUIDs we already have
      const existing = await sql<Array<{ puuid: string }>>`
        SELECT puuid FROM players WHERE puuid = ANY(${puuids})
      `
      const existingSet = new Set(existing.map((p) => p.puuid))

      const newEntries = entries.filter((e: RiotLeagueEntryDto) => e.puuid && !existingSet.has(e.puuid))
      for (const e of newEntries) {
        if (!e.puuid) continue
        try {
          await sql`
            INSERT INTO players (puuid, region, puuid_key_version, created_at, updated_at)
            VALUES (${e.puuid}, ${region}, ${activeKeyInfo.clefType}, NOW(), NOW())
            ON CONFLICT (puuid) DO NOTHING
          `
          _status.playersCreated++
        } catch {
          await logger.error('Failed to create player', { page, puuid: e.puuid })
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
