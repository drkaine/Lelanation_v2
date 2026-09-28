import { join } from 'path'
import { promises as fs } from 'fs'
import { Result } from '../utils/Result.js'
import { NotFoundError, type AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'

type JsonResult = ReturnType<typeof FileManager.readJson>

/** Game data directories: backend copy first, frontend public copy as fallback. */
export type GameDataDirs = { backendDir: string; frontendDir: string }

/**
 * Static game data only changes when a new patch is synced, but championFull.json /
 * item.json are large: parse them once per file mtime instead of on every request.
 */
const fileCache = new Map<string, { mtimeMs: number; data: unknown }>()

async function readCachedJson(filePath: string): JsonResult {
  try {
    const { mtimeMs } = await fs.stat(filePath)
    const hit = fileCache.get(filePath)
    if (hit && hit.mtimeMs === mtimeMs) return Result.ok<unknown, AppError>(hit.data)
    const result = await FileManager.readJson(filePath)
    if (result.isOk()) {
      // Keep the cache small: one entry per (version, language, file) currently served.
      if (fileCache.size >= 64) fileCache.delete(fileCache.keys().next().value as string)
      fileCache.set(filePath, { mtimeMs, data: result.unwrap() })
    }
    return result
  } catch {
    return FileManager.readJson(filePath)
  }
}

/** Missing file (`FileManager` code) or `NotFoundError`: 404 rather than 500. */
export function isGameDataNotFound(error: AppError): boolean {
  return error instanceof NotFoundError || error.code === 'FILE_NOT_FOUND'
}

/**
 * Try to read JSON file from backend, fallback to frontend public directory
 * This allows the API to work even after backend data is deleted (saves disk space)
 */
export async function readGameDataFile(backendPath: string, frontendPath: string): JsonResult {
  const backendResult = await readCachedJson(backendPath)
  if (backendResult.isOk()) return backendResult
  // Both failed: return the frontend error (more recent)
  return readCachedJson(frontendPath)
}

/** `<dir>/<version>/<language>/<file>`; the next file of `files` is tried when the previous is not found. */
export async function readVersionedGameData(
  dirs: GameDataDirs,
  version: string,
  language: string,
  files: readonly string[]
): JsonResult {
  let result: Awaited<JsonResult> | null = null
  for (const file of files) {
    result = await readGameDataFile(
      join(dirs.backendDir, version, language, file),
      join(dirs.frontendDir, version, language, file)
    )
    if (result.isOk() || !isGameDataNotFound(result.unwrapErr())) return result
  }
  return result!
}
