type RollupWarningLike = { code?: string; message: string; ids?: string[] }

/** Module tiers ou virtuel (généré par Nitro/Nuxt), hors du code du projet. */
function isDependencyModule(id: string): boolean {
  return id.includes('/node_modules/') || id.startsWith('virtual:') || id.startsWith('\0')
}

/**
 * Warnings Rollup sans effet à masquer au build :
 * - `@__NO_SIDE_EFFECTS__` mal placé dans le code généré par Vue/Nuxt (Rollup retire juste le commentaire) ;
 * - cycles d'import internes aux dépendances (nitropack ↔ @nuxtjs/i18n / robots / nuxt-site-config).
 *   Un cycle qui touche le code du projet reste signalé.
 */
export function isIgnorableRollupWarning(warning: RollupWarningLike): boolean {
  if (warning.code === 'INVALID_ANNOTATION') {
    return warning.message.includes('__NO_SIDE_EFFECTS__')
  }
  if (warning.code === 'CIRCULAR_DEPENDENCY') {
    return Boolean(warning.ids?.length) && warning.ids!.every(isDependencyModule)
  }
  return false
}
