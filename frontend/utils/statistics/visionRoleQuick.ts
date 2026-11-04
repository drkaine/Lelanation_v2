/** Raccourcis de rôle de l'onglet Vision (maquette Comportement). */
export const VISION_ROLE_QUICK = [
  { value: '', labelKey: 'statisticsPage.visionRoleAll' },
  { value: 'JUNGLE', labelKey: 'statisticsPage.visionRoleJungle' },
  { value: 'SUPPORT', labelKey: 'statisticsPage.visionRoleSupport' },
] as const

export type VisionRoleQuick = (typeof VISION_ROLE_QUICK)[number]['value']

/** Valeur rapide correspondant au filtre de rôle courant, ou null si hors raccourcis. */
export function visionRoleQuickActive(role: string | null | undefined): VisionRoleQuick | null {
  const r = (role ?? '').trim().toUpperCase()
  const norm = r === 'UTILITY' ? 'SUPPORT' : r
  const hit = VISION_ROLE_QUICK.find(o => o.value === norm)
  return hit ? hit.value : null
}
