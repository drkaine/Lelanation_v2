import { getStaticImageUrl } from './staticDataUrl.js'

/**
 * Generate local image URL for champions, items, spells, runes
 * Uses static files (served directly by Nuxt, no API call)
 * These are copied from backend to frontend/public during sync
 */
export function getImageUrl(
  type: 'champion' | 'item' | 'spell' | 'rune' | 'champion-spell',
  version: string,
  filename: string,
  subPath?: string
): string {
  // Use static files (served directly by Nuxt, no API call)
  // These are copied from backend to frontend/public during sync
  return getStaticImageUrl(version, type, filename, subPath)
}

/**
 * Get champion image URL
 */
export function getChampionImageUrl(version: string, imageName: string): string {
  if (!imageName) return ''
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${imageName}`
}

/**
 * Get champion splash image URL (base skin 0).
 * Stored as: /images/game/{version}/champion/splash_{ChampionId}.jpg
 */
export function getChampionSplashImageUrl(version: string, championId: string): string {
  if (!championId) return ''
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championId}_0.jpg`
}

/**
 * Get item image URL
 */
export function getItemImageUrl(version: string, imageName: string): string {
  if (!imageName) return ''
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${imageName}`
}

/**
 * Get summoner spell image URL
 */
export function getSpellImageUrl(version: string, imageName: string): string {
  if (!imageName) return ''
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${imageName}`
}

/**
 * Get champion spell image URL
 */
export function getChampionSpellImageUrl(
  version: string,
  _championId: string,
  imageName: string
): string {
  if (!imageName) return ''
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${imageName}`
}

/**
 * Get champion passive image URL
 */
export function getChampionPassiveImageUrl(version: string, imageName: string): string {
  if (!imageName) return ''
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${imageName}`
}

/**
 * Get rune path icon URL
 * Icon format: "perk-images/Styles/7200_Domination.png"
 * Stored as: /images/game/{version}/rune/paths/7200_Domination.png
 */
type RunePathRef = { icon: string; pathId?: number | null; pathName?: string | null }

function detectRunePathKind(
  ref: RunePathRef
): 'domination' | 'inspiration' | 'precision' | 'resolve' | 'sorcery' | null {
  const iconLower = (ref.icon ?? '').toLowerCase()
  const nameLower = (ref.pathName ?? '').toLowerCase()
  const id = Number(ref.pathId ?? 0)

  /** Fichiers client Riot du type perk-images/Styles/7204_Resolve.png (pas les IDs API 8xxx). */
  const style720 = iconLower.match(/(?:^|\/)(720[0-4])[_./]/)
  if (style720) {
    const n = style720[1]
    if (n === '7200') return 'domination'
    if (n === '7201') return 'precision'
    if (n === '7202') return 'sorcery'
    if (n === '7203') return 'inspiration'
    if (n === '7204') return 'resolve'
  }

  if (
    iconLower.includes('domination') ||
    nameLower.includes('domination') ||
    id === 8100 ||
    iconLower.includes('8100')
  )
    return 'domination'
  if (
    iconLower.includes('inspiration') ||
    iconLower.includes('whimsy') ||
    nameLower.includes('inspiration') ||
    nameLower.includes('whimsy') ||
    id === 8300 ||
    iconLower.includes('8300')
  )
    return 'inspiration'
  if (
    iconLower.includes('precision') ||
    nameLower.includes('precision') ||
    id === 8000 ||
    iconLower.includes('8000')
  )
    return 'precision'
  if (
    iconLower.includes('resolve') ||
    nameLower.includes('resolve') ||
    id === 8400 ||
    iconLower.includes('8400')
  )
    return 'resolve'
  if (
    iconLower.includes('sorcery') ||
    nameLower.includes('sorcery') ||
    id === 8200 ||
    iconLower.includes('8200')
  )
    return 'sorcery'
  return null
}

export function getRunePathImageUrl(
  version: string,
  icon: string,
  pathId?: number | null,
  pathName?: string | null
): string {
  const kind = detectRunePathKind({ icon, pathId, pathName })
  if (kind === 'domination') return getImageUrl('rune', version, 'domination_icon.svg', 'paths')
  if (kind === 'inspiration') return getImageUrl('rune', version, 'inspiration_icon.svg', 'paths')
  if (kind === 'precision') return getImageUrl('rune', version, 'precision_icon.svg', 'paths')
  if (kind === 'resolve') return getImageUrl('rune', version, 'resolve_icon.svg', 'paths')
  if (kind === 'sorcery') return getImageUrl('rune', version, 'sorcery_icon.svg', 'paths')
  // Fallback to local static files for unknown path formats.
  const filename = icon.split('/').pop() || icon
  return getImageUrl('rune', version, filename, 'paths')
}

export function getRunePathColor(
  icon: string,
  pathId?: number | null,
  pathName?: string | null
): string {
  const kind = detectRunePathKind({ icon, pathId, pathName })
  if (kind === 'domination') return '#dc2626'
  if (kind === 'inspiration') return '#38bdf8'
  if (kind === 'precision') return '#eab308'
  if (kind === 'resolve') return '#16a34a'
  if (kind === 'sorcery') return '#4f46e5'
  return '#eab308'
}

/**
 * Get rune icon URL
 * Icon format: "perk-images/Styles/Domination/Electrocute/Electrocute.png"
 * Stored as: /images/game/{version}/rune/runes/Electrocute.png
 */
export function getRuneImageUrl(version: string, icon: string): string {
  // Extract filename from icon path (e.g., "perk-images/Styles/Domination/Electrocute/Electrocute.png" -> "Electrocute.png")
  const filename = icon.split('/').pop() || icon
  return getImageUrl('rune', version, filename, 'runes')
}
