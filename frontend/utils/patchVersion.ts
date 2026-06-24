import { normalizePatchNotesVersion } from '~/stores/PatchNotesStore'

/** Compare two major.minor patch labels (e.g. 16.12 vs 16.13). */
export function comparePatchMajorMinor(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  const [aM, aMi] = a.split('.').map(Number)
  const [bM, bMi] = b.split('.').map(Number)
  if (!Number.isFinite(aM) || !Number.isFinite(bMi)) return 0
  if (aM !== bM) return aM - bM
  return aMi - bMi
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
