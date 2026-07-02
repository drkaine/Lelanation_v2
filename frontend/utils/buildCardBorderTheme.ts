import type { CSSProperties } from 'vue'

export const DEFAULT_BUILD_CARD_REGION_COLORS: [string, string] = ['#BBA077', '#1E2328']

export interface BuildCardRegionsPayload {
  regionsData: Record<string, [string, string]>
  championMapping: Record<string, string>
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '').trim()
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map(ch => ch + ch)
          .join('')
      : normalized
  return [
    parseInt(fullHex.slice(0, 2), 16),
    parseInt(fullHex.slice(2, 4), 16),
    parseInt(fullHex.slice(4, 6), 16),
  ]
}

export function mixHexColors(a: string, b: string, weightA = 0.5): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const wa = Math.max(0, Math.min(1, weightA))
  const wb = 1 - wa
  const r = Math.round(ar * wa + br * wb)
  const g = Math.round(ag * wa + bg * wb)
  const bCh = Math.round(ab * wa + bb * wb)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bCh.toString(16).padStart(2, '0')}`
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(value => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Card/link hover glow — tuned per region palette for visibility on dark card surfaces. */
export function buildCardHoverShadow(primaryColor: string, secondaryColor: string): string {
  const primaryLum = relativeLuminance(primaryColor)
  const layers: string[] = []

  if (primaryLum < 0.18) {
    const glowColor = mixHexColors(primaryColor, secondaryColor, 0.22)
    layers.push(
      `0 0 0 1px ${hexToRgba(glowColor, 0.78)}`,
      `0 4px 22px ${hexToRgba(glowColor, 0.95)}`,
      `0 0 16px ${hexToRgba(secondaryColor, 0.72)}`
    )
  } else if (primaryLum > 0.52) {
    const glowColor = mixHexColors(primaryColor, secondaryColor, 0.38)
    layers.push(
      `0 0 0 1px ${hexToRgba(mixHexColors(primaryColor, '#0a1428', 0.22), 0.42)}`,
      `0 4px 22px ${hexToRgba(glowColor, 0.92)}`,
      `0 0 12px ${hexToRgba(primaryColor, 0.78)}`
    )
  } else {
    layers.push(
      `0 0 0 1px ${hexToRgba(primaryColor, 0.68)}`,
      `0 4px 20px ${hexToRgba(primaryColor, 0.84)}`
    )
  }

  return layers.join(', ')
}

/** Region selection ring on build-card sections (builder / guide create). */
export function buildCardRegionHoverRing(primaryColor: string, secondaryColor: string): string {
  const primaryLum = relativeLuminance(primaryColor)
  const ringColor =
    primaryLum < 0.18
      ? mixHexColors(secondaryColor, '#c89b3c', 0.42)
      : primaryLum > 0.52
        ? mixHexColors(primaryColor, '#0a1428', 0.28)
        : primaryColor
  const alpha = primaryLum < 0.18 ? 0.95 : primaryLum > 0.52 ? 0.82 : 0.88
  return `0 0 0 2px ${hexToRgba(ringColor, alpha)}`
}

export function buildCardBorderCssVars(
  colors: [string, string] = DEFAULT_BUILD_CARD_REGION_COLORS
): CSSProperties {
  const [primaryColor, secondaryColor] = colors
  const midColor = mixHexColors(primaryColor, secondaryColor, 0.4)
  return {
    '--card-border-color': primaryColor,
    '--card-border-color-soft': hexToRgba(primaryColor, 0.45),
    '--card-border-hover-shadow': buildCardHoverShadow(primaryColor, secondaryColor),
    '--card-region-hover-ring': buildCardRegionHoverRing(primaryColor, secondaryColor),
    '--card-border-gradient-strong': `linear-gradient(130deg, ${primaryColor} 0%, ${midColor} 45%, ${secondaryColor} 100%)`,
    '--card-border-gradient-soft': `linear-gradient(130deg, ${hexToRgba(primaryColor, 0.7)} 0%, ${hexToRgba(midColor, 0.72)} 45%, ${hexToRgba(secondaryColor, 0.82)} 100%)`,
  }
}

let regionsPayloadPromise: Promise<BuildCardRegionsPayload | null> | null = null

export function loadBuildCardRegionsPayload(): Promise<BuildCardRegionsPayload | null> {
  if (!import.meta.client) return Promise.resolve(null)
  if (!regionsPayloadPromise) {
    regionsPayloadPromise = $fetch<BuildCardRegionsPayload>('/data/regions.json').catch(() => null)
  }
  return regionsPayloadPromise
}

export function resolveRegionColorsForChampion(
  championId: string | null | undefined,
  payload: BuildCardRegionsPayload | null
): [string, string] {
  if (!championId) return DEFAULT_BUILD_CARD_REGION_COLORS
  if (!payload) return DEFAULT_BUILD_CARD_REGION_COLORS
  const regionKey = payload.championMapping[championId]
  const palette = regionKey ? payload.regionsData[regionKey] : undefined
  return palette ?? DEFAULT_BUILD_CARD_REGION_COLORS
}
