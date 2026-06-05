/** Affichage des rôles issus des tables stats (ADC, MID, …). */

const ROLE_LABELS: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  MID: 'Mid',
  BOTTOM: 'ADC',
  ADC: 'ADC',
  BOT: 'ADC',
  SUPPORT: 'Support',
  UTILITY: 'Support',
}

const ROLE_ICON_MAP: Record<string, string> = {
  TOP: '/icons/roles/top.png',
  JUNGLE: '/icons/roles/jungle.png',
  MIDDLE: '/icons/roles/mid.png',
  MID: '/icons/roles/mid.png',
  BOTTOM: '/icons/roles/bot.png',
  ADC: '/icons/roles/bot.png',
  BOT: '/icons/roles/bot.png',
  SUPPORT: '/icons/roles/support.png',
  UTILITY: '/icons/roles/support.png',
}

export function normalizeStatsRoleKey(role: string | null | undefined): string {
  return String(role ?? '')
    .trim()
    .toUpperCase()
}

export function statsRoleLabel(role: string | null | undefined): string {
  const key = normalizeStatsRoleKey(role)
  return ROLE_LABELS[key] ?? (String(role ?? '').trim() || key)
}

export function statsRoleIconPath(role: string | null | undefined): string {
  const key = normalizeStatsRoleKey(role)
  return ROLE_ICON_MAP[key] ?? '/icons/roles/mid.png'
}
