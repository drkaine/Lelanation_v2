import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_UNIFIED_LOG_PATH, resolveUnifiedLogPath } from '../../../src/logging/unifiedAppLog.js'

describe('resolveUnifiedLogPath', () => {
  it('UNIFIED_LOG_PATH prime', () => {
    expect(resolveUnifiedLogPath({ UNIFIED_LOG_PATH: '/x/y.log', VITEST: 'true' })).toBe('/x/y.log')
  })

  it('les tests (VITEST) n’écrivent pas dans le log de prod', () => {
    expect(resolveUnifiedLogPath({ VITEST: 'true' })).toBe(join(tmpdir(), 'lelanation-unified-test.log'))
  })

  it('hors test : log de prod', () => {
    expect(resolveUnifiedLogPath({})).toBe(DEFAULT_UNIFIED_LOG_PATH)
  })
})
