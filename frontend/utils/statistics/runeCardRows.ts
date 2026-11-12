/** Cartes runes de l'onglet Builds (maquette) : une ligne par rangée d'arbre. */
type Rune = { id: number; name: string; icon: string }
type Path = { id: number; slots: ReadonlyArray<{ runes: readonly Rune[] }> }
type Stat = { pickrate: number; winrate?: number; games?: number }

export type RuneCard = Rune & {
  pick: number | null
  wr: number | null
  /** Largeur de barre (%) relative au plus joué de la rangée. */
  bar: number
  /** Écart de winrate (pts) vs patch de référence, null sans référence. */
  delta: number | null
}

export function runeCardRows(
  path: Path,
  stats: Record<number, Stat | undefined>,
  baseline: Record<number, Stat | undefined>
): Array<{ row: number; cards: RuneCard[] }> {
  return path.slots.map((slot, row) => {
    const runes = slot.runes.slice(0, row === 0 ? 4 : 3)
    const max = Math.max(0, ...runes.map(r => stats[r.id]?.pickrate ?? 0))
    const cards = runes.map(r => {
      const s = stats[r.id]
      const b = baseline[r.id]
      const wr = s?.winrate ?? null
      const bwr = b?.winrate
      return {
        ...r,
        pick: s?.pickrate ?? null,
        wr,
        bar: max > 0 && s ? (s.pickrate / max) * 100 : 0,
        delta: wr != null && bwr != null ? Math.round((wr - bwr) * 100) / 100 : null,
      }
    })
    return { row, cards }
  })
}

/** Arbre affiché par défaut : celui dont les clés de voûte cumulent le plus de pickrate. */
export function defaultRuneTree(
  paths: readonly Path[],
  stats: Record<number, Stat | undefined>
): number | null {
  let best: number | null = null
  let bestPick = -1
  for (const p of paths) {
    const pick = (p.slots[0]?.runes ?? []).reduce((a, r) => a + (stats[r.id]?.pickrate ?? 0), 0)
    if (pick > bestPick) {
      bestPick = pick
      best = p.id
    }
  }
  return best
}
