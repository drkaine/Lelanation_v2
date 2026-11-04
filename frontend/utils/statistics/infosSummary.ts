/** Synthèse de l'onglet Infos (maquette « D'où viennent les chiffres »). */
import { compareVersionsDesc } from './statsVersion'

export interface InfosRow {
  version: string
  all: number
  byDivision: Record<string, number>
}

export interface InfosSummary {
  total: number
  patches: { version: string; games: number; heightPct: number }[]
  latestVersion: string | null
  divisions: { division: string; games: number; widthPct: number; sharePct: number }[]
  core: { from: string; to: string; sharePct: number } | null
}

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export function infosSummary(
  rows: readonly InfosRow[],
  divisionOrder: readonly string[],
  coverage = 0.8
): InfosSummary {
  const asc = [...rows].sort((a, b) => compareVersionsDesc(b.version, a.version))
  const maxGames = Math.max(0, ...asc.map(r => n(r.all)))
  const patches = asc.map(r => ({
    version: r.version,
    games: n(r.all),
    heightPct: maxGames > 0 ? Math.round((n(r.all) / maxGames) * 100) : 0,
  }))
  const total = patches.reduce((s, r) => s + r.games, 0)
  const latest = asc.at(-1) ?? null
  const counts = latest ? divisionOrder.map(d => n(latest.byDivision[d])) : []
  const sum = counts.reduce((s, v) => s + v, 0)
  const maxDiv = Math.max(0, ...counts)
  const divisions = latest
    ? divisionOrder
        .map((division, i) => ({
          division,
          games: counts[i]!,
          widthPct: maxDiv > 0 ? Math.round((counts[i]! / maxDiv) * 100) : 0,
          sharePct: sum > 0 ? Math.round((counts[i]! / sum) * 1000) / 10 : 0,
        }))
        .filter(d => d.games > 0)
    : []
  let core: InfosSummary['core'] = null
  if (sum > 0) {
    let best: [number, number] | null = null
    for (let i = 0; i < counts.length; i++) {
      let acc = 0
      for (let j = i; j < counts.length; j++) {
        acc += counts[j]!
        if (acc / sum >= coverage) {
          if (!best || j - i < best[1] - best[0]) best = [i, j]
          break
        }
      }
    }
    if (best) {
      const share = counts.slice(best[0], best[1] + 1).reduce((s, v) => s + v, 0) / sum
      core = {
        from: divisionOrder[best[0]]!,
        to: divisionOrder[best[1]]!,
        sharePct: Math.round(share * 100),
      }
    }
  }
  return { total, patches, latestVersion: latest?.version ?? null, divisions, core }
}
