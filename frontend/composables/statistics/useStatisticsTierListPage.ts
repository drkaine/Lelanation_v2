import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalePath } from '#i18n'
import { apiUrl } from '~/utils/apiUrl'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { getChampionImageUrl } from '~/utils/imageUrl'

type TierListSortColumn =
  | 'rank'
  | 'champion'
  | 'tier'
  | 'mainRolePct'
  | 'patchMainRolePctPp'
  | 'winrate'
  | 'pickrate'
  | 'patchWinratePp'
  | 'patchPickratePp'
  | 'pbi'
  | 'patchPbiPp'
  | 'games'
  | 'patchGamesDelta'
  | 'highEloRank'
  | 'highEloWinrate'
  | 'patchHighEloWinratePp'
  | 'highEloGames'
  | 'patchHighEloGamesDelta'
  | 'delta'

export type UseStatisticsTierListPageArgs = {
  statsVersionFilter: Ref<string>
  statsDivisionFilter: Ref<string[]>
  statsRoleFilter: Ref<string>
  statsOtpFilter: Ref<'oui' | 'non' | 'solo'>
  championSearchQuery: Ref<string>
  championsPageSize: Ref<number>
  progressionFromVersion: ComputedRef<string | null>
  gameVersion: Ref<string>
  statsFetch: <T = unknown>(url: string, options?: object) => Promise<T>
}

