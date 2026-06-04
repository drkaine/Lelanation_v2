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
  rows: Array<{
    key: string
    label: string
    objectiveWinrate: number
    killRate: number
    assistRate: number
    soloRate: number
  }>
  /** Vol d'objectif, solo baron, etc. (challenges Riot agrégés). */
  participationCard: {
    stealPct: number
    stealWithoutSmitePct: number
    soloBaronPct: number
    soloEpicObjectivePct: number
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
        ${involvedGamesExpr('cs.count_baron_kill', 'cs.count_baron_assist')}::bigint AS baron_involved_game,
        COALESCE(SUM(cs.count_baron_involved_win), 0)::bigint AS baron_involved_win,
        ${touchGamesExpr('cs.count_baron_kill')}::bigint AS baron_kill_game,
        ${touchGamesExpr('cs.count_baron_assist')}::bigint AS baron_assist_game,
        ${soloTouchGamesExpr('cs.count_baron_kill', 'cs.count_baron_assist')}::bigint AS baron_solo_game,
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
        COALESCE(SUM(cs.count_elder_involved_win), 0)::bigint AS elder_involved_win,
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
          (cs.count_baron_kill > 0 AND cs.count_baron_assist = 0)
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
        COALESCE(SUM(cs.count_chem_soul), 0)::bigint AS chem_soul_total
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
        rows: [],
        outcomeRows: [],
        participationCard: {
          stealPct: 0,
          stealWithoutSmitePct: 0,
          soloBaronPct: 0,
          soloEpicObjectivePct: 0,
        },
      }
    }

    const toPct = (num: number, den: number): number =>
      den > 0 ? Number(((100 * num) / den).toFixed(2)) : 0

    const objectiveBaseRows = [
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
        key: 'elder',
        label: 'Elder Dragon',
        involvedGame: Number(row?.elder_involved_game ?? 0),
        involvedWin: Number(row?.elder_involved_win ?? 0),
        killGame: Number(row?.elder_kill_game ?? 0),
        assistGame: Number(row?.elder_assist_game ?? 0),
        soloGame: Number(row?.elder_solo_game ?? 0),
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

    const rowsOut = objectiveBaseRows.map((r) => ({
      key: r.key,
      label: r.label,
      objectiveWinrate: toPct(r.involvedWin, r.involvedGame),
      killRate: toPct(r.killGame, games),
      assistRate: toPct(r.assistGame, games),
      soloRate: toPct(r.soloGame, games),
    }))

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
      const sideRows = await queryRawUnsafe<Array<{ team_num: number; games: bigint; wins: bigint }>>(
        `
          SELECT
            cs.team_num,
            COALESCE(SUM(cs.count_game), 0)::bigint AS games,
            COALESCE(SUM(cs.count_win), 0)::bigint AS wins
          FROM ${sideFrom}
          WHERE ${sideWhere}
          GROUP BY cs.team_num
        `
      )
      const blue = sideRows.find((r) => Number(r.team_num) === 100)
      const red = sideRows.find((r) => Number(r.team_num) === 200)
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

    const epicSteals = Number(row?.sum_epic_monster_steals ?? 0)
    const objectivesStolen = Number(row?.sum_objectives_stolen ?? 0)
    const stealEvents = epicSteals > 0 ? epicSteals : objectivesStolen
    const anyEpicSolo = Number(row?.any_epic_solo_game ?? 0)
    const baronSoloGames = Number(row?.baron_solo_game ?? 0)
    const participationCard = {
      stealPct: pctGamesWithEvents(stealEvents, games),
      stealWithoutSmitePct: pctGamesWithEvents(
        Number(row?.sum_epic_monster_stolen_without_smite ?? 0),
        games
      ),
      soloBaronPct: toPct(baronSoloGames, games),
      soloEpicObjectivePct: toPct(anyEpicSolo, games),
    }

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
      participationCard,
    }
  } catch (err) {
    console.warn('[getChampionObjectivesSummary]', err)
    return null
  }
}
