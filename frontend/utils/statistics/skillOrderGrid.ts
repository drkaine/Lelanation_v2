/** Grille « Ordre des compétences » (maquette 26) : 4 lignes (Q W E R) × 18 niveaux. */
export type SkillGridKey = 'Q' | 'W' | 'E' | 'R'

const KEYS: readonly SkillGridKey[] = ['Q', 'W', 'E', 'R']
const LEVELS = 18

export function skillOrderGrid(
  order: readonly number[]
): Array<{ key: SkillGridKey; levels: boolean[] }> {
  return KEYS.map((key, i) => ({
    key,
    levels: Array.from({ length: LEVELS }, (_, lvl) => Number(order[lvl]) === i + 1),
  }))
}

/** Ordre mis en avant : le plus joué, puis le meilleur winrate. */
export function mainSkillOrder<T extends { games: number; winrate: number }>(
  rows: readonly T[]
): T | null {
  return [...rows].sort((a, b) => b.games - a.games || b.winrate - a.winrate)[0] ?? null
}
