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
  resource?: string
  vars?: unknown[]
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

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '-'
  const s = n.toFixed(4)
  return s.replace(/\.?0+$/, '')
}

function formatCoeffForTooltip(coeff: number, link?: string): string {
  // Data Dragon `vars[].coeff` is usually a ratio (e.g. 0.7 => 70% AP).
  // Keep a conservative heuristic to avoid absurd outputs.
  const normalizedLink = (link || '').toLowerCase()
  const shouldPercent =
    normalizedLink === 'spelldamage' ||
    normalizedLink === 'abilitypower' ||
    normalizedLink === 'attackdamage' ||
    normalizedLink === 'bonusattackdamage' ||
    normalizedLink === 'bonusattackdamagemod' ||
    normalizedLink === 'attackdamagemod' ||
    normalizedLink === 'abilitypowermod'

  if (shouldPercent && Math.abs(coeff) <= 5) {
    return `${formatNumber(coeff * 100)}%`
  }
  return formatNumber(coeff)
}

function resolveVarCoeff(token: string, spell: SpellLike): string {
  const vars = spell.vars
  if (!Array.isArray(vars) || vars.length === 0) return '-'
  const v = vars.find(x => {
    if (!x || typeof x !== 'object') return false
    const key = (x as { key?: unknown }).key
    return typeof key === 'string' && key.toLowerCase() === token
  }) as { key?: unknown; coeff?: unknown; link?: unknown } | undefined
  if (!v) return '-'
  const coeffRaw = v.coeff
  const coeff = Array.isArray(coeffRaw)
    ? Number(coeffRaw[0])
    : typeof coeffRaw === 'number'
      ? coeffRaw
      : NaN
  if (!Number.isFinite(coeff)) return '-'
  const link = typeof v.link === 'string' ? v.link : undefined
  return formatCoeffForTooltip(coeff, link)
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
  if (/^[af]\d+$/.test(normalized)) {
    return resolveVarCoeff(normalized, spell)
  }

  // Keep unresolved tokens explicit, avoids silently lying.
  return '-'
}

function resolveSpellTemplate(text: string, spell: SpellLike): string {
  return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_full, token: string) =>
    resolvePlaceholderToken(token, spell)
  )
}

export function formatSpellTooltipHtml(spell: SpellLike, options?: { showCost?: boolean }): string {
  const showCost = options?.showCost ?? true
  const baseRaw = spell.tooltip || spell.description || ''
  const base = resolveSpellTemplate(baseRaw, spell)
  const damage = findFirstEffectBurn(spell)
  const cooldown = spell.cooldownBurn || formatValueList(spell.cooldown, spell.maxrank) || '-'
  const cost =
    (spell.resource ? resolveSpellTemplate(spell.resource, spell) : '') ||
    spell.costBurn ||
    formatValueList(spell.cost, spell.maxrank) ||
    '-'
  const range = spell.rangeBurn || formatValueList(spell.range, spell.maxrank) || '-'

  const detailsParts = [
    `<span class="tooltip-spell-meta-key">CD:</span> ${cooldown}`,
    `<span class="tooltip-spell-meta-key">Portée:</span> ${range}`,
  ]
  if (showCost) {
    detailsParts.splice(1, 0, `<span class="tooltip-spell-meta-key">Coût:</span> ${cost}`)
  }
  if (damage) {
    detailsParts.push(`<span class="tooltip-spell-meta-key">Dégâts:</span> ${damage}`)
  }

  const details = `<br><br><span class="tooltip-spell-meta-line">${detailsParts.join(' · ')}</span>`
  return `${base}${details}`
}
