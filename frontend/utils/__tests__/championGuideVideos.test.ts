import { describe, expect, it } from 'vitest'
import {
  championGuideRoles,
  championGuideVideoCounts,
  championMatchesGuideFilter,
  championGuideVideosByRole,
  isGuideVideoTitle,
  parseChampionGuideTitle,
  slimGuideVideos,
} from '../championGuideVideos'
import type { YouTubeVideo } from '~/types/youtube'

const video = (id: string, title: string, publishedAt = '2026-01-01'): YouTubeVideo => ({
  id,
  title,
  description: '',
  publishedAt,
  thumbnailUrl: '',
  channelId: 'c',
  channelTitle: 'Lelariva',
  url: `https://youtu.be/${id}`,
})

describe('parseChampionGuideTitle', () => {
  it('reconnaît le guide macro et son rôle', () => {
    expect(
      parseChampionGuideTitle(
        'Le GUIDE Macro - Shyvana JGL : Les stratégies des OTP pour carry !',
        'Shyvana'
      )
    ).toEqual({ series: 'macro', role: 'jungle' })
  })

  it('reconnaît le guide micro', () => {
    expect(
      parseChampionGuideTitle(
        'Le GUIDE Micro - Hwei MID : Les clics que tous les OTP connaissent',
        'Hwei'
      )
    ).toEqual({ series: 'micro', role: 'mid' })
  })

  it('ne prend pas le TOP de « top monde » pour le rôle', () => {
    expect(
      parseChampionGuideTitle(
        'Voici comment le TOP MONDE carry sur Nautilus - Guide Nautilus SUP FR',
        'Nautilus'
      )
    ).toEqual({ series: 'topMonde', role: 'support' })
  })

  it('gère les noms en plusieurs mots', () => {
    expect(
      parseChampionGuideTitle(
        'Voici comment le TOP MONDE carry sur Miss Fortune ADC - Guide Miss Fortune ADC FR',
        'Miss Fortune'
      )
    ).toEqual({ series: 'topMonde', role: 'adc' })
  })

  it('rôle inconnu = null', () => {
    expect(parseChampionGuideTitle('Le GUIDE Macro - Darius : la base', 'Darius')).toEqual({
      series: 'macro',
      role: null,
    })
  })

  it('ignore les autres champions et les autres séries', () => {
    expect(parseChampionGuideTitle('Le GUIDE Macro - Darius TOP : x', 'Hwei')).toBeNull()
    expect(parseChampionGuideTitle('Guide Darius TOP : la base', 'Darius')).toBeNull()
    expect(
      parseChampionGuideTitle('Les erreurs qui t’empêchent de carry - Guide Darius TOP FR', 'Hwei')
    ).toBeNull()
  })

  it('ne confond pas un nom contenu dans un autre (Vi / Viego)', () => {
    expect(parseChampionGuideTitle('Le GUIDE Macro - Viego JGL : x', 'Vi')).toBeNull()
  })
})

describe('championGuideVideosByRole', () => {
  it('range par rôle (ordre de lane), du plus récent au plus ancien', () => {
    const groups = championGuideVideosByRole(
      [
        video('a', 'Le GUIDE Macro - Lux SUP : x', '2026-01-01'),
        video('b', 'Le GUIDE Micro - Lux SUP : x', '2026-02-01'),
        video('c', 'Le GUIDE Macro - Lux MID : x'),
        video('d', 'Le GUIDE Macro - Darius TOP : x'),
        video('a', 'Le GUIDE Macro - Lux SUP : x', '2026-01-01'),
      ],
      'Lux'
    )
    expect(groups.map(g => [g.role, g.videos.map(v => v.id)])).toEqual([
      ['mid', ['c']],
      ['support', ['b', 'a']],
    ])
  })

  it('vide sans nom de champion', () => {
    expect(championGuideVideosByRole([video('a', 'Le GUIDE Macro - Lux SUP : x')], '')).toEqual([])
  })
})

describe('championGuideVideoCounts', () => {
  it('compte les guides par champion, 0 sans guide, sans confondre Vi et Viego', () => {
    const videos = [
      video('a', 'Le GUIDE Macro - Viego JGL : x'),
      video('b', 'Le GUIDE Micro - Viego JGL : y'),
      video('c', 'Le GUIDE Micro - Vi JGL : z'),
      video('d', 'Tier list du patch'),
    ]
    expect(championGuideVideoCounts(videos, ['Viego', 'Vi', 'Ahri'])).toEqual({
      Viego: 2,
      Vi: 1,
      Ahri: 0,
    })
  })
})

describe('championGuideRoles', () => {
  it('liste les rôles des guides de chaque champion, dans l’ordre des lanes', () => {
    const videos = [
      video('a', 'Le GUIDE Macro - Nautilus SUPP : x'),
      video('b', 'Le GUIDE Micro - Nautilus TOP : y'),
      video('c', 'Le GUIDE Micro - Nautilus SUPP : z'),
    ]
    expect(championGuideRoles(videos, ['Nautilus', 'Ahri'])).toEqual({
      Nautilus: ['top', 'support'],
      Ahri: [],
    })
  })
})

describe('championMatchesGuideFilter', () => {
  const naut = { name: 'Nautilus', roles: ['top', 'support'] as const }
  it('sans filtre : tout passe', () => {
    expect(championMatchesGuideFilter(naut, '', [])).toBe(true)
  })
  it('filtre sur le nom, sans accents ni casse', () => {
    expect(championMatchesGuideFilter(naut, 'NAUT', [])).toBe(true)
    expect(championMatchesGuideFilter(naut, 'ahri', [])).toBe(false)
  })
  it('filtre sur un des rôles de guide sélectionnés', () => {
    expect(championMatchesGuideFilter(naut, '', ['support'])).toBe(true)
    expect(championMatchesGuideFilter(naut, '', ['mid', 'adc'])).toBe(false)
  })
})

