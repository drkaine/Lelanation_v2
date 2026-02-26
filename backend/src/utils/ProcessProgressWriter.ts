/**
 * Process progress and graceful stop for admin-tracked scripts.
 * - Writes metrics/phase to data/cron/process-progress-{scriptId}.json
 * - Stop request: data/cron/stop-request-{scriptId}.json (scripts check this to exit gracefully)
 */

import { join } from 'path'
import { FileManager } from './fileManager.js'

const CRON_DIR = join(process.cwd(), 'data', 'cron')

export type ProcessProgressMetrics = {
  participantsProcessed?: number
  participantsMissingData?: number
  newPlayersAdded?: number
  matchesCollected?: number
  matchesFromDb?: number
  requestsUsed?: number
  requestLimit?: number
  errors?: number
  [key: string]: number | undefined
}

export type ProcessProgress = {
  scriptId: string
  pid?: number
  phase: string
  startedAt: string
  lastUpdatedAt: string
  metrics: ProcessProgressMetrics
}

function scriptIdToSafeFilename(scriptId: string): string {
  return scriptId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function progressFilePath(scriptId: string): string {
  return join(CRON_DIR, `process-progress-${scriptIdToSafeFilename(scriptId)}.json`)
}

function stopRequestFilePath(scriptId: string): string {
  return join(CRON_DIR, `stop-request-${scriptIdToSafeFilename(scriptId)}.json`)
}

/**
 * Write or update progress for a script. Merges with existing metrics.
 */
export async function writeProgress(
  scriptId: string,
  update: Partial<Pick<ProcessProgress, 'pid' | 'phase' | 'metrics'>>
): Promise<void> {
  const now = new Date().toISOString()
  const existing = await readProgress(scriptId)
  const base: ProcessProgress = existing ?? {
    scriptId,
    phase: 'idle',
    startedAt: now,
    lastUpdatedAt: now,
    metrics: {},
  }
  const next: ProcessProgress = {
    ...base,
    ...(update.pid !== undefined && { pid: update.pid }),
    ...(update.phase !== undefined && { phase: update.phase }),
    lastUpdatedAt: now,
    metrics: { ...base.metrics, ...(update.metrics ?? {}) },
  }
  if (update.phase !== undefined) next.phase = update.phase
  if (!existing) next.startedAt = now
  await FileManager.ensureDir(CRON_DIR)
  await FileManager.writeJson(progressFilePath(scriptId), next)
}

/**
 * Read current progress for a script (null if never written).
 */
export async function readProgress(scriptId: string): Promise<ProcessProgress | null> {
  const r = await FileManager.readJson<ProcessProgress>(progressFilePath(scriptId))
  if (r.isErr()) return null
  return r.unwrap()
}

/**
 * Read all progress files (for admin process-status endpoint). Uses scriptId from file content.
 */
export async function readAllProgress(): Promise<Record<string, ProcessProgress | null>> {
  const { promises: fs } = await import('fs')
  const out: Record<string, ProcessProgress | null> = {}
  try {
    const files = await fs.readdir(CRON_DIR)
    const progressFiles = files.filter((f) => f.startsWith('process-progress-') && f.endsWith('.json'))
    for (const f of progressFiles) {
      const fullPath = join(CRON_DIR, f)
      const r = await FileManager.readJson<ProcessProgress>(fullPath)
      if (r.isOk()) {
        const p = r.unwrap()
        if (p.scriptId) out[p.scriptId] = p
      }
    }
  } catch {
    // directory may not exist
  }
  return out
}

/**
 * Check if a stop has been requested for this script. If true, script should exit after current batch.
 */
export async function isStopRequested(scriptId: string): Promise<boolean> {
  const r = await FileManager.readJson<{ requestedAt?: string }>(stopRequestFilePath(scriptId))
  return r.isOk()
}

/**
 * Write stop request (called by admin). Scripts poll isStopRequested() and exit gracefully.
 */
export async function writeStopRequest(scriptId: string): Promise<void> {
  await FileManager.ensureDir(CRON_DIR)
  await FileManager.writeJson(stopRequestFilePath(scriptId), {
    requestedAt: new Date().toISOString(),
  })
}

/**
 * Clear stop request and progress after script exits (optional cleanup).
 */
export async function clearProgressAndStopRequest(scriptId: string): Promise<void> {
  const { promises: fs } = await import('fs')
  try {
    await fs.unlink(stopRequestFilePath(scriptId))
  } catch {
    // ignore
  }
  try {
    await fs.unlink(progressFilePath(scriptId))
  } catch {
    // ignore
  }
}
