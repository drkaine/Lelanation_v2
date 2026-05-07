import { isDatabaseConfigured, prisma } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { normalizePatchMajorMinor } from './statsAggArchive.js'

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
  rows: Array<{
    key: string
    label: string
    objectiveWinrate: number
    killRate: number
    assistRate: number
  }>
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
  baron_involved_game: bigint
  baron_involved_win: bigint
  baron_kill_game: bigint
  baron_assist_game: bigint
  dragon_involved_game: bigint
  dragon_involved_win: bigint
  dragon_kill_game: bigint
  dragon_assist_game: bigint
  rift_herald_involved_game: bigint
  rift_herald_involved_win: bigint
  rift_herald_kill_game: bigint
  rift_herald_assist_game: bigint
  horde_involved_game: bigint
  horde_involved_win: bigint
  horde_kill_game: bigint
  horde_assist_game: bigint
  elder_involved_game: bigint
  elder_involved_win: bigint
  elder_kill_game: bigint
  elder_assist_game: bigint
  tower_involved_game: bigint
  tower_involved_win: bigint
  tower_kill_game: bigint
  tower_assist_game: bigint
  inhibitor_involved_game: bigint
  inhibitor_involved_win: bigint
  inhibitor_kill_game: bigint
  inhibitor_assist_game: bigint
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
}

