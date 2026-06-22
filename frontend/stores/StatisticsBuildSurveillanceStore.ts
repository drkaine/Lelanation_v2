import type {
  BuildMetricSnapshot,
  BuildSurveillanceTrigger,
  defaultBuildSurveillanceThresholds,
  hasConfiguredBuildSurveillanceThresholds,
  normalizeBuildSurveillanceThresholds,
  stableBuildAlertsFingerprint,
  type BuildSurveillanceThresholds,
} from '~/utils/buildSurveillance'

const THRESHOLDS_KEY = 'lelanation_build_surveillance_thresholds'
const BASELINES_KEY = 'lelanation_build_surveillance_baselines'
const ACTIVE_ALERTS_KEY = 'lelanation_build_surveillance_active_alerts'
const ALERTS_ACK_AT_KEY = 'lelanation_build_surveillance_alerts_ack_at'
const ALERTS_ACK_SNAPSHOT_KEY = 'lelanation_build_surveillance_alerts_ack_snapshot'
const LAST_CHECKED_AT_KEY = 'lelanation_build_surveillance_last_checked_at'

interface BuildSurveillanceState {
  thresholds: BuildSurveillanceThresholds
  baselines: Record<string, Record<string, BuildMetricSnapshot>>
  activeAlerts: Record<string, BuildSurveillanceTrigger[]>
  checking: boolean
  lastCheckedAt: string | null
  alertsAcknowledgedAt: string | null
  alertsAcknowledgedSnapshot: string | null
}

function loadThresholds(): BuildSurveillanceThresholds {
  if (import.meta.server) return defaultBuildSurveillanceThresholds()
  try {
    const raw = localStorage.getItem(THRESHOLDS_KEY)
    if (!raw) return defaultBuildSurveillanceThresholds()
    return normalizeBuildSurveillanceThresholds(JSON.parse(raw))
  } catch {
    return defaultBuildSurveillanceThresholds()
  }
}

function persistThresholds(thresholds: BuildSurveillanceThresholds): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds))
  } catch {
    // ignore
  }
}

