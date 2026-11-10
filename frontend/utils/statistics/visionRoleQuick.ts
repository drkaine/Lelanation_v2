import { normalizeStatsRoleKey } from './statisticsTableFormat'

/** Raccourcis de rôle de l'onglet Vision (maquette Comportement). */
export const VISION_ROLE_QUICK = [
  { value: '', labelKey: 'statisticsPage.visionRoleAll' },
  { value: 'TOP', labelKey: 'statisticsPage.visionRoleTop' },
  { value: 'JUNGLE', labelKey: 'statisticsPage.visionRoleJungle' },
  { value: 'MIDDLE', labelKey: 'statisticsPage.visionRoleMid' },
  { value: 'BOTTOM', labelKey: 'statisticsPage.visionRoleAdc' },
  { value: 'SUPPORT', labelKey: 'statisticsPage.visionRoleSupport' },
] as const

export type VisionRoleQuick = (typeof VISION_ROLE_QUICK)[number]['value']

/** Valeur rapide correspondant au filtre de rôle courant, ou null si hors raccourcis. */
export function visionRoleQuickActive(role: string | null | undefined): VisionRoleQuick | null {
  const norm = normalizeStatsRoleKey(role)
  const hit = VISION_ROLE_QUICK.find(o => o.value === norm)
  return hit ? hit.value : null
}

/** Colonnes du tableau Vision desktop. « Invisibles » = posées − contrôle (implicite). */
export const VISION_TABLE_COLUMNS = [
  'visionScore',
  'visionScorePerMinute',
  'wardsPlaced',
  'controlWardsPlaced',
  'wardsKilled',
] as const
