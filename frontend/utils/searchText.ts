/** Accent-insensitive, case-insensitive search normalization. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

export function isEmptySearchQuery(query: string): boolean {
  return normalizeSearchText(query) === ''
}

export function searchTextIncludes(haystack: string, query: string): boolean {
  const q = normalizeSearchText(query)
  if (!q) return true
  return normalizeSearchText(haystack).includes(q)
}

export function searchAnyIncludes(query: string, parts: Array<string | null | undefined>): boolean {
  const q = normalizeSearchText(query)
  if (!q) return true
  return parts.some(part => {
    if (!part) return false
    return normalizeSearchText(part).includes(q)
  })
}

function mergeTerms(map: Record<string, string[]>, id: string, terms: string[]): void {
  if (!id) return
  const existing = map[id] ?? []
  const merged = new Set([...existing, ...terms.filter(Boolean)])
  map[id] = [...merged]
}

export function indexChampionTerms(
  bySlug: Record<string, string[]>,
  byKey: Record<string, string[]>,
  champion: { id?: string; key?: string | number; name?: string }
): void {
  const slug = String(champion.id ?? '').trim()
  const key = champion.key != null ? String(champion.key).trim() : ''
  const terms = [normalizeSearchText(champion.name ?? ''), normalizeSearchText(slug)].filter(
    Boolean
  )
  if (slug) mergeTerms(bySlug, slug, terms)
  if (key) mergeTerms(byKey, key, terms)
}

export function indexItemTerms(
  byId: Record<string, string[]>,
  id: string,
  item: { name?: string; colloq?: string; plaintext?: string }
): void {
  const terms = [
    normalizeSearchText(item.name ?? ''),
    normalizeSearchText(item.colloq ?? ''),
    normalizeSearchText(item.plaintext ?? ''),
    normalizeSearchText(id),
  ].filter(Boolean)
  mergeTerms(byId, id, terms)
}

export function collectTermsFromMaps(maps: Array<Record<string, string[]>>, id: string): string[] {
  const out = new Set<string>()
  for (const map of maps) {
    for (const term of map[id] ?? []) out.add(term)
  }
  return [...out]
}
