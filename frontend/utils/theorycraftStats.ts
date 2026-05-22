import type { CalculatedStats, Champion, ChampionStats } from '@lelanation/shared-types'
import type { TheorycraftBuildStats } from '~/types/theorycraft'

type TheorycraftChampionExport = Champion & {
  baseStats?: {
    hp?: number
    hpRegen?: number
    mp?: number
    mpRegen?: number
    armor?: number
    magicResist?: number
    attackDamage?: number
    attackSpeed?: number
    attackRange?: number
    movespeed?: number
  }
  growthStats?: {
    hp?: number
    hpRegen?: number
    mp?: number
    mpRegen?: number
    armor?: number
    magicResist?: number
    attackDamage?: number
    attackSpeed?: number
  }
}

export const DEFAULT_MAX_CHAMPION_LEVEL = 18
export const TOP_MAX_CHAMPION_LEVEL = 21

export function maxChampionLevelForRoles(roles: readonly string[] | null | undefined): number {
  return roles?.includes('top') ? TOP_MAX_CHAMPION_LEVEL : DEFAULT_MAX_CHAMPION_LEVEL
}

export function clampChampionLevel(
  level: number,
  roles: readonly string[] | null | undefined
): number {
  const maxLevel = maxChampionLevelForRoles(roles)
  return Math.min(maxLevel, Math.max(1, Math.trunc(level)))
}

