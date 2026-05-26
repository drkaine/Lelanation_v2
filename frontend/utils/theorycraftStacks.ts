import type { TheorycraftSpellCalculation } from '~/composables/useTheorycraftTooltip'
import type { TheorycraftStackDefinition, TheorycraftStackStatBonus } from '~/types/theorycraft'

type CalculatedStatKey =
  | 'abilityPower'
  | 'attackDamage'
  | 'health'
  | 'armor'
  | 'magicResist'
  | 'attackSpeed'

const HEALTH_PER_STACK_DATA_VALUE = /healthperstack$|hpperstack$|maxhealthperstack$/i

function isHealthPerStackDataValue(name: string): boolean {
  return HEALTH_PER_STACK_DATA_VALUE.test(String(name))
}

function findHealthPerStackDataValue(
  dataValues?: Array<{ name: string; values: number[] }>
): { name: string; values: number[] } | undefined {
  return dataValues?.find(entry => isHealthPerStackDataValue(String(entry.name)))
}

function appendStackDataValueCalculations(
  calculations: TheorycraftSpellCalculation[],
  dataValues?: Array<{ name: string; values: number[] }>
): TheorycraftSpellCalculation[] {
  const next = [...calculations]
  for (const entry of dataValues ?? []) {
    const key = String(entry.name)
    if (!isHealthPerStackDataValue(key) || !entry.values?.length) continue
    if (next.some(calc => calc.key.toLowerCase() === key.toLowerCase())) continue
    next.push({ key, baseValues: entry.values, ratios: [] })
  }
  const basicStacks = dataValues?.find(entry => String(entry.name).toLowerCase() === 'basicstacks')
  if (
    basicStacks?.values?.length &&
    !next.some(entry => entry.key.toLowerCase() === 'basicstacks')
  ) {
    next.push({ key: 'basicstacks', baseValues: basicStacks.values, ratios: [] })
  }
  return next
}

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
  const fromExport = Array.isArray(raw)
    ? raw.filter((entry): entry is TheorycraftStackDefinition => {
        if (!entry || typeof entry !== 'object') return false
        const def = entry as TheorycraftStackDefinition
        return (
          typeof def.id === 'string' &&
          Array.isArray(def.statBonuses) &&
          Array.isArray(def.tooltipVars)
        )
      })
    : []

  const inferred = inferStackDefinitionsFromChampion(champion)
  const byId = new Map<string, TheorycraftStackDefinition>()
  for (const def of [...fromExport, ...inferred]) {
    byId.set(`${def.scope}:${def.id}`, def)
  }
  return [...byId.values()]
}

function inferStackDefinitionsFromChampion(
  champion: Record<string, unknown> | null | undefined
): TheorycraftStackDefinition[] {
  const spells = Array.isArray(champion?.spells) ? champion.spells : []
  const inferred: TheorycraftStackDefinition[] = []

  for (const raw of spells) {
    if (!raw || typeof raw !== 'object') continue
    const spell = raw as {
      id?: string
      slot?: string
      name?: string
      dataValues?: Array<{ name: string; values: number[] }>
    }
    const basicStacks = spell.dataValues?.find(
      entry => String(entry.name).toLowerCase() === 'basicstacks'
    )
    if (basicStacks?.values?.length) {
      inferred.push({
        id: String(spell.id ?? ''),
        scope: 'spell',
        spellSlot: String(spell.slot ?? ''),
        label: String(spell.name ?? spell.id ?? 'Stacks'),
        maxStacks: 9999,
        statBonuses: [],
        tooltipVars: [],
        damageBonuses: [{ targetKey: 'totaldamage', perStackKey: 'basicstacks' }],
      })
    }

    const healthPerStack = findHealthPerStackDataValue(spell.dataValues)
    if (healthPerStack?.values?.length) {
      inferred.push({
        id: String(spell.id ?? ''),
        scope: 'spell',
        spellSlot: String(spell.slot ?? ''),
        label: String(spell.name ?? spell.id ?? 'Stacks'),
        maxStacks: 9999,
        statBonuses: [{ stat: 'health', perStackKey: String(healthPerStack.name) }],
        tooltipVars: [{ key: 'f1', perStackKey: String(healthPerStack.name) }],
      })
    }
  }

  return inferred
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
      dataValues?: Array<{ name: string; values: number[] }>
    }
    const calculations = appendStackDataValueCalculations(
      Array.isArray(spell.calculations) ? spell.calculations : [],
      spell.dataValues
    )
    if (calculations.length === 0) continue
    const id = String(spell.id ?? '')
    const slot = String(spell.slot ?? '')
    if (id) bySource[id] = calculations
    if (slot) bySource[slot] = calculations
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
  passiveRankIndex: number,
  spellRanks: Record<string, number> = {}
) {
  return (_championId: string, stackType: string, stacks: number): Record<string, number> => {
    const definition = definitions.find(entry => entry.id === stackType)
    if (!definition) return {}
    const calculations = resolveStackCalculations(definition, calculationsBySource)
    let rankIndex = passiveRankIndex
    if (definition.scope === 'spell') {
      const spellRank = spellRanks[definition.id] ?? 1
      rankIndex = Math.max(0, spellRank - 1)
    }
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

function dataValueAtRank(
  dataValues: Array<{ name: string; values: number[] }> | undefined,
  name: string,
  rankIndex: number
): number | null {
  const entry = dataValues?.find(value => String(value.name).toLowerCase() === name.toLowerCase())
  if (!entry?.values?.length) return null
  const idx = Math.min(Math.max(rankIndex, 0), entry.values.length - 1)
  const value = entry.values[idx]
  return Number.isFinite(value) ? Number(value) : null
}

export function applyStackTooltipVariables(
  setVar: (key: string, value: string) => void,
  definition: TheorycraftStackDefinition,
  calculations: TheorycraftSpellCalculation[],
  stackCount: number,
  rankIndex: number,
  formatNumber: (value: number) => string,
  dataValues?: Array<{ name: string; values: number[] }>
): void {
  const safeStacks = Math.max(0, stackCount)
  for (const tooltipVar of definition.tooltipVars) {
    const perStack = perStackValue(calculations, tooltipVar.perStackKey, rankIndex)
    setVar(tooltipVar.key, formatNumber(perStack * safeStacks))
  }

  const minionMaxStacks = dataValueAtRank(dataValues, 'RMinionMaxStacks', rankIndex)
  if (minionMaxStacks != null && minionMaxStacks > 0) {
    setVar('f3', formatNumber(Math.min(safeStacks, minionMaxStacks)))
  }
}

export function stackDamageBonusForCalculation(
  calculationKey: string,
  stackContext:
    | {
        definition: TheorycraftStackDefinition
        stackCount: number
        calculationsBySource: Record<string, TheorycraftSpellCalculation[]>
      }
    | null
    | undefined,
  rankIndex: number
): number {
  if (!stackContext || stackContext.stackCount <= 0) return 0
  const calculations = resolveStackCalculations(
    stackContext.definition,
    stackContext.calculationsBySource
  )
  let bonus = 0
  for (const entry of stackContext.definition.damageBonuses ?? []) {
    if (entry.targetKey.toLowerCase() !== calculationKey.toLowerCase()) continue
    bonus += perStackValue(calculations, entry.perStackKey, rankIndex) * stackContext.stackCount
  }
  return bonus
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
