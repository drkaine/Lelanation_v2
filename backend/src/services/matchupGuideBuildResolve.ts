import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'

const buildsDir = join(process.cwd(), 'data', 'builds')
const BUILD_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type GuideRecord = Record<string, unknown> & {
  buildId?: string
  build?: unknown
}

export function extractMatchupGuideBuildId(guide: GuideRecord): string | null {
  if (typeof guide.buildId === 'string' && BUILD_ID_REGEX.test(guide.buildId)) {
    return guide.buildId
  }
  const embedded = guide.build
  if (embedded && typeof embedded === 'object') {
    const id = (embedded as { id?: string }).id
    if (typeof id === 'string' && BUILD_ID_REGEX.test(id)) return id
  }
  if (typeof guide.id === 'string' && BUILD_ID_REGEX.test(guide.id)) {
    return guide.id
  }
  return null
}

export async function readPublicBuildById(buildId: string): Promise<unknown | null> {
  const filePath = join(buildsDir, `${buildId}.json`)
  const readResult = await FileManager.readJson(filePath)
  if (readResult.isOk()) return readResult.unwrap()
  return null
}

/** Attach build from `data/builds/{buildId}.json` when the guide only stores a reference. */
export async function resolveMatchupGuideBuild<T extends GuideRecord>(guide: T): Promise<T> {
  if (guide.build && typeof guide.build === 'object') {
    return guide
  }
  const buildId = extractMatchupGuideBuildId(guide)
  if (!buildId) return guide
  const build = await readPublicBuildById(buildId)
  if (!build) return guide
  return { ...guide, buildId, build }
}

/** Persist guides as `buildId` only when the build file exists on disk (no duplicate embed). */
export async function compactMatchupGuideForStorage<T extends GuideRecord>(guide: T): Promise<T> {
  const buildId = extractMatchupGuideBuildId(guide)
  if (!buildId) return guide
  const onDisk = await readPublicBuildById(buildId)
  if (!onDisk) return guide
  const compact = { ...guide, buildId } as T
  delete (compact as GuideRecord).build
  return compact
}
