import { computed, ref } from 'vue'
import type { Composer } from 'vue-i18n'
import { apiUrl } from '~/utils/apiUrl'
import {
  scoreboardDrakeIconByKey,
  scoreboardDrakeIconCdByKey,
  scoreboardObjectiveIconByKey,
  scoreboardObjectiveIconCdByKey,
} from '~/utils/objectiveScoreboardIcons'

type OverviewTeamsData = Record<string, unknown> | null
type OverviewSidesData = Record<string, unknown> | null

export type StatisticsObjectivesPanelOptions = {
  t: Composer['t']
  statsFetch: <T = unknown>(url: string) => Promise<T>
  buildQuery: (versionOverride?: string | null) => string
  resolveBaselineVersion: () => string | null
}

const HORDE_DISPLAY_MAX = 3
const RIFT_HERALD_DISPLAY_MAX = 1

const objectiveKeysOrdered = [
  'baron',
  'dragon',
  'tower',
  'inhibitor',
  'riftHerald',
  'horde',
] as const

const objectiveKeysWithKillDropdown = new Set<string>([
  'baron',
  'dragon',
  'tower',
  'inhibitor',
  'horde',
])

const sidesObjectiveKeysWithKills = [
  'baron',
  'dragon',
  'elder',
  'tower',
  'inhibitor',
  'riftHerald',
  'horde',
] as const

function aggregateObjectiveHistogramDist(
  key: string,
  dist: Record<string, number> | undefined
): Record<number, number> {
  const aggregated: Record<number, number> = {}
  if (!dist || typeof dist !== 'object') return aggregated
  const capHorde = key === 'horde'
  const capRiftHerald = key === 'riftHerald'
  for (const [k, n] of Object.entries(dist)) {
    const raw = parseInt(k, 10) || 0
    let displayCount = raw
    if (capHorde && raw > HORDE_DISPLAY_MAX) displayCount = HORDE_DISPLAY_MAX
    else if (capRiftHerald && raw > RIFT_HERALD_DISPLAY_MAX) displayCount = RIFT_HERALD_DISPLAY_MAX
    aggregated[displayCount] = (aggregated[displayCount] ?? 0) + Number(n)
  }
  return aggregated
}

function formatObjectiveObtentionPercent(games: number, matchCount: number): string {
  if (!matchCount) return '—'
  const pct = games <= 0 ? 0 : Math.round((games / matchCount) * 10000) / 100
  return `${pct.toFixed(2)}%`
}

