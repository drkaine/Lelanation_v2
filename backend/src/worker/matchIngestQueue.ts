/**
 * Write-behind queue: poller writes match JSON here; DB ingest runs asynchronously.
 * Disable with MATCH_INGEST_FILE_QUEUE=0 (default: enabled).
 */
import { access, mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Write-behind: poller writes match JSON to disk; ingest runs async (same process).
 * Default: enabled when unset. Set MATCH_INGEST_FILE_QUEUE=0 to use inline Prisma only.
 */
export function isMatchIngestFileQueueEnabled(): boolean {
  const raw = process.env.MATCH_INGEST_FILE_QUEUE
  if (raw === undefined || raw.trim() === '') return true
  const v = raw.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'off') return false
  return true
}

export function getMatchIngestQueueDir(): string {
  return path.resolve(process.env.MATCH_INGEST_QUEUE_DIR ?? path.join(process.cwd(), 'data', 'match-ingest-queue'))
}

export async function ensureMatchIngestQueueDir(): Promise<string> {
  const dir = getMatchIngestQueueDir()
  await mkdir(dir, { recursive: true })
  return dir
}

export function sanitizeMatchQueueFilename(matchId: string): string {
  let s = matchId.replace(/[/\\]/g, '_').replace(/\s+/g, '_')
  if (s.length > 180) s = s.slice(0, 180)
  return s
}

export type MatchIngestQueuePayloadV1 = {
  v: 1
  stepId: string
  matchId: string
  region: string
  matchDto: unknown
  timelineDto: unknown | null
  puuidKeyVersion: string | null
  trackerIdx: number
  enqueuedAt: number
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Atomic enqueue. If the target json already exists, returns 'duplicate' (idempotent).
 */
export async function tryEnqueueMatchIngestPayload(
  payload: MatchIngestQueuePayloadV1
): Promise<'written' | 'duplicate'> {
  const dir = await ensureMatchIngestQueueDir()
  const base = sanitizeMatchQueueFilename(payload.matchId)
  const finalPath = path.join(dir, `${base}.json`)
  if (await fileExists(finalPath)) return 'duplicate'
  const tmpPath = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`)
  await writeFile(tmpPath, JSON.stringify(payload), 'utf8')
  await rename(tmpPath, finalPath)
  return 'written'
}

export async function countMatchIngestQueueFiles(): Promise<number> {
  if (!isMatchIngestFileQueueEnabled()) return 0
  const dir = getMatchIngestQueueDir()
  const names = await readdir(dir).catch(() => [] as string[])
  return names.filter(
    (n) => n.endsWith('.json') && !n.startsWith('.') && !n.includes('.err.')
  ).length
}

export async function pickOldestMatchIngestQueueFilePath(): Promise<string | null> {
  const paths = await pickOldestMatchIngestQueueFilePaths(1)
  return paths[0] ?? null
}

/** Oldest files first (mtime). */
export async function pickOldestMatchIngestQueueFilePaths(limit: number): Promise<string[]> {
  if (limit <= 0) return []
  const dir = getMatchIngestQueueDir()
  const names = await readdir(dir).catch(() => [] as string[])
  const jsonFiles = names.filter(
    (n) => n.endsWith('.json') && !n.startsWith('.') && !n.includes('.err.')
  )
  if (jsonFiles.length === 0) return []
  const withMtime: Array<{ name: string; mtime: number }> = []
  for (const n of jsonFiles) {
    const p = path.join(dir, n)
    const st = await stat(p).catch(() => null)
    if (!st) continue
    withMtime.push({ name: n, mtime: st.mtimeMs })
  }
  withMtime.sort((a, b) => a.mtime - b.mtime)
  return withMtime.slice(0, limit).map((x) => path.join(dir, x.name))
}
