/**
 * Riot poller: runs inside the backend process.
 * - Init: resolves API key (any subsequent 401/403 stops the poller automatically).
 * - Loop: take players, fetch match lists, fetch full match + timeline (fill DB). Sync PUUID / key is optional via `runPhase2` (script puuid-migration only).
 * Logs to logs/riot-poller.log; exposes status for admin API.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { statfs } from 'node:fs/promises'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { loadMatchFilters, loadCurrentGameVersion, loadRateLimitConfig } from '../services/RiotConfigService.js'
import type { MatchFiltersConfig } from '../services/RiotConfigService.js'
import { RiotRateLimiter } from '../services/RiotRateLimiter.js'
import { DiscordService } from '../services/DiscordService.js'
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
} from '../services/RiotHttpClient.js'
import { Prisma } from '../generated/prisma/index.js'
import { rankToScore, scoreToRank } from '../utils/rankScore.js'
import { tryRunChampionTierDailySnapshot } from '../services/ChampionTierDailySnapshotService.js'
import { runPatchCleanupFromConfig } from '../services/StatsAggregationService.js'
import { syncActivePatches, refreshAllMaterializedViews } from '../services/MaterializedViewService.js'
import {
  isKeptMatchPlayerDurationBucket,
  timelineTimestampMsToGameMinute,
} from './matchPlayerBucketPolicy.js'
import { selectMatchPlayerItems } from './itemBuildSelection.js'

const PLAYERS_PER_LOOP = 20
const MATCH_FETCH_CONCURRENCY = 1 // strict sequential fetches per player
/** Bounded queue size for Phase 4: API producer pushes, DB consumers pop. */
const INGEST_QUEUE_SIZE = 50
/** Number of concurrent DB writers in Phase 4 (consumers). */
const INGEST_CONSUMER_COUNT = 2
const TIMELINE_RETRY_BASE_DELAY_MS = 60_000
const TIMELINE_RETRY_MAX_DELAY_MS = 15 * 60_000
const TIMELINE_RETRY_MAX_ATTEMPTS = 8
const MATCH_FETCH_RETRY_DELAY_MS = 2_000
const MATCH_FETCH_MAX_ATTEMPTS = 40
const MV_REFRESH_EVERY_MS = 4 * 60 * 60 * 1000
let lastMvRefreshAt = 0

const timelineRetryState = new Map<string, { attempts: number; nextRetryAtMs: number }>()

const MIN_ALLOWED_MAJOR = 16
const MIN_ALLOWED_MINOR = 1
const DISK_ALERT_THRESHOLDS = [85, 90, 95] as const
const DISK_STOP_THRESHOLD = 98
const diskAlertedThresholds = new Set<number>()
let diskStopAlertSent = false

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

/** When true, orchestrator will start puuid-migration script after poller loop exits (e.g. on 400_decrypt). */
let triggerPuuidMigrationOnPollerExit = false

export function setTriggerPuuidMigrationOnPollerExit(value: boolean): void {
  triggerPuuidMigrationOnPollerExit = value
}

/** Returns and clears the flag. Called by orchestrator when poller loop has finished. */
export function getAndClearTriggerPuuidMigrationOnPollerExit(): boolean {
  const v = triggerPuuidMigrationOnPollerExit
  triggerPuuidMigrationOnPollerExit = false
  return v
}

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

function isLikelyRiotPuuid(value: string | null | undefined): boolean {
  const v = (value ?? '').trim()
  if (!v) return false
  // Guard against synthetic placeholders like "12345".
  if (/^\d+$/.test(v)) return false
  return v.length >= 30
}

function isAllowedGameVersion(gameVersionRaw: string | null | undefined): boolean {
  const gameVersion = (gameVersionRaw ?? '').trim()
  if (!gameVersion) return false
  const [majorRaw, minorRaw] = gameVersion.split('.')
  const major = Number(majorRaw)
  const minor = Number(minorRaw)
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false
  if (major > MIN_ALLOWED_MAJOR) return true
  if (major < MIN_ALLOWED_MAJOR) return false
  return minor >= MIN_ALLOWED_MINOR
}

function averageRankFromScores(scores: number[]): { tier: string; division: string } {
  if (scores.length === 0) return { tier: 'UNRANKED', division: '' }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return scoreToRank(avg)
}

function canAttemptTimelineFetchNow(matchId: string, nowMs: number): boolean {
  const s = timelineRetryState.get(matchId)
  return !s || s.nextRetryAtMs <= nowMs
}

function scheduleTimelineRetry(matchId: string): { attempts: number; nextRetryAtMs: number } {
  const prev = timelineRetryState.get(matchId)
  const attempts = Math.min(TIMELINE_RETRY_MAX_ATTEMPTS, (prev?.attempts ?? 0) + 1)
  const delay = Math.min(
    TIMELINE_RETRY_MAX_DELAY_MS,
    TIMELINE_RETRY_BASE_DELAY_MS * Math.max(1, 2 ** (attempts - 1))
  )
  const nextRetryAtMs = Date.now() + delay
  const nextState = { attempts, nextRetryAtMs }
  timelineRetryState.set(matchId, nextState)
  return nextState
}

