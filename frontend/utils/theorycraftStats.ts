import type { CalculatedStats, Champion } from '@lelanation/shared-types'
import type { TheorycraftBuildStats } from '~/types/theorycraft'

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

function baseAdAtLevel(champion: Champion, level: number): number {
  const stats = champion.stats
  if (!stats) return 0
  const safe = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const levelMultiplier = Math.max(0, level - 1)
  return safe(stats.attackdamage) + safe(stats.attackdamageperlevel) * levelMultiplier
}

function baseHpAtLevel(champion: Champion, level: number): number {
  const stats = champion.stats
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

export function resolveHeaderStatAtRank(
  stat: { key: string; label: string; valueText: string; valueHtml?: string },
  rank: number
): { key: string; label: string; valueText: string; valueHtml?: string } {
  const text = String(stat.valueText ?? '').trim()
  if (!text.includes('/')) return stat
  const parts = text
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
  if (parts.length <= 1) return stat
  const idx = Math.min(Math.max(rank - 1, 0), parts.length - 1)
  return {
    ...stat,
    valueText: parts[idx] ?? text,
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
  }
}
