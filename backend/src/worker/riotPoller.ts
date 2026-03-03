/**
 * Riot poller: runs inside the backend process, infinite loop.
 * Steps: 1) API key check, 2) clefType sync, 3) fix null ranks/roles, 4) poll players -> matches -> participants.
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
import { rankToScore, scoreToRank, formatRankString } from '../utils/rankScore.js'
const DELAY_429_MS = 5000
const BATCH_FIX_NULLS = 50
const PLAYERS_PER_LOOP = 20

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

async function runStep1KeyCheck(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>
): Promise<boolean> {
  await logger.step('Step 1 start', {})
  const resolved = await resolveRiotApiKey()
  if (!resolved.ok) {
    await logger.error('Step 1: no API key', resolved.error)
    setState({ lastError: resolved.error })
    return false
  }
  client.setKey(resolved.key, resolved.source, resolved.clefType)
  const test = await client.getPlatformData()
  if (!test.ok) {
    if (resolved.source === 'env' && resolved.key) {
      const fileResolved = await resolveRiotApiKey()
      if (fileResolved.ok && fileResolved.source === 'file') {
        client.setKey(fileResolved.key, fileResolved.source, fileResolved.clefType)
        const retry = await client.getPlatformData()
        if (retry.ok) {
          await logger.info('Step 1: env key failed, file key OK', {
            source: 'file',
            keyLen: fileResolved.key.length,
          })
          return true
        }
      }
    }
    await logger.error('Step 1: key test failed', test.status, test.message, test.body)
    setState({ lastError: test.message ?? `HTTP ${test.status}` })
    return false
  }
  await logger.step('Step 1 end', { source: resolved.source, keyLen: resolved.key.length })
  return true
}

async function runStep2ClefSync(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  clefType: string | null
): Promise<void> {
  await logger.step('Step 2 start', { clefType })
  if (!clefType) {
    await logger.step('Step 2 end', { skipped: 'no clefType' })
    return
  }
  const players = await prisma.player.findMany({
    where: {
      puuidKeyVersion: { not: 'erreur' },
      OR: [{ puuidKeyVersion: null }, { puuidKeyVersion: { not: clefType } }],
      gameName: { not: null },
      tagName: { not: null },
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
  })
  for (const p of players) {
    const gameName = (p.gameName ?? '').trim()
    const tagLine = (p.tagName ?? '').trim()
    if (!gameName || !tagLine) continue
    const res = await client.getAccountByRiotId(gameName, tagLine)
    if (res.ok) {
      await prisma.player.update({
        where: { id: p.id },
        data: { puuid: res.data.puuid, puuidKeyVersion: clefType },
      })
      continue
    }
    const resEuw = await client.getAccountByRiotId(gameName, 'EUW')
    if (resEuw.ok) {
      await prisma.player.update({
        where: { id: p.id },
        data: { puuid: resEuw.data.puuid, puuidKeyVersion: clefType, tagName: 'EUW' },
      })
      continue
    }
    await prisma.player.update({
      where: { id: p.id },
      data: { puuidKeyVersion: 'erreur' },
    })
    await logger.alerte('Step 2: could not resolve account (tag_name puis EUW)', { gameName, tagLine })
  }
  await logger.step('Step 2 end', { processed: players.length })
}

const PLAYERS_ERREUR_BATCH = 10

async function runStep2bRecoverErreur(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  clefType: string | null,
  counters: { requestCount: number; error429Count: number }
): Promise<void> {
  await logger.step('Step 2b start (recover puuid_key_version=erreur)', {})
  if (!clefType) {
    await logger.step('Step 2b end', { skipped: 'no clefType' })
    return
  }
  const players = await prisma.player.findMany({
    where: { puuidKeyVersion: 'erreur', gameName: { not: null }, tagName: { not: null } },
    take: PLAYERS_ERREUR_BATCH,
    orderBy: { createdAt: 'desc' },
  })
  for (const player of players) {
    if (state.shouldStop) break
    const matchIdsRes = await client.getMatchIdsByPuuid(player.puuid, { queue: 420, count: 1 })
    counters.requestCount++
    if (!matchIdsRes.ok) {
      if (matchIdsRes.status === 429) {
        counters.error429Count++
        await new Promise((r) => setTimeout(r, DELAY_429_MS))
      }
      continue
    }
    const matchIds = Array.isArray(matchIdsRes.data) ? matchIdsRes.data : []
    const matchId = matchIds[0]
    if (!matchId) continue
    const matchRes = await client.getMatch(matchId)
    counters.requestCount++
    if (!matchRes.ok) {
      if (matchRes.status === 429) {
        counters.error429Count++
        await new Promise((r) => setTimeout(r, DELAY_429_MS))
      }
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
      counters.requestCount++
      if (!accRes.ok) {
        if (accRes.status === 429) {
          counters.error429Count++
          await new Promise((r) => setTimeout(r, DELAY_429_MS))
        }
        continue
      }
      const gn = (accRes.data.gameName ?? '').trim().toLowerCase()
      const tl = (accRes.data.tagLine ?? '').trim().toLowerCase()
      if (gn === gameNameNorm && tl === tagLineNorm) {
        await prisma.player.update({
          where: { id: player.id },
          data: { puuid, puuidKeyVersion: clefType },
        })
        await logger.info('Step 2b: recovered player by match participant', {
          gameName: player.gameName,
          tagLine: player.tagName,
        })
        found = true
        break
      }
    }
    if (!found) await logger.alerte('Step 2b: no matching participant in match', { gameName: player.gameName, tagLine: player.tagName })
  }
  await logger.step('Step 2b end', { processed: players.length })
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
  counters: { matchesRankFixed: number; participantsRankFixed: number; participantsRoleFixed: number }
): Promise<void> {
  await logger.step('Step 3 start', {})

  const participantsNullRole = await prisma.participant.findMany({
    where: { role: null },
    include: { match: true, player: true },
    take: BATCH_FIX_NULLS,
  })
  for (const p of participantsNullRole) {
    const matchRes = await client.getMatch(p.match.matchId)
    if (!matchRes.ok) {
      if (matchRes.status === 429) {
        await new Promise((r) => setTimeout(r, DELAY_429_MS))
        continue
      }
      continue
    }
    const part = matchRes.data.info?.participants?.find((x) => x.puuid === p.player.puuid)
    if (part) {
      const role = roleFromPosition(part.individualPosition, part.teamPosition)
      if (role) {
        await prisma.participant.update({ where: { id: p.id }, data: { role } })
        counters.participantsRoleFixed++
      }
    }
  }

  const participantsNullRank = await prisma.participant.findMany({
    where: { rankTier: null },
    include: { player: true },
    take: BATCH_FIX_NULLS,
  })
  for (const p of participantsNullRank) {
    const leagueRes = await client.getLeagueEntriesByPuuid(p.player.puuid)
    if (!leagueRes.ok) {
      if (leagueRes.status === 429) {
        await new Promise((r) => setTimeout(r, DELAY_429_MS))
        continue
      }
      continue
    }
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
    }
  }

  const matchesNullRank = await prisma.match.findMany({
    where: { rank: null },
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

async function upsertMatchAndParticipants(
  region: string,
  dto: RiotMatchDto,
  puuidKeyVersion: string | null,
  counters: { matchesFetched: number; participantsFetched: number; playersFetched: number }
): Promise<void> {
  const matchId = dto.metadata?.matchId ?? dto.info?.gameId?.toString()
  if (!matchId) return
  const info = dto.info
  if (!info?.participants?.length) return

  const existing = await prisma.match.findUnique({ where: { matchId }, select: { id: true } })
  if (existing) return

  const gameVersion = info.gameVersion ?? null
  const gameDuration = info.gameDuration ?? null
  const queueId = info.queueId ?? 420
  const teams = buildTeamsJson(info)

  const participantDtos = info.participants as RiotParticipantDto[]
  const puuids = participantDtos.map((p) => p.puuid).filter(Boolean) as string[]
  const existingPlayers = await prisma.player.findMany({
    where: { puuid: { in: puuids } },
    select: { id: true, puuid: true },
  })
  const existingByPuuid = new Map(existingPlayers.map((p) => [p.puuid, p.id]))

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
      region,
      queueId,
      gameVersion,
      gameDuration,
      rank: matchRank,
      teams: teams as never,
      puuidKeyVersion,
    },
  })
  counters.matchesFetched++

  for (const p of participantDtos) {
    const puuid = p.puuid
    if (!puuid) continue
    let playerId = existingByPuuid.get(puuid)
    if (playerId == null) {
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
      existingByPuuid.set(puuid, playerId)
      counters.playersFetched++
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
): Promise<'ok' | '429' | '400_decrypt' | 'prisma_error'> {
  const players = await prisma.player.findMany({
    where: { region },
    orderBy: [{ lastSeen: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    take: PLAYERS_PER_LOOP,
  })

  for (const player of players) {
    if (state.shouldStop) return 'ok'

    const start = 0
    const matchIdsRes = await client.getMatchIdsByPuuid(player.puuid, {
      queue: filters.queue,
      count: filters.count,
      start,
    })
    counters.requestCount++

    if (!matchIdsRes.ok) {
      if (matchIdsRes.status === 429) {
        counters.error429Count++
        await logger.error('429 rate limit', { puuid: player.puuid.slice(0, 8) })
        await new Promise((r) => setTimeout(r, DELAY_429_MS))
        return '429'
      }
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

    for (const matchId of toFetch) {
      if (state.shouldStop) break
      const matchRes = await client.getMatch(matchId)
      counters.requestCount++
      if (!matchRes.ok) {
        if (matchRes.status === 429) {
          counters.error429Count++
          await logger.error('429 rate limit on match', { matchId })
          await new Promise((r) => setTimeout(r, DELAY_429_MS))
          continue
        }
        if (matchRes.status === 400 && is400Decrypt(matchRes.body)) {
          counters.error400Count++
          await logger.error('400 decrypt on match', matchRes.body)
          return '400_decrypt'
        }
        continue
      }
      try {
        await upsertMatchAndParticipants(region, matchRes.data, puuidKeyVersion, counters)
      } catch (err) {
        await logger.error('Prisma error upserting match', err)
        return 'prisma_error'
      }
    }

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
      if (accRes.ok) {
        const gn = accRes.data.gameName ?? null
        const tl = accRes.data.tagLine ?? null
        if (!sameSummoner(player.gameName, player.tagName, gn, tl)) {
          await prisma.player.update({
            where: { id: player.id },
            data: { gameName: gn, tagName: tl },
          })
        }
      } else if (accRes.status === 429) {
        counters.error429Count++
        await new Promise((r) => setTimeout(r, DELAY_429_MS))
      }
    }
  }

  return 'ok'
}

async function runLoop(): Promise<void> {
  if (!isDatabaseConfigured()) {
    setState({ isRunning: false, lastLoopFinishedAt: new Date().toISOString(), lastError: 'DATABASE_URL not set' })
    return
  }
  const logger = createRiotPollerLogger()
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

  const rateLimitRes = await loadRateLimitConfig()
  if (rateLimitRes.isErr()) {
    await logger.error('Failed to load rate-limit config', rateLimitRes.unwrapErr())
    setState({ isRunning: false, lastLoopFinishedAt: new Date().toISOString(), lastError: 'rate-limit config' })
    return
  }
  const rateLimiter = new RiotRateLimiter(rateLimitRes.unwrap())
  const client = new RiotHttpClient(rateLimiter, logger)

  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) {
    await logger.error('Failed to load match-filters', filtersRes.unwrapErr())
    setState({ isRunning: false, lastLoopFinishedAt: new Date().toISOString(), lastError: 'match-filters config' })
    return
  }
  const filters = filtersRes.unwrap()
  await loadCurrentGameVersion()
  const clefTypeFromFile = await getClefTypeFromFile()

  try {
    const keyOk = await runStep1KeyCheck(client, logger)
    if (!keyOk) {
      setState({ isRunning: false, lastLoopFinishedAt: new Date().toISOString() })
      return
    }
    const keyInfo = client.getActiveKeyInfo()
    const clefType = keyInfo?.clefType ?? clefTypeFromFile

    while (!state.shouldStop && isDatabaseConfigured()) {
      await runStep2ClefSync(client, logger, clefType)

      const step2bCounters = { requestCount: state.requestCount, error429Count: state.error429Count }
      await runStep2bRecoverErreur(client, logger, clefType, step2bCounters)
      setState({ requestCount: step2bCounters.requestCount, error429Count: step2bCounters.error429Count })

      const loopCounters = {
        matchesRankFixed: 0,
        participantsRankFixed: 0,
        participantsRoleFixed: 0,
      }
      await runStep3FixNulls(client, logger, loopCounters)
      setState({
        matchesRankFixed: state.matchesRankFixed + loopCounters.matchesRankFixed,
        participantsRankFixed: state.participantsRankFixed + loopCounters.participantsRankFixed,
        participantsRoleFixed: state.participantsRoleFixed + loopCounters.participantsRoleFixed,
      })

      const counters = {
        requestCount: state.requestCount,
        error429Count: state.error429Count,
        error400Count: state.error400Count,
        matchesFetched: state.matchesFetched,
        playersFetched: state.playersFetched,
        participantsFetched: state.participantsFetched,
      }
      client.setPlatform('euw1')
      const result = await runStep4ForPlayer(client, logger, filters, 'euw1', clefType, counters)
      setState({
        requestCount: counters.requestCount,
        error429Count: counters.error429Count,
        error400Count: counters.error400Count,
        matchesFetched: counters.matchesFetched,
        playersFetched: counters.playersFetched,
        participantsFetched: counters.participantsFetched,
      })

      if (result === '400_decrypt') {
        await runStep2ClefSync(client, logger, clefType)
        continue
      }
      if (result === 'prisma_error') {
        await logger.alerte('Prisma error in step 4, continuing')
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logger.error('Poller loop error', msg)
    setState({ lastError: msg })
  } finally {
    setState({
      isRunning: false,
      shouldStop: false,
      lastLoopFinishedAt: new Date().toISOString(),
    })
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
  loopPromise = runLoop()
  loopPromise.catch((err) => console.error('[RiotPoller] runLoop failed:', err))
}

export function isRiotPollerRunning(): boolean {
  return state.isRunning
}
