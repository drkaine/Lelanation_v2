import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { buildChampionScopedWhere } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'

export type ChampionObjectiveSummary = {
  championId: number
  games: number
  wins: number
  winrate: number
  durationRows: Array<{
    durationMin: number
    games: number
    winrate: number
    goldPerMinute: number
    creepsPerMinute: number
    deathsPerMinute: number
    killsAssistsPerMinute: number
    winrateWhenPositiveKillDeathDiff10: number
    winrateWhenPositiveKillDeathDiff20: number
  }>
  drakeTypeDistribution: Array<{ key: string; label: string; total: number; pct: number }>
  soulDistribution: Array<{ key: string; label: string; total: number; pct: number }>
  drakeTypeRows: Array<{
    key: string
    label: string
    gamePct: number
    objectiveWinrate: number
  }>
  soulRows: Array<{
    key: string
    label: string
    gamePct: number
    objectiveWinrate: number
  }>
  /** Jeux avec N kills crédités (1, 2, 3+…) par type d'objectif. */
  killHistograms: Record<string, Record<string, number>>
  rows: Array<{
    key: string
    label: string
    /** % parties avec l'objectif quand l'équipe gagne (col. « First en victoire »). */
    firstByWin: number
    /** % parties avec l'objectif quand l'équipe perd (col. « First en défaite »). */
    firstByLoss: number
    /** % parties côté bleu avec l'objectif. */
    blue: number
    /** % parties côté rouge avec l'objectif. */
    red: number
    objectiveWinrate: number
    winrateBlue: number
    winrateRed: number
  }>
  /** Vol d'objectif, solo, etc. (challenges Riot agrégés). */
  participationCard: {
    stealPct: number
    stealWithSmitePct: number
    stealWithoutSmitePct: number
    soloBaronPct: number
    soloTowerPct: number
    soloDragonPct: number
    soloRiftHeraldPct: number
    soloHordePct: number
    soloInhibitorPct: number
    soloKillPct: number
    soloEpicObjectivePct: number
  }
  /** Dégâts structures / tours (moyennes par partie). */
  structureCard: {
    damageToTurretsPerGame: number
    damageToObjectivesPerGame: number
    damageToBuildingsPerGame: number
    turretsDestroyedPerGame: number
    turretsTakenWithHeraldPerGame: number
  }
  outcomeRows: Array<{
    key: string
    label: string
    securePct: number
    secureWinPct: number
    yieldPct: number
    yieldWinPct: number
  }>
}

type RawObjectiveAgg = {
  games: bigint
  wins: bigint
  first_blood_involved_game: bigint
  first_blood_involved_win: bigint
  first_blood_kill_game: bigint
  first_blood_assist_game: bigint
  first_blood_solo_game: bigint
  elder_drake_total: bigint
  baron_involved_game: bigint
  baron_involved_win: bigint
  baron_kill_game: bigint
  baron_assist_game: bigint
  baron_solo_game: bigint
  dragon_involved_game: bigint
  dragon_involved_win: bigint
  dragon_kill_game: bigint
  dragon_assist_game: bigint
  dragon_solo_game: bigint
  rift_herald_involved_game: bigint
  rift_herald_involved_win: bigint
  rift_herald_kill_game: bigint
  rift_herald_assist_game: bigint
  rift_herald_solo_game: bigint
  horde_involved_game: bigint
  horde_involved_win: bigint
  horde_kill_game: bigint
  horde_assist_game: bigint
  horde_solo_game: bigint
  elder_involved_game: bigint
  elder_involved_win: bigint
  elder_kill_game: bigint
  elder_assist_game: bigint
  elder_solo_game: bigint
  tower_involved_game: bigint
  tower_involved_win: bigint
  tower_kill_game: bigint
  tower_assist_game: bigint
  tower_solo_game: bigint
  inhibitor_involved_game: bigint
  inhibitor_involved_win: bigint
  inhibitor_kill_game: bigint
  inhibitor_assist_game: bigint
  inhibitor_solo_game: bigint
  any_epic_solo_game: bigint
  sum_epic_monster_steals: bigint
  sum_epic_monster_stolen_without_smite: bigint
  sum_objectives_stolen: bigint
  earth_drake_total: bigint
  water_drake_total: bigint
  wind_drake_total: bigint
  fire_drake_total: bigint
  hextec_drake_total: bigint
  chem_drake_total: bigint
  earth_soul_total: bigint
  water_soul_total: bigint
  wind_soul_total: bigint
  fire_soul_total: bigint
  hextec_soul_total: bigint
  chem_soul_total: bigint
  earth_drake_involved_win: bigint
  water_drake_involved_win: bigint
  wind_drake_involved_win: bigint
  fire_drake_involved_win: bigint
  hextec_drake_involved_win: bigint
  chem_drake_involved_win: bigint
  earth_drake_involved_game: bigint
  water_drake_involved_game: bigint
  wind_drake_involved_game: bigint
  fire_drake_involved_game: bigint
  hextec_drake_involved_game: bigint
  chem_drake_involved_game: bigint
  earth_soul_game: bigint
  water_soul_game: bigint
  wind_soul_game: bigint
  fire_soul_game: bigint
  hextec_soul_game: bigint
  chem_soul_game: bigint
  earth_soul_win: bigint
  water_soul_win: bigint
  wind_soul_win: bigint
  fire_soul_win: bigint
  hextec_soul_win: bigint
  chem_soul_win: bigint
  baron_kill_ge1: bigint
  baron_kill_ge2: bigint
  baron_kill_ge3p: bigint
  dragon_kill_ge1: bigint
  dragon_kill_ge2: bigint
  dragon_kill_ge3p: bigint
  tower_kill_ge1: bigint
  tower_kill_ge2: bigint
  tower_kill_ge3p: bigint
  inhibitor_kill_ge1: bigint
  inhibitor_kill_ge2: bigint
  inhibitor_kill_ge3p: bigint
  horde_kill_ge1: bigint
  horde_kill_ge2: bigint
  horde_kill_ge3p: bigint
  horde_kill_ge4: bigint
  horde_kill_ge5p: bigint
  rift_herald_kill_ge1: bigint
  rift_herald_kill_ge2p: bigint
  sum_damage_dealt_to_turrets: bigint
  sum_damage_dealt_to_objectives: bigint
  sum_damage_dealt_to_buildings: bigint
  sum_turret_takedowns: bigint
  sum_turrets_taken_with_rift_herald: bigint
  sum_solo_baron_kills: bigint
  sum_quick_solo_kills: bigint
}

