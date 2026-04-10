/**
 * API statistiques LoL (agrégats uniquement, pas de données brutes).
 * Champions, builds, runes, meilleurs joueurs.
 */
import { Router, Request, Response } from 'express'
import { RiotStatsAggregator } from '../services/RiotStatsAggregator.js'
import { getBuildsByChampion } from '../services/StatsBuildsService.js'
import { getRunesByChampion, getRuneStatsByChampion } from '../services/StatsRunesService.js'
import { getMatchupsByChampion } from '../services/StatsMatchupsService.js'
import {
  getTierListByLane,
  getMatchupDetailsByChampion,
  patchFromGameVersion,
} from '../services/MatchupTierService.js'
import { getTierList } from '../services/TierListService.js'
import { getChampionGlobalTable } from '../services/ChampionGlobalTableService.js'
import { getChampionBansTable } from '../services/ChampionBansTableService.js'
import {
  getTopPlayers,
  getTopPlayersByChampion,
  getPlayerBySummonerName,
  getChampionStatsForPlayer,
} from '../services/StatsPlayersService.js'
import {
  getOverviewStats,
  getOverviewMeta,
  getOverviewDetailStats,
  getOverviewTeamsStats,
  getOverviewSidesStats,
  getOverviewSidesProgressionFullStats,
  getOverviewDurationWinrateStats,
  getDurationWinrateByChampion,
  getDurationWinrateByChampionByTier,
  getOverviewProgressionStats,
  getOverviewProgressionFullStats,
  getInfosPatchDivisionMatrix,
  getInfosMetaCounts,
} from '../services/StatsOverviewService.js'
import { getOverviewAbandons } from '../services/StatsAbandonsService.js'
import {
  getSummonerSpellsByChampion,
  getSummonerSpellsDuosByChampion,
} from '../services/StatsSummonerSpellsService.js'
import { getChampionTierSnapshotsForCharts } from '../services/ChampionTierDailySnapshotService.js'
import { getBalanceFramework } from '../services/StatsBalanceService.js'
import { isDatabaseConfigured } from '../db.js'

const router = Router()
const aggregator = new RiotStatsAggregator()

/** Perf: log backend duration and set X-Backend-Time / X-Stats-Path / X-SQL-Time so the front can show everything in one place. */
router.use((req: Request, res: Response, next) => {
  const start = Date.now()
  const path = req.path || req.originalUrl?.split('?')[0] || ''
  ;(res as Response & { locals: { sqlMs?: number } }).locals = (res as Response & { locals: Record<string, unknown> }).locals || {}
  const originalJson = res.json.bind(res)
  res.json = function (body: unknown) {
    const ms = Date.now() - start
    res.set('X-Backend-Time', String(ms))
    res.set('X-Stats-Path', path)
    const sqlMs = (res as Response & { locals: { sqlMs?: number } }).locals?.sqlMs
    if (typeof sqlMs === 'number') {
      res.set('X-SQL-Time', String(sqlMs))
    }
    return originalJson(body)
  }
  next()
})

function queryString(value: unknown): string | null {
  if (value == null) return null
  let s: string | null = null
  if (Array.isArray(value)) s = typeof value[0] === 'string' ? value[0] : null
  else if (typeof value === 'string') s = value
  if (s == null || s === '' || s === '[]' || s.startsWith('[')) return null
  return s
}

/** Return array of strings from query param (single value or repeated). */
function queryStringArray(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === 'string' && x !== '' && !x.startsWith('['))
  }
  if (typeof value === 'string' && value !== '' && !value.startsWith('[')) return [value]
  return []
}

/** rankTier répété ou liste : ex. rankTier=GOLD&rankTier=PLATINUM → ['GOLD','PLATINUM']. */
function rankTierParam(value: unknown): string[] | null {
  const arr = queryStringArray(value)
  if (arr.length === 0) return null
  const tiers = arr
    .flatMap((s) => (s.includes(',') ? s.split(',').map((x) => x.trim()) : [s.trim()]))
    .map((s) => s.toUpperCase())
    .filter(Boolean)
  return tiers.length ? tiers : null
}

function resolvePatchFromQuery(patchValue: unknown, versionValue: unknown): string | null {
  const patchRaw = queryString(patchValue)
  if (patchRaw) return patchRaw
  const version = queryString(versionValue)
  if (!version) return null
  return patchFromGameVersion(version)
}

const STATS_CACHE_MAX_AGE = 60 // seconds — allow browser/CDN cache for stats GET
/** Keep below typical gateway timeout (often 60s) so we return 503 before gateway returns 504. */
const OVERVIEW_TIMEOUT_MS = 50_000
/**
 * Seuil pickrate en % (stats globales champion) :
 * - otp=non (sans OTP) : pickrate >= seuil (hors niche, ex. ≥ 1 % par défaut).
 * - otp=oui (avec OTP) : pas de filtre pickrate (tous les champions).
 * - otp=solo (que les OTP / niche) : uniquement pickrate < seuil (champions niche).
 */
const STATS_OTP_PICKRATE_THRESHOLD = Number(process.env.STATS_OTP_PICKRATE_THRESHOLD ?? '1')
const STATS_TREND_WR_DELTA_PCT = Number(process.env.STATS_TREND_WR_DELTA_PCT ?? '5')
const STATS_TREND_PICK_DELTA_PCT = Number(process.env.STATS_TREND_PICK_DELTA_PCT ?? '10')
const STATS_TREND_GAMES_DELTA_PCT = Number(process.env.STATS_TREND_GAMES_DELTA_PCT ?? '15')
const STATS_TREND_BAN_DELTA_PCT = Number(process.env.STATS_TREND_BAN_DELTA_PCT ?? '10')

