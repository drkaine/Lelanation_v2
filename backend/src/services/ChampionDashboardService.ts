/**
 * Dashboard champion : moyennes par partie, percentiles vs tous les champions
 * (radar « Playstyle ») et détail par rôle.
 * Runtime source policy: incremental aggregate tables.
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { buildChampionScopedWhere, buildRawMatchCond } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'
import {
  normalizeStatsRoleForChampion,
  normalizedRankTiers,
  statsRoleSqlLiteral,
  toQueryStringArrayParam,
} from '../utils/statsFilters.js'
import {
  DASHBOARD_METRIC_KEYS,
  dashboardBreakdowns,
  kdaRatio,
  metricPercentiles,
  radarScores,
  type DashboardBreakdowns,
  type DashboardMetricValues,
  type DashboardRadarAxis,
} from './championDashboardMath.js'

/** Un champion doit avoir au moins ce nombre de parties pour compter dans la population des percentiles. */
const MIN_GAMES_FOR_POPULATION = 30

type Scope = {
  championId: number
  version?: string | string[] | null
  rankTier?: string | string[] | null
  role?: string | null
}

export type ChampionDashboardRole = {
  role: string
  games: number
  winrate: number
  kills: number
  deaths: number
  assists: number
  kda: number
  gold: number
  csPerMin: number
  damage: number
}

export type ChampionDashboardSummary = {
  championId: number
  games: number
  winrate: number
  /** Valeurs moyennes par partie (KDA et CS/min sont des ratios). */
  metrics: DashboardMetricValues
  /** Percentile 0–100 de chaque métrique parmi les champions de la population. */
  percentiles: DashboardMetricValues
  radar: Record<DashboardRadarAxis, number>
  /** Sous-lignes des dropdowns (dégâts par type, gank / dive) pour le champion seul. */
  breakdowns: DashboardBreakdowns
  roles: ChampionDashboardRole[]
}

type ObjectiveRow = {
  champion_id: number
  role: string
  games: bigint
  wins: bigint
  sum_gold: number
  sum_taken: number
  sum_taken_physical: number
  sum_taken_magic: number
  sum_taken_true: number
  sum_mitigated: number
  sum_heal: number
  sum_wards_placed: number
  sum_wards_killed: number
  sum_vision: number
  sum_turrets: number
  sum_dragons: number
  sum_barons: number
  sum_cs: number
  sum_length: number
  sum_first_blood: number
}

type DamageRow = {
  champion_id: number
  role: string
  sum_damage: number
  sum_damage_physical: number
  sum_damage_magic: number
  sum_damage_true: number
  damage_games: bigint
}

type LaneEventRow = {
  games: bigint
  sum_kill_by_gank: number
  sum_kill_by_dive: number
  sum_death_by_gank: number
  sum_death_by_dive: number
}

type KdaRow = {
  champion_id: number
  role: string
  sum_k: bigint
  sum_de: bigint
  sum_a: bigint
}

/** Totaux agrégés (par champion ou par rôle) avant conversion en moyennes. */
type Totals = {
  games: number
  wins: number
  gold: number
  damage: number
  /** Parties dont les dégâts aux champions ont été enregistrés (dénominateur de la moyenne). */
  damageGames: number
  damagePhysical: number
  damageMagic: number
  damageTrue: number
  taken: number
  takenPhysical: number
  takenMagic: number
  takenTrue: number
  mitigated: number
  heal: number
  wardsPlaced: number
  wardsKilled: number
  vision: number
  turrets: number
  dragons: number
  barons: number
  cs: number
  length: number
  firstBlood: number
  k: number
  d: number
  a: number
}

function emptyTotals(): Totals {
  return {
    games: 0,
    wins: 0,
    gold: 0,
    damage: 0,
    damageGames: 0,
    damagePhysical: 0,
    damageMagic: 0,
    damageTrue: 0,
    taken: 0,
    takenPhysical: 0,
    takenMagic: 0,
    takenTrue: 0,
    mitigated: 0,
    heal: 0,
    wardsPlaced: 0,
    wardsKilled: 0,
    vision: 0,
    turrets: 0,
    dragons: 0,
    barons: 0,
    cs: 0,
    length: 0,
    firstBlood: 0,
    k: 0,
    d: 0,
    a: 0,
  }
}

