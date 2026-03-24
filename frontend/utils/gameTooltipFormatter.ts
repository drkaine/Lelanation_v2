type SpellLike = {
  tooltip?: string
  description?: string
  cooldownBurn?: string
  cooldown?: number[]
  costBurn?: string
  cost?: number[]
  rangeBurn?: string
  range?: number[]
  maxrank?: number
  effectBurn?: Array<string | null>
}

function formatValueList(values: number[] | undefined, maxrank: number | undefined): string {
  if (!Array.isArray(values) || values.length === 0) return ''
  const limit = Math.max(1, maxrank ?? values.length)
  const trimmed = values.slice(0, limit)
  return trimmed.join(' / ')
}

function findFirstEffectBurn(spell: SpellLike): string {
  if (!Array.isArray(spell.effectBurn)) return ''
  for (let i = 1; i < spell.effectBurn.length; i++) {
    const value = spell.effectBurn[i]
    if (!value) continue
    if (value !== '0') return value
  }
  return ''
}

function resolvePlaceholderToken(token: string, spell: SpellLike): string {
  const normalized = token.trim().toLowerCase()
  if (!normalized) return ''

  if (normalized.includes('cooldown')) {
    return spell.cooldownBurn || formatValueList(spell.cooldown, spell.maxrank) || '-'
  }
  if (normalized.includes('cost')) {
    return spell.costBurn || formatValueList(spell.cost, spell.maxrank) || '-'
  }
  if (normalized.includes('range')) {
    return spell.rangeBurn || formatValueList(spell.range, spell.maxrank) || '-'
  }
  if (/^e\d+$/.test(normalized)) {
    const idx = Number(normalized.slice(1))
    const value = spell.effectBurn?.[idx]
    return value || '-'
  }

  // Keep unresolved tokens explicit, avoids silently lying.
  return '-'
}

function resolveSpellTemplate(text: string, spell: SpellLike): string {
  return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_full, token: string) =>
    resolvePlaceholderToken(token, spell)
  )
}

export function formatSpellTooltipHtml(spell: SpellLike): string {
  const baseRaw = spell.tooltip || spell.description || ''
  const base = resolveSpellTemplate(baseRaw, spell)
  const damage = findFirstEffectBurn(spell)
  const cooldown = spell.cooldownBurn || formatValueList(spell.cooldown, spell.maxrank) || '-'
  const cost = spell.costBurn || formatValueList(spell.cost, spell.maxrank) || '-'
  const range = spell.rangeBurn || formatValueList(spell.range, spell.maxrank) || '-'

  const detailsParts = [
    `<span class="tooltip-spell-meta-key">CD:</span> ${cooldown}`,
    `<span class="tooltip-spell-meta-key">Coût:</span> ${cost}`,
    `<span class="tooltip-spell-meta-key">Portée:</span> ${range}`,
  ]
  if (damage) {
    detailsParts.push(`<span class="tooltip-spell-meta-key">Dégâts:</span> ${damage}`)
  }

  const details = `<br><br><span class="tooltip-spell-meta-line">${detailsParts.join(' · ')}</span>`
  return `${base}${details}`
}
