/**
 * Patch client League = major.minor. Riot match-v5 peut renvoyer une chaîne longue
 * (ex. "16.4.748.682") ; on ne garde que les deux premiers segments numériques.
 */
export function normalizeGameVersionToMajorMinor(
  gameVersionRaw: string | number | null | undefined
): string {
  if (gameVersionRaw == null) return ''
  const raw =
    typeof gameVersionRaw === 'string'
      ? gameVersionRaw.trim()
      : String(gameVersionRaw).trim()
  if (!raw) return ''

  const dotted = raw.replace(/[\u00B7\u2022\u2219\u22C5\u30FB\uFF0E]/g, '.')

  const m = /^(\d+)\.(\d+)/.exec(dotted)
  if (m) return `${m[1]}.${m[2]}`

  const parts = dotted.split('.')
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return raw
}

/** Lit gameVersion depuis info match-v5 (camelCase ou snake_case). */
export function gameVersionFromMatchInfo(
  info: { gameVersion?: string; [key: string]: unknown } | null | undefined
): string | null {
  if (!info) return null
  const v = info.gameVersion ?? (info as Record<string, unknown>).game_version
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}
