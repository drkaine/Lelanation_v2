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
import { rankToScore, scoreToRank } from '../utils/rankScore.js'
import { partitionChallenges, handleUnknownChallengeKeys } from '../services/ChallengeNormalisationService.js'
import { aggregatePendingMatches, runPatchCleanupFromConfig } from '../services/StatsAggregationService.js'

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

/**
 * Returns true if backfill (phase 3) is needed.
 * The new schema stores rankTier directly on MatchPlayer (default 'UNRANKED').
 * We only check for players needing PUUID sync — rank/role are now always set at ingestion time.
 */
async function hasMissingBackfillData(clefType: string | null): Promise<boolean> {
  if (!clefType) return false
  const playersToSync = await prisma.player.count({
    where: {
      OR: [
        { puuidKeyVersion: null },
        { puuidKeyVersion: { notIn: ['perdu', clefType] } },
        { gameName: null, puuidKeyVersion: clefType },
      ],
    },
  })
  return playersToSync > 0
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
 * Phase 2: sync all players whose puuidKeyVersion != clefType (includes 'erreur' and null).
 *
 * Strategy: positional matching against existing match history in our DB.
 * DB participants are stored in insertion order (= Riot response order), so
 * dbParticipant[i] ↔ riotParticipant[i] for the same match. One getMatch() call
 * resolves up to 10 players and also backfills role, challenges, and runes.
 *
 * No fallback API calls (getAccountByRiotId etc.). Players with no match history
 * or whose PUUID conflicts with an existing row get puuid = String(player.id)
 * as a placeholder (will be overwritten on their next real match in Phase 4).
 *
 * Accepts an optional shouldStop function (defaults to the module-level state flag).
 * This allows the puuid migration script to call this function with its own stop control.
 */
export async function runPhase2(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  clefType: string | null,
  shouldStop: () => boolean = () => state.shouldStop
): Promise<void> {
  if (!clefType) return
  await logger.step('Phase 2 start: sync players to current key (positional match-based)', { clefType })
  let totalSynced = 0
  let totalPlaceholder = 0

  while (!shouldStop()) {
    // Include 'erreur' players and players with missing gameName (Match-v5 replaces Account-v1)
    const batch: { id: bigint; puuidKeyVersion: string | null }[] = await prisma.player.findMany({
      where: {
        OR: [
          { puuidKeyVersion: null },
          { puuidKeyVersion: { notIn: ['perdu', clefType] } },
          { gameName: null, puuidKeyVersion: clefType },
        ],
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, puuidKeyVersion: true },
    })
    if (batch.length === 0) break

    const playerIds: bigint[] = batch.map(p => p.id)
    const pendingIds = new Set(playerIds)

    // Find matches where these players participated, prioritise highest coverage
    const partRows = await prisma.matchPlayer.findMany({
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
      const matchRows = await prisma.match.findMany({
        where: { id: { in: sortedInternalIds } },
        select: { id: true, riotMatchId: true },
      })
      const internalToRiot = new Map(matchRows.map(m => [m.id, m.riotMatchId]))

      for (const internalId of sortedInternalIds) {
        if (shouldStop() || pendingIds.size === 0) break
        const riotMatchId = internalToRiot.get(internalId)
        if (!riotMatchId) continue

        const matchRes = await client.getMatch(riotMatchId)
        setState({ requestCount: state.requestCount + 1 })
        if (!matchRes.ok) {
          if (matchRes.status === 429) setState({ error429Count: state.error429Count + 1 })
          continue
        }

        // Positional matching: DB match_players ordered by id == Riot insertion order
        const dbMatchPlayers = await prisma.matchPlayer.findMany({
          where: { matchId: internalId },
          select: { id: true, playerId: true },
          orderBy: { id: 'asc' },
        })
        const riotParticipants = (matchRes.data.info?.participants ?? []) as RiotParticipantDto[]
        if (dbMatchPlayers.length !== riotParticipants.length) continue

        for (let i = 0; i < dbMatchPlayers.length; i++) {
          const dbPart = dbMatchPlayers[i]
          const riotPart = riotParticipants[i]
          const playerId = dbPart.playerId
          if (!pendingIds.has(playerId) || !riotPart.puuid) continue

          const { gn, tl } = participantNames(riotPart)
          try {
            await prisma.player.update({
              where: { id: playerId },
              data: {
                puuid: riotPart.puuid,
                puuidKeyVersion: clefType,
                ...(gn ? { gameName: gn } : {}),
                ...(tl ? { tagName: tl } : {}),
              },
            })
            pendingIds.delete(playerId)
            totalSynced++
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
              // PUUID already taken by another player row — use id as placeholder
              await prisma.player.update({
                where: { id: playerId },
                data: { puuid: String(playerId), puuidKeyVersion: clefType },
              })
              pendingIds.delete(playerId)
              totalPlaceholder++
            } else {
              throw e
            }
          }
        }
      }
    }

    // Players with no match history or still unresolved:
    // → placeholder PUUID only for those needing PUUID migration (not just gameName refresh)
    for (const playerId of pendingIds) {
      const player = batch.find(b => b.id === playerId)!
      if (player.puuidKeyVersion !== clefType) {
        await prisma.player.update({
          where: { id: playerId },
          data: { puuid: String(playerId), puuidKeyVersion: clefType },
        })
        totalPlaceholder++
      }
      // else: already on correct key, gameName will be populated when they next appear in Phase 4
    }
  }

  await logger.step('Phase 2 end', { totalSynced, totalPlaceholder })
}


async function runStep3FixNulls(
  _client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  counters: { matchesRankFixed: number; participantsRankFixed: number; participantsRoleFixed: number },
  _clefType: string | null
): Promise<void> {
  await logger.step('Step 3 start', {})
  // In new schema, rank/role are always set at ingestion time — nothing to backfill.
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
    team: number
    win: boolean
    teamEarlySurrendered: boolean
    baronKills: number
    baronFirst: boolean
    dragonKills: number
    dragonFirst: boolean
    towerKills: number
    towerFirst: boolean
    hordeKills: number
    hordeFirst: boolean
    riftHeraldKills: number
    riftHeraldFirst: boolean
    inhibitorKills: number
    championKills: number
    firstBlood: boolean
    elderKills: number
  }
  bans: Array<{ championId: number; pickOrder: number }>
}> {
  if (!info?.teams || info.teams.length === 0) return []
  const toFirst = (value: unknown): boolean => value === true
  const toKills = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

  // Pre-compute per-team teamEarlySurrendered from participants
  const teamEarlySurrendered = new Map<number, boolean>()
  for (const p of participantDtos) {
    const tid = p.teamId ?? 0
    if (!tid) continue
    if ((p as { teamEarlySurrendered?: boolean }).teamEarlySurrendered === true) {
      teamEarlySurrendered.set(tid, true)
    }
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
      const elderObj = (obj['elder'] ?? {}) as { first?: unknown; kills?: unknown }

      const teamBans = (t.bans ?? [])
        .filter((b, idx) => {
          const champId = b?.championId
          return typeof champId === 'number' && champId > 0 && idx < 5
        })
        .map((b, idx) => ({ championId: b.championId as number, pickOrder: idx + 1 }))

      return {
        teamRow: {
          matchId,
          team: t.teamId ?? 0,
          win: t.win === true,
          teamEarlySurrendered: teamEarlySurrendered.get(t.teamId ?? 0) === true,
          baronKills: toKills(baronObj.kills),
          baronFirst: toFirst(baronObj.first),
          dragonKills: toKills(dragonObj.kills),
          dragonFirst: toFirst(dragonObj.first),
          towerKills: toKills(towerObj.kills),
          towerFirst: toFirst(towerObj.first),
          hordeKills: toKills(hordeObj.kills),
          hordeFirst: toFirst(hordeObj.first),
          riftHeraldKills: toKills(riftHeraldObj.kills),
          riftHeraldFirst: toFirst(riftHeraldObj.first),
          inhibitorKills: toKills(inhibitorObj.kills),
          championKills: toKills(championObj.kills),
          firstBlood: toFirst(championObj.first),
          elderKills: toKills(elderObj.kills),
        },
        bans: teamBans,
      }
    })
}

