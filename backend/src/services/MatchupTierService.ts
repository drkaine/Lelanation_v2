import { Prisma } from '../generated/prisma/index.js'
import { prisma } from '../db.js'

const VALID_LANES = new Set(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const)
const GLOBAL_RANK_KEY = 'GLOBAL'
const SCORE_MIN = -10
const SCORE_MAX = 10

interface MatchParticipantForMatchup {
  championId?: number
  teamId?: number | null
  role?: string | null
  win?: boolean
  kills?: number
  deaths?: number
  assists?: number
  champLevel?: number
}

export interface TierListOptions {
  patch: string
  lane?: string | null
  rankTier?: string | null
  limit?: number
  minGames?: number
}

export interface MatchupDetailsOptions {
  patch: string
  championId: number
  lane?: string | null
  rankTier?: string | null
  minGames?: number
  limit?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizeLane(role: string | null | undefined): string | null {
  if (!role) return null
  const lane = role.toUpperCase().trim()
  if (!VALID_LANES.has(lane as (typeof VALID_LANES extends Set<infer T> ? T : never))) return null
  return lane
}

function normalizeRankTier(rankTier: string | null | undefined): string {
  const v = (rankTier ?? '').trim().toUpperCase()
  return v || GLOBAL_RANK_KEY
}

function rankTierFromMatchRank(matchRank: string | null | undefined): string | null {
  const raw = (matchRank ?? '').trim()
  if (!raw) return null
  const tier = raw.split('_')[0]?.trim().toUpperCase() ?? ''
  return tier || null
}

export function patchFromGameVersion(gameVersion: string | null | undefined): string | null {
  const raw = (gameVersion ?? '').trim()
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length < 2) return null
  const major = Number(parts[0])
  const minor = Number(parts[1])
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null
  return `${major}.${minor}`
}

function previousPatch(patch: string): string | null {
  const parts = patch.split('.')
  if (parts.length !== 2) return null
  const major = Number(parts[0])
  const minor = Number(parts[1])
  if (!Number.isInteger(major) || !Number.isInteger(minor)) return null
  if (minor <= 0) return null
  return `${major}.${minor - 1}`
}

function computeKda(p: MatchParticipantForMatchup): number {
  const kills = typeof p.kills === 'number' ? p.kills : 0
  const assists = typeof p.assists === 'number' ? p.assists : 0
  const deaths = typeof p.deaths === 'number' && p.deaths > 0 ? p.deaths : 1
  return (kills + assists) / deaths
}

type MatchupInputRow = {
  patch: string
  lane: string
  championId: number
  opponentChampionId: number
  rankFilterKey: string
  games: number
  wins: number
  sumKda: number
  sumLevel: number
}

function computeScoreFromAggregates(games: number, wins: number, avgKda: number, avgLevel: number): { score: number; confidence: number } {
  const safeGames = Math.max(1, games)
  const smoothedWinrate = ((wins + 10) / (safeGames + 20)) * 100
  const wrComponent = clamp(((smoothedWinrate - 50) / 50) * 10, SCORE_MIN, SCORE_MAX)
  const kdaComponent = clamp(((avgKda - 3) / 3) * 10, SCORE_MIN, SCORE_MAX)
  const levelComponent = clamp(((avgLevel - 14) / 4) * 10, SCORE_MIN, SCORE_MAX)
  const raw = 0.8 * wrComponent + 0.1 * kdaComponent + 0.1 * levelComponent
  const confidence = clamp(safeGames / 60, 0, 1)
  const scored = Math.round(raw * confidence)
  return {
    score: clamp(scored, SCORE_MIN, SCORE_MAX),
    confidence: Number(confidence.toFixed(4)),
  }
}