type RawDurationAgg = {
  duration_bucket: number
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

const ARCHIVE_CORE_TABLE = 'archive_agg_champion_core_stats'
const ARCHIVE_PART_TABLE = 'archive_agg_champion_participant_stats'
const ARCHIVE_BUCKET_TABLE = 'archive_agg_champion_bucket'
const ARCHIVE_SIDE_TABLE = 'archive_agg_champion_side_stats'
const columnCache = new Map<string, Set<string>>()

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const cached = columnCache.get(tableName)
  if (cached) return cached
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${tableName.replace(/'/g, "''")}'
    `
  )
  const cols = new Set(rows.map(r => String(r.column_name ?? '').trim()).filter(Boolean))
  columnCache.set(tableName, cols)
  return cols
}

function pickColumn(cols: Set<string>, candidates: string[], fallbackSql = '0'): string {
  for (const c of candidates) {
    if (cols.has(c)) return `ap.${c}`
  }
  return fallbackSql
}

function pickColumnWithAlias(
  cols: Set<string>,
  alias: string,
  candidates: string[],
  fallbackSql = '0'
): string {
  for (const c of candidates) {
    if (cols.has(c)) return `${alias}.${c}`
  }
  return fallbackSql
}

function buildWhere(
  championId: number,
  version: string | null,
  rankTier: string | string[] | null | undefined,
  role: string | null
): string {
  const parts: string[] = [`ac.champion_id = ${championId}`]
  const ranks = toQueryStringArrayParam(rankTier).map(r => r.toUpperCase())
  if (ranks.length === 1) parts.push(`ac.rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
  else if (ranks.length > 1) {
    parts.push(`ac.rank_tier IN (${ranks.map(r => `'${r.replace(/'/g, "''")}'`).join(',')})`)
  }
  if (version) {
    parts.push(`ac.game_version LIKE '${normalizePatchMajorMinor(version).replace(/'/g, "''")}%'`)
  }
  if (role) {
    parts.push(`ac.role = '${role.toUpperCase().replace(/'/g, "''")}'`)
  }
  return parts.join(' AND ')
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
  const where = buildWhere(championId, version, options.rankTier, role)
  const cols = await getTableColumns(ARCHIVE_PART_TABLE)
  const baronInvolvedGameExpr = pickColumn(cols, ['count_baron_involved_game'])
  const baronInvolvedWinExpr = pickColumn(cols, ['count_baron_involved_win'])
  const baronKillGameExpr = pickColumn(cols, ['count_baron_kill_game'])
  const baronAssistGameExpr = pickColumn(cols, ['count_baron_assist_game'])
  const dragonInvolvedGameExpr = pickColumn(cols, ['count_dragon_involved_game'])
  const dragonInvolvedWinExpr = pickColumn(cols, ['count_dragon_involved_win'])
  const dragonKillGameExpr = pickColumn(cols, ['count_dragon_kill_game'])
  const dragonAssistGameExpr = pickColumn(cols, ['count_dragon_assist_game'])
  const heraldInvolvedGameExpr = pickColumn(cols, ['count_rift_herald_involved_game'])
  const heraldInvolvedWinExpr = pickColumn(cols, ['count_rift_herald_involved_win'])
  const heraldKillGameExpr = pickColumn(cols, ['count_rift_herald_kill_game'])
  const heraldAssistGameExpr = pickColumn(cols, ['count_rift_herald_assist_game'])
  const hordeInvolvedGameExpr = pickColumn(cols, ['count_horde_involved_game'])
  const hordeInvolvedWinExpr = pickColumn(cols, ['count_horde_involved_win'])
  const hordeKillGameExpr = pickColumn(cols, ['count_horde_kill_game'])
  const hordeAssistGameExpr = pickColumn(cols, ['count_horde_assist_game'])
  const elderInvolvedGameExpr = pickColumn(cols, ['count_elder_involved_game'])
  const elderInvolvedWinExpr = pickColumn(cols, ['count_elder_involved_win'])
  const elderKillGameExpr = pickColumn(cols, ['count_elder_kill_game'])
  const elderAssistGameExpr = pickColumn(cols, ['count_elder_assist_game'])
  const towerInvolvedGameExpr = pickColumn(cols, ['count_tower_involved_game'])
  const towerInvolvedWinExpr = pickColumn(cols, ['count_tower_involved_win'])
  const towerKillGameExpr = pickColumn(cols, ['count_tower_kill_game'])
  const towerAssistGameExpr = pickColumn(cols, ['count_tower_assist_game'])
  const inhibitorInvolvedGameExpr = pickColumn(cols, ['count_inhibitor_involved_game'])
  const inhibitorInvolvedWinExpr = pickColumn(cols, ['count_inhibitor_involved_win'])
  const inhibitorKillGameExpr = pickColumn(cols, ['count_inhibitor_kill_game'])
  const inhibitorAssistGameExpr = pickColumn(cols, ['count_inhibitor_assist_game'])
  const earthDrakeTotalExpr = `(${pickColumn(cols, ['count_earth_drake_kill'])} + ${pickColumn(cols, ['count_earth_drake_assist'])})`
  const waterDrakeTotalExpr = `(${pickColumn(cols, ['count_water_drake_kill'])} + ${pickColumn(cols, ['count_water_drake_assist'])})`
  const windDrakeTotalExpr = `(${pickColumn(cols, ['count_wind_drake_kill'])} + ${pickColumn(cols, ['count_wind_drake_assist'])})`
  const fireDrakeTotalExpr = `(${pickColumn(cols, ['count_fire_drake_kill'])} + ${pickColumn(cols, ['count_fire_drake_assist'])})`
  const hextecDrakeTotalExpr = `(${pickColumn(cols, ['count_hextec_drake_kill'])} + ${pickColumn(cols, ['count_hextec_drake_assist'])})`
  const chemDrakeTotalExpr = `(${pickColumn(cols, ['count_chem_drake_kill'])} + ${pickColumn(cols, ['count_chem_drake_assist'])})`
  const earthSoulTotalExpr = pickColumn(cols, ['count_earth_soul'])
  const waterSoulTotalExpr = pickColumn(cols, ['count_water_soul'])
  const windSoulTotalExpr = pickColumn(cols, ['count_wind_soul'])
  const fireSoulTotalExpr = pickColumn(cols, ['count_fire_soul'])
  const hextecSoulTotalExpr = pickColumn(cols, ['count_hextec_soul'])
  const chemSoulTotalExpr = pickColumn(cols, ['count_chem_soul'])
  const rows = await prisma.$queryRawUnsafe<RawObjectiveAgg[]>(`
    SELECT
      COALESCE(SUM(ac.count_game), 0)::bigint AS games,
      COALESCE(SUM(ac.count_win), 0)::bigint AS wins,
      COALESCE(SUM(${baronInvolvedGameExpr}), 0)::bigint AS baron_involved_game,
      COALESCE(SUM(${baronInvolvedWinExpr}), 0)::bigint AS baron_involved_win,
      COALESCE(SUM(${baronKillGameExpr}), 0)::bigint AS baron_kill_game,
      COALESCE(SUM(${baronAssistGameExpr}), 0)::bigint AS baron_assist_game,
      COALESCE(SUM(${dragonInvolvedGameExpr}), 0)::bigint AS dragon_involved_game,
      COALESCE(SUM(${dragonInvolvedWinExpr}), 0)::bigint AS dragon_involved_win,
      COALESCE(SUM(${dragonKillGameExpr}), 0)::bigint AS dragon_kill_game,
      COALESCE(SUM(${dragonAssistGameExpr}), 0)::bigint AS dragon_assist_game,
      COALESCE(SUM(${heraldInvolvedGameExpr}), 0)::bigint AS rift_herald_involved_game,
      COALESCE(SUM(${heraldInvolvedWinExpr}), 0)::bigint AS rift_herald_involved_win,
      COALESCE(SUM(${heraldKillGameExpr}), 0)::bigint AS rift_herald_kill_game,
      COALESCE(SUM(${heraldAssistGameExpr}), 0)::bigint AS rift_herald_assist_game,
      COALESCE(SUM(${hordeInvolvedGameExpr}), 0)::bigint AS horde_involved_game,
      COALESCE(SUM(${hordeInvolvedWinExpr}), 0)::bigint AS horde_involved_win,
      COALESCE(SUM(${hordeKillGameExpr}), 0)::bigint AS horde_kill_game,
      COALESCE(SUM(${hordeAssistGameExpr}), 0)::bigint AS horde_assist_game,
      COALESCE(SUM(${elderInvolvedGameExpr}), 0)::bigint AS elder_involved_game,
      COALESCE(SUM(${elderInvolvedWinExpr}), 0)::bigint AS elder_involved_win,
      COALESCE(SUM(${elderKillGameExpr}), 0)::bigint AS elder_kill_game,
      COALESCE(SUM(${elderAssistGameExpr}), 0)::bigint AS elder_assist_game,
      COALESCE(SUM(${towerInvolvedGameExpr}), 0)::bigint AS tower_involved_game,
      COALESCE(SUM(${towerInvolvedWinExpr}), 0)::bigint AS tower_involved_win,
      COALESCE(SUM(${towerKillGameExpr}), 0)::bigint AS tower_kill_game,
      COALESCE(SUM(${towerAssistGameExpr}), 0)::bigint AS tower_assist_game,
      COALESCE(SUM(${inhibitorInvolvedGameExpr}), 0)::bigint AS inhibitor_involved_game,
      COALESCE(SUM(${inhibitorInvolvedWinExpr}), 0)::bigint AS inhibitor_involved_win,
      COALESCE(SUM(${inhibitorKillGameExpr}), 0)::bigint AS inhibitor_kill_game,
      COALESCE(SUM(${inhibitorAssistGameExpr}), 0)::bigint AS inhibitor_assist_game,
      COALESCE(SUM(${earthDrakeTotalExpr}), 0)::bigint AS earth_drake_total,
      COALESCE(SUM(${waterDrakeTotalExpr}), 0)::bigint AS water_drake_total,
      COALESCE(SUM(${windDrakeTotalExpr}), 0)::bigint AS wind_drake_total,
      COALESCE(SUM(${fireDrakeTotalExpr}), 0)::bigint AS fire_drake_total,
      COALESCE(SUM(${hextecDrakeTotalExpr}), 0)::bigint AS hextec_drake_total,
      COALESCE(SUM(${chemDrakeTotalExpr}), 0)::bigint AS chem_drake_total,
      COALESCE(SUM(${earthSoulTotalExpr}), 0)::bigint AS earth_soul_total,
      COALESCE(SUM(${waterSoulTotalExpr}), 0)::bigint AS water_soul_total,
      COALESCE(SUM(${windSoulTotalExpr}), 0)::bigint AS wind_soul_total,
      COALESCE(SUM(${fireSoulTotalExpr}), 0)::bigint AS fire_soul_total,
      COALESCE(SUM(${hextecSoulTotalExpr}), 0)::bigint AS hextec_soul_total,
      COALESCE(SUM(${chemSoulTotalExpr}), 0)::bigint AS chem_soul_total
    FROM ${ARCHIVE_PART_TABLE} ap
    INNER JOIN ${ARCHIVE_CORE_TABLE} ac ON ac.id = ap.champion_stat_id
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
      rows: [],
      outcomeRows: [],
    }
  }
  const toPct = (num: number, den: number): number => (den > 0 ? Number(((100 * num) / den).toFixed(2)) : 0)
  const rowsOut = [
    {
      key: 'baron',
      label: 'Baron',
      involvedGame: Number(row?.baron_involved_game ?? 0),
      involvedWin: Number(row?.baron_involved_win ?? 0),
      killGame: Number(row?.baron_kill_game ?? 0),
      assistGame: Number(row?.baron_assist_game ?? 0),
    },
    {
      key: 'dragon',
      label: 'Dragon',
      involvedGame: Number(row?.dragon_involved_game ?? 0),
      involvedWin: Number(row?.dragon_involved_win ?? 0),
      killGame: Number(row?.dragon_kill_game ?? 0),
      assistGame: Number(row?.dragon_assist_game ?? 0),
    },
    {
      key: 'riftHerald',
      label: 'Rift Herald',
      involvedGame: Number(row?.rift_herald_involved_game ?? 0),
      involvedWin: Number(row?.rift_herald_involved_win ?? 0),
      killGame: Number(row?.rift_herald_kill_game ?? 0),
      assistGame: Number(row?.rift_herald_assist_game ?? 0),
    },
    {
      key: 'horde',
      label: 'Void Grub',
      involvedGame: Number(row?.horde_involved_game ?? 0),
      involvedWin: Number(row?.horde_involved_win ?? 0),
      killGame: Number(row?.horde_kill_game ?? 0),
      assistGame: Number(row?.horde_assist_game ?? 0),
    },
    {
      key: 'elder',
      label: 'Elder Dragon',
      involvedGame: Number(row?.elder_involved_game ?? 0),
      involvedWin: Number(row?.elder_involved_win ?? 0),
      killGame: Number(row?.elder_kill_game ?? 0),
      assistGame: Number(row?.elder_assist_game ?? 0),
    },
    {
      key: 'tower',
      label: 'Tower',
      involvedGame: Number(row?.tower_involved_game ?? 0),
      involvedWin: Number(row?.tower_involved_win ?? 0),
      killGame: Number(row?.tower_kill_game ?? 0),
      assistGame: Number(row?.tower_assist_game ?? 0),
    },
    {
      key: 'inhibitor',
      label: 'Inhibitor',
      involvedGame: Number(row?.inhibitor_involved_game ?? 0),
      involvedWin: Number(row?.inhibitor_involved_win ?? 0),
      killGame: Number(row?.inhibitor_kill_game ?? 0),
      assistGame: Number(row?.inhibitor_assist_game ?? 0),
    },
  ].map((r) => ({
    key: r.key,
    label: r.label,
    objectiveWinrate: toPct(r.involvedWin, r.involvedGame),
    killRate: toPct(r.killGame, games),
    assistRate: toPct(r.assistGame, games),
  }))
  const outcomeRows = [
    ...rowsOut.map((r) => {
      const source = [
        {
          key: 'baron',
          involvedGame: Number(row?.baron_involved_game ?? 0),
          involvedWin: Number(row?.baron_involved_win ?? 0),
        },
        {
          key: 'dragon',
          involvedGame: Number(row?.dragon_involved_game ?? 0),
          involvedWin: Number(row?.dragon_involved_win ?? 0),
        },
        {
          key: 'riftHerald',
          involvedGame: Number(row?.rift_herald_involved_game ?? 0),
          involvedWin: Number(row?.rift_herald_involved_win ?? 0),
        },
        {
          key: 'horde',
          involvedGame: Number(row?.horde_involved_game ?? 0),
          involvedWin: Number(row?.horde_involved_win ?? 0),
        },
        {
          key: 'elder',
          involvedGame: Number(row?.elder_involved_game ?? 0),
          involvedWin: Number(row?.elder_involved_win ?? 0),
        },
        {
          key: 'tower',
          involvedGame: Number(row?.tower_involved_game ?? 0),
          involvedWin: Number(row?.tower_involved_win ?? 0),
        },
        {
          key: 'inhibitor',
          involvedGame: Number(row?.inhibitor_involved_game ?? 0),
          involvedWin: Number(row?.inhibitor_involved_win ?? 0),
        },
      ].find((s) => s.key === r.key) ?? { involvedGame: 0, involvedWin: 0 }
      const yieldGames = Math.max(0, games - source.involvedGame)
      const yieldWins = Math.max(0, wins - source.involvedWin)
      return {
        key: r.key,
        label: r.label,
        securePct: toPct(source.involvedGame, games),
        secureWinPct: toPct(source.involvedWin, source.involvedGame),
        yieldPct: toPct(yieldGames, games),
        yieldWinPct: toPct(yieldWins, yieldGames),
      }
    }),
  ]
  try {
    const sideRows = await prisma.$queryRawUnsafe<Array<{ team_num: number; games: bigint; wins: bigint }>>(
      `
        SELECT
          team_num,
          COALESCE(SUM(count_game), 0)::bigint AS games,
          COALESCE(SUM(count_win), 0)::bigint AS wins
        FROM ${ARCHIVE_SIDE_TABLE}
        WHERE champion_id = ${championId}
          AND (${version ? `game_version LIKE '${normalizePatchMajorMinor(version).replace(/'/g, "''")}%'` : '1=1'})
          AND (${role ? `role_norm = '${role.toUpperCase().replace(/'/g, "''")}'` : '1=1'})
          AND (${toQueryStringArrayParam(options.rankTier).length > 0
            ? `rank_tier IN (${toQueryStringArrayParam(options.rankTier).map(r => `'${r.toUpperCase().replace(/'/g, "''")}'`).join(',')})`
            : '1=1'})
        GROUP BY team_num
      `
    )
    const blue = sideRows.find((r) => Number(r.team_num) === 100)
    const red = sideRows.find((r) => Number(r.team_num) === 200)
    const sideOutcomeRows: Array<{
      key: string
      label: string
      securePct: number
      secureWinPct: number
      yieldPct: number
      yieldWinPct: number
    }> = []
    if (blue) {
      sideOutcomeRows.push({
        key: 'blueSide',
        label: 'Blue Side',
        securePct: toPct(Number(blue.games ?? 0), games),
        secureWinPct: toPct(Number(blue.wins ?? 0), Number(blue.games ?? 0)),
        yieldPct: Number.NaN,
        yieldWinPct: Number.NaN,
      })
    }
    if (red) {
      sideOutcomeRows.push({
        key: 'redSide',
        label: 'Red Side',
        securePct: toPct(Number(red.games ?? 0), games),
        secureWinPct: toPct(Number(red.wins ?? 0), Number(red.games ?? 0)),
        yieldPct: Number.NaN,
        yieldWinPct: Number.NaN,
      })
    }
    if (sideOutcomeRows.length > 0) outcomeRows.unshift(...sideOutcomeRows)
  } catch {
    // keep objectives response available even if side table is absent
  }
  const drakeTypeDistributionBase = [
    { key: 'earth', label: 'Earth', total: Number(row?.earth_drake_total ?? 0) },
    { key: 'water', label: 'Water', total: Number(row?.water_drake_total ?? 0) },
    { key: 'wind', label: 'Wind', total: Number(row?.wind_drake_total ?? 0) },
    { key: 'fire', label: 'Fire', total: Number(row?.fire_drake_total ?? 0) },
    { key: 'hextec', label: 'Hextec', total: Number(row?.hextec_drake_total ?? 0) },
    { key: 'chem', label: 'Chem', total: Number(row?.chem_drake_total ?? 0) },
  ]
  const drakeTotal = drakeTypeDistributionBase.reduce((sum, e) => sum + e.total, 0)
  const drakeTypeDistribution = drakeTypeDistributionBase
    .filter((e) => e.total > 0)
    .map((e) => ({ ...e, pct: drakeTotal > 0 ? Number(((100 * e.total) / drakeTotal).toFixed(2)) : 0 }))

  const soulDistributionBase = [
    { key: 'earth', label: 'Earth', total: Number(row?.earth_soul_total ?? 0) },
    { key: 'water', label: 'Water', total: Number(row?.water_soul_total ?? 0) },
    { key: 'wind', label: 'Wind', total: Number(row?.wind_soul_total ?? 0) },
    { key: 'fire', label: 'Fire', total: Number(row?.fire_soul_total ?? 0) },
    { key: 'hextec', label: 'Hextec', total: Number(row?.hextec_soul_total ?? 0) },
    { key: 'chem', label: 'Chem', total: Number(row?.chem_soul_total ?? 0) },
  ]
  const soulTotal = soulDistributionBase.reduce((sum, e) => sum + e.total, 0)
  const soulDistribution = soulDistributionBase
    .filter((e) => e.total > 0)
    .map((e) => ({ ...e, pct: soulTotal > 0 ? Number(((100 * e.total) / soulTotal).toFixed(2)) : 0 }))

  const bucketCols = await getTableColumns(ARCHIVE_BUCKET_TABLE)
  const bucketTotalGoldExpr = pickColumnWithAlias(bucketCols, 'cb', ['sum_total_gold'])
  const bucketMinionsExpr = pickColumnWithAlias(bucketCols, 'cb', ['sum_minions_killed'])
  const bucketDeathsExpr = pickColumnWithAlias(bucketCols, 'cb', ['sum_deaths'])
  const bucketKillsAssistsExpr = pickColumnWithAlias(bucketCols, 'cb', ['sum_kills_assists'])
  const bucketTimePlayedExpr = pickColumnWithAlias(bucketCols, 'cb', ['sum_time_played'])
  const bucketKd10PosGamesExpr = pickColumnWithAlias(bucketCols, 'cb', ['count_kd_diff_10_positive_game'])
  const bucketKd10PosWinsExpr = pickColumnWithAlias(bucketCols, 'cb', ['count_kd_diff_10_positive_win'])
  const bucketKd20PosGamesExpr = pickColumnWithAlias(bucketCols, 'cb', ['count_kd_diff_20_positive_game'])
  const bucketKd20PosWinsExpr = pickColumnWithAlias(bucketCols, 'cb', ['count_kd_diff_20_positive_win'])
  const durationAgg = await prisma.$queryRawUnsafe<RawDurationAgg[]>(`
    SELECT
      cb.duration_bucket,
      COALESCE(SUM(cb.count_game), 0)::bigint AS games,
      COALESCE(SUM(cb.count_win), 0)::bigint AS wins,
      COALESCE(SUM(${bucketTotalGoldExpr}), 0)::bigint AS sum_total_gold,
      COALESCE(SUM(${bucketMinionsExpr}), 0)::bigint AS sum_minions_killed,
      COALESCE(SUM(${bucketDeathsExpr}), 0)::bigint AS sum_deaths,
      COALESCE(SUM(${bucketKillsAssistsExpr}), 0)::bigint AS sum_kills_assists,
      COALESCE(SUM(${bucketTimePlayedExpr}), 0)::bigint AS sum_time_played,
      COALESCE(SUM(${bucketKd10PosGamesExpr}), 0)::bigint AS kd10_pos_games,
      COALESCE(SUM(${bucketKd10PosWinsExpr}), 0)::bigint AS kd10_pos_wins,
      COALESCE(SUM(${bucketKd20PosGamesExpr}), 0)::bigint AS kd20_pos_games,
      COALESCE(SUM(${bucketKd20PosWinsExpr}), 0)::bigint AS kd20_pos_wins
    FROM ${ARCHIVE_BUCKET_TABLE} cb
    INNER JOIN ${ARCHIVE_CORE_TABLE} ac ON ac.id = cb.champion_stat_id
    WHERE ${where}
    GROUP BY cb.duration_bucket
    ORDER BY cb.duration_bucket ASC
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
        durationMin: Number(r.duration_bucket ?? 0),
        games: rowGames,
        winrate: wr(rowWins, rowGames),
        goldPerMinute: perMinute(Number(r.sum_total_gold ?? 0), rowTime),
        creepsPerMinute: perMinute(Number(r.sum_minions_killed ?? 0), rowTime),
        deathsPerMinute: perMinute(Number(r.sum_deaths ?? 0), rowTime),
        killsAssistsPerMinute: perMinute(Number(r.sum_kills_assists ?? 0), rowTime),
        winrateWhenPositiveKillDeathDiff10: wr(Number(r.kd10_pos_wins ?? 0), Number(r.kd10_pos_games ?? 0)),
        winrateWhenPositiveKillDeathDiff20: wr(Number(r.kd20_pos_wins ?? 0), Number(r.kd20_pos_games ?? 0)),
      }
    })
    .filter((r) => r.games > 0)

  return {
    championId,
    games,
    wins,
    winrate: Number(((100 * wins) / games).toFixed(2)),
    durationRows,
    drakeTypeDistribution,
    soulDistribution,
    rows: rowsOut,
    outcomeRows,
  }
}