export function useStatisticsObjectivesPanel(options: StatisticsObjectivesPanelOptions) {
  const { t, statsFetch, buildQuery, resolveBaselineVersion } = options

  const overviewTeamsData = ref<OverviewTeamsData>(null)
  const overviewTeamsBaselineData = ref<OverviewTeamsData>(null)
  const overviewTeamsPending = ref(false)
  const overviewSidesData = ref<OverviewSidesData>(null)
  const overviewSidesBaselineData = ref<OverviewSidesData>(null)
  const overviewSidesPending = ref(false)
  const objectivesPanelTab = ref<'objectives' | 'drakeTypes' | 'drakeSouls'>('objectives')
  const objectivesSidesPanelTab = ref<'objectives' | 'drakeTypes' | 'drakeSouls'>('objectives')
  const openObjectiveKeys = ref<Set<string>>(new Set())
  const openSidesObjectiveKeys = ref<Set<string>>(new Set())

  function setObjectivesPanelTab(value: 'objectives' | 'drakeTypes' | 'drakeSouls') {
    objectivesPanelTab.value = value
  }

  function toggleObjective(key: string) {
    const next = new Set(openObjectiveKeys.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    openObjectiveKeys.value = next
  }

  function toggleSidesObjective(key: string) {
    const next = new Set(openSidesObjectiveKeys.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    openSidesObjectiveKeys.value = next
  }

  function objectiveHasKillDropdown(key: string): boolean {
    return objectiveKeysWithKillDropdown.has(key)
  }

  function objectiveIconSrc(key: string): string | undefined {
    return scoreboardObjectiveIconByKey[key]
  }

  function drakeIconSrc(key: string): string | undefined {
    return scoreboardDrakeIconByKey[key]
  }

  function onObjectiveIconError(e: Event, key: string): void {
    const el = e.target as HTMLImageElement
    if (el.dataset.cdFallback === '1') return
    const url = scoreboardObjectiveIconCdByKey[key]
    if (url) {
      el.dataset.cdFallback = '1'
      el.src = url
    }
  }

  function onDrakeIconError(e: Event, key: string): void {
    const el = e.target as HTMLImageElement
    if (el.dataset.cdFallback === '1') return
    const url = scoreboardDrakeIconCdByKey[key]
    if (url) {
      el.dataset.cdFallback = '1'
      el.src = url
    }
  }

  function firstPercentByTeam(
    firstByWin: number,
    firstByLoss: number,
    matchCount: number
  ): { win: string; loss: string } {
    if (!matchCount) return { win: '—', loss: '—' }
    const winPct = (firstByWin / matchCount) * 100
    const lossPct = (firstByLoss / matchCount) * 100
    return { win: Number(winPct).toFixed(2) + '%', loss: Number(lossPct).toFixed(2) + '%' }
  }

  function firstPercentBySide(
    firstByBlue: number,
    firstByRed: number,
    matchCount: number
  ): { blue: string; red: string } {
    if (!matchCount) return { blue: '—', red: '—' }
    const bluePct = (firstByBlue / matchCount) * 100
    const redPct = (firstByRed / matchCount) * 100
    return { blue: Number(bluePct).toFixed(2) + '%', red: Number(redPct).toFixed(2) + '%' }
  }

  function objectiveRow(key: string): {
    firstByWin: number
    firstByLoss: number
    killsByWin: number
    killsByLoss: number
  } {
    const o = overviewTeamsData.value?.objectives as
      | Record<
          string,
          { firstByWin?: number; firstByLoss?: number; killsByWin?: number; killsByLoss?: number }
        >
      | undefined
    if (!o?.[key]) return { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 }
    const obj = o[key]
    return {
      firstByWin: obj.firstByWin ?? 0,
      firstByLoss: obj.firstByLoss ?? 0,
      killsByWin: obj.killsByWin ?? 0,
      killsByLoss: obj.killsByLoss ?? 0,
    }
  }

  function objectiveRowSides(key: string): {
    firstByBlue: number
    firstByRed: number
    killsByBlue: number
    killsByRed: number
  } {
    const table = overviewSidesData.value?.objectivesBySideTable as
      | Record<
          string,
          { firstByBlue?: number; firstByRed?: number; killsByBlue?: number; killsByRed?: number }
        >
      | undefined
    if (!table?.[key]) return { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0 }
    const obj = table[key]
    return {
      firstByBlue: obj.firstByBlue ?? 0,
      firstByRed: obj.firstByRed ?? 0,
      killsByBlue: obj.killsByBlue ?? 0,
      killsByRed: obj.killsByRed ?? 0,
    }
  }

  function distributionPercentRows(
    dist: Record<string, number> | undefined,
    total: number,
    objectiveKey?: string
  ): Array<{ count: number; percent: number }> {
    if (!total) return []
    const aggregated = objectiveKey
      ? aggregateObjectiveHistogramDist(objectiveKey, dist)
      : Object.fromEntries(
          Object.entries(dist ?? {}).map(([k, n]) => [parseInt(k, 10) || 0, Number(n)])
        )
    return Object.entries(aggregated)
      .map(([countStr, n]) => ({
        count: parseInt(countStr, 10) || 0,
        percent: Math.round((Number(n) / total) * 10000) / 100,
      }))
      .filter(({ count, percent }) => count > 0 && percent > 0)
      .sort((a, b) => a.count - b.count)
  }

  function collectObjectiveDisplayCounts(key: string): number[] {
    const set = new Set<number>()
    const addBuckets = (dist: Record<string, number> | undefined) => {
      const agg = aggregateObjectiveHistogramDist(key, dist)
      for (const [countStr, games] of Object.entries(agg)) {
        const count = parseInt(countStr, 10) || 0
        if (count > 0 && Number(games) > 0) set.add(count)
      }
    }
    const teams = overviewTeamsData.value
    const sides = overviewSidesData.value
    const obj = (teams?.objectives as Record<string, unknown> | undefined)?.[key]
    if (obj && typeof obj === 'object' && 'distributionByWin' in obj) {
      addBuckets((obj as { distributionByWin: Record<string, number> }).distributionByWin)
      addBuckets((obj as { distributionByLoss: Record<string, number> }).distributionByLoss)
    }
    const sideObj = (sides?.objectivesBySideTable as Record<string, unknown> | undefined)?.[
      key
    ] as { distributionByBlue?: Record<string, number>; distributionByRed?: Record<string, number> }
    if (sideObj) {
      addBuckets(sideObj.distributionByBlue)
      addBuckets(sideObj.distributionByRed)
    }
    const sorted = [...set].sort((a, b) => a - b)
    if (key === 'horde') return sorted.filter(c => c <= HORDE_DISPLAY_MAX)
    if (key === 'riftHerald') return sorted.filter(c => c <= RIFT_HERALD_DISPLAY_MAX)
    return sorted
  }

  function objectiveCounts(key: string): number[] {
    return collectObjectiveDisplayCounts(key)
  }

  function sidesObjectiveCounts(key: string): number[] {
    return collectObjectiveDisplayCounts(key)
  }

  function percentForCount(key: string, count: number, byWin: boolean): string {
    const data = overviewTeamsData.value
    const matchCount = Number(data?.matchCount ?? 0)
    if (!matchCount) return '—'
    const obj = (data?.objectives as Record<string, unknown> | undefined)?.[key]
    if (!obj || typeof obj !== 'object' || !('distributionByWin' in obj)) return '—'
    const dist = byWin
      ? (obj as { distributionByWin: Record<string, number> }).distributionByWin
      : (obj as { distributionByLoss: Record<string, number> }).distributionByLoss
    const games = aggregateObjectiveHistogramDist(key, dist)[count] ?? 0
    return formatObjectiveObtentionPercent(games, matchCount)
  }

  function percentForCountSides(key: string, count: number, byBlue: boolean): string {
    const data = overviewSidesData.value
    const matchCount = Number(data?.matchCount ?? 0)
    if (!matchCount) return '—'
    const obj = (data?.objectivesBySideTable as Record<string, unknown> | undefined)?.[key] as
      | { distributionByBlue?: Record<string, number>; distributionByRed?: Record<string, number> }
      | undefined
    if (!obj) return '—'
    const dist = byBlue ? obj.distributionByBlue : obj.distributionByRed
    const games = aggregateObjectiveHistogramDist(key, dist)[count] ?? 0
    return formatObjectiveObtentionPercent(games, matchCount)
  }

  function sidesObjectiveDistributionPercentages(
    key: string,
    byBlue: boolean
  ): Array<{ count: number; percent: number }> {
    const data = overviewSidesData.value
    const matchCount = Number(data?.matchCount ?? 0)
    if (!matchCount) return []
    const obj = (data?.objectivesBySideTable as Record<string, unknown> | undefined)?.[key] as
      | { distributionByBlue?: Record<string, number>; distributionByRed?: Record<string, number> }
      | undefined
    if (!obj) return []
    const dist = byBlue ? obj.distributionByBlue : obj.distributionByRed
    return distributionPercentRows(dist, matchCount, key)
  }

  function objectiveDistributionPercentages(
    key: string,
    byWin: boolean
  ): Array<{ count: number; percent: number }> {
    const data = overviewTeamsData.value
    const matchCount = Number(data?.matchCount ?? 0)
    if (!matchCount) return []
    const obj = (data?.objectives as Record<string, unknown> | undefined)?.[key]
    if (!obj || typeof obj !== 'object' || !('distributionByWin' in obj)) return []
    const dist = byWin
      ? (obj as { distributionByWin: Record<string, number> }).distributionByWin
      : (obj as { distributionByLoss: Record<string, number> }).distributionByLoss
    return distributionPercentRows(dist, matchCount, key)
  }

  const drakeTypeRows = computed(() => {
    const d = (
      overviewTeamsData.value?.drakes as
        | { types?: Record<string, Record<string, unknown>> }
        | undefined
    )?.types
    if (!d) return []
    const build = (key: string, label: string, row: Record<string, unknown> | undefined) => ({
      key,
      label,
      byWin: Number(row?.byWin ?? 0),
      byLoss: Number(row?.byLoss ?? 0),
      securedWinrateGlobal: (row?.securedWinrateGlobal as number | null | undefined) ?? null,
      distributionByWin: (row?.distributionByWin as Record<string, number> | undefined) ?? {},
      distributionByLoss: (row?.distributionByLoss as Record<string, number> | undefined) ?? {},
    })
    return [
      build('elder', t('statisticsPage.overviewTeamsObjective_elder'), d.elder),
      build('earth', t('statisticsPage.drakeTypeEarth'), d.earth),
      build('water', t('statisticsPage.drakeTypeWater'), d.water),
      build('wind', t('statisticsPage.drakeTypeWind'), d.wind),
      build('fire', t('statisticsPage.drakeTypeFire'), d.fire),
      build('hextec', t('statisticsPage.drakeTypeHextec'), d.hextec),
      build('chem', t('statisticsPage.drakeTypeChem'), d.chem),
    ]
  })

  const sidesDrakeTypeRows = computed(() => {
    const d = (
      overviewSidesData.value?.drakesBySide as
        | { types?: Record<string, Record<string, unknown>> }
        | undefined
    )?.types
    if (!d) return []
    const build = (key: string, label: string, row: Record<string, unknown> | undefined) => ({
      key,
      label,
      byBlue: Number(row?.byBlue ?? 0),
      byRed: Number(row?.byRed ?? 0),
      winrateBlue: (row?.winrateBlue as number | null | undefined) ?? null,
      winrateRed: (row?.winrateRed as number | null | undefined) ?? null,
      distributionByBlue: (row?.distributionByBlue as Record<string, number> | undefined) ?? {},
      distributionByRed: (row?.distributionByRed as Record<string, number> | undefined) ?? {},
    })
    return [
      build('elder', t('statisticsPage.overviewTeamsObjective_elder'), d.elder),
      build('earth', t('statisticsPage.drakeTypeEarth'), d.earth),
      build('water', t('statisticsPage.drakeTypeWater'), d.water),
      build('wind', t('statisticsPage.drakeTypeWind'), d.wind),
      build('fire', t('statisticsPage.drakeTypeFire'), d.fire),
      build('hextec', t('statisticsPage.drakeTypeHextec'), d.hextec),
      build('chem', t('statisticsPage.drakeTypeChem'), d.chem),
    ]
  })

  const drakeSoulRows = computed(() => {
    const d = (
      overviewTeamsData.value?.drakes as
        | { souls?: Record<string, { byWin?: number; byLoss?: number }> }
        | undefined
    )?.souls
    if (!d) return []
    const build = (key: string, label: string) => ({
      key,
      label,
      byWin: Number(d[key]?.byWin ?? 0),
      byLoss: Number(d[key]?.byLoss ?? 0),
    })
    return [
      build('earth', t('statisticsPage.drakeTypeEarth')),
      build('water', t('statisticsPage.drakeTypeWater')),
      build('wind', t('statisticsPage.drakeTypeWind')),
      build('fire', t('statisticsPage.drakeTypeFire')),
      build('hextec', t('statisticsPage.drakeTypeHextec')),
      build('chem', t('statisticsPage.drakeTypeChem')),
    ]
  })

  const sidesDrakeSoulRows = computed(() => {
    const d = (
      overviewSidesData.value?.drakesBySide as
        | {
            souls?: Record<
              string,
              {
                byBlue?: number
                byRed?: number
                winrateBlue?: number | null
                winrateRed?: number | null
              }
            >
          }
        | undefined
    )?.souls
    if (!d) return []
    const build = (key: string, label: string) => ({
      key,
      label,
      byBlue: Number(d[key]?.byBlue ?? 0),
      byRed: Number(d[key]?.byRed ?? 0),
      winrateBlue: d[key]?.winrateBlue ?? null,
      winrateRed: d[key]?.winrateRed ?? null,
    })
    return [
      build('earth', t('statisticsPage.drakeTypeEarth')),
      build('water', t('statisticsPage.drakeTypeWater')),
      build('wind', t('statisticsPage.drakeTypeWind')),
      build('fire', t('statisticsPage.drakeTypeFire')),
      build('hextec', t('statisticsPage.drakeTypeHextec')),
      build('chem', t('statisticsPage.drakeTypeChem')),
    ]
  })

  const drakeSoulGlobal = computed(() => {
    const rows = drakeSoulRows.value
    return {
      byWin: rows.reduce((s, r) => s + r.byWin, 0),
      byLoss: rows.reduce((s, r) => s + r.byLoss, 0),
    }
  })

  const sidesDrakeSoulGlobal = computed(() => {
    const rows = sidesDrakeSoulRows.value
    return {
      byBlue: rows.reduce((s, r) => s + r.byBlue, 0),
      byRed: rows.reduce((s, r) => s + r.byRed, 0),
    }
  })

  function drakeTypeDistributionPercentages(
    key: string,
    byWin: boolean
  ): Array<{ count: number; percent: number }> {
    const data = overviewTeamsData.value
    const matchCount = Number(data?.matchCount ?? 0)
    if (!matchCount) return []
    const row = drakeTypeRows.value.find(r => r.key === key)
    if (!row) return []
    const dist = byWin ? row.distributionByWin : row.distributionByLoss
    return distributionPercentRows(dist, matchCount, key)
  }

  function drakeTypeDistributionPercentagesSides(
    key: string,
    byBlue: boolean
  ): Array<{ count: number; percent: number }> {
    const data = overviewSidesData.value
    const matchCount = Number(data?.matchCount ?? 0)
    if (!matchCount) return []
    const row = sidesDrakeTypeRows.value.find(r => r.key === key)
    if (!row) return []
    const dist = byBlue ? row.distributionByBlue : row.distributionByRed
    return distributionPercentRows(dist, matchCount, key)
  }

  function drakeTypeCounts(key: string): number[] {
    const byWin = drakeTypeDistributionPercentages(key, true)
    const byLoss = drakeTypeDistributionPercentages(key, false)
    const byBlue = drakeTypeDistributionPercentagesSides(key, true)
    const byRed = drakeTypeDistributionPercentagesSides(key, false)
    const set = new Set<number>([
      ...byWin.map(r => r.count),
      ...byLoss.map(r => r.count),
      ...byBlue.map(r => r.count),
      ...byRed.map(r => r.count),
    ])
    return [...set].sort((a, b) => a - b)
  }

  function drakeTypePercentForCount(key: string, count: number, byWin: boolean): string {
    const data = overviewTeamsData.value
    const matchCount = Number(data?.matchCount ?? 0)
    if (!matchCount) return '—'
    const row = drakeTypeRows.value.find(r => r.key === key)
    if (!row) return '—'
    const dist = byWin ? row.distributionByWin : row.distributionByLoss
    const games = aggregateObjectiveHistogramDist(key, dist)[count] ?? 0
    return formatObjectiveObtentionPercent(games, matchCount)
  }

  function drakeTypePercentForCountSides(key: string, count: number, byBlue: boolean): string {
    const data = overviewSidesData.value
    const matchCount = Number(data?.matchCount ?? 0)
    if (!matchCount) return '—'
    const row = sidesDrakeTypeRows.value.find(r => r.key === key)
    if (!row) return '—'
    const dist = byBlue ? row.distributionByBlue : row.distributionByRed
    const games = aggregateObjectiveHistogramDist(key, dist)[count] ?? 0
    return formatObjectiveObtentionPercent(games, matchCount)
  }

  async function loadOverviewTeams() {
    overviewTeamsPending.value = true
    try {
      overviewTeamsData.value = await statsFetch(apiUrl('/api/stats/overview-teams' + buildQuery()))
    } catch {
      overviewTeamsData.value = null
    } finally {
      overviewTeamsPending.value = false
    }
  }

  async function loadOverviewSides() {
    overviewSidesPending.value = true
    try {
      overviewSidesData.value = await statsFetch(apiUrl('/api/stats/overview-sides' + buildQuery()))
    } catch {
      overviewSidesData.value = null
    } finally {
      overviewSidesPending.value = false
    }
  }

  async function loadObjectivesBaseline() {
    const cmp = resolveBaselineVersion()
    if (!cmp) {
      overviewTeamsBaselineData.value = null
      overviewSidesBaselineData.value = null
      return
    }
    try {
      const [teamsBase, sidesBase] = await Promise.all([
        statsFetch<OverviewTeamsData>(apiUrl('/api/stats/overview-teams' + buildQuery(cmp))).catch(
          () => null
        ),
        statsFetch<OverviewSidesData>(apiUrl('/api/stats/overview-sides' + buildQuery(cmp))).catch(
          () => null
        ),
      ])
      overviewTeamsBaselineData.value = teamsBase
      overviewSidesBaselineData.value = sidesBase
    } catch {
      overviewTeamsBaselineData.value = null
      overviewSidesBaselineData.value = null
    }
  }

  async function loadObjectivesPanel() {
    await Promise.all([loadOverviewTeams(), loadOverviewSides(), loadObjectivesBaseline()])
  }

  const pageCtx = {
    get overviewTeamsData() {
      return overviewTeamsData.value
    },
    get overviewTeamsBaselineData() {
      return overviewTeamsBaselineData.value
    },
    get overviewTeamsPending() {
      return overviewTeamsPending.value
    },
    get overviewSidesData() {
      return overviewSidesData.value
    },
    get overviewSidesBaselineData() {
      return overviewSidesBaselineData.value
    },
    get overviewSidesPending() {
      return overviewSidesPending.value
    },
    get objectivesPanelTab() {
      return objectivesPanelTab.value
    },
    get objectivesSidesPanelTab() {
      return objectivesSidesPanelTab.value
    },
    get openObjectiveKeys() {
      return openObjectiveKeys.value
    },
    get openSidesObjectiveKeys() {
      return openSidesObjectiveKeys.value
    },
    get drakeTypeRows() {
      return drakeTypeRows.value
    },
    get sidesDrakeTypeRows() {
      return sidesDrakeTypeRows.value
    },
    get drakeSoulRows() {
      return drakeSoulRows.value
    },
    get sidesDrakeSoulRows() {
      return sidesDrakeSoulRows.value
    },
    get drakeSoulGlobal() {
      return drakeSoulGlobal.value
    },
    get sidesDrakeSoulGlobal() {
      return sidesDrakeSoulGlobal.value
    },
    objectiveKeysOrdered,
    sidesObjectiveKeysWithKills,
    setObjectivesPanelTab,
    toggleObjective,
    toggleSidesObjective,
    objectiveHasKillDropdown,
    objectiveIconSrc,
    drakeIconSrc,
    onObjectiveIconError,
    onDrakeIconError,
    firstPercentByTeam,
    firstPercentBySide,
    objectiveRow,
    objectiveRowSides,
    objectiveCounts,
    sidesObjectiveCounts,
    percentForCount,
    percentForCountSides,
    sidesObjectiveDistributionPercentages,
    objectiveDistributionPercentages,
    drakeTypeCounts,
    drakeTypePercentForCount,
    drakeTypePercentForCountSides,
    drakeTypeDistributionPercentages,
    drakeTypeDistributionPercentagesSides,
  }

  return {
    pageCtx,
    loadObjectivesPanel,
    loadOverviewTeams,
    loadOverviewSides,
    loadObjectivesBaseline,
  }
}
