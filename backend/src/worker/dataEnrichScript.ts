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
import { rankToScore, scoreToRank } from '../utils/rankScore.js'
import {
  isKeptMatchPlayerDurationBucket,
  MATCH_PLAYER_BUCKET_MIN_GAME_DURATION_SECONDS,
  timelineTimestampMsToGameMinute,
} from './matchPlayerBucketPolicy.js'
import { selectMatchPlayerItems } from './itemBuildSelection.js'

const BATCH_MATCHES = 30
const APEX_RANK_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'] as const
const MAX_STAGNANT_PRIMARY_LOOPS = 12

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
  missingMatchRanks: number
  missingTeamRanks: number
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
  missingMatchRanks: 0,
  missingTeamRanks: 0,
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

function averageRankFromScores(scores: number[]): { tier: string; division: string } {
  if (scores.length === 0) return { tier: 'UNRANKED', division: '' }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return scoreToRank(avg)
}

async function recomputeTeamAndMatchRanksFromDb(matchId: bigint): Promise<void> {
  const freshMps = await prisma.matchPlayer.findMany({
    where: { matchId },
    select: { teamId: true, rankTier: true, rankDivision: true, rankLp: true },
  })
  const matchScores: number[] = []
  const teamScores = new Map<string, number[]>()
  for (const row of freshMps) {
    if (!row.rankTier || row.rankTier === 'UNRANKED') continue
    const score = rankToScore(row.rankTier, row.rankDivision ?? '', row.rankLp ?? null)
    matchScores.push(score)
    const key = row.teamId.toString()
    const list = teamScores.get(key) ?? []
    list.push(score)
    teamScores.set(key, list)
  }
  const avgMatch = averageRankFromScores(matchScores)
  await prisma.match.update({
    where: { id: matchId },
    data: { rankTier: avgMatch.tier, rankDivision: avgMatch.division },
  })
  for (const [teamId, scores] of teamScores.entries()) {
    const avg = averageRankFromScores(scores)
    await prisma.team.update({
      where: { id: BigInt(teamId) },
      data: { rankTier: avg.tier, rankDivision: avg.division },
    })
  }
}

async function getMissingMatchIds(limit: number): Promise<string[]> {
  const minDur = MATCH_PLAYER_BUCKET_MIN_GAME_DURATION_SECONDS
  const apex = Prisma.join(APEX_RANK_TIERS)
  const rows = await prisma.$queryRaw<Array<{ riot_match_id: string }>>(Prisma.sql`
    SELECT DISTINCT m.riot_match_id
    FROM matchs m
    JOIN match_players mp ON mp.match_id = m.id
    WHERE mp.rank_division IS NULL
       OR m.game_date IS NULL
       OR (
         mp.rank_division = ''
         AND COALESCE(mp.rank_tier, 'UNRANKED') NOT IN (${apex}, 'UNRANKED')
       )
       OR mp.rank_lp IS NULL
       OR NOT EXISTS (SELECT 1 FROM match_player_items i WHERE i.match_player_id = mp.id)
       OR EXISTS (
         SELECT 1
         FROM match_player_items i
         WHERE i.match_player_id = mp.id
           AND i.timestamp_ms <= 0
       )
       OR EXISTS (
         SELECT 1
         FROM match_player_items i
         WHERE i.match_player_id = mp.id
         GROUP BY i.match_player_id
         HAVING MIN(i."order") <> 0 OR MAX(i."order") <> COUNT(*) - 1
       )
       OR NOT EXISTS (SELECT 1 FROM match_player_runes r WHERE r.match_player_id = mp.id)
       OR (
         m.game_duration >= ${minDur}
         AND NOT EXISTS (SELECT 1 FROM match_player_bucket b WHERE b.match_player_id = mp.id)
       )
    ORDER BY m.riot_match_id ASC
    LIMIT ${limit}
  `)
  return rows.map((r) => r.riot_match_id)
}

