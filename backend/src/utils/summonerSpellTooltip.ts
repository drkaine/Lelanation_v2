/** Keep in sync with frontend/utils/summonerSpellConstants.ts */
const SUMMONER_SPELL_VARS_BY_KEY: Record<string, Record<string, number | string>> = {
  '21': { shieldstrength: '100-460', shieldduration: '2.5' },
  '1': { tenacityvalue: 0.75, tenacityduration: '3' },
  '14': { tooltiptruedamagecalculation: '70-410', grievousamount: 0.6 },
  '3': { slow: '40', damagereduction: '35', debuffduration: '3' },
  '6': { movespeedmod: '24-48%', duration: '10' },
  '7': { totalheal: '80-318', movespeed: 0.3, movespeedduration: '1' },
  '11': { smitebasedamage: '600-1200', firstpvpdamage: '40' },
  '12': { channelduration: '3', upgrademinute: '10' },
}

type SummonerSpellLike = {
  key?: string
  description?: string
  tooltip?: string
  effect?: Array<number[] | null>
  datavalues?: Record<string, unknown>
}

function normalizeVarKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function formatResolvedValue(value: number | string): string {
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return ''
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 100) / 100).replace(/\.?0+$/, '')
}

function buildVariableMap(spell: SummonerSpellLike): Record<string, number | string> {
  const vars: Record<string, number | string> = {}
  const constants = SUMMONER_SPELL_VARS_BY_KEY[String(spell.key ?? '').trim()]
  if (constants) {
    for (const [name, value] of Object.entries(constants)) {
      vars[name.toLowerCase()] = value
      vars[normalizeVarKey(name)] = value
    }
  }
  const datavalues = spell.datavalues
  if (datavalues && typeof datavalues === 'object') {
    for (const [name, raw] of Object.entries(datavalues)) {
      if (typeof raw === 'number' && Number.isFinite(raw)) vars[name.toLowerCase()] = raw
    }
  }
  return vars
}

function evaluateExpression(
  expression: string,
  vars: Record<string, number | string>
): string | null {
  const expr = expression.trim()
  const lower = expr.toLowerCase()
  if (vars[lower] != null) return formatResolvedValue(vars[lower])
  const compact = normalizeVarKey(lower)
  if (vars[compact] != null) return formatResolvedValue(vars[compact])

  const match = expr.match(/^([a-zA-Z_][\w]*)\s*([*+\-/])\s*([\d.]+)$/)
  if (!match) return null
  const leftKey = match[1].toLowerCase()
  const leftRaw = vars[leftKey] ?? vars[normalizeVarKey(leftKey)]
  const right = Number(match[3])
  if (leftRaw == null || !Number.isFinite(right)) return null
  const left = typeof leftRaw === 'number' ? leftRaw : Number(String(leftRaw).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(left)) return null
  const op = match[2]
  const result =
    op === '*' ? left * right : op === '/' ? left / right : op === '+' ? left + right : left - right
  return formatResolvedValue(result)
}

function pickTemplate(spell: SummonerSpellLike): string {
  const description = String(spell.description ?? '').trim()
  const tooltip = String(spell.tooltip ?? '').trim()
  if (!tooltip) return description
  if (!description) return tooltip
  const descHasNumbers = /\d/.test(description.replace(/\{\{[^}]+\}\}/g, ''))
  if (/\{\{[^}]+\}\}/.test(tooltip) && !descHasNumbers) return tooltip
  if (/\{\{[^}]+\}\}/.test(description)) return tooltip
  return description
}

export function resolveSummonerSpellTooltipPlain(spell: SummonerSpellLike): string {
  const template = pickTemplate(spell)
  if (!template || !/\{\{/.test(template)) return template
  const vars = buildVariableMap(spell)
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, raw: string) => evaluateExpression(raw, vars) ?? '')
}

export function enrichSummonerSpellRecord<T extends SummonerSpellLike>(spell: T): T & { descriptionHtml: string } {
  const resolved = resolveSummonerSpellTooltipPlain(spell)
  return {
    ...spell,
    descriptionHtml: resolved,
  }
}
