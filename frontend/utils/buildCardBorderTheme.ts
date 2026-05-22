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

export function buildCardBorderCssVars(
  colors: [string, string] = DEFAULT_BUILD_CARD_REGION_COLORS
): CSSProperties {
  const [primaryColor, secondaryColor] = colors
  const midColor = mixHexColors(primaryColor, secondaryColor, 0.4)
  return {
    '--card-border-color': primaryColor,
    '--card-border-color-soft': hexToRgba(primaryColor, 0.45),
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
