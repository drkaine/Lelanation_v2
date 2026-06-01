import { promises as fs } from 'node:fs'
import { join, resolve, isAbsolute } from 'node:path'
import { sql } from '../db/client.js'
import { getQueueMetrics } from '../queues/index.js'
import type { FullSnapshot, WindowLabel } from '../observability/poller-metrics/types.js'
import { readLogFileTail } from './readLogFileTail.js'

const WINDOW_LABELS: WindowLabel[] = ['10m', '30m', '1h', '6h', '12h', '24h']

export type PollerMetricsAdminPayload = {
  ok: boolean
  stale: boolean
  ageMs: number | null
  filePath: string | null
  snapshots: Partial<Record<WindowLabel, FullSnapshot>>
  latest10m: FullSnapshot | null
  latest30m: FullSnapshot | null
  latest1h: FullSnapshot | null
}

export type PollerLiveStatus = {
  queue: Awaited<ReturnType<typeof getQueueMetrics>>
  dataLagSeconds: number | null
}

export type PollerObservabilityAdminResponse = PollerMetricsAdminPayload & {
  live: PollerLiveStatus | null
}

function resolveSnapshotCandidates(backendRoot: string, projectLogsDir: string): string[] {
  const envPath = process.env.OBSERVABILITY_SNAPSHOT_PATH?.trim()
  const fromEnv = envPath
    ? isAbsolute(envPath)
      ? [envPath]
      : [resolve(backendRoot, envPath), resolve(backendRoot, '..', envPath)]
    : []
  return [
    ...fromEnv,
    join(backendRoot, 'poller-observability.json'),
    join(projectLogsDir, 'poller-observability.json'),
  ]
}

async function readFirstExisting(paths: string[]): Promise<{ raw: string; filePath: string } | null> {
  for (const filePath of paths) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      return { raw, filePath }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw e
    }
  }
  return null
}

export async function loadPollerMetricsAdminPayload(
  backendRoot: string,
  projectLogsDir: string,
): Promise<PollerMetricsAdminPayload> {
  const candidates = resolveSnapshotCandidates(backendRoot, projectLogsDir)
  const found = await readFirstExisting(candidates)
  if (!found) {
    return {
      ok: false,
      stale: true,
      ageMs: null,
      filePath: null,
      snapshots: {},
      latest10m: null,
      latest30m: null,
      latest1h: null,
    }
  }

  let snapshots: Partial<Record<WindowLabel, FullSnapshot>> = {}
  try {
    snapshots = JSON.parse(found.raw) as Partial<Record<WindowLabel, FullSnapshot>>
  } catch {
    return {
      ok: false,
      stale: true,
      ageMs: null,
      filePath: found.filePath,
      snapshots: {},
      latest10m: null,
      latest30m: null,
      latest1h: null,
    }
  }

  const latest10m = snapshots['10m'] ?? null
  const latest30m = snapshots['30m'] ?? null
  const latest1h = snapshots['1h'] ?? null
  const ts = latest10m?.ts ?? Math.max(...WINDOW_LABELS.map((w) => snapshots[w]?.ts ?? 0), 0)
  const ageMs = ts > 0 ? Date.now() - ts : null
  const stale = ageMs == null || ageMs > 15 * 60_000

  return {
    ok: true,
    stale,
    ageMs,
    filePath: found.filePath,
    snapshots,
    latest10m,
    latest30m,
    latest1h,
  }
}

async function getDataLagSeconds(): Promise<number | null> {
  try {
    const rows = await sql<{ lag_seconds: number | null }[]>`
      SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::bigint AS lag_seconds
      FROM processed_matches
    `
    return rows[0]?.lag_seconds ?? null
  } catch {
    return null
  }
}

export async function loadPollerObservabilityAdminResponse(
  backendRoot: string,
  projectLogsDir: string,
): Promise<PollerObservabilityAdminResponse> {
  const metrics = await loadPollerMetricsAdminPayload(backendRoot, projectLogsDir)
  try {
    const queue = await getQueueMetrics()
    const dataLagSeconds = await getDataLagSeconds()
    return { ...metrics, live: { queue, dataLagSeconds } }
  } catch {
    return { ...metrics, live: null }
  }
}

/** PM2 log files (name may still be `poller-v2-*` in ecosystem config). */
export async function readPollerProcessLogTail(
  projectLogsDir: string,
  opts: { stream?: 'out' | 'error' | 'both'; lines?: number; maxBytes?: number },
): Promise<{ log: string[]; files: string[] }> {
  const lines = Math.min(Math.max(opts.lines ?? 200, 1), 1000)
  const maxBytes = opts.maxBytes ?? 768 * 1024
  const logBase = process.env.POLLER_PM2_LOG_BASENAME?.trim() || 'poller-v2'
  const streams =
    opts.stream === 'error' ? ['error'] : opts.stream === 'out' ? ['out'] : (['out', 'error'] as const)

  const files: string[] = []
  const chunks: string[] = []
  for (const stream of streams) {
    const filePath = join(projectLogsDir, `${logBase}-${stream}.log`)
    files.push(filePath)
    const tail = await readLogFileTail(filePath, maxBytes)
    if (tail) chunks.push(tail)
  }

  const allLines = chunks.join('\n').split(/\r?\n/).filter((l) => l.trim().length > 0)
  return { log: allLines.slice(-lines).reverse(), files }
}
