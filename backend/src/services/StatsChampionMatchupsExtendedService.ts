/**
 * Champion page: rich matchup table (lane sums, peer-relative lane score, dominance hints).
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor } from './statsAggArchive.js'
import { computeDelta, matchupScoreFromDeltaAndWeight } from './MatchupTierService.js'

export type ChampionMatchupDominanceKey =
  | 'early'
  | 'laneEconomy'
  | 'kills'
  | 'level'
  | 'cs'
  | 'vision'

export type ChampionMatchupSignalLevel =
  | 'bigAdvantage'
  | 'mediumAdvantage'
  | 'smallAdvantage'
  | 'even'
  | 'smallDisadvantage'
  | 'mediumDisadvantage'
  | 'bigDisadvantage'

export interface ChampionMatchupExtendedRow {
  rank: number
  opponentChampionId: number
  role: string
  games: number
  wins: number
  winrate: number
  winrateDeltaVsReference: number | null
  matchupScore: number
  matchupScoreDeltaVsReference: number | null
  pickrate: number
  pickrateDeltaVsReference: number | null
  laneScore: number
  laneScoreDeltaVsReference: number | null
  dominanceKeys: ChampionMatchupDominanceKey[]
  weaknessKeys: ChampionMatchupDominanceKey[]
  laneProfileByKey: Partial<Record<ChampionMatchupDominanceKey, ChampionMatchupSignalLevel>>
}

export interface ChampionMatchupExtendedResult {
  championId: number
  version: string | null
  rankTier: string | null
  roleFilter: string | null
  referenceVersion: string | null
  totalGames: number
  rows: ChampionMatchupExtendedRow[]
}

type RawMyRow = {
  opponent_champion_id: number
  role: string
  games: bigint
  wins: bigint
  sum_level: bigint
  sum_kill_def: bigint
  sum_cs: bigint
  sum_vision: bigint
  sum_laning: bigint
  sum_early: bigint
}

type RawPeerRow = {
  opponent_champion_id: number
  role: string
  champion_id: number
  games: bigint
  wins: bigint
  sum_level: bigint
  sum_kill_def: bigint
  sum_cs: bigint
  sum_vision: bigint
  sum_laning: bigint
  sum_early: bigint
}

function buildCoreWhere(
  championId: number,
  version: string | null,
  rankTier: string | string[] | null | undefined,
  role: string | null,
): string {
  const parts: string[] = [`ac.champion_id = ${championId}`]
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 1) parts.push(`ac.rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
  else if (ranks.length > 1) {
    parts.push(`ac.rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
  }
  if (version != null && version !== '') {
    parts.push(`ac.game_version LIKE '${normalizePatchMajorMinor(version).replace(/'/g, "''")}%'`)
  }
  if (role != null && role !== '') {
    parts.push(`ac.role = '${role.replace(/'/g, "''").toUpperCase()}'`)
  }
  return parts.join(' AND ')
}

function buildPeerCoreWhere(
  version: string | null,
  rankTier: string | string[] | null | undefined,
  role: string | null,
): string {
  const parts: string[] = ['1=1']
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 1) parts.push(`ac.rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
  else if (ranks.length > 1) {
    parts.push(`ac.rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
  }
  if (version != null && version !== '') {
    parts.push(`ac.game_version LIKE '${normalizePatchMajorMinor(version).replace(/'/g, "''")}%'`)
  }
  if (role != null && role !== '') {
    parts.push(`ac.role = '${role.replace(/'/g, "''").toUpperCase()}'`)
  }
  return parts.join(' AND ')
}

function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (values.length < 2) return { mean, std: 0 }
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
  return { mean, std: Math.sqrt(Math.max(0, variance)) }
}

function zscore(v: number, mean: number, std: number): number {
  if (!Number.isFinite(v) || !Number.isFinite(mean)) return 0
  const s = std > 1e-9 ? std : 1e-9
  return (v - mean) / s
}

function dominanceFromZscores(z: Record<ChampionMatchupDominanceKey, number>): ChampionMatchupDominanceKey[] {
  const entries = (Object.keys(z) as ChampionMatchupDominanceKey[])
    .map((k) => ({ k, z: z[k] ?? 0 }))
    .filter((e) => e.z >= 0.35)
    .sort((a, b) => b.z - a.z)
  if (entries.length === 0) return []
  const out: ChampionMatchupDominanceKey[] = []
  for (const e of entries.slice(0, 3)) {
    out.push(e.k)
  }
  return out
}

function weaknessFromZscores(z: Record<ChampionMatchupDominanceKey, number>): ChampionMatchupDominanceKey[] {
  const entries = (Object.keys(z) as ChampionMatchupDominanceKey[])
    .map((k) => ({ k, z: z[k] ?? 0 }))
    .filter((e) => e.z <= -0.35)
    .sort((a, b) => a.z - b.z)
  if (entries.length === 0) return []
  const out: ChampionMatchupDominanceKey[] = []
  for (const e of entries.slice(0, 3)) {
    out.push(e.k)
  }
  return out
}

function signalLevelFromZ(z: number): ChampionMatchupSignalLevel {
  if (z >= 1.0) return 'bigAdvantage'
  if (z >= 0.65) return 'mediumAdvantage'
  if (z >= 0.35) return 'smallAdvantage'
  if (z <= -1.0) return 'bigDisadvantage'
  if (z <= -0.65) return 'mediumDisadvantage'
  if (z <= -0.35) return 'smallDisadvantage'
  return 'even'
}

export async function getChampionMatchupsExtendedTable(options: {
  championId: number
  version?: string | null
  referenceVersion?: string | null
  rankTier?: string | string[] | null
  role?: string | null
  minGames?: number
  limit?: number
}): Promise<ChampionMatchupExtendedResult | null> {
  if (!isDatabaseConfigured()) return null
  const championId = options.championId
  const version = options.version != null && options.version !== '' ? options.version : null
  const referenceVersion =
    options.referenceVersion != null && options.referenceVersion !== ''
      ? options.referenceVersion
      : null
  const minGames = options.minGames != null ? Math.max(1, options.minGames) : 10
  const limit = options.limit != null ? Math.min(200, Math.max(1, options.limit)) : 80
  const roleFilter = options.role != null && options.role !== '' ? options.role.toUpperCase() : null

  const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', version, 'ac')
  const vsFrom = await matchVersionedAggFrom('agg_champion_vs_stats', version, 'vs')

  const myWhere = buildCoreWhere(championId, version, options.rankTier, roleFilter)
  const mySql = `
    SELECT
      vs.opponent_champion_id,
      ac.role,
      SUM(vs.count_game)::bigint AS games,
      SUM(vs.count_win)::bigint AS wins,
      SUM(vs.sum_max_level_lead_lane_opponent)::bigint AS sum_level,
      SUM(vs.sum_max_kill_deficit)::bigint AS sum_kill_def,
      SUM(vs.sum_max_cs_advantage_on_lane_opponent)::bigint AS sum_cs,
      SUM(vs.sum_vision_score_advantage_lane_opponent)::bigint AS sum_vision,
      SUM(vs.sum_laning_phase_gold_exp_advantage)::bigint AS sum_laning,
      SUM(vs.sum_early_laning_phase_gold_exp_advantage)::bigint AS sum_early
    FROM ${vsFrom}
    INNER JOIN ${coreFrom} ON ac.id = vs.champion_stat_id
    WHERE ${myWhere}
    GROUP BY vs.opponent_champion_id, ac.role
    HAVING SUM(vs.count_game) >= ${minGames}
  `

  const myRows = await prisma.$queryRawUnsafe<RawMyRow[]>(mySql)
  if (myRows.length === 0) {
    const vKey = version != null ? normalizePatchMajorMinor(version) : null
    const rKey =
      toQueryStringArrayParam(options.rankTier).map((x) => x.toUpperCase()).join(',') || null
    return {
      championId,
      version: vKey,
      rankTier: rKey,
      roleFilter,
      referenceVersion:
        referenceVersion != null ? normalizePatchMajorMinor(referenceVersion) : null,
      totalGames: 0,
      rows: [],
    }
  }

  const totalGames = myRows.reduce((s, r) => s + Number(r.games ?? 0), 0)
  const oppIds = [...new Set(myRows.map((r) => Number(r.opponent_champion_id)))]

  const peerWhere = buildPeerCoreWhere(version, options.rankTier, roleFilter)
  const peerSql = `
    SELECT
      vs.opponent_champion_id,
      ac.role,
      ac.champion_id,
      SUM(vs.count_game)::bigint AS games,
      SUM(vs.count_win)::bigint AS wins,
      SUM(vs.sum_max_level_lead_lane_opponent)::bigint AS sum_level,
      SUM(vs.sum_max_kill_deficit)::bigint AS sum_kill_def,
      SUM(vs.sum_max_cs_advantage_on_lane_opponent)::bigint AS sum_cs,
      SUM(vs.sum_vision_score_advantage_lane_opponent)::bigint AS sum_vision,
      SUM(vs.sum_laning_phase_gold_exp_advantage)::bigint AS sum_laning,
      SUM(vs.sum_early_laning_phase_gold_exp_advantage)::bigint AS sum_early
    FROM ${vsFrom}
    INNER JOIN ${coreFrom} ON ac.id = vs.champion_stat_id
    WHERE ${peerWhere}
      AND vs.opponent_champion_id IN (${oppIds.join(',')})
    GROUP BY vs.opponent_champion_id, ac.role, ac.champion_id
    HAVING SUM(vs.count_game) >= 3
  `

  const peerRows = await prisma.$queryRawUnsafe<RawPeerRow[]>(peerSql)
  const referenceScoreByOppRole = new Map<string, number>()
  const referenceWinrateByOppRole = new Map<string, number>()
  const referencePickrateByOppRole = new Map<string, number>()
  const referenceLaneScoreByOppRole = new Map<string, number>()
  if (referenceVersion && normalizePatchMajorMinor(referenceVersion) !== normalizePatchMajorMinor(version ?? '')) {
    const refCoreFrom = await matchVersionedAggFrom('agg_champion_core_stats', referenceVersion, 'ac')
    const refVsFrom = await matchVersionedAggFrom('agg_champion_vs_stats', referenceVersion, 'vs')
    const refMyWhere = buildCoreWhere(championId, referenceVersion, options.rankTier, roleFilter)
    const refMyRows = await prisma.$queryRawUnsafe<RawMyRow[]>(`
      SELECT
        vs.opponent_champion_id,
        ac.role,
        SUM(vs.count_game)::bigint AS games,
        SUM(vs.count_win)::bigint AS wins,
        SUM(vs.sum_max_level_lead_lane_opponent)::bigint AS sum_level,
        SUM(vs.sum_max_kill_deficit)::bigint AS sum_kill_def,
        SUM(vs.sum_max_cs_advantage_on_lane_opponent)::bigint AS sum_cs,
        SUM(vs.sum_vision_score_advantage_lane_opponent)::bigint AS sum_vision,
        SUM(vs.sum_laning_phase_gold_exp_advantage)::bigint AS sum_laning,
        SUM(vs.sum_early_laning_phase_gold_exp_advantage)::bigint AS sum_early
      FROM ${refVsFrom}
      INNER JOIN ${refCoreFrom} ON ac.id = vs.champion_stat_id
      WHERE ${refMyWhere}
      GROUP BY vs.opponent_champion_id, ac.role
      HAVING SUM(vs.count_game) >= ${minGames}
    `)
    if (refMyRows.length > 0) {
      const refTotalGames = refMyRows.reduce((s, r) => s + Number(r.games ?? 0), 0)
      const refOppIds = [...new Set(refMyRows.map((r) => Number(r.opponent_champion_id)))]
      const refPeerWhere = buildPeerCoreWhere(referenceVersion, options.rankTier, roleFilter)
      const refPeerRows = await prisma.$queryRawUnsafe<RawPeerRow[]>(`
        SELECT
          vs.opponent_champion_id,
          ac.role,
          ac.champion_id,
          SUM(vs.count_game)::bigint AS games,
          SUM(vs.count_win)::bigint AS wins,
          SUM(vs.sum_max_level_lead_lane_opponent)::bigint AS sum_level,
          SUM(vs.sum_max_kill_deficit)::bigint AS sum_kill_def,
          SUM(vs.sum_max_cs_advantage_on_lane_opponent)::bigint AS sum_cs,
          SUM(vs.sum_vision_score_advantage_lane_opponent)::bigint AS sum_vision,
          SUM(vs.sum_laning_phase_gold_exp_advantage)::bigint AS sum_laning,
          SUM(vs.sum_early_laning_phase_gold_exp_advantage)::bigint AS sum_early
        FROM ${refVsFrom}
        INNER JOIN ${refCoreFrom} ON ac.id = vs.champion_stat_id
        WHERE ${refPeerWhere}
          AND vs.opponent_champion_id IN (${refOppIds.join(',')})
        GROUP BY vs.opponent_champion_id, ac.role, ac.champion_id
        HAVING SUM(vs.count_game) >= 3
      `)
      const refByOppRole = new Map<string, RawPeerRow[]>()
      for (const pr of refPeerRows) {
        const k = `${Number(pr.opponent_champion_id)}|${String(pr.role ?? '').toUpperCase()}`
        const list = refByOppRole.get(k) ?? []
        list.push(pr)
        refByOppRole.set(k, list)
      }
      const refGamesInRole = new Map<string, number>()
      for (const r of refMyRows) {
        const rk = String(r.role ?? '').toUpperCase()
        refGamesInRole.set(rk, (refGamesInRole.get(rk) ?? 0) + Number(r.games ?? 0))
      }
      for (const mr of refMyRows) {
        const opp = Number(mr.opponent_champion_id)
        const role = String(mr.role ?? '').toUpperCase()
        const g = Number(mr.games ?? 0)
        const w = Number(mr.wins ?? 0)
        const wrPct = g > 0 ? (100 * w) / g : 0
        const peers = refByOppRole.get(`${opp}|${role}`) ?? []
        let sumOtherGames = 0
        let sumOtherWins = 0
        for (const p of peers) {
          if (Number(p.champion_id) === championId) continue
          sumOtherGames += Number(p.games ?? 0)
          sumOtherWins += Number(p.wins ?? 0)
        }
        const avgOthersWrPct = sumOtherGames > 0 ? (100 * sumOtherWins) / sumOtherGames : wrPct
        const delta = computeDelta(wrPct, avgOthersWrPct)
        const totalRoleGames = refGamesInRole.get(role) ?? g
        const score = matchupScoreFromDeltaAndWeight({
          delta,
          gamesInMatchup: g,
          totalGamesChampion: Math.max(1, totalRoleGames),
        })
        const perGame = (sum: bigint) => (g > 0 ? Number(sum) / g : 0)
        const myLevel = perGame(mr.sum_level)
        const myKill = -perGame(mr.sum_kill_def)
        const myCs = perGame(mr.sum_cs)
        const myVision = perGame(mr.sum_vision)
        const myLaning = perGame(mr.sum_laning)
        const myEarly = perGame(mr.sum_early)
        const cohort = peers.filter((p) => Number(p.champion_id) !== championId && Number(p.games ?? 0) >= 3)
        const peerAvg = (row: RawPeerRow, sumField: keyof RawPeerRow): number => {
          const gg = Number(row.games ?? 0)
          if (gg <= 0) return 0
          const v = row[sumField]
          return Number(v as bigint) / gg
        }
        const levels = cohort.map((p) => peerAvg(p, 'sum_level'))
        const kills = cohort.map((p) => -peerAvg(p, 'sum_kill_def'))
        const css = cohort.map((p) => peerAvg(p, 'sum_cs'))
        const visions = cohort.map((p) => peerAvg(p, 'sum_vision'))
        const lanings = cohort.map((p) => peerAvg(p, 'sum_laning'))
        const earlys = cohort.map((p) => peerAvg(p, 'sum_early'))
        const mL = meanStd(levels)
        const mK = meanStd(kills)
        const mC = meanStd(css)
        const mV = meanStd(visions)
        const mN = meanStd(lanings)
        const mE = meanStd(earlys)
        const laneComponents = [
          zscore(myLevel, mL.mean, mL.std),
          zscore(myKill, mK.mean, mK.std),
          zscore(myCs, mC.mean, mC.std),
          zscore(myVision, mV.mean, mV.std),
          zscore(myLaning, mN.mean, mN.std),
          zscore(myEarly, mE.mean, mE.std),
        ].filter(Number.isFinite)
        const laneScoreRaw =
          laneComponents.length > 0
            ? Number((laneComponents.reduce((a, b) => a + b, 0) / laneComponents.length).toFixed(2))
            : 0
        const key = `${opp}|${role}`
        referenceScoreByOppRole.set(key, score * 100)
        referenceWinrateByOppRole.set(key, Math.round(wrPct * 100) / 100)
        referencePickrateByOppRole.set(
          key,
          refTotalGames > 0 ? Math.round((10000 * g) / refTotalGames) / 100 : 0
        )
        referenceLaneScoreByOppRole.set(key, laneScoreRaw * 100)
      }
    }
  }

  const byOppRole = new Map<string, RawPeerRow[]>()
  for (const pr of peerRows) {
    const opp = Number(pr.opponent_champion_id)
    const role = String(pr.role ?? '').toUpperCase()
    const k = `${opp}|${role}`
    const list = byOppRole.get(k) ?? []
    list.push(pr)
    byOppRole.set(k, list)
  }

  const gamesInRole = new Map<string, number>()
  for (const r of myRows) {
    const role = String(r.role ?? '').toUpperCase()
    const k = role
    gamesInRole.set(k, (gamesInRole.get(k) ?? 0) + Number(r.games ?? 0))
  }

  type Built = ChampionMatchupExtendedRow & { _sort: number }
  const built: Built[] = []

  for (const mr of myRows) {
    const opp = Number(mr.opponent_champion_id)
    const role = String(mr.role ?? '').toUpperCase()
    const g = Number(mr.games ?? 0)
    const w = Number(mr.wins ?? 0)
    const wrPct = g > 0 ? (100 * w) / g : 0

    const peers = byOppRole.get(`${opp}|${role}`) ?? []
    let sumOtherGames = 0
    let sumOtherWins = 0
    for (const p of peers) {
      const cid = Number(p.champion_id)
      if (cid === championId) continue
      sumOtherGames += Number(p.games ?? 0)
      sumOtherWins += Number(p.wins ?? 0)
    }
    const avgOthersWrPct = sumOtherGames > 0 ? (100 * sumOtherWins) / sumOtherGames : wrPct
    const delta = computeDelta(wrPct, avgOthersWrPct)
    const totalRoleGames = gamesInRole.get(role) ?? g
    const matchupScore = matchupScoreFromDeltaAndWeight({
      delta,
      gamesInMatchup: g,
      totalGamesChampion: Math.max(1, totalRoleGames),
    })

    const perGame = (sum: bigint) => (g > 0 ? Number(sum) / g : 0)
    const myLevel = perGame(mr.sum_level)
    const myKill = -perGame(mr.sum_kill_def)
    const myCs = perGame(mr.sum_cs)
    const myVision = perGame(mr.sum_vision)
    const myLaning = perGame(mr.sum_laning)
    const myEarly = perGame(mr.sum_early)

    const cohort = peers.filter((p) => Number(p.champion_id) !== championId && Number(p.games ?? 0) >= 3)
    const peerAvg = (row: RawPeerRow, sumField: keyof RawPeerRow): number => {
      const gg = Number(row.games ?? 0)
      if (gg <= 0) return 0
      const v = row[sumField]
      return Number(v as bigint) / gg
    }
    const levels = cohort.map((p) => peerAvg(p, 'sum_level'))
    const kills = cohort.map((p) => -peerAvg(p, 'sum_kill_def'))
    const css = cohort.map((p) => peerAvg(p, 'sum_cs'))
    const visions = cohort.map((p) => peerAvg(p, 'sum_vision'))
    const lanings = cohort.map((p) => peerAvg(p, 'sum_laning'))
    const earlys = cohort.map((p) => peerAvg(p, 'sum_early'))

    const mL = meanStd(levels)
    const mK = meanStd(kills)
    const mC = meanStd(css)
    const mV = meanStd(visions)
    const mN = meanStd(lanings)
    const mE = meanStd(earlys)

    const z: Record<ChampionMatchupDominanceKey, number> = {
      level: zscore(myLevel, mL.mean, mL.std),
      kills: zscore(myKill, mK.mean, mK.std),
      cs: zscore(myCs, mC.mean, mC.std),
      vision: zscore(myVision, mV.mean, mV.std),
      laneEconomy: zscore(myLaning, mN.mean, mN.std),
      early: zscore(myEarly, mE.mean, mE.std),
    }

    const laneComponents = [z.level, z.kills, z.cs, z.vision, z.laneEconomy, z.early].filter(Number.isFinite)
    const laneScoreRaw =
      laneComponents.length > 0
        ? Number(
            (
              laneComponents.reduce((a, b) => a + b, 0) / laneComponents.length
            ).toFixed(2),
          )
        : 0
    const laneScore = laneScoreRaw * 100

    const dominanceKeys = cohort.length >= 2 ? dominanceFromZscores(z) : []
    const weaknessKeys = cohort.length >= 2 ? weaknessFromZscores(z) : []
    const laneProfileByKey: Partial<Record<ChampionMatchupDominanceKey, ChampionMatchupSignalLevel>> =
      cohort.length >= 2
        ? {
            level: signalLevelFromZ(z.level),
            kills: signalLevelFromZ(z.kills),
            cs: signalLevelFromZ(z.cs),
            vision: signalLevelFromZ(z.vision),
            laneEconomy: signalLevelFromZ(z.laneEconomy),
            early: signalLevelFromZ(z.early),
          }
        : {}

    const matchupScorePct = matchupScore * 100
    built.push({
      rank: 0,
      opponentChampionId: opp,
      role,
      games: g,
      wins: w,
      winrate: Math.round(wrPct * 100) / 100,
      winrateDeltaVsReference: referenceWinrateByOppRole.has(`${opp}|${role}`)
        ? Number((Math.round(wrPct * 100) / 100 - (referenceWinrateByOppRole.get(`${opp}|${role}`) ?? 0)).toFixed(2))
        : null,
      matchupScore: Number(matchupScorePct.toFixed(4)),
      matchupScoreDeltaVsReference: referenceScoreByOppRole.has(`${opp}|${role}`)
        ? Number((matchupScorePct - (referenceScoreByOppRole.get(`${opp}|${role}`) ?? 0)).toFixed(4))
        : null,
      pickrate: totalGames > 0 ? Math.round((10000 * g) / totalGames) / 100 : 0,
      pickrateDeltaVsReference: referencePickrateByOppRole.has(`${opp}|${role}`)
        ? Number(((totalGames > 0 ? Math.round((10000 * g) / totalGames) / 100 : 0) - (referencePickrateByOppRole.get(`${opp}|${role}`) ?? 0)).toFixed(2))
        : null,
      laneScore,
      laneScoreDeltaVsReference: referenceLaneScoreByOppRole.has(`${opp}|${role}`)
        ? Number((laneScore - (referenceLaneScoreByOppRole.get(`${opp}|${role}`) ?? 0)).toFixed(2))
        : null,
      dominanceKeys,
      weaknessKeys,
      laneProfileByKey,
      _sort: matchupScorePct,
    })
  }

  built.sort((a, b) => b._sort - a._sort)
  const sliced = built.slice(0, limit)
  sliced.forEach((row, i) => {
    row.rank = i + 1
  })

  const vKey = version != null ? normalizePatchMajorMinor(version) : null
  const rKey =
    toQueryStringArrayParam(options.rankTier).map((x) => x.toUpperCase()).join(',') || null

  const rowsOut: ChampionMatchupExtendedRow[] = sliced.map((r) => {
    const { _sort: _s, ...rest } = r
    void _s
    return rest
  })

  return {
    championId,
    version: vKey,
    rankTier: rKey,
    roleFilter,
    referenceVersion:
      referenceVersion != null ? normalizePatchMajorMinor(referenceVersion) : null,
    totalGames,
    rows: rowsOut,
  }
}