/** Build normalised match_player_items rows from JSON items array [itemId, ...]. */
function buildItemRows(
  matchPlayerId: bigint,
  items: unknown
): Array<{ matchPlayerId: bigint; itemId: number; order: number }> {
  if (!Array.isArray(items)) return []
  const rows: Array<{ matchPlayerId: bigint; itemId: number; order: number }> = []
  for (let slot = 0; slot < items.length && slot <= 6; slot++) {
    const itemId = Number(items[slot])
    if (Number.isFinite(itemId) && itemId > 0) {
      rows.push({ matchPlayerId, itemId, order: slot })
    }
  }
  return rows
}

/** Build normalised match_player_runes rows from perks.styles array. */
function buildRuneRows(
  matchPlayerId: bigint,
  runes: unknown
): Array<{ matchPlayerId: bigint; perkId: number; style: number }> {
  const rows: Array<{ matchPlayerId: bigint; perkId: number; style: number }> = []
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
    for (const sel of selections) {
      const selObj = sel as Record<string, unknown>
      if (!selObj) continue
      const perkId = Number(selObj['perk'])
      if (!Number.isFinite(perkId)) continue
      rows.push({ matchPlayerId, perkId, style: styleId })
    }
  }
  return rows
}

/** Build normalised match_player_summoner_spells rows (slot 0 and 1). */
function buildSummonerSpellRows(
  matchPlayerId: bigint,
  summoner1Id: number | null,
  summoner2Id: number | null
): Array<{ matchPlayerId: bigint; spellId: number; spellSlot: number }> {
  const rows: Array<{ matchPlayerId: bigint; spellId: number; spellSlot: number }> = []
  if (summoner1Id != null && summoner1Id > 0) rows.push({ matchPlayerId, spellId: summoner1Id, spellSlot: 0 })
  if (summoner2Id != null && summoner2Id > 0) rows.push({ matchPlayerId, spellId: summoner2Id, spellSlot: 1 })
  return rows
}