function withTimeout<T>(p: Promise<T>, ms: number): Promise<{ ok: true; data: T } | { ok: false; timeout: true }> {
  return Promise.race([
    p.then((data) => ({ ok: true as const, data })),
    new Promise<{ ok: false; timeout: true }>((resolve) =>
      setTimeout(() => resolve({ ok: false, timeout: true }), ms)
    ),
  ])
}

type OtpMode = 'oui' | 'non' | 'solo'

function otpModeFromQuery(value: unknown): OtpMode {
  const raw = (queryString(value) ?? '').trim().toLowerCase()
  if (raw === 'oui' || raw === 'yes' || raw === 'true' || raw === '1' || raw === 'all') return 'oui'
  if (raw === 'solo' || raw === 'niche') return 'solo'
  return 'non'
}

/** Parse pickrate depuis JSON (nombre ou chaîne avec virgule). */
function parsePickrateNumber(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const s = raw.replace(',', '.').trim()
    if (s === '') return 0
    const n = parseFloat(s)
    return Number.isFinite(n) ? n : 0
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function keepByOtpPickratePercent(pickratePercent: number, mode: OtpMode): boolean {
  if (mode === 'oui') return true
  if (mode === 'solo') return pickratePercent < STATS_OTP_PICKRATE_THRESHOLD
  return pickratePercent >= STATS_OTP_PICKRATE_THRESHOLD
}

function keepByOtpPickrateRatio(pickrateRatio: number, mode: OtpMode): boolean {
  return keepByOtpPickratePercent(pickrateRatio * 100, mode)
}

/** Tier list : pickrate API = ratio 0–1. */
function filterTierListRowsByOtp<T extends { pickrate: number }>(rows: T[], mode: OtpMode): T[] {
  if (mode === 'oui' || rows.length === 0) return rows
  const filtered = rows.filter((row) => keepByOtpPickrateRatio(row.pickrate, mode))
  return filtered.length > 0 ? filtered : rows
}

/** Champions / overview : pickrate = % 0–100 (agrégateur). Si tout serait filtré, on renvoie la liste d’origine. */
function filterChampionRowsByOtp<T extends { pickrate?: number }>(rows: T[], mode: OtpMode): T[] {
  if (mode === 'oui' || rows.length === 0) return rows
  const filtered = rows.filter((row) =>
    keepByOtpPickratePercent(parsePickrateNumber(row.pickrate), mode)
  )
  return filtered.length > 0 ? filtered : rows
}

/** Balance : pickrate pilotée par la plus haute exposition parmi average/skilled/elite (en %). */
function filterBalanceRowsByOtp<
  T extends {
    average?: { pickrate?: number }
    skilled?: { pickrate?: number }
    elite?: { pickrate?: number }
  },
>(rows: T[], mode: OtpMode, hasRoleFilter: boolean): T[] {
  if (mode === 'oui' || rows.length === 0) return rows
  const filtered = rows.filter((row) => {
    const a = parsePickrateNumber(row.average?.pickrate)
    const s = parsePickrateNumber(row.skilled?.pickrate)
    const e = parsePickrateNumber(row.elite?.pickrate)
    // When role filter is not set, pickrate is diluted by all 5 roles.
    // Re-scale for OTP filtering to keep behavior consistent with role-scoped view.
    const basePick = Math.max(a, s, e)
    const p = hasRoleFilter ? basePick : Math.min(100, basePick * 5)
    return keepByOtpPickratePercent(p, mode)
  })
  return filtered.length > 0 ? filtered : rows
}

/** Champion global table: pickrate pilotée par le max entre côté bleu et rouge (en %). */
function filterChampionGlobalRowsByOtp<
  T extends {
    blue?: { pickrate?: number }
    red?: { pickrate?: number }
  },
>(rows: T[], mode: OtpMode): T[] {
  if (mode === 'oui' || rows.length === 0) return rows
  const filtered = rows.filter((row) => {
    const pBlue = parsePickrateNumber(row.blue?.pickrate)
    const pRed = parsePickrateNumber(row.red?.pickrate)
    const p = Math.max(pBlue, pRed)
    return keepByOtpPickratePercent(p, mode)
  })
  return filtered.length > 0 ? filtered : rows
}

/** GET /api/stats/overview - total matches, last update, top winrate champions, matches per division, player count. Query: ?version=16.1 &rankTier=GOLD or &rankTier=GOLD&rankTier=PLATINUM */
router.get('/overview', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const sqlStart = Date.now()

  const runOverview = async () => {
    return getOverviewStats(version, rankTier, role)
  }

  const result = await withTimeout(runOverview(), OVERVIEW_TIMEOUT_MS)
  ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart

  if (result.ok === false && result.timeout) {
    console.warn('[GET /overview] timeout after', OVERVIEW_TIMEOUT_MS, 'ms (version=%s rankTier=%s)', version, rankTier)
    res.set('Retry-After', '60')
    return res.status(503).json({
      error: 'Stats overview calculation timeout',
      message: 'Les statistiques prennent trop de temps. Essayez sans filtre version/division, ou réessayez plus tard.',
    })
  }

  const raw = result.ok ? result.data : null
  if (!raw || typeof raw !== 'object') {
    const reason = !isDatabaseConfigured()
      ? 'DATABASE_URL not configured'
      : 'Query failed or no data'
    console.warn('[GET /overview] getOverviewStats returned null:', reason)
    return res.status(200).json({
      totalMatches: 0,
      lastUpdate: null,
      topWinrateChampions: [],
      topPickrateChampions: [],
      topBanrateChampions: [],
      matchesByDivision: [],
      matchesByVersion: [],
      playerCount: 0,
      message: 'No stats yet. Run match collection first.',
    })
  }
  const data = raw as unknown as {
    totalMatches: number
    lastUpdate?: string | null
    playerCount?: number
    topWinrateChampions?: Array<{ championId: number; pickrate: number }>
    topPickrateChampions?: Array<{ championId: number; pickrate: number }>
    topBanrateChampions?: Array<{ championId: number }>
    _championPool?: Array<{ championId: number; pickrate: number }>
    [key: string]: unknown
  }
  // Fill missing lastUpdate / playerCount when we have matches (e.g. precomputed data or stale cache)
  if (
    data.totalMatches > 0 &&
    (data.lastUpdate == null || data.lastUpdate === '' || data.playerCount === 0)
  ) {
    const meta = await getOverviewMeta(version ?? null, rankTier ?? null)
    if (meta) {
      data.lastUpdate = meta.lastUpdate ?? data.lastUpdate ?? null
      data.playerCount = meta.playerCount
    }
  }

  // Top pick / WR / ban : vrai top agrégé (pas de filtre OTP ici — voir tier list).
  return res.json(data)
})

