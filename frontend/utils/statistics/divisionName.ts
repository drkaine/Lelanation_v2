import { formatDivisionLabel } from './statisticsTableFormat'

const FR: Record<string, string> = {
  IRON: 'Fer',
  BRONZE: 'Bronze',
  SILVER: 'Argent',
  GOLD: 'Or',
  PLATINUM: 'Platine',
  EMERALD: 'Émeraude',
  DIAMOND: 'Diamant',
  MASTER: 'Maître',
  GRANDMASTER: 'Grand Maître',
  CHALLENGER: 'Challenger',
}

/** Nom affiché d'une division classée (maquette Données : « Fer », « Émeraude »…). */
export function divisionName(tier: string, locale: 'fr' | 'en'): string {
  const key = tier.toUpperCase()
  if (locale === 'fr' && FR[key]) return FR[key]
  return formatDivisionLabel(tier)
}