async function recomputeScoreAndDelta(row: {
  patch: string
  lane: string
  championId: number
  opponentChampionId: number
  rankFilterKey: string
}): Promise<void> {
  const current = await prisma.$queryRaw<
    Array<{
      games: number
      wins: number
      sum_kda: number
      sum_level: number
    }>
  >(Prisma.sql`
    SELECT games, wins, sum_kda, sum_level
    FROM matchup_tier_scores
    WHERE patch = ${row.patch}
      AND lane = ${row.lane}
      AND champion_id = ${row.championId}
      AND opponent_champion_id = ${row.opponentChampionId}
      AND rank_filter_key = ${row.rankFilterKey}
    LIMIT 1
  `)
  const cur = current[0]
  if (!cur) return

  const games = Number(cur.games)
  const wins = Number(cur.wins)
  const avgKda = games > 0 ? Number(cur.sum_kda) / games : 0
  const avgLevel = games > 0 ? Number(cur.sum_level) / games : 0
  const { score, confidence } = computeScoreFromAggregates(games, wins, avgKda, avgLevel)

  const prev = previousPatch(row.patch)
  const prevScoreRows =
    prev == null
      ? []
      : await prisma.$queryRaw<Array<{ score: number }>>(Prisma.sql`
          SELECT score
          FROM matchup_tier_scores
          WHERE patch = ${prev}
            AND lane = ${row.lane}
            AND champion_id = ${row.championId}
            AND opponent_champion_id = ${row.opponentChampionId}
            AND rank_filter_key = ${row.rankFilterKey}
          LIMIT 1
        `)
  const prevScore = prevScoreRows[0] ? Number(prevScoreRows[0].score) : null
  const delta = prevScore == null ? null : score - prevScore

  await prisma.$executeRaw(Prisma.sql`
    UPDATE matchup_tier_scores
    SET
      avg_kda = ${avgKda},
      avg_level = ${avgLevel},
      score = ${score},
      confidence = ${confidence},
      prev_patch_score = ${prevScore},
      delta_vs_prev_patch = ${delta},
      updated_at = NOW()
    WHERE patch = ${row.patch}
      AND lane = ${row.lane}
      AND champion_id = ${row.championId}
      AND opponent_champion_id = ${row.opponentChampionId}
      AND rank_filter_key = ${row.rankFilterKey}
  `)
}

function buildMatchupRows(params: {
  patch: string
  matchRank: string | null
  participants: MatchParticipantForMatchup[]
}): MatchupInputRow[] {
  const { patch, matchRank, participants } = params
  const rankTier = rankTierFromMatchRank(matchRank)
  const byTeamLane = new Map<string, MatchParticipantForMatchup[]>()
  for (const p of participants) {
    const lane = normalizeLane(p.role)
    const teamId = p.teamId === 100 || p.teamId === 200 ? p.teamId : null
    if (lane == null || teamId == null || typeof p.championId !== 'number' || p.championId <= 0) continue
    const key = `${teamId}:${lane}`
    const arr = byTeamLane.get(key) ?? []
    arr.push(p)
    byTeamLane.set(key, arr)
  }

  const rows = new Map<string, MatchupInputRow>()
  for (const lane of VALID_LANES) {
    const blue = byTeamLane.get(`100:${lane}`) ?? []
    const red = byTeamLane.get(`200:${lane}`) ?? []
    if (!blue.length || !red.length) continue
    for (const b of blue) {
      for (const r of red) {
        const duel: Array<{ p: MatchParticipantForMatchup; opp: MatchParticipantForMatchup }> = [
          { p: b, opp: r },
          { p: r, opp: b },
        ]
        for (const x of duel) {
          if (typeof x.p.championId !== 'number' || typeof x.opp.championId !== 'number') continue
          const base: MatchupInputRow = {
            patch,
            lane,
            championId: x.p.championId,
            opponentChampionId: x.opp.championId,
            rankFilterKey: GLOBAL_RANK_KEY,
            games: 1,
            wins: x.p.win ? 1 : 0,
            sumKda: computeKda(x.p),
            sumLevel: typeof x.p.champLevel === 'number' ? x.p.champLevel : 0,
          }
          const keys = [GLOBAL_RANK_KEY]
          if (rankTier) keys.push(rankTier)
          for (const rankKey of keys) {
            const row: MatchupInputRow = { ...base, rankFilterKey: rankKey }
            const rowKey = `${row.patch}|${row.lane}|${row.championId}|${row.opponentChampionId}|${row.rankFilterKey}`
            const existing = rows.get(rowKey)
            if (!existing) {
              rows.set(rowKey, row)
              continue
            }
            existing.games += row.games
            existing.wins += row.wins
            existing.sumKda += row.sumKda
            existing.sumLevel += row.sumLevel
          }
        }
      }
    }
  }
  return [...rows.values()]
}

