import { defineStore } from 'pinia'
import type {
  SurveillanceAlertThresholds,
  SurveillanceAlertTrigger,
  SurveillanceCohortProfile,
  SurveillanceTestBaseline,
  SurveillanceReferenceSettings,
} from '~/utils/statisticsSurveillanceAlerts'
import {
  SURVEILLANCE_GLOBAL_COHORT_KEY,
  defaultSurveillanceCohortProfile,
  defaultSurveillanceReferenceSettings,
  defaultSurveillanceThresholdProfiles,
  migrateSurveillanceThresholdsStorage,
  normalizeSurveillanceAlertThresholds,
  normalizeSurveillanceCohortProfiles,
  normalizeSurveillanceRankTiers,
  normalizeSurveillanceReferenceSettings,
  serializeSurveillanceThresholdProfiles,
  surveillanceCohortKey,
  stableSurveillanceAlertsFingerprint,
} from '~/utils/statisticsSurveillanceAlerts'

const THRESHOLDS_KEY = 'lelanation_surveillance_alert_thresholds'
const REFERENCE_SETTINGS_KEY = 'lelanation_surveillance_reference_settings'
const ACTIVE_ALERTS_KEY = 'lelanation_surveillance_active_alerts'
const TEST_BASELINES_KEY = 'lelanation_surveillance_test_baselines'
const ALERTS_ACK_AT_KEY = 'lelanation_surveillance_alerts_ack_at'
const ALERTS_ACK_SNAPSHOT_KEY = 'lelanation_surveillance_alerts_ack_snapshot'

interface SurveillanceAlertState {
  thresholdProfiles: SurveillanceCohortProfile[]
  referenceSettings: SurveillanceReferenceSettings
  activeAlerts: Record<string, SurveillanceAlertTrigger[]>
  testBaselines: Record<string, SurveillanceTestBaseline>
  checking: boolean
  lastCheckedAt: string | null
  alertsAcknowledgedAt: string | null
  alertsAcknowledgedSnapshot: string | null
}

function loadThresholdProfiles(): SurveillanceCohortProfile[] {
  if (import.meta.server) return defaultSurveillanceThresholdProfiles()
  try {
    const raw = localStorage.getItem(THRESHOLDS_KEY)
    if (!raw) return defaultSurveillanceThresholdProfiles()
    return migrateSurveillanceThresholdsStorage(JSON.parse(raw))
  } catch {
    return defaultSurveillanceThresholdProfiles()
  }
}

function loadActiveAlerts(): Record<string, SurveillanceAlertTrigger[]> {
  if (import.meta.server) return {}
  try {
    const raw = localStorage.getItem(ACTIVE_ALERTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SurveillanceAlertTrigger[]>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function loadReferenceSettings(): SurveillanceReferenceSettings {
  if (import.meta.server) return defaultSurveillanceReferenceSettings()
  try {
    const raw = localStorage.getItem(REFERENCE_SETTINGS_KEY)
    if (!raw) return defaultSurveillanceReferenceSettings()
    return normalizeSurveillanceReferenceSettings(JSON.parse(raw))
  } catch {
    return defaultSurveillanceReferenceSettings()
  }
}

function persistReferenceSettings(settings: SurveillanceReferenceSettings): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(REFERENCE_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

function persistThresholdProfiles(profiles: SurveillanceCohortProfile[]): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(
      THRESHOLDS_KEY,
      JSON.stringify(serializeSurveillanceThresholdProfiles(profiles))
    )
  } catch {
    // ignore
  }
}

function persistActiveAlerts(activeAlerts: Record<string, SurveillanceAlertTrigger[]>): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(ACTIVE_ALERTS_KEY, JSON.stringify(activeAlerts))
  } catch {
    // ignore
  }
}

