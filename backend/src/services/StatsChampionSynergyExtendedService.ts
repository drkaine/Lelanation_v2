/**
 * Champion page: synergy table from champion_duo_role_stats (ally pairings).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor } from './statsAggArchive.js'
import { cohortSqlWhere } from '../stats/cohortSqlWhere.js'
import { computeDelta, matchupScoreFromDeltaAndWeight } from './MatchupTierService.js'
import type {
  ChampionMatchupCoreDominanceKey,
  ChampionMatchupSignalLevel,
} from './StatsChampionMatchupsExtendedService.js'
import { synergyLaneScore, synergyLaneZ } from './synergyLaneScore.js'

export interface ChampionSynergyExtendedRow {
  rank: number
  allyChampionId: number
  role: string
  allyRole: string
  games: number
  wins: number
  winrate: number
  winrateDeltaVsReference: number | null
  synergyScore: number
  synergyScoreDeltaVsReference: number | null
  pickrate: number
  pickrateDeltaVsReference: number | null
  delta1: number
  delta2: number
  laneScore: number
  laneScoreDeltaVsReference: number | null
  dominanceKeys: ChampionMatchupCoreDominanceKey[]
  weaknessKeys: ChampionMatchupCoreDominanceKey[]
  laneProfileByKey: Partial<Record<ChampionMatchupCoreDominanceKey, ChampionMatchupSignalLevel>>
}

export interface ChampionSynergyExtendedResult {
  championId: number
  version: string | null
  rankTier: string | null
  roleFilter: string | null
  referenceVersion: string | null
  totalGames: number
  rows: ChampionSynergyExtendedRow[]
}

type RawMyRow = {
  ally_champion_id: number
  role: string
  ally_role: string
  games: bigint
  wins: bigint
  sum_level: number
  sum_kill_def: number
  sum_cs: number
  sum_vision: number
  sum_laning: number
  sum_early: number
}

type RawPeerRow = {
  ally_champion_id: number
  role: string
  ally_role: string
  champion_id: number
  games: bigint
  wins: bigint
  sum_level: number
  sum_kill_def: number
  sum_cs: number
  sum_vision: number
  sum_laning: number
  sum_early: number
}

type RawOverallRow = {
  champion_id: number
  role: string
  games: bigint
  wins: bigint
}

function dominanceFromZscores(z: Record<ChampionMatchupCoreDominanceKey, number>): ChampionMatchupCoreDominanceKey[] {
  const entries = (Object.keys(z) as ChampionMatchupCoreDominanceKey[])
    .map((k) => ({ k, z: z[k] ?? 0 }))
    .filter((e) => e.z >= 0.35)
    .sort((a, b) => b.z - a.z)
  return entries.slice(0, 3).map((e) => e.k)
}

function weaknessFromZscores(z: Record<ChampionMatchupCoreDominanceKey, number>): ChampionMatchupCoreDominanceKey[] {
  const entries = (Object.keys(z) as ChampionMatchupCoreDominanceKey[])
    .map((k) => ({ k, z: z[k] ?? 0 }))
    .filter((e) => e.z <= -0.35)
    .sort((a, b) => a.z - b.z)
  return entries.slice(0, 3).map((e) => e.k)
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

export async function getChampionSynergyExtendedTable(options: {
  championId: number
  version?: string | null
  referenceVersion?: string | null
  rankTier?: string | string[] | null
  role?: string | null
  minGames?: number
  limit?: number
}): Promise<ChampionSynergyExtendedResult | null> {
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
  const duoFrom = await matchVersionedAggFrom('agg_champion_duo_role_stats', version, 'duo')

  const myWhere = cohortSqlWhere('duo', { championId: championId, version: version, rankTier: options.rankTier, role: roleFilter })
  const mySql = `
    SELECT
      duo.ally_champion_id,
      duo.role,
      duo.ally_role,
      SUM(duo.count_game)::bigint AS games,
      SUM(duo.count_win)::bigint AS wins,
      SUM(duo.sum_max_level_lead_lane_opponent)::double precision AS sum_level,
      SUM(duo.sum_max_kill_deficit)::double precision AS sum_kill_def,
      SUM(duo.sum_max_cs_advantage_on_lane_opponent)::double precision AS sum_cs,
      SUM(duo.sum_vision_score_advantage_lane_opponent)::double precision AS sum_vision,
      SUM(duo.sum_laning_phase_gold_exp_advantage)::double precision AS sum_laning,
      SUM(duo.sum_early_laning_phase_gold_exp_advantage)::double precision AS sum_early
    FROM ${duoFrom}
    WHERE ${myWhere}
    GROUP BY duo.ally_champion_id, duo.role, duo.ally_role
    HAVING SUM(duo.count_game) >= ${minGames}
  `

  const myRows = await queryRawUnsafe<RawMyRow[]>(mySql)
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
  const allyIds = [...new Set(myRows.map((r) => Number(r.ally_champion_id)))]

  const peerDuoWhere = cohortSqlWhere('duo', { version: version, rankTier: options.rankTier, role: roleFilter })
  const peerCoreWhere = cohortSqlWhere('ac', { version: version, rankTier: options.rankTier, role: roleFilter })
  const peerSql = `
    SELECT
      duo.ally_champion_id,
      duo.role,
      duo.ally_role,
      duo.champion_id,
      SUM(duo.count_game)::bigint AS games,
      SUM(duo.count_win)::bigint AS wins,
      SUM(duo.sum_max_level_lead_lane_opponent)::double precision AS sum_level,
      SUM(duo.sum_max_kill_deficit)::double precision AS sum_kill_def,
      SUM(duo.sum_max_cs_advantage_on_lane_opponent)::double precision AS sum_cs,
      SUM(duo.sum_vision_score_advantage_lane_opponent)::double precision AS sum_vision,
      SUM(duo.sum_laning_phase_gold_exp_advantage)::double precision AS sum_laning,
      SUM(duo.sum_early_laning_phase_gold_exp_advantage)::double precision AS sum_early
    FROM ${duoFrom}
    WHERE ${peerDuoWhere}
      AND duo.ally_champion_id IN (${allyIds.join(',')})
    GROUP BY duo.ally_champion_id, duo.role, duo.ally_role, duo.champion_id
    HAVING SUM(duo.count_game) >= 3
  `

  const peerRows = await queryRawUnsafe<RawPeerRow[]>(peerSql)
  const overallRows = await queryRawUnsafe<RawOverallRow[]>(`
    SELECT
      ac.champion_id,
      ac.role,
      SUM(ac.count_game)::bigint AS games,
      SUM(ac.count_win)::bigint AS wins
    FROM ${coreFrom}
    WHERE ${peerCoreWhere}
      AND ac.champion_id IN (${[championId, ...allyIds].join(',')})
    GROUP BY ac.champion_id, ac.role
  `)
  const overallWrByChampionRole = new Map<string, number>()
  for (const r of overallRows) {
    const g = Number(r.games ?? 0)
    const w = Number(r.wins ?? 0)
    overallWrByChampionRole.set(
      `${Number(r.champion_id)}|${String(r.role ?? '').toUpperCase()}`,
      g > 0 ? (100 * w) / g : 50,
    )
  }

  const referenceScoreByAllyKey = new Map<string, number>()
  const referenceWinrateByAllyKey = new Map<string, number>()
  const referencePickrateByAllyKey = new Map<string, number>()
  const referenceLaneScoreByAllyKey = new Map<string, number>()

  if (referenceVersion && normalizePatchMajorMinor(referenceVersion) !== normalizePatchMajorMinor(version ?? '')) {
    const refDuoFrom = await matchVersionedAggFrom('agg_champion_duo_role_stats', referenceVersion, 'duo')
    const refMyWhere = cohortSqlWhere('duo', { championId: championId, version: referenceVersion, rankTier: options.rankTier, role: roleFilter })
    const refMyRows = await queryRawUnsafe<RawMyRow[]>(`
      SELECT
        duo.ally_champion_id,
        duo.role,
        duo.ally_role,
        SUM(duo.count_game)::bigint AS games,
        SUM(duo.count_win)::bigint AS wins,
        SUM(duo.sum_max_level_lead_lane_opponent)::double precision AS sum_level,
        SUM(duo.sum_max_kill_deficit)::double precision AS sum_kill_def,
        SUM(duo.sum_max_cs_advantage_on_lane_opponent)::double precision AS sum_cs,
        SUM(duo.sum_vision_score_advantage_lane_opponent)::double precision AS sum_vision,
        SUM(duo.sum_laning_phase_gold_exp_advantage)::double precision AS sum_laning,
        SUM(duo.sum_early_laning_phase_gold_exp_advantage)::double precision AS sum_early
      FROM ${refDuoFrom}
      WHERE ${refMyWhere}
      GROUP BY duo.ally_champion_id, duo.role, duo.ally_role
      HAVING SUM(duo.count_game) >= ${minGames}
    `)
    if (refMyRows.length > 0) {
      const refTotalGames = refMyRows.reduce((s, r) => s + Number(r.games ?? 0), 0)
      const refAllyIds = [...new Set(refMyRows.map((r) => Number(r.ally_champion_id)))]
      const refPeerWhere = cohortSqlWhere('duo', { version: referenceVersion, rankTier: options.rankTier, role: roleFilter })
      const refPeerRows = await queryRawUnsafe<RawPeerRow[]>(`
        SELECT
          duo.ally_champion_id,
          duo.role,
          duo.ally_role,
          duo.champion_id,
          SUM(duo.count_game)::bigint AS games,
          SUM(duo.count_win)::bigint AS wins,
          SUM(duo.sum_max_level_lead_lane_opponent)::double precision AS sum_level,
          SUM(duo.sum_max_kill_deficit)::double precision AS sum_kill_def,
          SUM(duo.sum_max_cs_advantage_on_lane_opponent)::double precision AS sum_cs,
          SUM(duo.sum_vision_score_advantage_lane_opponent)::double precision AS sum_vision,
          SUM(duo.sum_laning_phase_gold_exp_advantage)::double precision AS sum_laning,
          SUM(duo.sum_early_laning_phase_gold_exp_advantage)::double precision AS sum_early
        FROM ${refDuoFrom}
        WHERE ${refPeerWhere}
          AND duo.ally_champion_id IN (${refAllyIds.join(',')})
        GROUP BY duo.ally_champion_id, duo.role, duo.ally_role, duo.champion_id
        HAVING SUM(duo.count_game) >= 3
      `)
      const refByAllyKey = new Map<string, RawPeerRow[]>()
      for (const pr of refPeerRows) {
        const k = `${Number(pr.ally_champion_id)}|${String(pr.role ?? '').toUpperCase()}|${String(pr.ally_role ?? '').toUpperCase()}`
        const list = refByAllyKey.get(k) ?? []
        list.push(pr)
        refByAllyKey.set(k, list)
      }
      const refGamesInRole = new Map<string, number>()
      for (const r of refMyRows) {
        const rk = String(r.role ?? '').toUpperCase()
        refGamesInRole.set(rk, (refGamesInRole.get(rk) ?? 0) + Number(r.games ?? 0))
      }
      for (const mr of refMyRows) {
        const ally = Number(mr.ally_champion_id)
        const role = String(mr.role ?? '').toUpperCase()
        const allyRole = String(mr.ally_role ?? '').toUpperCase()
        const g = Number(mr.games ?? 0)
        const w = Number(mr.wins ?? 0)
        const wrPct = g > 0 ? (100 * w) / g : 0
        const peers = refByAllyKey.get(`${ally}|${role}|${allyRole}`) ?? []
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
        const laneScoreRaw = synergyLaneScore(synergyLaneZ(mr, peers, championId).z)
        const key = `${ally}|${role}|${allyRole}`
        referenceScoreByAllyKey.set(key, score * 100)
        referenceWinrateByAllyKey.set(key, Math.round(wrPct * 100) / 100)
        referencePickrateByAllyKey.set(
          key,
          refTotalGames > 0 ? Math.round((10000 * g) / refTotalGames) / 100 : 0,
        )
        referenceLaneScoreByAllyKey.set(key, laneScoreRaw * 100)
      }
    }
  }

  const byAllyKey = new Map<string, RawPeerRow[]>()
  for (const pr of peerRows) {
    const k = `${Number(pr.ally_champion_id)}|${String(pr.role ?? '').toUpperCase()}|${String(pr.ally_role ?? '').toUpperCase()}`
    const list = byAllyKey.get(k) ?? []
    list.push(pr)
    byAllyKey.set(k, list)
  }

  const gamesInRole = new Map<string, number>()
  for (const r of myRows) {
    const role = String(r.role ?? '').toUpperCase()
    gamesInRole.set(role, (gamesInRole.get(role) ?? 0) + Number(r.games ?? 0))
  }

  type Built = ChampionSynergyExtendedRow & { _sort: number }
  const built: Built[] = []

  for (const mr of myRows) {
    const ally = Number(mr.ally_champion_id)
    const role = String(mr.role ?? '').toUpperCase()
    const allyRole = String(mr.ally_role ?? '').toUpperCase()
    const g = Number(mr.games ?? 0)
    const w = Number(mr.wins ?? 0)
    const wrPct = g > 0 ? (100 * w) / g : 0

    const peers = byAllyKey.get(`${ally}|${role}|${allyRole}`) ?? []
    let sumOtherGames = 0
    let sumOtherWins = 0
    for (const p of peers) {
      if (Number(p.champion_id) === championId) continue
      sumOtherGames += Number(p.games ?? 0)
      sumOtherWins += Number(p.wins ?? 0)
    }
    const avgOthersWrPct = sumOtherGames > 0 ? (100 * sumOtherWins) / sumOtherGames : wrPct
    const myOverallWrPct = overallWrByChampionRole.get(`${championId}|${role}`) ?? 50
    const allyOverallWrPct = overallWrByChampionRole.get(`${ally}|${allyRole}`) ?? 50
    const delta1 = wrPct - (myOverallWrPct + allyOverallWrPct) / 2
    const delta2 = wrPct - avgOthersWrPct
    const delta = computeDelta(wrPct, avgOthersWrPct)
    const totalRoleGames = gamesInRole.get(role) ?? g
    const synergyScore = matchupScoreFromDeltaAndWeight({
      delta,
      gamesInMatchup: g,
      totalGamesChampion: Math.max(1, totalRoleGames),
    })

    const { z, cohortSize } = synergyLaneZ(mr, peers, championId)
    const laneScore = synergyLaneScore(z) * 100

    const dominanceKeys = cohortSize >= 2 ? dominanceFromZscores(z) : []
    const weaknessKeys = cohortSize >= 2 ? weaknessFromZscores(z) : []
    const laneProfileByKey: Partial<Record<ChampionMatchupCoreDominanceKey, ChampionMatchupSignalLevel>> =
      cohortSize >= 2
        ? {
            level: signalLevelFromZ(z.level),
            kills: signalLevelFromZ(z.kills),
            cs: signalLevelFromZ(z.cs),
            vision: signalLevelFromZ(z.vision),
            laneEconomy: signalLevelFromZ(z.laneEconomy),
            early: signalLevelFromZ(z.early),
          }
        : {}

    const synergyScorePct = synergyScore * 100
    const allyKey = `${ally}|${role}|${allyRole}`
    built.push({
      rank: 0,
      allyChampionId: ally,
      role,
      allyRole,
      games: g,
      wins: w,
      winrate: Math.round(wrPct * 100) / 100,
      winrateDeltaVsReference: referenceWinrateByAllyKey.has(allyKey)
        ? Number(
            (Math.round(wrPct * 100) / 100 - (referenceWinrateByAllyKey.get(allyKey) ?? 0)).toFixed(2),
          )
        : null,
      synergyScore: Number(synergyScorePct.toFixed(4)),
      synergyScoreDeltaVsReference: referenceScoreByAllyKey.has(allyKey)
        ? Number((synergyScorePct - (referenceScoreByAllyKey.get(allyKey) ?? 0)).toFixed(4))
        : null,
      pickrate: totalGames > 0 ? Math.round((10000 * g) / totalGames) / 100 : 0,
      pickrateDeltaVsReference: referencePickrateByAllyKey.has(allyKey)
        ? Number(
            (
              (totalGames > 0 ? Math.round((10000 * g) / totalGames) / 100 : 0) -
              (referencePickrateByAllyKey.get(allyKey) ?? 0)
            ).toFixed(2),
          )
        : null,
      delta1: Number(delta1.toFixed(2)),
      delta2: Number(delta2.toFixed(2)),
      laneScore,
      laneScoreDeltaVsReference: referenceLaneScoreByAllyKey.has(allyKey)
        ? Number((laneScore - (referenceLaneScoreByAllyKey.get(allyKey) ?? 0)).toFixed(2))
        : null,
      dominanceKeys,
      weaknessKeys,
      laneProfileByKey,
      _sort: synergyScorePct,
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

  const rowsOut: ChampionSynergyExtendedRow[] = sliced.map((r) => {
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
