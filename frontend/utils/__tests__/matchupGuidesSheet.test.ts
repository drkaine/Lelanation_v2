import { describe, expect, it } from 'vitest'
import {
  allMatchupGuideUrls,
  defaultChampionGuidesTab,
  MATCHUP_GUIDES_SHEET_TABS,
  matchupGuidesSheetUrl,
  mergeMatchupGuideTabs,
  withoutDeadMatchupGuides,
  matchupGuideCounts,
  matchupGuideRoles,
  championRolesWithMatchupGuides,
  matchupGuidesForChampion,
  parseMatchupGuidesSheet,
} from '../matchupGuidesSheet'

const th = (n: number) => `<th class="row-headers-background"><div>${n}</div></th>`
const link = (url: string, label: string) =>
  `<a target="_blank" href="https://www.google.com/url?q=${url}&amp;sa=D&amp;source=editors">${label}</a>`

// Extrait réduit de la vue HTML publiée du sheet (rowspan/colspan conservés).
const HTML = `<table><tbody>
<tr>${th(1)}<td></td><td colspan="5">TOUS LES MATCHUPS</td><td colspan="3">AUTRES GUIDES MATCHUPS INTERESSANTS</td></tr>
<tr>${th(2)}<td></td><td>Champion</td><td>Qui / Level</td><td>Lien</td><td></td><td>Notes</td><td>lvl</td><td>Lien</td><td>Notes</td><td>Une question ?</td></tr>
<tr>${th(3)}<td rowspan="4"><div><img src="x"/></div></td><td rowspan="4">Alistar</td><td rowspan="2"></td><td rowspan="4"></td><td></td><td rowspan="4"></td><td></td><td></td><td></td><td></td></tr>
<tr>${th(4)}<td></td><td></td><td></td><td></td><td></td><td></td></tr>
<tr>${th(5)}<td rowspan="2"></td><td></td><td></td><td></td><td></td><td></td></tr>
<tr>${th(6)}<td></td><td></td><td></td><td></td><td></td></tr>
<tr>${th(7)}<td rowspan="4"><div><img src="y"/></div></td><td rowspan="4">Karma</td><td rowspan="2">Navcan</td><td rowspan="4">${link('https://www.mobafire.com/karma-611468%23', 'Lien Mobafire')}</td><td></td><td rowspan="4">Un gros main support qui s&#39;est donné.</td><td>Dia</td><td>${link('https://example.com/autre', 'Autre')}</td><td>Notes 2<br>ligne</td><td></td></tr>
<tr>${th(8)}<td></td><td></td><td></td><td></td><td></td></tr>
<tr>${th(9)}<td rowspan="2">Master</td><td></td><td></td><td></td><td></td><td></td></tr>
<tr>${th(10)}<td></td><td></td><td></td><td></td><td></td></tr>
</tbody></table>`

describe('parseMatchupGuidesSheet', () => {
  it('extrait qui, niveau, lien (sans la redirection Google) et notes', () => {
    expect(parseMatchupGuidesSheet(HTML)).toEqual({
      Karma: [
        {
          who: 'Navcan',
          level: 'Master',
          url: 'https://www.mobafire.com/karma-611468#',
          label: 'Lien Mobafire',
          notes: "Un gros main support qui s'est donné.",
        },
        {
          who: '',
          level: 'Dia',
          url: 'https://example.com/autre',
          label: 'Autre',
          notes: 'Notes 2\nligne',
        },
      ],
    })
  })

  it('ignore les champions sans guide et les pages vides', () => {
    expect(parseMatchupGuidesSheet('')).toEqual({})
    expect(parseMatchupGuidesSheet(HTML).Alistar).toBeUndefined()
  })
})

describe('matchupGuidesForChampion', () => {
  it('retrouve le champion sans casse ni accents ni apostrophe', () => {
    const data = { "Vel'Koz": [{ who: 'a', level: '', url: 'u', label: 'l', notes: '' }] }
    expect(matchupGuidesForChampion(data, 'velkoz')).toHaveLength(1)
    expect(matchupGuidesForChampion(data, "Vel'Koz")).toHaveLength(1)
    expect(matchupGuidesForChampion(data, 'Ahri')).toEqual([])
  })
})

