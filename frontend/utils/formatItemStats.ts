/**
 * Format item stats for display (stats page, tooltips, etc.).
 * Same stats as in build infos: AD, AP, lethality, armor pen, etc.
 * Lethality: "(X - Y%)" when both flat and percent exist.
 */
import type { ItemStats } from '@lelanation/shared-types'
import { calculateItemGoldEfficiency } from '@lelanation/builds-stats'

type StatRecord = Record<string, number | undefined>

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
export function formatItemStatsForDisplay(stats: ItemStats | undefined): string[] {
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
  add("Vitesse d'attaque", s.PercentAttackSpeedMod ?? 0, '%', 1)
  add('Critique', s.FlatCritChanceMod ?? 0, '%', 1)
  add('Vol de vie', s.PercentLifeStealMod ?? 0, '%', 1)
  add('Omnivamp', ((s.FlatOmnivamp ?? 0) + (s.PercentOmnivamp ?? 0)) as number, '%', 1)
  add('Vitesse déplacement (flat)', s.FlatMovementSpeedMod ?? 0)
  add('Vitesse déplacement', s.PercentMovementSpeedMod ?? 0, '%', 1)
  add('Régénération PV', s.FlatHPRegenMod ?? 0, '', 1)
  add('Régénération mana', s.FlatMPRegenMod ?? 0, '', 1)
  add('Pénétration armure', ((s.rPercentArmorPenetrationMod ?? 0) * 100) as number, '%', 1)
  add('Pénétration magique', ((s.rPercentSpellPenetrationMod ?? 0) * 100) as number, '%', 1)
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

/**
 * Format economic stats for an item: price, sell value, gold efficiency.
 * Returns e.g. ["Prix: 3000", "Revente: 2100", "Efficacité or: 98%"].
 */
export function formatItemEconomicForDisplay(item: ItemWithGold | undefined): string[] {
  if (!item?.gold?.total) return []
  const rows: string[] = []
  rows.push(`Prix: ${item.gold.total}`)
  if (item.gold.sell != null) rows.push(`Revente: ${item.gold.sell}`)
  const eff = calculateItemGoldEfficiency(item)
  if (eff != null && Number.isFinite(eff)) rows.push(`Efficacité or: ${eff.toFixed(0)}%`)
  return rows
}