export function useStatisticsTierListPage(args: UseStatisticsTierListPageArgs) {
  const {
    statsVersionFilter,
    statsDivisionFilter,
    statsRoleFilter,
    statsOtpFilter,
    championSearchQuery,
    championsPageSize,
    progressionFromVersion,
    gameVersion,
    statsFetch,
  } = args

  const { t, locale } = useI18n()
  const localePath = useLocalePath()
  const championsStore = useChampionsStore()

  const ROLE_OPTIONS = [
    { value: 'TOP', label: 'Top', icon: '/icons/roles/top.png' },
    { value: 'JUNGLE', label: 'Jungle', icon: '/icons/roles/jungle.png' },
    { value: 'MIDDLE', label: 'Mid', icon: '/icons/roles/mid.png' },
    { value: 'BOTTOM', label: 'ADC', icon: '/icons/roles/bot.png' },
    { value: 'SUPPORT', label: 'Support', icon: '/icons/roles/support.png' },
  ] as const

  function mainRoleIconSrc(mainRole: string | null | undefined): string | null {
    const raw = (mainRole ?? '').trim().toUpperCase()
    if (!raw) return null
    const key = raw === 'UTILITY' ? 'SUPPORT' : raw
    return ROLE_OPTIONS.find(r => r.value === key)?.icon ?? null
  }

  function mainRoleLabel(mainRole: string | null | undefined): string {
    const raw = (mainRole ?? '').trim().toUpperCase()
    if (!raw) return String(mainRole ?? '—')
    const key = raw === 'UTILITY' ? 'SUPPORT' : raw
    return ROLE_OPTIONS.find(r => r.value === key)?.label ?? String(mainRole)
  }

  function championByKey(championId: number): (typeof championsStore.champions)[0] | null {
    const champ = championsStore.champions.find(c => c.key === String(championId))
    return champ ?? null
  }

  function championName(championId: number): string | null {
    return championByKey(championId)?.name ?? null
  }

  const tierListViewModel = ref<'table' | 'chart'>('table')
  function setTierListViewModel(value: 'table' | 'chart') {
    tierListViewModel.value = value
  }
  const tierListSortColumn = ref<TierListSortColumn | null>('rank')
  const tierListSortDir = ref<'asc' | 'desc'>('desc')
  const tierListPage = ref(1)

  const tierListPending = ref(false)
  const tierListError = ref<string | null>(null)
  const tierListData = ref<{
    patch: string
    rankTier: string
    rows: Array<{
      rank: number
      championId: number
      tier: string
      mainRole: string
      mainRolePct: number
      winrate: number
      pickrate: number
      banrate: number
      pbi: number
      games: number
    }>
    highEloRows?: Array<{
      rank: number
      championId: number
      tier: string
      mainRole: string
      mainRolePct: number
      winrate: number
      pickrate: number
      banrate: number
      pbi: number
      games: number
    }>
  } | null>(null)
  /** Stats ref. patch (progressions) pour Δ WR / pick / ban / Apex. */
  const tierListRefStatsById = ref(
    new Map<
      number,
      {
        winrate: number
        pickrate: number
        banrate: number
        games: number
        mainRolePct: number
        pbi: number
      }
    >()
  )
  const tierListRefHighEloById = ref(new Map<number, { winrate: number; games: number }>())
  const tierListRefRows = ref<
    Array<{
      rank: number
      championId: number
      mainRole: string
    }>
  >([])
  const TIER_ORDER: Record<string, number> = { 'S+': 6, S: 5, A: 4, B: 3, C: 2, D: 1, F: 1 }

  /** High-elo row by champion id for Apex (Master+GM+Chall) columns and deltas. */
  const highEloRowsByChampionId = computed(() => {
    const rows = tierListData.value?.highEloRows ?? []
    const map = new Map<number, (typeof rows)[0]>()
    for (const r of rows) map.set(r.championId, r)
    return map
  })
  const hasTierListHighElo = computed(() => (tierListData.value?.highEloRows?.length ?? 0) > 0)
  /** Couleurs type LoLalytics pour WR % (sur 0–100). */
  function tierListWinrateClass(pct: number): string {
    if (!Number.isFinite(pct)) return 'text-text/80'
    if (pct >= 52.5) return 'font-medium text-green-400'
    if (pct >= 51) return 'text-green-500/95'
    if (pct >= 50) return 'text-sky-200/85'
    return 'text-red-400/90'
  }

  /** Tier list rows with optional delta (global winrate - highElo winrate). */
  interface TierListRowWithDelta {
    rank: number
    championId: number
    tier: string
    mainRole: string
    mainRolePct: number
    winrate: number
    pickrate: number
    banrate: number
    pbi: number
    games: number
    highEloRank?: number
    highEloWinrate?: number
    highEloGames?: number
    delta?: number
    /** Points de % vs patch de référence (progressions). */
    patchRefWinratePp?: number
    patchRefPickratePp?: number
    patchRefBanratePp?: number
    /** Δ part des parties sur le rôle principal (0–100 vs ref., en points de %). */
    patchRefMainRolePctPp?: number
    patchRefGamesDelta?: number
    patchRefHighEloWinratePp?: number
    patchRefHighEloGamesDelta?: number
    /** Écart du score matchup (brut) en points ×100 vs patch de référence. */
    patchRefMatchupScorePp?: number
  }

  function formatTierListPatchDeltaPp(pp: number): string {
    const sign = pp > 0 ? '+' : ''
    return `${sign}${pp.toFixed(2)}`
  }

  function formatTierListPatchDeltaGames(n: number): string {
    const sign = n > 0 ? '+' : ''
    return `${sign}${Math.round(n).toLocaleString()}`
  }

  function tierListPatchDeltaClass(pp: number): string {
    if (pp > 0.05) return 'text-green-400/90'
    if (pp < -0.05) return 'text-red-400/90'
    return 'text-text/55'
  }

  function tierListPatchDeltaGamesClass(n: number): string {
    if (n > 0) return 'text-green-400/90'
    if (n < 0) return 'text-red-400/90'
    return 'text-text/55'
  }

  const tierListRows = computed((): TierListRowWithDelta[] => {
    const rows = tierListData.value?.rows ?? []
    const highElo = highEloRowsByChampionId.value
    const refS = tierListRefStatsById.value
    const refHeMap = tierListRefHighEloById.value
    return rows.map(r => {
      const he = highElo.get(r.championId)
      const winratePct = r.winrate * 100
      const highEloWinratePct = he ? he.winrate * 100 : undefined
      const delta = highEloWinratePct != null ? winratePct - highEloWinratePct : undefined
      const refRow = refS.get(r.championId)
      let patchRefWinratePp: number | undefined
      let patchRefPickratePp: number | undefined
      let patchRefBanratePp: number | undefined
      let patchRefMainRolePctPp: number | undefined
      let patchRefGamesDelta: number | undefined
      let patchRefMatchupScorePp: number | undefined
      if (refRow) {
        patchRefWinratePp = (r.winrate - refRow.winrate) * 100
        patchRefPickratePp = (r.pickrate - refRow.pickrate) * 100
        patchRefBanratePp = (r.banrate - refRow.banrate) * 100
        patchRefMainRolePctPp = r.mainRolePct - refRow.mainRolePct
        patchRefGamesDelta = r.games - refRow.games
        patchRefMatchupScorePp = (r.pbi - refRow.pbi) * 100
      }
      const refHe = refHeMap.get(r.championId)
      let patchRefHighEloWinratePp: number | undefined
      let patchRefHighEloGamesDelta: number | undefined
      if (he && refHe) {
        patchRefHighEloWinratePp = (he.winrate - refHe.winrate) * 100
        patchRefHighEloGamesDelta = he.games - refHe.games
      }
      return {
        ...r,
        highEloRank: he?.rank,
        highEloWinrate: he?.winrate,
        highEloGames: he?.games,
        delta,
        patchRefWinratePp,
        patchRefPickratePp,
        patchRefBanratePp,
        patchRefMainRolePctPp,
        patchRefGamesDelta,
        patchRefHighEloWinratePp,
        patchRefHighEloGamesDelta,
        patchRefMatchupScorePp,
      }
    })
  })

  /** Rôle appliqué côté API (stats du rôle choisi, y compris si ce n’est pas le rôle le plus joué). */
  const tierListRoleFilteredRows = computed(() => tierListRows.value)

  /** Tier list only: filtre par nom / id (champ de recherche). */
  const tierListSearchFilteredRows = computed(() => {
    const list = tierListRoleFilteredRows.value
    const raw = championSearchQuery.value.trim().toLowerCase()
    if (!raw) return list
    return list.filter(row => {
      const name = championName(row.championId)?.toLowerCase() ?? ''
      const idStr = String(row.championId)
      return name.includes(raw) || idStr === raw || idStr.includes(raw)
    })
  })

  /** Rank displayed in table: recomputed on filtered cohort (role filter), independent from sort columns. */
  const tierListFilteredRankByChampionId = computed(() => {
    const map = new Map<number, number>()
    const ordered = [...tierListRoleFilteredRows.value].sort((a, b) => a.rank - b.rank)
    ordered.forEach((row, idx) => map.set(row.championId, idx + 1))
    return map
  })

  /** Reference patch rank map, filtered with the same role filter as current table. */
  const tierListRefFilteredRankByChampionId = computed(() => {
    const map = new Map<number, number>()
    const list = tierListRefRows.value.filter(row =>
      statsRoleFilter.value ? row.mainRole === statsRoleFilter.value : true
    )
    const ordered = [...list].sort((a, b) => a.rank - b.rank)
    ordered.forEach((row, idx) => map.set(row.championId, idx + 1))
    return map
  })

  const sortedTierListRows = computed(() => {
    const list = tierListSearchFilteredRows.value
    const col = tierListSortColumn.value
    const dir = tierListSortDir.value
    if (!col || col === 'champion') {
      return [...list].sort((a, b) => a.rank - b.rank)
    }
    const mult = dir === 'desc' ? 1 : -1
    return [...list].sort((a, b) => {
      let diff = 0
      if (col === 'rank') diff = a.rank - b.rank
      else if (col === 'tier') diff = (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0)
      else if (col === 'mainRolePct') diff = a.mainRolePct - b.mainRolePct
      else if (col === 'patchMainRolePctPp')
        diff = (a.patchRefMainRolePctPp ?? 0) - (b.patchRefMainRolePctPp ?? 0)
      else if (col === 'winrate') diff = a.winrate - b.winrate
      else if (col === 'pickrate') diff = a.pickrate - b.pickrate
      else if (col === 'patchWinratePp')
        diff = (a.patchRefWinratePp ?? 0) - (b.patchRefWinratePp ?? 0)
      else if (col === 'patchPickratePp')
        diff = (a.patchRefPickratePp ?? 0) - (b.patchRefPickratePp ?? 0)
      else if (col === 'pbi') diff = a.pbi - b.pbi
      else if (col === 'patchPbiPp')
        diff = (a.patchRefMatchupScorePp ?? 0) - (b.patchRefMatchupScorePp ?? 0)
      else if (col === 'games') diff = a.games - b.games
      else if (col === 'patchGamesDelta')
        diff = (a.patchRefGamesDelta ?? 0) - (b.patchRefGamesDelta ?? 0)
      else if (col === 'highEloRank') diff = (a.highEloRank ?? 0) - (b.highEloRank ?? 0)
      else if (col === 'highEloWinrate') diff = (a.highEloWinrate ?? 0) - (b.highEloWinrate ?? 0)
      else if (col === 'patchHighEloWinratePp')
        diff = (a.patchRefHighEloWinratePp ?? 0) - (b.patchRefHighEloWinratePp ?? 0)
      else if (col === 'highEloGames') diff = (a.highEloGames ?? 0) - (b.highEloGames ?? 0)
      else if (col === 'patchHighEloGamesDelta')
        diff = (a.patchRefHighEloGamesDelta ?? 0) - (b.patchRefHighEloGamesDelta ?? 0)
      else if (col === 'delta') diff = (a.delta ?? 0) - (b.delta ?? 0)
      return mult * diff
    })
  })

  const totalTierListCount = computed(() => sortedTierListRows.value.length)
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
  const tierListPageSizeSafe = computed(() => {
    const n = Number(championsPageSize.value)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20
  })
  const tierListPageSizeModel = computed({
    get: () => tierListPageSizeSafe.value,
    set: (value: number) => {
      const n = Number(value)
      const next = Number.isFinite(n) && n > 0 ? Math.floor(n) : 20
      championsPageSize.value = PAGE_SIZE_OPTIONS.includes(
        next as (typeof PAGE_SIZE_OPTIONS)[number]
      )
        ? next
        : 20
    },
  })
  const totalTierListPages = computed(() =>
    Math.max(1, Math.ceil(totalTierListCount.value / tierListPageSizeSafe.value))
  )
  const paginatedTierList = computed(() => {
    const list = sortedTierListRows.value
    const size = tierListPageSizeSafe.value
    const page = Math.min(tierListPage.value, Math.max(1, Math.ceil(list.length / size) || 1))
    const start = (page - 1) * size
    return list.slice(start, start + size)
  })
  const tierListRangeStart = computed(() => {
    const total = totalTierListCount.value
    if (total <= 0) return 0
    const page = Math.min(tierListPage.value, totalTierListPages.value)
    return (page - 1) * tierListPageSizeSafe.value + 1
  })
  const tierListRangeEnd = computed(() => {
    const total = totalTierListCount.value
    if (total <= 0) return 0
    const page = Math.min(tierListPage.value, totalTierListPages.value)
    return Math.min(page * tierListPageSizeSafe.value, total)
  })
  const tierListDisplayRankByChampionId = computed(() => {
    return tierListFilteredRankByChampionId.value
  })

  function tierListPatchRankDelta(championId: number): number | null {
    const cur = tierListFilteredRankByChampionId.value.get(championId)
    const ref = tierListRefFilteredRankByChampionId.value.get(championId)
    if (cur == null || ref == null) return null
    // Positive => rank improved (e.g. 10 -> 7 => +3).
    return ref - cur
  }

  function formatTierListPatchDeltaRank(delta: number): string {
    const sign = delta > 0 ? '+' : ''
    return `${sign}${Math.round(delta)}`
  }

  function tierListPatchDeltaRankClass(delta: number): string {
    if (delta > 0) return 'text-green-400/90'
    if (delta < 0) return 'text-red-400/90'
    return 'text-text/55'
  }

  /** Tier list chart: strictly ordered by matchup score (worst -> best). */
  const tierListChartRows = computed(() =>
    [...tierListSearchFilteredRows.value].sort((a, b) => {
      const byScore = a.pbi - b.pbi
      if (byScore !== 0) return byScore
      return a.rank - b.rank
    })
  )
  const tierListChartActiveTiers = ref<Array<'S+' | 'S' | 'A' | 'B' | 'C' | 'D'>>([])
  /** Tooltip graphique tier list : suit la souris, au-dessus du curseur. */
  const tierListChartTooltip = ref<{ championId: number; x: number; y: number } | null>(null)
  function onTierListChartBarEnter(c: TierListRowWithDelta, e: MouseEvent) {
    tierListChartTooltip.value = { championId: c.championId, x: e.clientX, y: e.clientY }
  }
  function onTierListChartBarMove(e: MouseEvent) {
    const t = tierListChartTooltip.value
    if (!t) return
    tierListChartTooltip.value = { ...t, x: e.clientX, y: e.clientY }
  }
  function onTierListChartBarLeave() {
    tierListChartTooltip.value = null
  }
  watch(tierListViewModel, () => {
    tierListChartTooltip.value = null
  })
  /** API = tier « D » pour le plus bas ; l’ancienne légende utilisait « F » — on normalise pour le filtre. */
  function tierListChartApiTier(tier: string): 'S+' | 'S' | 'A' | 'B' | 'C' | 'D' {
    const t = tier === 'F' ? 'D' : tier
    return t as 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'
  }

  const tierListChartVisibleRows = computed(() => {
    const active = tierListChartActiveTiers.value
    if (!active.length) return tierListChartRows.value
    const activeKeys = active.map(k => tierListChartApiTier(k))
    return tierListChartRows.value.filter(row =>
      activeKeys.includes(tierListChartApiTier(row.tier))
    )
  })
  const tierListChartTooltipRow = computed((): TierListRowWithDelta | null => {
    const tip = tierListChartTooltip.value
    if (!tip) return null
    return tierListChartVisibleRows.value.find(r => r.championId === tip.championId) ?? null
  })

  /** Score matchup API (petit nombre) → échelle graphique (×100). */
  function scaleMatchupScore(value: number): number {
    const n = Number(value) * 100
    return Number.isFinite(n) ? n : 0
  }

  function buildGridScoresEvery100(yMin: number, yMax: number): number[] {
    const lo = Math.floor(yMin / 100) * 100
    const hi = Math.ceil(yMax / 100) * 100
    const out: number[] = []
    for (let v = lo; v <= hi + 1e-6; v += 100) {
      out.push(Math.round(v * 100) / 100)
    }
    return [...new Set(out)].sort((a, b) => b - a)
  }

  /** Axe Y sur les min/max des scores visibles (×100), avec 0 dans la plage ; grille tous les 100. */
  const tierListChartYScale = computed(() => {
    const rows = tierListChartVisibleRows.value
    const scores =
      rows.length > 0 ? rows.map(r => scaleMatchupScore(r.pbi)).filter(Number.isFinite) : []

    if (scores.length === 0) {
      const yMin = -500
      const yMax = 500
      const gridScores = buildGridScoresEvery100(yMin, yMax)
      return {
        range: yMax - yMin,
        yMin,
        yMax,
        ticks: gridScores,
        gridScores,
      }
    }

    const rawMin = Math.min(...scores)
    const rawMax = Math.max(...scores)
    // Keep axis tight to real scores (plus 0), then snap to hundreds.
    // Example: min=-250 max=280 -> yMin=-300, yMax=300.
    let yMin = Math.min(0, rawMin)
    let yMax = Math.max(0, rawMax)

    if (yMax <= yMin) {
      yMin -= 1
      yMax += 1
    }

    yMin = Math.floor(yMin / 100) * 100
    yMax = Math.ceil(yMax / 100) * 100

    const gridScores = buildGridScoresEvery100(yMin, yMax)

    return {
      range: yMax - yMin,
      yMin,
      yMax,
      ticks: gridScores,
      gridScores,
    }
  })

  /** Bandes horizontales par tranche de 100 (alternées) pour repérer le niveau du score. */
  const tierListChartYBandSegments = computed(() => {
    const s = tierListChartYScale.value
    const levels = [...s.gridScores].sort((a, b) => a - b)
    if (levels.length < 2)
      return [] as Array<{ bottomPct: number; heightPct: number; shaded: boolean }>
    const out: Array<{ bottomPct: number; heightPct: number; shaded: boolean }> = []
    for (let i = 0; i < levels.length - 1; i++) {
      const lo = levels[i]!
      const hi = levels[i + 1]!
      const p1 = tierListChartYTickBottomPct(lo)
      const p2 = tierListChartYTickBottomPct(hi)
      const bottomPct = Math.min(p1, p2)
      const heightPct = Math.abs(p2 - p1)
      out.push({ bottomPct, heightPct, shaded: i % 2 === 0 })
    }
    return out
  })

  /** Valeurs hors domaine visuel : clamp (tooltip garde la valeur réelle). */
  function matchupScoreClampedForChart(pbi: number): number {
    const s = tierListChartYScale.value
    const v = scaleMatchupScore(pbi)
    return Math.min(s.yMax, Math.max(s.yMin, v))
  }

  function tierListChartYTickBottomPct(tick: number): number {
    const s = tierListChartYScale.value
    const d = s.yMax - s.yMin
    if (!(d > 0) || !Number.isFinite(d)) return 50
    return ((tick - s.yMin) / d) * 100
  }

  /** Position libellé axe Y : évite le rognage en haut / bas du bloc (overflow). */
  function tierListChartYTickLabelStyle(tick: number): Record<string, string> {
    const s = tierListChartYScale.value
    const pct = tierListChartYTickBottomPct(tick)
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-4
    if (near(tick, s.yMax)) {
      return { bottom: '100%', transform: 'translateY(100%)' }
    }
    if (near(tick, s.yMin)) {
      return { bottom: '0%', transform: 'translateY(-100%)' }
    }
    return { bottom: `calc(${pct}% - 0.35em)`, transform: 'none' }
  }

  /** Hauteur en % du tracé : distance entre la ligne 0 et le score (pas |score| / plage totale). */
  function tierListChartBarHeightPct(pbi: number): number {
    const s = tierListChartYScale.value
    const range = s.yMax - s.yMin
    if (range <= 0) return 0
    const n = matchupScoreClampedForChart(pbi)
    const zeroPct = ((0 - s.yMin) / range) * 100
    const valPct = ((n - s.yMin) / range) * 100
    return Math.abs(valPct - zeroPct)
  }

  function tierListChartScoreBottomPct(pbi: number): number {
    return tierListChartYTickBottomPct(matchupScoreClampedForChart(pbi))
  }

  function formatMatchupScore(value: number, decimals = 2): string {
    const n = scaleMatchupScore(value)
    if (!Number.isFinite(n)) return (0).toFixed(decimals)
    return n.toFixed(decimals)
  }

  const tierListChartHeading = computed(() => {
    const role = statsRoleFilter.value
      ? mainRoleLabel(statsRoleFilter.value)
      : t('statisticsPage.tierListChartAllRoles')
    return t('statisticsPage.tierListChartHeading', { role: role.toUpperCase() })
  })

  const tierListChartZeroBottomPct = computed(() =>
    Math.min(100, Math.max(0, tierListChartYTickBottomPct(0)))
  )

  /** Couleurs barres / légende — style diverging tier (F rouge → S+ or). */
  const TIER_CHART_COLORS: Record<'F' | 'D' | 'C' | 'B' | 'A' | 'S' | 'S+', string> = {
    F: '#dc2626',
    D: '#dc2626',
    C: '#a78bfa',
    B: '#7dd3fc',
    A: '#3b82f6',
    S: '#22c55e',
    'S+': '#e5c558',
  }

  const CHART_H = 260
  const CHART_PAD = { left: 44, right: 20, top: 20, bottom: 30 }
  const PLOT_H = CHART_H - CHART_PAD.top - CHART_PAD.bottom

  const TIER_DIVERGING_LEGEND: Array<{
    key: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'
    color: string
  }> = [
    /** Libellé i18n tierF (comme le tableau) — clé API = D */
    { key: 'D', color: TIER_CHART_COLORS.D },
    { key: 'C', color: TIER_CHART_COLORS.C },
    { key: 'B', color: TIER_CHART_COLORS.B },
    { key: 'A', color: TIER_CHART_COLORS.A },
    { key: 'S', color: TIER_CHART_COLORS.S },
    { key: 'S+', color: TIER_CHART_COLORS['S+'] },
  ]

  function tierChartColor(tier: string): string {
    return TIER_CHART_COLORS[tier as keyof typeof TIER_CHART_COLORS] ?? TIER_CHART_COLORS.D
  }

  function toggleTierListChartTier(tier: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'): void {
    const current = tierListChartActiveTiers.value
    if (current.includes(tier)) {
      tierListChartActiveTiers.value = current.filter(t => t !== tier)
      return
    }
    tierListChartActiveTiers.value = [...current, tier]
  }

  function tierListChartTierEnabled(tier: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'): boolean {
    const active = tierListChartActiveTiers.value
    return active.length === 0 || active.includes(tier)
  }

  function tierListChartBarColor(tier: string): string {
    return tierListChartTierEnabled(tier as 'S+' | 'S' | 'A' | 'B' | 'C' | 'D')
      ? tierChartColor(tier)
      : 'rgb(71 85 105 / 0.45)'
  }

  function tierListChartChampionImage(championId: number): string | null {
    const champ = championByKey(championId)
    if (!champ?.image?.full) return null
    return getChampionImageUrl(gameVersion.value, champ.image.full)
  }

  function cycleTierListSort(col: TierListSortColumn) {
    if (tierListSortColumn.value === col) {
      if (tierListSortDir.value === 'desc') tierListSortDir.value = 'asc'
      else tierListSortColumn.value = null
    } else {
      tierListSortColumn.value = col
      tierListSortDir.value = 'desc'
    }
  }
  function tierListSortIcon(col: TierListSortColumn): string {
    if (tierListSortColumn.value !== col) return '—'
    return tierListSortDir.value === 'desc' ? '↓' : '↑'
  }
  watch([tierListSortColumn, tierListSortDir, championsPageSize, championSearchQuery], () => {
    tierListPage.value = 1
  })
  watch(championsPageSize, value => {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) {
      championsPageSize.value = 20
    }
  })

  /** Keep current page in range when the list shrinks (filters, patch, search) without resetting sort. */
  watch(totalTierListPages, maxPages => {
    if (tierListPage.value > maxPages) {
      tierListPage.value = maxPages
    }
  })
  function patchFromVersion(version: string | null | undefined): string | null {
    const raw = (version ?? '').trim()
    if (!raw) return null
    const parts = raw.split('.')
    if (parts.length < 2) return null
    const major = Number(parts[0])
    const minor = Number(parts[1])
    if (!Number.isFinite(major) || !Number.isFinite(minor)) return null
    return `${major}.${minor}`
  }
  const effectiveTierListPatch = computed(() => {
    const fromFilter = patchFromVersion(statsVersionFilter.value)
    if (fromFilter) return fromFilter
    return patchFromVersion(gameVersion.value)
  })

  const tierListPatchDeltaRefLabel = computed(() => {
    const ref = patchFromVersion(progressionFromVersion.value)
    const main = effectiveTierListPatch.value
    if (!ref || !main || ref === main) return null
    return ref
  })
  function tierListQueryString(patch: string | null): string {
    const params = new URLSearchParams()
    if (patch) params.set('patch', patch)
    if (statsDivisionFilter.value.length === 1) {
      params.set('rankTier', statsDivisionFilter.value[0]!)
    } else {
      params.set('rankTier', 'all')
    }
    if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
    params.set('otp', statsOtpFilter.value)
    const q = params.toString()
    return q ? `?${q}` : ''
  }

  type TierListFetchPayload = {
    patch: string
    rankTier: string
    rows: Array<{
      rank: number
      championId: number
      tier: string
      mainRole: string
      mainRolePct: number
      winrate: number
      pickrate: number
      banrate: number
      pbi: number
      games: number
    }>
    highEloRows?: Array<{
      rank: number
      championId: number
      tier: string
      mainRole: string
      mainRolePct: number
      winrate: number
      pickrate: number
      banrate: number
      pbi: number
      games: number
    }>
    error?: string
    message?: string
  }

  async function loadTierList() {
    tierListPending.value = true
    tierListError.value = null
    tierListRefStatsById.value = new Map()
    tierListRefHighEloById.value = new Map()
    tierListRefRows.value = []
    try {
      const patch = effectiveTierListPatch.value
      const data = await statsFetch<TierListFetchPayload>(
        apiUrl(`/api/stats/tier-list${tierListQueryString(patch)}`)
      )
      tierListData.value = data
      if (data?.error || data?.message) {
        tierListError.value = [data.error, data.message].filter(Boolean).join(': ')
      } else {
        tierListError.value = null
      }

      const refPatch = patchFromVersion(progressionFromVersion.value)
      if (
        refPatch &&
        patch &&
        refPatch !== patch &&
        !data?.error &&
        data?.rows &&
        data.rows.length > 0
      ) {
        try {
          const refData = await statsFetch<TierListFetchPayload>(
            apiUrl(`/api/stats/tier-list${tierListQueryString(refPatch)}`)
          )
          if (refData && !refData.error && refData.rows?.length) {
            tierListRefRows.value = refData.rows.map(row => ({
              rank: row.rank,
              championId: row.championId,
              mainRole: row.mainRole,
            }))
            const m = new Map<
              number,
              {
                winrate: number
                pickrate: number
                banrate: number
                games: number
                mainRolePct: number
                pbi: number
              }
            >()
            for (const row of refData.rows) {
              m.set(row.championId, {
                winrate: row.winrate,
                pickrate: row.pickrate,
                banrate: row.banrate,
                games: row.games,
                mainRolePct: row.mainRolePct,
                pbi: row.pbi,
              })
            }
            tierListRefStatsById.value = m
            const hm = new Map<number, { winrate: number; games: number }>()
            if (refData.highEloRows?.length) {
              for (const row of refData.highEloRows) {
                hm.set(row.championId, { winrate: row.winrate, games: row.games })
              }
            }
            tierListRefHighEloById.value = hm
          }
        } catch {
          /* réf. patch optionnelle */
        }
      }
    } catch (err) {
      tierListError.value = err instanceof Error ? err.message : String(err)
      tierListData.value = null
    } finally {
      tierListPending.value = false
    }
  }
  watch([statsDivisionFilter, statsRoleFilter, statsOtpFilter], () => {
    loadTierList().catch(() => undefined)
  })
  watch(effectiveTierListPatch, (patch, oldPatch) => {
    if (patch || oldPatch) loadTierList().catch(() => undefined)
  })
  watch(progressionFromVersion, () => {
    loadTierList().catch(() => undefined)
  })

  return {
    t,
    locale,
    localePath,
    gameVersion,
    championByKey,
    championName,
    getChampionImageUrl,
    mainRoleIconSrc,
    mainRoleLabel,
    tierListViewModel,
    setTierListViewModel,
    tierListSortColumn,
    tierListSortDir,
    tierListPage,
    hasTierListHighElo,
    tierListWinrateClass,
    formatTierListPatchDeltaPp,
    formatTierListPatchDeltaGames,
    tierListPatchDeltaClass,
    tierListPatchDeltaGamesClass,
    tierListPatchRankDelta,
    formatTierListPatchDeltaRank,
    tierListPatchDeltaRankClass,
    cycleTierListSort,
    tierListSortIcon,
    tierListPending,
    tierListError,
    tierListData,
    loadTierList,
    effectiveTierListPatch,
    tierListPatchDeltaRefLabel,
    paginatedTierList,
    totalTierListCount,
    totalTierListPages,
    tierListPageSizeSafe,
    tierListRangeStart,
    tierListRangeEnd,
    tierListDisplayRankByChampionId,
    TIER_DIVERGING_LEGEND,
    CHART_H,
    CHART_PAD,
    PLOT_H,
    tierListChartHeading,
    tierListChartZeroBottomPct,
    tierListChartYScale,
    tierListChartYBandSegments,
    tierListChartYTickBottomPct,
    tierListChartYTickLabelStyle,
    tierListChartBarHeightPct,
    tierListChartScoreBottomPct,
    tierListChartVisibleRows,
    tierListChartTooltip,
    tierListChartTooltipRow,
    onTierListChartBarEnter,
    onTierListChartBarMove,
    onTierListChartBarLeave,
    toggleTierListChartTier,
    tierListChartTierEnabled,
    tierListChartBarColor,
    tierListChartChampionImage,
    formatMatchupScore,
    scaleMatchupScore,
    PAGE_SIZE_OPTIONS,
    tierListPageSizeModel,
  }
}
