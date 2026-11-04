import type { LocationQuery } from 'vue-router'

/** Query des stats de base de la fiche champion rendues en SSR (même version que le filtre). */
export function championSsrStatsQuery(version: string): string {
  const p = new URLSearchParams()
  p.set('otp', 'oui')
  if (version.trim()) p.set('version', version.trim())
  return `?${p.toString()}`
}

/** Query d'URL avec le filtre de version (retiré si vide), pour garder le patch au rechargement. */
export function withVersionQuery(query: LocationQuery, version: string): LocationQuery {
  const { version: _old, ...rest } = query
  return version.trim() ? { ...rest, version: version.trim() } : rest
}

/** Patch montré dans les titres : la version filtrée, sinon le patch courant. */
export function displayedPatch(filterVersion: string, currentPatch: string): string {
  return filterVersion.trim() || currentPatch
}