describe('parseChampionGuideTitle — autres séries de guides', () => {
  it.each([
    ["C'est connaître les bonnes BASES MICRO - Guide Nami SUP FR", 'Nami', 'support'],
    ["C'est surtout savoir quoi faire - Guide Macro Orianna MID FR", 'Orianna', 'mid'],
    ["Comment l'ELITE carry toutes ses games - Guide Sett TOP FR", 'Sett', 'top'],
    ["Les erreurs qui t'empêchent de carry - Guide Shyvana JGL FR", 'Shyvana', 'jungle'],
    ['(S26✅) Comment BUILD et CARRY avec Xin Zhao TOP ?', 'Xin Zhao', 'top'],
    ['Voici comment le HIGH ELO fait la différence avec MALPHITE JGL !!', 'Malphite', 'jungle'],
  ])('%s', (title, champion, role) => {
    expect(parseChampionGuideTitle(title, champion)?.role).toBe(role)
  })

  it('Super-Guide sans rôle : rattaché, rôle inconnu', () => {
    for (const title of [
      "Super-Guide K'Sante : La Macro",
      "Super-Guide K'Sante : La Micro",
      "Super-Guide K'Sante : La Perfection",
    ]) {
      expect(parseChampionGuideTitle(title, "K'Sante")).toEqual({ series: 'guide', role: null })
    }
  })

  it('rôle hors position « nom + rôle » : pris ailleurs dans le titre, pas dans « du monde »', () => {
    expect(
      parseChampionGuideTitle(
        'Voici comment le MEILLEUR Renekton DU MONDE carry au TOP !',
        'Renekton'
      )?.role
    ).toBe('top')
  })

  it('ignore les titres hors séries', () => {
    expect(parseChampionGuideTitle('Comment build Camille TOP', 'Camille')).toBeNull()
    expect(parseChampionGuideTitle('Hard carry avec Viego MID !', 'Viego')).toBeNull()
  })
})

describe('slimGuideVideos', () => {
  it('garde id + titre, dédoublonne par id, ignore les vidéos sans titre', () => {
    const videos = [
      video('a', 'Guide Ahri Mid'),
      video('a', 'Guide Ahri Mid'),
      { ...video('b', ''), title: '' },
      video('c', 'Macro Garen Top'),
    ]
    expect(slimGuideVideos(videos)).toEqual([
      { id: 'a', title: 'Guide Ahri Mid' },
      { id: 'c', title: 'Macro Garen Top' },
    ])
  })
})

describe('règles de titres des guides', () => {
  const cases: Array<[string, string]> = [
    ["Les erreurs qui t'empêchent de carry avec Ahri MID", 'guide'],
    ['Propulse tes bases sur Ahri MID', 'guide'],
    ['Et si on allait plus loin que les bases ? Ahri MID', 'guide'],
    ['Le plus gros spammeur Ahri MID', 'guide'],
    ['Le plus GROS SPAMMER de AHRI ne joue QUE MID !', 'guide'],
    ["Ahri MID, c'est d'abord maîtriser les bases", 'guide'],
    ["Ahri MID, c'est surtout savoir quoi faire", 'guide'],
    ["Ahri MID, c'est surtout savoir que faire", 'guide'],
    ['Ahri MID, c’est SURTOUT savoir que faire !', 'guide'],
    ['Joue Ahri MID comme le top 10', 'guide'],
    ['Une masterclass du top monde sur Ahri MID', 'topMonde'],
    ["Je n'ai jamais vu un OTP aussi fort sur Ahri MID", 'guide'],
    ['Voici comment le top monde joue Ahri MID', 'topMonde'],
    ['Comment le meilleur OTP joue Ahri MID', 'guide'],
    ['Comment la meilleure Ahri MID gagne', 'guide'],
    ['Comment la meilleur Ahri MID gagne', 'guide'],
    ["La touche en plus que l'élite sur Ahri MID", 'guide'],
    ["Comment l'élite joue Ahri MID", 'guide'],
    ['Joue Ahri MID comme le top', 'guide'],
    ['Une masterclass sur Ahri MID', 'guide'],
    ['Va plus loin que les bases avec Ahri MID', 'guide'],
  ]
  it.each(cases)('%s → série %s, rôle mid', (title, series) => {
    expect(parseChampionGuideTitle(title, 'Ahri')).toEqual({ series, role: 'mid' })
  })
  it('ne prend pas le TOP de « comme le top » pour le rôle', () => {
    expect(parseChampionGuideTitle('Joue Ahri comme le top', 'Ahri')).toEqual({
      series: 'guide',
      role: null,
    })
    expect(parseChampionGuideTitle('Ahri comme le top, en mid', 'Ahri')).toEqual({
      series: 'guide',
      role: 'mid',
    })
  })
  it('ne prend pas le TOP de « top 10 » pour le rôle', () => {
    expect(parseChampionGuideTitle('Joue Ahri comme le top 10', 'Ahri')).toEqual({
      series: 'guide',
      role: null,
    })
  })
  it.each(cases)('%s → classé guide sur la page vidéos', title => {
    expect(isGuideVideoTitle(title)).toBe(true)
  })
  it('garde les anciennes règles de la page vidéos', () => {
    expect(isGuideVideoTitle('Guide Ahri')).toBe(true)
    expect(isGuideVideoTitle('Comment jouer Ahri')).toBe(true)
    expect(isGuideVideoTitle('Comment build Ahri')).toBe(true)
    expect(isGuideVideoTitle('Lobby de la semaine')).toBe(false)
  })
})
