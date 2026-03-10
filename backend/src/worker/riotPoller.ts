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
  type RiotMatchTimelineDto,
  type RiotTimelineEventEliteMonsterKill,
  type RiotTimelineEventDragonSoulGiven,
  type RiotTimelineEventSkillLevelUp,
  type RiotTimelineEventItemPurchased,
} from '../services/RiotHttpClient.js'
import { Prisma } from '../generated/prisma/index.js'
import { rankToScore, scoreToRank, formatRankString } from '../utils/rankScore.js'
import { partitionChallenges, handleUnknownChallengeKeys, allowedToParticipantChallengeData } from '../services/ChallengeNormalisationService.js'
const BATCH_FIX_NULLS = 50
const PLAYERS_PER_LOOP = 20
const MATCH_FETCH_CONCURRENCY = 5 // parallel match detail fetches per player
/** Max matches per run for timeline backfill (drakes, skill order, starter, jungle first clear). */
const BATCH_TIMELINE_BACKFILL = 25
/** Max matches per run for rune backfill (participant_runes from getMatch perks). */
const BATCH_RUNE_BACKFILL = 20
/** Bounded queue size for Phase 4: API producer pushes, DB consumers pop. */
const INGEST_QUEUE_SIZE = 50
/** Number of concurrent DB writers in Phase 4 (consumers). */
const INGEST_CONSUMER_COUNT = 2
// Maximum number of jungle camp kills tracked per player (first clear only).
// A standard first clear is 6 camps for most paths (up to 8 with scuttle/leash).
const JUNGLE_FIRST_CLEAR_MAX_CAMPS = 10

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

/** Item pushed by the API producer and consumed for DB writes. */
export interface MatchIngestItem {
  matchId: string
  region: string
  matchDto: RiotMatchDto
  timelineDto?: RiotMatchTimelineDto
  puuidKeyVersion: string | null
  playerId: bigint
}

/**
 * Bounded async queue for producer/consumer. push() waits when full; pop() returns null when poisoned.
 * pushPoison(n) pushes n nulls so n consumers can exit.
 */
function createBoundedQueue<T>(maxSize: number): {
  push(item: T): Promise<void>
  pop(): Promise<T | null>
  pushPoison(consumerCount: number): void
} {
  const items: T[] = []
  const waiters: Array<() => void> = []
  const pushWaiters: Array<() => void> = []
  let poisoned = false
  let poisonToPush = 0

  return {
    async push(item: T): Promise<void> {
      if (poisoned) return
      while (items.length >= maxSize) {
        await new Promise<void>((r) => pushWaiters.push(r))
      }
      if (poisoned) return
      items.push(item)
      if (waiters.length > 0) (waiters.shift()!)()
    },
    async pop(): Promise<T | null> {
      for (;;) {
        if (items.length > 0) {
          const value = items.shift()!
          if (pushWaiters.length > 0) (pushWaiters.shift()!)()
          return value
        }
        if (poisonToPush > 0) {
          poisonToPush--
          if (pushWaiters.length > 0) (pushWaiters.shift()!)()
          return null
        }
        if (poisoned && poisonToPush === 0) return null
        await new Promise<void>((r) => waiters.push(r))
      }
    },
    pushPoison(consumerCount: number): void {
      poisoned = true
      poisonToPush += consumerCount
      while (waiters.length > 0) (waiters.shift()!)()
    },
  }
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
 * Apply a PUUID update to a player, handling P2002 conflicts (mark as 'perdu').
 * Returns 'synced' | 'perdu' | 'throw'.
 */
async function applyPuuidUpdate(
  playerId: bigint,
  puuid: string,
  clefType: string,
  extraData?: Partial<{ tagName: string }>
): Promise<'synced' | 'perdu'> {
  try {
    await prisma.player.update({
      where: { id: playerId },
      data: { puuid, puuidKeyVersion: clefType, ...extraData },
    })
    return 'synced'
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      await prisma.player.update({ where: { id: playerId }, data: { puuidKeyVersion: 'perdu' } })
      return 'perdu'
    }
    throw e
  }
}

/**
 * Extract (gameName, tagLine) from a match participant, preferring the fields that Riot
 * includes directly in Match v5 responses (riotIdGameName / riotIdTagline / riotIdTagLine).
 */
function participantNames(part: RiotParticipantDto): { gn: string; tl: string } {
  const gn = (
    (part.riotIdGameName as string | undefined) ??
    (part.riotIdName as string | undefined) ??
    ''
  ).trim().toLowerCase()
  const tl = (
    (part.riotIdTagline as string | undefined) ??
    (part.riotIdTagLine as string | undefined) ??
    ''
  ).trim().toLowerCase()
  return { gn, tl }
}

/**
 * Phase 2: sync all players whose puuidKeyVersion != clefType (and != 'erreur').
 *
 * Strategy: instead of calling getAccountByRiotId() for every player (1 req/player), we first
 * look up matches already stored in our DB where those players participated. A single getMatch()
 * call covers up to 10 players at once via the riotIdGameName/riotIdTagline fields that Riot
 * includes in every participant entry. Only players we still can't resolve after match lookups
 * fall back to the individual getAccountByRiotId() call.
 */
