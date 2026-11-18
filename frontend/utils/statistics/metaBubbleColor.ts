import { tierChartColor } from '~/utils/tierChartColors'

/** Couleur des bulles du graphique méta : palette unique des tiers. */
export function metaBubbleColor(tier: string): string {
  return tierChartColor(tier)
}