async function countMissingMatches(): Promise<number> {
  const minDur = MATCH_PLAYER_BUCKET_MIN_GAME_DURATION_SECONDS
  const apex = Prisma.join(APEX_RANK_TIERS)
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT DISTINCT m.riot_match_id
      FROM matchs m
      JOIN match_players mp ON mp.match_id = m.id
      LEFT JOIN teams t ON t.id = mp.team_id
      WHERE mp.rank_division IS NULL
         OR m.game_date IS NULL
         OR (
           mp.rank_division = ''
           AND COALESCE(mp.rank_tier, 'UNRANKED') NOT IN (${apex}, 'UNRANKED')
         )
         OR mp.rank_lp IS NULL
         OR NOT EXISTS (SELECT 1 FROM match_player_items i WHERE i.match_player_id = mp.id)
         OR EXISTS (
           SELECT 1
           FROM match_player_items i
           WHERE i.match_player_id = mp.id
             AND i.timestamp_ms <= 0
         )
         OR EXISTS (
           SELECT 1
           FROM match_player_items i
           WHERE i.match_player_id = mp.id
           GROUP BY i.match_player_id
           HAVING MIN(i."order") <> 0 OR MAX(i."order") <> COUNT(*) - 1
         )
         OR NOT EXISTS (SELECT 1 FROM match_player_runes r WHERE r.match_player_id = mp.id)
         OR (
           m.game_duration >= ${minDur}
           AND NOT EXISTS (SELECT 1 FROM match_player_bucket b WHERE b.match_player_id = mp.id)
         )
         OR (
           t.rank_tier = 'UNRANKED'
           AND mp.rank_tier IS NOT NULL
           AND mp.rank_tier <> 'UNRANKED'
         )
         OR (
           t.rank_division = ''
           AND COALESCE(t.rank_tier, 'UNRANKED') NOT IN (${apex}, 'UNRANKED')
           AND mp.rank_tier IS NOT NULL
           AND mp.rank_tier <> 'UNRANKED'
         )
         OR (
           t.rank_division IS NULL
           AND mp.rank_tier IS NOT NULL
           AND mp.rank_tier <> 'UNRANKED'
         )
    ) t
  `)
  const raw = rows[0]?.count ?? 0
  return typeof raw === 'bigint' ? Number(raw) : Number(raw)
}

async function countMissingMatchRanks(): Promise<number> {
  const apex = Prisma.join(APEX_RANK_TIERS)
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM matchs
    WHERE rank_tier = 'UNRANKED'
       OR rank_division IS NULL
       OR (rank_division = '' AND COALESCE(rank_tier, 'UNRANKED') NOT IN (${apex}, 'UNRANKED'))
  `)
  const raw = rows[0]?.count ?? 0
  return typeof raw === 'bigint' ? Number(raw) : Number(raw)
}

