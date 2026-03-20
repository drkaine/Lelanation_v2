/**
 * Framework-agnostic image URL helpers.
 * A `baseUrl` is provided by the consumer (app adapter) so the core stays free from
 * any assumption about hosting (Nuxt static vs remote API).
 */

export type ImageBaseProvider = () => string

let _getBase: ImageBaseProvider = () => ''

export function setImageBase(provider: ImageBaseProvider): void {
  _getBase = provider
}

function base(): string {
  return _getBase()
}

export function getChampionImageUrl(_version: string, imageName: string): string {
  return `${base()}/champion/${imageName}`
}

export function getItemImageUrl(_version: string, imageName: string): string {
  return `${base()}/item/${imageName}`
}

export function getSpellImageUrl(_version: string, imageName: string): string {
  return `${base()}/spell/${imageName}`
}

export function getChampionSpellImageUrl(
  _version: string,
  championId: string,
  imageName: string
): string {
  return `${base()}/champion-spell/${championId}/${imageName}`
}

export function getChampionPassiveImageUrl(_version: string, imageName: string): string {
  return `${base()}/champion-spell/passive/${imageName}`
}

export function getRunePathImageUrl(_version: string, icon: string): string {
  const iconLower = (icon ?? '').toLowerCase()
  if (iconLower.includes('domination') || iconLower.includes('8100')) return `${base()}/rune/paths/domination_icon.svg`
  if (iconLower.includes('inspiration') || iconLower.includes('whimsy') || iconLower.includes('8300')) return `${base()}/rune/paths/inspiration_icon.svg`
  if (iconLower.includes('precision') || iconLower.includes('8000')) return `${base()}/rune/paths/precision_icon.svg`
  if (iconLower.includes('resolve') || iconLower.includes('8400')) return `${base()}/rune/paths/resolve_icon.svg`
  if (iconLower.includes('sorcery') || iconLower.includes('8200')) return `${base()}/rune/paths/sorcery_icon.svg`
  const filename = icon.split('/').pop() || icon
  return `${base()}/rune/paths/${filename}`
}

export function getRuneImageUrl(_version: string, icon: string): string {
  const filename = icon.split('/').pop() || icon
  return `${base()}/rune/runes/${filename}`
}
