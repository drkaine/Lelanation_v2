import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import {
  extractMatchupGuideBuildId,
  readPublicBuildById,
} from './matchupGuideBuildResolve.js'

const buildsDir = join(process.cwd(), 'data', 'builds')

type GuideWithBuild = {
  id?: string
  visibility?: 'public' | 'private'
  buildId?: string
  build?: object & {
    id?: string
    visibility?: 'public' | 'private'
    matchupGuideEmbed?: boolean
    patchStale?: unknown
  }
}

export async function syncPublicBuildFromMatchupGuide(
  guide: GuideWithBuild
): Promise<{ synced: boolean; buildId?: string; reason?: string }> {
  if (guide.visibility === 'private') {
    return { synced: false, reason: 'private guide' }
  }

  const buildId = extractMatchupGuideBuildId(guide)
  if (!buildId) {
    return { synced: false, reason: 'missing build id' }
  }

  const existing = await readPublicBuildById(buildId)
  if (existing && !guide.build) {
    return { synced: true, buildId, reason: 'build file already exists' }
  }

  const embedded = guide.build
  if (!embedded || typeof embedded !== 'object') {
    return existing
      ? { synced: true, buildId, reason: 'linked build only' }
      : { synced: false, reason: 'no embedded build and no build file' }
  }

  const dirResult = await FileManager.ensureDir(buildsDir)
  if (dirResult.isErr()) {
    throw new Error(dirResult.unwrapErr().message)
  }

  const buildRecord = embedded as GuideWithBuild['build'] & Record<string, unknown>
  const { matchupGuideEmbed: _embed, patchStale: _patchStale, ...buildRest } = buildRecord
  const fileName = `${buildId}.json`
  const filePath = join(buildsDir, fileName)

  const buildPayload = {
    ...buildRest,
    id: buildId,
    visibility: 'public' as const,
    patchStale: null,
    fileName,
    savedAt: new Date().toISOString(),
  }

  const writeResult = await FileManager.writeJson(filePath, buildPayload)
  if (writeResult.isErr()) {
    throw new Error(writeResult.unwrapErr().message)
  }

  return { synced: true, buildId }
}