/** Build normalised match_player_shards rows from stat_perks { defense, flex, offense }. Slots: 0=offense, 1=flex, 2=defense. */
function buildShardRows(
  matchPlayerId: bigint,
  statPerks: unknown
): Array<{ matchPlayerId: bigint; shardId: number; slot: number }> {
  if (!statPerks || typeof statPerks !== 'object') return []
  const sp = statPerks as Record<string, unknown>
  const rows: Array<{ matchPlayerId: bigint; shardId: number; slot: number }> = []
  const keys = ['offense', 'flex', 'defense'] as const
  for (let slot = 0; slot < keys.length; slot++) {
    const id = Number(sp[keys[slot]])
    if (Number.isFinite(id) && id > 0) rows.push({ matchPlayerId, shardId: id, slot })
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
  const riotMatchId = dto.metadata?.matchId ?? dto.info?.gameId?.toString()
  if (!riotMatchId) return
  const info = dto.info
  if (!info?.participants?.length) return
  if (info.endOfGameResult && info.endOfGameResult !== 'GameComplete') return

  const existing = await prisma.match.findUnique({ where: { riotMatchId }, select: { id: true } })
  if (existing) return

  const gameVersion = info.gameVersion ?? ''
  const gameDuration = info.gameDuration ?? 0
  const participantDtos = info.participants as RiotParticipantDto[]
  const puuids = participantDtos.map((p) => p.puuid).filter(Boolean) as string[]
  const existingPlayers = await prisma.player.findMany({
    where: { puuid: { in: puuids } },
    select: { id: true, puuid: true, puuidKeyVersion: true, gameName: true },
  })
  const existingByPuuid = new Map(existingPlayers.map((p) => [p.puuid, p]))

  // Compute match-level rank from all participants (exclude UNRANKED/null)
  const rankScores: number[] = []
  for (const p of participantDtos) {
    const tier = (p as { tier?: string }).tier ?? (p as { rankTier?: string }).rankTier
    if (tier && tier !== 'UNRANKED') {
      const div = (p as { rank?: string }).rank ?? (p as { rankDivision?: string }).rankDivision ?? ''
      const lp = (p as { leaguePoints?: number }).leaguePoints ?? null
      rankScores.push(rankToScore(tier, div, lp))
    }
  }
  let matchRankTier = 'UNRANKED'
  let matchRankDivision = ''
  if (rankScores.length > 0) {
    const avg = rankScores.reduce((a, b) => a + b, 0) / rankScores.length
    const { tier, division } = scoreToRank(avg)
    matchRankTier = tier
    matchRankDivision = division
  }

  // Aggregate surrender flags
  const gameEndedInSurrender = participantDtos.some(
    (p) => (p as { gameEndedInSurrender?: boolean }).gameEndedInSurrender === true
  )
  const gameEndedInEarlySurrender = participantDtos.some(
    (p) => (p as { gameEndedInEarlySurrender?: boolean }).gameEndedInEarlySurrender === true
  )

  const match = await prisma.match.create({
    data: {
      riotMatchId,
      gameVersion,
      gameDuration,
      rankTier: matchRankTier,
      rankDivision: matchRankDivision,
      gameEndedInSurrender,
      gameEndedInEarlySurrender,
      region,
    },
  })
  counters.matchesFetched++
  if (logger) await logger.info('DB: match created', { riotMatchId })

  // Build teams + bans
  const teamDataItems = buildMatchTeamData(match.id, info, participantDtos)
  const teamIdByRiotTeam = new Map<number, bigint>()
  for (const { teamRow, bans } of teamDataItems) {
    const created = await prisma.team.create({ data: teamRow })
    teamIdByRiotTeam.set(teamRow.team, created.id)
    if (bans.length > 0) {
      await prisma.ban.createMany({
        data: bans.map((b) => ({
          teamId: created.id,
          matchId: match.id,
          championId: b.championId,
          pickOrder: b.pickOrder,
        })),
      })
    }
  }

  // Collect unknown challenge keys seen across all participants (de-duped)
  const allUnknownKeys: Record<string, unknown> = {}

  for (let pIdx = 0; pIdx < participantDtos.length; pIdx++) {
    const p = participantDtos[pIdx]
    const puuid = p.puuid
    if (!puuid) continue
    const { gn: partGameName, tl: partTagName } = participantNames(p)
    const existingPlayer = existingByPuuid.get(puuid)
    let playerId: bigint
    if (existingPlayer == null) {
      const newPlayer = await prisma.player.create({
        data: {
          puuid,
          region,
          puuidKeyVersion,
          gameName: partGameName || null,
          tagName: partTagName || null,
          lastSeen: null,
        },
      })
      playerId = newPlayer.id
      existingByPuuid.set(puuid, { id: playerId, puuid, puuidKeyVersion, gameName: partGameName || null })
      counters.playersFetched++
    } else {
      playerId = existingPlayer.id
      const playerUpdates: Record<string, unknown> = {}
      if (existingPlayer.puuidKeyVersion === 'perdu' && puuidKeyVersion) {
        playerUpdates['puuidKeyVersion'] = puuidKeyVersion
        existingPlayer.puuidKeyVersion = puuidKeyVersion
      }
      if (!existingPlayer.gameName && partGameName) {
        playerUpdates['gameName'] = partGameName
        playerUpdates['tagName'] = partTagName || null
        existingPlayer.gameName = partGameName
      }
      if (Object.keys(playerUpdates).length > 0) {
        await prisma.player.update({ where: { id: existingPlayer.id }, data: playerUpdates })
      }
    }

    const role = roleFromPosition(p.teamPosition, p.individualPosition) ?? 'FILL'
    const rankTier = (p as { tier?: string }).tier ?? (p as { rankTier?: string }).rankTier ?? 'UNRANKED'
    const rankDivision = (p as { rank?: string }).rank ?? (p as { rankDivision?: string }).rankDivision ?? null
    const rankLp = (p as { leaguePoints?: number }).leaguePoints ?? (p as { rankLp?: number }).rankLp ?? null
    const riotTeamId = p.teamId ?? 100
    const teamDbId = teamIdByRiotTeam.get(riotTeamId) ?? teamIdByRiotTeam.values().next().value!

    const items = (p as { items?: unknown }).items ?? null
    const runes = (p as { perks?: unknown }).perks ?? (p as { runes?: unknown }).runes ?? null
    const summoner1Id = (p as { summoner1Id?: number }).summoner1Id ?? null
    const summoner2Id = (p as { summoner2Id?: number }).summoner2Id ?? null
    const statPerks = (() => {
      const perks = (p as { perks?: Record<string, unknown> }).perks
      if (perks && typeof perks === 'object' && 'statPerks' in perks) return perks['statPerks'] ?? null
      return (p as { statPerks?: unknown }).statPerks ?? null
    })()
    const challenges = (p as { challenges?: unknown }).challenges ?? null
    const ch = (challenges && typeof challenges === 'object' && !Array.isArray(challenges))
      ? challenges as Record<string, unknown>
      : {}

    const n = (key: string, fallback = 0): number => {
      const v = (p as Record<string, unknown>)[key] ?? ch[key]
      return typeof v === 'number' && Number.isFinite(v) ? v : fallback
    }
    const b = (key: string): boolean => (p as Record<string, unknown>)[key] === true

    const matchPlayer = await prisma.matchPlayer.create({
      data: {
        matchId: match.id,
        playerId,
        teamId: teamDbId,
        championId: p.championId ?? 0,
        role,
        rankTier,
        rankDivision,
        rankLp,
        participantId: pIdx + 1,
      },
    })
    counters.participantsFetched++

    const mpId = matchPlayer.id

    // ── Sub-table writes ───────────────────────────────────────────────────────

    await prisma.matchPlayerCore.create({
      data: {
        matchPlayerId: mpId,
        kills: n('kills'),
        deaths: n('deaths'),
        assists: n('assists'),
        champLevel: n('champLevel'),
        champExperience: n('champExperience'),
        goldEarned: n('goldEarned'),
        goldSpent: n('goldSpent'),
        itemsPurchased: n('itemsPurchased'),
        consumablesPurchased: n('consumablesPurchased'),
        totalMinionsKilled: n('totalMinionsKilled'),
        roleBoundItem: n('roleBoundItem'),
      },
    })

    await prisma.matchPlayerVisions.create({
      data: {
        matchPlayerId: mpId,
        visionScore: n('visionScore'),
        wardsKilled: n('wardsKilled'),
        wardsPlaced: n('wardsPlaced'),
        visionWardsBoughtInGame: n('visionWardsBoughtInGame'),
        detectorWardsPlaced: n('detectorWardsPlaced'),
        controlWardsPlaced: n('sightWardsBoughtInGame'),
        unseenRecalls: n('unseenRecalls'),
        visionScoreAdvantageLaneOpponent: n('visionScoreAdvantageLaneOpponent'),
        wardTakedowns: n('wardTakedowns'),
        wardTakedownsBefore20M: n('wardTakedownsBefore20M'),
        wardsGuarded: n('wardsGuarded'),
      },
    })

    await prisma.matchPlayerMatchup.create({
      data: {
        matchPlayerId: mpId,
        bountyGold: n('bountyGold'),
        completeSupportQuestInTime: n('completeSupportQuestInTime'),
        deathsByEnemyChamps: n('deathsByEnemyChamps'),
        earlyLaningPhaseGoldExpAdvantage: n('earlyLaningPhaseGoldExpAdvantage'),
        initialCrabCount: n('initialCrabCount'),
        jungleCsBefore10Minutes: n('jungleCsBefore10Minutes'),
        killsNearEnemyTurret: n('killsNearEnemyTurret'),
        killsOnOtherLanesEarlyJungleAsLaner: n('killsOnOtherLanesEarlyJungleAsLaner'),
        killsUnderOwnTurret: n('killsUnderOwnTurret'),
        landSkillShotsEarlyGame: n('landSkillShotsEarlyGame'),
        laneMinionsFirst10Minutes: n('laneMinionsFirst10Minutes'),
        laningPhaseGoldExpAdvantage: n('laningPhaseGoldExpAdvantage'),
        maxCsAdvantageOnLaneOpponent: n('maxCsAdvantageOnLaneOpponent'),
        maxKillDeficit: n('maxKillDeficit'),
        maxLevelLeadLaneOpponent: n('maxLevelLeadLaneOpponent'),
        outnumberedKills: n('outnumberedKills'),
        quickSoloKills: n('quickSoloKills'),
        soloKills: n('soloKills'),
        takedownsAfterGainingLevelAdvantage: n('takedownsAfterGainingLevelAdvantage'),
        moreEnemyJungleThanOpponent: n('moreEnemyJungleThanOpponent'),
        totalAllyJungleMinionsKilled: n('totalAllyJungleMinionsKilled'),
        totalEnemyJungleMinionsKilled: n('totalEnemyJungleMinionsKilled'),
        neutralMinionsKilled: n('neutralMinionsKilled'),
      },
    })

    await prisma.matchPlayerObjectives.create({
      data: {
        matchPlayerId: mpId,
        dragonKills: n('dragonKills'),
        firstBloodKill: b('firstBloodKill'),
        firstBloodAssist: b('firstBloodAssist'),
        firstTowerKill: b('firstTowerKill'),
        firstTowerAssist: b('firstTowerAssist'),
        inhibitorKills: n('inhibitorKills'),
        inhibitorTakedowns: n('inhibitorTakedowns'),
        inhibitorsLost: n('inhibitorsLost'),
        objectivesStolen: n('objectivesStolen'),
        objectivesStolenAssists: n('objectivesStolenAssists'),
        turretKills: n('turretKills'),
        turretTakedowns: n('turretTakedowns'),
        turretsLost: n('turretsLost'),
        dragonTakedowns: n('dragonTakedowns'),
        earliestBaron: n('earliestBaron'),
        elderDragonKillsWithOpposingSoul: n('elderDragonKillsWithOpposingSoul'),
        elderDragonMultikills: n('elderDragonMultikills'),
        epicMonsterKillsNearEnemyJungler: n('epicMonsterKillsNearEnemyJungler'),
        epicMonsterKillsWithin30SecondsOfSpawn: n('epicMonsterKillsWithin30SecondsOfSpawn'),
        epicMonsterSteals: n('epicMonsterSteals'),
        epicMonsterStolenWithoutSmite: n('epicMonsterStolenWithoutSmite'),
        firstTurretKilledTime: n('firstTurretKilledTime'),
        riftHeraldTakedowns: n('riftHeraldTakedowns'),
        turretPlatesTaken: n('turretPlatesTaken'),
        turretsTakenWithRiftHerald: n('turretsTakenWithRiftHerald'),
        baronTakedowns: n('baronTakedowns'),
        quickFirstTurret: n('quickFirstTurret'),
        soloBaronKills: n('soloBaronKills'),
        soloTurretsLategame: n('soloTurretsLategame'),
        takedownOnFirstTurret: n('takedownOnFirstTurret'),
        multiTurretRiftHeraldCount: n('multiTurretRiftHeraldCount'),
      },
    })

    await prisma.matchPlayerCombats.create({
      data: {
        matchPlayerId: mpId,
        damageDealtToBuildings: n('damageDealtToBuildings'),
        damageDealtToEpicMonsters: n('damageDealtToEpicMonsters'),
        damageDealtToObjectives: n('damageDealtToObjectives'),
        damageDealtToTurrets: n('damageDealtToTurrets'),
        damageSelfMitigated: n('damageSelfMitigated'),
        doubleKills: n('doubleKills'),
        killingSprees: n('killingSprees'),
        largestCriticalStrike: n('largestCriticalStrike'),
        largestKillingSpree: n('largestKillingSpree'),
        longestTimeSpentLiving: n('longestTimeSpentLiving'),
        magicDamageDealt: n('magicDamageDealt'),
        magicDamageDealtToChampions: n('magicDamageDealtToChampions'),
        magicDamageTaken: n('magicDamageTaken'),
        pentaKills: n('pentaKills'),
        physicalDamageDealt: n('physicalDamageDealt'),
        physicalDamageDealtToChampions: n('physicalDamageDealtToChampions'),
        physicalDamageTaken: n('physicalDamageTaken'),
        quadraKills: n('quadraKills'),
        totalDamageShieldedOnTeammates: n('totalDamageShieldedOnTeammates'),
        totalDamageTaken: n('totalDamageTaken'),
        totalHeal: n('totalHeal'),
        totalHealsOnTeammates: n('totalHealsOnTeammates'),
        totalTimeCcDealt: n('totalTimeCCDealt') || n('timeCCingOthers'),
        totalUnitsHealed: n('totalUnitsHealed'),
        tripleKills: n('tripleKills'),
        trueDamageDealt: n('trueDamageDealt'),
        trueDamageDealtToChampions: n('trueDamageDealtToChampions'),
        trueDamageTaken: n('trueDamageTaken'),
        effectiveHealAndShielding: n('effectiveHealAndShielding'),
        timeCcingOthers: n('timeCCingOthers'),
        enemyChampionImmobilizations: n('enemyChampionImmobilizations'),
      },
    })

    if (ch && Object.keys(ch).length > 0) {
      await prisma.matchPlayerChallenges.create({
        data: {
          matchPlayerId: mpId,
          healFromMapSources: n('HealFromMapSources'),
          buffsStolen: n('buffsStolen'),
          dodgeSkillShotsSmallWindow: n('dodgeSkillShotsSmallWindow'),
          hadOpenNexus: n('hadOpenNexus'),
          immobilizeAndKillWithAlly: n('immobilizeAndKillWithAlly'),
          junglerTakedownsNearDamagedEpicMonster: n('junglerTakedownsNearDamagedEpicMonster'),
          killAfterHiddenWithAlly: n('killAfterHiddenWithAlly'),
          killedChampTookFullTeamDamageSurvived: n('killedChampTookFullTeamDamageSurvived'),
          killsWithHelpFromEpicMonster: n('killsWithHelpFromEpicMonster'),
          knockEnemyIntoTeamAndKill: n('knockEnemyIntoTeamAndKill'),
          mejaisFullStackInTime: n('mejaisFullStackInTime'),
          multikillsAfterAggressiveFlash: n('multikillsAfterAggressiveFlash'),
          quickCleanse: n('quickCleanse'),
          saveAllyFromDeath: n('saveAllyFromDeath'),
          scuttleCrabKills: n('scuttleCrabKills'),
          skillshotsDodged: n('skillshotsDodged'),
          skillshotsHit: n('skillshotsHit'),
          stealthWardsPlaced: n('stealthWardsPlaced'),
          survivedSingleDigitHpCount: n('survivedSingleDigitHpCount'),
          survivedThreeImmobilizesInFight: n('survivedThreeImmobilizesInFight'),
          takedownsBeforeJungleMinionSpawn: n('takedownsBeforeJungleMinionSpawn'),
          takedownsInAlcove: n('takedownsInAlcove'),
          takedownsInEnemyFountain: n('takedownsInEnemyFountain'),
          tookLargeDamageSurvived: n('tookLargeDamageSurvived'),
        },
      })
    }

    // match_player_items
    const itemRows = buildItemRows(mpId, items)
    if (itemRows.length > 0) await prisma.matchPlayerItem.createMany({ data: itemRows })

    // match_player_runes
    const runeRows = buildRuneRows(mpId, runes)
    if (runeRows.length > 0) await prisma.matchPlayerRune.createMany({ data: runeRows })

    // match_player_summoner_spells
    const ssRows = buildSummonerSpellRows(mpId, summoner1Id, summoner2Id)
    if (ssRows.length > 0) {
      await prisma.matchPlayerSummonerSpell.createMany({ data: ssRows, skipDuplicates: true })
    }

    // match_player_shards (stat perks: offense=0, flex=1, defense=2)
    const shardRows = buildShardRows(mpId, statPerks)
    if (shardRows.length > 0) {
      await prisma.matchPlayerShard.createMany({ data: shardRows, skipDuplicates: true })
    }

    // Collect unknown challenge keys
    if (ch) {
      const { unknown } = partitionChallenges(ch)
      for (const [k, v] of Object.entries(unknown)) {
        allUnknownKeys[k] = v
      }
    }
  }

  if (logger) await logger.info('DB: match_players created', { riotMatchId, count: participantDtos.length })

  // Fire-and-forget: notify of unknown challenge keys
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
  // Jungle first clear table was removed from the new schema — nothing to do.
  void matchDbId; void riotMatchId; void timeline; void logger
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

  // Build Riot participantId (1-10) → DB matchPlayer.id
  const allMatchPlayers2 = await prisma.matchPlayer.findMany({
    where: { matchId: matchDbId },
    select: { id: true, participantId: true },
    orderBy: { participantId: 'asc' },
  })
  const riotPidToDbId = new Map<number, bigint>()
  for (const mp of allMatchPlayers2) {
    riotPidToDbId.set(mp.participantId, mp.id)
  }

  // Build Riot teamId (100/200) → DB team.id
  const teams = await prisma.team.findMany({
    where: { matchId: matchDbId },
    select: { id: true, team: true },
  })
  const matchTeamIdByTeamId = new Map<number, bigint>()
  for (const t of teams) matchTeamIdByTeamId.set(t.team, t.id)

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
    matchId: bigint; teamId: bigint; drakeType: string; order: number; soul: string
  }> = []
  for (const rows of drakesByTeam.values()) {
    for (const r of rows) {
      drakeInsertRows.push({ matchId: matchDbId, teamId: r.matchTeamId, drakeType: r.drakeType, order: r.order, soul: r.soul ?? 'none' })
    }
  }
  if (drakeInsertRows.length > 0) {
    await prisma.drakeDetail.createMany({ data: drakeInsertRows, skipDuplicates: true })
  }

  // ── 3. Skill level-up order (SKILL_LEVEL_UP) ────────────────────────────────
  const skillOrderCounters = new Map<bigint, number>() // dbParticipantId → next 1-based order
  const spellOrderRows: Array<{
    matchPlayerId: bigint; spellSlot: number; order: number; timestampMs: number
  }> = []

  for (const ev of allEvents) {
    if (ev.type !== 'SKILL_LEVEL_UP') continue
    const e = ev as unknown as RiotTimelineEventSkillLevelUp
    const dbId = riotPidToDbId.get(e.participantId)
    if (!dbId) continue
    const order = (skillOrderCounters.get(dbId) ?? 0) + 1
    skillOrderCounters.set(dbId, order)
    spellOrderRows.push({ matchPlayerId: dbId, spellSlot: e.skillSlot, order, timestampMs: e.timestamp })
  }
  if (spellOrderRows.length > 0) {
    await prisma.matchPlayerSpellOrder.createMany({ data: spellOrderRows, skipDuplicates: true })
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

  for (const [dbMatchPlayerId, itemId] of starterItemByPid) {
    await prisma.matchPlayerItem.updateMany({
      where: { matchPlayerId: dbMatchPlayerId, itemId },
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

/**
 * Backfill match_player runes from a Match v5 participant DTO if none exist yet.
 */
async function backfillMatchPlayerRunes(
  matchPlayerId: bigint,
  riotPart: RiotParticipantDto
): Promise<void> {
  const runes = (riotPart as { perks?: unknown }).perks ?? (riotPart as { runes?: unknown }).runes ?? null
  if (!runes) return
  const existing = await prisma.matchPlayerRune.count({ where: { matchPlayerId } })
  if (existing === 0) {
    const rows = buildRuneRows(matchPlayerId, runes)
    if (rows.length > 0) await prisma.matchPlayerRune.createMany({ data: rows, skipDuplicates: true })
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
          where: { riotMatchId: item.matchId },
          select: { id: true },
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
            await prisma.player.update({
              where: { id: item.playerId },
              data: { lastSeen: new Date() },
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
      where: { riotMatchId: { in: matchIds } },
      select: { riotMatchId: true },
    })
    const existingSet = new Set(existing.map((m) => m.riotMatchId))
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
      teams: { some: {} },
      OR: [
        { drakeDetails: { none: {} } },
        { matchPlayers: { every: { spellOrders: { none: {} } } } },
      ],
    },
    take: BATCH_TIMELINE_BACKFILL,
    orderBy: { id: 'desc' },
    select: { id: true, riotMatchId: true },
  })
  if (matches.length === 0) return 0

  let done = 0
  for (const m of matches) {
    if (state.shouldStop) break
    const platform = m.riotMatchId.startsWith('EUN1_') ? 'eun1' : 'euw1'
    client.setPlatform(platform)
    const timelineRes = await client.getMatchTimeline(m.riotMatchId)
    setState({ requestCount: state.requestCount + 1 })
    if (!timelineRes.ok) {
      if (timelineRes.status === 429) setState({ error429Count: state.error429Count + 1 })
      continue
    }
    try {
      await extractAndInsertJungleFirstClear(m.id, m.riotMatchId, timelineRes.data, logger)
      await extractAndInsertTimelineExtras(m.id, m.riotMatchId, timelineRes.data, logger)
      done++
    } catch (err) {
      void logger.error('Timeline backfill failed', err, { matchId: m.riotMatchId })
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
      teams: { some: {} },
      matchPlayers: { some: {}, every: { runes: { none: {} } } },
    },
    take: BATCH_RUNE_BACKFILL,
    orderBy: { id: 'desc' },
    select: { id: true, riotMatchId: true },
  })
  if (matches.length === 0) return 0

  let done = 0
  for (const m of matches) {
    if (state.shouldStop) break
    const platform = m.riotMatchId.startsWith('EUN1_') ? 'eun1' : 'euw1'
    client.setPlatform(platform)
    const matchRes = await client.getMatch(m.riotMatchId)
    setState({ requestCount: state.requestCount + 1 })
    if (!matchRes.ok) {
      if (matchRes.status === 429) setState({ error429Count: state.error429Count + 1 })
      continue
    }
    const participantDtos = (matchRes.data.info?.participants ?? []) as RiotParticipantDto[]
    if (participantDtos.length === 0) continue

    const dbMatchPlayers = await prisma.matchPlayer.findMany({
      where: { matchId: m.id },
      select: { id: true, participantId: true },
      orderBy: { participantId: 'asc' },
    })
    if (dbMatchPlayers.length !== participantDtos.length) continue

    for (let i = 0; i < dbMatchPlayers.length; i++) {
      await backfillMatchPlayerRunes(dbMatchPlayers[i].id, participantDtos[i])
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
    // ── Phase 2: sync all players with wrong/missing key version (includes 'erreur') ──
    await runPhase2(client, logger, clefType)

    // ── Phase 3: backfill null rank/role data for current-key players ──────────
    await runPhase3(client, logger, clefType)

    // ── Phase 3b: backfill timeline data (drakes, soul, skill order, starter, jungle first clear) ──
    await runPhase3b(client, logger)

    // ── Phase 3c: backfill participant_runes from match detail (perks) ─────────────────────────
    await runPhase3c(client, logger)

    await logger.step('Initialization phases complete, entering collection loop', {})

    // ── Phase 4: main collection loop ─────────────────────────────────────────
    let loopIteration = 0
    while (!state.shouldStop && isDatabaseConfigured()) {
      loopIteration++
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
        // Key changed: re-run phase 2 (includes former 'erreur' players)
        await runPhase2(client, logger, clefType)
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
        continue
      }
      if (resultEun === 'prisma_error') await logger.alerte('Prisma error in step 4 (eun1), continuing')

      // ── Aggregate pending matches into stats tables ─────────────────────
      try {
        const aggregated = await aggregatePendingMatches(logger)
        if (aggregated > 0) {
          await logger.step('Aggregation: matches aggregated', { count: aggregated })
        }
      } catch (err) {
        await logger.alerte('Aggregation error (non-fatal)')
        void err
      }

      // ── Old patch raw data cleanup (every 20 loops) ─────────────────────
      if (loopIteration % 20 === 0) {
        try {
          await runPatchCleanupFromConfig(logger)
        } catch (err) {
          await logger.alerte('Patch cleanup error (non-fatal)')
          void err
        }
      }
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

/** Returns the active loop promise so the orchestrator can await its completion. */
export function getPollerLoopPromise(): Promise<void> | null {
  return loopPromise
}

export function isRiotPollerRunning(): boolean {
  return state.isRunning
}
