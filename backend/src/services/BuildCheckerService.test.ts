import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkBuildAgainstPatches } from './BuildCheckerService.js'
import type { PatchNotesData } from '../types/patchNotes.js'

const patch2611: PatchNotesData = {
  version: '26.11',
  date: '2026-05-27',
  summary: { fr: '', en: '' },
  highlights: [],
  champions: [
    {
      slug: 'darius',
      name_fr: 'Darius',
      name_en: 'Darius',
      ddragon_id: 'Darius',
      global_type: 'nerf',
      changes: [{ stat: 'R', old_value: '100', new_value: '90', type: 'nerf', description_fr: '', description_en: '' }],
    },
  ],
  items: [
    {
      slug: 'trinity-force',
      name_fr: 'Force de la Trinité',
      name_en: 'Trinity Force',
      ddragon_id: '3078',
      global_type: 'nerf',
      changes: [{ stat: 'AD', old_value: '4%', new_value: '3%', type: 'nerf', description_fr: '', description_en: '' }],
    },
    {
      slug: 'infinity-edge',
      name_fr: "Lame d'infini",
      name_en: 'Infinity Edge',
      ddragon_id: '3031',
      global_type: 'buff',
      changes: [{ stat: 'Crit', old_value: '35%', new_value: '40%', type: 'buff', description_fr: '', description_en: '' }],
    },
  ],
  runes: [],
  systems: [],
  skins: [],
}

const patch2612: PatchNotesData = {
  version: '26.12',
  date: '2026-06-04',
  summary: { fr: '', en: '' },
  highlights: [],
  champions: [],
  items: [
    {
      slug: 'lord-dominiks-regards',
      name_fr: 'Regard dominant',
      name_en: "Lord Dominik's Regards",
      ddragon_id: '3036',
      global_type: 'nerf',
      changes: [{ stat: 'Pen', old_value: '30%', new_value: '25%', type: 'nerf', description_fr: '', description_en: '' }],
    },
  ],
  runes: [
    {
      slug: 'lethal-tempo',
      name_fr: 'Tempo mortel',
      name_en: 'Lethal Tempo',
      ddragon_id: '8008',
      global_type: 'nerf',
      changes: [{ stat: 'AS', old_value: '60%', new_value: '50%', type: 'nerf', description_fr: '', description_en: '' }],
    },
  ],
  systems: [],
  skins: [],
}

test('checkBuildAgainstPatches: ignores patches at or before patch_created', () => {
  const result = checkBuildAgainstPatches(
    {
      patch_created: '26.12',
      champion_ddragon_id: 'Darius',
      items: [{ ddragon_id: '3078' }],
    },
    [patch2611, patch2612]
  )
  assert.equal(result.score, 100)
  assert.equal(result.affected.length, 0)
  assert.equal(result.patches_since, 0)
})

test('checkBuildAgainstPatches: champion nerf + core item nerf lowers score', () => {
  const result = checkBuildAgainstPatches(
    {
      patch_created: '26.10',
      champion_ddragon_id: 'Darius',
      items: [{ ddragon_id: '3078' }, { ddragon_id: '3031' }],
    },
    [patch2611]
  )
  assert.equal(result.score, 68)
  assert.equal(result.status, 'affected')
  assert.equal(result.affected.length, 3)
  assert.equal(result.patches_since, 1)
})

test('checkBuildAgainstPatches: item buff partially offsets nerfs', () => {
  const result = checkBuildAgainstPatches(
    {
      patch_created: '26.10',
      champion_ddragon_id: 'Darius',
      items: [{ ddragon_id: '3078' }, { ddragon_id: '3031' }],
    },
    [patch2611]
  )
  const withoutBuff = checkBuildAgainstPatches(
    {
      patch_created: '26.10',
      champion_ddragon_id: 'Darius',
      items: [{ ddragon_id: '3078' }],
    },
    [patch2611]
  )
  assert.ok(result.score > withoutBuff.score)
})

test('checkBuildAgainstPatches: situational item nerf is -8 not -15', () => {
  const result = checkBuildAgainstPatches(
    {
      patch_created: '26.11',
      items: [{ ddragon_id: '9999' }, { ddragon_id: '9998' }, { ddragon_id: '9997' }, { ddragon_id: '3036' }],
    },
    [patch2612]
  )
  assert.equal(result.score, 92)
  assert.equal(result.status, 'current')
})

test('checkBuildAgainstPatches: matches by ddragon_id over slug', () => {
  const result = checkBuildAgainstPatches(
    {
      patch_created: '26.11',
      runes: [{ ddragon_id: '8008' }],
    },
    [patch2612]
  )
  assert.equal(result.score, 95)
  assert.equal(result.affected[0]?.entity_type, 'rune')
})
