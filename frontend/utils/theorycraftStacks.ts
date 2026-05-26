import type { TheorycraftSpellCalculation } from '~/composables/useTheorycraftTooltip'
import type {
  TheorycraftStackDefinition,
  TheorycraftStackFormulaVar,
  TheorycraftStackStatBonus,
} from '~/types/theorycraft'

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

function mapPassivePerStackToStat(name: string): TheorycraftStackStatBonus['stat'] | null {
  const lower = name.toLowerCase()
  if (/adperstack/.test(lower)) return 'attackDamage'
  if (/apperstack|apparatio/.test(lower)) return 'abilityPower'
  if (/armorperstack/.test(lower)) return 'armor'
  if (/ahperstack/.test(lower)) return null
  if (/attackspeedperstack|enrageasperstack/.test(lower)) return 'attackSpeed'
  return null
}

function inferPassiveStackDefinition(
  champion: Record<string, unknown> | null | undefined
): TheorycraftStackDefinition | null {
  const passive = champion?.passive
  if (!passive || typeof passive !== 'object') return null

  const p = passive as {
    name?: string
    dataValues?: Array<{ name: string; values: number[] }>
    calculations?: TheorycraftSpellCalculation[]
  }

  const passiveDvs = p.dataValues ?? []
  const perStackDvs = passiveDvs.filter(entry => /perstack$/i.test(String(entry.name)))
  if (perStackDvs.length === 0) return null

  const passiveCalcs = p.calculations ?? []

  const statBonuses: TheorycraftStackStatBonus[] = []
  const tooltipVars: { key: string; perStackKey: string }[] = []

  for (const dv of perStackDvs) {
    const stat = mapPassivePerStackToStat(dv.name)
    if (stat) {
      statBonuses.push({
        stat,
        perStackKey: dv.name,
        isPercent: stat === 'attackSpeed',
      })
    }
  }

  for (const calc of passiveCalcs) {
    if (calc.baseValues.length === 0) continue
    const allSame = calc.baseValues.every(v => v === calc.baseValues[0])
    if (!allSame) continue
    const constVal = calc.baseValues[0]
    if (constVal === 0) continue
    const matchingDv = passiveDvs.find(dv => {
      const dvFirst = dv.values?.[0]
      return dvFirst != null && Math.abs(dvFirst - constVal) < 1e-8
    })
    if (matchingDv) {
      tooltipVars.push({ key: calc.key, perStackKey: calc.key })
    }
  }

  const formulaVars: TheorycraftStackFormulaVar[] = []
  const spells = Array.isArray((champion as Record<string, unknown>)?.spells)
    ? ((champion as Record<string, unknown>).spells as Array<{
        slot?: string
        dataValues?: Array<{ name: string; values: number[] }>
      }>)
    : []

  const AREA_PER_STACK_KEYS = [
    'outerradiusareaperstack',
    'innerradiusareaperstack',
    'areaperpassivestack',
  ]
  const SLOT_TO_FVAR: Record<string, string> = { W: 'f2', E: 'f3', R: 'f4' }

  for (const spell of spells) {
    const slot = String(spell.slot ?? '')
    const fKey = SLOT_TO_FVAR[slot]
    if (!fKey) continue
    const dvs = spell.dataValues ?? []
    const areaEntry = dvs.find(d => AREA_PER_STACK_KEYS.includes(String(d.name).toLowerCase()))
    const radiusEntry = dvs.find(d => /^startingradius$/i.test(String(d.name)))
    if (areaEntry?.values?.[0] && radiusEntry?.values?.[0]) {
      formulaVars.push({
        key: fKey,
        formula: 'areaToRadiusPercent',
        areaPerStack: areaEntry.values[0],
        baseRadius: radiusEntry.values[0],
      })
    }
  }

  if (statBonuses.length === 0 && tooltipVars.length === 0 && formulaVars.length === 0) return null

  return {
    id: 'passive',
    scope: 'passive',
    label: String(p.name ?? 'Passive'),
    maxStacks: 9999,
    statBonuses,
    tooltipVars,
    ...(formulaVars.length > 0 ? { formulaVars } : {}),
  }
}

interface BardChimeBreakpoint {
  chimes: number
  slow: number
  maxMeeps: number
  rechargeTime: number
}

const BARD_CHIME_BREAKPOINTS: BardChimeBreakpoint[] = [
  { chimes: 0, slow: 0, maxMeeps: 1, rechargeTime: 8 },
  { chimes: 5, slow: 25, maxMeeps: 1, rechargeTime: 8 },
  { chimes: 10, slow: 25, maxMeeps: 2, rechargeTime: 8 },
  { chimes: 15, slow: 25, maxMeeps: 2, rechargeTime: 8 },
  { chimes: 20, slow: 25, maxMeeps: 2, rechargeTime: 7 },
  { chimes: 25, slow: 35, maxMeeps: 2, rechargeTime: 7 },
  { chimes: 30, slow: 35, maxMeeps: 3, rechargeTime: 7 },
  { chimes: 35, slow: 35, maxMeeps: 3, rechargeTime: 7 },
  { chimes: 40, slow: 35, maxMeeps: 3, rechargeTime: 6 },
  { chimes: 45, slow: 45, maxMeeps: 3, rechargeTime: 6 },
  { chimes: 50, slow: 45, maxMeeps: 4, rechargeTime: 6 },
  { chimes: 55, slow: 45, maxMeeps: 4, rechargeTime: 5 },
  { chimes: 60, slow: 55, maxMeeps: 4, rechargeTime: 5 },
  { chimes: 65, slow: 55, maxMeeps: 5, rechargeTime: 5 },
  { chimes: 70, slow: 55, maxMeeps: 5, rechargeTime: 4 },
  { chimes: 75, slow: 65, maxMeeps: 5, rechargeTime: 4 },
  { chimes: 80, slow: 65, maxMeeps: 6, rechargeTime: 4 },
  { chimes: 85, slow: 75, maxMeeps: 6, rechargeTime: 4 },
  { chimes: 90, slow: 75, maxMeeps: 7, rechargeTime: 4 },
  { chimes: 95, slow: 75, maxMeeps: 8, rechargeTime: 4 },
  { chimes: 100, slow: 75, maxMeeps: 9, rechargeTime: 4 },
]