function involvedWinExpr(killCol: string, assistCol: string): string {
  return `COALESCE(SUM(CASE WHEN (${killCol} + ${assistCol}) > 0 THEN cs.count_win ELSE 0 END), 0)`
}

function soulTouchGamesExpr(soulCol: string): string {
  return `COALESCE(SUM(CASE WHEN ${soulCol} > 0 THEN cs.count_game ELSE 0 END), 0)`
}

function soulWinExpr(soulCol: string): string {
  return `COALESCE(SUM(CASE WHEN ${soulCol} > 0 THEN cs.count_win ELSE 0 END), 0)`
}

const KILL_HISTOGRAM_KEYS: Array<{
  key: string
  buckets: Array<{ label: string; col: keyof RawObjectiveAgg }>
}> = [
  {
    key: 'baron',
    buckets: [
      { label: '1', col: 'baron_kill_ge1' },
      { label: '2', col: 'baron_kill_ge2' },
      { label: '3+', col: 'baron_kill_ge3p' },
    ],
  },
  {
    key: 'dragon',
    buckets: [
      { label: '1', col: 'dragon_kill_ge1' },
      { label: '2', col: 'dragon_kill_ge2' },
      { label: '3+', col: 'dragon_kill_ge3p' },
    ],
  },
  {
    key: 'tower',
    buckets: [
      { label: '1', col: 'tower_kill_ge1' },
      { label: '2', col: 'tower_kill_ge2' },
      { label: '3+', col: 'tower_kill_ge3p' },
    ],
  },
  {
    key: 'inhibitor',
    buckets: [
      { label: '1', col: 'inhibitor_kill_ge1' },
      { label: '2', col: 'inhibitor_kill_ge2' },
      { label: '3+', col: 'inhibitor_kill_ge3p' },
    ],
  },
  {
    key: 'horde',
    buckets: [
      { label: '1', col: 'horde_kill_ge1' },
      { label: '2', col: 'horde_kill_ge2' },
      { label: '3', col: 'horde_kill_ge3p' },
      { label: '4', col: 'horde_kill_ge4' },
      { label: '5+', col: 'horde_kill_ge5p' },
    ],
  },
]

function buildKillHistograms(row: RawObjectiveAgg | undefined): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const cfg of KILL_HISTOGRAM_KEYS) {
    const dist: Record<string, number> = {}
    for (const b of cfg.buckets) {
      dist[b.label] = Number(row?.[b.col] ?? 0)
    }
    out[cfg.key] = dist
  }
  const herald: Record<string, number> = {}
  const h1 = Number(row?.rift_herald_kill_ge1 ?? 0)
  const h2p = Number(row?.rift_herald_kill_ge2p ?? 0)
  if (h1 > 0) herald['1'] = h1
  if (h2p > 0) herald['2+'] = h2p
  if (Object.keys(herald).length > 0) out.riftHerald = herald
  return out
}

type RawDurationAgg = {
  duration_bucket: string
  games: bigint
  wins: bigint
  sum_total_gold: bigint
  sum_minions_killed: bigint
  sum_deaths: bigint
  sum_kills_assists: bigint
  sum_time_played: bigint
  kd10_pos_games: bigint
  kd10_pos_wins: bigint
  kd20_pos_games: bigint
  kd20_pos_wins: bigint
}

function involvedGamesExpr(killCol: string, assistCol: string): string {
  return `COALESCE(SUM(CASE WHEN (${killCol} + ${assistCol}) > 0 THEN cs.count_game ELSE 0 END), 0)`
}

function touchGamesExpr(col: string): string {
  return `COALESCE(SUM(CASE WHEN ${col} > 0 THEN cs.count_game ELSE 0 END), 0)`
}

function touchSumGamesExpr(sumCol: string): string {
  return `COALESCE(SUM(CASE WHEN ${sumCol} > 0 THEN cs.count_game ELSE 0 END), 0)`
}

function involvedGamesFromSumKillAssistExpr(sumKillCol: string, assistCol: string): string {
  return `COALESCE(SUM(CASE WHEN (${sumKillCol} + ${assistCol}) > 0 THEN cs.count_game ELSE 0 END), 0)`
}

function soloTouchFromSumKillAssistExpr(sumKillCol: string, assistCol: string): string {
  return `COALESCE(SUM(CASE WHEN ${sumKillCol} > 0 AND ${assistCol} = 0 THEN cs.count_game ELSE 0 END), 0)`
}

/** Parties où le joueur a le crédit kill sans assist sur cet objectif. */
function soloTouchGamesExpr(killCol: string, assistCol: string): string {
  return `COALESCE(SUM(CASE WHEN ${killCol} > 0 AND ${assistCol} = 0 THEN cs.count_game ELSE 0 END), 0)`
}

/** % parties avec au moins un événement (proxy quand seuls des sum_* existent, max ~1 par match). */
function pctGamesWithEvents(totalEvents: number, games: number): number {
  if (games <= 0 || totalEvents <= 0) return 0
  return Number(((100 * Math.min(games, totalEvents)) / games).toFixed(2))
}

function parseDurationBucketMin(bucket: string): number {
  const s = String(bucket ?? '').trim()
  if (!s) return 0
  const m = s.match(/^(\d+)/)
  return m ? Number(m[1]) : 0
}

