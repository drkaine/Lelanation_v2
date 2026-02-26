/**
 * Riot player discovery: fetch matches further back in time, extract PUUIDs only,
 * upsert into players table. Does NOT save matches nor participants.
 * Use to grow the player pool faster; run manually via npm run riot:discover-players.
 *
 * Loads backend/.env. Options via env:
 *   RIOT_PLAYER_DISCOVERY_DAYS_BACK   = 90   (start of window = now - N days)
 *   RIOT_PLAYER_DISCOVERY_END_DAYS_AGO = 1   (end of window = now - N days, avoid overlap with cron)
 *   RIOT_PLAYER_DISCOVERY_MATCHES_PER_PLAYER = 100 (count per getMatchIdsByPuuid)
 *   RIOT_PLAYER_DISCOVERY_MAX_SEEDS = 50    (how many DB players to use as seeds)
 *
 * Usage: npm run riot:discover-players (from backend/)
 */
import axios from 'axios'
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  writeProgress,
  isStopRequested,
  clearProgressAndStopRequest,
} from '../utils/ProcessProgressWriter.js'

const SCRIPT_ID = 'riot:discover-players'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

const DAY_SEC = 24 * 60 * 60

/** Platform (e.g. euw1, na1) → continent for Match v5 API */
function platformToContinent(region: string): 'europe' | 'americas' | 'asia' {
  const r = region?.toLowerCase() ?? ''
  if (['na1', 'br1', 'la1', 'la2', 'oc1'].includes(r)) return 'americas'
  if (['kr', 'jp1', 'ph2', 'sg2', 'th2', 'tw2', 'vn2'].includes(r)) return 'asia'
  return 'europe'
}

function isRiotAuthError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)
}

type DiscoveryRunOptions = { shouldStop?: () => Promise<boolean>; onProgress?: (metrics: Record<string, number>) => Promise<void> }

async function runDiscovery(
  riotApi: ReturnType<typeof import('../services/RiotApiService.js').getRiotApiService>,
  options?: DiscoveryRunOptions
): Promise<{ totalPlayersUpserted: number; matchIdsFetched: number; matchIdsSkipped: number; errors: number }> {
  const { prisma, isDatabaseConfigured } = await import('../db.js')
  const { hasMatch } = await import('../services/MatchCollectService.js')

  if (!isDatabaseConfigured()) {
    console.warn('[riot:discover-players] Skipped: DATABASE_URL not set')
    return { totalPlayersUpserted: 0, matchIdsFetched: 0, matchIdsSkipped: 0, errors: 0 }
  }

  const daysBack = Math.max(1, parseInt(process.env.RIOT_PLAYER_DISCOVERY_DAYS_BACK ?? '90', 10) || 90)
  const endDaysAgo = Math.max(0, parseInt(process.env.RIOT_PLAYER_DISCOVERY_END_DAYS_AGO ?? '1', 10) || 1)
  const matchesPerPlayer = Math.min(500, Math.max(1, parseInt(process.env.RIOT_PLAYER_DISCOVERY_MATCHES_PER_PLAYER ?? '100', 10) || 100))
  const maxSeeds = Math.max(10, parseInt(process.env.RIOT_PLAYER_DISCOVERY_MAX_SEEDS ?? '50', 10) || 50)

  const singlePuuid = process.env.RIOT_PLAYER_DISCOVERY_SINGLE_PUUID?.trim()
  const singleRegion = process.env.RIOT_PLAYER_DISCOVERY_SINGLE_REGION?.trim()

  const nowSec = Math.floor(Date.now() / 1000)
  const endTime = nowSec - endDaysAgo * DAY_SEC
  const startTime = nowSec - daysBack * DAY_SEC

  let seedRows: { puuid: string; region: string }[]
  if (singlePuuid && singleRegion) {
    seedRows = [{ puuid: singlePuuid, region: singleRegion }]
    console.log(`[riot:discover-players] Single seed from admin: puuid=${singlePuuid.slice(0, 8)}… region=${singleRegion} matches=${matchesPerPlayer}`)
  } else {
    seedRows = await prisma.$queryRaw<{ puuid: string; region: string }[]>`
      SELECT puuid, region FROM players
      ORDER BY (last_seen IS NULL) DESC, last_seen ASC NULLS LAST
      LIMIT ${maxSeeds}
    `
  }

  const startedAt = Date.now()
  if (!singlePuuid) {
    console.log(
      `[riot:discover-players] Window: ${daysBack}d back, end ${endDaysAgo}d ago | ${matchesPerPlayer} matches/player, ${maxSeeds} seed players`
    )
    console.log(
      `[riot:discover-players] Time window: ${new Date(startTime * 1000).toISOString()} → ${new Date(endTime * 1000).toISOString()}`
    )
  }

  if (seedRows.length === 0) {
    console.warn('[riot:discover-players] No players in DB. Add seed players (Admin or League-v4) first.')
    return { totalPlayersUpserted: 0, matchIdsFetched: 0, matchIdsSkipped: 0, errors: 0 }
  }

  console.log(`[riot:discover-players] Loaded ${seedRows.length} seed players. Starting…`)

  let totalPlayersUpserted = 0
  let matchIdsFetched = 0
  let matchIdsSkipped = 0
  let errors = 0
  const totalSeeds = seedRows.length

  for (let seedIndex = 0; seedIndex < seedRows.length; seedIndex++) {
    if (options?.shouldStop && (await options.shouldStop())) break
    if (options?.onProgress) await options.onProgress({
      newPlayersAdded: totalPlayersUpserted,
      matchesCollected: matchIdsFetched,
      matchesFromDb: matchIdsSkipped,
      errors,
    })
    const row = seedRows[seedIndex]
    const continent = platformToContinent(row.region)
    const matchIdsResult = await riotApi.getMatchIdsByPuuid(row.puuid, {
      count: matchesPerPlayer,
      queue: 420,
      startTime,
      endTime,
      continent,
    })

    if (matchIdsResult.isErr()) {
      errors++
      console.warn(`[riot:discover-players] Seed ${seedIndex + 1}/${totalSeeds} getMatchIds failed:`, matchIdsResult.unwrapErr())
      if (isRiotAuthError(matchIdsResult.unwrapErr())) {
        riotApi.invalidateKeyCache()
        throw matchIdsResult.unwrapErr()
      }
      continue
    }

    const matchIds = matchIdsResult.unwrap()
    const puuidShort = row.puuid.slice(0, 8) + '…'
    console.log(`[riot:discover-players] Seed ${seedIndex + 1}/${totalSeeds} ${puuidShort} (${row.region}) → ${matchIds.length} match IDs`)

    let fromApi = 0
    let fromDb = 0
    let playersThisSeed = 0

    for (const matchId of matchIds) {
      const exists = await hasMatch(matchId)
      if (exists) {
        matchIdsSkipped++
        fromDb++
        const match = await prisma.match.findUnique({
          where: { matchId },
          select: { id: true, region: true },
        })
        if (!match) continue
        const participants = await prisma.participant.findMany({
          where: { matchId: match.id },
          select: { puuid: true },
        })
        for (const p of participants) {
          if (!p.puuid?.trim()) continue
          await prisma.player.upsert({
            where: { puuid: p.puuid },
            create: { puuid: p.puuid, region: match.region, lastSeen: null },
            update: {},
          })
          totalPlayersUpserted++
          playersThisSeed++
        }
        continue
      }

      matchIdsFetched++
      fromApi++
      const matchResult = await riotApi.getMatch(matchId)
      if (matchResult.isErr()) {
        if ((matchResult.unwrapErr() as { details?: { status?: number } }).details?.status === 404) continue
        errors++
        continue
      }

      const matchData = matchResult.unwrap()
      const info = matchData.info
      if (!info?.participants?.length) continue

      const platformId = (info as { platformId?: string }).platformId
      const region = platformId === 'eun1' ? 'eun1' : 'euw1'

      for (const p of info.participants) {
        const puuid = typeof p.puuid === 'string' ? p.puuid.trim() : ''
        if (!puuid) continue
        await prisma.player.upsert({
          where: { puuid },
          create: { puuid, region, lastSeen: null },
          update: {},
        })
        totalPlayersUpserted++
        playersThisSeed++
      }
    }

    if (playersThisSeed > 0 || fromApi > 0 || fromDb > 0) {
      console.log(
        `[riot:discover-players]   → ${fromApi} from API, ${fromDb} from DB, +${playersThisSeed} players (total: ${totalPlayersUpserted})`
      )
    }
  }

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(
    `[riot:discover-players] Done in ${durationSec}s: ${totalPlayersUpserted} player upserts, ${matchIdsFetched} matches from API, ${matchIdsSkipped} from DB, ${errors} errors`
  )
  return {
    totalPlayersUpserted,
    matchIdsFetched,
    matchIdsSkipped,
    errors,
  }
}

