/**
 * Script 3: Data Enrich (one-shot)
 *
 * Fills missing derived/raw participant data for already-ingested matches:
 * - match_player_items
 * - match_player_runes
 * - match_player_bucket (timeline ; uniquement si game_duration >= 5 min — pas de boucle infinie sur FF/remakes courts)
 * - match_players.rank_division / rank_lp (from league-v4 by PUUID)
 *
 * Runs until no missing rows remain (or stop requested).
 */
import { Prisma } from '../generated/prisma/index.js'
import { prisma, isDatabaseConfigured } from '../db.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { loadRateLimitConfig } from '../services/RiotConfigService.js'
import { RiotRateLimiter } from '../services/RiotRateLimiter.js'
import {
  RiotHttpClient,
  resolveRiotApiKey,
  type RiotLeagueEntryDto,
  type RiotMatchDto,
  type RiotParticipantDto,
  type RiotMatchTimelineDto,
} from '../services/RiotHttpClient.js'
import {
  isKeptMatchPlayerDurationBucket,
  MATCH_PLAYER_BUCKET_MIN_GAME_DURATION_SECONDS,
  timelineTimestampMsToGameMinute,
} from './matchPlayerBucketPolicy.js'

const BATCH_MATCHES = 30

export interface DataEnrichStatus {
  phase: 'init' | 'running' | 'done' | 'error'
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
  requestCount: number
  error429Count: number
  matchesScanned: number
  matchesEnriched: number
  rowsItems: number
  rowsRunes: number
  rowsBuckets: number
  rowsRanks: number
  missingMatches: number
}

let _status: DataEnrichStatus = {
  phase: 'init',
  startedAt: null,
  finishedAt: null,
  lastError: null,
  requestCount: 0,
  error429Count: 0,
  matchesScanned: 0,
  matchesEnriched: 0,
  rowsItems: 0,
  rowsRunes: 0,
  rowsBuckets: 0,
  rowsRanks: 0,
  missingMatches: 0,
}

export function getDataEnrichStatus(): DataEnrichStatus {
  return { ..._status }
}

function toIntOr0(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  if (typeof raw === 'string') {
    const n = Number(raw)
    return Number.isFinite(n) ? Math.trunc(n) : 0
  }
  return 0
}

function buildItemRows(matchPlayerId: bigint, participant: Record<string, unknown>): Array<{
  matchPlayerId: bigint
  itemId: number
  order: number
}> {
  const itemsRaw = participant.items
  if (Array.isArray(itemsRaw)) {
    const out: Array<{ matchPlayerId: bigint; itemId: number; order: number }> = []
    for (let slot = 0; slot < itemsRaw.length && slot <= 6; slot++) {
      const itemId = Number(itemsRaw[slot])
      if (Number.isFinite(itemId) && itemId > 0) out.push({ matchPlayerId, itemId, order: slot })
    }
    return out
  }
  const out: Array<{ matchPlayerId: bigint; itemId: number; order: number }> = []
  for (let slot = 0; slot <= 6; slot++) {
    const raw = participant[`item${slot}`] ?? participant[`item_${slot}`] ?? null
    const itemId = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
    if (Number.isFinite(itemId) && itemId > 0) out.push({ matchPlayerId, itemId, order: slot })
  }
  return out
}

function buildRuneRows(matchPlayerId: bigint, participant: Record<string, unknown>): Array<{
  matchPlayerId: bigint
  perkId: number
  style: number
}> {
  const runes = participant.perks ?? participant.runes
  if (!runes || typeof runes !== 'object') return []
  const styles = Array.isArray((runes as Record<string, unknown>).styles)
    ? ((runes as Record<string, unknown>).styles as unknown[])
    : Array.isArray(runes)
      ? (runes as unknown[])
      : []
  const out: Array<{ matchPlayerId: bigint; perkId: number; style: number }> = []
  for (const style of styles) {
    if (!style || typeof style !== 'object') continue
    const s = style as Record<string, unknown>
    const styleId = Number(s.id ?? s.styleId ?? s.style_id ?? s.style)
    if (!Number.isFinite(styleId)) continue
    const selections = Array.isArray(s.selections) ? s.selections : Array.isArray(s.selection) ? s.selection : []
    for (const sel of selections) {
      if (typeof sel === 'number' && Number.isFinite(sel)) {
        out.push({ matchPlayerId, perkId: sel, style: styleId })
        continue
      }
      if (!sel || typeof sel !== 'object') continue
      const so = sel as Record<string, unknown>
      const perkId = Number(so.perk ?? so.perkId ?? so.perk_id ?? so.id)
      if (!Number.isFinite(perkId)) continue
      out.push({ matchPlayerId, perkId, style: styleId })
    }
  }
  return out
}

