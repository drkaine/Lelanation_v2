import { getStaticImageUrl } from './staticDataUrl.js'
import { getFallbackGameVersion } from '~/config/version'

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
 * Get champion image URL (local)
 */
export function getChampionImageUrl(_version: string, imageName: string): string {
  if (!imageName) return ''
  // Use local images instead of Data Dragon
  return `/images/game/latest/champion/${imageName}`
}

/** Kayn transformation HUD squares (Community Dragon cron). */
export function getKaynHudImageUrl(form: 'slay' | 'ass'): string {
  return `/images/game/latest/champion/kayn_${form}_square.png`
}

/**
 * Get champion splash image URL (base skin 0).
 * Stored as: /images/game/{version}/champion/splash_{ChampionId}.jpg
 */
export function getChampionSplashImageUrl(_version: string, championId: string): string {
  if (!championId) return ''
  // Use local images instead of Data Dragon (skin 0 stored as splash_{ChampionId}.jpg)
  return `/images/game/latest/champion/splash_${championId}.jpg`
}

/**
 * Data Dragon fallback when a local item PNG is missing (new patch items).
 */
export function getDdragonItemImageUrl(version: string, imageName: string): string {
  if (!imageName) return ''
  const id = imageName.replace(/\.png$/i, '')
  const patch =
    version && version !== 'latest' && /^\d+\.\d+\.\d+$/.test(version)
      ? version
      : getFallbackGameVersion()
  return `https://ddragon.leagueoflegends.com/cdn/${patch}/img/item/${id}.png`
}

/**
 * Get item image URL (local)
 */
export function getItemImageUrl(_version: string, imageName: string): string {
  if (!imageName) return ''
  // Use local images instead of Data Dragon
  return `/images/game/latest/item/${imageName}`
}

/** Swap to Data Dragon when the local static asset 404s. */
export function handleGameItemImageError(event: Event, version: string, imageName: string) {
  const img = event.target as HTMLImageElement | null
  if (!img || !imageName) return
  const fallback = getDdragonItemImageUrl(version, imageName)
  if (fallback && !img.src.includes('ddragon.leagueoflegends.com')) {
    img.src = fallback
  }
}

/**
 * Get summoner spell image URL (local)
 */
export function getSpellImageUrl(_version: string, imageName: string): string {
  if (!imageName) return ''
  // Use local images instead of Data Dragon
  return `/images/game/latest/spell/${imageName}`
}

/**
 * Folder segment for champion spell images (Data Dragon `id`, e.g. `Senna`, not numeric key).
 */
export function championSpellImageFolder(
  championSlug: string | null | undefined,
  championNumericId?: number | string | null
): string {
  const slug = String(championSlug ?? '').trim()
  if (slug) return slug
  return String(championNumericId ?? '').trim()
}

/**
 * Get champion spell image URL (local)
 * Stored as: /images/game/latest/champion-spell/{ChampionId}/{SpellImage}.png
 */
export function getChampionSpellImageUrl(
  _version: string,
  championFolder: string,
  imageName: string
): string {
  if (!imageName || !championFolder) return ''
  if (imageName.includes('/')) {
    return `/images/game/latest/champion-spell/${imageName}`
  }
  return getImageUrl('champion-spell', 'latest', imageName, championFolder)
}

/** Resolve spell image URL using slug when available (stats pages pass numeric id + slug). */
export function resolveChampionSpellImageUrl(
  version: string,
  opts: { slug?: string | null; numericId?: number | string | null },
  imageName: string
): string {
  const folder = championSpellImageFolder(opts.slug, opts.numericId)
  if (!folder || !imageName) return ''
  return getChampionSpellImageUrl(version, folder, imageName)
}

/**
 * Get champion passive image URL (local)
 * Stored as: /images/game/latest/champion-spell/passive/{PassiveImage}.png
 */
export function getChampionPassiveImageUrl(_version: string, imageName: string): string {
  if (!imageName) return ''
  return getImageUrl('champion-spell', 'latest', imageName, 'passive')
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

/** Colored rune path icon (mask + path color), same as RuneSelector / BuildCard sheet. */
export function getRunePathMaskStyle(
  version: string,
  icon: string,
  pathId?: number | null,
  pathName?: string | null
): Record<string, string> {
  const maskUrl = getRunePathImageUrl(version, icon, pathId, pathName)
  return {
    backgroundColor: getRunePathColor(icon, pathId, pathName),
    WebkitMaskImage: `url(${maskUrl})`,
    maskImage: `url(${maskUrl})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  }
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
