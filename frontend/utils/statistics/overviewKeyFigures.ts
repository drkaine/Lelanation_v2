export interface OverviewKeyFiguresInput {
  total: number
  surrenderOnly: number
  early: number
  topBan: Array<{ championId: number; banrate: number }>
  topWinrateRise: Array<{ championId: number; wrSince: number; deltaWr: number }>
}

export interface OverviewKeyFigures {
  games: number
  surrenderPct: number | null
  earlyPct: number | null
  topBan: { championId: number; banrate: number } | null
  topRise: { championId: number; winrate: number; delta: number } | null
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Chiffres clés de la vue d'ensemble (maquette « Main »). */
export function overviewKeyFigures(input: OverviewKeyFiguresInput): OverviewKeyFigures {
  const total = Number.isFinite(input.total) && input.total > 0 ? input.total : 0
  const ban = input.topBan[0]
  const rise = input.topWinrateRise[0]
  return {
    games: total,
    surrenderPct: total ? round2(((input.surrenderOnly + input.early) / total) * 100) : null,
    earlyPct: total ? round2((input.early / total) * 100) : null,
    topBan: ban ? { championId: ban.championId, banrate: round2(Number(ban.banrate)) } : null,
    topRise:
      rise && Number(rise.deltaWr) > 0
        ? {
            championId: rise.championId,
            winrate: round2(Number(rise.wrSince)),
            delta: round2(Number(rise.deltaWr)),
          }
        : null,
  }
}
