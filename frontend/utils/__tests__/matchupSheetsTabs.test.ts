import { describe, expect, it } from 'vitest'
import {
  MATCHUP_SHEETS_DEFAULT_PATH,
  MATCHUP_SHEETS_TABS,
  matchupSheetsTabFromPath,
  matchupSheetsTabPath,
} from '../matchupSheetsTabs'

describe('matchupSheetsTabs', () => {
  it('plus d’onglet discover', () => {
    expect(MATCHUP_SHEETS_TABS).toEqual(['my-guides', 'favoris'])
    expect(MATCHUP_SHEETS_DEFAULT_PATH).toBe('/matchups/sheets/my-guides')
  })

  it('chemin de chaque onglet', () => {
    expect(matchupSheetsTabPath('my-guides')).toBe('/matchups/sheets/my-guides')
    expect(matchupSheetsTabPath('favoris')).toBe('/matchups/sheets/favoris')
  })

  it('onglet depuis le chemin, avec ou sans locale', () => {
    expect(matchupSheetsTabFromPath('/en/matchups/sheets/favoris')).toBe('favoris')
    expect(matchupSheetsTabFromPath('/matchups/sheets/my-guides')).toBe('my-guides')
    expect(matchupSheetsTabFromPath('/matchups/sheets')).toBe('my-guides')
    expect(matchupSheetsTabFromPath('/matchups/sheets/discover')).toBeUndefined()
    expect(matchupSheetsTabFromPath('/builds')).toBeUndefined()
  })
})
