/**
 * Pure incident lifecycle: open → (reminder) → resolved.
 * Only critical incidents produce notifications; warnings are tracked for the admin and the daily recap.
 */
import type { DetectedIncident, IncidentSeverity } from './incidentRules.js'

export type ActiveIncident = {
  code: string
  severity: IncidentSeverity
  title: string
  message: string
  context?: Record<string, string | number>
  openedAt: string
  lastSeenAt: string
  lastNotifiedAt: string | null
}

export type ResolvedIncident = ActiveIncident & { resolvedAt: string }

export type IncidentState = {
  active: ActiveIncident[]
  /** Most recent first. */
  history: ResolvedIncident[]
}

export type IncidentNotification = {
  kind: 'opened' | 'reminder' | 'resolved'
  incident: ActiveIncident | ResolvedIncident
}

export type ReconcileOptions = { reminderMs: number; historyLimit: number }

export const EMPTY_INCIDENT_STATE: IncidentState = { active: [], history: [] }

export function reconcileIncidents(
  state: IncidentState,
  detected: DetectedIncident[],
  nowMs: number,
  opts: ReconcileOptions
): { state: IncidentState; notifications: IncidentNotification[] } {
  const now = new Date(nowMs).toISOString()
  const detectedByCode = new Map(detected.map((d) => [d.code, d]))
  const notifications: IncidentNotification[] = []
  const active: ActiveIncident[] = []
  const resolved: ResolvedIncident[] = []

  for (const current of state.active) {
    const d = detectedByCode.get(current.code)
    if (!d) {
      const done: ResolvedIncident = { ...current, resolvedAt: now }
      resolved.push(done)
      if (current.severity === 'critical') notifications.push({ kind: 'resolved', incident: done })
      continue
    }
    detectedByCode.delete(current.code)
    const due =
      d.severity === 'critical' &&
      (current.lastNotifiedAt === null || nowMs - Date.parse(current.lastNotifiedAt) >= opts.reminderMs)
    const next: ActiveIncident = {
      ...current,
      severity: d.severity,
      title: d.title,
      message: d.message,
      context: d.context,
      lastSeenAt: now,
      lastNotifiedAt: due ? now : current.lastNotifiedAt,
    }
    active.push(next)
    if (due) notifications.push({ kind: current.lastNotifiedAt === null ? 'opened' : 'reminder', incident: next })
  }

  for (const d of detectedByCode.values()) {
    const critical = d.severity === 'critical'
    const opened: ActiveIncident = {
      code: d.code,
      severity: d.severity,
      title: d.title,
      message: d.message,
      context: d.context,
      openedAt: now,
      lastSeenAt: now,
      lastNotifiedAt: critical ? now : null,
    }
    active.push(opened)
    if (critical) notifications.push({ kind: 'opened', incident: opened })
  }

  const history = [...resolved.reverse(), ...state.history].slice(0, opts.historyLimit)
  return { state: { active, history }, notifications }
}
