import type { TheorycraftSpellCalculation } from '~/composables/useTheorycraftTooltip'
import type { TheorycraftStackDefinition, TheorycraftStackStatBonus } from '~/types/theorycraft'

type CalculatedStatKey =
  | 'abilityPower'
  | 'attackDamage'
  | 'health'
  | 'armor'
  | 'magicResist'
  | 'attackSpeed'

function perStackValue(
  calculations: TheorycraftSpellCalculation[],
  perStackKey: string,
  rankIndex: number
): number {
  const calculation = calculations.find(
    entry => entry.key.toLowerCase() === perStackKey.toLowerCase()
  )
  if (!calculation || calculation.baseValues.length === 0) return 0
  const idx = Math.min(Math.max(rankIndex, 0), calculation.baseValues.length - 1)
  const value = calculation.baseValues[idx]
  return Number.isFinite(value) ? Number(value) : 0
}

function mapStackStatToCalculated(stat: TheorycraftStackStatBonus['stat']): CalculatedStatKey {
  return stat
}

export function parseStackDefinitions(
  champion: Record<string, unknown> | null | undefined
): TheorycraftStackDefinition[] {
  const raw = champion?.stackDefinitions
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is TheorycraftStackDefinition => {
    if (!entry || typeof entry !== 'object') return false
    const def = entry as TheorycraftStackDefinition
    return (
      typeof def.id === 'string' && Array.isArray(def.statBonuses) && Array.isArray(def.tooltipVars)
    )
  })
}

export function buildStackCalculationsBySource(
  champion: Record<string, unknown> | null | undefined
): Record<string, TheorycraftSpellCalculation[]> {
  const bySource: Record<string, TheorycraftSpellCalculation[]> = {}
  const passive = champion?.passive
  if (
    passive &&
    typeof passive === 'object' &&
    Array.isArray((passive as { calculations?: unknown }).calculations)
  ) {
    bySource.passive = (passive as { calculations: TheorycraftSpellCalculation[] }).calculations
  }
  const spells = Array.isArray(champion?.spells) ? champion.spells : []
  for (const raw of spells) {
    if (!raw || typeof raw !== 'object') continue
    const spell = raw as {
      id?: string
      slot?: string
      calculations?: TheorycraftSpellCalculation[]
    }
    if (!Array.isArray(spell.calculations)) continue
    const id = String(spell.id ?? '')
    const slot = String(spell.slot ?? '')
    if (id) bySource[id] = spell.calculations
    if (slot) bySource[slot] = spell.calculations
  }
  return bySource
}

export function resolveStackCalculations(
  definition: TheorycraftStackDefinition,
  calculationsBySource: Record<string, TheorycraftSpellCalculation[]>
): TheorycraftSpellCalculation[] {
  if (definition.scope === 'passive') {
    return calculationsBySource.passive ?? []
  }
  return (
    calculationsBySource[definition.id] ??
    (definition.spellSlot ? calculationsBySource[definition.spellSlot] : undefined) ??
    []
  )
}

export function computeStackStatBonuses(
  definition: TheorycraftStackDefinition,
  calculations: TheorycraftSpellCalculation[],
  stacks: number,
  rankIndex: number
): Record<string, number> {
  const safeStacks = Math.max(0, stacks)
  const maxStacks = definition.maxStacks
  const clampedStacks =
    maxStacks != null && Number.isFinite(maxStacks)
      ? Math.min(safeStacks, Math.max(0, maxStacks))
      : safeStacks

  const result: Record<string, number> = {}
  for (const bonus of definition.statBonuses) {
    const perStack = perStackValue(calculations, bonus.perStackKey, rankIndex)
    const total = perStack * clampedStacks
    if (total === 0) continue
    const statKey = mapStackStatToCalculated(bonus.stat)
    result[statKey] = (result[statKey] ?? 0) + total
  }
  return result
}

export function buildPassiveStackStatsProvider(
  definitions: TheorycraftStackDefinition[],
  calculationsBySource: Record<string, TheorycraftSpellCalculation[]>,
  rankIndex: number
) {
  return (_championId: string, stackType: string, stacks: number): Record<string, number> => {
    const definition = definitions.find(entry => entry.id === stackType)
    if (!definition) return {}
    const calculations = resolveStackCalculations(definition, calculationsBySource)
    return computeStackStatBonuses(definition, calculations, stacks, rankIndex)
  }
}

export function buildPassiveStacksInput(
  definitions: TheorycraftStackDefinition[],
  stackCounts: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const definition of definitions) {
    const count = stackCounts[definition.id] ?? 0
    if (count > 0) out[definition.id] = count
  }
  return out
}

export function applyStackTooltipVariables(
  setVar: (key: string, value: string) => void,
  definition: TheorycraftStackDefinition,
  calculations: TheorycraftSpellCalculation[],
  stackCount: number,
  rankIndex: number,
  formatNumber: (value: number) => string
): void {
  const safeStacks = Math.max(0, stackCount)
  for (const tooltipVar of definition.tooltipVars) {
    const perStack = perStackValue(calculations, tooltipVar.perStackKey, rankIndex)
    setVar(tooltipVar.key, formatNumber(perStack * safeStacks))
  }
}

export function findStackDefinitionForSource(
  definitions: TheorycraftStackDefinition[],
  source: { scope: 'passive' | 'spell'; id?: string; slot?: string }
): TheorycraftStackDefinition | null {
  if (source.scope === 'passive') {
    return definitions.find(def => def.scope === 'passive') ?? null
  }
  const id = String(source.id ?? '')
  const slot = String(source.slot ?? '')
  return (
    definitions.find(def => def.scope === 'spell' && (def.id === id || def.spellSlot === slot)) ??
    null
  )
}