export async function ingestMatchupTierScoresFromMatch(params: {
  gameVersion: string | null | undefined
  matchRank: string | null | undefined
  participants: MatchParticipantForMatchup[]
}): Promise<void> {
  const patch = patchFromGameVersion(params.gameVersion)
  if (!patch) return
  const rows = buildMatchupRows({
    patch,
    matchRank: params.matchRank ?? null,
    participants: params.participants,
  })
  for (const row of rows) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO matchup_tier_scores (
        patch, lane, champion_id, opponent_champion_id, rank_filter_key,
        games, wins, sum_kda, sum_level
      ) VALUES (
        ${row.patch}, ${row.lane}, ${row.championId}, ${row.opponentChampionId}, ${row.rankFilterKey},
        ${row.games}, ${row.wins}, ${row.sumKda}, ${row.sumLevel}
      )
      ON CONFLICT (patch, lane, champion_id, opponent_champion_id, rank_filter_key)
      DO UPDATE SET
        games = matchup_tier_scores.games + EXCLUDED.games,
        wins = matchup_tier_scores.wins + EXCLUDED.wins,
        sum_kda = matchup_tier_scores.sum_kda + EXCLUDED.sum_kda,
        sum_level = matchup_tier_scores.sum_level + EXCLUDED.sum_level,
        updated_at = NOW()
    `)
    await recomputeScoreAndDelta({
      patch: row.patch,
      lane: row.lane,
      championId: row.championId,
      opponentChampionId: row.opponentChampionId,
      rankFilterKey: row.rankFilterKey,
    })
  }
}

export async function rebuildMatchupTierScores(options: {
  patch: string
  rankTier?: string | null
}): Promise<{ patch: string; rankFilterKey: string; rows: number }> {
  const patch = options.patch.trim()
  if (!patch) throw new Error('patch is required')
  const rankTier = normalizeRankTier(options.rankTier)
  const rankFilterExpr =
    rankTier === GLOBAL_RANK_KEY
      ? Prisma.sql`'GLOBAL'::text AS rank_filter_key`
      : Prisma.sql`${rankTier}::text AS rank_filter_key`
  const rankWhere =
    rankTier === GLOBAL_RANK_KEY
      ? Prisma.sql`TRUE`
      : Prisma.sql`m.rank IS NOT NULL AND UPPER(TRIM(split_part(m.rank, '_', 1))) = ${rankTier}`

  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM matchup_tier_scores
    WHERE patch = ${patch}
      AND rank_filter_key = ${rankTier}
  `)

  const inserted = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    WITH per_duel AS (
      SELECT
        ${patch}::text AS patch,
        p.role AS lane,
        p.champion_id AS champion_id,
        opp.champion_id AS opponent_champion_id,
        ${rankFilterExpr},
        1::int AS games,
        CASE WHEN p.win THEN 1 ELSE 0 END AS wins,
        ((COALESCE(p.kills, 0) + COALESCE(p.assists, 0))::double precision / GREATEST(1, COALESCE(p.deaths, 0))) AS kda_value,
        COALESCE(p.champ_level, 0)::double precision AS level_value
      FROM participants p
      JOIN participants opp
        ON opp.match_id = p.match_id
       AND opp.team_id IS NOT NULL
       AND p.team_id IS NOT NULL
       AND opp.team_id <> p.team_id
       AND COALESCE(opp.role, 'UNKNOWN') = COALESCE(p.role, 'UNKNOWN')
      JOIN matches m ON m.id = p.match_id
      WHERE p.role IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY')
        AND p.champion_id > 0
        AND opp.champion_id > 0
        AND m.game_version IS NOT NULL
        AND m.game_version LIKE ${`${patch}.%`}
        AND ${rankWhere}
        AND (m.end_of_game_result = 'GameComplete' OR m.end_of_game_result IS NULL)
    ),
    agg AS (
      SELECT
        patch, lane, champion_id, opponent_champion_id, rank_filter_key,
        COUNT(*)::int AS games,
        SUM(wins)::int AS wins,
        SUM(kda_value)::double precision AS sum_kda,
        SUM(level_value)::double precision AS sum_level
      FROM per_duel
      GROUP BY patch, lane, champion_id, opponent_champion_id, rank_filter_key
    ),
    ins AS (
      INSERT INTO matchup_tier_scores (
        patch, lane, champion_id, opponent_champion_id, rank_filter_key,
        games, wins, sum_kda, sum_level
      )
      SELECT
        patch, lane, champion_id, opponent_champion_id, rank_filter_key,
        games, wins, sum_kda, sum_level
      FROM agg
      RETURNING 1
    )
    SELECT COUNT(*)::bigint AS count FROM ins
  `)

  await prisma.$executeRaw(Prisma.sql`
    UPDATE matchup_tier_scores t
    SET
      avg_kda = CASE WHEN t.games > 0 THEN t.sum_kda / t.games ELSE 0 END,
      avg_level = CASE WHEN t.games > 0 THEN t.sum_level / t.games ELSE 0 END
    WHERE t.patch = ${patch}
      AND t.rank_filter_key = ${rankTier}
  `)

  const rows = await prisma.$queryRaw<
    Array<{
      patch: string
      lane: string
      champion_id: number
      opponent_champion_id: number
      rank_filter_key: string
    }>
  >(Prisma.sql`
    SELECT patch, lane, champion_id, opponent_champion_id, rank_filter_key
    FROM matchup_tier_scores
    WHERE patch = ${patch}
      AND rank_filter_key = ${rankTier}
  `)
  for (const row of rows) {
    await recomputeScoreAndDelta({
      patch: row.patch,
      lane: row.lane,
      championId: row.champion_id,
      opponentChampionId: row.opponent_champion_id,
      rankFilterKey: row.rank_filter_key,
    })
  }

  return {
    patch,
    rankFilterKey: rankTier,
    rows: Number(inserted[0]?.count ?? 0n),
  }
}

export async function getTierListByLane(options: TierListOptions): Promise<Array<{
  championId: number
  matchups: number
  totalGames: number
  avgScore: number
  avgWinrate: number
  avgKda: number
  avgLevel: number
  avgConfidence: number
  avgDeltaVsPrevPatch: number | null
}>> {
  const patch = options.patch.trim()
  const rankFilterKey = normalizeRankTier(options.rankTier)
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500))
  const minGames = Math.max(1, Math.min(options.minGames ?? 20, 1000))
  const lane = normalizeLane(options.lane) ?? null
  const laneWhere = lane == null ? Prisma.sql`TRUE` : Prisma.sql`lane = ${lane}`
  const rows = await prisma.$queryRaw<
    Array<{
      championId: number
      matchups: number
      totalGames: number
      avgScore: number
      avgWinrate: number
      avgKda: number
      avgLevel: number
      avgConfidence: number
      avgDeltaVsPrevPatch: number | null
    }>
  >(Prisma.sql`
    SELECT
      champion_id AS "championId",
      COUNT(*)::int AS "matchups",
      SUM(games)::int AS "totalGames",
      ROUND((SUM(score * games)::double precision / NULLIF(SUM(games), 0))::numeric, 2) AS "avgScore",
      ROUND((100.0 * SUM(wins)::double precision / NULLIF(SUM(games), 0))::numeric, 2) AS "avgWinrate",
      ROUND((AVG(avg_kda))::numeric, 2) AS "avgKda",
      ROUND((AVG(avg_level))::numeric, 2) AS "avgLevel",
      ROUND((AVG(confidence))::numeric, 4) AS "avgConfidence",
      ROUND((AVG(delta_vs_prev_patch))::numeric, 2) AS "avgDeltaVsPrevPatch"
    FROM matchup_tier_scores
    WHERE patch = ${patch}
      AND ${laneWhere}
      AND rank_filter_key = ${rankFilterKey}
      AND games >= ${minGames}
    GROUP BY champion_id
    ORDER BY "avgScore" DESC, "totalGames" DESC
    LIMIT ${limit}
  `)
  return rows.map((row) => ({
    championId: Number(row.championId),
    matchups: Number(row.matchups),
    totalGames: Number(row.totalGames),
    avgScore: Number(row.avgScore),
    avgWinrate: Number(row.avgWinrate),
    avgKda: Number(row.avgKda),
    avgLevel: Number(row.avgLevel),
    avgConfidence: Number(row.avgConfidence),
    avgDeltaVsPrevPatch: row.avgDeltaVsPrevPatch == null ? null : Number(row.avgDeltaVsPrevPatch),
  }))
}

export async function getMatchupDetailsByChampion(options: MatchupDetailsOptions): Promise<Array<{
  opponentChampionId: number
  lane: string
  games: number
  wins: number
  winrate: number
  avgKda: number
  avgLevel: number
  score: number
  confidence: number
  prevPatchScore: number | null
  deltaVsPrevPatch: number | null
}>> {
  const patch = options.patch.trim()
  const rankFilterKey = normalizeRankTier(options.rankTier)
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500))
  const minGames = Math.max(1, Math.min(options.minGames ?? 10, 1000))
  const lane = normalizeLane(options.lane) ?? null
  const laneWhere = lane == null ? Prisma.sql`TRUE` : Prisma.sql`lane = ${lane}`
  const rows = await prisma.$queryRaw<
    Array<{
      opponentChampionId: number
      lane: string
      games: number
      wins: number
      winrate: number
      avgKda: number
      avgLevel: number
      score: number
      confidence: number
      prevPatchScore: number | null
      deltaVsPrevPatch: number | null
    }>
  >(Prisma.sql`
    SELECT
      opponent_champion_id AS "opponentChampionId",
      lane,
      games,
      wins,
      ROUND((100.0 * wins::double precision / NULLIF(games, 0))::numeric, 2) AS "winrate",
      ROUND(avg_kda::numeric, 2) AS "avgKda",
      ROUND(avg_level::numeric, 2) AS "avgLevel",
      score,
      confidence,
      prev_patch_score AS "prevPatchScore",
      delta_vs_prev_patch AS "deltaVsPrevPatch"
    FROM matchup_tier_scores
    WHERE patch = ${patch}
      AND champion_id = ${options.championId}
      AND ${laneWhere}
      AND rank_filter_key = ${rankFilterKey}
      AND games >= ${minGames}
    ORDER BY score DESC, games DESC
    LIMIT ${limit}
  `)
  return rows.map((row) => ({
    opponentChampionId: Number(row.opponentChampionId),
    lane: row.lane,
    games: Number(row.games),
    wins: Number(row.wins),
    winrate: Number(row.winrate),
    avgKda: Number(row.avgKda),
    avgLevel: Number(row.avgLevel),
    score: Number(row.score),
    confidence: Number(row.confidence),
    prevPatchScore: row.prevPatchScore == null ? null : Number(row.prevPatchScore),
    deltaVsPrevPatch: row.deltaVsPrevPatch == null ? null : Number(row.deltaVsPrevPatch),
  }))
}

export const __testables = {
  computeScoreFromAggregates,
  buildMatchupRows,
  previousPatch,
  rankTierFromMatchRank,
}

