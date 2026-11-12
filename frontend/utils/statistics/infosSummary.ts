/** Synthèse de l'onglet Infos (maquette « D'où viennent les chiffres »). */
import { compareVersionsDesc, MIN_VERSION_SHARE } from './statsVersion'

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
  coverage = 0.8,
  focusVersion?: string | null
): InfosSummary {
  const asc = [...rows].sort((a, b) => compareVersionsDesc(b.version, a.version))
  const maxGames = Math.max(0, ...asc.map(r => n(r.all)))
  const patches = asc.map(r => ({
    version: r.version,
    games: n(r.all),
    heightPct: maxGames > 0 ? Math.round((n(r.all) / maxGames) * 100) : 0,
  }))
  const total = patches.reduce((s, r) => s + r.games, 0)
  const latest = (focusVersion && asc.find(r => r.version === focusVersion)) || asc.at(-1) || null
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

export interface InfosPatchState {
  /** Dernier patch au-dessus du seuil de fiabilité (patch affiché par défaut). */
  defaultVersion: string | null
  /** Patch le plus récent encore sous le seuil (en cours de collecte). */
  collecting: { version: string; games: number; needed: number; pct: number } | null
}

/** Cartes « Patch affiché par défaut » / « Patch en cours de collecte » (maquette Données). */
export function infosPatchState(rows: readonly InfosRow[]): InfosPatchState {
  const desc = [...rows]
    .filter(r => n(r.all) > 0)
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
  if (!desc.length) return { defaultVersion: null, collecting: null }
  const max = Math.max(...desc.map(r => n(r.all)))
  const needed = Math.ceil(max * MIN_VERSION_SHARE)
  const reliable = desc.find(r => n(r.all) >= needed) ?? desc[0]!
  const newest = desc[0]!
  const collecting =
    n(newest.all) < needed
      ? {
          version: newest.version,
          games: n(newest.all),
          needed,
          pct: Math.min(100, Math.round((n(newest.all) / needed) * 100)),
        }
      : null
  return { defaultVersion: reliable.version, collecting }
}
