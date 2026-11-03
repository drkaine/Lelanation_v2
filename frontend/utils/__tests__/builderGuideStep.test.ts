import { describe, expect, it } from 'vitest'
import {
  builderGuideStepPath,
  builderGuideQuery,
  builderGuideRedirectPath,
  isBuilderGuideRoute,
  readBuilderGuideQuery,
  guideToSaveWithBuild,
  linkedGuideForBuild,
  resolveBuilderGuideSubstep,
} from '../builderGuideStep'

describe('builderGuideStepPath', () => {
  it('construit le chemin d’une sous-étape du guide', () => {
    expect(builderGuideStepPath('matchups')).toBe('/builds/create/guide/matchups')
    expect(builderGuideStepPath('write')).toBe('/builds/create/guide/write')
    expect(builderGuideStepPath('finalize')).toBe('/builds/create/guide/finalize')
  })
})

describe('isBuilderGuideRoute', () => {
  it('reconnaît les routes du guide, avec ou sans locale', () => {
    expect(isBuilderGuideRoute('/builds/create/guide')).toBe(true)
    expect(isBuilderGuideRoute('/en/builds/create/guide/write')).toBe(true)
    expect(isBuilderGuideRoute('/builds/create/notes')).toBe(false)
  })
})

describe('readBuilderGuideQuery / builderGuideQuery', () => {
  it('lit guideEditId, fromBuildId et editId', () => {
    expect(readBuilderGuideQuery({ guideEditId: 'g', fromBuildId: 'b', editId: 'e' })).toEqual({
      guideEditId: 'g',
      fromBuildId: 'b',
      editId: 'e',
    })
    expect(readBuilderGuideQuery({ guideEditId: ['g'], fromBuildId: '' })).toEqual({
      guideEditId: null,
      fromBuildId: null,
      editId: null,
    })
  })

  it('ne garde que les clés renseignées', () => {
    expect(builderGuideQuery({ guideEditId: 'g', fromBuildId: null, editId: null })).toEqual({
      guideEditId: 'g',
    })
  })
})

describe('resolveBuilderGuideSubstep', () => {
  const entries = (n: number) => Array.from({ length: n }, () => ({}) as never)

  it('reprend la dernière sous-étape si elle est ouverte', () => {
    expect(
      resolveBuilderGuideSubstep('write', {
        buildValid: true,
        hasChampion: true,
        matchupEntries: entries(2),
      })
    ).toBe('write')
  })

  it('retombe sur matchups sans assez d’adversaires', () => {
    expect(
      resolveBuilderGuideSubstep('finalize', {
        buildValid: true,
        hasChampion: true,
        matchupEntries: entries(1),
      })
    ).toBe('matchups')
    expect(
      resolveBuilderGuideSubstep('info', {
        buildValid: true,
        hasChampion: true,
        matchupEntries: [],
      })
    ).toBe('matchups')
  })

  it('null si le build n’est pas valide', () => {
    expect(
      resolveBuilderGuideSubstep('matchups', {
        buildValid: false,
        hasChampion: true,
        matchupEntries: [],
      })
    ).toBeNull()
  })
})

describe('builderGuideRedirectPath', () => {
  const entries = (n: number) => Array.from({ length: n }, () => ({}) as never)

  it('null si la sous-étape est ouverte', () => {
    expect(
      builderGuideRedirectPath('matchups', {
        buildValid: true,
        hasChampion: true,
        matchupEntries: [],
      })
    ).toBeNull()
  })

  it('renvoie vers matchups si la rédaction est fermée', () => {
    expect(
      builderGuideRedirectPath('write', {
        buildValid: true,
        hasChampion: true,
        matchupEntries: entries(1),
      })
    ).toBe('/builds/create/guide/matchups')
  })

  it('renvoie vers infos si le build n’est pas valide', () => {
    expect(
      builderGuideRedirectPath('finalize', {
        buildValid: false,
        hasChampion: true,
        matchupEntries: [],
      })
    ).toBe('/builds/create/info')
  })

  it('renvoie vers write si seule la finalisation est fermée', () => {
    expect(
      builderGuideRedirectPath('finalize', {
        buildValid: true,
        hasChampion: true,
        matchupEntries: entries(2),
      })
    ).toBe('/builds/create/guide/write')
  })
})

describe('guideToSaveWithBuild', () => {
  const build = {
    id: 'b1',
    name: 'Ahri mid',
    author: 'moi',
    champion: { id: 'Ahri', key: '103', name: 'Ahri', image: { full: 'Ahri.png' } },
    roles: ['mid'],
    visibility: 'public',
    items: [],
    runes: null,
    shards: null,
    summonerSpells: [null, null],
    skillOrder: null,
  } as never
  const entry = { opponent: { id: 'Zed', name: 'Zed' } } as never

  it('null sans matchup dans le brouillon', () => {
    expect(
      guideToSaveWithBuild(build, {
        guideId: 'g1',
        guideChampionId: 'Ahri',
        matchupEntries: [],
        meta: {},
      })
    ).toBeNull()
  })

  it('null si le brouillon concerne un autre champion', () => {
    expect(
      guideToSaveWithBuild(build, {
        guideId: 'g1',
        guideChampionId: 'Zed',
        matchupEntries: [entry],
        meta: {},
      })
    ).toBeNull()
  })

  it('guide lié au build dès un matchup, même brouillon incomplet', () => {
    const guide = guideToSaveWithBuild(build, {
      guideId: 'g1',
      guideChampionId: 'Ahri',
      matchupEntries: [entry],
      meta: {},
    })
    expect(guide?.id).toBe('g1')
    expect(guide?.buildId).toBe('b1')
    expect(guide?.matchups).toHaveLength(1)
  })
})

describe('linkedGuideForBuild', () => {
  const saved = [
    { id: 'g-other', buildId: 'b2' },
    { id: 'g-local', buildId: 'b1' },
  ] as never[]

  it('préfère le guide de la copie d’équipe', () => {
    const shared = { id: 'g-team', buildId: 'b1' } as never
    expect(linkedGuideForBuild('b1', shared, saved)?.id).toBe('g-team')
  })

  it('sinon le guide local lié au build', () => {
    expect(linkedGuideForBuild('b1', null, saved)?.id).toBe('g-local')
  })

  it('null sans guide lié', () => {
    expect(linkedGuideForBuild('b3', undefined, saved)).toBeNull()
  })
})
