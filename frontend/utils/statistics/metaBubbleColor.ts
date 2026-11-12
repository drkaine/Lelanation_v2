/** Couleur des bulles du graphique meta (maquette : nuances d'or par tier). */
const COLORS: Record<string, string> = {
  'S+': '#c8aa6e',
  S: '#b59a5f',
  A: '#9a8a68',
  B: '#7f7562',
  C: '#6a655b',
  D: '#5b5a56',
  F: '#5b5a56',
}

export function metaBubbleColor(tier: string): string {
  return COLORS[tier] ?? '#5b5a56'
}