async function countMissingTeamRanks(): Promise<number> {
  const apex = Prisma.join(APEX_RANK_TIERS)
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM teams
    WHERE rank_tier = 'UNRANKED'
       OR rank_division IS NULL
       OR (rank_division = '' AND COALESCE(rank_tier, 'UNRANKED') NOT IN (${apex}, 'UNRANKED'))
  `)
  const raw = rows[0]?.count ?? 0
  return typeof raw === 'bigint' ? Number(raw) : Number(raw)
}

async function getMatchesNeedingTeamRankBackfill(limit: number): Promise<string[]> {
  const apex = Prisma.join(APEX_RANK_TIERS)
  const rows = await prisma.$queryRaw<Array<{ riot_match_id: string }>>(Prisma.sql`
    SELECT DISTINCT m.riot_match_id
    FROM matchs m
    JOIN teams t ON t.match_id = m.id
    JOIN match_players mp ON mp.match_id = m.id
    WHERE (
        t.rank_tier = 'UNRANKED'
        OR t.rank_division IS NULL
        OR (
          t.rank_division = ''
          AND COALESCE(t.rank_tier, 'UNRANKED') NOT IN (${apex}, 'UNRANKED')
        )
      )
      AND mp.rank_tier IS NOT NULL
      AND mp.rank_tier <> 'UNRANKED'
    ORDER BY m.riot_match_id ASC
    LIMIT ${limit}
  `)
  return rows.map(r => r.riot_match_id)
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
      teamId: true,
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
    prisma.matchPlayerItem.findMany({
      where: { matchPlayerId: { in: mpIds } },
      select: { matchPlayerId: true, timestampMs: true, core: true, order: true },
    }),
    prisma.matchPlayerRune.findMany({ where: { matchPlayerId: { in: mpIds } }, select: { matchPlayerId: true } }),
    prisma.matchPlayerBucket.findMany({ where: { matchPlayerId: { in: mpIds } }, select: { matchPlayerId: true } }),
  ])
  const hasRunes = new Set(runeExisting.map((x) => x.matchPlayerId.toString()))
  const hasBuckets = new Set(bucketExisting.map((x) => x.matchPlayerId.toString()))
  let gameDateUpdated = false

  const detailRes = await client.getMatch(riotMatchId)
  _status.requestCount++
  if (!detailRes.ok) {
    if (detailRes.status === 429) _status.error429Count++
    return { changed: false, items: 0, runes: 0, buckets: 0, ranks: 0 }
  }
  const dto = detailRes.data as RiotMatchDto
  const infoAny = (dto.info ?? {}) as Record<string, unknown>
  const gameStartRaw =
    (typeof infoAny['gameStartTimestamp'] === 'number' ? (infoAny['gameStartTimestamp'] as number) : null) ??
    (typeof dto.info?.gameCreation === 'number' ? dto.info.gameCreation : null)
  if (gameStartRaw != null) {
    gameDateUpdated = true
    await prisma.match.update({
      where: { id: match.id },
      data: { gameDate: new Date(gameStartRaw) },
    })
  }
  const participants = (dto.info?.participants ?? []) as RiotParticipantDto[]
  if (participants.length === 0) return { changed: false, items: 0, runes: 0, buckets: 0, ranks: 0 }

  const itemRowsByMp = new Map<string, Array<{ timestampMs: number; core: boolean; order: number }>>()
  for (const row of itemExisting) {
    const key = row.matchPlayerId.toString()
    const list = itemRowsByMp.get(key) ?? []
    list.push({ timestampMs: row.timestampMs, core: row.core, order: row.order })
    itemRowsByMp.set(key, list)
  }
  const hasOrderGap = (orders: number[]): boolean => {
    const sorted = [...orders].sort((a, b) => a - b)
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i) return true
    }
    return false
  }
  const needsItemTimeline = mps.some((x) => {
    const rows = itemRowsByMp.get(x.id.toString()) ?? []
    if (rows.length === 0) return true
    if (rows.some((r) => r.timestampMs <= 0)) return true
    if (hasOrderGap(rows.map((r) => r.order))) return true
    if (!rows.some((r) => r.core)) return true
    return false
  })

  // Timeline si buckets manquants et/ou items a normaliser.
  let timeline: RiotMatchTimelineDto | null = null
  const needsBucketTimeline =
    bucketsExpectedForMatch && mps.some((x) => !hasBuckets.has(x.id.toString()))
  if (needsBucketTimeline || needsItemTimeline) {
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

  if (timeline && needsItemTimeline) {
    const events: Array<{ type: string; [key: string]: unknown }> = []
    for (const frame of timeline.info?.frames ?? []) {
      if (!Array.isArray(frame.events)) continue
      for (const ev of frame.events) events.push(ev as { type: string; [key: string]: unknown })
    }
    for (const mp of mps) {
      const participant = participants[mp.participantId - 1] as unknown as Record<string, unknown> | undefined
      if (!participant) continue
      const selected = await selectMatchPlayerItems({
        participant,
        participantId: mp.participantId,
        events,
      })
      await prisma.matchPlayerItem.deleteMany({ where: { matchPlayerId: mp.id } })
      if (selected.length > 0) {
        const r = await prisma.matchPlayerItem.createMany({
          data: selected.map((row) => ({
            matchPlayerId: mp.id,
            itemId: row.itemId,
            starter: row.starter,
            core: row.core,
            order: row.order,
            timestampMs: row.timestampMs,
          })),
        })
        itemsInserted += r.count
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

  // Recompute team and match average rank after potential rank updates.
  await recomputeTeamAndMatchRanksFromDb(match.id)

  const changed = itemsInserted > 0 || runesInserted > 0 || bucketsInserted > 0 || ranksUpdated > 0 || gameDateUpdated
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
    missingMatchRanks: 0,
    missingTeamRanks: 0,
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

    let stagnantPrimaryLoops = 0
    while (!isShouldStop()) {
      const [missingMatches, missingMatchRanks, missingTeamRanks] = await Promise.all([
        countMissingMatches(),
        countMissingMatchRanks(),
        countMissingTeamRanks(),
      ])
      _status.missingMatches = missingMatches
      _status.missingMatchRanks = missingMatchRanks
      _status.missingTeamRanks = missingTeamRanks
      onUpdate?.(_status)
      if (missingMatches === 0 && missingMatchRanks === 0 && missingTeamRanks === 0) break
      const batch = await getMissingMatchIds(BATCH_MATCHES)
      if (batch.length === 0) {
        stagnantPrimaryLoops++
        if (stagnantPrimaryLoops >= MAX_STAGNANT_PRIMARY_LOOPS) {
          await logger.info('[data-enrich] primary pass stagnated: no batch available, stopping')
          break
        }
        continue
      }
      let batchProgress = 0
      for (const riotMatchId of batch) {
        if (isShouldStop()) break
        _status.matchesScanned++
        client.setPlatform(riotMatchId.startsWith('EUN1_') ? 'eun1' : 'euw1')
        const res = await enrichOneMatch(client, leagueCache, riotMatchId)
        if (res.changed) _status.matchesEnriched++
        batchProgress += res.items + res.runes + res.buckets + res.ranks + (res.changed ? 1 : 0)
        _status.rowsItems += res.items
        _status.rowsRunes += res.runes
        _status.rowsBuckets += res.buckets
        _status.rowsRanks += res.ranks
        onUpdate?.(_status)
      }
      if (batchProgress === 0) {
        await logger.info(
          '[data-enrich] no progress on primary pass batch; trying next cycle'
        )
        stagnantPrimaryLoops++
        if (stagnantPrimaryLoops >= MAX_STAGNANT_PRIMARY_LOOPS) {
          await logger.info('[data-enrich] primary pass stagnated too long, stopping')
          break
        }
      } else {
        stagnantPrimaryLoops = 0
      }
    }

  // Dedicated pass: backfill team.rank_tier/rank_division for matches not covered by missing enrich criteria.
    let previousBackfillSignature: string | null = null
    let stagnantBackfillLoops = 0
    while (!isShouldStop()) {
      const batch = await getMatchesNeedingTeamRankBackfill(BATCH_MATCHES)
      if (batch.length === 0) break
      for (const riotMatchId of batch) {
        if (isShouldStop()) break
        const match = await prisma.match.findUnique({
          where: { riotMatchId },
          select: { id: true },
        })
        if (!match) continue
        await recomputeTeamAndMatchRanksFromDb(match.id)
      }
      const [missingMatchRanks, missingTeamRanks] = await Promise.all([
        countMissingMatchRanks(),
        countMissingTeamRanks(),
      ])
      _status.missingMatchRanks = missingMatchRanks
      _status.missingTeamRanks = missingTeamRanks
      onUpdate?.(_status)

      const signature = `${String(missingMatchRanks)}:${String(missingTeamRanks)}`
      if (signature === previousBackfillSignature) {
        stagnantBackfillLoops++
      } else {
        stagnantBackfillLoops = 0
        previousBackfillSignature = signature
      }
      if (stagnantBackfillLoops >= 2) {
        await logger.info(
          '[data-enrich] no progress on team-rank backfill pass; stopping to avoid infinite loop'
        )
        break
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

