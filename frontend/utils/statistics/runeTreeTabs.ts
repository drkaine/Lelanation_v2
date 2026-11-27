/** Onglets d'arbre de runes (maquette Builds) : 'all' ou l'id d'un arbre. */
export type RuneTreeTab = 'all' | number

export function visibleRunePaths<T extends { id: number }>(
  paths: readonly T[],
  selected: RuneTreeTab
): T[] {
  if (selected === 'all') return [...paths]
  const hit = paths.filter(p => p.id === selected)
  return hit.length ? hit : [...paths]
}

/**
 * Détail (onglet « toutes les runes », pages meilleur/pire WR et PR) ouvert par défaut sur la page
 * statistiques globale ; replié sur la fiche champion, où il double la carte de build.
 */
export function runesDetailOpenByDefault(layout: {
  buildSummary?: boolean
  unifiedLayout?: boolean
}): boolean {
  return !layout.buildSummary && !layout.unifiedLayout
}
