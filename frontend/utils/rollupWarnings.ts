/**
 * Warnings Rollup sans effet à masquer au build : `@__NO_SIDE_EFFECTS__` mal placé
 * dans le code généré par Vue/Nuxt (Rollup retire juste le commentaire).
 */
export function isIgnorableRollupWarning(warning: { code?: string; message: string }): boolean {
  return warning.code === 'INVALID_ANNOTATION' && warning.message.includes('__NO_SIDE_EFFECTS__')
}