function round(n: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function perGame(sum: number, games: number): number {
  return games > 0 ? sum / games : 0
}

export function totalsToMetrics(t: Totals): DashboardMetricValues {
  const g = t.games
  const minutes = t.length / 60
  return {
    firstBlood: perGame(t.firstBlood, g),
    deaths: perGame(t.d, g),
    kills: perGame(t.k, g),
    assists: perGame(t.a, g),
    damage: perGame(t.damage, t.damageGames),
    kda: kdaRatio(t.k, t.d, t.a),
    turrets: perGame(t.turrets, g),
    wardsPlaced: perGame(t.wardsPlaced, g),
    visionScore: perGame(t.vision, g),
    wardsKilled: perGame(t.wardsKilled, g),
    dragons: perGame(t.dragons, g),
    barons: perGame(t.barons, g),
    heal: perGame(t.heal, g),
    tanked: perGame(t.taken, g),
    mitigated: perGame(t.mitigated, g),
    csPerMin: minutes > 0 ? t.cs / minutes : 0,
    gold: perGame(t.gold, g),
    totalCs: perGame(t.cs, g),
  }
}

function roundMetrics(m: DashboardMetricValues): DashboardMetricValues {
  const out = {} as DashboardMetricValues
  for (const key of DASHBOARD_METRIC_KEYS) {
    const digits = key === 'kda' || key === 'csPerMin' || key === 'firstBlood' ? 2 : 1
    out[key] = round(m[key], digits)
  }
  return out
}

const OBJECTIVE_SELECT = `
      COALESCE(SUM(cs.count_game), 0)::bigint AS games,
      COALESCE(SUM(cs.count_win), 0)::bigint AS wins,
      COALESCE(SUM(cs.sum_gold_earned), 0)::double precision AS sum_gold,
      COALESCE(SUM(cs.sum_physical_damage_taken
        + cs.sum_magic_damage_taken
        + cs.sum_true_damage_taken), 0)::double precision AS sum_taken,
      COALESCE(SUM(cs.sum_physical_damage_taken), 0)::double precision AS sum_taken_physical,
      COALESCE(SUM(cs.sum_magic_damage_taken), 0)::double precision AS sum_taken_magic,
      COALESCE(SUM(cs.sum_true_damage_taken), 0)::double precision AS sum_taken_true,
      COALESCE(SUM(cs.sum_damage_self_mitigated), 0)::double precision AS sum_mitigated,
      COALESCE(SUM(cs.sum_total_heal), 0)::double precision AS sum_heal,
      COALESCE(SUM(cs.sum_wards_placed), 0)::double precision AS sum_wards_placed,
      COALESCE(SUM(cs.sum_wards_killed), 0)::double precision AS sum_wards_killed,
      COALESCE(SUM(cs.sum_vision_score), 0)::double precision AS sum_vision,
      COALESCE(SUM(cs.sum_turret_takedowns), 0)::double precision AS sum_turrets,
      COALESCE(SUM(cs.sum_dragon_kills), 0)::double precision AS sum_dragons,
      COALESCE(SUM(cs.sum_baron_kills), 0)::double precision AS sum_barons,
      COALESCE(SUM(cs.sum_total_minions_killed + cs.sum_neutral_minions_killed), 0)::double precision AS sum_cs,
      COALESCE(SUM(cs.sum_game_length), 0)::double precision AS sum_length,
      COALESCE(SUM(cs.count_first_blood_kill_true), 0)::double precision AS sum_first_blood`

function addObjectiveRow(t: Totals, r: ObjectiveRow): void {
  t.games += Number(r.games ?? 0)
  t.wins += Number(r.wins ?? 0)
  t.gold += Number(r.sum_gold ?? 0)
  t.taken += Number(r.sum_taken ?? 0)
  t.takenPhysical += Number(r.sum_taken_physical ?? 0)
  t.takenMagic += Number(r.sum_taken_magic ?? 0)
  t.takenTrue += Number(r.sum_taken_true ?? 0)
  t.mitigated += Number(r.sum_mitigated ?? 0)
  t.heal += Number(r.sum_heal ?? 0)
  t.wardsPlaced += Number(r.sum_wards_placed ?? 0)
  t.wardsKilled += Number(r.sum_wards_killed ?? 0)
  t.vision += Number(r.sum_vision ?? 0)
  t.turrets += Number(r.sum_turrets ?? 0)
  t.dragons += Number(r.sum_dragons ?? 0)
  t.barons += Number(r.sum_barons ?? 0)
  t.cs += Number(r.sum_cs ?? 0)
  t.length += Number(r.sum_length ?? 0)
  t.firstBlood += Number(r.sum_first_blood ?? 0)
}

function addDamageRow(t: Totals, r: DamageRow): void {
  t.damage += Number(r.sum_damage ?? 0)
  t.damageGames += Number(r.damage_games ?? 0)
  t.damagePhysical += Number(r.sum_damage_physical ?? 0)
  t.damageMagic += Number(r.sum_damage_magic ?? 0)
  t.damageTrue += Number(r.sum_damage_true ?? 0)
}

function addKdaRow(t: Totals, r: KdaRow): void {
  t.k += Number(r.sum_k ?? 0)
  t.d += Number(r.sum_de ?? 0)
  t.a += Number(r.sum_a ?? 0)
}

export async function getChampionDashboard(scope: Scope): Promise<ChampionDashboardSummary | null> {
  if (!isDatabaseConfigured() || scope.championId <= 0) return null

  const version = toQueryStringArrayParam(scope.version)
  const rankTier = toQueryStringArrayParam(scope.rankTier)
  const versionParam = version.length ? version : null
  const rankParam = rankTier.length ? rankTier : null
  const roleDb = normalizeStatsRoleForChampion(scope.role ?? null)

  const [objFrom, coreFrom] = await Promise.all([
    matchVersionedAggFrom('agg_champion_team_objective_stats', versionParam, 'cs'),
    matchVersionedAggFrom('agg_champion_core_stats', versionParam, 'cc'),
  ])

  // Population : tous les champions, filtrés par patch / rang / rôle éventuel.
  const popParts = [buildRawMatchCond(versionParam, rankParam)]
  if (normalizedRankTiers(rankParam).length === 0) popParts.push(`{a}.rank_tier <> 'UNRANKED'`)
  if (roleDb) popParts.push(`{a}.role = '${statsRoleSqlLiteral(roleDb)}'`)
  const popWhere = (alias: string) =>
    popParts.map(p => p.replace(/\bm\./g, `${alias}.`).replace(/\{a\}/g, alias)).join(' AND ')

  // Détail par rôle : le champion seul, sans filtre de rôle.
  const roleWhere = (alias: string) =>
    buildChampionScopedWhere(alias, {
      championId: scope.championId,
      version: versionParam,
      rankTier: rankParam,
      role: null,
    })

  // Dégâts aux champions : lus dans agg_champion_bucket, où ils sont renseignés. Les lignes sans
  // dégât enregistré (partie sans donnée) sont exclues du dénominateur pour ne pas diluer la moyenne.
  const bucketFrom = await matchVersionedAggFrom('agg_champion_bucket', versionParam, 'cb')
  const bucketDamageExpr =
    'cb.sum_physical_damage_done_to_champion + cb.sum_magic_damage_done_to_champion + cb.sum_true_damage_done_to_champion'
  const DAMAGE_SELECT = `
      COALESCE(SUM(${bucketDamageExpr}), 0)::double precision AS sum_damage,
      COALESCE(SUM(cb.sum_physical_damage_done_to_champion), 0)::double precision AS sum_damage_physical,
      COALESCE(SUM(cb.sum_magic_damage_done_to_champion), 0)::double precision AS sum_damage_magic,
      COALESCE(SUM(cb.sum_true_damage_done_to_champion), 0)::double precision AS sum_damage_true,
      COALESCE(SUM(cb.count_game) FILTER (WHERE ${bucketDamageExpr} > 0), 0)::bigint AS damage_games`

  // Gank / dive : détectés sur la timeline des kills avant 15 min, stockés par matchup de lane.
  const vsFrom = await matchVersionedAggFrom('agg_champion_vs_stats', versionParam, 'vs')

  const [objRows, kdaRows, roleObjRows, roleKdaRows, dmgRows, roleDmgRows, laneRows] = await Promise.all([
    queryRawUnsafe<ObjectiveRow[]>(`
      SELECT cs.champion_id::int AS champion_id, ''::text AS role, ${OBJECTIVE_SELECT}
      FROM ${objFrom}
      WHERE ${popWhere('cs')}
      GROUP BY cs.champion_id
      HAVING COALESCE(SUM(cs.count_game), 0) > 0
    `),
    queryRawUnsafe<KdaRow[]>(`
      SELECT cc.champion_id::int AS champion_id, ''::text AS role,
        COALESCE(SUM(cc.sum_kills), 0)::bigint AS sum_k,
        COALESCE(SUM(cc.sum_deaths), 0)::bigint AS sum_de,
        COALESCE(SUM(cc.sum_assists), 0)::bigint AS sum_a
      FROM ${coreFrom}
      WHERE ${popWhere('cc')}
      GROUP BY cc.champion_id
    `),
    queryRawUnsafe<ObjectiveRow[]>(`
      SELECT cs.champion_id::int AS champion_id, cs.role::text AS role, ${OBJECTIVE_SELECT}
      FROM ${objFrom}
      WHERE ${roleWhere('cs')}
      GROUP BY cs.champion_id, cs.role
      HAVING COALESCE(SUM(cs.count_game), 0) > 0
    `),
    queryRawUnsafe<KdaRow[]>(`
      SELECT cc.champion_id::int AS champion_id, cc.role::text AS role,
        COALESCE(SUM(cc.sum_kills), 0)::bigint AS sum_k,
        COALESCE(SUM(cc.sum_deaths), 0)::bigint AS sum_de,
        COALESCE(SUM(cc.sum_assists), 0)::bigint AS sum_a
      FROM ${coreFrom}
      WHERE ${roleWhere('cc')}
      GROUP BY cc.champion_id, cc.role
    `),
    queryRawUnsafe<DamageRow[]>(`
      SELECT cb.champion_id::int AS champion_id, ''::text AS role, ${DAMAGE_SELECT}
      FROM ${bucketFrom}
      WHERE ${popWhere('cb')}
      GROUP BY cb.champion_id
    `),
    queryRawUnsafe<DamageRow[]>(`
      SELECT cb.champion_id::int AS champion_id, cb.role::text AS role, ${DAMAGE_SELECT}
      FROM ${bucketFrom}
      WHERE ${roleWhere('cb')}
      GROUP BY cb.champion_id, cb.role
    `),
    queryRawUnsafe<LaneEventRow[]>(`
      SELECT
        COALESCE(SUM(vs.count_game), 0)::bigint AS games,
        COALESCE(SUM(vs.sum_kill_by_gank), 0)::double precision AS sum_kill_by_gank,
        COALESCE(SUM(vs.sum_kill_by_dive), 0)::double precision AS sum_kill_by_dive,
        COALESCE(SUM(vs.sum_death_by_gank), 0)::double precision AS sum_death_by_gank,
        COALESCE(SUM(vs.sum_death_by_dive), 0)::double precision AS sum_death_by_dive
      FROM ${vsFrom}
      WHERE ${popWhere('vs')} AND vs.champion_id = ${Number(scope.championId)}
    `),
  ])

  const byChampion = new Map<number, Totals>()
  for (const r of objRows) {
    const id = Number(r.champion_id)
    const t = byChampion.get(id) ?? emptyTotals()
    addObjectiveRow(t, r)
    byChampion.set(id, t)
  }
  for (const r of kdaRows) {
    const t = byChampion.get(Number(r.champion_id))
    if (t) addKdaRow(t, r)
  }

  for (const r of dmgRows) {
    const t = byChampion.get(Number(r.champion_id))
    if (t) addDamageRow(t, r)
  }

  const target = byChampion.get(scope.championId)
  if (!target || target.games <= 0) return null
  const lane = laneRows[0]

  const population = [...byChampion.values()]
    .filter(t => t.games >= MIN_GAMES_FOR_POPULATION)
    .map(totalsToMetrics)
  const targetMetrics = totalsToMetrics(target)
  const percentiles = metricPercentiles(targetMetrics, population)

  const byRole = new Map<string, Totals>()
  for (const r of roleObjRows) {
    const t = byRole.get(r.role) ?? emptyTotals()
    addObjectiveRow(t, r)
    byRole.set(r.role, t)
  }
  for (const r of roleKdaRows) {
    const t = byRole.get(r.role)
    if (t) addKdaRow(t, r)
  }
  for (const r of roleDmgRows) {
    const t = byRole.get(r.role)
    if (t) addDamageRow(t, r)
  }
  const roles: ChampionDashboardRole[] = [...byRole.entries()]
    .map(([role, t]) => {
      const m = totalsToMetrics(t)
      return {
        role,
        games: t.games,
        winrate: round((t.wins / t.games) * 100, 1),
        kills: round(m.kills, 1),
        deaths: round(m.deaths, 1),
        assists: round(m.assists, 1),
        kda: round(m.kda, 2),
        gold: Math.round(m.gold),
        csPerMin: round(m.csPerMin, 1),
        damage: Math.round(m.damage),
      }
    })
    .sort((a, b) => b.games - a.games)

  return {
    championId: scope.championId,
    games: target.games,
    winrate: round((target.wins / target.games) * 100, 1),
    metrics: roundMetrics(targetMetrics),
    percentiles,
    radar: radarScores(percentiles),
    breakdowns: dashboardBreakdowns({
      damage: {
        games: target.damageGames,
        physical: target.damagePhysical,
        magic: target.damageMagic,
        true: target.damageTrue,
      },
      tanked: {
        games: target.games,
        physical: target.takenPhysical,
        magic: target.takenMagic,
        true: target.takenTrue,
      },
      laneEvents: {
        games: Number(lane?.games ?? 0),
        killByGank: Number(lane?.sum_kill_by_gank ?? 0),
        killByDive: Number(lane?.sum_kill_by_dive ?? 0),
        deathByGank: Number(lane?.sum_death_by_gank ?? 0),
        deathByDive: Number(lane?.sum_death_by_dive ?? 0),
      },
    }),
    roles,
  }
}
