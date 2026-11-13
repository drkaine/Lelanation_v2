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

/** Texte du filtre de /builds/discover : nom du champion reconnu, sinon la saisie nettoyée. */
export function homeSearchQuery(
  query: string,
  champions: ReadonlyArray<{ id: string; name: string }>
): string {
  const slug = findChampionSlug(query, champions)
  const hit = slug ? champions.find(c => c.id.toLowerCase() === slug) : undefined
  return hit?.name ?? query.trim()
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

/** Query de /builds/discover pour un texte de recherche (`?q=`), vide si rien à filtrer. */
export function homeDiscoverQuery(search: string): { q?: string } {
  const q = search.trim()
  return q ? { q } : {}
}

/** Lit `?q=` de /builds/discover ; null si absent ou vide. */
export function discoverSearchFromQuery(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  const q = typeof raw === 'string' ? raw.trim() : ''
  return q || null
}
