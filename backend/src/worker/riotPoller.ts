/**
 * Riot poller: runs inside the backend process.
 * - Init: resolves API key (any subsequent 401/403 stops the poller automatically).
 * - Steps 2 + 2b + 3 (backfill / migration puuid): once at start, then again only when missing data is detected.
 * - Step 4 (poll players -> matches): loop; on 429 we sleep and retry, we never exit the loop.
 * Logs to logs/riot-poller.log; exposes status for admin API.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { loadMatchFilters, loadCurrentGameVersion, loadRateLimitConfig } from '../services/RiotConfigService.js'
import type { MatchFiltersConfig } from '../services/RiotConfigService.js'
import { RiotRateLimiter } from '../services/RiotRateLimiter.js'
import {
  RiotHttpClient,
  resolveRiotApiKey,
  getClefTypeFromFile,
  type RiotMatchDto,
  type RiotParticipantDto,
} from '../services/RiotHttpClient.js'
import { Prisma } from '../generated/prisma/index.js'
import { rankToScore, scoreToRank, formatRankString } from '../utils/rankScore.js'
const BATCH_FIX_NULLS = 50
const PLAYERS_PER_LOOP = 20
const MATCH_FETCH_CONCURRENCY = 5 // parallel match detail fetches per player

/**
 * Run async tasks with a bounded concurrency (like p-limit but inline).
 * Tasks are executed as soon as a slot is free, up to `limit` at a time.
 */
async function runWithConcurrency(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  const queue = tasks.slice()
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift()
      if (task) await task()
    }
  })
  await Promise.all(workers)
}

export interface RiotPollerStatus {
  isRunning: boolean
  shouldStop: boolean
  lastLoopStartedAt: string | null
  lastLoopFinishedAt: string | null
  lastError: string | null
  requestCount: number
  error429Count: number
  error400Count: number
  matchesFetched: number
  playersFetched: number
  participantsFetched: number
  matchesRankFixed: number
  participantsRankFixed: number
  participantsRoleFixed: number
}

const defaultStatus: RiotPollerStatus = {
  isRunning: false,
  shouldStop: false,
  lastLoopStartedAt: null,
  lastLoopFinishedAt: null,
  lastError: null,
  requestCount: 0,
  error429Count: 0,
  error400Count: 0,
  matchesFetched: 0,
  playersFetched: 0,
  participantsFetched: 0,
  matchesRankFixed: 0,
  participantsRankFixed: 0,
  participantsRoleFixed: 0,
}

let state: RiotPollerStatus = { ...defaultStatus }
let loopPromise: Promise<void> | null = null

function setState(partial: Partial<RiotPollerStatus>): void {
  state = { ...state, ...partial }
}

function is400Decrypt(body: unknown): boolean {
  if (body && typeof body === 'object' && 'status' in body) {
    const msg = String((body as { status?: { message?: string } }).status?.message ?? '')
    return msg.includes('decrypt') || msg.includes('Bad Request')
  }
  return false
}

function roleFromPosition(individualPosition?: string, teamPosition?: string): string | null {
  const p = individualPosition ?? teamPosition ?? ''
  if (/^TOP$/i.test(p)) return 'TOP'
  if (/^JUNGLE/i.test(p)) return 'JUNGLE'
  if (/^MIDDLE|^MID/i.test(p)) return 'MIDDLE'
  if (/^BOTTOM|^ADC/i.test(p)) return 'BOTTOM'
  if (/^UTILITY|^SUPPORT/i.test(p)) return 'SUPPORT'
  return p || null
}


export type RiotPollerInit = {
  ok: true
  client: RiotHttpClient
  logger: ReturnType<typeof createRiotPollerLogger>
  filters: MatchFiltersConfig
  clefType: string | null
}