async function runPhase2(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  clefType: string | null
): Promise<void> {
  if (!clefType) return
  await logger.step('Phase 2 start: sync players to current key (match-based)', { clefType })
  let totalSynced = 0
  let totalPerdu = 0
  let totalViaMatch = 0
  let totalViaRiotId = 0

  while (!state.shouldStop) {
    const batch = await prisma.player.findMany({
      where: {
        // NULL must be included explicitly — Prisma's notIn excludes NULL rows in SQL
        // Note: 'erreur' is kept in the exclusion list for backward-compat — those players are
        // handled by Phase 2b until they drain to zero.
        OR: [
          { puuidKeyVersion: null },
          { puuidKeyVersion: { notIn: ['erreur', 'perdu', clefType] } },
        ],
        gameName: { not: null },
        tagName: { not: null },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, gameName: true, tagName: true, puuid: true },
    })
    if (batch.length === 0) break

    // Build a lookup: "gamename#tagline" → player (for matching against match participants)
    const pendingByName = new Map<string, typeof batch[0]>()
    for (const p of batch) {
      const key = `${(p.gameName ?? '').trim().toLowerCase()}#${(p.tagName ?? '').trim().toLowerCase()}`
      if (key !== '#') pendingByName.set(key, p)
    }

    // ── Step 1: batch-resolve via existing match history in our DB ──────────
    const playerIds = batch.map(p => p.id)

    // Find which internal match IDs these players participated in, and count how many
    // pending players each match covers — prioritise the most-covering matches.
    const partRows = await prisma.participant.findMany({
      where: { playerId: { in: playerIds } },
      select: { matchId: true },
    })
    const matchCoverage = new Map<bigint, number>()
    for (const r of partRows) {
      matchCoverage.set(r.matchId, (matchCoverage.get(r.matchId) ?? 0) + 1)
    }
    const sortedInternalIds = [...matchCoverage.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)

    if (sortedInternalIds.length > 0) {
      // Fetch Riot match IDs and rebuild the coverage-ordered list
      const matchRows = await prisma.match.findMany({
        where: { id: { in: sortedInternalIds } },
        select: { id: true, matchId: true },
      })
      const internalToRiot = new Map(matchRows.map(m => [m.id, m.matchId]))
      // Preserve coverage order (most players covered first)
      const riotIds = sortedInternalIds
        .map(id => internalToRiot.get(id))
        .filter((id): id is string => id !== undefined)

      for (const riotMatchId of riotIds) {
        if (state.shouldStop || pendingByName.size === 0) break

        const matchRes = await client.getMatch(riotMatchId)
        setState({ requestCount: state.requestCount + 1 })
        if (!matchRes.ok) {
          if (matchRes.status === 429) setState({ error429Count: state.error429Count + 1 })
          continue
        }

        const participants = (matchRes.data.info?.participants ?? []) as RiotParticipantDto[]
        for (const part of participants) {
          if (!part.puuid) continue
          const { gn, tl } = participantNames(part)
          if (!gn || !tl) continue

          const key = `${gn}#${tl}`
          const player = pendingByName.get(key)
          if (!player) continue

          const result = await applyPuuidUpdate(player.id, part.puuid, clefType)
          pendingByName.delete(key)
          if (result === 'synced') { totalSynced++; totalViaMatch++ }
          else totalPerdu++
        }
      }
    }

    // ── Step 2: fallback — individual getAccountByRiotId for unresolved players ──
    for (const p of pendingByName.values()) {
      if (state.shouldStop) break
      const gameName = (p.gameName ?? '').trim()
      const tagLine = (p.tagName ?? '').trim()
      if (!gameName || !tagLine) continue

      const res = await client.getAccountByRiotId(gameName, tagLine)
      setState({ requestCount: state.requestCount + 1 })
      if (res.ok) {
        const result = await applyPuuidUpdate(p.id, res.data.puuid, clefType)
        if (result === 'synced') { totalSynced++; totalViaRiotId++ }
        else totalPerdu++
        continue
      }
      if (res.status === 429) setState({ error429Count: state.error429Count + 1 })

      // Fallback: same gameName but with tagLine = 'EUW'
      const resEuw = await client.getAccountByRiotId(gameName, 'EUW')
      setState({ requestCount: state.requestCount + 1 })
      if (resEuw.ok) {
        const result = await applyPuuidUpdate(p.id, resEuw.data.puuid, clefType, { tagName: 'EUW' })
        if (result === 'synced') { totalSynced++; totalViaRiotId++ }
        else totalPerdu++
        continue
      }

      // Last resort: fetch the player's most recent match from Riot and scan participants by name.
      // If found → update PUUID. If not → mark 'perdu' immediately (no intermediate 'erreur' state).
      const matchIdsRes = await client.getMatchIdsByPuuid(p.puuid, { queue: 420, count: 1 })
      setState({ requestCount: state.requestCount + 1 })
      if (!matchIdsRes.ok) {
        if (matchIdsRes.status === 429) setState({ error429Count: state.error429Count + 1 })
        // On 429 we skip without marking perdu (will be retried next loop iteration)
        else { await prisma.player.update({ where: { id: p.id }, data: { puuidKeyVersion: 'perdu' } }); totalPerdu++ }
        continue
      }
      const riotMatchIds = Array.isArray(matchIdsRes.data) ? matchIdsRes.data : []
      if (!riotMatchIds[0]) {
        await prisma.player.update({ where: { id: p.id }, data: { puuidKeyVersion: 'perdu' } })
        totalPerdu++
        continue
      }
      const lastMatchRes = await client.getMatch(riotMatchIds[0])
      setState({ requestCount: state.requestCount + 1 })
      if (!lastMatchRes.ok) {
        if (lastMatchRes.status === 429) setState({ error429Count: state.error429Count + 1 })
        continue
      }
      const lastMatchParts = (lastMatchRes.data.info?.participants ?? []) as RiotParticipantDto[]
      let foundViaRiotHistory = false
      for (const part of lastMatchParts) {
        if (!part.puuid) continue
        const { gn, tl } = participantNames(part)
        if (!gn || !tl) continue
        if (gn === gameName.toLowerCase() && tl === tagLine.toLowerCase()) {
          const result = await applyPuuidUpdate(p.id, part.puuid, clefType)
          if (result === 'synced') { totalSynced++; totalViaRiotId++ }
          else totalPerdu++
          foundViaRiotHistory = true
          break
        }
      }
      if (!foundViaRiotHistory) {
        await prisma.player.update({ where: { id: p.id }, data: { puuidKeyVersion: 'perdu' } })
        totalPerdu++
      }
    }
  }
  await logger.step('Phase 2 end', { totalSynced, totalPerdu, totalViaMatch, totalViaRiotId })
}

