/**
 * Match ingest: `ingest_matchs` / `ingest_teams` / `ingest_match_players` with JSON stats (no satellite tables).
 */
import { createHash } from 'node:crypto'
import { prisma } from '../db.js'
import { Prisma } from '../generated/prisma/index.js'
import { MatchIngestSkippedError } from './matchIngestErrors.js'
import { resolveRiotMatchIdForIngest } from './matchIngestIds.js'
import { buildMatchTeamData } from './matchTeamDataBuilder.js'
import type { MatchIngestDbPreload, MatchIngestOptions, MatchIngestRankCache } from './matchIngestTypes.js'
import {
  getCachedRank,
  setCachedRank,
  enqueuePriorityPuuid,
} from './matchIngestRankCache.js'
import {
  RiotHttpClient,
  RIOT_INGEST_ABORTED_MESSAGE,
  type RiotMatchDto,
  type RiotParticipantDto,
  type RiotMatchTimelineDto,
  type RiotTimelineEventEliteMonsterKill,
  type RiotTimelineEventDragonSoulGiven,
  type RiotTimelineEventSkillLevelUp,
} from '../services/RiotHttpClient.js'
import type { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { gameVersionFromMatchInfo, normalizeGameVersionToMajorMinor } from '../utils/gameVersion.js'
import { rankToScore, scoreToRank } from '../utils/rankScore.js'
import { selectMatchPlayerItems } from './itemBuildSelection.js'
import { isKeptMatchPlayerDurationBucket, timelineTimestampMsToGameMinute } from './matchPlayerBucketPolicy.js'

const MIN_ALLOWED_MAJOR = 16
const MIN_ALLOWED_MINOR = 1

function ingestAdvisoryLockKeys(riotMatchId: string): { k1: number; k2: number } {
  const h = createHash('sha256').update(`ingest:${riotMatchId}`).digest()
  return { k1: h.readInt32BE(0), k2: h.readInt32BE(4) }
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

function roleFromPosition(individualPosition?: string, teamPosition?: string): string | null {
  const p = individualPosition ?? teamPosition ?? ''
  if (/^TOP$/i.test(p)) return 'TOP'
  if (/^JUNGLE/i.test(p)) return 'JUNGLE'
  if (/^MIDDLE|^MID/i.test(p)) return 'MIDDLE'
  if (/^BOTTOM|^ADC/i.test(p)) return 'BOTTOM'
  if (/^UTILITY|^SUPPORT/i.test(p)) return 'SUPPORT'
  return p || null
}

function participantNames(part: RiotParticipantDto): { gn: string; tl: string } {
  const gn = (
    (part.riotIdGameName as string | undefined) ??
    (part.riotIdName as string | undefined) ??
    ''
  )
    .trim()
    .toLowerCase()
  const tl = (
    (part.riotIdTagline as string | undefined) ??
    (part.riotIdTagLine as string | undefined) ??
    ''
  )
    .trim()
    .toLowerCase()
  return { gn, tl }
}

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

type ResolvedParticipantRank = { tier: string; division: string | null; lp: number | null }

function mergeDtoWithAccountCache(
  p: RiotParticipantDto,
  puuid: string,
  accountRankCache: MatchIngestRankCache
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

function averageRankFromScores(scores: number[]): { tier: string; division: string } {
  if (scores.length === 0) return { tier: 'UNRANKED', division: '' }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return scoreToRank(avg)
}

function fillParticipantRankFromPeers(idx: number, ranks: ResolvedParticipantRank[]): ResolvedParticipantRank {
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

const RANK_REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000

function isRankUpdateRequired(player: { rankSnapshotGameDate: Date | null } | null): boolean {
  if (!player) return true
  if (!player.rankSnapshotGameDate) return true
  return Date.now() - player.rankSnapshotGameDate.getTime() >= RANK_REFRESH_INTERVAL_MS
}

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

function buildSummonerSpellIds(summoner1Id: number | null, summoner2Id: number | null): number[] {
  const out: number[] = []
  if (summoner1Id != null && summoner1Id > 0) out.push(summoner1Id)
  if (summoner2Id != null && summoner2Id > 0) out.push(summoner2Id)
  return out
}

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

const LEAN_STATS_KEYS_TO_DROP = new Set([
  'puuid',
  'challenges',
  'perks',
  'missions',
  'buckets',
  'bucket',
])

function shouldDropLeanStatKey(key: string): boolean {
  if (LEAN_STATS_KEYS_TO_DROP.has(key)) return true
  if (/^playerAugment\d+$/i.test(key)) return true
  if (/^item\d+$/i.test(key)) return true
  return false
}

/** Remaining participant fields + nested challenges/missions for JSON storage. */
export function buildLeanParticipantStats(
  p: RiotParticipantDto,
  opts: { runes: number[]; shards: number[]; summonerSpells: number[] }
): Prisma.InputJsonValue {
  const obj = { ...(p as unknown as Record<string, unknown>) }
  const challenges = (p as { challenges?: unknown }).challenges
  const missions = (p as { missions?: unknown }).missions
  for (const k of Object.keys(obj)) {
    if (shouldDropLeanStatKey(k)) delete obj[k]
  }
  const out: Record<string, unknown> = { ...obj }
  if (challenges && typeof challenges === 'object') out['challenges'] = challenges
  if (missions && typeof missions === 'object') out['missions'] = missions
  out['_runes'] = opts.runes
  out['_shards'] = opts.shards
  out['_summonerSpells'] = opts.summonerSpells
  return out as Prisma.InputJsonValue
}

export async function preloadIngestLeanMatchDbData(puuids: string[]): Promise<MatchIngestDbPreload> {
  const maxGameByPuuid = new Map<string, Date>()
  const playerRankSnapshotByPuuid = new Map<string, { rankSnapshotGameDate: Date | null }>()
  const playerDbLadderByPuuid = new Map<
    string,
    { rankTier: string | null; rankDivision: string | null; rankLp: number | null }
  >()
  const unique = [...new Set(puuids.filter(Boolean))]
  if (unique.length === 0) return { maxGameByPuuid, playerRankSnapshotByPuuid, playerDbLadderByPuuid }

  const rows = await prisma.$queryRaw<Array<{ puuid: string; max_game: Date | null }>>`
    SELECT pl.puuid, MAX(im.game_date) AS max_game
    FROM players pl
    INNER JOIN ingest_match_players imp ON imp.player_id = pl.id
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    WHERE pl.puuid IN (${Prisma.join(unique)})
    GROUP BY pl.puuid
  `
  for (const r of rows) {
    if (r.max_game) maxGameByPuuid.set(r.puuid, r.max_game)
  }
  const playerRows = await prisma.player.findMany({
    where: { puuid: { in: unique } },
    select: {
      puuid: true,
      rankSnapshotGameDate: true,
      rankTier: true,
      rankDivision: true,
      rankLp: true,
    },
  })
  for (const row of playerRows) {
    playerRankSnapshotByPuuid.set(row.puuid, { rankSnapshotGameDate: row.rankSnapshotGameDate })
    playerDbLadderByPuuid.set(row.puuid, {
      rankTier: row.rankTier,
      rankDivision: row.rankDivision,
      rankLp: row.rankLp,
    })
  }
  return { maxGameByPuuid, playerRankSnapshotByPuuid, playerDbLadderByPuuid }
}

export async function upsertIngestMatchAndParticipants(
  client: RiotHttpClient,
  region: string,
  queueRiotMatchId: string,
  dto: RiotMatchDto,
  puuidKeyVersion: string | null,
  counters: {
    matchesFetched: number
    participantsFetched: number
    playersFetched: number
    matchesApiIngestComplete: number
    playersRankUpdatedLeague: number
    newPlayersRankFetched: number
    stalePlayersRankRefreshed: number
    rankSkippedFreshSnapshot: number
    apiNoRank: number
    apiError: number
  },
  logger?: ReturnType<typeof createRiotPollerLogger>,
  matchIngestOptions?: MatchIngestOptions
): Promise<{ matchDbId: bigint; canonicalRiotMatchId: string }> {
  const normalizedPuuidKeyVersion =
    typeof puuidKeyVersion === 'string' && puuidKeyVersion.trim() !== ''
      ? puuidKeyVersion.trim()
      : 'perso'
  const riotMatchId = resolveRiotMatchIdForIngest(queueRiotMatchId, dto)
  if (!riotMatchId) throw new MatchIngestSkippedError('no_riot_match_id')
  const info = dto.info
  if (!info?.participants?.length) throw new MatchIngestSkippedError('no_participants')
  if (info.endOfGameResult && info.endOfGameResult !== 'GameComplete') {
    throw new MatchIngestSkippedError('not_game_complete')
  }

  const gameDuration = info.gameDuration ?? 0
  const infoAny = info as Record<string, unknown>
  const rawGameStartTs =
    (typeof infoAny['gameStartTimestamp'] === 'number' ? (infoAny['gameStartTimestamp'] as number) : null) ??
    (typeof info.gameCreation === 'number' ? info.gameCreation : null)
  const gameDate = rawGameStartTs != null ? new Date(rawGameStartTs) : null
  const participantDtos = info.participants as RiotParticipantDto[]
  const puuids = participantDtos.map((p) => p.puuid).filter(Boolean) as string[]

  const maxGameByPuuid = new Map<string, Date>()
  const playerRankSnapshotByPuuid = new Map<string, { rankSnapshotGameDate: Date | null }>()
  const playerDbLadderByPuuid = new Map<
    string,
    { rankTier: string | null; rankDivision: string | null; rankLp: number | null }
  >()
  if (puuids.length > 0) {
    const preload = matchIngestOptions?.ingestPreload
    if (preload) {
      for (const p of puuids) {
        const g = preload.maxGameByPuuid.get(p)
        if (g) maxGameByPuuid.set(p, g)
        if (preload.playerRankSnapshotByPuuid.has(p)) {
          playerRankSnapshotByPuuid.set(p, preload.playerRankSnapshotByPuuid.get(p)!)
        }
        if (preload.playerDbLadderByPuuid.has(p)) {
          playerDbLadderByPuuid.set(p, preload.playerDbLadderByPuuid.get(p)!)
        }
      }
    } else {
      const leanPreload = await preloadIngestLeanMatchDbData(puuids)
      for (const p of puuids) {
        const g = leanPreload.maxGameByPuuid.get(p)
        if (g) maxGameByPuuid.set(p, g)
        if (leanPreload.playerRankSnapshotByPuuid.has(p)) {
          playerRankSnapshotByPuuid.set(p, leanPreload.playerRankSnapshotByPuuid.get(p)!)
        }
        if (leanPreload.playerDbLadderByPuuid.has(p)) {
          playerDbLadderByPuuid.set(p, leanPreload.playerDbLadderByPuuid.get(p)!)
        }
      }
    }
  }

  function isNewestStoredMatchForPuuid(puuid: string): boolean {
    if (!gameDate) return false
    const max = maxGameByPuuid.get(puuid)
    if (!max) return true
    return gameDate.getTime() > max.getTime()
  }

  const accountRankCache =
    matchIngestOptions?.sharedAccountRankCache ??
    new Map<string, { rankTier?: string; rankDivision?: string | null; rankLp?: number | null }>()
  const shouldAbort = matchIngestOptions?.shouldAbort ?? (() => false)
  const allowLeagueRankApiFetch = matchIngestOptions?.allowLeagueRankApiFetch ?? true
  const forceLeagueRankApiForEachParticipant =
    matchIngestOptions?.forceLeagueRankApiForEachParticipant ?? false

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

  async function fetchAccountRankForParticipant(
    puuid: string,
    options?: { bypassGlobalCache?: boolean }
  ): Promise<'cached' | 'api_error' | 'api_no_rank' | 'api_rank'> {
    const bypassGlobalCache = options?.bypassGlobalCache === true
    if (!forceLeagueRankApiForEachParticipant && !bypassGlobalCache) {
      if (accountRankCache.has(puuid)) return 'cached'
      const cached = getCachedRank(puuid)
      if (cached) {
        accountRankCache.set(puuid, cached)
        return 'cached'
      }
    }
    const entriesRes = await client.getLeagueEntriesByPuuid(puuid, {
      infinite429Retry: true,
      shouldAbort,
    })
    if (!entriesRes.ok) {
      if (entriesRes.message === RIOT_INGEST_ABORTED_MESSAGE) {
        throw new Error(RIOT_INGEST_ABORTED_MESSAGE)
      }
      const fallback = { rankTier: undefined, rankDivision: null, rankLp: null }
      accountRankCache.set(puuid, fallback)
      setCachedRank(puuid, fallback)
      counters.apiError++
      return 'api_error'
    }
    counters.playersRankUpdatedLeague++
    if (!Array.isArray(entriesRes.data)) {
      const fallback = { rankTier: undefined, rankDivision: null, rankLp: null }
      accountRankCache.set(puuid, fallback)
      setCachedRank(puuid, fallback)
      counters.apiNoRank++
      return 'api_no_rank'
    }
    const entries = entriesRes.data as unknown as Array<Record<string, unknown>>
    const solo =
      entries.find((e) => e.queueType === 'RANKED_SOLO_5x5') ??
      entries.find((e) => String(e.queueType ?? '').toUpperCase().includes('RANKED_SOLO')) ??
      entries[0]
    const rankTier = normalizeRankTier(solo?.tier)
    const rankDivision = normalizeRankDivision(solo?.rank)
    const rankLp = normalizeRankLp(solo?.leaguePoints)
    const data = { rankTier: rankTier ?? undefined, rankDivision, rankLp }
    accountRankCache.set(puuid, data)
    setCachedRank(puuid, data)
    if (rankTier == null) {
      counters.apiNoRank++
      return 'api_no_rank'
    }
    return 'api_rank'
  }

  const shouldRefreshByPuuid = new Map<string, boolean>()
  const newPlayerPuuids = new Set<string>()
  for (const p of participantDtos) {
    const pid = p.puuid
    if (!pid || shouldRefreshByPuuid.has(pid)) continue
    const playerRow = playerRankSnapshotByPuuid.get(pid) ?? null
    if (!playerRow) newPlayerPuuids.add(pid)
    shouldRefreshByPuuid.set(pid, isRankUpdateRequired(playerRow))
  }
  if (!forceLeagueRankApiForEachParticipant) {
    for (const stale of shouldRefreshByPuuid.values()) {
      if (!stale) counters.rankSkippedFreshSnapshot++
    }
  }
  const staleRankPuuids = new Set(
    Array.from(shouldRefreshByPuuid.entries())
      .filter(([, stale]) => stale)
      .map(([pid]) => pid)
  )
  const leagueFetchPuuids = forceLeagueRankApiForEachParticipant
    ? Array.from(new Set(participantDtos.map((p) => p.puuid).filter((pid): pid is string => Boolean(pid))))
    : Array.from(
        new Set(
          participantDtos
            .map((p) => p.puuid)
            .filter((pid): pid is string => Boolean(pid))
            .filter((pid) => staleRankPuuids.has(pid))
        )
      )
  if (allowLeagueRankApiFetch) {
    const leagueFetchResults = await Promise.allSettled(
      leagueFetchPuuids.map((pid) =>
        fetchAccountRankForParticipant(pid, { bypassGlobalCache: staleRankPuuids.has(pid) })
      )
    )
    for (let idx = 0; idx < leagueFetchResults.length; idx++) {
      const res = leagueFetchResults[idx]
      const pid = leagueFetchPuuids[idx]
      if (res.status === 'fulfilled') {
        if (res.value === 'api_rank') {
          if (pid && newPlayerPuuids.has(pid)) counters.newPlayersRankFetched++
          else counters.stalePlayersRankRefreshed++
        }
        continue
      }
      const reason = res.reason instanceof Error ? res.reason.message : String(res.reason)
      if (reason === RIOT_INGEST_ABORTED_MESSAGE) throw new Error(RIOT_INGEST_ABORTED_MESSAGE)
      counters.apiError++
      await logger?.info?.('League rank lookup ignored (allSettled)', { reason })
    }
  }

  /** PUUID qui ont reçu un résultat league-v4 dans cet ingest (on ne les écrase pas avec la DB). */
  const leagueFetchedSet = new Set(allowLeagueRankApiFetch ? leagueFetchPuuids : [])
  for (const pid of puuids) {
    if (!pid || leagueFetchedSet.has(pid)) continue
    const dbRank = playerDbLadderByPuuid.get(pid)
    const t = dbRank?.rankTier?.trim().toUpperCase()
    if (!t || t === 'UNRANKED') continue
    accountRankCache.set(pid, {
      rankTier: t,
      rankDivision: dbRank!.rankDivision,
      rankLp: dbRank!.rankLp,
    })
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

  const matchDbId = await prisma.$transaction(
    async (tx) => {
      const { k1, k2 } = ingestAdvisoryLockKeys(riotMatchId)
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${k1}::int, ${k2}::int)`)
      const existing = await tx.ingestMatch.findUnique({ where: { riotMatchId }, select: { id: true } })
      if (existing) {
        if (matchIngestOptions?.refreshExistingIngestParticipantRanks === true) {
          const matchRows = await tx.ingestMatchPlayer.findMany({
            where: { matchId: existing.id },
            select: {
              id: true,
              playerId: true,
              player: { select: { puuid: true, rankTier: true } },
            },
          })
          const impByPuuid = new Map(matchRows.map((r) => [r.player.puuid, r]))
          const matchRankScores: number[] = []
          const teamRankScoresByRiotTeam = new Map<number, number[]>()

          for (let pIdx = 0; pIdx < participantDtos.length; pIdx++) {
            const p = participantDtos[pIdx]
            const puuid = p.puuid
            if (!puuid) continue
            enqueuePriorityPuuid(puuid)
            const rr = resolvedRanks[pIdx]
            const impRow = impByPuuid.get(puuid)
            const riotTeamId = p.teamId ?? 100
            if (impRow) {
              await tx.ingestMatchPlayer.update({
                where: { id: impRow.id },
                data: {
                  rankTier: rr.tier,
                  rankDivision: rr.division,
                },
              })
              const prevRankTier = impRow.player.rankTier
              if (gameDate && isNewestStoredMatchForPuuid(puuid)) {
                await tx.player.update({
                  where: { id: impRow.playerId },
                  data: {
                    rankTier: rr.tier === 'UNRANKED' ? null : rr.tier,
                    rankDivision: rr.division,
                    rankLp: rr.lp,
                    rankSnapshotGameDate: gameDate,
                  },
                })
              } else if (prevRankTier == null && rr.tier !== 'UNRANKED') {
                await tx.player.update({
                  where: { id: impRow.playerId },
                  data: {
                    rankTier: rr.tier,
                    rankDivision: rr.division,
                    rankLp: rr.lp,
                    rankSnapshotGameDate: new Date(),
                  },
                })
              }
            }
            if (rr.tier && rr.tier !== 'UNRANKED') {
              const score = rankToScore(rr.tier, rr.division ?? '', rr.lp ?? null)
              matchRankScores.push(score)
              const list = teamRankScoresByRiotTeam.get(riotTeamId) ?? []
              list.push(score)
              teamRankScoresByRiotTeam.set(riotTeamId, list)
            }
          }

          const teams = await tx.ingestTeam.findMany({
            where: { matchId: existing.id },
            select: { id: true, team: true },
          })
          for (const t of teams) {
            const scores = teamRankScoresByRiotTeam.get(t.team) ?? []
            const avg = averageRankFromScores(scores)
            await tx.ingestTeam.update({
              where: { id: t.id },
              data: { rankTier: avg.tier },
            })
          }
          const avgMatch = averageRankFromScores(matchRankScores)
          await tx.ingestMatch.update({
            where: { id: existing.id },
            data: { rankTier: avgMatch.tier, rankDivision: avgMatch.division },
          })
        }
        return existing.id
      }

      const gameVersion = normalizeGameVersionToMajorMinor(gameVersionFromMatchInfo(info))
      if (!isAllowedGameVersion(gameVersion)) {
        throw new MatchIngestSkippedError('game_version_not_allowed')
      }

      const existingPlayers = await tx.player.findMany({
        where: { puuid: { in: puuids } },
        select: { id: true, puuid: true, puuidKeyVersion: true, gameName: true, rankTier: true },
      })
      const existingByPuuid = new Map(existingPlayers.map((p) => [p.puuid, p]))

      const created = await tx.ingestMatch.createMany({
        data: [
          {
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
        ],
        skipDuplicates: true,
      })
      if (created.count > 0) {
        counters.matchesFetched++
        if (logger) await logger.info('DB: ingest_match created', { riotMatchId })
      }
      const match = await tx.ingestMatch.findUnique({
        where: { riotMatchId },
        select: { id: true },
      })
      if (!match) {
        throw new Error(`IngestMatch row not found after createMany for ${riotMatchId}`)
      }

      const teamDataItems = buildMatchTeamData(match.id, info, participantDtos, matchIngestOptions?.timelineDto ?? null)
      const teamIdByRiotTeam = new Map<number, bigint>()
      const teamRankScoresByRiotTeam = new Map<number, number[]>()
      const matchRankScores: number[] = []

      for (const { teamRow, bans } of teamDataItems) {
        const row = await tx.ingestTeam.create({
          data: {
            ...teamRow,
            bansJson: bans as Prisma.InputJsonValue,
            drakesJson: [] as Prisma.InputJsonValue,
          },
        })
        teamIdByRiotTeam.set(teamRow.team, row.id)
      }

      type PlayerRowInput = Prisma.IngestMatchPlayerCreateManyInput
      const playerRowsToCreate: PlayerRowInput[] = []

      for (let pIdx = 0; pIdx < participantDtos.length; pIdx++) {
        const p = participantDtos[pIdx]
        const puuid = p.puuid
        if (!puuid) continue
        // Decoupled rank-refresh pipeline: every seen participant is queued for async league-v4 refresh.
        enqueuePriorityPuuid(puuid)
        const { gn: partGameName, tl: partTagName } = participantNames(p)
        const existingPlayer = existingByPuuid.get(puuid)
        let playerId: bigint
        if (existingPlayer == null) {
          let createdNow = false
          let playerRow:
            | {
                id: bigint
                puuid: string
                puuidKeyVersion: string | null
                gameName: string | null
                rankTier: string | null
              }
            | null = null
          await tx.$executeRaw(Prisma.sql`SAVEPOINT player_insert_sp`)
          try {
            const rr = resolvedRanks[pIdx]
            const createdRankTier = rr.tier === 'UNRANKED' ? null : rr.tier
            const createdRankDivision = rr.division
            const createdRankLp = rr.lp
            const newPlayer = await tx.player.create({
              data: {
                puuid,
                region,
                puuidKeyVersion: normalizedPuuidKeyVersion,
                gameName: partGameName || null,
                tagName: partTagName || null,
                lastSeen: null,
                rankTier: createdRankTier,
                rankDivision: createdRankDivision,
                rankLp: createdRankLp,
                rankSnapshotGameDate: gameDate ?? new Date(),
              },
              select: { id: true, puuid: true, puuidKeyVersion: true, gameName: true, rankTier: true },
            })
            playerRow = newPlayer
            createdNow = true
            await tx.$executeRaw(Prisma.sql`RELEASE SAVEPOINT player_insert_sp`)
          } catch (e) {
            if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') {
              await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT player_insert_sp`).catch(() => undefined)
              throw e
            }
            await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT player_insert_sp`)
            const existing = await tx.player.findUnique({
              where: { puuid },
              select: { id: true, puuid: true, puuidKeyVersion: true, gameName: true, rankTier: true },
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
            rankTier: playerRow.rankTier,
          })
          if (createdNow) {
            counters.playersFetched++
          }
        } else {
          playerId = existingPlayer.id
          const playerUpdates: Record<string, unknown> = {}
          if (
            (!existingPlayer.puuidKeyVersion || existingPlayer.puuidKeyVersion === 'perdu') &&
            normalizedPuuidKeyVersion
          ) {
            playerUpdates['puuidKeyVersion'] = normalizedPuuidKeyVersion
            existingPlayer.puuidKeyVersion = normalizedPuuidKeyVersion
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
        let teamDbId = teamIdByRiotTeam.get(riotTeamId)
        if (!teamDbId) {
          const fallbackTeam = await tx.ingestTeam.upsert({
            where: { matchId_team: { matchId: match.id, team: riotTeamId } },
            create: {
              matchId: match.id,
              team: riotTeamId,
              rankTier: 'UNRANKED',
              win: false,
              bansJson: [],
              drakesJson: [],
            },
            update: {},
            select: { id: true },
          })
          teamDbId = fallbackTeam.id
          teamIdByRiotTeam.set(riotTeamId, teamDbId)
        }

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
        const summSpells = buildSummonerSpellIds(summoner1Id, summoner2Id)

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
        } else if (existingPlayer != null) {
          // Ensure newly seen players (or rows missing rank) are not left without rank snapshot when gameDate is absent.
          const needsSnapshotRank =
            (existingPlayer as { rankTier?: string | null }).rankTier == null && finalRankTier !== 'UNRANKED'
          if (needsSnapshotRank) {
            await tx.player.update({
              where: { id: playerId },
              data: {
                rankTier: finalRankTier,
                rankDivision: finalRankDivision,
                rankLp: finalRankLp,
                rankSnapshotGameDate: new Date(),
              },
            })
          }
        }

        const challenges = (p as { challenges?: unknown }).challenges ?? null
        const ch = challenges && typeof challenges === 'object' && !Array.isArray(challenges)
          ? (challenges as Record<string, unknown>)
          : {}
        const n = (key: string, fallback = 0): number => {
          const v = (p as Record<string, unknown>)[key] ?? ch[key]
          return typeof v === 'number' && Number.isFinite(v) ? v : fallback
        }
        const win = (p as { win?: boolean }).win === true

        const statsJson = buildLeanParticipantStats(p, {
          runes: runePayload.runes,
          shards: shardList,
          summonerSpells: summSpells,
        })

        playerRowsToCreate.push({
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
          summonerSpells: summSpells,
          items: buildFallbackItemsFromParticipant(p as unknown as Record<string, unknown>) as Prisma.InputJsonValue,
          skillOrder: [] as Prisma.InputJsonValue,
          win,
          kills: n('kills'),
          deaths: n('deaths'),
          assists: n('assists'),
          stats: statsJson,
        })

        counters.participantsFetched++

        if (finalRankTier && finalRankTier !== 'UNRANKED') {
          const score = rankToScore(finalRankTier, finalRankDivision ?? '', finalRankLp ?? null)
          matchRankScores.push(score)
          const list = teamRankScoresByRiotTeam.get(riotTeamId) ?? []
          list.push(score)
          teamRankScoresByRiotTeam.set(riotTeamId, list)
        }
      }

      if (playerRowsToCreate.length > 0) {
        await tx.ingestMatchPlayer.createMany({ data: playerRowsToCreate, skipDuplicates: true })
      }

      for (const [riotTeamId, teamDbId] of teamIdByRiotTeam.entries()) {
        const scores = teamRankScoresByRiotTeam.get(riotTeamId) ?? []
        const avg = averageRankFromScores(scores)
        await tx.ingestTeam.update({
          where: { id: teamDbId },
          data: { rankTier: avg.tier },
        })
      }

      const avgMatch = averageRankFromScores(matchRankScores)
      await tx.ingestMatch.update({
        where: { id: match.id },
        data: { rankTier: avgMatch.tier, rankDivision: avgMatch.division },
      })

      if (logger) await logger.info('DB: ingest_match_players created', { riotMatchId, count: playerRowsToCreate.length })
      return match.id
    },
    { maxWait: 15_000, timeout: 180_000 }
  )

  return { matchDbId, canonicalRiotMatchId: riotMatchId }
}

function toInt(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  if (typeof raw === 'string') {
    const n = Number(raw)
    return Number.isFinite(n) ? Math.trunc(n) : 0
  }
  return 0
}

function buildFallbackItemsFromParticipant(participant: Record<string, unknown>): Array<{
  itemId: number
  starter: boolean
  core: boolean
  order: number
  timestampMs: number
}> {
  const TRINKET_IDS = new Set([3340, 3363, 3364])
  const raw = [
    toInt(participant.item0),
    toInt(participant.item1),
    toInt(participant.item2),
    toInt(participant.item3),
    toInt(participant.item4),
    toInt(participant.item5),
  ]
  const seen = new Set<number>()
  const items: number[] = []
  for (const itemId of raw) {
    if (!Number.isFinite(itemId) || itemId <= 0) continue
    if (TRINKET_IDS.has(itemId)) continue
    if (seen.has(itemId)) continue
    seen.add(itemId)
    items.push(itemId)
  }
  return items.slice(0, 6).map((itemId, index) => ({
    itemId,
    starter: false,
    core: false,
    order: index,
    timestampMs: 0,
  }))
}

export async function extractIngestTimelineExtras(
  matchDbId: bigint,
  riotMatchId: string,
  timeline: RiotMatchTimelineDto,
  participantDtos: RiotParticipantDto[],
  logger?: ReturnType<typeof createRiotPollerLogger>
): Promise<void> {
  const frames = timeline.info?.frames
  if (!frames?.length) return

  const allPlayers = await prisma.ingestMatchPlayer.findMany({
    where: { matchId: matchDbId },
    select: { id: true, participantId: true },
    orderBy: { participantId: 'asc' },
  })
  const riotPidToDbId = new Map<number, bigint>()
  for (const mp of allPlayers) {
    riotPidToDbId.set(mp.participantId, mp.id)
  }

  const teams = await prisma.ingestTeam.findMany({
    where: { matchId: matchDbId },
    select: { id: true, team: true },
  })
  const matchTeamIdByTeamId = new Map<number, bigint>()
  for (const t of teams) matchTeamIdByTeamId.set(t.team, t.id)

  const allEvents: Array<{ type: string; [key: string]: unknown }> = []
  for (const frame of frames) {
    if (frame.events) {
      for (const ev of frame.events) allEvents.push(ev as (typeof allEvents)[number])
    }
  }

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
      teamRows[teamRows.length - 1].soul = e.name
    }
  }

  for (const [riotTeamId, entries] of drakesByTeam.entries()) {
    const teamDbId = matchTeamIdByTeamId.get(riotTeamId)
    if (!teamDbId || entries.length === 0) continue
    const drakesJson = entries.map((r) => ({
      drakeType: r.drakeType,
      order: r.order,
      soul: r.soul ?? 'none',
    }))
    await prisma.ingestTeam.update({
      where: { id: teamDbId },
      data: { drakesJson: drakesJson as Prisma.InputJsonValue },
    })
  }

  const skillOrderByMatchPlayerId = new Map<bigint, number[]>()
  let skillLevelUpCount = 0
  for (const ev of allEvents) {
    if (ev.type !== 'SKILL_LEVEL_UP') continue
    const e = ev as unknown as RiotTimelineEventSkillLevelUp
    const dbId = riotPidToDbId.get(e.participantId)
    if (!dbId) continue
    if (!skillOrderByMatchPlayerId.has(dbId)) skillOrderByMatchPlayerId.set(dbId, [])
    skillOrderByMatchPlayerId.get(dbId)!.push(e.skillSlot)
    skillLevelUpCount++
  }

  const bucketsByPlayer = new Map<bigint, unknown[]>()
  let bucketRowCount = 0
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
      const damageStats =
        pfo['damageStats'] && typeof pfo['damageStats'] === 'object'
          ? (pfo['damageStats'] as Record<string, unknown>)
          : {}
      const championStats =
        pfo['championStats'] && typeof pfo['championStats'] === 'object'
          ? (pfo['championStats'] as Record<string, unknown>)
          : {}

      const totalGold = toInt(pfo['totalGold'] ?? pfo['total_gold'])
      const timestampSeconds = Math.max(1, Math.floor(toInt(frame.timestamp) / 1000))

      const row = {
        durationBucket,
        currentGold: toInt(pfo['currentGold'] ?? pfo['current_gold']),
        magicDamageDone: toInt(damageStats['magicDamageDone'] ?? damageStats['magic_damage_done']),
        magicDamageDoneToChampion: toInt(
          damageStats['magicDamageDoneToChampions'] ??
            damageStats['magicDamageDoneToChampion'] ??
            damageStats['magic_damage_done_to_champion']
        ),
        magicDamageTaken: toInt(damageStats['magicDamageTaken'] ?? damageStats['magic_damage_taken']),
        physicalDamageDone: toInt(damageStats['physicalDamageDone'] ?? damageStats['physical_damage_done']),
        physicalDamageDoneToChampion: toInt(
          damageStats['physicalDamageDoneToChampions'] ??
            damageStats['physicalDamageDoneToChampion'] ??
            damageStats['physical_damage_done_to_champion']
        ),
        physicalDamageTaken: toInt(damageStats['physicalDamageTaken'] ?? damageStats['physical_damage_taken']),
        totalDamageDone: toInt(damageStats['totalDamageDone'] ?? damageStats['total_damage_done']),
        totalDamageDoneToChampion: toInt(
          damageStats['totalDamageDoneToChampions'] ??
            damageStats['totalDamageDoneToChampion'] ??
            damageStats['total_damage_done_to_champion']
        ),
        totalDamageTaken: toInt(damageStats['totalDamageTaken'] ?? damageStats['total_damage_taken']),
        trueDamageDone: toInt(damageStats['trueDamageDone'] ?? damageStats['true_damage_done']),
        trueDamageDoneToChampion: toInt(
          damageStats['trueDamageDoneToChampions'] ??
            damageStats['trueDamageDoneToChampion'] ??
            damageStats['true_damage_done_to_champion']
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
      }
      if (!bucketsByPlayer.has(dbId)) bucketsByPlayer.set(dbId, [])
      bucketsByPlayer.get(dbId)!.push(row)
      bucketRowCount++
    }
  }

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
    const skillOrder = skillOrderByMatchPlayerId.get(dbMatchPlayerId)
    const timelineBuckets = bucketsByPlayer.get(dbMatchPlayerId) ?? []
    const existing = await prisma.ingestMatchPlayer.findUnique({
      where: { id: dbMatchPlayerId },
      select: { stats: true },
    })
    const prevStats =
      existing?.stats && typeof existing.stats === 'object' && !Array.isArray(existing.stats)
        ? (existing.stats as Record<string, unknown>)
        : {}
    const mergedStats: Record<string, unknown> = { ...prevStats }
    if (timelineBuckets.length) mergedStats['timelineBuckets'] = timelineBuckets

    await prisma.ingestMatchPlayer.update({
      where: { id: dbMatchPlayerId },
      data: {
        items: selected.map((row) => ({
          itemId: row.itemId,
          starter: row.starter,
          core: row.core,
          order: row.order,
          timestampMs: row.timestampMs,
        })) as Prisma.InputJsonValue,
        summonerSpells: buildSummonerSpellIds(tSummoner1, tSummoner2),
        skillOrder: (skillOrder?.length ? skillOrder : []) as Prisma.InputJsonValue,
        stats: mergedStats as Prisma.InputJsonValue,
      },
    })
    itemsRowsUpserted += selected.length
  }

  if (logger) {
    await logger.info('DB: ingest timeline extras', {
      matchId: riotMatchId,
      skillLevelUps: skillLevelUpCount,
      buckets: bucketRowCount,
      itemsRowsUpserted,
    })
  }
}