function normalizeTier(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim().toUpperCase()
  if (!t || t === 'UNRANKED') return null
  return t.split('_')[0] ?? null
}
function normalizeDivision(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const d = raw.trim().toUpperCase()
  if (!d || d === 'UNRANKED') return null
  return d
}

async function getMissingMatchIds(limit: number): Promise<string[]> {
  const minDur = MATCH_PLAYER_BUCKET_MIN_GAME_DURATION_SECONDS
  const rows = await prisma.$queryRaw<Array<{ riot_match_id: string }>>(Prisma.sql`
    SELECT DISTINCT m.riot_match_id
    FROM matchs m
    JOIN match_players mp ON mp.match_id = m.id
    LEFT JOIN match_player_items mpi ON mpi.match_player_id = mp.id
    LEFT JOIN match_player_runes mpr ON mpr.match_player_id = mp.id
    LEFT JOIN match_player_bucket mpb ON mpb.match_player_id = mp.id
    WHERE mp.rank_division IS NULL
       OR mp.rank_division = ''
       OR mp.rank_lp IS NULL
       OR mpi.match_player_id IS NULL
       OR mpr.match_player_id IS NULL
       OR (mpb.match_player_id IS NULL AND m.game_duration >= ${minDur})
    ORDER BY m.riot_match_id ASC
    LIMIT ${limit}
  `)
  return rows.map((r) => r.riot_match_id)
}

