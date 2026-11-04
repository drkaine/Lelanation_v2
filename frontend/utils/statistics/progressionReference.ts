import { compareVersionsDesc, MIN_VERSION_SHARE } from './statsVersion'

export { MIN_VERSION_SHARE }

type VersionCount = { version: string; matchCount: number | string | null | undefined }

/**
 * Patch de référence des deltas : le patch précédent ayant assez de parties.
 * Sans filtre, le patch « courant » est le plus récent ayant assez de parties.
 */
export function progressionReferenceVersion(
  versions: readonly VersionCount[],
  filterVersion: string,
  minShare = MIN_VERSION_SHARE
): string | null {
  const rows = versions
    .map(v => ({ version: String(v.version ?? '').trim(), count: Number(v.matchCount ?? 0) }))
    .filter(v => v.version && v.count > 0)
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
  if (rows.length === 0) return null
  const max = Math.max(...rows.map(v => v.count))
  const enough = rows.filter(v => v.count >= max * minShare)
  const filter = filterVersion.trim()
  if (!filter) {
    if (enough.length >= 2) return enough[1]!.version
    return enough[0]?.version ?? rows[0]!.version
  }
  return enough.find(v => compareVersionsDesc(filter, v.version) < 0)?.version ?? null
}