function safeNumber(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function hasDdragonStats(stats: ChampionStats | null | undefined): boolean {
  return stats != null && Number.isFinite(stats.hp) && Number.isFinite(stats.attackdamage)
}

export function theorycraftExportToChampionStats(
  baseStats: TheorycraftChampionExport['baseStats'],
  growthStats: TheorycraftChampionExport['growthStats']
): ChampionStats | null {
  if (!baseStats || !growthStats) return null
  return {
    hp: safeNumber(baseStats.hp),
    hpperlevel: safeNumber(growthStats.hp),
    mp: safeNumber(baseStats.mp),
    mpperlevel: safeNumber(growthStats.mp),
    armor: safeNumber(baseStats.armor),
    armorperlevel: safeNumber(growthStats.armor),
    spellblock: safeNumber(baseStats.magicResist),
    spellblockperlevel: safeNumber(growthStats.magicResist),
    attackdamage: safeNumber(baseStats.attackDamage),
    attackdamageperlevel: safeNumber(growthStats.attackDamage),
    attackspeed: safeNumber(baseStats.attackSpeed),
    attackspeedperlevel: safeNumber(growthStats.attackSpeed),
    movespeed: safeNumber(baseStats.movespeed),
    attackrange: safeNumber(baseStats.attackRange),
    hpregen: safeNumber(baseStats.hpRegen),
    hpregenperlevel: safeNumber(growthStats.hpRegen),
    mpregen: safeNumber(baseStats.mpRegen),
    mpregenperlevel: safeNumber(growthStats.mpRegen),
    crit: 0,
    critperlevel: 0,
  }
}

export function resolveChampionStatsForBuild(
  champion: Champion | null | undefined
): ChampionStats | null {
  if (!champion) return null
  if (hasDdragonStats(champion.stats)) return champion.stats

  const exported = champion as TheorycraftChampionExport
  return theorycraftExportToChampionStats(exported.baseStats, exported.growthStats)
}

export function championWithStatsForBuild(champion: Champion): Champion {
  const stats = resolveChampionStatsForBuild(champion)
  if (!stats) return champion
  return { ...champion, stats }
}

function baseAdAtLevel(champion: Champion, level: number): number {
  const stats = resolveChampionStatsForBuild(champion)
  if (!stats) return 0
  const safe = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const levelMultiplier = Math.max(0, level - 1)
  return safe(stats.attackdamage) + safe(stats.attackdamageperlevel) * levelMultiplier
}

export function baseHpAtLevel(champion: Champion, level: number): number {
  const stats = resolveChampionStatsForBuild(champion)
  if (!stats) return 0
  const safe = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const levelMultiplier = Math.max(0, level - 1)
  return safe(stats.hp) + safe(stats.hpperlevel) * levelMultiplier
}

export function passiveRankForChampionLevel(level: number): number {
  const thresholds = [1, 5, 9, 13, 17]
  let rank = 1
  for (let i = 1; i < thresholds.length; i += 1) {
    if (level >= thresholds[i]!) rank = i + 1
  }
  return rank
}

export function applyCooldownReductionToSeconds(
  baseSeconds: number,
  cooldownReduction: number
): number {
  if (!Number.isFinite(baseSeconds) || baseSeconds <= 0) return baseSeconds
  const cdr = Math.max(0, Math.min(0.99, cooldownReduction))
  if (cdr <= 0) return baseSeconds
  return baseSeconds * (1 - cdr)
}

export type ChampionResourceKind = 'none' | 'mana' | 'energy' | 'other'

export function normalizeChampionPartype(partype: string | undefined | null): string {
  return String(partype ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function resolveChampionResourceKind(
  partype: string | undefined | null
): ChampionResourceKind {
  const normalized = normalizeChampionPartype(partype)
  if (!normalized || normalized === 'none' || normalized === 'aucune') return 'none'
  if (normalized === 'energy' || normalized === 'energie') return 'energy'
  if (normalized === 'mana') return 'mana'
  return 'other'
}

export function formatStatPoolValue(current: number, max: number, decimals = 0): string {
  const format = (value: number) => {
    if (!Number.isFinite(value)) return '0'
    const factor = 10 ** decimals
    return String(Math.round(value * factor) / factor)
  }
  return `${format(current)}/${format(max)}`
}

export function formatHealthPoolValue(totalHealth: number): string {
  const value = Math.max(0, totalHealth)
  return formatStatPoolValue(value, value)
}

export function formatResourcePoolValue(
  resourcePool: number,
  partype: string | undefined | null
): string {
  if (resolveChampionResourceKind(partype) === 'none') {
    return formatStatPoolValue(0, 0)
  }
  const max = Math.max(0, resourcePool)
  return formatStatPoolValue(max, max)
}

const RESOURCE_LABEL_BY_PARTYPE: Record<string, { fr: string; en: string }> = {
  mana: { fr: 'Mana', en: 'Mana' },
  energy: { fr: 'Énergie', en: 'Energy' },
  energie: { fr: 'Énergie', en: 'Energy' },
  fury: { fr: 'Fureur', en: 'Fury' },
  rage: { fr: 'Rage', en: 'Rage' },
  ferocity: { fr: 'Férocité', en: 'Ferocity' },
  heat: { fr: 'Chaleur', en: 'Heat' },
  flow: { fr: 'Flux', en: 'Flow' },
  courage: { fr: 'Courage', en: 'Courage' },
  bloodwell: { fr: 'Puits de sang', en: 'Blood Well' },
  runicpower: { fr: 'Puissance runique', en: 'Runic Power' },
  gnarfury: { fr: 'Fureur', en: 'Fury' },
  shields: { fr: 'Bouclier', en: 'Shield' },
  wind: { fr: 'Vents', en: 'Wind' },
}

export function resolveResourceStatLabel(
  partype: string | undefined | null,
  locale: 'fr' | 'en'
): string {
  const kind = resolveChampionResourceKind(partype)
  if (kind === 'energy') return RESOURCE_LABEL_BY_PARTYPE.energy![locale]
  if (kind === 'mana' || kind === 'none') return RESOURCE_LABEL_BY_PARTYPE.mana![locale]

  const normalized = normalizeChampionPartype(partype)
  const mapped = RESOURCE_LABEL_BY_PARTYPE[normalized]
  if (mapped) return mapped[locale]

  const raw = String(partype ?? '').trim()
  return raw || RESOURCE_LABEL_BY_PARTYPE.mana![locale]
}

function parseNumericStatValue(text: string): number | null {
  const normalized = String(text ?? '')
    .trim()
    .replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export function formatCooldownSeconds(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

export function resolveHeaderStatAtRank(
  stat: { key: string; label: string; valueText: string; valueHtml?: string },
  rank: number,
  options?: { cooldownReduction?: number }
): { key: string; label: string; valueText: string; valueHtml?: string } {
  const text = String(stat.valueText ?? '').trim()
  let valueText = text
  let valueHtml = stat.valueHtml

  if (text.includes('/')) {
    const parts = text
      .split('/')
      .map(part => part.trim())
      .filter(Boolean)
    if (parts.length > 1) {
      const idx = Math.min(Math.max(rank - 1, 0), parts.length - 1)
      valueText = parts[idx] ?? text
      valueHtml = undefined
    }
  }

  if (stat.key !== 'cooldown') {
    return valueText === text && valueHtml === stat.valueHtml
      ? stat
      : { ...stat, valueText, valueHtml }
  }

  const cdr = options?.cooldownReduction ?? 0
  if (cdr <= 0) {
    return valueText === text && valueHtml === stat.valueHtml
      ? stat
      : { ...stat, valueText, valueHtml }
  }

  const baseCooldown = parseNumericStatValue(valueText)
  if (baseCooldown == null || baseCooldown <= 0) {
    return valueText === text && valueHtml === stat.valueHtml
      ? stat
      : { ...stat, valueText, valueHtml }
  }

  return {
    ...stat,
    valueText: formatCooldownSeconds(applyCooldownReductionToSeconds(baseCooldown, cdr)),
    valueHtml: undefined,
  }
}

export function toTheorycraftBuildStats(
  calculated: CalculatedStats,
  champion: Champion,
  level: number
): TheorycraftBuildStats {
  const baseAd = baseAdAtLevel(champion, level)
  const baseHp = baseHpAtLevel(champion, level)
  const totalAd = calculated.attackDamage
  const bonusAd = Math.max(0, totalAd - baseAd)

  return {
    level,
    totalAD: totalAd,
    bonusAD: bonusAd,
    AP: calculated.abilityPower,
    totalHP: calculated.health,
    bonusHP: Math.max(0, calculated.health - baseHp),
    armor: calculated.armor,
    magicResist: calculated.magicResist,
    maxMana: calculated.mana,
    critChance: calculated.critChance,
    critDamage: calculated.critDamage,
    cooldownReduction: calculated.cooldownReduction ?? 0,
  }
}
