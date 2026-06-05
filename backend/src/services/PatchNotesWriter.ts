import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import type { PatchNotesData, PatchNotesIndex } from '../types/patchNotes.js'
import { comparePatchVersions } from '../utils/patchVersion.js'

const DATA_DIR = join(process.cwd(), 'data', 'patch-notes')

export function getPatchNotesDataDir(): string {
  return DATA_DIR
}

export async function writePatch(version: string, data: PatchNotesData): Promise<void> {
  const dirResult = await FileManager.ensureDir(DATA_DIR)
  if (dirResult.isErr()) {
    throw new Error(dirResult.unwrapErr().message)
  }

  const filePath = join(DATA_DIR, `patch-${version}.json`)
  const writeResult = await FileManager.writeJson(filePath, data)
  if (writeResult.isErr()) {
    throw new Error(writeResult.unwrapErr().message)
  }
}

export async function updateIndex(version: string): Promise<PatchNotesIndex> {
  const indexPath = join(DATA_DIR, 'index.json')
  const readResult = await FileManager.readJson<PatchNotesIndex>(indexPath)

  let index: PatchNotesIndex
  if (readResult.isOk()) {
    index = readResult.unwrap()
  } else {
    index = { latest: version, patches: [] }
  }

  if (!index.patches.includes(version)) {
    index.patches.push(version)
    index.patches.sort(comparePatchVersions)
  }

  if (!index.latest || comparePatchVersions(version, index.latest) > 0) {
    index.latest = version
  }

  const writeResult = await FileManager.writeJson(indexPath, index)
  if (writeResult.isErr()) {
    throw new Error(writeResult.unwrapErr().message)
  }

  return index
}
