/** Couleurs des chips de tag : celles des régions (`public/data/regions.json`, bords des cartes). */
export const BUILD_TAG_REGION = {
  pro: 'demacia',
  otp: 'freljord',
  exotique: 'void',
  troll: 'ionia',
  notes: 'bandle',
  lelariva: 'shadow_isles',
  guide: 'noxus',
} as const

export const BUILD_TAG_COLORS = {
  pro: ['#dbdbdb', '#C8AA6E'],
  otp: ['#00b4dd', '#003366'],
  exotique: ['#6e008a', '#420042'],
  troll: ['#e4b5e4', '#36bfb1'],
  notes: ['#d396d3', '#008200'],
  lelariva: ['#00d1a7', '#00261f'],
  guide: ['#790000', '#240101'],
} as const satisfies Record<keyof typeof BUILD_TAG_REGION, readonly [string, string]>

export type BuildTagColorId = keyof typeof BUILD_TAG_COLORS

export function buildTagChipStyle(id: BuildTagColorId): Record<'--tag-g1' | '--tag-g2', string> {
  const [g1, g2] = BUILD_TAG_COLORS[id]
  return { '--tag-g1': g1, '--tag-g2': g2 }
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Dégradé clair (Demacia, Ionia) : texte sombre pour rester lisible. */
export function buildTagUsesDarkText(id: string): boolean {
  const colors = BUILD_TAG_COLORS[id as BuildTagColorId]
  if (!colors) return false
  return (luminance(colors[0]) + luminance(colors[1])) / 2 > 0.6
}
