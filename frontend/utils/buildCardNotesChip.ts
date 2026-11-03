/** À partir de 4 chips, la colonne de tags descend jusqu'aux sorts : Notes passe sous les autres tags. */
export const NOTES_CHIP_TAG_LIMIT = 4

export function notesChipPlacement(tagChipCount: number): 'row' | 'stack' {
  return tagChipCount >= NOTES_CHIP_TAG_LIMIT ? 'stack' : 'row'
}

/** Colonne des tags d'une carte : visible en édition, ou si un chip doit s'y afficher. */
export function tagColumnVisible(state: {
  readonly: boolean
  tagCount: number
  lelariva: boolean
  guide: boolean
}): boolean {
  return !state.readonly || state.tagCount > 0 || state.lelariva || state.guide
}