function clearTimelineRetry(matchId: string): void {
  timelineRetryState.delete(matchId)
}

async function getDiskUsagePercent(path: string): Promise<number | null> {
  try {
    const s = await statfs(path)
    const total = Number(s.blocks) * Number(s.bsize)
    const available = Number(s.bavail) * Number(s.bsize)
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(available) || available < 0) return null
    const used = Math.max(0, total - available)
    return (used / total) * 100
  } catch {
    return null
  }
}


export type RiotPollerInit = {
  ok: true
  client: RiotHttpClient
  logger: ReturnType<typeof createRiotPollerLogger>
  filters: MatchFiltersConfig
  clefType: string | null
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
 * or unresolved conflicts are marked as "perdu" for the current key version,
 * without overwriting puuid with synthetic placeholders.
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
              // PUUID already taken by another player row — mark unresolved for this key.
              await prisma.player.update({
                where: { id: playerId },
                data: { puuidKeyVersion: 'perdu' },
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
          data: { puuidKeyVersion: 'perdu' },
        })
        totalPlaceholder++
      }
      // else: already on correct key, gameName will be populated when they next appear in Phase 4
    }
  }

  await logger.step('Phase 2 end', { totalSynced, totalPlaceholder })
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

/** Build rune ID list preserving Riot JSON order (styles then perks). */
function buildRunePayload(runes: unknown): { runes: number[] } {
  const perkIds: number[] = []
  const styleIds: number[] = []
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
    const styleIdRaw = s['id'] ?? s['styleId'] ?? s['style_id'] ?? s['style']
    const styleId = Number(styleIdRaw)
    if (!Number.isFinite(styleId)) continue
    styleIds.push(styleId)
    const selections =
      Array.isArray(s['selections']) ? s['selections'] : Array.isArray(s['selection']) ? s['selection'] : []
    for (const sel of selections) {
      if (typeof sel === 'number' && Number.isFinite(sel)) {
        perkIds.push(sel)
        continue
      }
      const selObj = sel as Record<string, unknown>
      if (!selObj || typeof selObj !== 'object') continue
      const perkIdRaw = selObj['perk'] ?? selObj['perkId'] ?? selObj['perk_id'] ?? selObj['id']
      const perkId = Number(perkIdRaw)
      if (!Number.isFinite(perkId)) continue
      perkIds.push(perkId)
    }
  }
  return { runes: [...styleIds, ...perkIds] }
}

/** Summoner spell IDs in D-then-F order (Riot summoner1Id, summoner2Id). */
function buildSummonerSpellIds(summoner1Id: number | null, summoner2Id: number | null): number[] {
  const out: number[] = []
  if (summoner1Id != null && summoner1Id > 0) out.push(summoner1Id)
  if (summoner2Id != null && summoner2Id > 0) out.push(summoner2Id)
  return out
}

/** Build shard list from stat_perks in Riot order: offense, flex, defense. */
function buildShardList(statPerks: unknown): number[] {
  if (!statPerks || typeof statPerks !== 'object') return []
  const sp = statPerks as Record<string, unknown>
  const shards: number[] = []
  const keys = ['offense', 'flex', 'defense'] as const
  for (let slot = 0; slot < keys.length; slot++) {
    const id = Number(sp[keys[slot]])
    if (Number.isFinite(id) && id > 0) shards.push(id)
  }
  return shards
}

function durationBucketFromRaw(raw: unknown): number | null {
  const d = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(d)) return null
  // Heuristic:
  // - if Riot returns seconds (e.g. 300, 600, 900), convert to minutes
  // - if Riot already returns minutes/buckets (e.g. 0,5,10), keep as-is
  if (d > 120) return Math.floor(d / 60)
  return Math.floor(d)
}

function toIntOr0(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  if (typeof raw === 'string') {
    const n = Number(raw)
    return Number.isFinite(n) ? Math.trunc(n) : 0
  }
  return 0
}

