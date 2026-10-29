/** Consentement cookies : choix daté, redemandé au bout de 6 mois (recommandation CNIL). */

export type ConsentChoice = 'unknown' | 'accepted' | 'rejected'

export const CONSENT_MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000

export function serializeConsent(choice: 'accepted' | 'rejected', at: number): string {
  return JSON.stringify({ choice, at })
}

export function parseStoredConsent(raw: string | null, now: number): ConsentChoice {
  if (!raw) return 'unknown'
  try {
    const data = JSON.parse(raw) as { choice?: unknown; at?: unknown }
    if (data.choice !== 'accepted' && data.choice !== 'rejected') return 'unknown'
    if (typeof data.at !== 'number' || data.at > now || now - data.at > CONSENT_MAX_AGE_MS) {
      return 'unknown'
    }
    return data.choice
  } catch {
    return 'unknown'
  }
}

export function matomoCookieNames(cookieString: string): string[] {
  return cookieString
    .split(';')
    .map(part => part.split('=')[0]!.trim())
    .filter(name => name.startsWith('_pk_') || name.startsWith('mtm_'))
}