/** GET /api/stats/overview-detail - runes, rune sets, items, item sets, items by order, summoner spells. Query: ?version=16.1 &rankTier=GOLD &includeSmite=1. Lit précalculé si version null. */
router.get('/overview-detail', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const includeSmite = req.query.includeSmite === '1' || req.query.includeSmite === 'true'
  const sqlStart = Date.now()
  const data = await getOverviewDetailStats(version, rankTier, includeSmite, role)
  ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart
  if (!data) {
    console.warn('[GET /overview-detail] no data (version=%s rankTier=%s)', version ?? 'null', rankTier ?? 'null')
    return res.status(200).json({
      totalParticipants: 0,
      runes: [],
      runeSets: [],
      items: [],
      itemsStarters: [],
      itemsCores: [],
      itemsFinals: [],
      itemsBoots: [],
      itemSets: [],
      itemStarterSets: [],
      itemsByOrder: {},
      summonerSpells: [],
      summonerSpellSets: [],
      shards: [],
    })
  }
  return res.json(data)
})

/** GET /api/stats/overview-duration-winrate - duration (5-min buckets) vs winrate. Query: ?version=16.1 &rankTier=GOLD. Lit précalculé si version null. */
router.get('/overview-duration-winrate', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const data = await getOverviewDurationWinrateStats(version, rankTier, role)
  if (!data) {
    return res.status(200).json({ buckets: [] })
  }
  return res.json(data)
})

/** GET /api/stats/overview-abandons - remake & surrender rates. Query: ?version=16.1 &rankTier=GOLD. Lit précalculé si version null. */
router.get('/overview-abandons', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const data = await getOverviewAbandons(version, rankTier)
  if (!data) {
    return res.status(200).json({
      totalMatches: 0,
      remakeCount: 0,
      remakeRate: 0,
      earlySurrenderCount: 0,
      earlySurrenderRate: 0,
      surrenderCount: 0,
      surrenderRate: 0,
    })
  }
  return res.json(data)
})

/** GET /api/stats/overview-progression - WR delta from oldest version to all since. Query: ?version=16.1 &rankTier=GOLD */
router.get('/overview-progression', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const data = await getOverviewProgressionStats(version, rankTier, role)
  if (!data) {
    return res.status(200).json({ oldestVersion: null, gainers: [], losers: [] })
  }
  return res.json(data)
})

/** GET /api/stats/overview-progression-full - All champions with WR and pickrate progression. Query: ?version=16.1 &rankTier=GOLD */
router.get('/overview-progression-full', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const data = await getOverviewProgressionFullStats(version, rankTier, role)
  if (!data) {
    return res.status(200).json({ oldestVersion: null, champions: [] })
  }
  return res.json(data)
})

/** GET /api/stats/overview-teams - bans and objectives (first + kills) by win/loss. Query: ?version=16.1 &rankTier=GOLD. Lit précalculé si version null. */
router.get('/overview-teams', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const data = await getOverviewTeamsStats(version, rankTier, role)
  if (!data) {
    return res.status(200).json({
      matchCount: 0,
      bans: { byWin: [], byLoss: [], top20Total: [] },
      objectives: {
        firstBlood: { firstByWin: 0, firstByLoss: 0 },
        baron: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        dragon: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        elder: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        tower: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        inhibitor: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        riftHerald: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        horde: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
      },
    })
  }
  return res.json(data)
})

