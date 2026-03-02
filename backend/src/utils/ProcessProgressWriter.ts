/**
 * Process progress and stop-request files for admin UI and graceful script shutdown.
 * Files: data/cron/{scriptId}-progress.json, data/cron/stop-request-{scriptId}.json
 */
import { promises as fs } from 'fs'
import { join } from 'path'

const CRON_DIR = join(process.cwd(), 'data', 'cron')

export interface ProgressData {
  pid?: number
  phase: string
  startedAt?: string
  lastUpdatedAt?: string
  metrics?: Record<string, number | string | boolean>
}

const progressFiles = new Map<string, string>()
function progressPath(scriptId: string): string {
  let p = progressFiles.get(scriptId)
  if (!p) {
    const safe = scriptId.replace(/[^a-zA-Z0-9_-]/g, '_')
    p = join(CRON_DIR, `${safe}-progress.json`)
    progressFiles.set(scriptId, p)
  }
  return p
}

function stopRequestPath(scriptId: string): string {
  const safe = scriptId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(CRON_DIR, `stop-request-${safe}.json`)
}

export async function writeProgress(scriptId: string, data: Partial<ProgressData>): Promise<void> {
  await fs.mkdir(CRON_DIR, { recursive: true })
  const now = new Date().toISOString()
  const full: ProgressData = {
    ...data,
    phase: data.phase ?? 'unknown',
    lastUpdatedAt: now,
    startedAt: data.startedAt ?? data.lastUpdatedAt ?? now,
    metrics: data.metrics ?? {},
  }
  await fs.writeFile(progressPath(scriptId), JSON.stringify(full, null, 0), 'utf-8')
}

export async function readProgress(scriptId: string): Promise<ProgressData | null> {
  try {
    const raw = await fs.readFile(progressPath(scriptId), 'utf-8')
    return JSON.parse(raw) as ProgressData
  } catch {
    return null
  }
}

export async function readAllProgress(): Promise<Record<string, ProgressData>> {
  const result: Record<string, ProgressData> = {}
  try {
    const files = await fs.readdir(CRON_DIR)
    for (const f of files) {
      if (f.endsWith('-progress.json')) {
        const base = f.replace(/-progress\.json$/, '')
        const scriptId = base.replace(/^riot_/, 'riot:')
        const raw = await fs.readFile(join(CRON_DIR, f), 'utf-8').catch(() => '{}')
        try {
          result[scriptId] = JSON.parse(raw) as ProgressData
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // dir may not exist
  }
  return result
}

export async function isStopRequested(scriptId: string): Promise<boolean> {
  try {
    await fs.access(stopRequestPath(scriptId))
    return true
  } catch {
    return false
  }
}

export async function clearProgressAndStopRequest(scriptId: string): Promise<void> {
  try {
    await fs.unlink(progressPath(scriptId))
  } catch {
    // ignore
  }
  try {
    await fs.unlink(stopRequestPath(scriptId))
  } catch {
    // ignore
  }
}

export async function writeStopRequest(scriptId: string): Promise<void> {
  await fs.mkdir(CRON_DIR, { recursive: true })
  await fs.writeFile(
    stopRequestPath(scriptId),
    JSON.stringify({ requestedAt: new Date().toISOString() }, null, 0),
    'utf-8'
  )
}
