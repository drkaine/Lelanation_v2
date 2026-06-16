import type {
  MatchupsExtDominanceKey,
  MatchupsExtRow,
  MatchupsExtSignalLevel,
} from '~/components/statistics/ChampionMatchupMobileCard.vue'

export type MatchupInsightSide = 'strength' | 'weakness'

export type MatchupInsight = {
  id: string
  side: MatchupInsightSide
  category: MatchupsExtDominanceKey | 'dive' | 'gank' | 'roam' | 'goldHoard'
  level: MatchupsExtSignalLevel
  titleKey: string
  detailKey: string
  params: Record<string, string | number>
  priority: number
}

const LEVEL_PRIORITY: Record<MatchupsExtSignalLevel, number> = {
  bigAdvantage: 7,
  mediumAdvantage: 6,
  smallAdvantage: 5,
  even: 4,
  smallDisadvantage: 3,
  mediumDisadvantage: 2,
  bigDisadvantage: 1,
}

function levelPriority(level: MatchupsExtSignalLevel | undefined): number {
  return LEVEL_PRIORITY[level ?? 'even']
}

function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`
}

function fmtNum(v: number, digits = 2): string {
  return v.toFixed(digits)
}

function fmtSigned(v: number, digits = 0): string {
  const rounded = digits === 0 ? Math.round(v) : Number(v.toFixed(digits))
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

function fmtDelaySec(selfMs: number, oppMs: number): number {
  if (selfMs <= 0 || oppMs <= 0) return 0
  return Math.round((selfMs - oppMs) / 1000)
}

function pushInsight(
  list: MatchupInsight[],
  insight: Omit<MatchupInsight, 'priority'> & { priority?: number }
): void {
  list.push({
    ...insight,
    priority: insight.priority ?? levelPriority(insight.level),
  })
}

function insightFromDominanceKey(
  row: MatchupsExtRow,
  key: MatchupsExtDominanceKey,
  side: MatchupInsightSide
): MatchupInsight | null {
  const level = row.laneProfileByKey?.[key]
  if (!level || level === 'even') return null
  const detail = row.matchupDetail
  const params: Record<string, string | number> = {}

  const titleKey = `statisticsPage.championMatchupInsight.${side}.${key}.title`
  const detailKey = `statisticsPage.championMatchupInsight.${side}.${key}.detail`

  switch (key) {
    case 'early':
      if (detail) params.gold5 = fmtSigned(detail.lane.goldDiff5Min)
      break
    case 'laneEconomy':
      if (detail) params.gold15 = fmtSigned(detail.lane.goldDiff15Min)
      break
    case 'kills':
      if (detail) {
        params.kills = fmtNum(detail.lane.killsVsOpponent15Min)
        params.deaths = fmtNum(detail.lane.deathsVsOpponent15Min)
      }
      break
    case 'level':
      if (detail) {
        params.level = fmtSigned(detail.lane.levelDiff15Min, 1)
        params.xp = fmtSigned(detail.lane.xpDiff15Min)
      }
      break
    case 'cs':
      if (detail) params.cs15 = fmtSigned(detail.lane.csDiff15Min)
      break
    case 'vision':
      if (detail) params.vision15 = fmtSigned(detail.lane.visionDiff15Min)
      break
    case 'items':
      if (detail) {
        params.legendaryYou = fmtPct(detail.itemsFirst.legendaryFirstRate)
        params.legendaryOpp = fmtPct(detail.itemsFirst.opponentLegendaryFirstRate)
        params.bootsYou = fmtPct(detail.itemsFirst.bootsFirstRate)
        params.bootsOpp = fmtPct(detail.itemsFirst.opponentBootsFirstRate)
      }
      break
    case 'objectives':
      if (detail) {
        const selfObj =
          detail.objectivesAndMap.drakeKillsPerGame +
          detail.objectivesAndMap.drakeAssistsPerGame +
          detail.objectivesAndMap.heraldKillsPerGame +
          detail.objectivesAndMap.voidKillsPerGame
        params.objectives = fmtNum(selfObj)
      }
      break
    case 'pressure':
      if (detail) {
        params.plates = fmtNum(detail.objectivesAndMap.platesTakenPerGame)
        params.firstTower = fmtPct(detail.objectivesAndMap.firstTowerRate)
      }
      break
  }

  return {
    id: `${side}-${key}`,
    side,
    category: key,
    level,
    titleKey,
    detailKey,
    params,
    priority: levelPriority(level),
  }
}

function metricInsights(row: MatchupsExtRow): MatchupInsight[] {
  const out: MatchupInsight[] = []
  const detail = row.matchupDetail
  if (!detail) return out

  const { lane, gankDiveRoam, itemsFirst, objectivesAndMap } = detail

  if (
    gankDiveRoam.diveDeathsPerGame >= 0.1 &&
    gankDiveRoam.diveDeathsPerGame > gankDiveRoam.diveKillsPerGame
  ) {
    pushInsight(out, {
      id: 'weakness-dive-deaths',
      side: 'weakness',
      category: 'dive',
      level:
        gankDiveRoam.diveDeathsPerGame >= 0.25
          ? 'bigDisadvantage'
          : gankDiveRoam.diveDeathsPerGame >= 0.18
            ? 'mediumDisadvantage'
            : 'smallDisadvantage',
      titleKey: 'statisticsPage.championMatchupInsight.weakness.diveDeaths.title',
      detailKey: 'statisticsPage.championMatchupInsight.weakness.diveDeaths.detail',
      params: {
        deaths: fmtNum(gankDiveRoam.diveDeathsPerGame),
        kills: fmtNum(gankDiveRoam.diveKillsPerGame),
      },
    })
  } else if (
    gankDiveRoam.diveKillsPerGame >= 0.12 &&
    gankDiveRoam.diveKillsPerGame > gankDiveRoam.diveDeathsPerGame
  ) {
    pushInsight(out, {
      id: 'strength-dive-kills',
      side: 'strength',
      category: 'dive',
      level:
        gankDiveRoam.diveKillsPerGame >= 0.25
          ? 'bigAdvantage'
          : gankDiveRoam.diveKillsPerGame >= 0.18
            ? 'mediumAdvantage'
            : 'smallAdvantage',
      titleKey: 'statisticsPage.championMatchupInsight.strength.diveKills.title',
      detailKey: 'statisticsPage.championMatchupInsight.strength.diveKills.detail',
      params: {
        kills: fmtNum(gankDiveRoam.diveKillsPerGame),
        deaths: fmtNum(gankDiveRoam.diveDeathsPerGame),
      },
    })
  }

  if (gankDiveRoam.gankDeathsPerGame >= 0.12) {
    pushInsight(out, {
      id: 'weakness-gank-deaths',
      side: 'weakness',
      category: 'gank',
      level:
        gankDiveRoam.gankDeathsPerGame >= 0.22
          ? 'bigDisadvantage'
          : gankDiveRoam.gankDeathsPerGame >= 0.16
            ? 'mediumDisadvantage'
            : 'smallDisadvantage',
      titleKey: 'statisticsPage.championMatchupInsight.weakness.gankDeaths.title',
      detailKey: 'statisticsPage.championMatchupInsight.weakness.gankDeaths.detail',
      params: {
        deaths: fmtNum(gankDiveRoam.gankDeathsPerGame),
        kills: fmtNum(gankDiveRoam.gankKillsPerGame),
      },
    })
  }

  if (gankDiveRoam.roamingKillsPerGame >= 0.15) {
    pushInsight(out, {
      id: 'strength-roam',
      side: 'strength',
      category: 'roam',
      level:
        gankDiveRoam.roamingKillsPerGame >= 0.3
          ? 'bigAdvantage'
          : gankDiveRoam.roamingKillsPerGame >= 0.22
            ? 'mediumAdvantage'
            : 'smallAdvantage',
      titleKey: 'statisticsPage.championMatchupInsight.strength.roamKills.title',
      detailKey: 'statisticsPage.championMatchupInsight.strength.roamKills.detail',
      params: {
        kills: fmtNum(gankDiveRoam.roamingKillsPerGame),
        deaths: fmtNum(gankDiveRoam.roamingDeathsPerGame),
      },
    })
  }

  const legendaryDelaySec = fmtDelaySec(
    itemsFirst.legendaryFirstAvgTimestampMs,
    itemsFirst.opponentLegendaryFirstAvgTimestampMs
  )
  const legendaryGap = itemsFirst.opponentLegendaryFirstRate - itemsFirst.legendaryFirstRate

  if (legendaryGap >= 0.06) {
    pushInsight(out, {
      id: 'weakness-legendary-late',
      side: 'weakness',
      category: 'items',
      level:
        legendaryGap >= 0.15
          ? 'bigDisadvantage'
          : legendaryGap >= 0.1
            ? 'mediumDisadvantage'
            : 'smallDisadvantage',
      titleKey: 'statisticsPage.championMatchupInsight.weakness.legendaryLate.title',
      detailKey: 'statisticsPage.championMatchupInsight.weakness.legendaryLate.detail',
      params: {
        you: fmtPct(itemsFirst.legendaryFirstRate),
        opp: fmtPct(itemsFirst.opponentLegendaryFirstRate),
        delay: legendaryDelaySec > 0 ? legendaryDelaySec : 0,
      },
    })
  } else if (itemsFirst.legendaryFirstRate - itemsFirst.opponentLegendaryFirstRate >= 0.06) {
    pushInsight(out, {
      id: 'strength-legendary-first',
      side: 'strength',
      category: 'items',
      level:
        itemsFirst.legendaryFirstRate - itemsFirst.opponentLegendaryFirstRate >= 0.15
          ? 'bigAdvantage'
          : itemsFirst.legendaryFirstRate - itemsFirst.opponentLegendaryFirstRate >= 0.1
            ? 'mediumAdvantage'
            : 'smallAdvantage',
      titleKey: 'statisticsPage.championMatchupInsight.strength.legendaryFirst.title',
      detailKey: 'statisticsPage.championMatchupInsight.strength.legendaryFirst.detail',
      params: {
        you: fmtPct(itemsFirst.legendaryFirstRate),
        opp: fmtPct(itemsFirst.opponentLegendaryFirstRate),
      },
    })
  }

  if (
    legendaryDelaySec >= 40 &&
    lane.goldDiff15Min > -350 &&
    itemsFirst.legendaryFirstRate <= itemsFirst.opponentLegendaryFirstRate
  ) {
    pushInsight(out, {
      id: 'weakness-gold-hoard',
      side: 'weakness',
      category: 'goldHoard',
      level:
        legendaryDelaySec >= 90
          ? 'bigDisadvantage'
          : legendaryDelaySec >= 60
            ? 'mediumDisadvantage'
            : 'smallDisadvantage',
      titleKey: 'statisticsPage.championMatchupInsight.weakness.goldHoard.title',
      detailKey: 'statisticsPage.championMatchupInsight.weakness.goldHoard.detail',
      params: { delay: legendaryDelaySec, gold15: fmtSigned(lane.goldDiff15Min) },
    })
  }

  const bootsGap = itemsFirst.opponentBootsFirstRate - itemsFirst.bootsFirstRate
  if (bootsGap >= 0.08) {
    pushInsight(out, {
      id: 'weakness-boots-late',
      side: 'weakness',
      category: 'items',
      level:
        bootsGap >= 0.18
          ? 'bigDisadvantage'
          : bootsGap >= 0.12
            ? 'mediumDisadvantage'
            : 'smallDisadvantage',
      titleKey: 'statisticsPage.championMatchupInsight.weakness.bootsLate.title',
      detailKey: 'statisticsPage.championMatchupInsight.weakness.bootsLate.detail',
      params: {
        you: fmtPct(itemsFirst.bootsFirstRate),
        opp: fmtPct(itemsFirst.opponentBootsFirstRate),
      },
    })
  } else if (itemsFirst.bootsFirstRate - itemsFirst.opponentBootsFirstRate >= 0.08) {
    pushInsight(out, {
      id: 'strength-boots-first',
      side: 'strength',
      category: 'items',
      level:
        itemsFirst.bootsFirstRate - itemsFirst.opponentBootsFirstRate >= 0.18
          ? 'bigAdvantage'
          : itemsFirst.bootsFirstRate - itemsFirst.opponentBootsFirstRate >= 0.12
            ? 'mediumAdvantage'
            : 'smallAdvantage',
      titleKey: 'statisticsPage.championMatchupInsight.strength.bootsFirst.title',
      detailKey: 'statisticsPage.championMatchupInsight.strength.bootsFirst.detail',
      params: {
        you: fmtPct(itemsFirst.bootsFirstRate),
        opp: fmtPct(itemsFirst.opponentBootsFirstRate),
      },
    })
  }

  if (lane.visionDiff15Min <= -0.8) {
    pushInsight(out, {
      id: 'weakness-vision-low',
      side: 'weakness',
      category: 'vision',
      level:
        lane.visionDiff15Min <= -2.5
          ? 'bigDisadvantage'
          : lane.visionDiff15Min <= -1.5
            ? 'mediumDisadvantage'
            : 'smallDisadvantage',
      titleKey: 'statisticsPage.championMatchupInsight.weakness.visionLow.title',
      detailKey: 'statisticsPage.championMatchupInsight.weakness.visionLow.detail',
      params: { vision15: fmtSigned(lane.visionDiff15Min) },
    })
  } else if (lane.visionDiff15Min >= 0.8) {
    pushInsight(out, {
      id: 'strength-vision-high',
      side: 'strength',
      category: 'vision',
      level:
        lane.visionDiff15Min >= 2.5
          ? 'bigAdvantage'
          : lane.visionDiff15Min >= 1.5
            ? 'mediumAdvantage'
            : 'smallAdvantage',
      titleKey: 'statisticsPage.championMatchupInsight.strength.visionHigh.title',
      detailKey: 'statisticsPage.championMatchupInsight.strength.visionHigh.detail',
      params: { vision15: fmtSigned(lane.visionDiff15Min) },
    })
  }

  const consumableGap =
    itemsFirst.opponentConsumablesBoughtPerGame - itemsFirst.consumablesBoughtPerGame
  if (consumableGap >= 0.35) {
    pushInsight(out, {
      id: 'weakness-consumables-low',
      side: 'weakness',
      category: 'items',
      level: consumableGap >= 0.8 ? 'mediumDisadvantage' : 'smallDisadvantage',
      titleKey: 'statisticsPage.championMatchupInsight.weakness.consumablesLow.title',
      detailKey: 'statisticsPage.championMatchupInsight.weakness.consumablesLow.detail',
      params: {
        you: fmtNum(itemsFirst.consumablesBoughtPerGame),
        opp: fmtNum(itemsFirst.opponentConsumablesBoughtPerGame),
      },
    })
  }

  const plateGap = objectivesAndMap.opponentPlatesTakenPerGame - objectivesAndMap.platesTakenPerGame
  if (plateGap >= 0.25) {
    pushInsight(out, {
      id: 'weakness-plates-lost',
      side: 'weakness',
      category: 'pressure',
      level: plateGap >= 0.6 ? 'mediumDisadvantage' : 'smallDisadvantage',
      titleKey: 'statisticsPage.championMatchupInsight.weakness.platesLost.title',
      detailKey: 'statisticsPage.championMatchupInsight.weakness.platesLost.detail',
      params: {
        you: fmtNum(objectivesAndMap.platesTakenPerGame),
        opp: fmtNum(objectivesAndMap.opponentPlatesTakenPerGame),
      },
    })
  }

  return out
}

function dedupeInsights(list: MatchupInsight[]): MatchupInsight[] {
  const seen = new Set<string>()
  const out: MatchupInsight[] = []
  for (const item of list.sort((a, b) => b.priority - a.priority)) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

export function buildChampionMatchupInsights(row: MatchupsExtRow): {
  strengths: MatchupInsight[]
  weaknesses: MatchupInsight[]
} {
  const raw: MatchupInsight[] = []

  for (const key of row.dominanceKeys ?? []) {
    const insight = insightFromDominanceKey(row, key, 'strength')
    if (insight) raw.push(insight)
  }
  for (const key of row.weaknessKeys ?? []) {
    const insight = insightFromDominanceKey(row, key, 'weakness')
    if (insight) raw.push(insight)
  }

  raw.push(...metricInsights(row))

  const strengths = dedupeInsights(raw.filter(i => i.side === 'strength')).slice(0, 6)
  const weaknesses = dedupeInsights(raw.filter(i => i.side === 'weakness')).slice(0, 6)

  return { strengths, weaknesses }
}

export const MATCHUP_CATEGORY_COLORS: Record<
  MatchupInsight['category'],
  { border: string; bg: string; text: string; dot: string }
> = {
  early: {
    border: 'border-amber-500/45',
    bg: 'bg-amber-500/12',
    text: 'text-amber-100',
    dot: 'bg-amber-400',
  },
  laneEconomy: {
    border: 'border-yellow-500/45',
    bg: 'bg-yellow-500/12',
    text: 'text-yellow-100',
    dot: 'bg-yellow-400',
  },
  kills: {
    border: 'border-rose-500/45',
    bg: 'bg-rose-500/12',
    text: 'text-rose-100',
    dot: 'bg-rose-400',
  },
  level: {
    border: 'border-sky-500/45',
    bg: 'bg-sky-500/12',
    text: 'text-sky-100',
    dot: 'bg-sky-400',
  },
  cs: {
    border: 'border-orange-500/45',
    bg: 'bg-orange-500/12',
    text: 'text-orange-100',
    dot: 'bg-orange-400',
  },
  vision: {
    border: 'border-violet-500/45',
    bg: 'bg-violet-500/12',
    text: 'text-violet-100',
    dot: 'bg-violet-400',
  },
  items: {
    border: 'border-cyan-500/45',
    bg: 'bg-cyan-500/12',
    text: 'text-cyan-100',
    dot: 'bg-cyan-400',
  },
  objectives: {
    border: 'border-emerald-500/45',
    bg: 'bg-emerald-500/12',
    text: 'text-emerald-100',
    dot: 'bg-emerald-400',
  },
  pressure: {
    border: 'border-fuchsia-500/45',
    bg: 'bg-fuchsia-500/12',
    text: 'text-fuchsia-100',
    dot: 'bg-fuchsia-400',
  },
  dive: {
    border: 'border-red-500/45',
    bg: 'bg-red-500/12',
    text: 'text-red-100',
    dot: 'bg-red-400',
  },
  gank: {
    border: 'border-pink-500/45',
    bg: 'bg-pink-500/12',
    text: 'text-pink-100',
    dot: 'bg-pink-400',
  },
  roam: {
    border: 'border-indigo-500/45',
    bg: 'bg-indigo-500/12',
    text: 'text-indigo-100',
    dot: 'bg-indigo-400',
  },
  goldHoard: {
    border: 'border-amber-600/45',
    bg: 'bg-amber-600/12',
    text: 'text-amber-100',
    dot: 'bg-amber-500',
  },
}
