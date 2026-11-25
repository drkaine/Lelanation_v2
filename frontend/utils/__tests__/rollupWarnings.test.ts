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

  it('ignore les cycles entièrement internes aux dépendances (nitro, i18n, robots)', () => {
    expect(
      isIgnorableRollupWarning({
        code: 'CIRCULAR_DEPENDENCY',
        message: 'Circular dependency: …',
        ids: [
          '/app/node_modules/nitropack/dist/runtime/index.mjs',
          '\0virtual:#nitro-internal-virtual/plugins',
          'virtual:#imports',
          '/app/node_modules/@nuxtjs/robots/dist/runtime/server/kit.js',
          '/app/node_modules/nitropack/dist/runtime/index.mjs',
        ],
      })
    ).toBe(true)
  })

  it('garde un cycle qui touche le code du projet', () => {
    expect(
      isIgnorableRollupWarning({
        code: 'CIRCULAR_DEPENDENCY',
        message: 'Circular dependency: …',
        ids: [
          '/app/node_modules/nitropack/dist/runtime/index.mjs',
          '/app/frontend/server/api/x.ts',
        ],
      })
    ).toBe(false)
  })
})
