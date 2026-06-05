/**
 * Convert DataDragon game version (e.g. "16.11.1") to Riot patch notes slug (e.g. "26.11").
 */
export function gameVersionToPatchNotesVersion(gameVersion: string): string | null {
  const parts = String(gameVersion || '').trim().match(/\d+/g)
  if (!parts || parts.length < 2) return null
  const gameMajor = Number(parts[0])
  const gameMinor = Number(parts[1])
  if (!Number.isFinite(gameMajor) || !Number.isFinite(gameMinor)) return null
  return `${gameMajor + 10}.${gameMinor}`
}

/**
 * Compare patch note versions like "26.11" and "26.12".
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function comparePatchVersions(a: string, b: string): number {
  const parse = (v: string): [number, number] => {
    const parts = String(v).trim().split('.')
    return [Number(parts[0] ?? 0), Number(parts[1] ?? 0)]
  }
  const [aMajor, aMinor] = parse(a)
  const [bMajor, bMinor] = parse(b)
  if (aMajor !== bMajor) return aMajor - bMajor
  return aMinor - bMinor
}

export function normalizeSlug(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
