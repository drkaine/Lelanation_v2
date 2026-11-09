/** Build runes (maquettes 26/28) : rune choisie par rangée + alternatives, arbre principal / secondaire. */
type Rune = { id: number; name: string; icon: string }
type Path = { id: number; name: string; slots: ReadonlyArray<{ runes: readonly Rune[] }> }
type Stat = { pickrate: number; winrate?: number }

export type RuneOption = Rune & { pick: number; wr: number | null }
export type RunePick = RuneOption & { alts: RuneOption[] }
export type RuneColumn = { pathId: number; name: string; rows: RunePick[] }

const MAX_ALTS = 2

export function pickWithAlts(options: readonly RuneOption[], minAltPick: number): RunePick | null {
  const sorted = [...options].filter(o => o.pick > 0).sort((a, b) => b.pick - a.pick)
  const [top, ...rest] = sorted
  if (!top) return null
  return { ...top, alts: rest.filter(o => o.pick >= minAltPick).slice(0, MAX_ALTS) }
}

function rowOptions(slot: { runes: readonly Rune[] }, stats: Record<number, Stat | undefined>) {
  return slot.runes.map(r => ({
    ...r,
    pick: stats[r.id]?.pickrate ?? 0,
    wr: stats[r.id]?.winrate ?? null,
  }))
}

function rowsOf(path: Path, from: number, stats: Record<number, Stat | undefined>, min: number) {
  return path.slots
    .slice(from)
    .map(slot => pickWithAlts(rowOptions(slot, stats), min))
    .filter((x): x is RunePick => x != null)
}

const sumPick = (rows: readonly RunePick[]) => rows.reduce((a, x) => a + x.pick, 0)

export function runeBuildColumns(
  paths: readonly Path[],
  stats: Record<number, Stat | undefined>,
  minAltPick: number
): { primary: RuneColumn | null; secondary: RuneColumn | null } {
  let primary: RuneColumn | null = null
  let best = 0
  for (const p of paths) {
    const key = pickWithAlts(rowOptions(p.slots[0] ?? { runes: [] }, stats), minAltPick)
    if (key && key.pick > best) {
      best = key.pick
      primary = { pathId: p.id, name: p.name, rows: rowsOf(p, 0, stats, minAltPick) }
    }
  }
  let secondary: RuneColumn | null = null
  let bestSec = 0
  for (const p of paths) {
    if (p.id === primary?.pathId) continue
    const rows = rowsOf(p, 1, stats, minAltPick)
    const top2 = [...rows].sort((a, b) => b.pick - a.pick).slice(0, 2)
    if (sumPick(top2) > bestSec) {
      bestSec = sumPick(top2)
      secondary = { pathId: p.id, name: p.name, rows: rows.filter(r => top2.includes(r)) }
    }
  }
  return { primary, secondary }
}