/**
 * Phase 2b: recover players with puuidKeyVersion='erreur' via match history.
 *
 * Optimisation: riotIdGameName/riotIdTagline are already present in Match v5 participant data, so
 * we no longer need to call getAccountByPuuid() for each of the 10 participants (saves up to 10
 * requests per match). We also check our own DB first to avoid a getMatchIdsByPuuid() call when
 * we already have a match stored for that player.
 *
 * If still unresolvable → marks as 'perdu' (excluded from all future processing).
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
      const gameNameNorm = (player.gameName ?? '').trim().toLowerCase()
      const tagLineNorm = (player.tagName ?? '').trim().toLowerCase()

      // ── Try to find a match in our own DB first (avoids getMatchIdsByPuuid call) ──
      let riotMatchId: string | null = null
      const localPart = await prisma.participant.findFirst({
        where: { playerId: player.id },
        select: { match: { select: { matchId: true } } },
        orderBy: { id: 'desc' },
      })
      if (localPart?.match?.matchId) {
        riotMatchId = localPart.match.matchId
      } else {
        // Fall back: ask Riot for the player's most recent match
        const matchIdsRes = await client.getMatchIdsByPuuid(player.puuid, { queue: 420, count: 1 })
        setState({ requestCount: state.requestCount + 1 })
        if (!matchIdsRes.ok) {
          if (matchIdsRes.status === 429) setState({ error429Count: state.error429Count + 1 })
          else {
            await prisma.player.update({ where: { id: player.id }, data: { puuidKeyVersion: 'perdu' } })
            totalLost++
          }
          continue
        }
        const ids = Array.isArray(matchIdsRes.data) ? matchIdsRes.data : []
        if (!ids[0]) {
          await prisma.player.update({ where: { id: player.id }, data: { puuidKeyVersion: 'perdu' } })
          totalLost++
          continue
        }
        riotMatchId = ids[0]
      }

      const matchRes = await client.getMatch(riotMatchId)
      setState({ requestCount: state.requestCount + 1 })
      if (!matchRes.ok) {
        if (matchRes.status === 429) setState({ error429Count: state.error429Count + 1 })
        continue
      }

      // Match participant data already contains riotIdGameName/riotIdTagline — no extra calls needed
      const participants = (matchRes.data.info?.participants ?? []) as RiotParticipantDto[]
      let found = false
      for (const part of participants) {
        if (!part.puuid) continue
        const { gn, tl } = participantNames(part)
        if (!gn || !tl) continue
        if (gn === gameNameNorm && tl === tagLineNorm) {
          const result = await applyPuuidUpdate(player.id, part.puuid, clefType)
          if (result === 'synced') totalRecovered++
          else totalLost++
          found = true
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

// ─── Normalisation helpers ────────────────────────────────────────────────────

function buildMatchTeamData(
  matchId: bigint,
  info: RiotMatchDto['info'],
  participantDtos: RiotParticipantDto[]
): Array<{
  teamRow: {
    matchId: bigint
    teamId: number
    win: boolean
    rankTier: string | null
    teamEarlySurrendered: boolean
    ban1: number | null
    ban2: number | null
    ban3: number | null
    ban4: number | null
    ban5: number | null
    baronKills: number
    dragonKills: number
    towerKills: number
    hordeKills: number
    riftHeraldKills: number
    inhibitorKills: number
    championKills: number
  }
  firstObjectives: Array<{ objectiveType: string }> // baron, dragon, tower, horde, rift_herald, inhibitor (champion/tower from participants)
  bans: Array<{ championId: number; pickOrder: number }>
}> {
  if (!info?.teams || info.teams.length === 0) return []
  const toBan = (team: { bans?: Array<{ championId?: number }> }, idx: number): number | null => {
    const champId = team.bans?.[idx]?.championId
    return typeof champId === 'number' && champId > 0 ? champId : null
  }
  const toFirst = (value: unknown): boolean => value === true
  const toKills = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

  // Pre-compute per-team aggregates from participants
  const teamEarlySurrendered = new Map<number, boolean>()
  const teamRankTier = new Map<number, string | null>()
  for (const p of participantDtos) {
    const tid = p.teamId ?? 0
    if (!tid) continue
    if ((p as { teamEarlySurrendered?: boolean }).teamEarlySurrendered === true) {
      teamEarlySurrendered.set(tid, true)
    }
    const tier = (p as { tier?: string }).tier ?? (p as { rankTier?: string }).rankTier ?? null
    if (tier && !teamRankTier.has(tid)) teamRankTier.set(tid, tier)
  }

  return info.teams
    .filter((t) => t.teamId === 100 || t.teamId === 200)
    .map((t) => {
      const obj = t.objectives ?? {}
      const championObj = (obj['champion'] ?? {}) as { first?: unknown; kills?: unknown }
      const baronObj = (obj['baron'] ?? {}) as { first?: unknown; kills?: unknown }
      const dragonObj = (obj['dragon'] ?? {}) as { first?: unknown; kills?: unknown }
      const towerObj = (obj['tower'] ?? {}) as { first?: unknown; kills?: unknown }
      const hordeObj = (obj['horde'] ?? {}) as { first?: unknown; kills?: unknown }
      const riftHeraldObj = (obj['riftHerald'] ?? {}) as { first?: unknown; kills?: unknown }
      const inhibitorObj = (obj['inhibitor'] ?? {}) as { first?: unknown; kills?: unknown }

      const teamBans = (t.bans ?? [])
        .filter((b, idx) => {
          const champId = b?.championId
          return typeof champId === 'number' && champId > 0 && idx < 5
        })
        .map((b, idx) => ({ championId: b.championId as number, pickOrder: idx + 1 }))

      const firstObjectives: Array<{ objectiveType: string }> = []
      if (toFirst(baronObj.first)) firstObjectives.push({ objectiveType: 'baron' })
      if (toFirst(dragonObj.first)) firstObjectives.push({ objectiveType: 'dragon' })
      if (toFirst(towerObj.first)) firstObjectives.push({ objectiveType: 'tower' })
      if (toFirst(hordeObj.first)) firstObjectives.push({ objectiveType: 'horde' })
      if (toFirst(riftHeraldObj.first)) firstObjectives.push({ objectiveType: 'rift_herald' })
      if (toFirst(inhibitorObj.first)) firstObjectives.push({ objectiveType: 'inhibitor' })
      if (toFirst(championObj.first)) firstObjectives.push({ objectiveType: 'champion' })

      return {
        teamRow: {
          matchId,
          teamId: t.teamId ?? 0,
          win: t.win === true,
          rankTier: teamRankTier.get(t.teamId ?? 0) ?? null,
          teamEarlySurrendered: teamEarlySurrendered.get(t.teamId ?? 0) === true,
          ban1: toBan(t, 0),
          ban2: toBan(t, 1),
          ban3: toBan(t, 2),
          ban4: toBan(t, 3),
          ban5: toBan(t, 4),
          baronKills: toKills(baronObj.kills),
          dragonKills: toKills(dragonObj.kills),
          towerKills: toKills(towerObj.kills),
          hordeKills: toKills(hordeObj.kills),
          riftHeraldKills: toKills(riftHeraldObj.kills),
          inhibitorKills: toKills(inhibitorObj.kills),
          championKills: toKills(championObj.kills),
        },
        bans: teamBans,
        firstObjectives,
      }
    })
}

/** Build normalised participant_items rows from JSON items array [itemId, ...]. */
function buildItemRows(
  participantId: bigint,
  matchId: bigint,
  items: unknown
): Array<{ participantId: bigint; matchId: bigint; itemId: number; itemSlot: number }> {
  if (!Array.isArray(items)) return []
  const rows: Array<{ participantId: bigint; matchId: bigint; itemId: number; itemSlot: number }> = []
  for (let slot = 0; slot < items.length && slot <= 6; slot++) {
    const itemId = Number(items[slot])
    if (Number.isFinite(itemId) && itemId > 0) {
      rows.push({ participantId, matchId, itemId, itemSlot: slot })
    }
  }
  return rows
}

/** Build normalised participant_runes rows from perks.styles array. */
function buildRuneRows(
  participantId: bigint,
  matchId: bigint,
  runes: unknown
): Array<{ participantId: bigint; matchId: bigint; perkId: number; slot: number; styleId: number; var1: number | null; var2: number | null; var3: number | null }> {
  const rows: Array<{ participantId: bigint; matchId: bigint; perkId: number; slot: number; styleId: number; var1: number | null; var2: number | null; var3: number | null }> = []
  const styles = (() => {
    if (!runes || typeof runes !== 'object') return []
    const r = runes as Record<string, unknown>
    if (Array.isArray(r['styles'])) return r['styles']
    if (Array.isArray(runes)) return runes as unknown[]
    return []
  })()
  for (const style of styles) {
    if (!style || typeof style !== 'object') continue
    const s = style as Record<string, unknown>
    const styleId = Number(s['id'])
    if (!Number.isFinite(styleId)) continue
    const selections = Array.isArray(s['selections']) ? s['selections'] : []
    for (let slot = 0; slot < selections.length; slot++) {
      const sel = selections[slot] as Record<string, unknown>
      if (!sel) continue
      const perkId = Number(sel['perk'])
      if (!Number.isFinite(perkId)) continue
      rows.push({
        participantId,
        matchId,
        perkId,
        slot,
        styleId,
        var1: Number.isFinite(Number(sel['var1'])) ? Number(sel['var1']) : null,
        var2: Number.isFinite(Number(sel['var2'])) ? Number(sel['var2']) : null,
        var3: Number.isFinite(Number(sel['var3'])) ? Number(sel['var3']) : null,
      })
    }
  }
  return rows
}

