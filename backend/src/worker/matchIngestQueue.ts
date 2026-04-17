/**
 * Write-behind queue: poller writes match JSON here; DB ingest runs asynchronously.
 * Disable with MATCH_INGEST_FILE_QUEUE=0 (default: enabled).
 */
import { access, mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
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
    (n) =>
      n.endsWith('.json') &&
      !n.startsWith('.') &&
      !n.includes('.err.') &&
      !n.includes('.processing.')
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
    (n) =>
      n.endsWith('.json') &&
      !n.startsWith('.') &&
      !n.includes('.err.') &&
      !n.includes('.processing.')
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

function processingPathForQueueFile(p: string): string {
  return p.replace(/\.json$/i, `.processing.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.json`)
}

/**
 * Atomically claim oldest queue files by renaming them to a processing path.
 * Claimed files are hidden from backpressure depth (`countMatchIngestQueueFiles`).
 */
export async function claimOldestMatchIngestQueueFilePaths(limit: number): Promise<string[]> {
  if (limit <= 0) return []
  const candidates = await pickOldestMatchIngestQueueFilePaths(limit * 4)
  if (candidates.length === 0) return []
  const claimed: string[] = []
  for (const p of candidates) {
    if (claimed.length >= limit) break
    const claimedPath = processingPathForQueueFile(p)
    try {
      await rename(p, claimedPath)
      claimed.push(claimedPath)
    } catch {
      // Another worker likely claimed/deleted it first.
    }
  }
  return claimed
}

/**
 * Reverts aborted / stale "processing" queue files back to pending so they can be ingested again.
 *
 * - `.abort.<ts>.json`  : created when an ingest was interrupted (SIGINT). We always requeue these.
 * - `.processing.<pid>.<ts>.<rand>.json` : claimed by a worker that died before completing.
 *   Requeued only when mtime is older than `staleProcessingMaxAgeMs` to avoid racing live workers.
 *
 * Naming scheme reference (see `processingPathForQueueFile`):
 *   original:   `<matchId>.json`
 *   claimed:    `<matchId>.processing.<pid>.<ts>.<rand>.json`
 *   aborted:    `<matchId>.processing.<pid>.<ts>.<rand>.abort.<ts2>.json`
 */
export async function recoverAbortedAndStaleFileQueueFiles(
  staleProcessingMaxAgeMs: number
): Promise<{ abortRequeued: number; staleProcessingRequeued: number; skipped: number }> {
  if (!isMatchIngestFileQueueEnabled()) {
    return { abortRequeued: 0, staleProcessingRequeued: 0, skipped: 0 }
  }
  const dir = getMatchIngestQueueDir()
  const names = await readdir(dir).catch(() => [] as string[])
  const now = Date.now()
  let abortRequeued = 0
  let staleProcessingRequeued = 0
  let skipped = 0

  for (const name of names) {
    if (name.startsWith('.') || !name.endsWith('.json')) continue
    // Always keep original pending files / error markers untouched here.
    if (name.includes('.err.')) continue
    const full = path.join(dir, name)

    const isAbort = name.includes('.abort.')
    const isProcessing = name.includes('.processing.')
    if (!isAbort && !isProcessing) continue

    // Extract original `<matchId>.json` by stripping everything from `.processing.` onward.
    const processingIdx = name.indexOf('.processing.')
    if (processingIdx <= 0) {
      skipped++
      continue
    }
    const base = name.slice(0, processingIdx)
    const target = path.join(dir, `${base}.json`)

    if (isProcessing && !isAbort) {
      const st = await stat(full).catch(() => null)
      if (!st) {
        skipped++
        continue
      }
      if (now - st.mtimeMs < staleProcessingMaxAgeMs) {
        skipped++
        continue
      }
    }

    if (await fileExists(target)) {
      // Original re-enqueued since; drop the stale marker to avoid duplicates.
      await unlink(full).catch(() => undefined)
      skipped++
      continue
    }

    try {
      await rename(full, target)
      if (isAbort) abortRequeued++
      else staleProcessingRequeued++
    } catch {
      skipped++
    }
  }

  return { abortRequeued, staleProcessingRequeued, skipped }
}
