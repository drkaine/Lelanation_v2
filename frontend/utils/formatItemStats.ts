/**
 * Format item stats for display (stats page, tooltips, etc.).
 * Same stats as in build infos: AD, AP, lethality, armor pen, etc.
 * Lethality: "(X - Y%)" when both flat and percent exist.
 */
import type { Item, ItemStats } from '@lelanation/shared-types'
import {
  calculateItemGoldEfficiency,
  calculateItemGoldValue,
  getGoldPer10FromItem,
} from '@lelanation/builds-stats'

type StatRecord = Record<string, number | undefined>

function normalizePercentStat(value: number | undefined): number {
  const raw = value ?? 0
  if (!Number.isFinite(raw)) return 0
  return Math.abs(raw) <= 1 ? raw * 100 : raw
}

/** Armor / magic pen: "12.0% / 18" when both % and flat exist. */
export function formatPenetrationPercentFlat(percentOutOf100: number, flat: number): string {
  const hasPct = Number.isFinite(percentOutOf100) && Math.abs(percentOutOf100) >= 0.01
  const hasFlat = Number.isFinite(flat) && Math.abs(flat) >= 0.01
  if (hasPct && hasFlat) {
    return `${percentOutOf100.toFixed(1)}% / ${flat.toFixed(0)}`
  }
  if (hasPct) return `${percentOutOf100.toFixed(1)}%`
  if (hasFlat) return `${flat.toFixed(0)}`
  return ''
}

/** Format lethality: "X - Y%" when both flat and percent, else "X" or "Y%" */
export function formatLethality(flat: number, percent: number): string {
  const hasFlat = Number.isFinite(flat) && Math.abs(flat) >= 0.01
  const hasPercent = Number.isFinite(percent) && Math.abs(percent) >= 0.01
  if (hasFlat && hasPercent) {
    return `${Math.round(flat)} - ${(percent * 100).toFixed(1)}%`
  }
  if (hasFlat) return String(Math.round(flat))
  if (hasPercent) return `${(percent * 100).toFixed(1)}%`
  return ''
}

/** Extract lethality from item stats (flat + percent). Percent is 0-1 (e.g. 0.1 = 10%). */
export function getLethalityFromStats(stats: StatRecord): { flat: number; percent: number } {
  const flat = (stats.FlatLethality ?? stats.flatLethality ?? 0) as number
  const raw = (stats.rPercentLethalityMod ??
    stats.PercentLethalityMod ??
    stats.percentLethality ??
    0) as number
  const percent = raw <= 1 ? raw : raw / 100
  return { flat, percent }
}

