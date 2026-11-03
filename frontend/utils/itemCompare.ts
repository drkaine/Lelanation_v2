import type { Item } from '@lelanation/shared-types'
import {
  getItemGoldEfficiency,
  getItemGoldValue,
  getLethalityFromStats,
} from '~/utils/formatItemStats'

type StatRecord = Record<string, number | undefined>

export interface ItemCompareValue<T = number> {
  a: T
  b: T
  diff: T
}

export interface ItemCompareStatRow {
  /** Clé i18n sous `itemShopPage.compare.stats`. */
  id: string
  a: number
  b: number
  diff: number
  percent: boolean
}

export interface ItemCompareResult {
  price: ItemCompareValue
  goldValue: ItemCompareValue
  efficiency: ItemCompareValue<number | null>
  stats: ItemCompareStatRow[]
  components: { shared: string[]; onlyA: string[]; onlyB: string[] }
}

function percent(value: number | undefined): number {
  const raw = value ?? 0
  if (!Number.isFinite(raw)) return 0
  return Math.abs(raw) <= 1 ? raw * 100 : raw
}

const STATS: { id: string; percent?: boolean; read: (s: StatRecord) => number }[] = [
  { id: 'hp', read: s => s.FlatHPPoolMod ?? 0 },
  { id: 'mana', read: s => s.FlatMPPoolMod ?? 0 },
  { id: 'ad', read: s => s.FlatPhysicalDamageMod ?? 0 },
  { id: 'ap', read: s => s.FlatMagicDamageMod ?? 0 },
  { id: 'armor', read: s => s.FlatArmorMod ?? 0 },
  { id: 'magicResist', read: s => s.FlatSpellBlockMod ?? 0 },
  { id: 'attackSpeed', percent: true, read: s => percent(s.PercentAttackSpeedMod) },
  { id: 'crit', percent: true, read: s => percent(s.FlatCritChanceMod) },
  { id: 'lifeSteal', percent: true, read: s => percent(s.PercentLifeStealMod) },
  { id: 'omnivamp', percent: true, read: s => (s.FlatOmnivamp ?? 0) + percent(s.PercentOmnivamp) },
  { id: 'haste', read: s => s.rFlatCooldownModPerLevel ?? 0 },
  { id: 'lethality', read: s => getLethalityFromStats(s).flat },
  { id: 'armorPen', percent: true, read: s => percent(s.rPercentArmorPenetrationMod) },
  { id: 'magicPen', read: s => s.rFlatSpellPenetrationMod ?? 0 },
  { id: 'magicPenPercent', percent: true, read: s => percent(s.rPercentSpellPenetrationMod) },
  { id: 'moveSpeed', read: s => s.FlatMovementSpeedMod ?? 0 },
  { id: 'moveSpeedPercent', percent: true, read: s => percent(s.PercentMovementSpeedMod) },
  { id: 'hpRegen', percent: true, read: s => percent(s.PercentHPRegenMod) },
  { id: 'manaRegen', percent: true, read: s => percent(s.PercentMPRegenMod) },
  { id: 'healShield', percent: true, read: s => percent(s.PercentHealShieldPower) },
  { id: 'tenacity', percent: true, read: s => percent(s.PercentTenacity) + (s.FlatTenacity ?? 0) },
]

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function diffComponents(a: string[], b: string[]): ItemCompareResult['components'] {
  const rest = [...b]
  const shared: string[] = []
  const onlyA: string[] = []
  for (const id of a) {
    const index = rest.indexOf(id)
    if (index >= 0) {
      shared.push(id)
      rest.splice(index, 1)
    } else onlyA.push(id)
  }
  return { shared, onlyA, onlyB: rest }
}

/** Comparaison de deux objets : écarts exprimés en B − A. */
export function compareItems(a: Item, b: Item): ItemCompareResult {
  const statsA = (a.stats ?? {}) as StatRecord
  const statsB = (b.stats ?? {}) as StatRecord
  const priceA = a.gold?.total ?? 0
  const priceB = b.gold?.total ?? 0
  const valueA = getItemGoldValue(a)
  const valueB = getItemGoldValue(b)
  const effA = getItemGoldEfficiency(a)
  const effB = getItemGoldEfficiency(b)
  const stats = STATS.map(stat => {
    const valA = round(stat.read(statsA))
    const valB = round(stat.read(statsB))
    return {
      id: stat.id,
      a: valA,
      b: valB,
      diff: round(valB - valA),
      percent: stat.percent === true,
    }
  }).filter(row => Math.abs(row.a) >= 0.01 || Math.abs(row.b) >= 0.01)
  return {
    price: { a: priceA, b: priceB, diff: priceB - priceA },
    goldValue: { a: valueA, b: valueB, diff: valueB - valueA },
    efficiency: { a: effA, b: effB, diff: effA == null || effB == null ? null : effB - effA },
    stats,
    components: diffComponents(a.from ?? [], b.from ?? []),
  }
}
