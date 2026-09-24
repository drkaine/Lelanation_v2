export type MonitoringSeverity = 'critical' | 'warning'
export type MonitoringHealth = 'ok' | MonitoringSeverity

export function formatDurationMin(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  if (m < 60 * 24) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
  return `${Math.floor(m / (60 * 24))} j ${Math.floor((m % (60 * 24)) / 60)} h`
}

export function incidentDurationMin(
  openedAt: string,
  resolvedAt: string | null,
  nowMs: number
): number {
  const end = resolvedAt ? Date.parse(resolvedAt) : nowMs
  return Math.max(0, Math.round((end - Date.parse(openedAt)) / 60_000))
}

export function overallHealth(active: Array<{ severity: MonitoringSeverity }>): MonitoringHealth {
  if (active.some(i => i.severity === 'critical')) return 'critical'
  return active.length > 0 ? 'warning' : 'ok'
}