/** Build display string for item stats (same as BuildCard infos). Returns array of "Label: value" */
export function formatItemStatsForDisplay(
  stats: ItemStats | undefined,
  item?: Item | null
): string[] {
  if (!stats) return []
  const s = stats as StatRecord
  const rows: string[] = []

  const add = (label: string, value: number, suffix = '', digits = 0) => {
    if (!Number.isFinite(value) || Math.abs(value) < 0.01) return
    rows.push(`${label}: +${value.toFixed(digits)}${suffix}`)
  }

  add('PV', s.FlatHPPoolMod ?? 0)
  add('Mana', s.FlatMPPoolMod ?? 0)
  add('AD', s.FlatPhysicalDamageMod ?? 0)
  add('AP', s.FlatMagicDamageMod ?? 0)
  add('Armure', s.FlatArmorMod ?? 0)
  add('RM', s.FlatSpellBlockMod ?? 0)
  add("Vitesse d'attaque", normalizePercentStat(s.PercentAttackSpeedMod), '%', 1)
  add('Critique', s.FlatCritChanceMod ?? 0, '%', 1)
  add('Dégâts critiques', s.FlatCritDamageMod ?? 0, '%', 1)
  add('Vol de vie', normalizePercentStat(s.PercentLifeStealMod), '%', 1)
  add(
    'Vol de sort',
    normalizePercentStat(
      s.PercentSpellVampMod ?? (s as { PercentSpellVamp?: number }).PercentSpellVamp
    ),
    '%',
    1
  )
  add(
    'Omnivamp',
    ((s.FlatOmnivamp ?? 0) + normalizePercentStat(s.PercentOmnivamp)) as number,
    '%',
    1
  )
  add('Vitesse déplacement (flat)', s.FlatMovementSpeedMod ?? 0)
  add('Vitesse déplacement', normalizePercentStat(s.PercentMovementSpeedMod), '%', 1)
  add('Régénération PV', s.FlatHPRegenMod ?? 0, '', 1)
  add('Régénération mana', s.FlatMPRegenMod ?? 0, '', 1)
  add('Régén. PV (% base)', normalizePercentStat(s.PercentHPRegenMod), '%', 1)
  add('Régén. mana (% base)', normalizePercentStat(s.PercentMPRegenMod), '%', 1)
  add('Soins & boucliers', normalizePercentStat(s.PercentHealShieldPower), '%', 1)
  add('PO / 10 s', item != null ? getGoldPer10FromItem(item) : (s.GoldPer10 ?? 0), '', 0)
  {
    const arPct = normalizePercentStat(s.rPercentArmorPenetrationMod)
    const arFlat = (s as Record<string, number>).rFlatArmorPenetrationMod ?? 0
    const arStr = formatPenetrationPercentFlat(arPct, arFlat)
    if (arStr) rows.push(`Pénétration armure (% / flat): +${arStr}`)
  }
  {
    const mpPct = normalizePercentStat(s.rPercentSpellPenetrationMod)
    const mpFlat = (s as Record<string, number>).rFlatSpellPenetrationMod ?? 0
    const mpStr = formatPenetrationPercentFlat(mpPct, mpFlat)
    if (mpStr) rows.push(`Pénétration magique (% / flat): +${mpStr}`)
  }
  add(
    'Ténacité',
    normalizePercentStat((s as Record<string, number | undefined>).PercentTenacity) +
      ((s as Record<string, number | undefined>).FlatTenacity ?? 0),
    '%',
    1
  )
  add('Hâte', s.rFlatCooldownModPerLevel ?? 0)

  const { flat: lethFlat, percent: lethPercent } = getLethalityFromStats(s)
  const lethStr = formatLethality(lethFlat, lethPercent)
  if (lethStr) rows.push(`Léthalité: +${lethStr}`)

  add('Portée', s.FlatAttackRangeMod ?? 0)

  return rows
}

/** Item with optional gold and stats (Data Dragon / ItemsStore shape). */
type ItemWithGold = {
  gold?: { total: number; base?: number; sell: number; purchasable?: boolean }
  stats?: Record<string, number | undefined>
}

/** Gold value of item stats (wiki reference prices via @lelanation/builds-stats). */
export function getItemGoldValue(item: ItemWithGold | undefined): number {
  return calculateItemGoldValue(item?.stats)
}

/** Gold efficiency of item stats vs price (%), or null when not computable. */
export function getItemGoldEfficiency(item: ItemWithGold | undefined): number | null {
  if (!item?.gold?.total) return null
  return calculateItemGoldEfficiency({
    stats: item.stats,
    gold: {
      total: item.gold.total,
      sell: item.gold.sell,
      base: item.gold.base ?? item.gold.total,
      purchasable: item.gold.purchasable ?? true,
    },
  })
}

/** Format gold efficiency for display (e.g. "98%"). */
export function formatItemGoldEfficiency(item: ItemWithGold | undefined): string {
  const eff = getItemGoldEfficiency(item)
  if (eff == null || !Number.isFinite(eff)) return '—'
  return `${Math.round(eff)}%`
}

/**
 * Format economic stats for an item: price, sell value, gold efficiency.
 * Returns e.g. ["Prix: 3000", "Revente: 2100", "Efficacité or: 98%"].
 */
export function formatItemEconomicForDisplay(item: ItemWithGold | undefined): string[] {
  if (!item?.gold?.total) return []
  const rows: string[] = []
  rows.push(`Prix: ${item.gold.total}`)
  if (item.gold.sell != null) rows.push(`Revente: ${item.gold.sell}`)
  const eff = calculateItemGoldEfficiency({
    ...item,
    gold: {
      total: item.gold.total,
      sell: item.gold.sell,
      base: item.gold.base ?? item.gold.total,
      purchasable: item.gold.purchasable ?? true,
    },
  })
  if (eff != null && Number.isFinite(eff)) rows.push(`Efficacité or: ${eff.toFixed(0)}%`)
  return rows
}
