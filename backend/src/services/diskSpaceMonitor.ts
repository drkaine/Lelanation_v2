import { statfs } from 'node:fs/promises'
import { join } from 'node:path'
import { FileManager } from '../utils/fileManager.js'

export const DISK_ALERT_FIRST_THRESHOLD = 70
export const DISK_ALERT_STEP_PERCENT = 5

export type DiskUsageSnapshot = {
  mountPath: string
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usagePercent: number
}

export type DiskAlertState = {
  lastAlertedThreshold: number
  lastCleanupAtThreshold: number
  lastUsagePercent: number | null
  lastCheckedAt: string | null
  lastEmergencyCleanupAt: string | null
}

export type DiskAlertEvaluation = {
  snapshot: DiskUsageSnapshot
  alertThreshold: number | null
  shouldAlert: boolean
  previousThreshold: number
}

const DEFAULT_STATE: DiskAlertState = {
  lastAlertedThreshold: 0,
  lastCleanupAtThreshold: 0,
  lastUsagePercent: null,
  lastCheckedAt: null,
  lastEmergencyCleanupAt: null,
}

function resolveStatePath(customPath?: string): string {
  return customPath ?? join(process.cwd(), 'data', 'cron', 'disk-alert-state.json')
}

/** Highest alert step crossed: 70, 75, 80, … (null if below 70%). */
export function diskAlertThresholdForUsage(usagePercent: number): number | null {
  if (!Number.isFinite(usagePercent) || usagePercent < DISK_ALERT_FIRST_THRESHOLD) return null
  const step = Math.floor((usagePercent - DISK_ALERT_FIRST_THRESHOLD) / DISK_ALERT_STEP_PERCENT)
  return DISK_ALERT_FIRST_THRESHOLD + step * DISK_ALERT_STEP_PERCENT
}

export function evaluateDiskAlert(
  usagePercent: number,
  lastAlertedThreshold: number
): Pick<DiskAlertEvaluation, 'alertThreshold' | 'shouldAlert' | 'previousThreshold'> {
  const previousThreshold = Math.max(0, lastAlertedThreshold)
  const alertThreshold = diskAlertThresholdForUsage(usagePercent)

  if (alertThreshold == null) {
    return { alertThreshold: null, shouldAlert: false, previousThreshold }
  }

  return {
    alertThreshold,
    shouldAlert: alertThreshold > previousThreshold,
    previousThreshold,
  }
}

export async function readDiskUsage(mountPath: string): Promise<DiskUsageSnapshot> {
  const stats = await statfs(mountPath)
  const blockSize = stats.bsize
  const totalBytes = stats.blocks * blockSize
  const freeBytes = stats.bavail * blockSize
  const usedBytes = Math.max(0, totalBytes - freeBytes)
  const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0

  return {
    mountPath,
    totalBytes,
    usedBytes,
    freeBytes,
    usagePercent: Math.round(usagePercent * 10) / 10,
  }
}

export async function loadDiskAlertState(statePath?: string): Promise<DiskAlertState> {
  const path = resolveStatePath(statePath)
  const result = await FileManager.readJson<DiskAlertState>(path)
  if (result.isErr()) return { ...DEFAULT_STATE }
  const value = result.unwrap()
  return {
    lastAlertedThreshold: Number(value.lastAlertedThreshold ?? 0),
    lastCleanupAtThreshold: Number(value.lastCleanupAtThreshold ?? 0),
    lastUsagePercent:
      value.lastUsagePercent == null ? null : Number(value.lastUsagePercent),
    lastCheckedAt: value.lastCheckedAt ?? null,
    lastEmergencyCleanupAt: value.lastEmergencyCleanupAt ?? null,
  }
}

export async function saveDiskAlertState(
  state: DiskAlertState,
  statePath?: string
): Promise<void> {
  const path = resolveStatePath(statePath)
  const write = await FileManager.writeJson(path, state)
  if (write.isErr()) {
    throw new Error(`Failed to write disk alert state: ${write.unwrapErr().message}`)
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export async function checkDiskSpaceAlert(options?: {
  mountPath?: string
  statePath?: string
}): Promise<DiskAlertEvaluation & { state: DiskAlertState }> {
  const mountPath = options?.mountPath ?? process.env.DISK_SPACE_MONITOR_PATH ?? '/'
  const statePath = options?.statePath

  const snapshot = await readDiskUsage(mountPath)
  const previousState = await loadDiskAlertState(statePath)
  const evaluation = evaluateDiskAlert(snapshot.usagePercent, previousState.lastAlertedThreshold)

  const nextThreshold = evaluation.alertThreshold ?? 0
  const resetCleanup =
    evaluation.alertThreshold == null && previousState.lastAlertedThreshold > 0

  const state: DiskAlertState = {
    lastAlertedThreshold: nextThreshold,
    lastCleanupAtThreshold: resetCleanup ? 0 : previousState.lastCleanupAtThreshold,
    lastUsagePercent: snapshot.usagePercent,
    lastCheckedAt: new Date().toISOString(),
    lastEmergencyCleanupAt: previousState.lastEmergencyCleanupAt,
  }

  await saveDiskAlertState(state, statePath)

  return {
    snapshot,
    ...evaluation,
    state,
  }
}
