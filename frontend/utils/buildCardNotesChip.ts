/** À partir de 4 chips, la colonne de tags descend jusqu'aux sorts : Notes passe sous les autres tags. */
export const NOTES_CHIP_TAG_LIMIT = 4

export function notesChipPlacement(tagChipCount: number): 'row' | 'stack' {
  return tagChipCount >= NOTES_CHIP_TAG_LIMIT ? 'stack' : 'row'
}
