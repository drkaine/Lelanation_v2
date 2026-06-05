import { join } from 'path'
import { readdir } from 'fs/promises'
import { FileManager } from '../utils/fileManager.js'
import { comparePatchVersions } from '../utils/patchVersion.js'
import type { PatchNotesData, PatchNotesIndex } from '../types/patchNotes.js'
import { getPatchNotesDataDir } from './PatchNotesWriter.js'

const backendDataDir = getPatchNotesDataDir()
const frontendDataDir = join(process.cwd(), '..', 'frontend', 'public', 'data', 'patch-notes')

async function readPatchFile<T>(backendPath: string, frontendPath: string) {
  const backendResult = await FileManager.readJson<T>(backendPath)
  if (backendResult.isOk()) return backendResult
  return FileManager.readJson<T>(frontendPath)
}

export class PatchNotesService {
  private patchCache = new Map<string, PatchNotesData>()
  private indexCache: PatchNotesIndex | null = null

  async getIndex(): Promise<PatchNotesIndex | null> {
    if (this.indexCache) return this.indexCache

    const backendPath = join(backendDataDir, 'index.json')
    const frontendPath = join(frontendDataDir, 'index.json')
    const result = await readPatchFile<PatchNotesIndex>(backendPath, frontendPath)
    if (result.isErr()) return null

    const index = result.unwrap()
    index.patches = [...index.patches].sort(comparePatchVersions)
    this.indexCache = index
    return index
  }

  async getPatch(version: string): Promise<PatchNotesData | null> {
    if (this.patchCache.has(version)) {
      return this.patchCache.get(version)!
    }

    const backendPath = join(backendDataDir, `patch-${version}.json`)
    const frontendPath = join(frontendDataDir, `patch-${version}.json`)
    const result = await readPatchFile<PatchNotesData>(backendPath, frontendPath)
    if (result.isErr()) return null

    const patch = result.unwrap()
    this.patchCache.set(version, patch)
    return patch
  }

  async loadAllPatches(): Promise<PatchNotesData[]> {
    const index = await this.getIndex()
    if (index?.patches.length) {
      const patches: PatchNotesData[] = []
      for (const version of index.patches) {
        const patch = await this.getPatch(version)
        if (patch) patches.push(patch)
      }
      return patches.sort((a, b) => comparePatchVersions(a.version, b.version))
    }

    const patches: PatchNotesData[] = []
    for (const dir of [backendDataDir, frontendDataDir]) {
      try {
        const entries = await readdir(dir)
        for (const entry of entries) {
          const match = entry.match(/^patch-(.+)\.json$/)
          if (!match) continue
          const version = match[1]
          if (patches.some(p => p.version === version)) continue
          const patch = await this.getPatch(version)
          if (patch) patches.push(patch)
        }
      } catch {
        // directory may not exist yet
      }
    }

    return patches.sort((a, b) => comparePatchVersions(a.version, b.version))
  }

  clearCache(): void {
    this.patchCache.clear()
    this.indexCache = null
  }
}