function buildBucketRows(
  matchPlayerId: bigint,
  bucketsRaw: unknown
): Array<{
  matchPlayerId: bigint
  durationBucket: number
  currentGold: number
  magicDamageDone: number
  magicDamageDoneToChampion: number
  magicDamageTaken: number
  physicalDamageDone: number
  physicalDamageDoneToChampion: number
  physicalDamageTaken: number
  totalDamageDone: number
  totalDamageDoneToChampion: number
  totalDamageTaken: number
  trueDamageDone: number
  trueDamageDoneToChampion: number
  trueDamageTaken: number
  goldPerSecond: number
  jungleMinionsKilled: number
  level: number
  minionsKilled: number
  timeEnemySpentControlled: number
  totalGold: number
  xp: number
}> {
  if (!Array.isArray(bucketsRaw)) return []

  const out: Array<{
    matchPlayerId: bigint
    durationBucket: number
    currentGold: number
    magicDamageDone: number
    magicDamageDoneToChampion: number
    magicDamageTaken: number
    physicalDamageDone: number
    physicalDamageDoneToChampion: number
    physicalDamageTaken: number
    totalDamageDone: number
    totalDamageDoneToChampion: number
    totalDamageTaken: number
    trueDamageDone: number
    trueDamageDoneToChampion: number
    trueDamageTaken: number
    goldPerSecond: number
    jungleMinionsKilled: number
    level: number
    minionsKilled: number
    timeEnemySpentControlled: number
    totalGold: number
    xp: number
  }> = []

  for (const b of bucketsRaw) {
    if (b == null || typeof b !== 'object') continue
    const br = b as Record<string, unknown>
    const durationBucket = durationBucketFromRaw(br.duration ?? br.time ?? br.timestamp)
    if (durationBucket == null) continue
    if (!isKeptMatchPlayerDurationBucket(durationBucket)) continue

    out.push({
      matchPlayerId,
      durationBucket,
      currentGold: toIntOr0(br.currentGold ?? br.current_gold),
      magicDamageDone: toIntOr0(br.magicDamageDone ?? br.magic_damage_done),
      magicDamageDoneToChampion: toIntOr0(
        br.magicDamageDoneToChampion ?? br.magic_damage_done_to_champion
      ),
      magicDamageTaken: toIntOr0(br.magicDamageTaken ?? br.magic_damage_taken),
      physicalDamageDone: toIntOr0(br.physicalDamageDone ?? br.physical_damage_done),
      physicalDamageDoneToChampion: toIntOr0(
        br.physicalDamageDoneToChampion ?? br.physical_damage_done_to_champion
      ),
      physicalDamageTaken: toIntOr0(br.physicalDamageTaken ?? br.physical_damage_taken),
      totalDamageDone: toIntOr0(br.totalDamageDone ?? br.total_damage_done),
      totalDamageDoneToChampion: toIntOr0(
        br.totalDamageDoneToChampion ?? br.total_damage_done_to_champion
      ),
      totalDamageTaken: toIntOr0(br.totalDamageTaken ?? br.total_damage_taken),
      trueDamageDone: toIntOr0(br.trueDamageDone ?? br.true_damage_done),
      trueDamageDoneToChampion: toIntOr0(
        br.trueDamageDoneToChampion ?? br.true_damage_done_to_champion
      ),
      trueDamageTaken: toIntOr0(br.trueDamageTaken ?? br.true_damage_taken),
      goldPerSecond: toIntOr0(br.goldPerSecond ?? br.gold_per_second),
      jungleMinionsKilled: toIntOr0(
        br.jungleMinionsKilled ?? br.jungle_minions_killed
      ),
      level: toIntOr0(br.level),
      minionsKilled: toIntOr0(br.minionsKilled ?? br.minions_killed),
      timeEnemySpentControlled: toIntOr0(
        br.timeEnemySpentControlled ?? br.time_enemy_spent_controlled
      ),
      totalGold: toIntOr0(br.totalGold ?? br.total_gold),
      xp: toIntOr0(br.xp),
    })
  }

  return out
}

