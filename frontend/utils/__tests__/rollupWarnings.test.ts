import { describe, expect, it } from 'vitest'
import { isIgnorableRollupWarning } from '../rollupWarnings'

describe('isIgnorableRollupWarning', () => {
  it('ignore les annotations mal placées dans le code généré', () => {
    expect(
      isIgnorableRollupWarning({
        code: 'INVALID_ANNOTATION',
        message:
          'A comment "/* @__NO_SIDE_EFFECTS__ */" contains an annotation that Rollup cannot interpret',
      })
    ).toBe(true)
  })

  it('garde les autres warnings', () => {
    expect(isIgnorableRollupWarning({ code: 'CIRCULAR_DEPENDENCY', message: 'x' })).toBe(false)
    expect(
      isIgnorableRollupWarning({ code: 'INVALID_ANNOTATION', message: '/* #__PURE__ */' })
    ).toBe(false)
  })
})