async function countMissingMatches(): Promise<number> {
  const minDur = MATCH_PLAYER_BUCKET_MIN_GAME_DURATION_SECONDS
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT DISTINCT m.riot_match_id
      FROM matchs m
      JOIN match_players mp ON mp.match_id = m.id
      LEFT JOIN match_player_items mpi ON mpi.match_player_id = mp.id
      LEFT JOIN match_player_runes mpr ON mpr.match_player_id = mp.id
      LEFT JOIN match_player_bucket mpb ON mpb.match_player_id = mp.id
      WHERE mp.rank_division IS NULL
         OR mp.rank_division = ''
         OR mp.rank_lp IS NULL
         OR mpi.match_player_id IS NULL
         OR mpr.match_player_id IS NULL
         OR (mpb.match_player_id IS NULL AND m.game_duration >= ${minDur})
    ) t
  `)
  const raw = rows[0]?.count ?? 0
  return typeof raw === 'bigint' ? Number(raw) : Number(raw)
}

async function enrichOneMatch(
  client: RiotHttpClient,
  leagueCache: Map<string, { tier: string | null; division: string | null; lp: number | null }>,
  riotMatchId: string
): Promise<{
  changed: boolean
  items: number
  runes: number
  buckets: number
  ranks: number
}> {
  const match = await prisma.match.findUnique({
    where: { riotMatchId },
    select: { id: true, gameDuration: true },
  })
  if (!match) return { changed: false, items: 0, runes: 0, buckets: 0, ranks: 0 }
  const bucketsExpectedForMatch = match.gameDuration >= MATCH_PLAYER_BUCKET_MIN_GAME_DURATION_SECONDS

  const mps = await prisma.matchPlayer.findMany({
    where: { matchId: match.id },
    select: {
      id: true,
      participantId: true,
      rankTier: true,
      rankDivision: true,
      rankLp: true,
      player: { select: { puuid: true } },
    },
    orderBy: { participantId: 'asc' },
  })
  if (mps.length === 0) return { changed: false, items: 0, runes: 0, buckets: 0, ranks: 0 }

  const mpIds = mps.map((x) => x.id)
  const [itemExisting, runeExisting, bucketExisting] = await Promise.all([
    prisma.matchPlayerItem.findMany({ where: { matchPlayerId: { in: mpIds } }, select: { matchPlayerId: true } }),
    prisma.matchPlayerRune.findMany({ where: { matchPlayerId: { in: mpIds } }, select: { matchPlayerId: true } }),
    prisma.matchPlayerBucket.findMany({ where: { matchPlayerId: { in: mpIds } }, select: { matchPlayerId: true } }),
  ])
  const hasItems = new Set(itemExisting.map((x) => x.matchPlayerId.toString()))
  const hasRunes = new Set(runeExisting.map((x) => x.matchPlayerId.toString()))
  const hasBuckets = new Set(bucketExisting.map((x) => x.matchPlayerId.toString()))

  const detailRes = await client.getMatch(riotMatchId)
  _status.requestCount++
  if (!detailRes.ok) {
    if (detailRes.status === 429) _status.error429Count++
    return { changed: false, items: 0, runes: 0, buckets: 0, ranks: 0 }
  }
  const dto = detailRes.data as RiotMatchDto
  const participants = (dto.info?.participants ?? []) as RiotParticipantDto[]
  if (participants.length === 0) return { changed: false, items: 0, runes: 0, buckets: 0, ranks: 0 }

  // Timeline seulement si des buckets manquent ET la partie peut en avoir (≥ 5 min in-game).
  let timeline: RiotMatchTimelineDto | null = null
  const needsBucketTimeline =
    bucketsExpectedForMatch && mps.some((x) => !hasBuckets.has(x.id.toString()))
  if (needsBucketTimeline) {
    const tlRes = await client.getMatchTimeline(riotMatchId)
    _status.requestCount++
    if (tlRes.ok) timeline = tlRes.data
    else if (tlRes.status === 429) _status.error429Count++
  }

  let itemsInserted = 0
  let runesInserted = 0
  let bucketsInserted = 0
  let ranksUpdated = 0

  // participantId in DB is 1-based and aligned with Riot order in ingestion
  for (const mp of mps) {
    const p = participants[mp.participantId - 1] as unknown as Record<string, unknown> | undefined
    if (!p) continue
    const mpId = mp.id
    const key = mpId.toString()

    if (!hasItems.has(key)) {
      const rows = buildItemRows(mpId, p)
      if (rows.length > 0) {
        const r = await prisma.matchPlayerItem.createMany({ data: rows, skipDuplicates: true })
        itemsInserted += r.count
      }
    }

    if (!hasRunes.has(key)) {
      const rows = buildRuneRows(mpId, p)
      if (rows.length > 0) {
        const r = await prisma.matchPlayerRune.createMany({ data: rows, skipDuplicates: true })
        runesInserted += r.count
      }
    }

    if ((mp.rankDivision == null || mp.rankDivision === '' || mp.rankLp == null) && mp.player?.puuid) {
      const puuid = mp.player.puuid
      let cached = leagueCache.get(puuid)
      if (!cached) {
        const lr = await client.getLeagueEntriesByPuuid(puuid)
        _status.requestCount++
        if (!lr.ok) {
          if (lr.status === 429) _status.error429Count++
          cached = { tier: null, division: null, lp: null }
        } else {
          const entries = lr.data as RiotLeagueEntryDto[]
          const solo = entries.find((e) => e.queueType === 'RANKED_SOLO_5x5') ?? entries[0]
          cached = {
            tier: normalizeTier(solo?.tier),
            division: normalizeDivision(solo?.rank),
            lp: typeof solo?.leaguePoints === 'number' ? Math.trunc(solo.leaguePoints) : null,
          }
        }
        leagueCache.set(puuid, cached)
      }
      const data: Record<string, unknown> = {}
      if ((mp.rankDivision == null || mp.rankDivision === '') && cached.division != null) data.rankDivision = cached.division
      if (mp.rankLp == null && cached.lp != null) data.rankLp = cached.lp
      if (mp.rankTier === 'UNRANKED' && cached.tier != null) data.rankTier = cached.tier
      if (Object.keys(data).length > 0) {
        await prisma.matchPlayer.update({ where: { id: mpId }, data })
        ranksUpdated++
      }
    }
  }

  if (timeline && needsBucketTimeline) {
    const pfRows: Array<{
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
    const byPid = new Map<number, bigint>(mps.map((x) => [x.participantId, x.id]))
    const frames = timeline.info?.frames ?? []
    for (const frame of frames) {
      const durationBucket = timelineTimestampMsToGameMinute(toIntOr0(frame.timestamp))
      if (!isKeptMatchPlayerDurationBucket(durationBucket)) continue
      const pfs = frame.participantFrames ?? {}
      for (const [pidRaw, raw] of Object.entries(pfs)) {
        const pid = Number(pidRaw)
        const mpId = byPid.get(pid)
        if (!mpId) continue
        if (hasBuckets.has(mpId.toString())) continue
        if (!raw || typeof raw !== 'object') continue
        const pfo = raw as Record<string, unknown>
        const damage = (pfo.damageStats && typeof pfo.damageStats === 'object') ? (pfo.damageStats as Record<string, unknown>) : {}
        const champ = (pfo.championStats && typeof pfo.championStats === 'object') ? (pfo.championStats as Record<string, unknown>) : {}
        const totalGold = toIntOr0(pfo.totalGold)
        const elapsedSeconds = Math.max(1, Math.floor(toIntOr0(frame.timestamp) / 1000))
        pfRows.push({
          matchPlayerId: mpId,
          durationBucket,
          currentGold: toIntOr0(pfo.currentGold),
          magicDamageDone: toIntOr0(damage.magicDamageDone),
          magicDamageDoneToChampion: toIntOr0(damage.magicDamageDoneToChampions ?? damage.magicDamageDoneToChampion),
          magicDamageTaken: toIntOr0(damage.magicDamageTaken),
          physicalDamageDone: toIntOr0(damage.physicalDamageDone),
          physicalDamageDoneToChampion: toIntOr0(damage.physicalDamageDoneToChampions ?? damage.physicalDamageDoneToChampion),
          physicalDamageTaken: toIntOr0(damage.physicalDamageTaken),
          totalDamageDone: toIntOr0(damage.totalDamageDone),
          totalDamageDoneToChampion: toIntOr0(damage.totalDamageDoneToChampions ?? damage.totalDamageDoneToChampion),
          totalDamageTaken: toIntOr0(damage.totalDamageTaken),
          trueDamageDone: toIntOr0(damage.trueDamageDone),
          trueDamageDoneToChampion: toIntOr0(damage.trueDamageDoneToChampions ?? damage.trueDamageDoneToChampion),
          trueDamageTaken: toIntOr0(damage.trueDamageTaken),
          goldPerSecond: Math.floor(totalGold / elapsedSeconds),
          jungleMinionsKilled: toIntOr0(pfo.jungleMinionsKilled),
          level: toIntOr0(pfo.level),
          minionsKilled: toIntOr0(pfo.minionsKilled),
          timeEnemySpentControlled: toIntOr0(champ.timeEnemySpentControlled),
          totalGold,
          xp: toIntOr0(pfo.xp),
        })
      }
    }
    if (pfRows.length > 0) {
      const r = await prisma.matchPlayerBucket.createMany({ data: pfRows, skipDuplicates: true })
      bucketsInserted += r.count
    }
  }

  const changed = itemsInserted > 0 || runesInserted > 0 || bucketsInserted > 0 || ranksUpdated > 0
  return { changed, items: itemsInserted, runes: runesInserted, buckets: bucketsInserted, ranks: ranksUpdated }
}

export async function runDataEnrichScript(
  isShouldStop: () => boolean,
  onUpdate?: (status: DataEnrichStatus) => void
): Promise<void> {
  if (!isDatabaseConfigured()) {
    _status = {
      ..._status,
      phase: 'error',
      lastError: 'DATABASE_URL not set',
      finishedAt: new Date().toISOString(),
    }
    onUpdate?.(_status)
    return
  }

  _status = {
    phase: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lastError: null,
    requestCount: 0,
    error429Count: 0,
    matchesScanned: 0,
    matchesEnriched: 0,
    rowsItems: 0,
    rowsRunes: 0,
    rowsBuckets: 0,
    rowsRanks: 0,
    missingMatches: 0,
  }
  onUpdate?.(_status)

  const logger = createRiotPollerLogger()

  try {
    const rateLimitRes = await loadRateLimitConfig()
    if (rateLimitRes.isErr()) throw new Error(`Failed to load rate-limit config: ${rateLimitRes.unwrapErr().message}`)
    const rateLimiter = new RiotRateLimiter(rateLimitRes.unwrap())
    const client = new RiotHttpClient(rateLimiter, logger)
    const keyRes = await resolveRiotApiKey()
    if (!keyRes.ok) throw new Error(`No Riot API key configured: ${keyRes.error}`)
    client.setKey(keyRes.key, keyRes.source, keyRes.clefType)

    const leagueCache = new Map<string, { tier: string | null; division: string | null; lp: number | null }>()

    while (!isShouldStop()) {
      _status.missingMatches = await countMissingMatches()
      onUpdate?.(_status)
      const batch = await getMissingMatchIds(BATCH_MATCHES)
      if (batch.length === 0) break
      for (const riotMatchId of batch) {
        if (isShouldStop()) break
        _status.matchesScanned++
        client.setPlatform(riotMatchId.startsWith('EUN1_') ? 'eun1' : 'euw1')
        const res = await enrichOneMatch(client, leagueCache, riotMatchId)
        if (res.changed) _status.matchesEnriched++
        _status.rowsItems += res.items
        _status.rowsRunes += res.runes
        _status.rowsBuckets += res.buckets
        _status.rowsRanks += res.ranks
        _status.missingMatches = Math.max(0, _status.missingMatches - 1)
        onUpdate?.(_status)
      }
    }

    _status = { ..._status, phase: 'done', finishedAt: new Date().toISOString() }
    onUpdate?.(_status)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    _status = { ..._status, phase: 'error', lastError: msg, finishedAt: new Date().toISOString() }
    onUpdate?.(_status)
    throw err
  }
}

