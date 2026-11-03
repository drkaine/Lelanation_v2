/** Onglets de la bibliothèque des sheets matchup (l'onglet discover a été retiré). */
export type MatchupSheetsTab = 'my-guides' | 'favoris'

export const MATCHUP_SHEETS_TABS: readonly MatchupSheetsTab[] = ['my-guides', 'favoris']

export function matchupSheetsTabPath(tab: MatchupSheetsTab): string {
  return `/matchups/sheets/${tab}`
}

export const MATCHUP_SHEETS_DEFAULT_PATH = matchupSheetsTabPath('my-guides')

export function matchupSheetsTabFromPath(path: string): MatchupSheetsTab | undefined {
  if (path.endsWith('/matchups/sheets/favoris')) return 'favoris'
  if (path.endsWith('/matchups/sheets/my-guides') || path.endsWith('/matchups/sheets')) {
    return 'my-guides'
  }
  return undefined
}