/** Build normalised participant_summoner_spells rows. */
function buildSummonerSpellRows(
  participantId: bigint,
  matchId: bigint,
  spells: unknown,
  summoner1Casts: number,
  summoner2Casts: number
): Array<{ participantId: bigint; matchId: bigint; spellId: number; spellSlot: number; casts: number }> {
  if (!Array.isArray(spells) || spells.length < 2) return []
  const rows: Array<{ participantId: bigint; matchId: bigint; spellId: number; spellSlot: number; casts: number }> = []
  const id1 = Number(spells[0])
  const id2 = Number(spells[1])
  if (Number.isFinite(id1) && id1 > 0) rows.push({ participantId, matchId, spellId: id1, spellSlot: 1, casts: summoner1Casts })
  if (Number.isFinite(id2) && id2 > 0) rows.push({ participantId, matchId, spellId: id2, spellSlot: 2, casts: summoner2Casts })
  return rows
}

/** Build normalised participant_spells rows (Q/W/E/R cast counts). */
function buildSpellRows(
  participantId: bigint,
  matchId: bigint,
  casts: [number, number, number, number]
): Array<{ participantId: bigint; matchId: bigint; spellSlot: number; casts: number }> {
  return casts.map((c, i) => ({ participantId, matchId, spellSlot: i + 1, casts: c }))
}