describe('matchupGuideCounts', () => {
  const guide = { who: '', level: '', url: 'u', label: '', notes: '' }
  it('compte les guides par nom de champion du jeu, sans casse ni ponctuation', () => {
    const data = { "Kai'Sa": [guide, guide], ALISTAR: [guide] }
    expect(matchupGuideCounts(data, ['Kai’Sa', 'Alistar', 'Ahri'])).toEqual({
      'Kai’Sa': 2,
      Alistar: 1,
    })
  })
})

describe('defaultChampionGuidesTab', () => {
  it('ouvre les vidéos si le champion en a', () => {
    expect(defaultChampionGuidesTab(2, 3)).toBe('videos')
  })
  it('ouvre les matchups si le champion n’a que des guides matchup', () => {
    expect(defaultChampionGuidesTab(0, 1)).toBe('matchups')
  })
  it('vidéos par défaut sans aucun guide', () => {
    expect(defaultChampionGuidesTab(0, 0)).toBe('videos')
  })
})

describe('onglets du sheet', () => {
  it('lit les 5 onglets de rôle (TOP, JGL, MID, BOT, SUP)', () => {
    expect(MATCHUP_GUIDES_SHEET_TABS.map(t => t.role)).toEqual([
      'top',
      'jungle',
      'mid',
      'adc',
      'support',
    ])
    expect(matchupGuidesSheetUrl('1495176325')).toContain('gid=1495176325')
  })

  it('fusionne les onglets, marque le rôle et dédoublonne par lien', () => {
    const g = (url: string) => ({ who: '', level: '', url, label: '', notes: '' })
    const merged = mergeMatchupGuideTabs([
      { role: 'top', data: { Akali: [g('a'), g('b')] } },
      { role: 'mid', data: { Akali: [g('a'), g('c')], Ahri: [g('d')] } },
    ])
    expect(merged.Akali!.map(x => [x.url, x.role])).toEqual([
      ['a', 'top'],
      ['b', 'top'],
      ['c', 'mid'],
    ])
    expect(merged.Ahri).toHaveLength(1)
  })

  it('retire les liens morts et les champions sans guide restant', () => {
    const g = (url: string) => ({ who: '', level: '', url, label: '', notes: '' })
    const out = withoutDeadMatchupGuides({ Akali: [g('a'), g('b')], Ahri: [g('d')] }, ['b', 'd'])
    expect(out).toEqual({ Akali: [g('a')] })
  })

  it('liste tous les liens uniques', () => {
    const g = (url: string) => ({ who: '', level: '', url, label: '', notes: '' })
    expect(allMatchupGuideUrls({ A: [g('a'), g('b')], B: [g('a')] })).toEqual(['a', 'b'])
  })
})

describe('matchupGuideRoles', () => {
  const g = (role?: 'top' | 'jungle' | 'mid' | 'adc' | 'support') => ({
    who: '',
    level: '',
    url: `u-${role}`,
    label: '',
    notes: '',
    ...(role ? { role } : {}),
  })
  it('donne les rôles (onglets du sheet) des guides de chaque champion, sans doublon', () => {
    const data = { Aatrox: [g('top'), g('top')], "Kai'Sa": [g('adc'), g('mid')], Ahri: [g()] }
    expect(matchupGuideRoles(data, ['Aatrox', 'Kai’Sa', 'Ahri', 'Annie'])).toEqual({
      Aatrox: ['top'],
      'Kai’Sa': ['mid', 'adc'],
    })
  })
})

describe('championRolesWithMatchupGuides', () => {
  it('ajoute les rôles des guides matchups à ceux des vidéos, dans l’ordre des rôles', () => {
    expect(
      championRolesWithMatchupGuides(
        { Aatrox: ['mid'], Ahri: ['mid'] },
        { Aatrox: ['top'], Garen: ['top'] }
      )
    ).toEqual({ Aatrox: ['top', 'mid'], Ahri: ['mid'], Garen: ['top'] })
  })
})
