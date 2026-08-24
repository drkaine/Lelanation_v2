/**
 * Index en mémoire des builds publics stockés en fichiers JSON.
 *
 * Les routes `/api/builds/recent`, `/popular` et `/` relisaient et parsaient
 * l'intégralité des fichiers à CHAQUE requête (O(n) fichiers/requête). Comme les
 * builds ne changent que via cette même API (process unique écrivain), on met en
 * cache l'index parsé avec un TTL court + invalidation explicite sur écriture /
 * suppression. Résultat : au plus un scan disque par TTL (ou par mutation) au lieu
 * d'un scan complet par requête.
 */
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { stripEditSecret } from '../utils/buildEditAuth.js'

export const buildsDir = process.env.BUILDS_DIR?.trim() || join(process.cwd(), 'data', 'builds')

export const BUILD_FILE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i

const INDEX_TTL_MS = (() => {
  const raw = Number(process.env.BUILDS_INDEX_TTL_MS)
  return Number.isFinite(raw) && raw >= 0 ? raw : 5_000
})()

export type BuildRecord = {
  id?: string
  createdAt?: string
  visibility?: string
} & Record<string, unknown>

export interface BuildIndexEntry {
  id: string
  build: BuildRecord
  createdAt: string
  visibility?: string
}

/** Latest public activity timestamp for home / discovery sorting. */
export function getBuildActivityIso(build: BuildRecord): string {
  for (const key of ['updatedAt', 'savedAt', 'createdAt'] as const) {
    const value = build[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return ''
}

export function getBuildActivityTime(build: BuildRecord): number {
  const iso = getBuildActivityIso(build)
  if (!iso) return 0
  const time = new Date(iso).getTime()
  return Number.isFinite(time) ? time : 0
}

export interface BuildIndex {
  /** Toutes les entrées dont le nom de fichier correspond au pattern (fichiers publics). */
  entries: BuildIndexEntry[]
  /** Nombre de fichiers publics détectés (avant filtre de contenu). */
  fileCount: number
}

let cache: { at: number; index: BuildIndex } | null = null

/** Force le prochain accès à re-scanner le disque (après création / suppression). */
export function invalidateBuildIndex(): void {
  cache = null
}

/** Retourne l'index des builds publics, servi depuis le cache si assez frais. */
export async function getBuildIndex(): Promise<BuildIndex> {
  const now = Date.now()
  if (cache && now - cache.at < INDEX_TTL_MS) return cache.index

  const { promises: fs } = await import('fs')
  let files: string[]
  try {
    files = await fs.readdir(buildsDir)
  } catch {
    const empty: BuildIndex = { entries: [], fileCount: 0 }
    cache = { at: now, index: empty }
    return empty
  }

  const buildFiles = files.filter((file) => BUILD_FILE_REGEX.test(file))
  const entries = (
    await Promise.all(
      buildFiles.map(async (file): Promise<BuildIndexEntry | null> => {
        const filePath = join(buildsDir, file)
        const readResult = await FileManager.readJson<BuildRecord>(filePath)
        if (readResult.isErr()) return null
        const build = readResult.unwrap()
        const id = String(build.id ?? file.replace(/\.json$/i, ''))
        return {
          id,
          build: stripEditSecret(build),
          createdAt: build.createdAt ?? '',
          visibility: build.visibility,
        }
      })
    )
  ).filter((entry): entry is BuildIndexEntry => entry !== null)

  const index: BuildIndex = { entries, fileCount: buildFiles.length }
  cache = { at: now, index }
  return index
}
