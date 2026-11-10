/** Héros de l'accueil (maquette Home) : recherche de champion et champions populaires. */
type PopularRow = { championId: number; pickrate?: number }

export function homePopularPicks<R extends PopularRow>(
  blocks: ReadonlyArray<{ champions: readonly R[] }>,
  limit: number
): R[] {
  const best = new Map<number, R>()
  for (const block of blocks) {
    for (const row of block.champions) {
      const prev = best.get(row.championId)
      if (!prev || (row.pickrate ?? 0) > (prev.pickrate ?? 0)) best.set(row.championId, row)
    }
  }
  return [...best.values()].sort((a, b) => (b.pickrate ?? 0) - (a.pickrate ?? 0)).slice(0, limit)
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
}

/** Slug de /builds/champion/<slug> pour une saisie libre ; nom exact d'abord, puis début de nom. */
export function findChampionSlug(
  query: string,
  champions: ReadonlyArray<{ id: string; name: string }>
): string | null {
  const q = norm(query)
  if (!q) return null
  const hit =
    champions.find(c => norm(c.name) === q || norm(c.id) === q) ??
    champions.find(c => norm(c.name).startsWith(q) || norm(c.id).startsWith(q))
  return hit ? hit.id.toLowerCase() : null
}

/** Dernier build créé (date `createdAt` la plus récente) ; null si aucun. */
export function latestHomeBuild<B extends { createdAt?: string }>(builds: readonly B[]): B | null {
  let best: B | null = null
  let bestTime = -Infinity
  for (const build of builds) {
    const time = Date.parse(build.createdAt ?? '')
    if (Number.isFinite(time) && time > bestTime) {
      best = build
      bestTime = time
    }
  }
  return best
}
