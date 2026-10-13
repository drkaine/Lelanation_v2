/**
 * Présentation « grille par tier » de la tier list (alternative compacte au tableau détaillé).
 */

export const GRID_TIERS = ['S+', 'S', 'A', 'B', 'C', 'D'] as const
export type GridTier = (typeof GRID_TIERS)[number]

export type TierPresentation = 'grid' | 'table'

/** Présentation affichée sans `?display=` dans l'URL. */
export const DEFAULT_TIER_PRESENTATION: TierPresentation = 'grid'

export type TierGridRow = { championId: number; tier: string; rank: number }

export type TierGridGroup<R extends TierGridRow> = { tier: GridTier; rows: R[] }

export function isTierPresentation(value: unknown): value is TierPresentation {
  return value === 'grid' || value === 'table'
}

/** L'API renvoie « D » pour le plus bas ; « F » (ancienne légende) et inconnu → D. */
export function normalizeGridTier(tier: string): GridTier {
  const label = String(tier ?? '')
    .trim()
    .toUpperCase()
  return (GRID_TIERS as readonly string[]).includes(label) ? (label as GridTier) : 'D'
}

/** Lignes regroupées par tier (S+ → D), triées par rang ; tiers vides omis. */
export function groupRowsByTier<R extends TierGridRow>(rows: R[]): TierGridGroup<R>[] {
  return GRID_TIERS.map(tier => ({
    tier,
    rows: rows.filter(r => normalizeGridTier(r.tier) === tier).sort((a, b) => a.rank - b.rank),
  })).filter(group => group.rows.length > 0)
}

export function tierTokenClass(tier: string): string {
  return `tier-${normalizeGridTier(tier).toLowerCase().replace('+', '-plus')}`
}
