import { describe, expect, it } from 'vitest'
import { resolve } from 'path'
import { isValidGuideId, resolveGuideFilePath } from '../../../../src/utils/matchupGuideAccess.js'

const DIR = '/srv/data/matchup-guides'
const UUID = 'b1d4d366-98d5-4eac-a61b-de0b60aa58a9'

describe('matchupGuideAccess', () => {
  it('guide_path_is_resolved_when_id_is_uuid', () => {
    expect(resolveGuideFilePath(DIR, UUID)).toBe(resolve(DIR, `${UUID}.json`))
  })

  it('guide_path_is_rejected_when_id_traverses_directories', () => {
    expect(resolveGuideFilePath(DIR, '../../package')).toBeNull()
  })

  it('guide_path_is_rejected_when_id_is_not_a_string', () => {
    expect(resolveGuideFilePath(DIR, { toString: () => UUID })).toBeNull()
  })

  it('guide_id_is_invalid_when_uuid_has_a_suffix', () => {
    expect(isValidGuideId(`${UUID}/../x`)).toBe(false)
  })
})
