/** Challenge keys removed from Riot match-v5 (patch 16.17+). */
export const DEPRECATED_CHALLENGE_KEYS = new Set<string>([
  'firstTurretKilledTime',
  'teleportTakedowns',
])

export function challengeKeyToColumn(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
}

export type ChallengeExtraValue = number | boolean

/** Numeric / boolean challenge entries without a dedicated participants column. */
export function collectUnmappedChallengeFields(
  challenges: Record<string, unknown> | undefined,
  options: {
    mappedKeys: ReadonlySet<string>
    skipKeys?: ReadonlySet<string>
  },
): Record<string, ChallengeExtraValue> {
  if (!challenges) return {}
  const extra: Record<string, ChallengeExtraValue> = {}
  for (const [key, raw] of Object.entries(challenges)) {
    if (DEPRECATED_CHALLENGE_KEYS.has(key)) continue
    if (options.mappedKeys.has(key)) continue
    if (options.skipKeys?.has(key)) continue
    if (typeof raw === 'number' && Number.isFinite(raw)) extra[key] = raw
    else if (typeof raw === 'boolean') extra[key] = raw
  }
  return extra
}
