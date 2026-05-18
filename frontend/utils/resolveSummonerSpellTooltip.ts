import { SUMMONER_SPELL_VARS_BY_KEY } from './summonerSpellConstants'

type SummonerSpellLike = {
  key?: string
  id?: string
  effect?: Array<number[] | null>
  datavalues?: Record<string, unknown>
}

function normalizeVarKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function formatResolvedValue(value: number | string): string {
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return ''
  if (Number.isInteger(value)) return String(value)
  const rounded = Math.round(value * 100) / 100
  return String(rounded).replace(/\.?0+$/, '')
}

function lookupVariable(
  name: string,
  vars: Record<string, number | string>
): number | string | undefined {
  const lower = name.trim().toLowerCase()
  if (vars[lower] != null) return vars[lower]
  const compact = normalizeVarKey(lower)
  if (vars[compact] != null) return vars[compact]
  return undefined
}

function evaluateExpression(
  expression: string,
  vars: Record<string, number | string>
): string | null {
  const expr = expression.trim()
  if (!expr) return null

  const direct = lookupVariable(expr, vars)
  if (direct != null) return formatResolvedValue(direct)

  const match = expr.match(/^([a-zA-Z_][\w]*)\s*([*+\-/])\s*([\d.]+)$/)
  if (match) {
    const leftRaw = lookupVariable(match[1], vars)
    const operator = match[2]
    const right = Number(match[3])
    if (leftRaw == null || !Number.isFinite(right)) return null
    const left =
      typeof leftRaw === 'number' ? leftRaw : Number(String(leftRaw).replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(left)) return null
    let result: number
    switch (operator) {
      case '*':
        result = left * right
        break
      case '/':
        result = right !== 0 ? left / right : left
        break
      case '+':
        result = left + right
        break
      case '-':
        result = left - right
        break
      default:
        return null
    }
    return formatResolvedValue(result)
  }

  return null
}

export function buildSummonerSpellVariableMap(
  spell: SummonerSpellLike
): Record<string, number | string> {
  const key = String(spell.key ?? '').trim()
  const vars: Record<string, number | string> = {}

  const constants = SUMMONER_SPELL_VARS_BY_KEY[key]
  if (constants) {
    for (const [name, value] of Object.entries(constants)) {
      vars[name.toLowerCase()] = value
      const compact = normalizeVarKey(name)
      if (compact) vars[compact] = value
    }
  }

  const datavalues = spell.datavalues
  if (datavalues && typeof datavalues === 'object') {
    for (const [name, raw] of Object.entries(datavalues)) {
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        vars[name.toLowerCase()] = raw
      } else if (typeof raw === 'string' && raw.trim()) {
        vars[name.toLowerCase()] = raw.trim()
      }
    }
  }

  const effect = spell.effect
  if (Array.isArray(effect)) {
    effect.forEach((entry, index) => {
      if (index <= 0 || !Array.isArray(entry) || entry.length === 0) return
      const value = entry[0]
      if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return
      vars[`e${index}`] = value
      vars[`effect${index}`] = value
    })
  }

  return vars
}

/** Replace `{{ variable }}` / `{{ expr*100 }}` in summoner spell tooltip templates. */
export function substituteSummonerSpellVariables(
  template: string,
  spell: SummonerSpellLike
): string {
  if (!template || !/\{\{/.test(template)) return template

  const vars = buildSummonerSpellVariableMap(spell)
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawExpr: string) => {
    const resolved = evaluateExpression(rawExpr, vars)
    return resolved ?? ''
  })
}

/** Prefer tooltip when description is generic (no numbers); resolve variables. */
export function pickSummonerSpellTemplate(spell: {
  description?: string
  tooltip?: string
}): string {
  const description = String(spell.description ?? '').trim()
  const tooltip = String(spell.tooltip ?? '').trim()
  if (!tooltip) return description
  if (!description) return tooltip

  const descPlain = description.replace(/\{\{[^}]+\}\}/g, '')
  const descHasNumbers = /\d/.test(descPlain)
  const tooltipHasVars = /\{\{[^}]+\}\}/.test(tooltip)

  if (tooltipHasVars && !descHasNumbers) return tooltip
  if (/\{\{[^}]+\}\}/.test(description)) return tooltip
  return description
}

export function resolveSummonerSpellTooltipText(
  spell: SummonerSpellLike & {
    description?: string
    tooltip?: string
    descriptionHtml?: string
    descriptionParsed?: string
  }
): string {
  const preParsed = String(spell.descriptionHtml ?? spell.descriptionParsed ?? '').trim()
  if (preParsed && !/\{\{[^}]+\}\}/.test(preParsed)) return preParsed

  const template = pickSummonerSpellTemplate(spell)
  if (!template) return ''
  return substituteSummonerSpellVariables(template, spell)
}
