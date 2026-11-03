/** Inverse la face (build ↔ description) d'une card, sans toucher aux autres. */
export function toggleBuildFlip(
  map: Readonly<Record<string, boolean>>,
  buildId: string
): Record<string, boolean> {
  return { ...map, [buildId]: !map[buildId] }
}

/** Libellé du bouton flip : ce que le clic va afficher. */
export function buildFlipLabelKey(flipped: boolean): string {
  return flipped ? 'buildDetailPage.viewBuild' : 'buildDetailPage.viewDescription'
}

/** Bouton flip du haut : revient au build si la card guide est affichée, sinon build ↔ description. */
export function buildTopFlipAction(state: {
  guideShown: boolean
}): 'close-guide' | 'toggle-description' {
  return state.guideShown ? 'close-guide' : 'toggle-description'
}
