import { describe, expect, it } from 'vitest'
import { runesDetail, spellsDetail } from './detailPayload'

const runes = { totalParticipants: 10, runes: [], runeSets: [] }
const spells = { summonerSpells: [], summonerSpellSets: [] }

describe('detailPayload', () => {
  it('runes_detail_keeps_runes_payload_only', () => {
    expect([runesDetail(runes), runesDetail(spells), runesDetail(null)]).toEqual([
      runes,
      null,
      null,
    ])
  })

  it('spells_detail_keeps_spells_payload_only', () => {
    expect([spellsDetail(spells), spellsDetail(runes)]).toEqual([spells, null])
  })

  it('full_overview_detail_serves_both_tabs', () => {
    const full = { ...runes, ...spells }
    expect([runesDetail(full), spellsDetail(full)]).toEqual([full, full])
  })
})