export async function getChampionObjectivesSummary(options: {
  championId: number
  version?: string | null
  rankTier?: string | string[] | null
  role?: string | null
}): Promise<ChampionObjectiveSummary | null> {
  if (!isDatabaseConfigured()) return null
  const championId = options.championId
  const version = options.version ?? null
  const role = options.role ?? null
  const scope = {
    championId,
    version,
    rankTier: options.rankTier ?? null,
    role,
  }
  const where = buildChampionScopedWhere('cs', scope)

  try {
    const csFrom = await matchVersionedAggFrom(
      'agg_champion_team_objective_stats',
      version,
      'cs'
    )

    const rows = await queryRawUnsafe<RawObjectiveAgg[]>(`
      SELECT
        COALESCE(SUM(cs.count_game), 0)::bigint AS games,
        COALESCE(SUM(cs.count_win), 0)::bigint AS wins,
        ${involvedGamesExpr('cs.count_first_blood_kill_true', 'cs.count_first_blood_assist_true')}::bigint AS first_blood_involved_game,
        ${involvedWinExpr('cs.count_first_blood_kill_true', 'cs.count_first_blood_assist_true')}::bigint AS first_blood_involved_win,
        ${touchGamesExpr('cs.count_first_blood_kill_true')}::bigint AS first_blood_kill_game,
        ${touchGamesExpr('cs.count_first_blood_assist_true')}::bigint AS first_blood_assist_game,
        ${soloTouchGamesExpr('cs.count_first_blood_kill_true', 'cs.count_first_blood_assist_true')}::bigint AS first_blood_solo_game,
        COALESCE(SUM(cs.count_elder_kill + cs.count_elder_assist), 0)::bigint AS elder_drake_total,
        ${involvedGamesFromSumKillAssistExpr('cs.sum_baron_kills', 'cs.count_baron_assist')}::bigint AS baron_involved_game,
        COALESCE(SUM(cs.count_baron_involved_win), 0)::bigint AS baron_involved_win,
        ${touchSumGamesExpr('cs.sum_baron_kills')}::bigint AS baron_kill_game,
        ${touchGamesExpr('cs.count_baron_assist')}::bigint AS baron_assist_game,
        ${soloTouchFromSumKillAssistExpr('cs.sum_baron_kills', 'cs.count_baron_assist')}::bigint AS baron_solo_game,
        ${involvedGamesExpr('cs.count_dragon_kill', 'cs.count_dragon_assist')}::bigint AS dragon_involved_game,
        COALESCE(SUM(cs.count_dragon_involved_win), 0)::bigint AS dragon_involved_win,
        ${touchGamesExpr('cs.count_dragon_kill')}::bigint AS dragon_kill_game,
        ${touchGamesExpr('cs.count_dragon_assist')}::bigint AS dragon_assist_game,
        ${soloTouchGamesExpr('cs.count_dragon_kill', 'cs.count_dragon_assist')}::bigint AS dragon_solo_game,
        ${involvedGamesExpr('cs.count_rift_herald_kill', 'cs.count_rift_herald_assist')}::bigint AS rift_herald_involved_game,
        COALESCE(SUM(cs.count_rift_herald_involved_win), 0)::bigint AS rift_herald_involved_win,
        ${touchGamesExpr('cs.count_rift_herald_kill')}::bigint AS rift_herald_kill_game,
        ${touchGamesExpr('cs.count_rift_herald_assist')}::bigint AS rift_herald_assist_game,
        ${soloTouchGamesExpr('cs.count_rift_herald_kill', 'cs.count_rift_herald_assist')}::bigint AS rift_herald_solo_game,
        ${involvedGamesExpr('cs.count_horde_kill', 'cs.count_horde_assist')}::bigint AS horde_involved_game,
        COALESCE(SUM(cs.count_horde_involved_win), 0)::bigint AS horde_involved_win,
        ${touchGamesExpr('cs.count_horde_kill')}::bigint AS horde_kill_game,
        ${touchGamesExpr('cs.count_horde_assist')}::bigint AS horde_assist_game,
        ${soloTouchGamesExpr('cs.count_horde_kill', 'cs.count_horde_assist')}::bigint AS horde_solo_game,
        ${involvedGamesExpr('cs.count_elder_kill', 'cs.count_elder_assist')}::bigint AS elder_involved_game,
        ${involvedWinExpr('cs.count_elder_kill', 'cs.count_elder_assist')}::bigint AS elder_involved_win,
        ${touchGamesExpr('cs.count_elder_kill')}::bigint AS elder_kill_game,
        ${touchGamesExpr('cs.count_elder_assist')}::bigint AS elder_assist_game,
        ${soloTouchGamesExpr('cs.count_elder_kill', 'cs.count_elder_assist')}::bigint AS elder_solo_game,
        ${involvedGamesExpr('cs.count_tower_kill', 'cs.count_tower_assist')}::bigint AS tower_involved_game,
        COALESCE(SUM(cs.count_tower_involved_win), 0)::bigint AS tower_involved_win,
        ${touchGamesExpr('cs.count_tower_kill')}::bigint AS tower_kill_game,
        ${touchGamesExpr('cs.count_tower_assist')}::bigint AS tower_assist_game,
        ${soloTouchGamesExpr('cs.count_tower_kill', 'cs.count_tower_assist')}::bigint AS tower_solo_game,
        ${involvedGamesExpr('cs.count_inhibitor_kill', 'cs.count_inhibitor_assist')}::bigint AS inhibitor_involved_game,
        COALESCE(SUM(cs.count_inhibitor_involved_win), 0)::bigint AS inhibitor_involved_win,
        ${touchGamesExpr('cs.count_inhibitor_kill')}::bigint AS inhibitor_kill_game,
        ${touchGamesExpr('cs.count_inhibitor_assist')}::bigint AS inhibitor_assist_game,
        ${soloTouchGamesExpr('cs.count_inhibitor_kill', 'cs.count_inhibitor_assist')}::bigint AS inhibitor_solo_game,
        COALESCE(SUM(CASE WHEN
          (cs.sum_baron_kills > 0 AND cs.count_baron_assist = 0)
          OR (cs.count_dragon_kill > 0 AND cs.count_dragon_assist = 0)
          OR (cs.count_rift_herald_kill > 0 AND cs.count_rift_herald_assist = 0)
          OR (cs.count_horde_kill > 0 AND cs.count_horde_assist = 0)
          OR (cs.count_elder_kill > 0 AND cs.count_elder_assist = 0)
          THEN cs.count_game ELSE 0 END), 0)::bigint AS any_epic_solo_game,
        COALESCE(SUM(cs.sum_epic_monster_steals), 0)::bigint AS sum_epic_monster_steals,
        COALESCE(SUM(cs.sum_epic_monster_stolen_without_smite), 0)::bigint AS sum_epic_monster_stolen_without_smite,
        COALESCE(SUM(cs.sum_objectives_stolen), 0)::bigint AS sum_objectives_stolen,
        COALESCE(SUM(cs.count_earth_drake_kill + cs.count_earth_drake_assist), 0)::bigint AS earth_drake_total,
        COALESCE(SUM(cs.count_water_drake_kill + cs.count_water_drake_assist), 0)::bigint AS water_drake_total,
        COALESCE(SUM(cs.count_wind_drake_kill + cs.count_wind_drake_assist), 0)::bigint AS wind_drake_total,
        COALESCE(SUM(cs.count_fire_drake_kill + cs.count_fire_drake_assist), 0)::bigint AS fire_drake_total,
        COALESCE(SUM(cs.count_hextec_drake_kill + cs.count_hextec_drake_assist), 0)::bigint AS hextec_drake_total,
        COALESCE(SUM(cs.count_chem_drake_kill + cs.count_chem_drake_assist), 0)::bigint AS chem_drake_total,
        COALESCE(SUM(cs.count_earth_soul), 0)::bigint AS earth_soul_total,
        COALESCE(SUM(cs.count_water_soul), 0)::bigint AS water_soul_total,
        COALESCE(SUM(cs.count_wind_soul), 0)::bigint AS wind_soul_total,
        COALESCE(SUM(cs.count_fire_soul), 0)::bigint AS fire_soul_total,
        COALESCE(SUM(cs.count_hextec_soul), 0)::bigint AS hextec_soul_total,
        COALESCE(SUM(cs.count_chem_soul), 0)::bigint AS chem_soul_total,
        ${involvedGamesExpr('cs.count_earth_drake_kill', 'cs.count_earth_drake_assist')}::bigint AS earth_drake_involved_game,
        ${involvedWinExpr('cs.count_earth_drake_kill', 'cs.count_earth_drake_assist')}::bigint AS earth_drake_involved_win,
        ${involvedGamesExpr('cs.count_water_drake_kill', 'cs.count_water_drake_assist')}::bigint AS water_drake_involved_game,
        ${involvedWinExpr('cs.count_water_drake_kill', 'cs.count_water_drake_assist')}::bigint AS water_drake_involved_win,
        ${involvedGamesExpr('cs.count_wind_drake_kill', 'cs.count_wind_drake_assist')}::bigint AS wind_drake_involved_game,
        ${involvedWinExpr('cs.count_wind_drake_kill', 'cs.count_wind_drake_assist')}::bigint AS wind_drake_involved_win,
        ${involvedGamesExpr('cs.count_fire_drake_kill', 'cs.count_fire_drake_assist')}::bigint AS fire_drake_involved_game,
        ${involvedWinExpr('cs.count_fire_drake_kill', 'cs.count_fire_drake_assist')}::bigint AS fire_drake_involved_win,
        ${involvedGamesExpr('cs.count_hextec_drake_kill', 'cs.count_hextec_drake_assist')}::bigint AS hextec_drake_involved_game,
        ${involvedWinExpr('cs.count_hextec_drake_kill', 'cs.count_hextec_drake_assist')}::bigint AS hextec_drake_involved_win,
        ${involvedGamesExpr('cs.count_chem_drake_kill', 'cs.count_chem_drake_assist')}::bigint AS chem_drake_involved_game,
        ${involvedWinExpr('cs.count_chem_drake_kill', 'cs.count_chem_drake_assist')}::bigint AS chem_drake_involved_win,
        ${soulTouchGamesExpr('cs.count_earth_soul')}::bigint AS earth_soul_game,
        ${soulWinExpr('cs.count_earth_soul')}::bigint AS earth_soul_win,
        ${soulTouchGamesExpr('cs.count_water_soul')}::bigint AS water_soul_game,
        ${soulWinExpr('cs.count_water_soul')}::bigint AS water_soul_win,
        ${soulTouchGamesExpr('cs.count_wind_soul')}::bigint AS wind_soul_game,
        ${soulWinExpr('cs.count_wind_soul')}::bigint AS wind_soul_win,
        ${soulTouchGamesExpr('cs.count_fire_soul')}::bigint AS fire_soul_game,
        ${soulWinExpr('cs.count_fire_soul')}::bigint AS fire_soul_win,
        ${soulTouchGamesExpr('cs.count_hextec_soul')}::bigint AS hextec_soul_game,
        ${soulWinExpr('cs.count_hextec_soul')}::bigint AS hextec_soul_win,
        ${soulTouchGamesExpr('cs.count_chem_soul')}::bigint AS chem_soul_game,
        ${soulWinExpr('cs.count_chem_soul')}::bigint AS chem_soul_win,
        COALESCE(SUM(cs.count_baron_kill_ge1_game), 0)::bigint AS baron_kill_ge1,
        COALESCE(SUM(cs.count_baron_kill_ge2_game), 0)::bigint AS baron_kill_ge2,
        COALESCE(SUM(cs.count_baron_kill_ge3p_game), 0)::bigint AS baron_kill_ge3p,
        COALESCE(SUM(cs.count_dragon_kill_ge1_game), 0)::bigint AS dragon_kill_ge1,
        COALESCE(SUM(cs.count_dragon_kill_ge2_game), 0)::bigint AS dragon_kill_ge2,
        COALESCE(SUM(cs.count_dragon_kill_ge3p_game), 0)::bigint AS dragon_kill_ge3p,
        COALESCE(SUM(cs.count_tower_kill_ge1_game), 0)::bigint AS tower_kill_ge1,
        COALESCE(SUM(cs.count_tower_kill_ge2_game), 0)::bigint AS tower_kill_ge2,
        COALESCE(SUM(cs.count_tower_kill_ge3p_game), 0)::bigint AS tower_kill_ge3p,
        COALESCE(SUM(cs.count_inhibitor_kill_ge1_game), 0)::bigint AS inhibitor_kill_ge1,
        COALESCE(SUM(cs.count_inhibitor_kill_ge2_game), 0)::bigint AS inhibitor_kill_ge2,
        COALESCE(SUM(cs.count_inhibitor_kill_ge3p_game), 0)::bigint AS inhibitor_kill_ge3p,
        COALESCE(SUM(cs.count_horde_kill_ge1_game), 0)::bigint AS horde_kill_ge1,
        COALESCE(SUM(cs.count_horde_kill_ge2_game), 0)::bigint AS horde_kill_ge2,
        COALESCE(SUM(cs.count_horde_kill_ge3p_game), 0)::bigint AS horde_kill_ge3p,
        COALESCE(SUM(cs.count_horde_kill_ge4_game), 0)::bigint AS horde_kill_ge4,
        COALESCE(SUM(cs.count_horde_kill_ge5p_game), 0)::bigint AS horde_kill_ge5p,
        COALESCE(SUM(cs.count_rift_herald_kill_ge1_game), 0)::bigint AS rift_herald_kill_ge1,
        COALESCE(SUM(cs.count_rift_herald_kill_ge2p_game), 0)::bigint AS rift_herald_kill_ge2p,
        COALESCE(SUM(cs.sum_damage_dealt_to_turrets), 0)::bigint AS sum_damage_dealt_to_turrets,
        COALESCE(SUM(cs.sum_damage_dealt_to_objectives), 0)::bigint AS sum_damage_dealt_to_objectives,
        COALESCE(SUM(cs.sum_damage_dealt_to_buildings), 0)::bigint AS sum_damage_dealt_to_buildings,
        COALESCE(SUM(cs.sum_turret_takedowns), 0)::bigint AS sum_turret_takedowns,
        COALESCE(SUM(cs.sum_turrets_taken_with_rift_herald), 0)::bigint AS sum_turrets_taken_with_rift_herald,
        COALESCE(SUM(cs.sum_solo_baron_kills), 0)::bigint AS sum_solo_baron_kills,
        COALESCE(SUM(cs.sum_quick_solo_kills), 0)::bigint AS sum_quick_solo_kills
      FROM ${csFrom}
      WHERE ${where}
    `)

    const row = rows[0]
    const games = Number(row?.games ?? 0)
    const wins = Number(row?.wins ?? 0)
    if (games <= 0) {
      return {
        championId,
        games: 0,
        wins: 0,
        winrate: 0,
        durationRows: [],
        drakeTypeDistribution: [],
        soulDistribution: [],
        drakeTypeRows: [],
        soulRows: [],
        killHistograms: {},
        rows: [],
        outcomeRows: [],
        participationCard: {
          stealPct: 0,
          stealWithSmitePct: 0,
          stealWithoutSmitePct: 0,
          soloBaronPct: 0,
          soloTowerPct: 0,
          soloDragonPct: 0,
          soloRiftHeraldPct: 0,
          soloHordePct: 0,
          soloInhibitorPct: 0,
          soloKillPct: 0,
          soloEpicObjectivePct: 0,
        },
        structureCard: {
          damageToTurretsPerGame: 0,
          damageToObjectivesPerGame: 0,
          damageToBuildingsPerGame: 0,
          turretsDestroyedPerGame: 0,
          turretsTakenWithHeraldPerGame: 0,
        },
      }
    }

    const toPct = (num: number, den: number): number =>
      den > 0 ? Number(((100 * num) / den).toFixed(2)) : 0

    const objectiveBaseRows = [
      {
        key: 'firstBlood',
        label: 'First Blood',
        involvedGame: Number(row?.first_blood_involved_game ?? 0),
        involvedWin: Number(row?.first_blood_involved_win ?? 0),
        killGame: Number(row?.first_blood_kill_game ?? 0),
        assistGame: Number(row?.first_blood_assist_game ?? 0),
        soloGame: Number(row?.first_blood_solo_game ?? 0),
      },
      {
        key: 'baron',
        label: 'Baron',
        involvedGame: Number(row?.baron_involved_game ?? 0),
        involvedWin: Number(row?.baron_involved_win ?? 0),
        killGame: Number(row?.baron_kill_game ?? 0),
        assistGame: Number(row?.baron_assist_game ?? 0),
        soloGame: Number(row?.baron_solo_game ?? 0),
      },
      {
        key: 'dragon',
        label: 'Dragon',
        involvedGame: Number(row?.dragon_involved_game ?? 0),
        involvedWin: Number(row?.dragon_involved_win ?? 0),
        killGame: Number(row?.dragon_kill_game ?? 0),
        assistGame: Number(row?.dragon_assist_game ?? 0),
        soloGame: Number(row?.dragon_solo_game ?? 0),
      },
      {
        key: 'riftHerald',
        label: 'Rift Herald',
        involvedGame: Number(row?.rift_herald_involved_game ?? 0),
        involvedWin: Number(row?.rift_herald_involved_win ?? 0),
        killGame: Number(row?.rift_herald_kill_game ?? 0),
        assistGame: Number(row?.rift_herald_assist_game ?? 0),
        soloGame: Number(row?.rift_herald_solo_game ?? 0),
      },
      {
        key: 'horde',
        label: 'Void Grub',
        involvedGame: Number(row?.horde_involved_game ?? 0),
        involvedWin: Number(row?.horde_involved_win ?? 0),
        killGame: Number(row?.horde_kill_game ?? 0),
        assistGame: Number(row?.horde_assist_game ?? 0),
        soloGame: Number(row?.horde_solo_game ?? 0),
      },
      {
        key: 'tower',
        label: 'Tower',
        involvedGame: Number(row?.tower_involved_game ?? 0),
        involvedWin: Number(row?.tower_involved_win ?? 0),
        killGame: Number(row?.tower_kill_game ?? 0),
        assistGame: Number(row?.tower_assist_game ?? 0),
        soloGame: Number(row?.tower_solo_game ?? 0),
      },
      {
        key: 'inhibitor',
        label: 'Inhibitor',
        involvedGame: Number(row?.inhibitor_involved_game ?? 0),
        involvedWin: Number(row?.inhibitor_involved_win ?? 0),
        killGame: Number(row?.inhibitor_kill_game ?? 0),
        assistGame: Number(row?.inhibitor_assist_game ?? 0),
        soloGame: Number(row?.inhibitor_solo_game ?? 0),
      },
    ]

    type SideObjectiveAgg = {
      team: number
      games: bigint
      first_blood_involved: bigint
      baron_involved: bigint
      dragon_involved: bigint
      rift_herald_involved: bigint
      horde_involved: bigint
      tower_involved: bigint
      inhibitor_involved: bigint
      first_blood_involved_win: bigint
      baron_involved_win: bigint
      dragon_involved_win: bigint
      rift_herald_involved_win: bigint
      horde_involved_win: bigint
      tower_involved_win: bigint
      inhibitor_involved_win: bigint
    }

    let sideByTeam: Map<number, SideObjectiveAgg> = new Map()
    try {
      const sideObjRows = await queryRawUnsafe<SideObjectiveAgg[]>(`
        SELECT
          cs.team,
          COALESCE(SUM(cs.count_game), 0)::bigint AS games,
          ${involvedGamesExpr('cs.count_first_blood_kill_true', 'cs.count_first_blood_assist_true')}::bigint AS first_blood_involved,
          ${involvedGamesFromSumKillAssistExpr('cs.sum_baron_kills', 'cs.count_baron_assist')}::bigint AS baron_involved,
          ${involvedGamesExpr('cs.count_dragon_kill', 'cs.count_dragon_assist')}::bigint AS dragon_involved,
          ${involvedGamesExpr('cs.count_rift_herald_kill', 'cs.count_rift_herald_assist')}::bigint AS rift_herald_involved,
          ${involvedGamesExpr('cs.count_horde_kill', 'cs.count_horde_assist')}::bigint AS horde_involved,
          ${involvedGamesExpr('cs.count_tower_kill', 'cs.count_tower_assist')}::bigint AS tower_involved,
          ${involvedGamesExpr('cs.count_inhibitor_kill', 'cs.count_inhibitor_assist')}::bigint AS inhibitor_involved,
          ${involvedWinExpr('cs.count_first_blood_kill_true', 'cs.count_first_blood_assist_true')}::bigint AS first_blood_involved_win,
          ${involvedWinExpr('cs.sum_baron_kills', 'cs.count_baron_assist')}::bigint AS baron_involved_win,
          ${involvedWinExpr('cs.count_dragon_kill', 'cs.count_dragon_assist')}::bigint AS dragon_involved_win,
          ${involvedWinExpr('cs.count_rift_herald_kill', 'cs.count_rift_herald_assist')}::bigint AS rift_herald_involved_win,
          ${involvedWinExpr('cs.count_horde_kill', 'cs.count_horde_assist')}::bigint AS horde_involved_win,
          ${involvedWinExpr('cs.count_tower_kill', 'cs.count_tower_assist')}::bigint AS tower_involved_win,
          ${involvedWinExpr('cs.count_inhibitor_kill', 'cs.count_inhibitor_assist')}::bigint AS inhibitor_involved_win
        FROM ${csFrom}
        WHERE ${where}
        GROUP BY cs.team
      `)
      sideByTeam = new Map(sideObjRows.map((r) => [Number(r.team), r]))
    } catch {
      sideByTeam = new Map()
    }

    const blueSide = sideByTeam.get(100)
    const redSide = sideByTeam.get(200)
    const blueGames = Number(blueSide?.games ?? 0)
    const redGames = Number(redSide?.games ?? 0)

    const sideInvolved = (side: SideObjectiveAgg | undefined, key: string): number => {
      if (!side) return 0
      const map: Record<string, bigint | undefined> = {
        firstBlood: side.first_blood_involved,
        baron: side.baron_involved,
        dragon: side.dragon_involved,
        riftHerald: side.rift_herald_involved,
        horde: side.horde_involved,
        tower: side.tower_involved,
        inhibitor: side.inhibitor_involved,
      }
      return Number(map[key] ?? 0)
    }
    const sideInvolvedWin = (side: SideObjectiveAgg | undefined, key: string): number => {
      if (!side) return 0
      const map: Record<string, bigint | undefined> = {
        firstBlood: side.first_blood_involved_win,
        baron: side.baron_involved_win,
        dragon: side.dragon_involved_win,
        riftHerald: side.rift_herald_involved_win,
        horde: side.horde_involved_win,
        tower: side.tower_involved_win,
        inhibitor: side.inhibitor_involved_win,
      }
      return Number(map[key] ?? 0)
    }

    const rowsOut = objectiveBaseRows.map((r) => {
      const involvedLoss = Math.max(0, r.involvedGame - r.involvedWin)
      return {
        key: r.key,
        label: r.label,
        firstByWin: toPct(r.involvedWin, games),
        firstByLoss: toPct(involvedLoss, games),
        blue: toPct(sideInvolved(blueSide, r.key), blueGames),
        red: toPct(sideInvolved(redSide, r.key), redGames),
        objectiveWinrate: toPct(r.involvedWin, r.involvedGame),
        winrateBlue: toPct(sideInvolvedWin(blueSide, r.key), sideInvolved(blueSide, r.key)),
        winrateRed: toPct(sideInvolvedWin(redSide, r.key), sideInvolved(redSide, r.key)),
      }
    })

    const objectiveSourceByKey = new Map(
      objectiveBaseRows.map((r) => [r.key, { involvedGame: r.involvedGame, involvedWin: r.involvedWin }])
    )

    const outcomeRows = rowsOut.map((r) => {
      const source = objectiveSourceByKey.get(r.key) ?? { involvedGame: 0, involvedWin: 0 }
      const secureGames = Math.max(0, Math.min(games, source.involvedGame))
      const secureWins = Math.max(0, Math.min(secureGames, source.involvedWin))
      const yieldGames = Math.max(0, games - secureGames)
      const yieldWins = Math.max(0, Math.min(yieldGames, wins - secureWins))
      return {
        key: r.key,
        label: r.label,
        securePct: toPct(secureGames, games),
        secureWinPct: toPct(secureWins, secureGames),
        yieldPct: toPct(yieldGames, games),
        yieldWinPct: toPct(yieldWins, yieldGames),
      }
    })

    try {
      const sideFrom = await matchVersionedAggFrom('agg_champion_side_stats', version, 'cs')
      const sideWhere = buildChampionScopedWhere('cs', scope)
      const sideRows = await queryRawUnsafe<Array<{ team: number; games: bigint; wins: bigint }>>(
        `
          SELECT
            cs.team,
            COALESCE(SUM(cs.count_game), 0)::bigint AS games,
            COALESCE(SUM(cs.count_win), 0)::bigint AS wins
          FROM ${sideFrom}
          WHERE ${sideWhere}
          GROUP BY cs.team
        `
      )
      const blue = sideRows.find((r) => Number(r.team) === 100)
      const red = sideRows.find((r) => Number(r.team) === 200)
      const sideOutcomeRows: ChampionObjectiveSummary['outcomeRows'] = []
      const blueGames = Number(blue?.games ?? 0)
      const blueWins = Number(blue?.wins ?? 0)
      const redGames = Number(red?.games ?? 0)
      const redWins = Number(red?.wins ?? 0)
      const sideGamesTotal = Math.max(0, blueGames + redGames)
      if (blueGames > 0 || redGames > 0) {
        sideOutcomeRows.push({
          key: 'blueSide',
          label: 'Blue Side',
          securePct: toPct(blueGames, sideGamesTotal),
          secureWinPct: toPct(blueWins, blueGames),
          yieldPct: toPct(redGames, sideGamesTotal),
          yieldWinPct: toPct(redWins, redGames),
        })
        sideOutcomeRows.push({
          key: 'redSide',
          label: 'Red Side',
          securePct: toPct(redGames, sideGamesTotal),
          secureWinPct: toPct(redWins, redGames),
          yieldPct: toPct(blueGames, sideGamesTotal),
          yieldWinPct: toPct(blueWins, blueGames),
        })
      }
      if (sideOutcomeRows.length > 0) outcomeRows.unshift(...sideOutcomeRows)
    } catch {
      // side breakdown optional
    }

    const drakeTypeDistributionBase = [
      { key: 'elder', label: 'Elder Dragon', total: Number(row?.elder_drake_total ?? 0) },
      { key: 'earth', label: 'Earth', total: Number(row?.earth_drake_total ?? 0) },
      { key: 'water', label: 'Water', total: Number(row?.water_drake_total ?? 0) },
      { key: 'wind', label: 'Wind', total: Number(row?.wind_drake_total ?? 0) },
      { key: 'fire', label: 'Fire', total: Number(row?.fire_drake_total ?? 0) },
      { key: 'hextec', label: 'Hextec', total: Number(row?.hextec_drake_total ?? 0) },
      { key: 'chem', label: 'Chem', total: Number(row?.chem_drake_total ?? 0) },
    ]
    const drakeTotal = drakeTypeDistributionBase.reduce((sum, e) => sum + e.total, 0)
    const drakeTypeDistribution = drakeTypeDistributionBase.map((e) => ({
      ...e,
      pct: drakeTotal > 0 ? Number(((100 * e.total) / drakeTotal).toFixed(2)) : 0,
    }))

    const soulDistributionBase = [
      { key: 'earth', label: 'Earth', total: Number(row?.earth_soul_total ?? 0) },
      { key: 'water', label: 'Water', total: Number(row?.water_soul_total ?? 0) },
      { key: 'wind', label: 'Wind', total: Number(row?.wind_soul_total ?? 0) },
      { key: 'fire', label: 'Fire', total: Number(row?.fire_soul_total ?? 0) },
      { key: 'hextec', label: 'Hextec', total: Number(row?.hextec_soul_total ?? 0) },
      { key: 'chem', label: 'Chem', total: Number(row?.chem_soul_total ?? 0) },
    ]
    const soulTotal = soulDistributionBase.reduce((sum, e) => sum + e.total, 0)
    const soulDistribution = soulDistributionBase.map((e) => ({
      ...e,
      pct: soulTotal > 0 ? Number(((100 * e.total) / soulTotal).toFixed(2)) : 0,
    }))

    const drakeTypeRows = [
      { key: 'elder', label: 'Elder Dragon', involvedGame: Number(row?.elder_involved_game ?? 0), involvedWin: Number(row?.elder_involved_win ?? 0) },
      { key: 'earth', label: 'Earth', involvedGame: Number(row?.earth_drake_involved_game ?? 0), involvedWin: Number(row?.earth_drake_involved_win ?? 0) },
      { key: 'water', label: 'Water', involvedGame: Number(row?.water_drake_involved_game ?? 0), involvedWin: Number(row?.water_drake_involved_win ?? 0) },
      { key: 'wind', label: 'Wind', involvedGame: Number(row?.wind_drake_involved_game ?? 0), involvedWin: Number(row?.wind_drake_involved_win ?? 0) },
      { key: 'fire', label: 'Fire', involvedGame: Number(row?.fire_drake_involved_game ?? 0), involvedWin: Number(row?.fire_drake_involved_win ?? 0) },
      { key: 'hextec', label: 'Hextec', involvedGame: Number(row?.hextec_drake_involved_game ?? 0), involvedWin: Number(row?.hextec_drake_involved_win ?? 0) },
      { key: 'chem', label: 'Chem', involvedGame: Number(row?.chem_drake_involved_game ?? 0), involvedWin: Number(row?.chem_drake_involved_win ?? 0) },
    ].map((e) => ({
      key: e.key,
      label: e.label,
      gamePct: toPct(e.involvedGame, games),
      objectiveWinrate: toPct(e.involvedWin, e.involvedGame),
    }))

    const soulRows = soulDistributionBase.map((e) => {
      const key = e.key as keyof RawObjectiveAgg
      const gameCol = `${key}_soul_game` as keyof RawObjectiveAgg
      const winCol = `${key}_soul_win` as keyof RawObjectiveAgg
      const involvedGame = Number(row?.[gameCol] ?? 0)
      const involvedWin = Number(row?.[winCol] ?? 0)
      return {
        key: e.key,
        label: e.label,
        gamePct: toPct(involvedGame, games),
        objectiveWinrate: toPct(involvedWin, involvedGame),
      }
    })

    const killHistograms = buildKillHistograms(row)

    const epicSteals = Number(row?.sum_epic_monster_steals ?? 0)
    const objectivesStolen = Number(row?.sum_objectives_stolen ?? 0)
    const stealEvents = epicSteals > 0 ? epicSteals : objectivesStolen
    const stealNoSmite = Number(row?.sum_epic_monster_stolen_without_smite ?? 0)
    const stealWithSmite = Math.max(0, stealEvents - stealNoSmite)
    const participationCard = {
      stealPct: pctGamesWithEvents(stealEvents, games),
      stealWithSmitePct: pctGamesWithEvents(stealWithSmite, games),
      stealWithoutSmitePct: pctGamesWithEvents(stealNoSmite, games),
      soloBaronPct: toPct(
        Math.max(Number(row?.baron_solo_game ?? 0), Number(row?.sum_solo_baron_kills ?? 0)),
        games
      ),
      soloTowerPct: toPct(Number(row?.tower_solo_game ?? 0), games),
      soloDragonPct: toPct(Number(row?.dragon_solo_game ?? 0), games),
      soloRiftHeraldPct: toPct(Number(row?.rift_herald_solo_game ?? 0), games),
      soloHordePct: toPct(Number(row?.horde_solo_game ?? 0), games),
      soloInhibitorPct: toPct(Number(row?.inhibitor_solo_game ?? 0), games),
      soloKillPct: pctGamesWithEvents(Number(row?.sum_quick_solo_kills ?? 0), games),
      soloEpicObjectivePct: toPct(Number(row?.any_epic_solo_game ?? 0), games),
    }

    const perGameAvg = (sum: number): number =>
      games > 0 ? Number((sum / games).toFixed(2)) : 0
    const structureCard = {
      damageToTurretsPerGame: perGameAvg(Number(row?.sum_damage_dealt_to_turrets ?? 0)),
      damageToObjectivesPerGame: perGameAvg(Number(row?.sum_damage_dealt_to_objectives ?? 0)),
      damageToBuildingsPerGame: perGameAvg(Number(row?.sum_damage_dealt_to_buildings ?? 0)),
      turretsDestroyedPerGame: perGameAvg(Number(row?.sum_turret_takedowns ?? 0)),
      turretsTakenWithHeraldPerGame: perGameAvg(Number(row?.sum_turrets_taken_with_rift_herald ?? 0)),
    }

    const cbFrom = await matchVersionedAggFrom('agg_champion_bucket', version, 'cb')
    const cbWhere = buildChampionScopedWhere('cb', scope)
    const durationAgg = await queryRawUnsafe<RawDurationAgg[]>(`
      SELECT
        cb.duration_bucket,
        COALESCE(SUM(cb.count_game), 0)::bigint AS games,
        COALESCE(SUM(cb.count_win), 0)::bigint AS wins,
        COALESCE(SUM(cb.sum_total_gold), 0)::bigint AS sum_total_gold,
        COALESCE(SUM(cb.sum_minions_killed), 0)::bigint AS sum_minions_killed,
        COALESCE(SUM(cb.sum_deaths), 0)::bigint AS sum_deaths,
        COALESCE(SUM(cb.sum_kills_assists), 0)::bigint AS sum_kills_assists,
        COALESCE(SUM(cb.sum_time_played), 0)::bigint AS sum_time_played,
        COALESCE(SUM(cb.count_kd_diff_10_positive_game), 0)::bigint AS kd10_pos_games,
        COALESCE(SUM(cb.count_kd_diff_10_positive_win), 0)::bigint AS kd10_pos_wins,
        COALESCE(SUM(cb.count_kd_diff_20_positive_game), 0)::bigint AS kd20_pos_games,
        COALESCE(SUM(cb.count_kd_diff_20_positive_win), 0)::bigint AS kd20_pos_wins
      FROM ${cbFrom}
      WHERE ${cbWhere}
      GROUP BY cb.duration_bucket
    `)

    const perMinute = (sum: number, timeSec: number): number =>
      timeSec > 0 ? Number(((sum * 60) / timeSec).toFixed(2)) : 0
    const wr = (w: number, g: number): number => (g > 0 ? Number(((100 * w) / g).toFixed(2)) : 0)

    const durationRows = durationAgg
      .map((r) => {
        const rowGames = Number(r.games ?? 0)
        const rowWins = Number(r.wins ?? 0)
        const rowTime = Number(r.sum_time_played ?? 0)
        return {
          durationMin: parseDurationBucketMin(String(r.duration_bucket ?? '')),
          games: rowGames,
          winrate: wr(rowWins, rowGames),
          goldPerMinute: perMinute(Number(r.sum_total_gold ?? 0), rowTime),
          creepsPerMinute: perMinute(Number(r.sum_minions_killed ?? 0), rowTime),
          deathsPerMinute: perMinute(Number(r.sum_deaths ?? 0), rowTime),
          killsAssistsPerMinute: perMinute(Number(r.sum_kills_assists ?? 0), rowTime),
          winrateWhenPositiveKillDeathDiff10: wr(
            Number(r.kd10_pos_wins ?? 0),
            Number(r.kd10_pos_games ?? 0)
          ),
          winrateWhenPositiveKillDeathDiff20: wr(
            Number(r.kd20_pos_wins ?? 0),
            Number(r.kd20_pos_games ?? 0)
          ),
        }
      })
      .filter((r) => r.games > 0)
      .sort((a, b) => a.durationMin - b.durationMin)

    return {
      championId,
      games,
      wins,
      winrate: Number(((100 * wins) / games).toFixed(2)),
      durationRows,
      drakeTypeDistribution,
      soulDistribution,
      drakeTypeRows,
      soulRows,
      killHistograms,
      rows: rowsOut,
      outcomeRows,
      participationCard,
      structureCard,
    }
  } catch (err) {
    console.warn('[getChampionObjectivesSummary]', err)
    return null
  }
}