/** GET /api/stats/overview-sides - winrate, champions, objectives, bans by side. Lit précalculé si version null et un seul rankTier. */
router.get('/overview-sides', async (req: Request, res: Response) => {
  const version = queryStringArray(req.query.version)
  const rankTier = queryStringArray(req.query.rankTier)
  const data = await getOverviewSidesStats(
    version.length ? version : null,
    rankTier.length ? rankTier : null
  )
  if (!data) {
    const emptyObjTable = {
      firstBlood: { firstByBlue: 0, firstByRed: 0 },
      baron: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      dragon: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      elder: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      tower: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      inhibitor: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      riftHerald: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      horde: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
    }
    return res.status(200).json({
      matchCount: 0,
      sideWinrate: { blue: { matches: 0, wins: 0, winrate: 0 }, red: { matches: 0, wins: 0, winrate: 0 } },
      championWinrateBySide: { blue: [], red: [] },
      championPickBySide: { blue: [], red: [] },
      drakesBySide: {
        types: {
          elder: { byBlue: 0, byRed: 0 },
          earth: { byBlue: 0, byRed: 0 },
          water: { byBlue: 0, byRed: 0 },
          wind: { byBlue: 0, byRed: 0 },
          fire: { byBlue: 0, byRed: 0 },
          hextec: { byBlue: 0, byRed: 0 },
          chem: { byBlue: 0, byRed: 0 },
        },
        souls: {
          earth: { byBlue: 0, byRed: 0 },
          water: { byBlue: 0, byRed: 0 },
          wind: { byBlue: 0, byRed: 0 },
          fire: { byBlue: 0, byRed: 0 },
          hextec: { byBlue: 0, byRed: 0 },
          chem: { byBlue: 0, byRed: 0 },
        },
      },
      objectivesBySide: {
        blue: {
          firstBlood: 0, baronFirst: 0, baronKills: 0, dragonFirst: 0, dragonKills: 0,
          elderFirst: 0, elderKills: 0,
          towerFirst: 0, towerKills: 0, inhibitorFirst: 0, inhibitorKills: 0,
          riftHeraldFirst: 0, riftHeraldKills: 0, hordeFirst: 0, hordeKills: 0,
        },
        red: {
          firstBlood: 0, baronFirst: 0, baronKills: 0, dragonFirst: 0, dragonKills: 0,
          elderFirst: 0, elderKills: 0,
          towerFirst: 0, towerKills: 0, inhibitorFirst: 0, inhibitorKills: 0,
          riftHeraldFirst: 0, riftHeraldKills: 0, hordeFirst: 0, hordeKills: 0,
        },
      },
      objectivesBySideTable: emptyObjTable,
      bansBySide: { blue: [], red: [] },
    })
  }
  return res.json(data)
})

/** GET /api/stats/overview-sides-progression — WR/pick/ban delta par côté (patch de référence vs patch courant ou tous les patches suivants). */
router.get('/overview-sides-progression', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const sinceVersion = queryString(req.query.sinceVersion)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const data = await getOverviewSidesProgressionFullStats(
    version,
    rankTier ?? null,
    role || null,
    sinceVersion || null
  )
  if (!data) {
    return res.status(200).json({ oldestVersion: null, blue: [], red: [] })
  }
  return res.json(data)
})

/** GET /api/stats/champions - lit précalculé si disponible (version implicite null), sinon calcul live. */
router.get('/champions', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = (req.query.role as string) || undefined
  const otpMode = otpModeFromQuery(req.query.otp)
  const sqlStart = Date.now()
  const data = await aggregator.load({ rankTier, role: role ?? null })
  ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart
  if (!data) {
    return res.status(200).json({
      totalGames: 0,
      totalMatches: 0,
      champions: [],
      generatedAt: null,
      message: 'No stats yet. Run match collection and aggregation first.'
    })
  }
  const champions = filterChampionRowsByOtp(data.champions ?? [], otpMode)
  return res.json({
    totalGames: data.totalGames,
    totalMatches: data.totalMatches,
    champions,
    generatedAt: data.generatedAt
  })
})

/** GET /api/stats/champions/global-table — tableau par champion : WR/pick/ban bleu & rouge, dégâts moyens, KDA. Query: ?version=…&rankTier=… (comme overview-sides). */
router.get('/champions/global-table', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryStringArray(req.query.version)
  const rankTier = queryStringArray(req.query.rankTier)
  const role = queryString(req.query.role)
  const otpMode = otpModeFromQuery(req.query.otp)
  const sqlStart = Date.now()
  try {
    const data = await getChampionGlobalTable(
      version.length ? version : null,
      rankTier.length ? rankTier : null,
      role
    )
    ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart
    if (!data) {
      return res.status(200).json({ matchCount: 0, rows: [], message: 'Database not configured.' })
    }
    const rows = filterChampionGlobalRowsByOtp(data.rows ?? [], otpMode)
    return res.json({
      ...data,
      rows,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[champions/global-table]', message, err)
    return res.status(200).json({
      matchCount: 0,
      rows: [],
      error: 'Champion global table failed',
      message,
    })
  }
})

/** GET /api/stats/champions/bans-table — bans par champion (total, bleu/rouge, par rôle du banneur). Query: ?version=…&rankTier=…&role=TOP */
router.get('/champions/bans-table', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryStringArray(req.query.version)
  const rankTier = queryStringArray(req.query.rankTier)
  const role = queryString(req.query.role)
  const otp = queryString(req.query.otp)
  const sqlStart = Date.now()
  try {
    const data = await getChampionBansTable(
      version.length ? version : null,
      rankTier.length ? rankTier : null,
      role,
      otp
    )
    ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart
    if (!data) {
      return res.status(200).json({ matchCount: 0, rows: [], message: 'Database not configured.' })
    }
    return res.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[champions/bans-table]', message, err)
    return res.status(200).json({
      matchCount: 0,
      rows: [],
      error: 'Champion bans table failed',
      message,
    })
  }
})

