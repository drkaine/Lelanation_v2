type SpellLike = {
  descriptionHtml?: string
  descriptionParsed?: string
  descriptionText?: string
  parsedText?: string
}

export function formatSpellTooltipHtml(
  spell: SpellLike,
  _options?: { showCost?: boolean }
): string {
  return String(
    spell.descriptionHtml ??
      spell.descriptionParsed ??
      spell.descriptionText ??
      spell.parsedText ??
      ''
  ).replace(/\n/g, '<br>')
}
