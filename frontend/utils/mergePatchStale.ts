import type { Build, PatchStaleInfo, StoredBuild } from '@lelanation/shared-types'

function patchStaleEquals(
  a: PatchStaleInfo | null | undefined,
  b: PatchStaleInfo | null | undefined
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.patchVersion === b.patchVersion && a.categories.join(',') === b.categories.join(',')
}

export function applyPatchStaleToBuild(
  build: Build,
  patchStale: PatchStaleInfo | null | undefined
): Build {
  const next = patchStale ?? null
  if (patchStaleEquals(build.patchStale, next)) return build
  return { ...build, patchStale: next }
}

export function extractPatchStaleMap(
  serverBuilds: Array<Pick<StoredBuild, 'id'> & { patchStale?: PatchStaleInfo | null }>
): Map<string, PatchStaleInfo | null> {
  const map = new Map<string, PatchStaleInfo | null>()
  for (const build of serverBuilds) {
    if (!build?.id) continue
    map.set(build.id, build.patchStale ?? null)
  }
  return map
}

export function mergePatchStaleIntoBuilds(
  builds: Build[],
  patchStaleById: Map<string, PatchStaleInfo | null>
): Build[] {
  return builds.map(build => {
    if (!patchStaleById.has(build.id)) return build
    return applyPatchStaleToBuild(build, patchStaleById.get(build.id))
  })
}