function loadTestBaselines(): Record<string, SurveillanceTestBaseline> {
  if (import.meta.server) return {}
  try {
    const raw = localStorage.getItem(TEST_BASELINES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SurveillanceTestBaseline>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function loadAlertsAcknowledgedAt(): string | null {
  if (import.meta.server) return null
  try {
    const raw = localStorage.getItem(ALERTS_ACK_AT_KEY)
    return raw ? String(raw) : null
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
    const raw = localStorage.getItem(ALERTS_ACK_SNAPSHOT_KEY)
    if (!raw) return null
    // Ancien format JSON (avant empreinte stable) — invalide pour la comparaison.
    if (raw.startsWith('{') || raw.startsWith('[')) return null
    return String(raw)
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

function snapshotActiveAlerts(activeAlerts: Record<string, SurveillanceAlertTrigger[]>): string {
  return stableSurveillanceAlertsFingerprint(activeAlerts)
}

function persistTestBaselines(testBaselines: Record<string, SurveillanceTestBaseline>): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(TEST_BASELINES_KEY, JSON.stringify(testBaselines))
  } catch {
    // ignore
  }
}

export const useStatisticsSurveillanceAlertStore = defineStore('statisticsSurveillanceAlerts', {
  state: (): SurveillanceAlertState => ({
    thresholdProfiles: defaultSurveillanceThresholdProfiles(),
    referenceSettings: defaultSurveillanceReferenceSettings(),
    activeAlerts: {},
    testBaselines: {},
    checking: false,
    lastCheckedAt: null,
    alertsAcknowledgedAt: null,
    alertsAcknowledgedSnapshot: null,
  }),
  getters: {
    /** @deprecated Utiliser thresholdProfiles. Conservé pour compatibilité interne. */
    thresholds(state): SurveillanceAlertThresholds {
      const global = state.thresholdProfiles.find(
        p => p.cohortKey === SURVEILLANCE_GLOBAL_COHORT_KEY
      )
      return global?.thresholds ?? defaultSurveillanceCohortProfile().thresholds
    },
    alertCount(state): number {
      const count = Object.keys(state.activeAlerts).length
      if (count === 0) return 0
      const currentSnapshot = snapshotActiveAlerts(state.activeAlerts)
      if (
        state.alertsAcknowledgedSnapshot !== null &&
        state.alertsAcknowledgedSnapshot === currentSnapshot
      ) {
        return 0
      }
      return count
    },
    testBaselineCount(state): number {
      return Object.keys(state.testBaselines).length
    },
    hasAlert:
      state =>
      (championKey: string): boolean => {
        const key = String(championKey ?? '').trim()
        if (!key) return false
        return Array.isArray(state.activeAlerts[key]) && state.activeAlerts[key]!.length > 0
      },
    triggersFor:
      state =>
      (championKey: string): SurveillanceAlertTrigger[] => {
        const key = String(championKey ?? '').trim()
        return state.activeAlerts[key] ?? []
      },
    profileByKey:
      state =>
      (cohortKey: string): SurveillanceCohortProfile | undefined =>
        state.thresholdProfiles.find(p => p.cohortKey === cohortKey),
  },
  actions: {
    init() {
      if (import.meta.server) return
      this.thresholdProfiles = loadThresholdProfiles()
      this.referenceSettings = loadReferenceSettings()
      this.activeAlerts = loadActiveAlerts()
      this.testBaselines = loadTestBaselines()
      this.alertsAcknowledgedAt = loadAlertsAcknowledgedAt()
      this.alertsAcknowledgedSnapshot = loadAlertsAcknowledgedSnapshot()
    },
    setProfileThresholds(cohortKey: string, next: Partial<SurveillanceAlertThresholds>) {
      const key = String(cohortKey ?? '').trim() || SURVEILLANCE_GLOBAL_COHORT_KEY
      const profiles = [...this.thresholdProfiles]
      const index = profiles.findIndex(p => p.cohortKey === key)
      if (index < 0) return
      profiles[index] = {
        ...profiles[index]!,
        thresholds: normalizeSurveillanceAlertThresholds({
          ...profiles[index]!.thresholds,
          ...next,
        }),
      }
      this.thresholdProfiles = profiles
      persistThresholdProfiles(this.thresholdProfiles)
    },
    /** @deprecated Préférer setProfileThresholds */
    setThresholds(next: Partial<SurveillanceAlertThresholds>) {
      this.setProfileThresholds(SURVEILLANCE_GLOBAL_COHORT_KEY, next)
    },
    addCohortProfile(rankTiers: readonly string[]): string {
      const profile = defaultSurveillanceCohortProfile(rankTiers)
      const exists = this.thresholdProfiles.some(p => p.cohortKey === profile.cohortKey)
      if (!exists) {
        this.thresholdProfiles = normalizeSurveillanceCohortProfiles([
          ...this.thresholdProfiles,
          profile,
        ])
        persistThresholdProfiles(this.thresholdProfiles)
      }
      return profile.cohortKey
    },
    updateCohortRankTiers(cohortKey: string, rankTiers: readonly string[]): string {
      const oldKey = String(cohortKey ?? '').trim() || SURVEILLANCE_GLOBAL_COHORT_KEY
      if (oldKey === SURVEILLANCE_GLOBAL_COHORT_KEY) return oldKey

      const newKey = surveillanceCohortKey(rankTiers)
      const profiles = this.thresholdProfiles.filter(p => p.cohortKey !== oldKey)
      const existing = this.thresholdProfiles.find(p => p.cohortKey === oldKey)
      if (!existing) return oldKey

      const merged = profiles.find(p => p.cohortKey === newKey)
      if (merged) {
        this.thresholdProfiles = normalizeSurveillanceCohortProfiles(profiles)
        persistThresholdProfiles(this.thresholdProfiles)
        return newKey
      }

      profiles.push({
        ...existing,
        cohortKey: newKey,
        rankTiers: normalizeSurveillanceRankTiers(rankTiers),
      })
      this.thresholdProfiles = normalizeSurveillanceCohortProfiles(profiles)
      persistThresholdProfiles(this.thresholdProfiles)
      return newKey
    },
    removeCohortProfile(cohortKey: string) {
      const key = String(cohortKey ?? '').trim()
      if (!key || key === SURVEILLANCE_GLOBAL_COHORT_KEY) return
      const next = this.thresholdProfiles.filter(p => p.cohortKey !== key)
      this.thresholdProfiles =
        next.length > 0
          ? normalizeSurveillanceCohortProfiles(next)
          : defaultSurveillanceThresholdProfiles()
      persistThresholdProfiles(this.thresholdProfiles)
    },
    resetProfileThresholds(cohortKey: string) {
      this.setProfileThresholds(cohortKey, defaultSurveillanceCohortProfile().thresholds)
    },
    resetThresholds() {
      this.thresholdProfiles = defaultSurveillanceThresholdProfiles()
      persistThresholdProfiles(this.thresholdProfiles)
    },
    setReferenceSettings(next: Partial<SurveillanceReferenceSettings>) {
      this.referenceSettings = normalizeSurveillanceReferenceSettings({
        ...this.referenceSettings,
        ...next,
      })
      persistReferenceSettings(this.referenceSettings)
    },
    resetReferenceSettings() {
      this.referenceSettings = defaultSurveillanceReferenceSettings()
      persistReferenceSettings(this.referenceSettings)
    },
    setActiveAlerts(next: Record<string, SurveillanceAlertTrigger[]>) {
      const nextSnapshot = snapshotActiveAlerts(next)
      const changed = snapshotActiveAlerts(this.activeAlerts) !== nextSnapshot
      this.activeAlerts = next
      if (changed) {
        this.lastCheckedAt = new Date().toISOString()
        if (Object.keys(next).length > 0) {
          this.alertsAcknowledgedAt = null
          this.alertsAcknowledgedSnapshot = null
          persistAlertsAcknowledgedAt(null)
          persistAlertsAcknowledgedSnapshot(null)
        }
      }
      persistActiveAlerts(this.activeAlerts)
    },
    clearActiveAlerts() {
      this.activeAlerts = {}
      persistActiveAlerts(this.activeAlerts)
    },
    acknowledgeAlerts() {
      if (Object.keys(this.activeAlerts).length === 0) return
      this.alertsAcknowledgedAt = new Date().toISOString()
      this.alertsAcknowledgedSnapshot = snapshotActiveAlerts(this.activeAlerts)
      persistAlertsAcknowledgedAt(this.alertsAcknowledgedAt)
      persistAlertsAcknowledgedSnapshot(this.alertsAcknowledgedSnapshot)
    },
    setChecking(value: boolean) {
      this.checking = value
    },
    setTestBaselines(next: Record<string, SurveillanceTestBaseline>) {
      this.testBaselines = next
      persistTestBaselines(this.testBaselines)
    },
    setTestBaseline(baselineKey: string, baseline: SurveillanceTestBaseline) {
      const key = String(baselineKey ?? '').trim()
      if (!key) return
      this.testBaselines = { ...this.testBaselines, [key]: baseline }
      persistTestBaselines(this.testBaselines)
    },
    clearTestBaselines() {
      this.testBaselines = {}
      persistTestBaselines(this.testBaselines)
    },
  },
})
