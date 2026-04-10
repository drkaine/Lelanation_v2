/**
 * Riot poller: runs inside the backend process.
 * - Init: resolves API key (any subsequent 401/403 stops the poller automatically).
 * - Loop: take players, fetch match lists, fetch full match + timeline (fill DB). Sync PUUID / key is optional via `runPhase2` (script puuid-migration only).
 * Logs to backend output (minimal mode); exposes status for admin API.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { statfs } from 'node:fs/promises'
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import {
  loadMatchFilters,
  loadCurrentGameVersion,
  loadGameVersionsRecap,
  computeMatchIdsTimeWindow,
  getPollerPatchRolloutGraceDays,
  resolveLatestPatchPriorityWindow,
} from '../services/RiotConfigService.js'
import type { MatchFiltersConfig } from '../services/RiotConfigService.js'
import { RiotRateLimiter } from '../services/RiotRateLimiter.js'
import { DiscordService } from '../services/DiscordService.js'
import {
  RiotHttpClient,
  resolveRiotApiKey,
  RIOT_INGEST_ABORTED_MESSAGE,
  type RiotMatchDto,
  type RiotParticipantDto,
  type RiotMatchTimelineDto,
  type RiotTimelineEventEliteMonsterKill,
  type RiotTimelineEventDragonSoulGiven,
  type RiotTimelineEventSkillLevelUp,
} from '../services/RiotHttpClient.js'
import { Prisma } from '../generated/prisma/index.js'
import { rankToScore, scoreToRank } from '../utils/rankScore.js'
import { gameVersionFromMatchInfo, normalizeGameVersionToMajorMinor } from '../utils/gameVersion.js'
import { tryRunChampionTierDailySnapshot } from '../services/ChampionTierDailySnapshotService.js'
import { runPatchCleanupFromConfig } from '../services/StatsAggregationService.js'
import { syncActivePatches, refreshAllMaterializedViews } from '../services/MaterializedViewService.js'
import {
  isKeptMatchPlayerDurationBucket,
  timelineTimestampMsToGameMinute,
} from './matchPlayerBucketPolicy.js'
import { selectMatchPlayerItems } from './itemBuildSelection.js'

const PLAYERS_PER_LOOP = 20

const TIMELINE_RETRY_BASE_DELAY_MS = 60_000
const TIMELINE_RETRY_MAX_DELAY_MS = 15 * 60_000
const TIMELINE_RETRY_MAX_ATTEMPTS = 8
const MATCH_FETCH_RETRY_DELAY_MS = 2_000
const MATCH_FETCH_MAX_ATTEMPTS = 40
const MV_REFRESH_EVERY_MS = 4 * 60 * 60 * 1000
const POLLER_SUMMARY_30M_MS = 30 * 60 * 1000

/** Ragrégateur `poller_hourly` : défaut 1h ; ex. `POLLER_HOURLY_SUMMARY_MS=60000` pour tester (min 60s, max 24h). */
function getPollerHourlySummaryIntervalMs(): number {
  const raw = parseInt(process.env.POLLER_HOURLY_SUMMARY_MS ?? '', 10)
  const fallback = 60 * 60 * 1000
  if (!Number.isFinite(raw) || raw <= 0) return fallback
  const minMs = 60_000
  const maxMs = 24 * 60 * 60 * 1000
  return Math.min(maxMs, Math.max(minMs, raw))
}
/** Dernière exécution du refresh MV (process). Initialisé à « maintenant » pour qu’un redémarrage (ex. `make build` → pm2) ne déclenche pas un refresh tout de suite : avec `0`, `Date.now()-0` dépassait toujours 4h. */
let lastMvRefreshAt = Date.now()

const timelineRetryState = new Map<string, { attempts: number; nextRetryAtMs: number }>()

const MIN_ALLOWED_MAJOR = 16
const MIN_ALLOWED_MINOR = 1
const DISK_ALERT_THRESHOLDS = [85, 90, 95] as const
const DISK_STOP_THRESHOLD = 98
const diskAlertedThresholds = new Set<number>()
let diskStopAlertSent = false

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
  playersPolled: number
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
  playersPolled: 0,
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

