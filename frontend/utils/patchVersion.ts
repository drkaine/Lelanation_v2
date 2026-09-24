import { normalizePatchNotesVersion } from '~/stores/PatchNotesStore'

function parseMajorMinor(version: string): { major: number; minor: number } | null {
  const [major, minor] = version.split('.').map(Number)
  if (major === undefined || minor === undefined) return null
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null
  return { major, minor }
}

/** Compare two major.minor patch labels (e.g. 16.12 vs 16.13); 0 when either is unparsable. */
export function comparePatchMajorMinor(a: string | null, b: string | null): number {
  const pa = a ? parseMajorMinor(a) : null
  const pb = b ? parseMajorMinor(b) : null
  if (!pa || !pb) return 0
  return pa.major !== pb.major ? pa.major - pb.major : pa.minor - pb.minor
}

/** Highest major.minor among provided version strings. */
export function pickLatestPatchVersion(...versions: Array<string | null | undefined>): string {
  let best = ''
  for (const raw of versions) {
    const normalized = normalizePatchNotesVersion(raw)
    if (!normalized) continue
    if (!best || comparePatchMajorMinor(normalized, best) > 0) {
      best = normalized
    }
  }
  return best
}

export function patchFromGameVersion(version: string | null | undefined): string | null {
  const normalized = normalizePatchNotesVersion(version)
  return normalized || null
}

/** Affichage utilisateur : 16.16.1 → 16.16 */
export function formatBuildPatchVersion(version: string | null | undefined): string {
  return patchFromGameVersion(version) ?? String(version ?? '').trim()
}