router.get('/champions/:championId', async (req: Request, res: Response) => {
  const championIdParam = req.params.championId
  if (Array.isArray(championIdParam)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const championId = parseInt(championIdParam, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const rankTier = rankTierParam(req.query.rankTier)
  const role = (req.query.role as string) || undefined
  const version = queryString(req.query.version)
  const loadBase = { rankTier, version: version ?? null }
  const data = await aggregator.load({ ...loadBase, role: role ?? null })
  if (!data) {
    return res.status(404).json({ error: 'No stats available' })
  }
  const row = data.champions.find((c: { championId: number }) => c.championId === championId)
  if (!row) {
    return res.status(404).json({ error: 'Champion not found in stats' })
  }
  let byRole = row.byRole
  /** Taux de ban : agrégat global (tous rôles), le dénominateur ne doit pas suivre le filtre rôle. */
  let banrate = row.banrate
  let presence = row.presence
  if (role) {
    const dataAllRoles = await aggregator.load({ ...loadBase, role: null })
    const rowAll = dataAllRoles?.champions.find(
      (c: { championId: number }) => c.championId === championId
    )
    if (rowAll) {
      if (rowAll.byRole && Object.keys(rowAll.byRole).length > 0) {
        byRole = rowAll.byRole
      }
      if (rowAll.banrate != null) banrate = rowAll.banrate
      if (rowAll.presence != null) presence = rowAll.presence
    }
  }
  return res.json({
    championId: row.championId,
    games: row.games,
    wins: row.wins,
    winrate: row.winrate,
    pickrate: row.pickrate,
    banrate,
    presence,
    byRole,
    totalGames: data.totalGames,
    generatedAt: data.generatedAt
  })
})

/** GET /api/stats/champions/:championId/duration-winrate - duration (5-min buckets) vs winrate for this champion. Query: ?version=16.1 &rankTier=GOLD */
router.get('/champions/:championId/duration-winrate', async (req: Request, res: Response) => {
  const championId = parseInt(String(req.params.championId), 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid championId' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const data = await getDurationWinrateByChampion(championId, version, rankTier)
  if (!data) {
    return res.status(200).json({ buckets: [] })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/duration-winrate-by-tier — courbes par ligue (même buckets 5 min). Query: ?version=…&role=…&rankTier=… */
router.get('/champions/:championId/duration-winrate-by-tier', async (req: Request, res: Response) => {
  const championId = parseInt(String(req.params.championId), 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid championId' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const data = await getDurationWinrateByChampionByTier(championId, version, rankTier, role)
  if (!data) {
    return res.status(200).json({ series: [] })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/builds */
router.get('/champions/:championId/builds', async (req: Request, res: Response) => {
  const raw = req.params.championId
  const championId = parseInt(Array.isArray(raw) ? raw[0] : raw, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const rankTier = rankTierParam(req.query.rankTier)
  const role = (req.query.role as string) || undefined
  const patch = (req.query.patch as string) || undefined
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 10
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 20
  const data = await getBuildsByChampion({
    championId,
    rankTier: rankTier ?? null,
    role: role ?? null,
    patch: patch ?? null,
    minGames,
    limit,
  })
  if (!data) {
    return res.status(200).json({ totalGames: 0, builds: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/runes */
router.get('/champions/:championId/runes', async (req: Request, res: Response) => {
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const rankTier = rankTierParam(req.query.rankTier)
  const patch = (req.query.patch as string) || undefined
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 10
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 20
  const data = await getRunesByChampion({
    championId,
    rankTier: rankTier ?? null,
    patch: patch ?? null,
    minGames,
    limit,
  })
  if (!data) {
    return res.status(200).json({ totalGames: 0, runes: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/runes-per-rune - per-rune pick/win for champion (like stats runes tab). Query: ?version=16.1 &rankTier=GOLD &minGames=10 */
router.get('/champions/:championId/runes-per-rune', async (req: Request, res: Response) => {
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 10
  const data = await getRuneStatsByChampion({
    championId,
    version: version ?? null,
    rankTier: rankTier ?? null,
    minGames,
  })
  if (!data) {
    return res.status(200).json({ totalGames: 0, runes: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/matchups - winrate vs each opponent. Query: ?version=16.1 &rankTier=GOLD &minGames=10 */
router.get('/champions/:championId/matchups', async (req: Request, res: Response) => {
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 10
  const data = await getMatchupsByChampion({
    championId,
    version: version ?? null,
    rankTier: rankTier ?? null,
    minGames,
  })
  if (!data) {
    return res.status(200).json({ matchups: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/matchups-tier - matchup score/tier rows for one champion.
 * Query: ?patch=16.4 or ?version=16.4.1&rankTier=GOLD&lane=TOP&minGames=10
 */
router.get('/champions/:championId/matchups-tier', async (req: Request, res: Response) => {
  const raw = req.params.championId
  const championId = parseInt(Array.isArray(raw) ? raw[0] : raw, 10)
  if (Number.isNaN(championId) || championId <= 0) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const patch = resolvePatchFromQuery(req.query.patch, req.query.version)
  if (!patch) {
    return res.status(400).json({ error: 'Missing patch/version for matchup-tier query' })
  }
  const rankTier = rankTierParam(req.query.rankTier)
  const lane = queryString(req.query.lane) ?? queryString(req.query.role)
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 10
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 100
  const data = await getMatchupDetailsByChampion({
    championId,
    patch,
    rankTier: rankTier ?? null,
    lane: lane ?? null,
    minGames,
    limit,
  })
  return res.json({ patch, championId, matchups: data })
})

/** GET /api/stats/matchup-tier-list - champion tier rows from matchup scores.
 * Query: ?patch=16.4 or ?version=16.4.1&rankTier=GOLD&lane=TOP&minGames=20
 */
router.get('/matchup-tier-list', async (req: Request, res: Response) => {
  const patch = resolvePatchFromQuery(req.query.patch, req.query.version)
  if (!patch) {
    return res.status(400).json({ error: 'Missing patch/version for matchup-tier-list query' })
  }
  const rankTier = rankTierParam(req.query.rankTier)
  const lane = queryString(req.query.lane) ?? queryString(req.query.role)
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 20
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 300
  const rows = await getTierListByLane({
    patch,
    rankTier: rankTier ?? null,
    lane: lane ?? null,
    minGames,
    limit,
  })
  return res.json({
    patch,
    rankTier: rankTier ?? null,
    lane: lane ?? null,
    rows,
  })
})

/** GET /api/stats/tier-list - Lolalytics-style tier list (one row per champion, all ranks + optional highElo). Query: ?patch=16.4 (optional; if omitted uses latest patch in DB)&platformId=EUW1&rankTier=all */
router.get('/tier-list', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const patch = resolvePatchFromQuery(req.query.patch, req.query.version) ?? undefined
  const platformId = queryString(req.query.platformId) ?? null
  const rankTierRaw = queryString(req.query.rankTier)
  const rankTier = rankTierRaw === 'all' || !rankTierRaw ? 'all' : rankTierRaw
  const roleFocus = queryString(req.query.role)?.trim() || null
  const otpMode = otpModeFromQuery(req.query.otp)
  try {
    const data = await getTierList({
      patch: patch || undefined,
      platformId,
      rankTier,
      role: roleFocus,
    })
    if (!data) {
      return res.status(200).json({
        patch: patch ?? null,
        rankTier,
        rows: [],
        message: 'Database not configured or no stats yet.',
      })
    }
    const rows = filterTierListRowsByOtp(data.rows, otpMode)
    const highEloRows = filterTierListRowsByOtp(data.highEloRows ?? [], otpMode)
    return res.json({
      patch: data.patch,
      rankTier: data.rankTier,
      rows,
      highEloRows: highEloRows.length > 0 ? highEloRows : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[tier-list]', message, err)
    // Return 200 with error in body so frontend can show it (avoids 500 and CORS issues)
    return res.status(200).json({
      patch: patch ?? null,
      rankTier,
      rows: [],
      error: 'Tier list failed',
      message: message,
    })
  }
})

/** GET /api/stats/champions/:championId/tier-trend-snapshots — séries quotidiennes (UTC) games/wins, pick% et ban% par tier+role (winrate = wins/games). Query: ?rankTier=DIAMOND&role=SUPPORT&from=… (role=UTILITY → SUPPORT) */
router.get('/champions/:championId/tier-trend-snapshots', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId) || championId <= 0) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  if (!isDatabaseConfigured()) {
    return res.status(200).json({ championId, points: [], message: 'Database not configured.' })
  }
  const rankTier = queryString(req.query.rankTier)
  const role = queryString(req.query.role)
  const fromDate = queryString(req.query.from)
  const toDate = queryString(req.query.to)
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 365
  const points = await getChampionTierSnapshotsForCharts({
    championId,
    rankTier: rankTier ?? null,
    role: role ?? null,
    fromDate: fromDate ?? null,
    toDate: toDate ?? null,
    limit: Number.isFinite(limit) ? Math.min(2000, Math.max(1, limit)) : 365,
  })
  return res.json({
    championId,
    rankTier: rankTier ?? null,
    role: role ?? null,
    fromDate: fromDate ?? null,
    toDate: toDate ?? null,
    points,
  })
})

/** GET /api/stats/champions/:championId/summoner-spells - per-spell stats for this champion. Query: ?version=16.1 &rankTier=GOLD */
router.get('/champions/:championId/summoner-spells', async (req: Request, res: Response) => {
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const data = await getSummonerSpellsByChampion(championId, version, rankTier)
  if (!data) {
    return res.status(200).json({ totalGames: 0, spells: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/summoner-spells-duos - spell pairs for this champion. Query: ?version=16.1 &rankTier=GOLD */
router.get('/champions/:championId/summoner-spells-duos', async (req: Request, res: Response) => {
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const data = await getSummonerSpellsDuosByChampion(championId, version, rankTier)
  if (!data) {
    return res.status(200).json({ totalGames: 0, duos: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/players/search?name=... - lookup player by summoner name */
router.get('/players/search', async (req: Request, res: Response) => {
  const name = (req.query.name as string)?.trim()
  if (!name) {
    return res.status(400).json({ error: 'Query "name" is required' })
  }
  const player = await getPlayerBySummonerName(name)
  if (!player) {
    return res.status(404).json({ error: 'Player not found' })
  }
  const championStats = await getChampionStatsForPlayer(player.puuid)
  return res.json({ player, championStats })
})

/** GET /api/stats/players - meilleurs joueurs (classement général). Par défaut Master → Challenger uniquement (stats globale). */
router.get('/players', async (req: Request, res: Response) => {
  const rankTier = rankTierParam(req.query.rankTier)
  const highRankOnly = req.query.highRankOnly !== '0' && req.query.highRankOnly !== 'false'
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 50
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 100
  const list = await getTopPlayers({
    rankTier,
    highRankOnly,
    minGames,
    limit,
  })
  return res.json({ players: list })
})

/** GET /api/stats/champions/:championId/players - meilleurs joueurs sur un champion */
router.get('/champions/:championId/players', async (req: Request, res: Response) => {
  const raw = req.params.championId
  const championId = parseInt(Array.isArray(raw) ? raw[0] : raw, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const rankTier = rankTierParam(req.query.rankTier)
  const highRankOnly = req.query.highRankOnly === '1' || req.query.highRankOnly === 'true'
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 20
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50
  const list = await getTopPlayersByChampion({
    championId,
    rankTier,
    highRankOnly,
    minGames,
    limit,
  })
  return res.json({
    players: list.map((p) => ({ ...p, totalGames: p.games })),
  })
})

/** New API: /api/stats/overview-cards */
router.get('/overview-cards', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const fromVersion = queryString(req.query.fromVersion) ?? version

  const [overview, teams] = await Promise.all([
    getOverviewStats(version, rankTier, role),
    getOverviewTeamsStats(version, rankTier, role),
  ])

  return res.json({
    topPickrateChampions: overview?.topPickrateChampions ?? [],
    topWinrateChampions: overview?.topWinrateChampions ?? [],
    topBanrateChampions: overview?.topBanrateChampions ?? [],
    winrateSince: {
      fromVersion,
      value:
        (overview?.topWinrateChampions?.[0]?.winrate as number | undefined) ??
        null,
    },
    objectives: teams?.objectives ?? null,
  })
})

/** New API: /api/stats/team-overview */
router.get('/team-overview', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const sides = await getOverviewSidesStats(version ? [version] : [], rankTier ?? null)
  return res.json(
    sides ?? {
      matchCount: 0,
      sideWinrate: {
        blue: { matches: 0, wins: 0, winrate: 0 },
        red: { matches: 0, wins: 0, winrate: 0 },
      },
      championWinrateBySide: { blue: [], red: [] },
      championPickBySide: { blue: [], red: [] },
      bansBySide: { blue: [], red: [] },
      objectivesBySide: { blue: {}, red: {} },
      objectivesBySideTable: { firstBlood: { firstByBlue: 0, firstByRed: 0 } },
    }
  )
})

/** New API: /api/stats/trends/deltas */
router.get('/trends/deltas', async (req: Request, res: Response) => {
  const championId = req.query.championId != null ? Number(req.query.championId) : null
  if (!championId || !Number.isFinite(championId)) {
    return res.status(400).json({ error: 'championId is required' })
  }
  const rankTierArr = rankTierParam(req.query.rankTier)
  const maxDays = Math.min(14, Math.max(2, Number(req.query.maxDays ?? 14)))
  const rows = await getChampionTierSnapshotsForCharts({
    championId,
    rankTier: rankTierArr && rankTierArr.length ? rankTierArr[0] : null,
    limit: maxDays * 8,
  })
  const byTier = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byTier.get(row.rankTier) ?? []
    list.push(row)
    byTier.set(row.rankTier, list)
  }
  const metricsByTier: Array<Record<string, unknown>> = []
  for (const [tier, list] of byTier.entries()) {
    if (list.length < 2) continue
    const a = list[list.length - 1]
    const b = list[Math.max(0, list.length - 2)]
    if (!a || !b) continue
    const aWinrate = a.games > 0 ? (a.wins / a.games) * 100 : 0
    const bWinrate = b.games > 0 ? (b.wins / b.games) * 100 : 0
    const wrDelta = aWinrate - bWinrate
    const prDelta = (a.pickRatePct ?? 0) - (b.pickRatePct ?? 0)
    const brDelta = (a.banRatePct ?? 0) - (b.banRatePct ?? 0)
    const gamesDeltaPct =
      (b.games ?? 0) > 0 ? (((a.games ?? 0) - (b.games ?? 0)) / (b.games ?? 0)) * 100 : 0
    if (
      Math.abs(wrDelta) >= STATS_TREND_WR_DELTA_PCT ||
      Math.abs(prDelta) >= STATS_TREND_PICK_DELTA_PCT ||
      Math.abs(brDelta) >= STATS_TREND_BAN_DELTA_PCT ||
      Math.abs(gamesDeltaPct) >= STATS_TREND_GAMES_DELTA_PCT
    ) {
      metricsByTier.push({
        rankTier: tier,
        wrDelta,
        prDelta,
        brDelta,
        gamesDeltaPct,
      })
    }
  }
  return res.json({ championId, maxDays, thresholds: {
    winrateDeltaPct: STATS_TREND_WR_DELTA_PCT,
    pickrateDeltaPct: STATS_TREND_PICK_DELTA_PCT,
    banrateDeltaPct: STATS_TREND_BAN_DELTA_PCT,
    gamesDeltaPct: STATS_TREND_GAMES_DELTA_PCT,
  }, metricsByTier })
})

/** New API: /api/stats/runes/table */
router.get('/runes/table', async (req: Request, res: Response) => {
  const championId = req.query.championId != null ? Number(req.query.championId) : null
  if (!championId || !Number.isFinite(championId)) {
    return res.status(400).json({ error: 'championId is required' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const data = await getRuneStatsByChampion({
    championId,
    version,
    rankTier,
    role,
  })
  return res.json({ rows: data?.runes ?? [] })
})

router.get('/runes/all-paths', async (req: Request, res: Response) => {
  const championId = req.query.championId != null ? Number(req.query.championId) : null
  if (!championId || !Number.isFinite(championId)) {
    return res.status(400).json({ error: 'championId is required' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const data = await getRunesByChampion({
    championId,
    patch: version,
    rankTier,
    role,
  })
  return res.json({ trees: data?.runes ?? [] })
})

/** New API: /api/stats/items/sets */
router.get('/items/sets', async (req: Request, res: Response) => {
  const championId = req.query.championId != null ? Number(req.query.championId) : null
  if (!championId || !Number.isFinite(championId)) {
    return res.status(400).json({ error: 'championId is required' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const data = await getBuildsByChampion({
    championId,
    patch: version,
    rankTier,
    role,
    limit: 200,
  })
  const solo = data?.soloItems ?? []
  return res.json({
    totalGames: data?.totalGames ?? 0,
    sets: data?.builds ?? [],
    starters: solo.filter((x) => x.countStarter > 0),
    core: solo.filter((x) => x.countCore > 0),
    boots: solo.filter((x) => x.itemId >= 1001 && x.itemId <= 3117),
    finals: solo,
  })
})

router.get('/items/solo', async (req: Request, res: Response) => {
  const championId = req.query.championId != null ? Number(req.query.championId) : null
  if (!championId || !Number.isFinite(championId)) {
    return res.status(400).json({ error: 'championId is required' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const data = await getBuildsByChampion({
    championId,
    patch: version,
    rankTier,
    role,
    limit: 200,
  })
  return res.json({ totalGames: data?.totalGames ?? 0, rows: data?.soloItems ?? [] })
})

router.get('/tierlist', async (req: Request, res: Response) => {
  const patch = resolvePatchFromQuery(req.query.patch, req.query.version)
  const rt = rankTierParam(req.query.rankTier)
  const rankTier =
    rt == null || rt.length === 0 ? 'all' : rt.length === 1 ? rt[0] : rt.join(',')
  const roleFocus = queryString(req.query.role)?.trim() || null
  const data = await getTierList({ patch, rankTier, role: roleFocus })
  return res.json(data ?? { patch: patch ?? null, rankTier, rows: [], highEloRows: [] })
})

router.get('/tierlist-graph', async (req: Request, res: Response) => {
  const patch = resolvePatchFromQuery(req.query.patch, req.query.version)
  const rt = rankTierParam(req.query.rankTier)
  const rankTier =
    rt == null || rt.length === 0 ? 'all' : rt.length === 1 ? rt[0] : rt.join(',')
  const roleFocus = queryString(req.query.role)?.trim() || null
  const data = await getTierList({ patch, rankTier, role: roleFocus })
  const rows = data?.rows ?? []
  return res.json({
    patch: data?.patch ?? patch ?? null,
    points: rows.map((r) => ({
      championId: r.championId,
      tier: r.tier,
      pbi: r.pbi,
      pickrate: r.pickrate,
      winrate: r.winrate,
    })),
  })
})

router.get('/balance-framework', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryString(req.query.version)
  const role = queryString(req.query.role)
  const otpMode = otpModeFromQuery(req.query.otp)
  const data = await getBalanceFramework({
    version,
    role,
  })
  const response =
    data ?? {
      rules: null,
      currentPatch: version ?? '',
      previousPatch: null,
      abrByLevel: { average: 0, skilled: 0, elite: 0 },
      rows: [],
    }
  response.rows = filterBalanceRowsByOtp(response.rows ?? [], otpMode, Boolean(role))
  return res.json(response)
})

/** New API: /api/stats/summoners/duos and /solo */
router.get('/summoners/duos', async (req: Request, res: Response) => {
  const championId = req.query.championId != null ? Number(req.query.championId) : null
  if (!championId || !Number.isFinite(championId)) {
    return res.status(400).json({ error: 'championId is required' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  void role
  const data = await getSummonerSpellsDuosByChampion(championId, version, rankTier)
  return res.json({ totalGames: data?.totalGames ?? 0, rows: data?.duos ?? [] })
})
router.get('/summoners/solo', async (req: Request, res: Response) => {
  const championId = req.query.championId != null ? Number(req.query.championId) : null
  if (!championId || !Number.isFinite(championId)) {
    return res.status(400).json({ error: 'championId is required' })
  }
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  void role
  const data = await getSummonerSpellsByChampion(championId, version, rankTier)
  return res.json({ totalGames: data?.totalGames ?? 0, rows: data?.spells ?? [] })
})

/** New API: /api/stats/infos/meta */
router.get('/infos/meta', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = rankTierParam(req.query.rankTier)
  const role = queryString(req.query.role)
  const [overview, counts] = await Promise.all([
    getOverviewStats(version, rankTier, role),
    getInfosMetaCounts(),
  ])
  return res.json({
    totalGames: overview?.totalMatches ?? 0,
    playerCount: overview?.playerCount ?? 0,
    totalMatches: counts?.totalMatches ?? 0,
    totalPlayers: counts?.totalPlayers ?? 0,
    playersWithoutLastSeen: counts?.playersWithoutLastSeen ?? 0,
    matchesByDivision: overview?.matchesByDivision ?? [],
    matchesByVersion: overview?.matchesByVersion ?? [],
    otpPickrateThreshold: STATS_OTP_PICKRATE_THRESHOLD,
  })
})

router.get('/infos/patch-division-matrix', async (_req: Request, res: Response) => {
  const data = await getInfosPatchDivisionMatrix()
  return res.json(
    data ?? {
      divisions: [],
      rows: [],
    }
  )
})

/** POST /api/stats/aggregate - recalculer les agrégats (admin / cron) */
router.post('/aggregate', async (_req: Request, res: Response) => {
  try {
    const data = await aggregator.computeAndSave()
    return res.json({
      ok: true,
      totalGames: data.totalGames,
      championsCount: data.champions.length,
      generatedAt: data.generatedAt
    })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Aggregation failed'
    })
  }
})

/** POST /api/stats/refresh-players - no-op: total_games/total_wins via get_players_with_stats() */
router.post('/refresh-players', async (_req: Request, res: Response) => {
  try {
    return res.json({
      ok: true,
      message: 'Stats computed from get_players_with_stats(), no refresh needed',
    })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Refresh failed',
    })
  }
})

export default router