/** Build normalised participant_perks rows from stat_perks { defense, flex, offense }. */
function buildPerkRows(
  participantId: bigint,
  matchId: bigint,
  statPerks: unknown
): Array<{ participantId: bigint; matchId: bigint; perkId: number }> {
  if (!statPerks || typeof statPerks !== 'object') return []
  const sp = statPerks as Record<string, unknown>
  const rows: Array<{ participantId: bigint; matchId: bigint; perkId: number }> = []
  for (const key of ['defense', 'flex', 'offense'] as const) {
    const id = Number(sp[key])
    if (Number.isFinite(id) && id > 0) rows.push({ participantId, matchId, perkId: id })
  }
  return rows
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
  const participantDtos = info.participants as RiotParticipantDto[]
  const puuids = participantDtos.map((p) => p.puuid).filter(Boolean) as string[]
  const existingPlayers = await prisma.player.findMany({
    where: { puuid: { in: puuids } },
    select: { id: true, puuid: true, puuidKeyVersion: true },
  })
  const existingByPuuid = new Map(existingPlayers.map((p) => [p.puuid, p]))

  // Compute match-level rank from all participants
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

  // Aggregate surrender flags (BOOL_OR)
  const gameEndedInSurrender = participantDtos.some(
    (p) => (p as { gameEndedInSurrender?: boolean }).gameEndedInSurrender === true
  )
  const gameEndedInEarlySurrender = participantDtos.some(
    (p) => (p as { gameEndedInEarlySurrender?: boolean }).gameEndedInEarlySurrender === true
  )

  const match = await prisma.match.create({
    data: {
      matchId,
      gameVersion,
      gameDuration,
      rank: matchRank,
      gameEndedInSurrender,
      gameEndedInEarlySurrender,
    },
  })
  counters.matchesFetched++
  if (logger) await logger.info('DB: match created', { matchId })

  // Build match_teams + bans + first objectives (single source of truth in match_team_first_objectives)
  const teamDataItems = buildMatchTeamData(match.id, info, participantDtos)
  const matchTeamIdByTeamId = new Map<number, bigint>()
  for (const { teamRow, bans, firstObjectives } of teamDataItems) {
    const created = await prisma.matchTeam.create({ data: teamRow })
    matchTeamIdByTeamId.set(teamRow.teamId, created.id)
    if (bans.length > 0) {
      await prisma.ban.createMany({
        data: bans.map((b) => ({
          matchTeamId: created.id,
          matchId: match.id,
          championId: b.championId,
          pickOrder: b.pickOrder,
        })),
      })
    }
    // Insert "team got first" rows (participant_id null); champion/tower may get participant rows below from first blood/first tower
    if (firstObjectives.length > 0) {
      await prisma.matchTeamFirstObjective.createMany({
        data: firstObjectives.map((obj) => ({
          matchTeamId: created.id,
          objectiveType: obj.objectiveType,
          participantId: null,
          isKill: true,
        })),
        skipDuplicates: true,
      })
    }
  }

  // Collect unknown challenge keys seen across all participants (de-duped)
  const allUnknownKeys: Record<string, unknown> = {}

  for (const p of participantDtos) {
    const puuid = p.puuid
    if (!puuid) continue
    const existingPlayer = existingByPuuid.get(puuid)
    let playerId: bigint
    if (existingPlayer == null) {
      const newPlayer = await prisma.player.create({
        data: { puuid, region, puuidKeyVersion, gameName: null, tagName: null, lastSeen: null },
      })
      playerId = newPlayer.id
      existingByPuuid.set(puuid, { id: playerId, puuid, puuidKeyVersion })
      counters.playersFetched++
    } else {
      playerId = existingPlayer.id
      if (existingPlayer.puuidKeyVersion === 'perdu' && puuidKeyVersion) {
        await prisma.player.update({ where: { id: existingPlayer.id }, data: { puuidKeyVersion } })
        existingPlayer.puuidKeyVersion = puuidKeyVersion
      }
    }

    const role = roleFromPosition(p.individualPosition, p.teamPosition)
    const rankTier = (p as { tier?: string }).tier ?? (p as { rankTier?: string }).rankTier ?? null
    const rankDivision = (p as { rank?: string }).rank ?? (p as { rankDivision?: string }).rankDivision ?? null
    const rankLp = (p as { leaguePoints?: number }).leaguePoints ?? (p as { rankLp?: number }).rankLp ?? null

    // Legacy JSON blobs (kept for transition)
    const items = (p as { items?: unknown }).items ?? null
    const runes = (p as { perks?: unknown }).perks ?? (p as { runes?: unknown }).runes ?? null
    const summoner1Id = (p as { summoner1Id?: number }).summoner1Id ?? null
    const summoner2Id = (p as { summoner2Id?: number }).summoner2Id ?? null
    const summonerSpells = summoner1Id != null && summoner2Id != null ? [summoner1Id, summoner2Id] : null
    const statPerks = (() => {
      const perks = (p as { perks?: Record<string, unknown> }).perks
      if (perks && typeof perks === 'object' && 'statPerks' in perks) return perks['statPerks'] ?? null
      return (p as { statPerks?: unknown }).statPerks ?? null
    })()
    const challenges = (p as { challenges?: unknown }).challenges ?? null
    const summoner1Casts = (p as { summoner1Casts?: number }).summoner1Casts ?? 0
    const summoner2Casts = (p as { summoner2Casts?: number }).summoner2Casts ?? 0
    const spell1Casts = (p as { spell1Casts?: number }).spell1Casts ?? null
    const spell2Casts = (p as { spell2Casts?: number }).spell2Casts ?? null
    const spell3Casts = (p as { spell3Casts?: number }).spell3Casts ?? null
    const spell4Casts = (p as { spell4Casts?: number }).spell4Casts ?? null

    const participant = await prisma.participant.create({
      data: {
        playerId,
        matchId: match.id,
        teamId: p.teamId ?? null,
        championId: p.championId ?? 0,
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
        baronKills: (p as { baronKills?: number }).baronKills ?? null,
        consumablesPurchased: (p as { consumablesPurchased?: number }).consumablesPurchased ?? null,
        damageDealtToBuildings: (p as { damageDealtToBuildings?: number }).damageDealtToBuildings ?? null,
        damageDealtToEpicMonsters: (p as { damageDealtToEpicMonsters?: number }).damageDealtToEpicMonsters ?? null,
        damageDealtToObjectives: (p as { damageDealtToObjectives?: number }).damageDealtToObjectives ?? null,
        damageDealtToTurrets: (p as { damageDealtToTurrets?: number }).damageDealtToTurrets ?? null,
        damageSelfMitigated: (p as { damageSelfMitigated?: number }).damageSelfMitigated ?? null,
        doubleKills: (p as { doubleKills?: number }).doubleKills ?? null,
        dragonKills: (p as { dragonKills?: number }).dragonKills ?? null,
        goldSpent: (p as { goldSpent?: number }).goldSpent ?? null,
        inhibitorKills: (p as { inhibitorKills?: number }).inhibitorKills ?? null,
        inhibitorTakedowns: (p as { inhibitorTakedowns?: number }).inhibitorTakedowns ?? null,
        inhibitorsLost: (p as { inhibitorsLost?: number }).inhibitorsLost ?? null,
        itemsPurchased: (p as { itemsPurchased?: number }).itemsPurchased ?? null,
        killingSprees: (p as { killingSprees?: number }).killingSprees ?? null,
        largestCriticalStrike: (p as { largestCriticalStrike?: number }).largestCriticalStrike ?? null,
        largestKillingSpree: (p as { largestKillingSpree?: number }).largestKillingSpree ?? null,
        largestMultiKill: (p as { largestMultiKill?: number }).largestMultiKill ?? null,
        longestTimeSpentLiving: (p as { longestTimeSpentLiving?: number }).longestTimeSpentLiving ?? null,
        magicDamageDealt: (p as { magicDamageDealt?: number }).magicDamageDealt ?? null,
        magicDamageDealtToChampions: (p as { magicDamageDealtToChampions?: number }).magicDamageDealtToChampions ?? null,
        magicDamageTaken: (p as { magicDamageTaken?: number }).magicDamageTaken ?? null,
        neutralMinionsKilled: (p as { neutralMinionsKilled?: number }).neutralMinionsKilled ?? null,
        objectivesStolen: (p as { objectivesStolen?: number }).objectivesStolen ?? null,
        objectivesStolenAssists: (p as { objectivesStolenAssists?: number }).objectivesStolenAssists ?? null,
        pentaKills: (p as { pentaKills?: number }).pentaKills ?? null,
        physicalDamageDealt: (p as { physicalDamageDealt?: number }).physicalDamageDealt ?? null,
        physicalDamageDealtToChampions: (p as { physicalDamageDealtToChampions?: number }).physicalDamageDealtToChampions ?? null,
        physicalDamageTaken: (p as { physicalDamageTaken?: number }).physicalDamageTaken ?? null,
        placement: (p as { placement?: number }).placement ?? null,
        quadraKills: (p as { quadraKills?: number }).quadraKills ?? null,
        roleBoundItem: (p as { roleBoundItem?: number }).roleBoundItem ?? null,
        sightWardsBoughtInGame: (p as { sightWardsBoughtInGame?: number }).sightWardsBoughtInGame ?? null,
        timeCCingOthers: (p as { timeCCingOthers?: number }).timeCCingOthers ?? null,
        totalAllyJungleMinionsKilled: (p as { totalAllyJungleMinionsKilled?: number }).totalAllyJungleMinionsKilled ?? null,
        totalDamageDealt: (p as { totalDamageDealt?: number }).totalDamageDealt ?? null,
        totalDamageShieldedOnTeammates: (p as { totalDamageShieldedOnTeammates?: number }).totalDamageShieldedOnTeammates ?? null,
        totalDamageTaken: (p as { totalDamageTaken?: number }).totalDamageTaken ?? null,
        totalEnemyJungleMinionsKilled: (p as { totalEnemyJungleMinionsKilled?: number }).totalEnemyJungleMinionsKilled ?? null,
        totalHeal: (p as { totalHeal?: number }).totalHeal ?? null,
        totalHealsOnTeammates: (p as { totalHealsOnTeammates?: number }).totalHealsOnTeammates ?? null,
        totalTimeCCDealt: (p as { totalTimeCCDealt?: number }).totalTimeCCDealt ?? null,
        totalTimeSpentDead: (p as { totalTimeSpentDead?: number }).totalTimeSpentDead ?? null,
        totalUnitsHealed: (p as { totalUnitsHealed?: number }).totalUnitsHealed ?? null,
        tripleKills: (p as { tripleKills?: number }).tripleKills ?? null,
        trueDamageDealt: (p as { trueDamageDealt?: number }).trueDamageDealt ?? null,
        trueDamageDealtToChampions: (p as { trueDamageDealtToChampions?: number }).trueDamageDealtToChampions ?? null,
        trueDamageTaken: (p as { trueDamageTaken?: number }).trueDamageTaken ?? null,
        turretKills: (p as { turretKills?: number }).turretKills ?? null,
        turretTakedowns: (p as { turretTakedowns?: number }).turretTakedowns ?? null,
        turretsLost: (p as { turretsLost?: number }).turretsLost ?? null,
        unrealKills: (p as { unrealKills?: number }).unrealKills ?? null,
        visionWardsBoughtInGame: (p as { visionWardsBoughtInGame?: number }).visionWardsBoughtInGame ?? null,
        wardsKilled: (p as { wardsKilled?: number }).wardsKilled ?? null,
        wardsPlaced: (p as { wardsPlaced?: number }).wardsPlaced ?? null,
        summoner1Casts,
        summoner2Casts,
        spell1Casts,
        spell2Casts,
        spell3Casts,
        spell4Casts,
        // Legacy JSON blobs — also written to normalised tables below
        items: items as Prisma.InputJsonValue ?? Prisma.JsonNull,
        runes: runes as Prisma.InputJsonValue ?? Prisma.JsonNull,
        summonerSpells: summonerSpells as Prisma.InputJsonValue ?? Prisma.JsonNull,
        statPerks: statPerks as Prisma.InputJsonValue ?? Prisma.JsonNull,
        challenges: challenges as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    })
    counters.participantsFetched++

    // First blood / first tower: single source of truth in match_team_first_objectives
    const teamId = p.teamId ?? 0
    const matchTeamId = teamId ? matchTeamIdByTeamId.get(teamId) : undefined
    if (matchTeamId) {
      const firstObjRows: Array<{
        matchTeamId: bigint
        objectiveType: string
        participantId: bigint
        isKill: boolean
      }> = []
      const px = p as {
        firstBloodKill?: boolean
        firstBloodAssist?: boolean
        firstTowerKill?: boolean
        firstTowerAssist?: boolean
      }
      if (px.firstBloodKill)
        firstObjRows.push({
          matchTeamId,
          objectiveType: 'champion',
          participantId: participant.id,
          isKill: true,
        })
      if (px.firstBloodAssist)
        firstObjRows.push({
          matchTeamId,
          objectiveType: 'champion',
          participantId: participant.id,
          isKill: false,
        })
      if (px.firstTowerKill)
        firstObjRows.push({
          matchTeamId,
          objectiveType: 'tower',
          participantId: participant.id,
          isKill: true,
        })
      if (px.firstTowerAssist)
        firstObjRows.push({
          matchTeamId,
          objectiveType: 'tower',
          participantId: participant.id,
          isKill: false,
        })
      if (firstObjRows.length > 0) {
        await prisma.matchTeamFirstObjective.createMany({ data: firstObjRows, skipDuplicates: true })
      }
    }

    // ── Normalised double-writes ─────────────────────────────────────────────

    const pid = participant.id
    const mid = match.id

    // participant_items
    const itemRows = buildItemRows(pid, mid, items)
    if (itemRows.length > 0) await prisma.participantItem.createMany({ data: itemRows })

    // participant_runes
    const runeRows = buildRuneRows(pid, mid, runes)
    if (runeRows.length > 0) await prisma.participantRune.createMany({ data: runeRows })

    // participant_summoner_spells
    const ssRows = buildSummonerSpellRows(pid, mid, summonerSpells, summoner1Casts, summoner2Casts)
    if (ssRows.length > 0) {
      await prisma.participantSummonerSpell.createMany({ data: ssRows, skipDuplicates: true })
    }

    // participant_spells (Q/W/E/R)
    if (spell1Casts != null || spell2Casts != null || spell3Casts != null || spell4Casts != null) {
      const spellRows = buildSpellRows(pid, mid, [
        spell1Casts ?? 0,
        spell2Casts ?? 0,
        spell3Casts ?? 0,
        spell4Casts ?? 0,
      ])
      await prisma.participantSpell.createMany({ data: spellRows, skipDuplicates: true })
    }

    // participant_perks
    const perkRows = buildPerkRows(pid, mid, statPerks)
    if (perkRows.length > 0) await prisma.participantPerk.createMany({ data: perkRows })

    // challenge columns on participant (filtered by allowlist)
    if (challenges && typeof challenges === 'object' && !Array.isArray(challenges)) {
      const { allowed, unknown } = partitionChallenges(challenges as Record<string, unknown>)
      if (allowed.length > 0) {
        const challengeData = allowedToParticipantChallengeData(allowed)
        await prisma.participant.update({
          where: { id: pid },
          data: challengeData,
        })
      }
      for (const [k, v] of Object.entries(unknown)) {
        allUnknownKeys[k] = v
      }
    }
  }

  if (logger) await logger.info('DB: participants created', { matchId, count: participantDtos.length })

  // Fire-and-forget: register unknown challenge keys + Discord notify
  void handleUnknownChallengeKeys(allUnknownKeys)
}

/**
 * Extract jungle first-clear path order from a timeline and persist it.
 * One row per camp kill, ordered by kill sequence (orderIndex 0, 1, 2, …).
 * Only populates rows for participants with role='JUNGLE'. Capped at JUNGLE_FIRST_CLEAR_MAX_CAMPS.
 * Idempotent: uses skipDuplicates (ON CONFLICT DO NOTHING on the unique index).
 *
 * Source: participantFrames[riotPid].jungleMinionsKilled per frame.
 * Resolution: 1 frame = 1 min, so kills within the same minute share the same timestampMs.
 */
async function extractAndInsertJungleFirstClear(
  matchDbId: bigint,
  riotMatchId: string,
  timeline: RiotMatchTimelineDto,
  logger?: ReturnType<typeof createRiotPollerLogger>
): Promise<void> {
  const frames = timeline.info?.frames
  if (!frames?.length) return

  // Find participants with role JUNGLE for this match (DB id mapped from Riot participantId 1–10).
  const dbParticipants = await prisma.participant.findMany({
    where: { matchId: matchDbId, role: 'JUNGLE' },
    select: { id: true, matchId: true },
  })
  if (dbParticipants.length === 0) return

  // Build a map riotParticipantId (1–10) → DB participantId.
  // The Riot timeline lists participants in metadata in order (index 0 = riotPid 1, …).
  // We resolve via participantFrames key which IS the riotParticipantId as a string.
  // We match DB participants by join order: participants are stored in insertion order
  // (participantId 1-5 = team 100, 6-10 = team 200). Query by matchId ordered by id.
  const allMatchParticipants = await prisma.participant.findMany({
    where: { matchId: matchDbId },
    select: { id: true, role: true },
    orderBy: { id: 'asc' },
  })
  // riotParticipantId is 1-indexed; map index (0-based) + 1 → DB id
  const riotPidToDbId = new Map<number, bigint>()
  for (let i = 0; i < allMatchParticipants.length; i++) {
    riotPidToDbId.set(i + 1, allMatchParticipants[i].id)
  }

  // Build set of riotPids that are junglers
  const junglerDbIds = new Set(dbParticipants.map((p) => p.id))
  const junglerRiotPids = new Set<number>()
  for (const [riotPid, dbId] of riotPidToDbId) {
    if (junglerDbIds.has(dbId)) junglerRiotPids.add(riotPid)
  }
  if (junglerRiotPids.size === 0) return

  // Per-jungler state: previous jungleMinionsKilled and current orderIndex
  const prevKills = new Map<number, number>()
  const orderIdx = new Map<number, number>()
  const done = new Set<number>()
  for (const riotPid of junglerRiotPids) {
    prevKills.set(riotPid, 0)
    orderIdx.set(riotPid, 0)
  }

  const rows: Array<{ participantId: bigint; matchId: bigint; orderIndex: number; timestampMs: number }> = []

  for (const frame of frames) {
    const ts = frame.timestamp ?? 0
    for (const riotPid of junglerRiotPids) {
      if (done.has(riotPid)) continue
      const frameData = frame.participantFrames?.[String(riotPid)]
      if (!frameData) continue
      const curr = frameData.jungleMinionsKilled ?? 0
      const prev = prevKills.get(riotPid) ?? 0
      if (curr > prev) {
        const dbId = riotPidToDbId.get(riotPid)
        if (dbId == null) continue
        const newKills = curr - prev
        for (let k = 0; k < newKills; k++) {
          const idx = (orderIdx.get(riotPid) ?? 0)
          rows.push({ participantId: dbId, matchId: matchDbId, orderIndex: idx, timestampMs: ts })
          orderIdx.set(riotPid, idx + 1)
          if ((orderIdx.get(riotPid) ?? 0) >= JUNGLE_FIRST_CLEAR_MAX_CAMPS) {
            done.add(riotPid)
            break
          }
        }
        prevKills.set(riotPid, curr)
      }
    }
    // Stop early if all junglers have reached the cap
    if (done.size === junglerRiotPids.size) break
  }

  if (rows.length === 0) return

  await prisma.participantJungleFirstClear.createMany({ data: rows, skipDuplicates: true })
  if (logger) {
    await logger.info('DB: jungle first clear inserted', { matchId: riotMatchId, rows: rows.length })
  }
}

/** Ward and trinket item IDs excluded when detecting the starter item purchase. */
const WARD_ITEM_IDS = new Set([2055, 3340, 3363, 3364])

/**
 * Extract and persist drake kills, dragon soul, skill level-up order, and starter items
 * from a match timeline.
 * Idempotent via skipDuplicates / updateMany.
 */
async function extractAndInsertTimelineExtras(
  matchDbId: bigint,
  riotMatchId: string,
  timeline: RiotMatchTimelineDto,
  logger?: ReturnType<typeof createRiotPollerLogger>
): Promise<void> {
  const frames = timeline.info?.frames
  if (!frames?.length) return

  // Build riotParticipantId (1–10) → DB participant.id
  const allMatchParticipants = await prisma.participant.findMany({
    where: { matchId: matchDbId },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  const riotPidToDbId = new Map<number, bigint>()
  for (let i = 0; i < allMatchParticipants.length; i++) {
    riotPidToDbId.set(i + 1, allMatchParticipants[i].id)
  }

  // Build Riot teamId (100/200) → DB match_team.id
  const matchTeams = await prisma.matchTeam.findMany({
    where: { matchId: matchDbId },
    select: { id: true, teamId: true },
  })
  const matchTeamIdByTeamId = new Map<number, bigint>()
  for (const t of matchTeams) matchTeamIdByTeamId.set(t.teamId, t.id)

  // Collect all events in chronological order
  const allEvents: Array<{ type: string; [key: string]: unknown }> = []
  for (const frame of frames) {
    if (frame.events) {
      for (const ev of frame.events) allEvents.push(ev as (typeof allEvents)[number])
    }
  }

  // ── 1 + 2. Drake kills (ELITE_MONSTER_KILL) + soul (DRAGON_SOUL_GIVEN) ────
  // Intermediate: per-team ordered list of {drakeType, order, soul?}
  type DrakeEntry = { drakeType: string; order: number; matchTeamId: bigint; soul: string | null }
  const drakesByTeam = new Map<number, DrakeEntry[]>()
  let globalDrakeOrder = 1

  for (const ev of allEvents) {
    if (ev.type === 'ELITE_MONSTER_KILL') {
      const e = ev as unknown as RiotTimelineEventEliteMonsterKill
      if (e.monsterType !== 'DRAGON') continue
      const teamId = e.killerTeamId
      if (!teamId) continue
      const matchTeamId = matchTeamIdByTeamId.get(teamId)
      if (!matchTeamId) continue
      const drakeType = e.monsterSubType ?? 'DRAGON'
      if (!drakesByTeam.has(teamId)) drakesByTeam.set(teamId, [])
      drakesByTeam.get(teamId)!.push({ drakeType, order: globalDrakeOrder, matchTeamId, soul: null })
      globalDrakeOrder++
      continue
    }
    if (ev.type === 'DRAGON_SOUL_GIVEN') {
      const e = ev as unknown as RiotTimelineEventDragonSoulGiven
      const teamRows = drakesByTeam.get(e.teamId)
      if (!teamRows?.length) continue
      // Mark soul on the last drake of this team
      teamRows[teamRows.length - 1].soul = e.name
    }
  }

  const drakeInsertRows: Array<{
    matchId: bigint; matchTeamId: bigint; drakeType: string; order: number; soul: string | null
  }> = []
  for (const rows of drakesByTeam.values()) {
    for (const r of rows) {
      drakeInsertRows.push({ matchId: matchDbId, matchTeamId: r.matchTeamId, drakeType: r.drakeType, order: r.order, soul: r.soul })
    }
  }
  if (drakeInsertRows.length > 0) {
    await prisma.matchTeamDrake.createMany({ data: drakeInsertRows, skipDuplicates: true })
  }

  // ── 3. Skill level-up order (SKILL_LEVEL_UP) ────────────────────────────────
  const skillOrderCounters = new Map<bigint, number>() // dbParticipantId → next 1-based order
  const spellOrderRows: Array<{
    participantId: bigint; matchId: bigint; spellSlot: number; order: number; timestampMs: number
  }> = []

  for (const ev of allEvents) {
    if (ev.type !== 'SKILL_LEVEL_UP') continue
    const e = ev as unknown as RiotTimelineEventSkillLevelUp
    const dbId = riotPidToDbId.get(e.participantId)
    if (!dbId) continue
    const order = (skillOrderCounters.get(dbId) ?? 0) + 1
    skillOrderCounters.set(dbId, order)
    spellOrderRows.push({ participantId: dbId, matchId: matchDbId, spellSlot: e.skillSlot, order, timestampMs: e.timestamp })
  }
  if (spellOrderRows.length > 0) {
    await prisma.participantSpellOrder.createMany({ data: spellOrderRows, skipDuplicates: true })
  }

  // ── 4. Starter item: first non-ward/trinket ITEM_PURCHASED per participant ──
  const starterItemByPid = new Map<bigint, number>() // dbParticipantId → first item id

  for (const ev of allEvents) {
    if (ev.type !== 'ITEM_PURCHASED') continue
    const e = ev as unknown as RiotTimelineEventItemPurchased
    const dbId = riotPidToDbId.get(e.participantId)
    if (!dbId) continue
    if (starterItemByPid.has(dbId)) continue
    if (WARD_ITEM_IDS.has(e.itemId)) continue
    starterItemByPid.set(dbId, e.itemId)
  }

  for (const [dbParticipantId, itemId] of starterItemByPid) {
    await prisma.participantItem.updateMany({
      where: { participantId: dbParticipantId, itemId },
      data: { starter: true },
    })
  }

  if (logger) {
    await logger.info('DB: timeline extras inserted', {
      matchId: riotMatchId,
      drakes: drakeInsertRows.length,
      spellOrders: spellOrderRows.length,
      starters: starterItemByPid.size,
    })
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

  const queue = createBoundedQueue<MatchIngestItem>(INGEST_QUEUE_SIZE)
  const flags = { foundPrismaError: false }

  const runConsumer = async (): Promise<void> => {
    for (;;) {
      const item = await queue.pop()
      if (item === null) return
      try {
        await upsertMatchAndParticipants(
          item.region,
          item.matchDto,
          item.puuidKeyVersion,
          counters,
          logger
        )
        const matchRow = await prisma.match.findUnique({
          where: { matchId: item.matchId },
          select: { id: true, createdAt: true },
        })
        if (matchRow) {
          if (item.timelineDto) {
            try {
              await extractAndInsertJungleFirstClear(
                matchRow.id,
                item.matchId,
                item.timelineDto,
                logger
              )
              await extractAndInsertTimelineExtras(
                matchRow.id,
                item.matchId,
                item.timelineDto,
                logger
              )
            } catch {
              // Non-fatal: timeline parse error
            }
          }
          const player = await prisma.player.findUnique({
            where: { id: item.playerId },
            select: { lastSeen: true },
          })
          const candidate = matchRow.createdAt
          const next =
            !player?.lastSeen || candidate > player.lastSeen ? candidate : player.lastSeen
          await prisma.player.update({
            where: { id: item.playerId },
            data: { lastSeen: next },
          })
        }
      } catch (err) {
        await logger.error('Prisma error upserting match', err)
        flags.foundPrismaError = true
      }
    }
  }

  const consumerPromises = Array.from({ length: INGEST_CONSUMER_COUNT }, () => runConsumer())

  for (const player of players) {
    if (state.shouldStop) {
      queue.pushPoison(INGEST_CONSUMER_COUNT)
      await Promise.all(consumerPromises)
      return 'ok'
    }

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
        queue.pushPoison(INGEST_CONSUMER_COUNT)
        await Promise.all(consumerPromises)
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

    let found400Decrypt = false
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
      let timelineDto: RiotMatchTimelineDto | undefined
      try {
        const timelineRes = await client.getMatchTimeline(matchId)
        counters.requestCount++
        if (!timelineRes.ok && timelineRes.status === 429) counters.error429Count++
        if (timelineRes.ok) timelineDto = timelineRes.data
      } catch {
        // Non-fatal: push without timeline
      }
      await queue.push({
        matchId,
        region,
        matchDto: matchRes.data,
        timelineDto,
        puuidKeyVersion,
        playerId: player.id,
      })
    })

    await runWithConcurrency(fetchTasks, MATCH_FETCH_CONCURRENCY)
    if (found400Decrypt) {
      queue.pushPoison(INGEST_CONSUMER_COUNT)
      await Promise.all(consumerPromises)
      return '400_decrypt'
    }
  }

  queue.pushPoison(INGEST_CONSUMER_COUNT)
  await Promise.all(consumerPromises)
  return flags.foundPrismaError ? 'prisma_error' : 'ok'
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

/**
 * Phase 3b: backfill timeline-derived data for matches that were ingested before we stored
 * drakes, skill order, starter items, and jungle first clear.
 * Idempotent: uses skipDuplicates / updateMany. Runs one batch per call.
 */
async function runStep3bBackfillTimeline(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>
): Promise<number> {
  const matches = await prisma.match.findMany({
    where: {
      matchTeams: { some: {} },
      OR: [
        { matchTeams: { every: { drakes: { none: {} } } } },
        { participants: { every: { participantSpellOrders: { none: {} } } } },
      ],
    },
    take: BATCH_TIMELINE_BACKFILL,
    orderBy: { createdAt: 'desc' },
    select: { id: true, matchId: true },
  })
  if (matches.length === 0) return 0

  let done = 0
  for (const m of matches) {
    if (state.shouldStop) break
    const platform = m.matchId.startsWith('EUN1_') ? 'eun1' : 'euw1'
    client.setPlatform(platform)
    const timelineRes = await client.getMatchTimeline(m.matchId)
    setState({ requestCount: state.requestCount + 1 })
    if (!timelineRes.ok) {
      if (timelineRes.status === 429) setState({ error429Count: state.error429Count + 1 })
      continue
    }
    try {
      await extractAndInsertJungleFirstClear(m.id, m.matchId, timelineRes.data, logger)
      await extractAndInsertTimelineExtras(m.id, m.matchId, timelineRes.data, logger)
      done++
    } catch (err) {
      void logger.error('Timeline backfill failed', err, { matchId: m.matchId })
    }
  }
  if (done > 0) {
    await logger.step('Phase 3b: timeline backfill batch', { processed: done, batchSize: matches.length })
  }
  return done
}

/**
 * Phase 3b: run timeline backfill until no more matches missing timeline data or shouldStop.
 * Includes matches missing drakes OR missing participant_spell_orders.
 */
async function runPhase3b(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>
): Promise<void> {
  await logger.step('Phase 3b start: backfill timeline data (drakes, skill order, starter, jungle first clear)', {})
  let total = 0
  while (!state.shouldStop) {
    const done = await runStep3bBackfillTimeline(client, logger)
    total += done
    if (done === 0) break
  }
  await logger.step('Phase 3b end', { totalTimelineBackfilled: total })
}

/**
 * Phase 3c: backfill participant_runes from match detail (perks) for matches that have no runes.
 * One batch per call.
 */
async function runStep3cBackfillRunes(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>
): Promise<number> {
  const matches = await prisma.match.findMany({
    where: {
      matchTeams: { some: {} },
      participants: { some: {}, every: { participantRunes: { none: {} } } },
    },
    take: BATCH_RUNE_BACKFILL,
    orderBy: { createdAt: 'desc' },
    select: { id: true, matchId: true },
  })
  if (matches.length === 0) return 0

  let done = 0
  for (const m of matches) {
    if (state.shouldStop) break
    const platform = m.matchId.startsWith('EUN1_') ? 'eun1' : 'euw1'
    client.setPlatform(platform)
    const matchRes = await client.getMatch(m.matchId)
    setState({ requestCount: state.requestCount + 1 })
    if (!matchRes.ok) {
      if (matchRes.status === 429) setState({ error429Count: state.error429Count + 1 })
      continue
    }
    const participantDtos = (matchRes.data.info?.participants ?? []) as RiotParticipantDto[]
    if (participantDtos.length === 0) continue

    const dbParticipants = await prisma.participant.findMany({
      where: { matchId: m.id },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    if (dbParticipants.length !== participantDtos.length) continue

    await prisma.participantRune.deleteMany({ where: { matchId: m.id } })

    for (let i = 0; i < dbParticipants.length; i++) {
      const runes = (participantDtos[i] as { perks?: unknown }).perks ?? (participantDtos[i] as { runes?: unknown }).runes ?? null
      const rows = buildRuneRows(dbParticipants[i].id, m.id, runes)
      if (rows.length > 0) {
        await prisma.participantRune.createMany({ data: rows })
      }
    }
    done++
  }
  if (done > 0) {
    await logger.step('Phase 3c: rune backfill batch', { processed: done, batchSize: matches.length })
  }
  return done
}

/**
 * Phase 3c: run rune backfill until no more matches missing runes or shouldStop.
 */
async function runPhase3c(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>
): Promise<void> {
  await logger.step('Phase 3c start: backfill participant_runes from match detail', {})
  let total = 0
  while (!state.shouldStop) {
    const done = await runStep3cBackfillRunes(client, logger)
    total += done
    if (done === 0) break
  }
  await logger.step('Phase 3c end', { totalRuneBackfilled: total })
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

    // ── Phase 3b: backfill timeline data (drakes, soul, skill order, starter, jungle first clear) ──
    await runPhase3b(client, logger)

    // ── Phase 3c: backfill participant_runes from match detail (perks) ─────────────────────────
    await runPhase3c(client, logger)

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