async function main(): Promise<void> {
  await writeProgress(SCRIPT_ID, {
    pid: process.pid,
    phase: 'starting',
    metrics: {},
  })
  if (await isStopRequested(SCRIPT_ID)) {
    await clearProgressAndStopRequest(SCRIPT_ID)
    return
  }

  const { getRiotApiService } = await import('../services/RiotApiService.js')
  const riotApi = getRiotApiService()
  riotApi.setKeyPreference(false)

  const progressAndStop = {
    shouldStop: () => isStopRequested(SCRIPT_ID),
    onProgress: (metrics: Record<string, number>) =>
      writeProgress(SCRIPT_ID, { phase: 'discover-players', metrics }),
  }

  try {
    await writeProgress(SCRIPT_ID, { phase: 'discover-players' })
    const result = await runDiscovery(riotApi, progressAndStop)
    await writeProgress(SCRIPT_ID, {
      phase: 'done',
      metrics: {
        newPlayersAdded: result.totalPlayersUpserted,
        matchesCollected: result.matchIdsFetched,
        matchesFromDb: result.matchIdsSkipped,
        errors: result.errors,
      },
    })
  } catch (err) {
    if (isRiotAuthError(err)) {
      console.warn('[riot:discover-players] Key from .env rejected (401/403), retrying with Admin key…')
      riotApi.invalidateKeyCache()
      riotApi.setKeyPreference(true)
      const result = await runDiscovery(riotApi, progressAndStop)
      await writeProgress(SCRIPT_ID, {
        phase: 'done',
        metrics: {
          newPlayersAdded: result.totalPlayersUpserted,
          matchesCollected: result.matchIdsFetched,
          matchesFromDb: result.matchIdsSkipped,
          errors: result.errors,
        },
      })
    } else {
      throw err
    }
  } finally {
    await clearProgressAndStopRequest(SCRIPT_ID)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    if (!isRiotAuthError(err)) console.error('[riot:discover-players]', err)
    process.exit(1)
  })