/** Riot calls for match ingest: retry every 429 until success; bail with RIOT_INGEST_ABORTED_MESSAGE if poller stops. */
function riotIngestRequestOptions(): {
  infinite429Retry: true
  shouldAbort: () => boolean
} {
  return { infinite429Retry: true, shouldAbort: () => state.shouldStop }
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

function comparePatchVersionDesc(a: string, b: string): number {
  const [aMajRaw, aMinRaw] = (a ?? '').trim().split('.')
  const [bMajRaw, bMinRaw] = (b ?? '').trim().split('.')
  const aMaj = Number(aMajRaw)
  const aMin = Number(aMinRaw)
  const bMaj = Number(bMajRaw)
  const bMin = Number(bMinRaw)
  const aMajSafe = Number.isFinite(aMaj) ? aMaj : -1
  const aMinSafe = Number.isFinite(aMin) ? aMin : -1
  const bMajSafe = Number.isFinite(bMaj) ? bMaj : -1
  const bMinSafe = Number.isFinite(bMin) ? bMin : -1
  if (aMajSafe !== bMajSafe) return bMajSafe - aMajSafe
  if (aMinSafe !== bMinSafe) return bMinSafe - aMinSafe
  return b.localeCompare(a)
}

async function resolvePatchPollingPolicy(): Promise<{
  latestPatch: string | null
  latestPatchOnly: boolean
}> {
  const patches = await prisma.activePatch.findMany({
    select: { gameVersion: true, gamesNumber: true, gameNumberMax: true },
  })
  if (patches.length === 0) return { latestPatch: null, latestPatchOnly: false }

  const latest = [...patches].sort((x, y) => comparePatchVersionDesc(x.gameVersion, y.gameVersion))[0]
  const max = Math.trunc(Number(latest.gameNumberMax ?? 0))
  const current = Math.trunc(Number(latest.gamesNumber ?? 0))
  const latestPatchOnly = max > 0 && current < max

  /** Patch « live » = data/game/version.json (sync Data Dragon), pas active_patches (peut traîner). */
  let latestPatch: string | null = null
  const versionInfoRes = await loadCurrentGameVersion()
  if (versionInfoRes.isOk()) {
    const info = versionInfoRes.unwrap()
    if (info?.currentVersion?.trim()) {
      latestPatch = normalizeGameVersionToMajorMinor(info.currentVersion) || null
    }
  }
  if (!latestPatch) {
    latestPatch =
      normalizeGameVersionToMajorMinor(latest.gameVersion) || (latest.gameVersion?.trim() || null)
  }

  return { latestPatch, latestPatchOnly }
}

function averageRankFromScores(scores: number[]): { tier: string; division: string } {
  if (scores.length === 0) return { tier: 'UNRANKED', division: '' }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return scoreToRank(avg)
}

/** Rank fields from match-v5 participant payload (may be incomplete for historical games). */
function participantRankFromDto(p: RiotParticipantDto): {
  tier: string
  division: string | null
  lp: number | null
} {
  const tier = (p as { tier?: string }).tier ?? (p as { rankTier?: string }).rankTier ?? 'UNRANKED'
  const division = (p as { rank?: string }).rank ?? (p as { rankDivision?: string }).rankDivision ?? null
  const lp = (p as { leaguePoints?: number }).leaguePoints ?? (p as { rankLp?: number }).rankLp ?? null
  return { tier, division, lp }
}

function needsLeagueRankApiFromDto(p: RiotParticipantDto): boolean {
  const { tier, division, lp } = participantRankFromDto(p)
  return division == null || lp == null || tier === 'UNRANKED'
}

type ResolvedParticipantRank = { tier: string; division: string | null; lp: number | null }

function mergeDtoWithAccountCache(
  p: RiotParticipantDto,
  puuid: string,
  accountRankCache: Map<
    string,
    { rankTier?: string; rankDivision?: string | null; rankLp?: number | null }
  >
): ResolvedParticipantRank {
  let { tier, division, lp } = participantRankFromDto(p)
  if (division == null || lp == null || tier === 'UNRANKED') {
    const acc = accountRankCache.get(puuid)
    if (acc?.rankTier && acc.rankTier !== 'UNRANKED') tier = acc.rankTier
    if (division == null && acc?.rankDivision != null) division = acc.rankDivision
    if (lp == null && acc?.rankLp != null) lp = acc.rankLp
  }
  return { tier, division, lp }
}

function needsRankPeerFill(r: ResolvedParticipantRank): boolean {
  return r.division == null || r.lp == null || r.tier === 'UNRANKED'
}

function fillParticipantRankFromPeers(
  idx: number,
  ranks: ResolvedParticipantRank[]
): ResolvedParticipantRank {
  const scores: number[] = []
  for (let i = 0; i < ranks.length; i++) {
    if (i === idx) continue
    const b = ranks[i]
    if (b.tier !== 'UNRANKED') {
      scores.push(rankToScore(b.tier, b.division ?? '', b.lp))
    }
  }
  if (scores.length === 0) return { tier: 'UNRANKED', division: null, lp: null }
  const avg = averageRankFromScores(scores)
  return { tier: avg.tier, division: avg.division || null, lp: null }
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
  let lastPulseMs = Date.now()
  let lastTotalSynced = 0
  let lastReqCount = state.requestCount

  while (!shouldStop()) {
    if (Date.now() - lastPulseMs >= POLLER_SUMMARY_30M_MS) {
      await appendUnifiedLog({
        section: 'back',
        type: 'info',
        script: 'puuid_migration',
        message: 'Resume migration PUUID (30 min)',
        json: {
          windowMs: POLLER_SUMMARY_30M_MS,
          migratedDelta: totalSynced - lastTotalSynced,
          requestCountDelta: state.requestCount - lastReqCount,
          totalSynced,
          totalPlaceholder,
        },
      })
      lastPulseMs = Date.now()
      lastTotalSynced = totalSynced
      lastReqCount = state.requestCount
    }
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

  await appendUnifiedLog({
    section: 'back',
    type: 'info',
    script: 'puuid_migration',
    message: 'Resume migration PUUID (final)',
    json: { totalSynced, totalPlaceholder, requestCount: state.requestCount },
  })
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

  const gameDuration = info.gameDuration ?? 0
  const infoAny = info as Record<string, unknown>
  const rawGameStartTs =
    (typeof infoAny['gameStartTimestamp'] === 'number' ? (infoAny['gameStartTimestamp'] as number) : null) ??
    (typeof info.gameCreation === 'number' ? info.gameCreation : null)
  const gameDate = rawGameStartTs != null ? new Date(rawGameStartTs) : null
  const participantDtos = info.participants as RiotParticipantDto[]
  const puuids = participantDtos.map((p) => p.puuid).filter(Boolean) as string[]

  const maxGameByPuuid = new Map<string, Date>()
  if (puuids.length > 0) {
    const rows = await prisma.$queryRaw<Array<{ puuid: string; max_game: Date | null }>>`
      SELECT pl.puuid, MAX(m.game_date) AS max_game
      FROM players pl
      INNER JOIN match_players mp ON mp.player_id = pl.id
      INNER JOIN matchs m ON m.id = mp.match_id
      WHERE pl.puuid IN (${Prisma.join(puuids)})
      GROUP BY pl.puuid
    `
    for (const r of rows) {
      if (r.max_game) maxGameByPuuid.set(r.puuid, r.max_game)
    }
  }

  function isNewestStoredMatchForPuuid(puuid: string): boolean {
    if (!gameDate) return false
    const max = maxGameByPuuid.get(puuid)
    if (!max) return true
    return gameDate.getTime() > max.getTime()
  }

  // League-v4 rank lookups run outside the DB transaction so we don't hold connections during HTTP / 429 waits.
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

  async function fetchAccountRankForParticipant(puuid: string): Promise<void> {
    if (accountRankCache.has(puuid)) return
    const entriesRes = await client.getLeagueEntriesByPuuid(puuid, riotIngestRequestOptions())
    if (!entriesRes.ok) {
      if (entriesRes.message === RIOT_INGEST_ABORTED_MESSAGE) {
        throw new Error(RIOT_INGEST_ABORTED_MESSAGE)
      }
      accountRankCache.set(puuid, { rankTier: undefined, rankDivision: null, rankLp: null })
      return
    }
    if (!Array.isArray(entriesRes.data)) {
      accountRankCache.set(puuid, { rankTier: undefined, rankDivision: null, rankLp: null })
      return
    }
    const entries = entriesRes.data as unknown as Array<Record<string, unknown>>
    const solo =
      entries.find((e) => e.queueType === 'RANKED_SOLO_5x5') ??
      entries.find((e) => String(e.queueType ?? '').toUpperCase().includes('RANKED_SOLO')) ??
      entries[0]
    const rankTier = normalizeRankTier(solo?.tier)
    const rankDivision = normalizeRankDivision(solo?.rank)
    const rankLp = normalizeRankLp(solo?.leaguePoints)
    accountRankCache.set(puuid, { rankTier: rankTier ?? undefined, rankDivision, rankLp })
  }

  try {
    for (const p of participantDtos) {
      const pid = p.puuid
      if (!pid) continue
      if (!needsLeagueRankApiFromDto(p)) continue
      if (!isNewestStoredMatchForPuuid(pid)) continue
      await fetchAccountRankForParticipant(pid)
    }
  } catch (e) {
    if (e instanceof Error && e.message === RIOT_INGEST_ABORTED_MESSAGE) return
    throw e
  }

  const resolvedRanks: ResolvedParticipantRank[] = participantDtos.map((p) => {
    const pid = p.puuid
    if (!pid) return { tier: 'UNRANKED', division: null, lp: null }
    return mergeDtoWithAccountCache(p, pid, accountRankCache)
  })
  for (let ri = 0; ri < resolvedRanks.length; ri++) {
    if (needsRankPeerFill(resolvedRanks[ri])) {
      resolvedRanks[ri] = fillParticipantRankFromPeers(ri, resolvedRanks)
    }
  }

  const gameEndedInSurrender = participantDtos.some(
    (p) => (p as { gameEndedInSurrender?: boolean }).gameEndedInSurrender === true
  )
  const gameEndedInEarlySurrender = participantDtos.some(
    (p) => (p as { gameEndedInEarlySurrender?: boolean }).gameEndedInEarlySurrender === true
  )

  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.match.findUnique({ where: { riotMatchId }, select: { id: true } })
      if (existing) return

      const gameVersion = normalizeGameVersionToMajorMinor(gameVersionFromMatchInfo(info))
      if (!isAllowedGameVersion(gameVersion)) return

      const existingPlayers = await tx.player.findMany({
        where: { puuid: { in: puuids } },
        select: { id: true, puuid: true, puuidKeyVersion: true, gameName: true },
      })
      const existingByPuuid = new Map(existingPlayers.map((p) => [p.puuid, p]))

      const match = await tx.match.create({
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
    const created = await tx.team.create({ data: teamRow })
    teamIdByRiotTeam.set(teamRow.team, created.id)
    if (bans.length > 0) {
      await tx.ban.createMany({
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
        const newPlayer = await tx.player.create({
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
        const existing = await tx.player.findUnique({
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
        await tx.player.update({ where: { id: existingPlayer.id }, data: playerUpdates })
      }
    }

    const role = roleFromPosition(p.teamPosition, p.individualPosition) ?? 'FILL'
    const rr = resolvedRanks[pIdx]
    const finalRankTier = rr.tier
    const finalRankDivision = rr.division
    const finalRankLp = rr.lp
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

    if (gameDate && isNewestStoredMatchForPuuid(puuid)) {
      await tx.player.update({
        where: { id: playerId },
        data: {
          rankTier: finalRankTier === 'UNRANKED' ? null : finalRankTier,
          rankDivision: finalRankDivision,
          rankLp: finalRankLp,
          rankSnapshotGameDate: gameDate,
        },
      })
    }

    const matchPlayer = await tx.matchPlayer.create({
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

    await tx.matchPlayerCore.create({
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

    await tx.matchPlayerVisions.create({
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

    await tx.matchPlayerMatchup.create({
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

    await tx.matchPlayerObjectives.create({
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

    await tx.matchPlayerCombats.create({
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
      await tx.matchPlayerChallenges.create({
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
      await tx.matchPlayerBucket.createMany({ data: bucketRows, skipDuplicates: true })
    }

  }

  // Update team rank_tier as average of team participants (tier only on teams row).
  for (const [riotTeamId, teamDbId] of teamIdByRiotTeam.entries()) {
    const scores = teamRankScoresByRiotTeam.get(riotTeamId) ?? []
    const avg = averageRankFromScores(scores)
    await tx.team.update({
      where: { id: teamDbId },
      data: { rankTier: avg.tier },
    })
  }

  // Update match rank_tier/rank_division from averaged participant ranks.
  const avgMatch = averageRankFromScores(matchRankScores)
  await tx.match.update({
    where: { id: match.id },
    data: { rankTier: avgMatch.tier, rankDivision: avgMatch.division },
  })

      if (logger) await logger.info('DB: match_players created', { riotMatchId, count: participantDtos.length })
    },
    { maxWait: 15_000, timeout: 180_000 }
  )
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
    playersPolled: number
    participantsFetched: number
  },
  matchListTimeWindow: { startTime: number; endTime: number } | null
): Promise<'ok' | '400_decrypt' | 'prisma_error'> {
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  type StrictFetchResult =
    | { ok: true; matchDto: RiotMatchDto; timelineDto: RiotMatchTimelineDto }
    | { ok: false; reason: '400_decrypt' | 'abort' | 'version' | 'transient' | 'deferred_patch' }

  const patchPolicy = await resolvePatchPollingPolicy()
  let latestPatchDateWindow: { startTime: number; endTime: number } | null = null
  /** Patchs normalisés (major.minor) acceptés en mode priorité live ; grâce post-release = latest + N-1. */
  let priorityAllowedPatches: string[] | null = null
  if (patchPolicy.latestPatchOnly && patchPolicy.latestPatch) {
    const currentRes = await loadCurrentGameVersion()
    const recapRes = await loadGameVersionsRecap()
    const releaseDate = currentRes.isOk() ? currentRes.unwrap()?.releaseDate : undefined
    const recap = recapRes.isOk() ? recapRes.unwrap() : null
    const w = resolveLatestPatchPriorityWindow({
      latestPatch: patchPolicy.latestPatch,
      currentReleaseDate: releaseDate,
      recap,
      graceDays: getPollerPatchRolloutGraceDays(),
      nowSec: Math.floor(Date.now() / 1000),
    })
    if (Number.isFinite(w.matchListStartTime)) {
      latestPatchDateWindow = {
        startTime: w.matchListStartTime,
        endTime: Math.floor(Date.now() / 1000),
      }
    }
    priorityAllowedPatches = w.allowedPatches.length ? w.allowedPatches : [patchPolicy.latestPatch]
  }

  const fetchMatchAndTimelineStrict = async (matchId: string): Promise<StrictFetchResult> => {
    let attempts = 0
    while (!state.shouldStop && attempts < MATCH_FETCH_MAX_ATTEMPTS) {
      attempts++

      const matchRes = await client.getMatch(matchId, riotIngestRequestOptions())
      counters.requestCount++
      if (!matchRes.ok && matchRes.status === 429) counters.error429Count++
      if (!matchRes.ok) {
        if (matchRes.status === 400 && is400Decrypt(matchRes.body)) {
          counters.error400Count++
          await logger.error('400 decrypt on match', matchRes.body)
          return { ok: false, reason: '400_decrypt' }
        }
        if (matchRes.message === RIOT_INGEST_ABORTED_MESSAGE) {
          return { ok: false, reason: 'abort' }
        }
        await logger.info('Retry match detail fetch', { matchId, attempt: attempts, status: matchRes.status })
        await sleep(MATCH_FETCH_RETRY_DELAY_MS)
        continue
      }
      if (
        !isAllowedGameVersion(
          normalizeGameVersionToMajorMinor(gameVersionFromMatchInfo(matchRes.data?.info))
        )
      ) {
        return { ok: false, reason: 'version' }
      }
      if (patchPolicy.latestPatchOnly) {
        const matchPatch = normalizeGameVersionToMajorMinor(gameVersionFromMatchInfo(matchRes.data?.info))
        const allowed = priorityAllowedPatches ?? []
        if (!allowed.includes(matchPatch)) {
          return { ok: false, reason: 'deferred_patch' }
        }
      }

      const timelineRes = await client.getMatchTimeline(matchId, riotIngestRequestOptions())
      counters.requestCount++
      if (!timelineRes.ok && timelineRes.status === 429) counters.error429Count++
      if (!timelineRes.ok) {
        if (timelineRes.message === RIOT_INGEST_ABORTED_MESSAGE) {
          return { ok: false, reason: 'abort' }
        }
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
    return { ok: false, reason: 'transient' }
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

  const flags = { foundPrismaError: false }

  const matchIdsQueryBase: {
    queue: number; count: number; start: number; startTime?: number; endTime?: number
  } = { queue: filters.queue, count: filters.count, start: 0 }
  if (latestPatchDateWindow) {
    matchIdsQueryBase.startTime = latestPatchDateWindow.startTime
    matchIdsQueryBase.endTime = latestPatchDateWindow.endTime
  } else if (matchListTimeWindow) {
    matchIdsQueryBase.startTime = matchListTimeWindow.startTime
    matchIdsQueryBase.endTime = matchListTimeWindow.endTime
  }

  // ── Phase 1: Collect match work items across all players ──────────────

  type PlayerTracker = {
    player: typeof players[number]
    matchIds: string[]
    toFetchCount: number
    pendingTransientIngest: boolean
    ingestedIds: string[]
    playersFetchedBefore: number
  }
  const playerTrackers: PlayerTracker[] = []
  type MatchWorkItem = { matchId: string; trackerIdx: number }
  const workItems: MatchWorkItem[] = []

  for (const player of players) {
    counters.playersPolled++
    if (state.shouldStop) return 'ok'

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

    const matchIdsRes = await client.getMatchIdsByPuuid(
      player.puuid,
      matchIdsQueryBase,
      riotIngestRequestOptions()
    )
    counters.requestCount++
    if (!matchIdsRes.ok && matchIdsRes.status === 429) counters.error429Count++
    if (!matchIdsRes.ok) {
      if (matchIdsRes.message === RIOT_INGEST_ABORTED_MESSAGE) return 'ok'
      if (matchIdsRes.status === 400 && is400Decrypt(matchIdsRes.body)) {
        counters.error400Count++
        await logger.error('400 decrypt', matchIdsRes.body)
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
    const toFetch = matchIds.filter(
      (id) => !existingSet.has(id) && canAttemptTimelineFetchNow(id, nowMs)
    )

    const trackerIdx = playerTrackers.length
    const tracker: PlayerTracker = {
      player,
      matchIds,
      toFetchCount: toFetch.length,
      pendingTransientIngest: false,
      ingestedIds: [],
      playersFetchedBefore: counters.playersFetched,
    }
    playerTrackers.push(tracker)

    if (toFetch.length === 0) {
      await prisma.player.update({
        where: { id: player.id },
        data: { lastSeen: new Date() },
      })
      await logger.step('Player matches fetched', {
        playerId: player.id.toString(),
        region,
        matchesCount: matchIds.length,
        newPlayersCount: 0,
      })
      continue
    }

    for (const matchId of toFetch) {
      workItems.push({ matchId, trackerIdx })
    }
  }

  if (workItems.length === 0) return flags.foundPrismaError ? 'prisma_error' : 'ok'

  // ── Phase 2: Pipeline — concurrent API fetch + sequential DB ingest ───
  // Producer fires API calls at max rate-limiter speed.
  // Consumer ingests into DB concurrently — so DB work never blocks the API.

  const PIPELINE_QUEUE_MAX = 8
  const ingestQueue: Array<{
    matchId: string
    trackerIdx: number
    matchDto: RiotMatchDto
    timelineDto: RiotMatchTimelineDto
  }> = []
  let producerDone = false
  let pipelineAbort: '400_decrypt' | 'abort' | null = null

  const ingestConsumer = (async () => {
    while (true) {
      if (pipelineAbort || state.shouldStop) break
      if (ingestQueue.length > 0) {
        const item = ingestQueue.shift()!
        const tracker = playerTrackers[item.trackerIdx]
        try {
          await upsertMatchAndParticipants(
            client, region, item.matchDto, puuidKeyVersion, counters, logger
          )
          const matchRow = await prisma.match.findUnique({
            where: { riotMatchId: item.matchId },
            select: { id: true },
          })
          if (!matchRow) throw new Error(`match missing after upsert: ${item.matchId}`)
          await extractAndInsertJungleFirstClear(matchRow.id, item.matchId, item.timelineDto, logger)
          await extractAndInsertTimelineExtras(
            matchRow.id, item.matchId, item.timelineDto,
            item.matchDto.info?.participants ?? [], logger
          )
          tracker.ingestedIds.push(item.matchId)
        } catch (err) {
          await prisma.match.deleteMany({ where: { riotMatchId: item.matchId } }).catch(() => undefined)
          if (err instanceof Error && err.message === RIOT_INGEST_ABORTED_MESSAGE) return
          tracker.pendingTransientIngest = true
          await logger.error('Player match ingest failed', {
            playerId: tracker.player.id.toString(),
            matchId: item.matchId,
            error: err instanceof Error ? err.message : String(err),
          })
          flags.foundPrismaError = true
        }
      } else if (producerDone) {
        break
      } else {
        await sleep(10)
      }
    }
  })()

  for (const work of workItems) {
    if (state.shouldStop || pipelineAbort) break
    while (ingestQueue.length >= PIPELINE_QUEUE_MAX && !state.shouldStop && !pipelineAbort) {
      await sleep(10)
    }
    if (state.shouldStop || pipelineAbort) break

    const tracker = playerTrackers[work.trackerIdx]
    const strict = await fetchMatchAndTimelineStrict(work.matchId)
    if (!strict.ok) {
      if (strict.reason === '400_decrypt') { pipelineAbort = '400_decrypt'; break }
      if (strict.reason === 'abort') { pipelineAbort = 'abort'; break }
      if (strict.reason === 'version') {
        tracker.pendingTransientIngest = true
        await logger.info('Match skipped (game version not in allowed range)', {
          playerId: tracker.player.id.toString(),
          matchId: work.matchId,
        })
        continue
      }
      if (strict.reason === 'deferred_patch') {
        await logger.info('Match deferred (latest patch priority mode)', {
          playerId: tracker.player.id.toString(),
          matchId: work.matchId,
          latestPatch: patchPolicy.latestPatch,
          allowedPatches: priorityAllowedPatches,
        })
        continue
      }
      tracker.pendingTransientIngest = true
      await logger.info('Player ingest: match not ready (API), will retry on a later loop', {
        playerId: tracker.player.id.toString(),
        matchId: work.matchId,
      })
      continue
    }

    ingestQueue.push({
      matchId: work.matchId,
      trackerIdx: work.trackerIdx,
      matchDto: strict.matchDto,
      timelineDto: strict.timelineDto,
    })
  }

  producerDone = true
  await ingestConsumer

  if (pipelineAbort === '400_decrypt') return '400_decrypt'
  if (pipelineAbort === 'abort') return 'ok'

  // ── Phase 3: Post-processing — verify ingested, lastSeen, logging ─────

  for (const tracker of playerTrackers) {
    if (tracker.toFetchCount === 0) continue

    if (tracker.ingestedIds.length > 0) {
      const dbCount = await prisma.match.count({
        where: { riotMatchId: { in: tracker.ingestedIds } },
      })
      if (dbCount !== tracker.ingestedIds.length) {
        await appendUnifiedLog({
          section: 'db',
          type: 'warning',
          script: 'poller',
          message: `Écart DB: ${tracker.ingestedIds.length} match(s) attendus, ${dbCount} présents`,
          json: {
            playerId: tracker.player.id.toString(),
            region,
            expected: tracker.ingestedIds.length,
            dbCount,
            riotMatchIdsSample: tracker.ingestedIds.slice(0, 32),
          },
        })
      }
    }

    if (!tracker.pendingTransientIngest && !state.shouldStop) {
      await prisma.player.update({
        where: { id: tracker.player.id },
        data: { lastSeen: new Date() },
      })
    }

    const newPlayersFromPlayer = counters.playersFetched - tracker.playersFetchedBefore
    await logger.step('Player matches fetched', {
      playerId: tracker.player.id.toString(),
      region,
      matchesCount: tracker.matchIds.length,
      newPlayersCount: newPlayersFromPlayer,
      pendingTransientIngest: tracker.pendingTransientIngest,
    })
  }

  return flags.foundPrismaError ? 'prisma_error' : 'ok'
}

/** Resolves the API key and sets it on the client without making a test request. */
export async function initRiotPoller(): Promise<RiotPollerInit | { ok: false }> {
  if (!isDatabaseConfigured()) {
    setState({ lastError: 'DATABASE_URL not set' })
    return { ok: false }
  }
  const logger = createRiotPollerLogger()
  const rateLimiter = new RiotRateLimiter()
  const client = new RiotHttpClient(rateLimiter, logger, 'poller')
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

  const clefType = client.getActiveKeyInfo()?.clefType ?? null
  return { ok: true, client, logger, filters, clefType }
}

async function runStep4Counters() {
  return {
    requestCount: state.requestCount,
    error429Count: state.error429Count,
    error400Count: state.error400Count,
    matchesFetched: state.matchesFetched,
    playersFetched: state.playersFetched,
    playersPolled: state.playersPolled,
    participantsFetched: state.participantsFetched,
  }
}

async function runLoop(init: RiotPollerInit): Promise<void> {
  const { client, logger, filters, clefType } = init
  const discord = new DiscordService()
  const hourlySummaryIntervalMs = getPollerHourlySummaryIntervalMs()
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
    playersPolled: 0,
    participantsFetched: 0,
    matchesRankFixed: 0,
    participantsRankFixed: 0,
    participantsRoleFixed: 0,
  })

  try {
    const recapRes = await loadGameVersionsRecap()
    let matchListTimeWindow: { startTime: number; endTime: number } | null = null
    if (recapRes.isOk()) {
      matchListTimeWindow = computeMatchIdsTimeWindow(filters, recapRes.unwrap())
    }
    if (recapRes.isErr()) {
      await logger.step('versions.json indisponible — liste matchs sans startTime/endTime', {
        error: recapRes.unwrapErr().message,
      })
    } else if (matchListTimeWindow) {
      await logger.step('Fenêtre liste matchs (data/game/versions.json → Riot ids)', {
        startTime: matchListTimeWindow.startTime,
        endTime: matchListTimeWindow.endTime,
        startIso: new Date(matchListTimeWindow.startTime * 1000).toISOString(),
        endIso: new Date(matchListTimeWindow.endTime * 1000).toISOString(),
      })
    } else {
      await logger.step(
        'Pas de fenêtre start/end — vérifier match-filters.json vs versions.json (patchLabel)',
        {}
      )
    }

    // ── Main collection loop ──────────────────────────────────────────────────
    let loopIteration = 0
    let heartbeatAtMs = Date.now()
    let heartbeatPlayersPolled = 0
    let heartbeatPlayersFetched = 0
    let heartbeatMatchesFetched = 0
    const initLimiterStats = client.getRateLimiterStats()
    let summary30mWindowStartedAtMs = Date.now()
    let summary30mPlayersPolled = state.playersPolled
    let summary30mPlayersFetched = state.playersFetched
    let summary30mMatchesFetched = state.matchesFetched
    let summary30mRequestCount = state.requestCount
    let summary30mError429Count = state.error429Count
    let summary30mParticipantsFetched = state.participantsFetched
    let summary30mNearLimitPauseCount = initLimiterStats.nearLimitPauseCount
    let summary30mHttp429PauseCount = initLimiterStats.http429PauseCount
    let hourlyWindowStartedAtMs = Date.now()
    let hourlyPlayersPolled = state.playersPolled
    let hourlyPlayersFetched = state.playersFetched
    let hourlyMatchesFetched = state.matchesFetched
    let hourlyRequestCount = state.requestCount
    let hourlyError429Count = state.error429Count
    let hourlyParticipantsFetched = state.participantsFetched
    let hourlyNearLimitPauseCount = initLimiterStats.nearLimitPauseCount
    let hourlyHttp429PauseCount = initLimiterStats.http429PauseCount

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
      const requestCountBeforeEuw = countersEuw.requestCount
      const resultEuw = await runStep4ForPlayer(
        client,
        logger,
        filters,
        'euw1',
        clefType,
        countersEuw,
        matchListTimeWindow
      )
      setState({
        requestCount: countersEuw.requestCount,
        error429Count: countersEuw.error429Count,
        error400Count: countersEuw.error400Count,
        matchesFetched: countersEuw.matchesFetched,
        playersFetched: countersEuw.playersFetched,
        playersPolled: countersEuw.playersPolled,
        participantsFetched: countersEuw.participantsFetched,
      })
      if (resultEuw === '400_decrypt') {
        setTriggerPuuidMigrationOnPollerExit(true)
        requestStopRiotPoller()
        continue
      }
      if (resultEuw === 'prisma_error') {
        await logger.alerte('Prisma error in step 4 (euw1), continuing', {
          region: 'euw1',
          loopIteration,
          requestCountTotal: countersEuw.requestCount,
          requestsDeltaThisRegion: countersEuw.requestCount - requestCountBeforeEuw,
        })
      }

      // EUN1 collection
      client.setPlatform('eun1')
      const countersEun = await runStep4Counters()
      const requestCountBeforeEun = countersEun.requestCount
      const resultEun = await runStep4ForPlayer(
        client,
        logger,
        filters,
        'eun1',
        clefType,
        countersEun,
        matchListTimeWindow
      )
      setState({
        requestCount: countersEun.requestCount,
        error429Count: countersEun.error429Count,
        error400Count: countersEun.error400Count,
        matchesFetched: countersEun.matchesFetched,
        playersFetched: countersEun.playersFetched,
        playersPolled: countersEun.playersPolled,
        participantsFetched: countersEun.participantsFetched,
      })
      if (resultEun === '400_decrypt') {
        setTriggerPuuidMigrationOnPollerExit(true)
        requestStopRiotPoller()
        continue
      }
      if (resultEun === 'prisma_error') {
        await logger.alerte('Prisma error in step 4 (eun1), continuing', {
          region: 'eun1',
          loopIteration,
          requestCountTotal: countersEun.requestCount,
          requestsDeltaThisRegion: countersEun.requestCount - requestCountBeforeEun,
        })
      }

      // ── Sync active_patches puis refresh vues matérialisées (cadence réelle: 4h) ──
      if (Date.now() - lastMvRefreshAt >= MV_REFRESH_EVERY_MS) {
        try {
          await syncActivePatches()
          await refreshAllMaterializedViews()
          lastMvRefreshAt = Date.now()
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          await logger.alerte('Refresh MVs error (non-fatal)', errorMessage)
          // Keep refresh cadence stable even on failures to avoid per-loop retry storms.
          lastMvRefreshAt = Date.now()
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

      const now = Date.now()
      if (now - summary30mWindowStartedAtMs >= POLLER_SUMMARY_30M_MS) {
        const elapsedMs = Math.max(1, now - summary30mWindowStartedAtMs)
        const playersPolledDelta = state.playersPolled - summary30mPlayersPolled
        const playersFetchedDelta = state.playersFetched - summary30mPlayersFetched
        const matchesDelta = state.matchesFetched - summary30mMatchesFetched
        const requestsDelta = state.requestCount - summary30mRequestCount
        const error429Delta = state.error429Count - summary30mError429Count
        const participantsDelta = state.participantsFetched - summary30mParticipantsFetched
        const limiterStats = client.getRateLimiterStats()
        const nearLimitPauseDelta =
          limiterStats.nearLimitPauseCount - summary30mNearLimitPauseCount
        const http429PauseDelta = limiterStats.http429PauseCount - summary30mHttp429PauseCount
        const requestsPerHour = Math.round((requestsDelta * (60 * 60 * 1000)) / elapsedMs)
        const lastRlHeaders30m = client.getLastRiotRateLimitHeaders()
        await appendUnifiedLog({
          section: 'back',
          type: 'info',
          script: 'poller_30m',
          message: `Resume 30 min — polled:+${playersPolledDelta}, matches:+${matchesDelta}, participants:+${participantsDelta}, req:+${requestsDelta} (${requestsPerHour}/h), 429:${error429Delta}, pauses:${nearLimitPauseDelta}`,
          json: {
            windowStartIso: new Date(summary30mWindowStartedAtMs).toISOString(),
            windowEndIso: new Date(now).toISOString(),
            elapsedMs,
            delta: {
              playersPolled: playersPolledDelta,
              newPlayers: playersFetchedDelta,
              matches: matchesDelta,
              participants: participantsDelta,
              requests: requestsDelta,
              error429: error429Delta,
            },
            requestsPerHour,
            rateLimitRefreshPauses: nearLimitPauseDelta,
            rateLimit429Pauses: http429PauseDelta,
            totals: {
              playersPolled: state.playersPolled,
              newPlayers: state.playersFetched,
              matches: state.matchesFetched,
              participants: state.participantsFetched,
              requests: state.requestCount,
              error429: state.error429Count,
              error400: state.error400Count,
            },
            riotRateLimitBuckets: {
              app: limiterStats.appBuckets,
              method: limiterStats.methodBuckets,
            },
            lastRiotRateLimitHeaders: lastRlHeaders30m,
          },
        })
        summary30mWindowStartedAtMs = now
        summary30mPlayersPolled = state.playersPolled
        summary30mPlayersFetched = state.playersFetched
        summary30mMatchesFetched = state.matchesFetched
        summary30mRequestCount = state.requestCount
        summary30mError429Count = state.error429Count
        summary30mParticipantsFetched = state.participantsFetched
        summary30mNearLimitPauseCount = limiterStats.nearLimitPauseCount
        summary30mHttp429PauseCount = limiterStats.http429PauseCount
      }
      if (now - hourlyWindowStartedAtMs >= hourlySummaryIntervalMs) {
        const elapsedMs = Math.max(1, now - hourlyWindowStartedAtMs)
        const playersPolledDelta = state.playersPolled - hourlyPlayersPolled
        const playersFetchedDelta = state.playersFetched - hourlyPlayersFetched
        const matchesDelta = state.matchesFetched - hourlyMatchesFetched
        const requestsDelta = state.requestCount - hourlyRequestCount
        const error429Delta = state.error429Count - hourlyError429Count
        const participantsDelta = state.participantsFetched - hourlyParticipantsFetched
        const limiterStats = client.getRateLimiterStats()
        const nearLimitPauseDelta = limiterStats.nearLimitPauseCount - hourlyNearLimitPauseCount
        const http429PauseDelta = limiterStats.http429PauseCount - hourlyHttp429PauseCount
        const requestsPerHour = Math.round((requestsDelta * (60 * 60 * 1000)) / elapsedMs)
        const lastRlHeadersH = client.getLastRiotRateLimitHeaders()
        await appendUnifiedLog({
          section: 'back',
          type: 'info',
          script: 'poller_hourly',
          message: `Résumé horaire — polled:+${playersPolledDelta}, matches:+${matchesDelta}, participants:+${participantsDelta}, req:+${requestsDelta} (${requestsPerHour}/h), 429:${error429Delta}, pauses:${nearLimitPauseDelta}`,
          json: {
            windowStartIso: new Date(hourlyWindowStartedAtMs).toISOString(),
            windowEndIso: new Date(now).toISOString(),
            elapsedMs,
            delta: {
              playersPolled: playersPolledDelta,
              newPlayers: playersFetchedDelta,
              matches: matchesDelta,
              participants: participantsDelta,
              requests: requestsDelta,
              error429: error429Delta,
            },
            requestsPerHour,
            rateLimitRefreshPauses: nearLimitPauseDelta,
            rateLimit429Pauses: http429PauseDelta,
            totals: {
              playersPolled: state.playersPolled,
              newPlayers: state.playersFetched,
              matches: state.matchesFetched,
              participants: state.participantsFetched,
              requests: state.requestCount,
              error429: state.error429Count,
              error400: state.error400Count,
            },
            riotRateLimitBuckets: {
              app: limiterStats.appBuckets,
              method: limiterStats.methodBuckets,
            },
            lastRiotRateLimitHeaders: lastRlHeadersH,
          },
        })
        hourlyWindowStartedAtMs = now
        hourlyPlayersPolled = state.playersPolled
        hourlyPlayersFetched = state.playersFetched
        hourlyMatchesFetched = state.matchesFetched
        hourlyRequestCount = state.requestCount
        hourlyError429Count = state.error429Count
        hourlyParticipantsFetched = state.participantsFetched
        hourlyNearLimitPauseCount = limiterStats.nearLimitPauseCount
        hourlyHttp429PauseCount = limiterStats.http429PauseCount
      }
      if (now - heartbeatAtMs >= 60_000) {
        const deltaPlayersPolled = state.playersPolled - heartbeatPlayersPolled
        const deltaPlayersFetched = state.playersFetched - heartbeatPlayersFetched
        const deltaMatchesFetched = state.matchesFetched - heartbeatMatchesFetched
        console.log(
          '[RiotPoller] Ping 60s',
          JSON.stringify({
            playersPolled: deltaPlayersPolled,
            newPlayersAdded: deltaPlayersFetched,
            newMatches: deltaMatchesFetched,
            totals: {
              playersPolled: state.playersPolled,
              newPlayersAdded: state.playersFetched,
              newMatches: state.matchesFetched,
            },
          })
        )
        heartbeatPlayersPolled = state.playersPolled
        heartbeatPlayersFetched = state.playersFetched
        heartbeatMatchesFetched = state.matchesFetched
        heartbeatAtMs = now
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logger.error('Poller loop error', msg)
    setState({ lastError: msg })
  } finally {
    setState({ isRunning: false, shouldStop: false, lastLoopFinishedAt: new Date().toISOString() })
    const stopped = getRiotPollerStatus()
    console.log(
      '[RiotPoller] Poller stopped',
      JSON.stringify({
        requestCount: stopped.requestCount,
        error429: stopped.error429Count,
        matchesFetched: stopped.matchesFetched,
        playersFetched: stopped.playersFetched,
        playersPolled: stopped.playersPolled,
        participantsFetched: stopped.participantsFetched,
      })
    )
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
