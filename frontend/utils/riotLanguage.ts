export type RiotLanguage = 'fr_FR' | 'en_US'

/** Data Dragon language of an app locale (French unless English). */
export function riotLanguage(locale: string | null | undefined): RiotLanguage {
  return locale === 'en' ? 'en_US' : 'fr_FR'
}