export async function upsertMatchAndParticipants(
  client: RiotHttpClient,
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
  if (!isAllowedGameVersion(gameVersion)) return
  const gameDuration = info.gameDuration ?? 0
  const infoAny = info as Record<string, unknown>
  const rawGameStartTs =
    (typeof infoAny['gameStartTimestamp'] === 'number' ? (infoAny['gameStartTimestamp'] as number) : null) ??
    (typeof info.gameCreation === 'number' ? info.gameCreation : null)
  const gameDate = rawGameStartTs != null ? new Date(rawGameStartTs) : null
  const participantDtos = info.participants as RiotParticipantDto[]
  const puuids = participantDtos.map((p) => p.puuid).filter(Boolean) as string[]
  const existingPlayers = await prisma.player.findMany({
    where: { puuid: { in: puuids } },
    select: { id: true, puuid: true, puuidKeyVersion: true, gameName: true },
  })
  const existingByPuuid = new Map(existingPlayers.map((p) => [p.puuid, p]))

  // Per-match cache: reduce repeated calls when multiple rows share the same PUUID.
  const accountRankCache = new Map<
    string,
    { rankTier?: string; rankDivision?: string | null; rankLp?: number | null }
  >()
  const debugBucketIngest = process.env.DEBUG_BUCKET_INGEST === '1'
  let bucketDebugLogged = false
  const debugItemIngest = process.env.DEBUG_ITEM_INGEST === '1'
  let itemDebugLogged = false

  function normalizeRankTier(raw: unknown): string | null {
    if (typeof raw !== 'string') return null
    const t = raw.trim().toUpperCase()
    if (!t || t === 'UNRANKED') return null
    return t.split('_')[0]?.trim() || null
  }

  function normalizeRankDivision(raw: unknown): string | null {
    if (raw == null) return null
    if (typeof raw !== 'string') return null
    const d = raw.trim()
    if (!d || d.toUpperCase() === 'UNRANKED') return null
    return d
  }

  function normalizeRankLp(raw: unknown): number | null {
    if (raw == null) return null
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
    if (typeof raw === 'string') {
      const n = Number(raw)
      return Number.isFinite(n) ? Math.trunc(n) : null
    }
    return null
  }

  async function fetchAccountRankIfNeeded(puuid: string): Promise<{
    rankTier?: string
    rankDivision?: string | null
    rankLp?: number | null
  }> {
    const cached = accountRankCache.get(puuid)
    if (cached) return cached

    // Use League v4 entries by PUUID to get tier/rank/LP.
    // We pick SOLO queue by default, as the rest of the pipeline assumes solo/duo bracket.
    const entriesRes = await client.getLeagueEntriesByPuuid(puuid)
    if (!entriesRes.ok || !Array.isArray(entriesRes.data)) {
      const empty = { rankTier: undefined, rankDivision: null, rankLp: null }
      accountRankCache.set(puuid, empty)
      return empty
    }

    const entries = entriesRes.data as unknown as Array<Record<string, unknown>>
    const solo =
      entries.find((e) => e.queueType === 'RANKED_SOLO_5x5') ??
      entries.find((e) => String(e.queueType ?? '').toUpperCase().includes('RANKED_SOLO')) ??
      entries[0]

    const rankTier = normalizeRankTier(solo?.tier)
    const rankDivision = normalizeRankDivision(solo?.rank)
    const rankLp = normalizeRankLp(solo?.leaguePoints)

    const out = { rankTier: rankTier ?? undefined, rankDivision, rankLp }
    accountRankCache.set(puuid, out)
    return out
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
      gameDate,
      rankTier: 'UNRANKED',
      rankDivision: '',
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
  const teamRankScoresByRiotTeam = new Map<number, number[]>()
  const matchRankScores: number[] = []
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

  for (let pIdx = 0; pIdx < participantDtos.length; pIdx++) {
    const p = participantDtos[pIdx]
    const puuid = p.puuid
    if (!puuid) continue
    const { gn: partGameName, tl: partTagName } = participantNames(p)
    const existingPlayer = existingByPuuid.get(puuid)
    let playerId: bigint
    if (existingPlayer == null) {
      let createdNow = false
      let playerRow:
        | { id: bigint; puuid: string; puuidKeyVersion: string | null; gameName: string | null }
        | null = null
      try {
        const newPlayer = await prisma.player.create({
          data: {
            puuid,
            region,
            puuidKeyVersion,
            gameName: partGameName || null,
            tagName: partTagName || null,
            lastSeen: null,
          },
          select: { id: true, puuid: true, puuidKeyVersion: true, gameName: true },
        })
        playerRow = newPlayer
        createdNow = true
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') throw e
        // Race-safe fallback: another worker created this player between read and insert.
        const existing = await prisma.player.findUnique({
          where: { puuid },
          select: { id: true, puuid: true, puuidKeyVersion: true, gameName: true },
        })
        if (!existing) throw e
        playerRow = existing
      }
      playerId = playerRow.id
      existingByPuuid.set(puuid, {
        id: playerRow.id,
        puuid: playerRow.puuid,
        puuidKeyVersion: playerRow.puuidKeyVersion,
        gameName: playerRow.gameName,
      })
      if (createdNow) counters.playersFetched++
    } else {
      playerId = existingPlayer.id
      const playerUpdates: Record<string, unknown> = {}
      if (existingPlayer.puuidKeyVersion === 'perdu' && puuidKeyVersion) {
        playerUpdates['puuidKeyVersion'] = puuidKeyVersion
        existingPlayer.puuidKeyVersion = puuidKeyVersion
      }
      if (partGameName && existingPlayer.gameName !== partGameName) {
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

    const runes = (p as { perks?: unknown }).perks ?? (p as { runes?: unknown }).runes ?? null
    const summoner1Id = (p as { summoner1Id?: number }).summoner1Id ?? null
    const summoner2Id = (p as { summoner2Id?: number }).summoner2Id ?? null
    const statPerks = (() => {
      const perks = (p as { perks?: Record<string, unknown> }).perks
      if (perks && typeof perks === 'object' && 'statPerks' in perks) return perks['statPerks'] ?? null
      return (p as { statPerks?: unknown }).statPerks ?? null
    })()
    const runePayload = buildRunePayload(runes)
    const shardList = buildShardList(statPerks)
    const challenges = (p as { challenges?: unknown }).challenges ?? null
    const ch = (challenges && typeof challenges === 'object' && !Array.isArray(challenges))
      ? challenges as Record<string, unknown>
      : {}

    const n = (key: string, fallback = 0): number => {
      const v = (p as Record<string, unknown>)[key] ?? ch[key]
      return typeof v === 'number' && Number.isFinite(v) ? v : fallback
    }
    const b = (key: string): boolean => (p as Record<string, unknown>)[key] === true

    // Enrich missing rankDivision (and optionally rankTier) from Riot account-by-puuid; LP stays in-memory for averaging only.
    let finalRankTier = rankTier
    let finalRankDivision = rankDivision
    let finalRankLp = rankLp
    if (finalRankDivision == null || finalRankLp == null || finalRankTier === 'UNRANKED') {
      const accountRank = await fetchAccountRankIfNeeded(puuid)
      if (finalRankTier === 'UNRANKED' && accountRank.rankTier) finalRankTier = accountRank.rankTier
      if (finalRankDivision == null && accountRank.rankDivision != null) finalRankDivision = accountRank.rankDivision
      if (finalRankLp == null && accountRank.rankLp != null) finalRankLp = accountRank.rankLp
    }

    const matchPlayer = await prisma.matchPlayer.create({
      data: {
        matchId: match.id,
        playerId,
        teamId: teamDbId,
        championId: p.championId ?? 0,
        role,
        rankTier: finalRankTier,
        rankDivision: finalRankDivision,
        participantId: pIdx + 1,
        runes: runePayload.runes,
        shards: shardList,
        summonerSpells: buildSummonerSpellIds(summoner1Id, summoner2Id),
      },
    })
    counters.participantsFetched++

    if (finalRankTier && finalRankTier !== 'UNRANKED') {
      const score = rankToScore(finalRankTier, finalRankDivision ?? '', finalRankLp ?? null)
      matchRankScores.push(score)
      const list = teamRankScoresByRiotTeam.get(riotTeamId) ?? []
      list.push(score)
      teamRankScoresByRiotTeam.set(riotTeamId, list)
    }

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

    // Items are persisted from timeline reconstruction in extractAndInsertTimelineExtras().
    // Avoid writing placeholder starter/core=false rows here.
    if (debugItemIngest && !itemDebugLogged && logger) {
      itemDebugLogged = true
      const anyObj = p as Record<string, unknown>
      const scalarKeys: string[] = []
      for (let slot = 0; slot <= 6; slot++) {
        if (anyObj[`item${slot}`] != null) scalarKeys.push(`item${slot}`)
      }
      void logger.step('DEBUG item ingest', {
        hasItemsArray: anyObj['items'] != null,
        scalarKeys: scalarKeys.slice(0, 20),
        sampleItem0: anyObj['item0'] ?? null,
      })
    }

    // match_player_bucket (duration buckets of gold/damage/time stats)
    // Source expected: participants[].buckets from match-v5 detail.
    const bucketsRaw = (p as Record<string, unknown>).buckets ?? (p as Record<string, unknown>).bucket ?? null
    if (debugBucketIngest && !bucketDebugLogged && logger) {
      bucketDebugLogged = true
      const isArray = Array.isArray(bucketsRaw)
      const sample0 = isArray && bucketsRaw.length > 0 ? bucketsRaw[0] : null
      const sampleKeys = sample0 && typeof sample0 === 'object' ? Object.keys(sample0 as Record<string, unknown>).slice(0, 25) : []
      const sampleDuration =
        sample0 && typeof sample0 === 'object'
          ? (sample0 as Record<string, unknown>).duration ??
            (sample0 as Record<string, unknown>).time ??
            (sample0 as Record<string, unknown>).timestamp ??
            (sample0 as Record<string, unknown>).endTime ??
            null
          : null
      void logger.step('DEBUG bucket ingest (participant.buckets)', {
        bucketsPresent: bucketsRaw != null,
        bucketsType: bucketsRaw == null ? null : typeof bucketsRaw,
        bucketsIsArray: isArray,
        sampleDuration,
        sampleKeys,
      })
    }
    const bucketRows = buildBucketRows(mpId, bucketsRaw)
    if (bucketRows.length > 0) {
      await prisma.matchPlayerBucket.createMany({ data: bucketRows, skipDuplicates: true })
    }

  }

  // Update team rank_tier as average of team participants (tier only on teams row).
  for (const [riotTeamId, teamDbId] of teamIdByRiotTeam.entries()) {
    const scores = teamRankScoresByRiotTeam.get(riotTeamId) ?? []
    const avg = averageRankFromScores(scores)
    await prisma.team.update({
      where: { id: teamDbId },
      data: { rankTier: avg.tier },
    })
  }

  // Update match rank_tier/rank_division from averaged participant ranks.
  const avgMatch = averageRankFromScores(matchRankScores)
  await prisma.match.update({
    where: { id: match.id },
    data: { rankTier: avgMatch.tier, rankDivision: avgMatch.division },
  })

  if (logger) await logger.info('DB: match_players created', { riotMatchId, count: participantDtos.length })
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

/**
 * Extract and persist drake kills, dragon soul, skill level-up order, and
 * match_players.items payload (starter/core/timestamps) from a match timeline.
 * Idempotent via skipDuplicates / updateMany.
 */
async function extractAndInsertTimelineExtras(
  matchDbId: bigint,
  riotMatchId: string,
  timeline: RiotMatchTimelineDto,
  participantDtos: RiotParticipantDto[],
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

  // ── 3b. Time buckets from timeline participantFrames -> match_player_bucket ──
  const toInt = (v: unknown): number => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
    if (typeof v === 'string') {
      const n = Number(v)
      return Number.isFinite(n) ? Math.trunc(n) : 0
    }
    return 0
  }
  const bucketRows: Array<{
    matchPlayerId: bigint
    durationBucket: number
    currentGold: number
    magicDamageDone: number
    magicDamageDoneToChampion: number
    magicDamageTaken: number
    physicalDamageDone: number
    physicalDamageDoneToChampion: number
    physicalDamageTaken: number
    totalDamageDone: number
    totalDamageDoneToChampion: number
    totalDamageTaken: number
    trueDamageDone: number
    trueDamageDoneToChampion: number
    trueDamageTaken: number
    goldPerSecond: number
    jungleMinionsKilled: number
    level: number
    minionsKilled: number
    timeEnemySpentControlled: number
    totalGold: number
    xp: number
  }> = []
  for (const frame of frames) {
    const durationBucket = timelineTimestampMsToGameMinute(toInt(frame.timestamp))
    if (!isKeptMatchPlayerDurationBucket(durationBucket)) continue
    const pf = frame.participantFrames ?? {}
    for (const [riotPidRaw, pfRaw] of Object.entries(pf)) {
      const riotPid = Number(riotPidRaw)
      if (!Number.isFinite(riotPid) || riotPid <= 0) continue
      const dbId = riotPidToDbId.get(riotPid)
      if (!dbId) continue
      if (!pfRaw || typeof pfRaw !== 'object') continue
      const pfo = pfRaw as Record<string, unknown>
      const damageStats = (pfo['damageStats'] && typeof pfo['damageStats'] === 'object')
        ? (pfo['damageStats'] as Record<string, unknown>)
        : {}
      const championStats = (pfo['championStats'] && typeof pfo['championStats'] === 'object')
        ? (pfo['championStats'] as Record<string, unknown>)
        : {}

      const totalGold = toInt(pfo['totalGold'] ?? pfo['total_gold'])
      const timestampSeconds = Math.max(1, Math.floor(toInt(frame.timestamp) / 1000))

      bucketRows.push({
        matchPlayerId: dbId,
        durationBucket,
        currentGold: toInt(pfo['currentGold'] ?? pfo['current_gold']),
        magicDamageDone: toInt(damageStats['magicDamageDone'] ?? damageStats['magic_damage_done']),
        magicDamageDoneToChampion: toInt(
          damageStats['magicDamageDoneToChampions'] ?? damageStats['magicDamageDoneToChampion'] ?? damageStats['magic_damage_done_to_champion']
        ),
        magicDamageTaken: toInt(damageStats['magicDamageTaken'] ?? damageStats['magic_damage_taken']),
        physicalDamageDone: toInt(damageStats['physicalDamageDone'] ?? damageStats['physical_damage_done']),
        physicalDamageDoneToChampion: toInt(
          damageStats['physicalDamageDoneToChampions'] ?? damageStats['physicalDamageDoneToChampion'] ?? damageStats['physical_damage_done_to_champion']
        ),
        physicalDamageTaken: toInt(damageStats['physicalDamageTaken'] ?? damageStats['physical_damage_taken']),
        totalDamageDone: toInt(damageStats['totalDamageDone'] ?? damageStats['total_damage_done']),
        totalDamageDoneToChampion: toInt(
          damageStats['totalDamageDoneToChampions'] ?? damageStats['totalDamageDoneToChampion'] ?? damageStats['total_damage_done_to_champion']
        ),
        totalDamageTaken: toInt(damageStats['totalDamageTaken'] ?? damageStats['total_damage_taken']),
        trueDamageDone: toInt(damageStats['trueDamageDone'] ?? damageStats['true_damage_done']),
        trueDamageDoneToChampion: toInt(
          damageStats['trueDamageDoneToChampions'] ?? damageStats['trueDamageDoneToChampion'] ?? damageStats['true_damage_done_to_champion']
        ),
        trueDamageTaken: toInt(damageStats['trueDamageTaken'] ?? damageStats['true_damage_taken']),
        goldPerSecond: Math.floor(totalGold / timestampSeconds),
        jungleMinionsKilled: toInt(pfo['jungleMinionsKilled'] ?? pfo['jungle_minions_killed']),
        level: toInt(pfo['level']),
        minionsKilled: toInt(pfo['minionsKilled'] ?? pfo['minions_killed']),
        timeEnemySpentControlled: toInt(
          championStats['timeEnemySpentControlled'] ?? championStats['time_enemy_spent_controlled']
        ),
        totalGold,
        xp: toInt(pfo['xp']),
      })
    }
  }
  if (bucketRows.length > 0) {
    await prisma.matchPlayerBucket.createMany({ data: bucketRows, skipDuplicates: true })
  }

  // ── 4. Build items from timeline + final inventory (starter/boots/core/timestamps) ──
  let itemsRowsUpserted = 0
  for (let idx = 0; idx < participantDtos.length; idx++) {
    const p = participantDtos[idx] as unknown as Record<string, unknown>
    const participantId = idx + 1
    const dbMatchPlayerId = riotPidToDbId.get(participantId)
    if (!dbMatchPlayerId) continue
    const selected = await selectMatchPlayerItems({
      participant: p,
      participantId,
      events: allEvents,
    })
    const tSummoner1 = (p as { summoner1Id?: number }).summoner1Id ?? null
    const tSummoner2 = (p as { summoner2Id?: number }).summoner2Id ?? null
    await prisma.matchPlayer.update({
      where: { id: dbMatchPlayerId },
      data: {
        items: selected.map((row) => ({
          itemId: row.itemId,
          starter: row.starter,
          core: row.core,
          order: row.order,
          timestampMs: row.timestampMs,
        })),
        summonerSpells: buildSummonerSpellIds(tSummoner1, tSummoner2),
      },
    })
    itemsRowsUpserted += selected.length
  }

  if (logger) {
    await logger.info('DB: timeline extras inserted', {
      matchId: riotMatchId,
      drakes: drakeInsertRows.length,
      spellOrders: spellOrderRows.length,
      buckets: bucketRows.length,
      itemsRowsUpserted,
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
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  const fetchMatchAndTimelineStrict = async (
    matchId: string
  ): Promise<{ ok: true; matchDto: RiotMatchDto; timelineDto: RiotMatchTimelineDto } | { ok: false; reason: 'skip' | '400_decrypt' }> => {
    let attempts = 0
    while (!state.shouldStop && attempts < MATCH_FETCH_MAX_ATTEMPTS) {
      attempts++

      const matchRes = await client.getMatch(matchId)
      counters.requestCount++
      if (!matchRes.ok && matchRes.status === 429) counters.error429Count++
      if (!matchRes.ok) {
        if (matchRes.status === 400 && is400Decrypt(matchRes.body)) {
          counters.error400Count++
          await logger.error('400 decrypt on match', matchRes.body)
          return { ok: false, reason: '400_decrypt' }
        }
        await logger.info('Retry match detail fetch', { matchId, attempt: attempts, status: matchRes.status })
        await sleep(MATCH_FETCH_RETRY_DELAY_MS)
        continue
      }
      if (!isAllowedGameVersion(matchRes.data?.info?.gameVersion)) {
        return { ok: false, reason: 'skip' }
      }

      const timelineRes = await client.getMatchTimeline(matchId)
      counters.requestCount++
      if (!timelineRes.ok && timelineRes.status === 429) counters.error429Count++
      if (!timelineRes.ok) {
        const retry = scheduleTimelineRetry(matchId)
        await logger.info('Retry timeline fetch', {
          matchId,
          attempt: attempts,
          status: timelineRes.status,
          retryAttempts: retry.attempts,
        })
        await sleep(MATCH_FETCH_RETRY_DELAY_MS)
        continue
      }
      clearTimelineRetry(matchId)
      return { ok: true, matchDto: matchRes.data, timelineDto: timelineRes.data }
    }

    scheduleTimelineRetry(matchId)
    await logger.info('Skip match ingest after retry exhaustion', { matchId, maxAttempts: MATCH_FETCH_MAX_ATTEMPTS })
    return { ok: false, reason: 'skip' }
  }

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
        await upsertMatchAndParticipants(client, item.region, item.matchDto, item.puuidKeyVersion, counters, logger)
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
                item.matchDto.info?.participants ?? [],
                logger
              )
            } catch (timelineErr) {
              scheduleTimelineRetry(item.matchId)
              // Do not keep partial matches if timeline extras fail to persist.
              await prisma.match.delete({ where: { id: matchRow.id } }).catch(() => undefined)
              await logger.error('Timeline extraction failed; rolled back match', {
                matchId: item.matchId,
                error: timelineErr instanceof Error ? timelineErr.message : String(timelineErr),
              })
              continue
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

    const playersFetchedBefore = counters.playersFetched
    if (!isLikelyRiotPuuid(player.puuid)) {
      await logger.info('Skip player with invalid puuid format', {
        playerId: player.id.toString(),
        puuid: player.puuid,
      })
      await prisma.player.update({
        where: { id: player.id },
        data: { puuidKeyVersion: 'perdu' },
      }).catch(() => undefined)
      continue
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
    const nowMs = Date.now()
    const toFetch = matchIds.filter((id) => !existingSet.has(id) && canAttemptTimelineFetchNow(id, nowMs))

    const fetchTasks = toFetch.map((matchId) => async () => {
      if (state.shouldStop) return
      const strict = await fetchMatchAndTimelineStrict(matchId)
      if (!strict.ok) {
        if (strict.reason === '400_decrypt') throw new Error('400_decrypt')
        return
      }
      await queue.push({
        matchId,
        region,
        matchDto: strict.matchDto,
        timelineDto: strict.timelineDto,
        puuidKeyVersion,
        playerId: player.id,
      })
    })

    try {
      await runWithConcurrency(fetchTasks, MATCH_FETCH_CONCURRENCY)
    } catch (err) {
      if (String(err).includes('400_decrypt')) {
        queue.pushPoison(INGEST_CONSUMER_COUNT)
        await Promise.all(consumerPromises)
        return '400_decrypt'
      }
      throw err
    }
    const newPlayersFromPlayer = counters.playersFetched - playersFetchedBefore
    await logger.step('Player matches fetched', {
      playerId: player.id.toString(),
      region,
      matchesCount: matchIds.length,
      newPlayersCount: newPlayersFromPlayer,
    })
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
    if (state.shouldStop && state.lastError === msg) return
    setState({ shouldStop: true, lastError: msg })
    void logger.error(msg, {})
  })

  const clefType = client.getActiveKeyInfo()?.clefType ?? (await getClefTypeFromFile())
  return { ok: true, client, logger, filters, clefType }
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
  const discord = new DiscordService()
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
    await logger.step('Poller start: entering match collection loop', {})

    // ── Main collection loop ──────────────────────────────────────────────────
    let loopIteration = 0
    while (!state.shouldStop && isDatabaseConfigured()) {
      loopIteration++

      const diskUsage = await getDiskUsagePercent(process.cwd())
      if (diskUsage != null) {
        const roundedUsage = Math.round(diskUsage * 10) / 10
        for (const threshold of DISK_ALERT_THRESHOLDS) {
          if (diskUsage >= threshold && !diskAlertedThresholds.has(threshold)) {
            diskAlertedThresholds.add(threshold)
            await logger.alerte(
              `Disk usage alert: ${roundedUsage}% used (threshold ${threshold}%)`
            )
            await discord.sendAlert(
              'Riot Poller disk usage alert',
              `Disk usage reached ${roundedUsage}% (threshold ${threshold}%).`
            )
          }
        }
        if (diskUsage >= DISK_STOP_THRESHOLD) {
          if (!diskStopAlertSent) {
            diskStopAlertSent = true
            await logger.alerte(
              `Disk usage critical: ${roundedUsage}% used. Stopping poller to protect server.`
            )
            await discord.sendAlert(
              'Riot Poller stopped: critical disk usage',
              `Disk usage reached ${roundedUsage}% (>= ${DISK_STOP_THRESHOLD}%). Poller stopped automatically to prevent server crash.`
            )
          }
          requestStopRiotPoller()
          continue
        }
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
        setTriggerPuuidMigrationOnPollerExit(true)
        requestStopRiotPoller()
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
        setTriggerPuuidMigrationOnPollerExit(true)
        requestStopRiotPoller()
        continue
      }
      if (resultEun === 'prisma_error') await logger.alerte('Prisma error in step 4 (eun1), continuing')

      // ── Sync active_patches puis refresh vues matérialisées (cadence réelle: 4h) ──
      if (Date.now() - lastMvRefreshAt >= MV_REFRESH_EVERY_MS) {
        try {
          await syncActivePatches()
          await refreshAllMaterializedViews()
          lastMvRefreshAt = Date.now()
        } catch (err) {
          await logger.alerte('Refresh MVs error (non-fatal)')
          void err
        }
      }

      // ── Clôture patches passés ayant atteint maxMatches (archive + suppression brutes) ──
      if (loopIteration % 200 === 0) {
        try {
          await runPatchCleanupFromConfig(logger)
        } catch (err) {
          await logger.alerte('Patch cleanup error (non-fatal)')
          void err
        }
      }

      // ── Snapshot quotidien WR / pick / bans par tier (UTC), une fois par jour après l’heure configurée ──
      try {
        await tryRunChampionTierDailySnapshot(logger)
      } catch (err) {
        await logger.alerte('Champion tier snapshot check error (non-fatal)')
        void err
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
  diskAlertedThresholds.clear()
  diskStopAlertSent = false
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