function bardMeepBaseDamage(chimes: number): number {
  return 35 + Math.floor(chimes / 5) * 10
}

function bardBreakpointAt(chimes: number): BardChimeBreakpoint {
  let best = BARD_CHIME_BREAKPOINTS[0]
  for (const bp of BARD_CHIME_BREAKPOINTS) {
    if (bp.chimes <= chimes) best = bp
    else break
  }
  return best
}

function bardChimesUntilNext(chimes: number): { chimesNeeded: number; nextDamageBonus: number } {
  const nextThreshold = (Math.floor(chimes / 5) + 1) * 5
  return { chimesNeeded: nextThreshold - chimes, nextDamageBonus: 10 }
}

export function computeBardChimeTooltipVars(
  chimes: number,
  formatNumber: (value: number) => string
): Record<string, string> {
  const bp = bardBreakpointAt(chimes)
  const { chimesNeeded, nextDamageBonus } = bardChimesUntilNext(chimes)
  return {
    f1: formatNumber(bardMeepBaseDamage(chimes)),
    f2: formatNumber(bp.slow),
    f3: formatNumber(1),
    f4: formatNumber(bp.maxMeeps),
    f5: formatNumber(bp.rechargeTime),
    f7: formatNumber(chimesNeeded),
    f10: formatNumber(chimes),
    f11: formatNumber(nextDamageBonus),
  }
}

function hardcodedPassiveStackDefinition(
  champion: Record<string, unknown> | null | undefined
): TheorycraftStackDefinition | null {
  const id = String(champion?.id ?? '')
  if (id === 'Bard') {
    return {
      id: 'passive',
      scope: 'passive',
      label: String(
        (champion?.passive as { name?: string } | undefined)?.name ?? 'Instinct du voyageur'
      ),
      maxStacks: 9999,
      statBonuses: [],
      tooltipVars: [],
      customVarsChampionId: 'Bard',
    }
  }
  return null
}

function inferStackDefinitionsFromChampion(
  champion: Record<string, unknown> | null | undefined
): TheorycraftStackDefinition[] {
  const spells = Array.isArray(champion?.spells) ? champion.spells : []
  const inferred: TheorycraftStackDefinition[] = []

  const hardcoded = hardcodedPassiveStackDefinition(champion)
  if (hardcoded) {
    inferred.push(hardcoded)
  } else {
    const passiveDef = inferPassiveStackDefinition(champion)
    if (passiveDef) inferred.push(passiveDef)
  }

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
  if (passive && typeof passive === 'object') {
    const passiveCalcs = Array.isArray((passive as { calculations?: unknown }).calculations)
      ? [...(passive as { calculations: TheorycraftSpellCalculation[] }).calculations]
      : []
    const passiveDvs = (passive as { dataValues?: Array<{ name: string; values: number[] }> })
      .dataValues
    for (const dv of passiveDvs ?? []) {
      if (!/perstack$/i.test(String(dv.name))) continue
      if (!dv.values?.length) continue
      if (passiveCalcs.some(c => c.key.toLowerCase() === dv.name.toLowerCase())) continue
      passiveCalcs.push({ key: dv.name, baseValues: dv.values, ratios: [] })
    }
    if (passiveCalcs.length > 0) bySource.passive = passiveCalcs
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

  if (definition.customVarsChampionId === 'Bard') {
    const vars = computeBardChimeTooltipVars(safeStacks, formatNumber)
    for (const [key, value] of Object.entries(vars)) {
      setVar(key, value)
    }
    return
  }

  if (!definition.tooltipVars.some(v => v.key.toLowerCase() === 'f1')) {
    setVar('f1', formatNumber(safeStacks))
  }

  for (const tooltipVar of definition.tooltipVars) {
    const perStack = perStackValue(calculations, tooltipVar.perStackKey, rankIndex)
    setVar(tooltipVar.key, formatNumber(perStack * safeStacks))
  }

  for (const fVar of definition.formulaVars ?? []) {
    if (fVar.formula === 'areaToRadiusPercent') {
      const baseArea = fVar.baseRadius * fVar.baseRadius * Math.PI
      const newRadius = Math.sqrt((baseArea + fVar.areaPerStack * safeStacks) / Math.PI)
      const pct = (newRadius / fVar.baseRadius - 1) * 100
      setVar(fVar.key, formatNumber(Math.round(pct * 10) / 10))
    }
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
