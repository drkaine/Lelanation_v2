/** Valeurs API / DB : 1=Q, 2=W, 3=E, 4=R */
export type SpellOrderSkill = 1 | 2 | 3 | 4

export type ChampionSpellOrderRowInput = {
  key: string
  order: number[]
  games: number
  wins: number
  pickrate: number
  winrate: number
}

export type ChampionSpellOrderRowMerged = ChampionSpellOrderRowInput & {
  /** Ordre affiché (18 niveaux si extrapolé depuis ≥14). */
  displayOrder: number[]
  /** Nombre de parties agrégées dont l’ordre brut était plus court que l’affichage. */
  mergedFromPartial: number
  extrapolated: boolean
  sourceMaxLevels: number
}

const MAX_LEVEL = 18
/** À partir de ce niveau : un seul sort Q/W/E à maxer + R au 16 → fin déduite. */
const EXTRAPOLATE_FROM_LEVEL = 14

function countSkills(order: number[]): Record<SpellOrderSkill, number> {
  const counts: Record<SpellOrderSkill, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const raw of order) {
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4) counts[raw]++
  }
  return counts
}

function requiredRankAtLevel(playerLevel: number): number {
  if (playerLevel >= 16) return 3
  if (playerLevel >= 11) return 2
  if (playerLevel >= 6) return 1
  return 0
}

/** Sort Q/W/E encore à maxer ; au niveau 14+ il n’en reste qu’un en pratique. */
function lastBasicSkillToMax(counts: Record<SpellOrderSkill, number>): SpellOrderSkill | null {
  const below = ([1, 2, 3] as const).filter(s => counts[s] < 5)
  if (below.length === 0) return null
  below.sort((a, b) => counts[b] - counts[a] || a - b)
  return below[0]
}

/**
 * À partir du niveau 14 : un seul sort de base à finir + R au palier 16 (et 11 si besoin).
 */
export function extrapolateSpellOrder(order: number[]): number[] {
  const clean = order.filter((n): n is SpellOrderSkill => n === 1 || n === 2 || n === 3 || n === 4)
  if (clean.length >= MAX_LEVEL) return clean.slice(0, MAX_LEVEL)
  if (clean.length < EXTRAPOLATE_FROM_LEVEL) return [...clean]

  const result = [...clean]
  const counts = countSkills(result)

  while (result.length < MAX_LEVEL) {
    const nextLevel = result.length + 1
    const needR = requiredRankAtLevel(nextLevel)
    if (counts[4] < needR) {
      result.push(4)
      counts[4]++
      continue
    }

    const lastBasic = lastBasicSkillToMax(counts)
    if (lastBasic) {
      result.push(lastBasic)
      counts[lastBasic]++
      continue
    }

    if (counts[4] < 3) {
      result.push(4)
      counts[4]++
    } else {
      break
    }
  }

  return result
}

function findLongestPrefixMatch(order: number[], allOrders: number[][]): number[] {
  let best: number[] | null = null
  for (const other of allOrders) {
    if (other.length < order.length) continue
    const isPrefix = order.every((v, i) => other[i] === v)
    if (!isPrefix) continue
    if (!best || other.length > best.length) best = other
  }
  return best ?? order
}

/** Ordre canonique : le plus long observé, sinon extrapolation à partir de 14 niveaux. */
export function resolveCanonicalSpellOrder(order: number[], allOrders: number[][]): number[] {
  const clean = order.filter((n): n is SpellOrderSkill => n === 1 || n === 2 || n === 3 || n === 4)
  const longest = findLongestPrefixMatch(clean, allOrders)
  if (longest.length >= MAX_LEVEL) return longest.slice(0, MAX_LEVEL)
  if (longest.length >= EXTRAPOLATE_FROM_LEVEL) return extrapolateSpellOrder(longest)
  return [...longest]
}

export function resolveCanonicalSpellOrderKey(order: number[], allOrders: number[][]): string {
  return resolveCanonicalSpellOrder(order, allOrders).join('-')
}

export function mergeChampionSpellOrderRows(
  rows: ChampionSpellOrderRowInput[],
  totalGames: number
): ChampionSpellOrderRowMerged[] {
  if (rows.length === 0) return []

  const allOrders = rows.map(r =>
    r.order.filter((n): n is SpellOrderSkill => n === 1 || n === 2 || n === 3 || n === 4)
  )

  const byKey = new Map<
    string,
    {
      displayOrder: number[]
      games: number
      wins: number
      mergedFromPartial: number
      extrapolated: boolean
      sourceMaxLevels: number
    }
  >()

  for (const row of rows) {
    const clean = row.order.filter(
      (n): n is SpellOrderSkill => n === 1 || n === 2 || n === 3 || n === 4
    )
    if (clean.length === 0) continue

    const displayOrder = resolveCanonicalSpellOrder(clean, allOrders)
    const key = displayOrder.join('-')
    const wasPartial = clean.length < MAX_LEVEL
    const prev = byKey.get(key)

    if (prev) {
      prev.games += row.games
      prev.wins += row.wins
      if (wasPartial) prev.mergedFromPartial += row.games
      prev.sourceMaxLevels = Math.max(prev.sourceMaxLevels, clean.length)
      prev.extrapolated = prev.extrapolated || wasPartial
    } else {
      byKey.set(key, {
        displayOrder,
        games: row.games,
        wins: row.wins,
        mergedFromPartial: wasPartial ? row.games : 0,
        extrapolated: wasPartial,
        sourceMaxLevels: clean.length,
      })
    }
  }

  return [...byKey.entries()]
    .map(([key, agg]) => ({
      key,
      order: agg.displayOrder,
      displayOrder: agg.displayOrder,
      games: agg.games,
      wins: agg.wins,
      pickrate: totalGames > 0 ? Math.round((agg.games / totalGames) * 10000) / 100 : 0,
      winrate: agg.games > 0 ? Math.round((agg.wins / agg.games) * 10000) / 100 : 0,
      mergedFromPartial: agg.mergedFromPartial,
      extrapolated: agg.extrapolated,
      sourceMaxLevels: agg.sourceMaxLevels,
    }))
    .sort((a, b) => b.games - a.games)
}
