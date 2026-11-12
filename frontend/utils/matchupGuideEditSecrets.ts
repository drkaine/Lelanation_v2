/**
 * Edit secrets of the matchup guides this browser published (guideId → secret).
 * Kept apart from the guides themselves so a shared or exported guide never carries its secret.
 */
export const GUIDE_SECRETS_STORAGE_KEY = 'lelanation_matchup_guide_secrets'

export type GuideSecrets = Record<string, string>

export function parseGuideSecrets(raw: string | null | undefined): GuideSecrets {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const secrets: GuideSecrets = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) secrets[id] = value.trim()
    }
    return secrets
  } catch {
    return {}
  }
}

export function withGuideSecret(
  secrets: GuideSecrets,
  guideId: string,
  secret: unknown
): GuideSecrets {
  if (!guideId || typeof secret !== 'string' || !secret.trim()) return secrets
  return { ...secrets, [guideId]: secret.trim() }
}

export function withoutGuideSecret(secrets: GuideSecrets, guideId: string): GuideSecrets {
  const { [guideId]: _removed, ...rest } = secrets
  return rest
}
