import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'

const buildsDir = join(process.cwd(), 'data', 'builds')

type GuideWithBuild = {
  id?: string
  visibility?: 'public' | 'private'
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

  const embedded = guide.build
  if (!embedded || typeof embedded !== 'object') {
    return { synced: false, reason: 'no embedded build' }
  }

  const buildRecord = embedded as GuideWithBuild['build'] & Record<string, unknown>
  const buildId =
    (typeof buildRecord.id === 'string' && buildRecord.id.length > 0 ? buildRecord.id : null) ??
    (typeof guide.id === 'string' && guide.id.length > 0 ? guide.id : null)

  if (!buildId) {
    return { synced: false, reason: 'missing build id' }
  }

  const dirResult = await FileManager.ensureDir(buildsDir)
  if (dirResult.isErr()) {
    throw new Error(dirResult.unwrapErr().message)
  }

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