function loadBaselines(): Record<string, Record<string, BuildMetricSnapshot>> {
  if (import.meta.server) return {}
  try {
    const raw = localStorage.getItem(BASELINES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistBaselines(baselines: Record<string, Record<string, BuildMetricSnapshot>>): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(BASELINES_KEY, JSON.stringify(baselines))
  } catch {
    // ignore
  }
}

function loadActiveAlerts(): Record<string, BuildSurveillanceTrigger[]> {
  if (import.meta.server) return {}
  try {
    const raw = localStorage.getItem(ACTIVE_ALERTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistActiveAlerts(activeAlerts: Record<string, BuildSurveillanceTrigger[]>): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(ACTIVE_ALERTS_KEY, JSON.stringify(activeAlerts))
  } catch {
    // ignore
  }
}

function loadAlertsAcknowledgedAt(): string | null {
  if (import.meta.server) return null
  try {
    return localStorage.getItem(ALERTS_ACK_AT_KEY)
  } catch {
    return null
  }
}

function persistAlertsAcknowledgedAt(value: string | null): void {
  if (import.meta.server) return
  try {
    if (value) localStorage.setItem(ALERTS_ACK_AT_KEY, value)
    else localStorage.removeItem(ALERTS_ACK_AT_KEY)
  } catch {
    // ignore
  }
}

function loadAlertsAcknowledgedSnapshot(): string | null {
  if (import.meta.server) return null
  try {
    return localStorage.getItem(ALERTS_ACK_SNAPSHOT_KEY)
  } catch {
    return null
  }
}

function persistAlertsAcknowledgedSnapshot(value: string | null): void {
  if (import.meta.server) return
  try {
    if (value) localStorage.setItem(ALERTS_ACK_SNAPSHOT_KEY, value)
    else localStorage.removeItem(ALERTS_ACK_SNAPSHOT_KEY)
  } catch {
    // ignore
  }
}

function loadLastCheckedAt(): string | null {
  if (import.meta.server) return null
  try {
    const raw = localStorage.getItem(LAST_CHECKED_AT_KEY)
    if (!raw) return null
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  } catch {
    return null
  }
}

function persistLastCheckedAt(value: string | null): void {
  if (import.meta.server) return
  try {
    if (!value) localStorage.removeItem(LAST_CHECKED_AT_KEY)
    else localStorage.setItem(LAST_CHECKED_AT_KEY, value)
  } catch {
    // ignore
  }
}

export const useStatisticsBuildSurveillanceStore = defineStore('statisticsBuildSurveillance', {
  state: (): BuildSurveillanceState => ({
    thresholds: defaultBuildSurveillanceThresholds(),
    baselines: {},
    activeAlerts: {},
    checking: false,
    lastCheckedAt: null,
    alertsAcknowledgedAt: null,
    alertsAcknowledgedSnapshot: null,
  }),
  getters: {
    isAlertsAcknowledged(state): boolean {
      if (Object.keys(state.activeAlerts).length === 0) return false
      const currentSnapshot = stableBuildAlertsFingerprint(state.activeAlerts)
      return (
        state.alertsAcknowledgedSnapshot !== null &&
        state.alertsAcknowledgedSnapshot === currentSnapshot
      )
    },
    alertCount(state): number {
      const count = Object.values(state.activeAlerts).reduce(
        (sum, triggers) => sum + triggers.length,
        0
      )
      if (count === 0) return 0
      const currentSnapshot = stableBuildAlertsFingerprint(state.activeAlerts)
      if (
        state.alertsAcknowledgedSnapshot !== null &&
        state.alertsAcknowledgedSnapshot === currentSnapshot
      ) {
        return 0
      }
      return count
    },
    triggersFor:
      state =>
      (championKey: string): BuildSurveillanceTrigger[] => {
        if (
          state.alertsAcknowledgedSnapshot !== null &&
          state.alertsAcknowledgedSnapshot === stableBuildAlertsFingerprint(state.activeAlerts)
        ) {
          return []
        }
        const key = String(championKey ?? '').trim()
        return state.activeAlerts[key] ?? []
      },
  },
  actions: {
    init() {
      if (import.meta.server) return
      this.thresholds = loadThresholds()
      this.baselines = loadBaselines()
      this.activeAlerts = loadActiveAlerts()
      this.alertsAcknowledgedAt = loadAlertsAcknowledgedAt()
      this.alertsAcknowledgedSnapshot = loadAlertsAcknowledgedSnapshot()
      this.lastCheckedAt = loadLastCheckedAt()
      if (
        !hasConfiguredBuildSurveillanceThresholds(this.thresholds) &&
        Object.keys(this.activeAlerts).length > 0
      ) {
        this.clearActiveAlerts()
        this.clearAlertsAcknowledgement()
      }
    },
    setThresholds(next: Partial<BuildSurveillanceThresholds>) {
      this.thresholds = normalizeBuildSurveillanceThresholds({ ...this.thresholds, ...next })
      persistThresholds(this.thresholds)
    },
    resetThresholds() {
      this.thresholds = defaultBuildSurveillanceThresholds()
      persistThresholds(this.thresholds)
      this.clearActiveAlerts()
      this.clearAlertsAcknowledgement()
    },
    setBaselines(next: Record<string, Record<string, BuildMetricSnapshot>>) {
      this.baselines = next
      persistBaselines(this.baselines)
    },
    setActiveAlerts(next: Record<string, BuildSurveillanceTrigger[]>) {
      const nextSnapshot = stableBuildAlertsFingerprint(next)
      const changed = stableBuildAlertsFingerprint(this.activeAlerts) !== nextSnapshot
      this.activeAlerts = next
      if (changed && Object.keys(next).length > 0) {
        this.clearAlertsAcknowledgement()
      }
      persistActiveAlerts(this.activeAlerts)
    },
    clearActiveAlerts() {
      this.activeAlerts = {}
      persistActiveAlerts(this.activeAlerts)
    },
    acknowledgeAlerts(): Record<string, BuildSurveillanceTrigger[]> {
      const count = Object.values(this.activeAlerts).reduce(
        (sum, triggers) => sum + triggers.length,
        0
      )
      if (count === 0) return {}
      const snapshot = structuredClone(this.activeAlerts)
      this.alertsAcknowledgedAt = new Date().toISOString()
      this.alertsAcknowledgedSnapshot = stableBuildAlertsFingerprint(this.activeAlerts)
      persistAlertsAcknowledgedAt(this.alertsAcknowledgedAt)
      persistAlertsAcknowledgedSnapshot(this.alertsAcknowledgedSnapshot)
      return snapshot
    },
    clearAlertsAcknowledgement() {
      this.alertsAcknowledgedAt = null
      this.alertsAcknowledgedSnapshot = null
      persistAlertsAcknowledgedAt(null)
      persistAlertsAcknowledgedSnapshot(null)
    },
    setChecking(value: boolean) {
      this.checking = value
    },
    recordCheckCompleted() {
      this.lastCheckedAt = new Date().toISOString()
      persistLastCheckedAt(this.lastCheckedAt)
    },
  },
})