/** Returns true if backfill (steps 2, 2b, 3) is needed: players to sync, or null ranks/roles for valid-key players. */
async function hasMissingBackfillData(clefType: string | null): Promise<boolean> {
  const playerFilter = clefType ? { player: { puuidKeyVersion: clefType } } : {}
  const [playersToSync, nullRole, nullRank, matchesNullRank] = await Promise.all([
    clefType
      ? prisma.player.count({
          where: {
            OR: [
              { puuidKeyVersion: null },
              { puuidKeyVersion: { notIn: ['erreur', 'perdu', clefType] } },
            ],
            gameName: { not: null },
            tagName: { not: null },
          },
        })
      : Promise.resolve(0),
    prisma.participant.count({ where: { role: null, ...playerFilter } }),
    prisma.participant.count({ where: { rankTier: null, ...playerFilter } }),
    prisma.match.count({ where: { rank: null, participants: { some: { rankTier: { not: null } } } } }),
  ])
  return playersToSync > 0 || nullRole > 0 || nullRank > 0 || matchesNullRank > 0
}

/**
 * Phase 2: sync all players whose puuidKeyVersion != clefType (and != 'erreur').
 * Loops until there are no more players to sync. On API failure → marks as 'erreur' (handled by phase 2b).
 */
async function runPhase2(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  clefType: string | null
): Promise<void> {
  if (!clefType) return
  await logger.step('Phase 2 start: sync players to current key', { clefType })
  let totalSynced = 0
  let totalErreur = 0
  let totalPerdu = 0
  while (!state.shouldStop) {
    const batch = await prisma.player.findMany({
      where: {
        // NULL must be included explicitly — Prisma's notIn excludes NULL rows in SQL
        OR: [
          { puuidKeyVersion: null },
          { puuidKeyVersion: { notIn: ['erreur', 'perdu', clefType] } },
        ],
        gameName: { not: null },
        tagName: { not: null },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    })
    if (batch.length === 0) break
    for (const p of batch) {
      if (state.shouldStop) break
      const gameName = (p.gameName ?? '').trim()
      const tagLine = (p.tagName ?? '').trim()
      if (!gameName || !tagLine) continue
      const res = await client.getAccountByRiotId(gameName, tagLine)
      setState({ requestCount: state.requestCount + 1 })
      if (res.ok) {
        try {
          await prisma.player.update({
            where: { id: p.id },
            data: { puuid: res.data.puuid, puuidKeyVersion: clefType },
          })
          totalSynced++
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && (e as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
            await prisma.player.update({ where: { id: p.id }, data: { puuidKeyVersion: 'perdu' } })
            totalPerdu++
          } else throw e
        }
        continue
      }
      if (res.status === 429) setState({ error429Count: state.error429Count + 1 })
      const resEuw = await client.getAccountByRiotId(gameName, 'EUW')
      setState({ requestCount: state.requestCount + 1 })
      if (resEuw.ok) {
        try {
          await prisma.player.update({
            where: { id: p.id },
            data: { puuid: resEuw.data.puuid, puuidKeyVersion: clefType, tagName: 'EUW' },
          })
          totalSynced++
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && (e as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
            await prisma.player.update({ where: { id: p.id }, data: { puuidKeyVersion: 'perdu' } })
            totalPerdu++
          } else throw e
        }
        continue
      }
      await prisma.player.update({ where: { id: p.id }, data: { puuidKeyVersion: 'erreur' } })
      totalErreur++
    }
  }
  await logger.step('Phase 2 end', { totalSynced, totalErreur, totalPerdu })
}

/**
 * Phase 2b: recover players with puuidKeyVersion='erreur' via match history.
 * If still unresolvable after trying → marks as 'perdu' (excluded from all future processing).
 */
async function runPhase2b(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  clefType: string | null
): Promise<void> {
  if (!clefType) return
  await logger.step('Phase 2b start: recover erreur players', {})
  let totalRecovered = 0
  let totalLost = 0
  while (!state.shouldStop) {
    const batch = await prisma.player.findMany({
      where: { puuidKeyVersion: 'erreur', gameName: { not: null }, tagName: { not: null } },
      take: 10,
      orderBy: { createdAt: 'desc' },
    })
    if (batch.length === 0) break
    for (const player of batch) {
      if (state.shouldStop) break
      const matchIdsRes = await client.getMatchIdsByPuuid(player.puuid, { queue: 420, count: 1 })
      setState({ requestCount: state.requestCount + 1 })
      if (!matchIdsRes.ok) {
        if (matchIdsRes.status === 429) {
          setState({ error429Count: state.error429Count + 1 })
        } else {
          await prisma.player.update({ where: { id: player.id }, data: { puuidKeyVersion: 'perdu' } })
          totalLost++
        }
        continue
      }
      const matchIds = Array.isArray(matchIdsRes.data) ? matchIdsRes.data : []
      if (!matchIds[0]) {
        await prisma.player.update({ where: { id: player.id }, data: { puuidKeyVersion: 'perdu' } })
        totalLost++
        continue
      }
      const matchRes = await client.getMatch(matchIds[0])
      setState({ requestCount: state.requestCount + 1 })
      if (!matchRes.ok) {
        if (matchRes.status === 429) setState({ error429Count: state.error429Count + 1 })
        continue
      }
      const participants = (matchRes.data.info?.participants ?? []) as RiotParticipantDto[]
      const gameNameNorm = (player.gameName ?? '').trim().toLowerCase()
      const tagLineNorm = (player.tagName ?? '').trim().toLowerCase()
      let found = false
      for (const part of participants) {
        const puuid = part.puuid
        if (!puuid) continue
        const accRes = await client.getAccountByPuuid(puuid)
        setState({ requestCount: state.requestCount + 1 })
        if (!accRes.ok) {
          if (accRes.status === 429) setState({ error429Count: state.error429Count + 1 })
          continue
        }
        const gn = (accRes.data.gameName ?? '').trim().toLowerCase()
        const tl = (accRes.data.tagLine ?? '').trim().toLowerCase()
        if (gn === gameNameNorm && tl === tagLineNorm) {
          try {
            await prisma.player.update({
              where: { id: player.id },
              data: { puuid, puuidKeyVersion: clefType },
            })
            totalRecovered++
            found = true
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && (e as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
              await prisma.player.update({ where: { id: player.id }, data: { puuidKeyVersion: 'perdu' } })
              totalLost++
            } else throw e
          }
          break
        }
      }
      if (!found) {
        await prisma.player.update({ where: { id: player.id }, data: { puuidKeyVersion: 'perdu' } })
        totalLost++
      }
    }
  }
  await logger.step('Phase 2b end', { totalRecovered, totalLost })
}

function sameSummoner(
  aGameName: string | null | undefined,
  aTagLine: string | null | undefined,
  bGameName: string | null | undefined,
  bTagLine: string | null | undefined
): boolean {
  return (
    (aGameName ?? '').trim().toLowerCase() === (bGameName ?? '').trim().toLowerCase() &&
    (aTagLine ?? '').trim().toLowerCase() === (bTagLine ?? '').trim().toLowerCase()
  )
}

async function runStep3FixNulls(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  counters: { matchesRankFixed: number; participantsRankFixed: number; participantsRoleFixed: number },
  clefType: string | null
): Promise<void> {
  await logger.step('Step 3 start', {})

  const playerFilter = clefType ? { player: { puuidKeyVersion: clefType } } : {}

  const participantsNullRole = await prisma.participant.findMany({
    where: { role: null, ...playerFilter },
    include: { match: true, player: true },
    take: BATCH_FIX_NULLS,
  })
  for (const p of participantsNullRole) {
    const platform = p.match.matchId.startsWith('EUN1_') ? 'eun1' : 'euw1'
    client.setPlatform(platform)
    const matchRes = await client.getMatch(p.match.matchId)
    setState({ requestCount: state.requestCount + 1 })
    if (!matchRes.ok) continue
    const part = matchRes.data.info?.participants?.find((x) => x.puuid === p.player.puuid)
    if (part) {
      const role = roleFromPosition(part.individualPosition, part.teamPosition)
      if (role) {
        await prisma.participant.update({ where: { id: p.id }, data: { role } })
        counters.participantsRoleFixed++
        await logger.info('DB: participant updated (role)', { participantId: String(p.id) })
      }
    }
  }

  const participantsNullRank = await prisma.participant.findMany({
    where: { rankTier: null, ...playerFilter },
    include: { player: true },
    take: BATCH_FIX_NULLS,
  })
  for (const p of participantsNullRank) {
    client.setPlatform(p.player.region)
    const summonerRes = await client.getSummonerByPuuid(p.player.puuid)
    setState({ requestCount: state.requestCount + 1 })
    if (!summonerRes.ok) continue
    const leagueRes = await client.getLeagueEntriesBySummonerId(summonerRes.data.id)
    setState({ requestCount: state.requestCount + 1 })
    if (!leagueRes.ok) continue
    const solo = leagueRes.data.find((e) => e.queueType === 'RANKED_SOLO_5x5')
    if (solo) {
      await prisma.participant.update({
        where: { id: p.id },
        data: {
          rankTier: solo.tier,
          rankDivision: solo.rank,
          rankLp: solo.leaguePoints ?? null,
        },
      })
      counters.participantsRankFixed++
      await logger.info('DB: participant updated (rank)', { participantId: String(p.id), tier: solo.tier })
    }
  }

  const matchesNullRank = await prisma.match.findMany({
    where: { rank: null, participants: { some: { rankTier: { not: null } } } },
    include: { participants: { include: { player: true } } },
    take: BATCH_FIX_NULLS,
  })
  for (const m of matchesNullRank) {
    const parts = m.participants.filter((p) => p.rankTier != null)
    if (parts.length === 0) continue
    let totalScore = 0
    for (const p of parts) {
      totalScore += rankToScore(p.rankTier!, p.rankDivision ?? '', p.rankLp)
    }
    const avg = totalScore / parts.length
    const { tier, division } = scoreToRank(avg)
    const rankStr = formatRankString(tier, division)
    await prisma.match.update({ where: { id: m.id }, data: { rank: rankStr } })
    counters.matchesRankFixed++
    await logger.info('DB: match updated (rank)', { matchId: m.matchId })
  }

  await logger.step('Step 3 end', { ...counters })
}

function buildTeamsJson(info: RiotMatchDto['info']): unknown[] | null {
  if (!info?.teams) return null
  return info.teams.map((t) => ({
    teamId: t.teamId,
    bans: t.bans ?? [],
    objectives: t.objectives ?? {},
  }))
}

export async function upsertMatchAndParticipants(
  region: string,
  dto: RiotMatchDto,
  puuidKeyVersion: string | null,
  counters: { matchesFetched: number; participantsFetched: number; playersFetched: number },
  logger?: ReturnType<typeof createRiotPollerLogger>
): Promise<void> {
  const matchId = dto.metadata?.matchId ?? dto.info?.gameId?.toString()
  if (!matchId) return
  const info = dto.info
  if (!info?.participants?.length) return
  if (info.endOfGameResult && info.endOfGameResult !== 'GameComplete') return

  const existing = await prisma.match.findUnique({ where: { matchId }, select: { id: true } })
  if (existing) return

  const gameVersion = info.gameVersion ?? null
  const gameDuration = info.gameDuration ?? null
  const teams = buildTeamsJson(info)

  const participantDtos = info.participants as RiotParticipantDto[]
  const puuids = participantDtos.map((p) => p.puuid).filter(Boolean) as string[]
  const existingPlayers = await prisma.player.findMany({
    where: { puuid: { in: puuids } },
    select: { id: true, puuid: true, puuidKeyVersion: true },
  })
  const existingByPuuid = new Map(existingPlayers.map((p) => [p.puuid, p]))

  const rankScores: number[] = []
  for (const p of participantDtos) {
    const tier = (p as { tier?: string }).tier ?? (p as { rankTier?: string }).rankTier
    if (tier) {
      const div = (p as { rank?: string }).rank ?? (p as { rankDivision?: string }).rankDivision ?? ''
      const lp = (p as { leaguePoints?: number }).leaguePoints ?? null
      rankScores.push(rankToScore(tier, div, lp))
    }
  }
  let matchRank: string | null = null
  if (rankScores.length >= 10) {
    const avg = rankScores.reduce((a, b) => a + b, 0) / rankScores.length
    const { tier, division } = scoreToRank(avg)
    matchRank = formatRankString(tier, division)
  }

  const match = await prisma.match.create({
    data: {
      matchId,
      gameVersion,
      gameDuration,
      rank: matchRank,
      teams: teams as never,
    },
  })
  counters.matchesFetched++
  if (logger) await logger.info('DB: match created', { matchId })

  for (const p of participantDtos) {
    const puuid = p.puuid
    if (!puuid) continue
    const existing = existingByPuuid.get(puuid)
    let playerId: bigint
    if (existing == null) {
      const newPlayer = await prisma.player.create({
        data: {
          puuid,
          region,
          puuidKeyVersion,
          gameName: null,
          tagName: null,
          lastSeen: null,
        },
      })
      playerId = newPlayer.id
      existingByPuuid.set(puuid, { id: playerId, puuid, puuidKeyVersion })
      counters.playersFetched++
    } else {
      playerId = existing.id
      // Player was 'perdu' but reappears in a live match → their PUUID is valid, restore key version
      if (existing.puuidKeyVersion === 'perdu' && puuidKeyVersion) {
        await prisma.player.update({ where: { id: existing.id }, data: { puuidKeyVersion } })
        existing.puuidKeyVersion = puuidKeyVersion
      }
    }
    const role = roleFromPosition(p.individualPosition, p.teamPosition)
    const rankTier = (p as { tier?: string }).tier ?? (p as { rankTier?: string }).rankTier ?? null
    const rankDivision = (p as { rank?: string }).rank ?? (p as { rankDivision?: string }).rankDivision ?? null
    const rankLp = (p as { leaguePoints?: number }).leaguePoints ?? (p as { rankLp?: number }).rankLp ?? null
    await prisma.participant.create({
      data: {
        playerId,
        matchId: match.id,
        teamId: p.teamId ?? null,
        championId: p.championId ?? 0,
        win: p.win ?? false,
        role,
        rankTier,
        rankDivision,
        rankLp,
        kills: p.kills ?? 0,
        deaths: p.deaths ?? 0,
        assists: p.assists ?? 0,
        champLevel: p.champLevel ?? null,
        goldEarned: p.goldEarned ?? null,
        totalDamageDealtToChampions: p.totalDamageDealtToChampions ?? null,
        totalMinionsKilled: p.totalMinionsKilled ?? null,
        visionScore: p.visionScore ?? null,
      },
    })
    counters.participantsFetched++
  }
  if (logger) await logger.info('DB: participants created', { matchId, count: participantDtos.length })
}

async function runStep4ForPlayer(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  filters: MatchFiltersConfig,
  region: string,
  puuidKeyVersion: string | null,
  counters: {
    requestCount: number
    error429Count: number
    error400Count: number
    matchesFetched: number
    playersFetched: number
    participantsFetched: number
  }
): Promise<'ok' | '400_decrypt' | 'prisma_error'> {
  const players = await prisma.player.findMany({
    where: {
      region,
      ...(puuidKeyVersion
        ? { puuidKeyVersion }
        : { puuidKeyVersion: { notIn: ['erreur', 'perdu'] } }),
    },
    orderBy: [{ lastSeen: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    take: PLAYERS_PER_LOOP,
  })

  for (const player of players) {
    if (state.shouldStop) return 'ok'

    const matchIdsRes = await client.getMatchIdsByPuuid(player.puuid, {
      queue: filters.queue,
      count: filters.count,
      start: 0,
    })
    counters.requestCount++
    if (!matchIdsRes.ok && matchIdsRes.status === 429) counters.error429Count++
    if (!matchIdsRes.ok) {
      if (matchIdsRes.status === 400 && is400Decrypt(matchIdsRes.body)) {
        counters.error400Count++
        await logger.error('400 decrypt', matchIdsRes.body)
        return '400_decrypt'
      }
      continue
    }

    const matchIds = Array.isArray(matchIdsRes.data) ? matchIdsRes.data : []
    const existing = await prisma.match.findMany({
      where: { matchId: { in: matchIds } },
      select: { matchId: true },
    })
    const existingSet = new Set(existing.map((m) => m.matchId))
    const toFetch = matchIds.filter((id) => !existingSet.has(id))

    // Fetch and upsert matches in parallel (MATCH_FETCH_CONCURRENCY at a time).
    // Flags shared across concurrent tasks:
    let found400Decrypt = false
    let foundPrismaError = false

    const fetchTasks = toFetch.map((matchId) => async () => {
      if (state.shouldStop || found400Decrypt) return
      const matchRes = await client.getMatch(matchId)
      counters.requestCount++
      if (!matchRes.ok && matchRes.status === 429) counters.error429Count++
      if (!matchRes.ok) {
        if (matchRes.status === 400 && is400Decrypt(matchRes.body)) {
          counters.error400Count++
          await logger.error('400 decrypt on match', matchRes.body)
          found400Decrypt = true
          return
        }
        return
      }
      try {
        await upsertMatchAndParticipants(region, matchRes.data, puuidKeyVersion, counters, logger)
      } catch (err) {
        await logger.error('Prisma error upserting match', err)
        foundPrismaError = true
      }
    })

    await runWithConcurrency(fetchTasks, MATCH_FETCH_CONCURRENCY)

    if (found400Decrypt) return '400_decrypt'
    if (foundPrismaError) return 'prisma_error'

    const lastMatch = matchIds[0]
    let lastSeen: Date | null = null
    if (lastMatch) {
      const m = await prisma.match.findUnique({ where: { matchId: lastMatch }, select: { createdAt: true } })
      if (m) lastSeen = m.createdAt
    }
    await prisma.player.update({
      where: { id: player.id },
      data: { lastSeen },
    })

    if (matchIds.length > 0) {
      const accRes = await client.getAccountByPuuid(player.puuid)
      counters.requestCount++
      if (!accRes.ok && accRes.status === 429) counters.error429Count++
      if (accRes.ok) {
        const gn = accRes.data.gameName ?? null
        const tl = accRes.data.tagLine ?? null
        if (!sameSummoner(player.gameName, player.tagName, gn, tl)) {
          await prisma.player.update({
            where: { id: player.id },
            data: { gameName: gn, tagName: tl },
          })
          await logger.info('DB: player updated (gameName/tagName)', {
            puuid: player.puuid.slice(0, 8),
            gameName: gn,
            tagLine: tl,
          })
        }
      }
    }
  }

  return 'ok'
}

/** Resolves the API key and sets it on the client without making a test request. */
export async function initRiotPoller(): Promise<RiotPollerInit | { ok: false }> {
  if (!isDatabaseConfigured()) {
    setState({ lastError: 'DATABASE_URL not set' })
    return { ok: false }
  }
  const logger = createRiotPollerLogger()
  const rateLimitRes = await loadRateLimitConfig()
  if (rateLimitRes.isErr()) {
    await logger.error('Failed to load rate-limit config', rateLimitRes.unwrapErr())
    setState({ lastError: 'rate-limit config' })
    return { ok: false }
  }
  const rateLimiter = new RiotRateLimiter(rateLimitRes.unwrap())
  const client = new RiotHttpClient(rateLimiter, logger)
  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) {
    await logger.error('Failed to load match-filters', filtersRes.unwrapErr())
    setState({ lastError: 'match-filters config' })
    return { ok: false }
  }
  const filters = filtersRes.unwrap()
  await loadCurrentGameVersion()

  const resolved = await resolveRiotApiKey()
  if (!resolved.ok) {
    await logger.error('No API key configured', resolved.error)
    setState({ lastError: resolved.error })
    return { ok: false }
  }
  client.setKey(resolved.key, resolved.source, resolved.clefType)
  await logger.step('API key loaded', { source: resolved.source, keyLen: resolved.key.length })

  client.setOnInvalidKey(() => {
    const msg = 'API key invalid or expired — stopping poller'
    setState({ shouldStop: true, lastError: msg })
    void logger.error(msg, {})
  })

  const clefType = client.getActiveKeyInfo()?.clefType ?? (await getClefTypeFromFile())
  return { ok: true, client, logger, filters, clefType }
}

/**
 * Phase 3: fix all null rank/role data for 'clefType' players.
 * Loops until no missing data or stuck (API failures prevent progress).
 */
async function runPhase3(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  clefType: string | null
): Promise<void> {
  await logger.step('Phase 3 start: backfill null data', {})
  const MAX_STUCK = 3
  let stuckCount = 0
  while (!state.shouldStop) {
    const missing = await hasMissingBackfillData(clefType)
    if (!missing) break
    const counters = { matchesRankFixed: 0, participantsRankFixed: 0, participantsRoleFixed: 0 }
    await runStep3FixNulls(client, logger, counters, clefType)
    setState({
      matchesRankFixed: state.matchesRankFixed + counters.matchesRankFixed,
      participantsRankFixed: state.participantsRankFixed + counters.participantsRankFixed,
      participantsRoleFixed: state.participantsRoleFixed + counters.participantsRoleFixed,
    })
    const totalFixed = counters.matchesRankFixed + counters.participantsRankFixed + counters.participantsRoleFixed
    if (totalFixed === 0) {
      stuckCount++
      if (stuckCount >= MAX_STUCK) {
        await logger.step('Phase 3 stuck: cannot fix remaining data (API failures?)', { stuckCount })
        break
      }
    } else {
      stuckCount = 0
    }
  }
  await logger.step('Phase 3 end', {
    matchesRankFixed: state.matchesRankFixed,
    participantsRankFixed: state.participantsRankFixed,
    participantsRoleFixed: state.participantsRoleFixed,
  })
}

async function runStep4Counters() {
  return {
    requestCount: state.requestCount,
    error429Count: state.error429Count,
    error400Count: state.error400Count,
    matchesFetched: state.matchesFetched,
    playersFetched: state.playersFetched,
    participantsFetched: state.participantsFetched,
  }
}

async function runLoop(init: RiotPollerInit): Promise<void> {
  const { client, logger, filters, clefType } = init
  setState({
    isRunning: true,
    shouldStop: false,
    lastLoopStartedAt: new Date().toISOString(),
    lastError: null,
    requestCount: 0,
    error429Count: 0,
    error400Count: 0,
    matchesFetched: 0,
    playersFetched: 0,
    participantsFetched: 0,
    matchesRankFixed: 0,
    participantsRankFixed: 0,
    participantsRoleFixed: 0,
  })

  try {
    // ── Phase 2: sync all players with wrong/missing key version ──────────────
    await runPhase2(client, logger, clefType)

    // ── Phase 2b: recover 'erreur' players, mark unresolvable as 'perdu' ──────
    await runPhase2b(client, logger, clefType)

    // ── Phase 3: backfill null rank/role data for current-key players ──────────
    await runPhase3(client, logger, clefType)

    await logger.step('Initialization phases complete, entering collection loop', {})

    // ── Phase 4: main collection loop ─────────────────────────────────────────
    while (!state.shouldStop && isDatabaseConfigured()) {
      // Fix any new null data produced by step 4 (newly collected matches)
      const missing = await hasMissingBackfillData(clefType)
      if (missing) {
        const counters = { matchesRankFixed: 0, participantsRankFixed: 0, participantsRoleFixed: 0 }
        await runStep3FixNulls(client, logger, counters, clefType)
        setState({
          matchesRankFixed: state.matchesRankFixed + counters.matchesRankFixed,
          participantsRankFixed: state.participantsRankFixed + counters.participantsRankFixed,
          participantsRoleFixed: state.participantsRoleFixed + counters.participantsRoleFixed,
        })
      }

      // EUW1 collection
      client.setPlatform('euw1')
      const countersEuw = await runStep4Counters()
      const resultEuw = await runStep4ForPlayer(client, logger, filters, 'euw1', clefType, countersEuw)
      setState({
        requestCount: countersEuw.requestCount,
        error429Count: countersEuw.error429Count,
        error400Count: countersEuw.error400Count,
        matchesFetched: countersEuw.matchesFetched,
        playersFetched: countersEuw.playersFetched,
        participantsFetched: countersEuw.participantsFetched,
      })
      if (resultEuw === '400_decrypt') {
        // Key changed: re-run full phases 2 + 2b
        await runPhase2(client, logger, clefType)
        await runPhase2b(client, logger, clefType)
        continue
      }
      if (resultEuw === 'prisma_error') await logger.alerte('Prisma error in step 4 (euw1), continuing')

      // EUN1 collection
      client.setPlatform('eun1')
      const countersEun = await runStep4Counters()
      const resultEun = await runStep4ForPlayer(client, logger, filters, 'eun1', clefType, countersEun)
      setState({
        requestCount: countersEun.requestCount,
        error429Count: countersEun.error429Count,
        error400Count: countersEun.error400Count,
        matchesFetched: countersEun.matchesFetched,
        playersFetched: countersEun.playersFetched,
        participantsFetched: countersEun.participantsFetched,
      })
      if (resultEun === '400_decrypt') {
        await runPhase2(client, logger, clefType)
        await runPhase2b(client, logger, clefType)
        continue
      }
      if (resultEun === 'prisma_error') await logger.alerte('Prisma error in step 4 (eun1), continuing')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logger.error('Poller loop error', msg)
    setState({ lastError: msg })
  } finally {
    setState({ isRunning: false, shouldStop: false, lastLoopFinishedAt: new Date().toISOString() })
    await logger.step('Loop end', {
      requestCount: state.requestCount,
      error429: state.error429Count,
      matchesFetched: state.matchesFetched,
      playersFetched: state.playersFetched,
      participantsFetched: state.participantsFetched,
    })
  }
}

export function getRiotPollerStatus(): RiotPollerStatus {
  return { ...state }
}

export function requestStopRiotPoller(): void {
  setState({ shouldStop: true })
}

export function startRiotPoller(): void {
  if (state.isRunning) return
  if (!isDatabaseConfigured()) {
    console.warn('[RiotPoller] DATABASE_URL not set, poller not started')
    return
  }
  setState({ shouldStop: false })
  loopPromise = (async () => {
    const init = await initRiotPoller()
    if (!init.ok) {
      setState({ isRunning: false, lastLoopFinishedAt: new Date().toISOString() })
      return
    }
    await runLoop(init)
  })()
  loopPromise.catch((err) => console.error('[RiotPoller] runLoop failed:', err))
}

export function isRiotPollerRunning(): boolean {
  return state.isRunning
}
