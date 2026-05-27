import { getPatchFromVersion, loadCurrentGameVersion } from '../services/RiotConfigService.js'

const PATCH_CACHE_TTL_MS = 10 * 60_000

type PatchCache = {
  patch: string
  expiresAt: number
}

let cache: PatchCache | null = null

export async function currentPatch(): Promise<string> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) return cache.patch

  const currentVersion = await loadCurrentGameVersion()
  let patch = 'unknown'
  if (!currentVersion.isErr()) {
    const payload = currentVersion.unwrap()
    if (payload?.currentVersion) {
      patch = getPatchFromVersion(payload.currentVersion)
    }
  }

  if (patch === 'unknown') {
    const fromEnv = String(process.env.CURRENT_PATCH ?? '')
      .trim()
      .toLowerCase()
    if (fromEnv.length > 0) patch = fromEnv
  }

  cache = { patch, expiresAt: now + PATCH_CACHE_TTL_MS }
  return patch
}
