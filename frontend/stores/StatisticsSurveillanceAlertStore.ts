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
  canAddSurveillanceCohortProfile,
  defaultSurveillanceAlertThresholds,
  defaultSurveillanceCohortProfile,
  defaultSurveillanceReferenceSettings,
  defaultSurveillanceThresholdProfiles,
  configuredSurveillanceCohortProfiles,
  migrateSurveillanceThresholdsStorage,
  normalizeSurveillanceAlertThresholds,
  normalizeSurveillanceCohortLabel,
  normalizeSurveillanceCohortProfiles,
  normalizeSurveillanceRankTiers,
  normalizeSurveillanceReferenceSettings,
  serializeSurveillanceThresholdsStorage,
  surveillanceCohortKey,
  stableSurveillanceAlertsFingerprint,
  syncProfilesSharedThresholds,
} from '~/utils/statisticsSurveillanceAlerts'

const THRESHOLDS_KEY = 'lelanation_surveillance_alert_thresholds'
const REFERENCE_SETTINGS_KEY = 'lelanation_surveillance_reference_settings'
const ACTIVE_ALERTS_KEY = 'lelanation_surveillance_active_alerts'
const TEST_BASELINES_KEY = 'lelanation_surveillance_test_baselines'
const ALERTS_ACK_AT_KEY = 'lelanation_surveillance_alerts_ack_at'
const ALERTS_ACK_SNAPSHOT_KEY = 'lelanation_surveillance_alerts_ack_snapshot'
const LAST_CHECKED_AT_KEY = 'lelanation_surveillance_last_checked_at'

interface SurveillanceAlertState {
  thresholdProfiles: SurveillanceCohortProfile[]
  sharedThresholds: boolean
  referenceSettings: SurveillanceReferenceSettings
  activeAlerts: Record<string, SurveillanceAlertTrigger[]>
  testBaselines: Record<string, SurveillanceTestBaseline>
  checking: boolean
  lastCheckedAt: string | null
  alertsAcknowledgedAt: string | null
  alertsAcknowledgedSnapshot: string | null
}

function loadThresholdsStorage() {
  if (import.meta.server) {
    return serializeSurveillanceThresholdsStorage(defaultSurveillanceThresholdProfiles(), false)
  }
  try {
    const raw = localStorage.getItem(THRESHOLDS_KEY)
    if (!raw)
      return serializeSurveillanceThresholdsStorage(defaultSurveillanceThresholdProfiles(), false)
    return migrateSurveillanceThresholdsStorage(JSON.parse(raw))
  } catch {
    return serializeSurveillanceThresholdsStorage(defaultSurveillanceThresholdProfiles(), false)
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

function persistThresholdProfiles(
  profiles: SurveillanceCohortProfile[],
  sharedThresholds: boolean
): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(
      THRESHOLDS_KEY,
      JSON.stringify(serializeSurveillanceThresholdsStorage(profiles, sharedThresholds))
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
    if (!value) {
      localStorage.removeItem(LAST_CHECKED_AT_KEY)
      return
    }
    localStorage.setItem(LAST_CHECKED_AT_KEY, value)
  } catch {
    // ignore
  }
}

export const useStatisticsSurveillanceAlertStore = defineStore('statisticsSurveillanceAlerts', {
  state: (): SurveillanceAlertState => ({
    thresholdProfiles: defaultSurveillanceThresholdProfiles(),
    sharedThresholds: false,
    referenceSettings: defaultSurveillanceReferenceSettings(),
    activeAlerts: {},
    testBaselines: {},
    checking: false,
    lastCheckedAt: null,
    alertsAcknowledgedAt: null,
    alertsAcknowledgedSnapshot: null,
  }),
  getters: {
    isAlertsAcknowledged(state): boolean {
      if (Object.keys(state.activeAlerts).length === 0) return false
      const currentSnapshot = snapshotActiveAlerts(state.activeAlerts)
      return (
        state.alertsAcknowledgedSnapshot !== null &&
        state.alertsAcknowledgedSnapshot === currentSnapshot
      )
    },
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
        if (
          state.alertsAcknowledgedSnapshot !== null &&
          state.alertsAcknowledgedSnapshot === snapshotActiveAlerts(state.activeAlerts)
        ) {
          return false
        }
        return Array.isArray(state.activeAlerts[key]) && state.activeAlerts[key]!.length > 0
      },
    triggersFor:
      state =>
      (championKey: string): SurveillanceAlertTrigger[] => {
        if (
          state.alertsAcknowledgedSnapshot !== null &&
          state.alertsAcknowledgedSnapshot === snapshotActiveAlerts(state.activeAlerts)
        ) {
          return []
        }
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
      const storage = loadThresholdsStorage()
      this.thresholdProfiles = storage.profiles
      this.sharedThresholds = storage.sharedThresholds
      this.referenceSettings = loadReferenceSettings()
      this.activeAlerts = loadActiveAlerts()
      this.testBaselines = loadTestBaselines()
      this.alertsAcknowledgedAt = loadAlertsAcknowledgedAt()
      this.alertsAcknowledgedSnapshot = loadAlertsAcknowledgedSnapshot()
      this.lastCheckedAt = loadLastCheckedAt()
      if (
        configuredSurveillanceCohortProfiles(this.thresholdProfiles).length === 0 &&
        Object.keys(this.activeAlerts).length > 0
      ) {
        this.clearActiveAlerts()
        this.clearAlertsAcknowledgement()
      }
    },
    persistThresholds() {
      persistThresholdProfiles(this.thresholdProfiles, this.sharedThresholds)
    },
    setProfileThresholds(cohortKey: string, next: Partial<SurveillanceAlertThresholds>) {
      const key = String(cohortKey ?? '').trim() || SURVEILLANCE_GLOBAL_COHORT_KEY
      const profiles = [...this.thresholdProfiles]
      const index = profiles.findIndex(p => p.cohortKey === key)
      if (index < 0) return
      const merged = normalizeSurveillanceAlertThresholds({
        ...profiles[index]!.thresholds,
        ...next,
      })
      if (this.sharedThresholds) {
        this.thresholdProfiles = syncProfilesSharedThresholds(profiles, merged)
      } else {
        profiles[index] = {
          ...profiles[index]!,
          thresholds: merged,
        }
        this.thresholdProfiles = profiles
      }
      this.persistThresholds()
    },
    /** @deprecated Préférer setProfileThresholds */
    setThresholds(next: Partial<SurveillanceAlertThresholds>) {
      this.setProfileThresholds(SURVEILLANCE_GLOBAL_COHORT_KEY, next)
    },
    addCohortProfile(rankTiers: readonly string[]): string | null {
      const profile = defaultSurveillanceCohortProfile(rankTiers)
      const exists = this.thresholdProfiles.some(p => p.cohortKey === profile.cohortKey)
      if (exists) return profile.cohortKey
      if (!canAddSurveillanceCohortProfile(this.thresholdProfiles)) return null

      if (this.sharedThresholds) {
        const source =
          this.thresholdProfiles.find(p => p.cohortKey === SURVEILLANCE_GLOBAL_COHORT_KEY) ??
          this.thresholdProfiles[0]
        if (source) {
          profile.thresholds = normalizeSurveillanceAlertThresholds(source.thresholds)
        }
      }
      this.thresholdProfiles = normalizeSurveillanceCohortProfiles([
        ...this.thresholdProfiles,
        profile,
      ])
      this.persistThresholds()
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
        this.persistThresholds()
        return newKey
      }

      profiles.push({
        ...existing,
        cohortKey: newKey,
        rankTiers: normalizeSurveillanceRankTiers(rankTiers),
      })
      this.thresholdProfiles = normalizeSurveillanceCohortProfiles(profiles)
      this.persistThresholds()
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
      this.persistThresholds()
    },
    resetProfileThresholds(cohortKey: string) {
      const defaults = defaultSurveillanceCohortProfile().thresholds
      if (this.sharedThresholds) {
        this.thresholdProfiles = syncProfilesSharedThresholds(this.thresholdProfiles, defaults)
        this.persistThresholds()
        this.clearActiveAlerts()
        this.clearAlertsAcknowledgement()
        return
      }
      this.setProfileThresholds(cohortKey, defaults)
      this.clearActiveAlerts()
      this.clearAlertsAcknowledgement()
    },
    setCohortLabel(cohortKey: string, label: string | null) {
      const key = String(cohortKey ?? '').trim() || SURVEILLANCE_GLOBAL_COHORT_KEY
      const profiles = [...this.thresholdProfiles]
      const index = profiles.findIndex(p => p.cohortKey === key)
      if (index < 0) return
      profiles[index] = {
        ...profiles[index]!,
        label: normalizeSurveillanceCohortLabel(label),
      }
      this.thresholdProfiles = profiles
      this.persistThresholds()
    },
    setSharedThresholds(value: boolean, sourceCohortKey?: string) {
      if (value === this.sharedThresholds) return
      if (value) {
        const key = String(sourceCohortKey ?? '').trim() || SURVEILLANCE_GLOBAL_COHORT_KEY
        const source =
          this.thresholdProfiles.find(p => p.cohortKey === key) ?? this.thresholdProfiles[0]
        if (source) {
          this.thresholdProfiles = syncProfilesSharedThresholds(
            this.thresholdProfiles,
            source.thresholds
          )
        }
      }
      this.sharedThresholds = value
      this.persistThresholds()
    },
    resetThresholds() {
      this.thresholdProfiles = this.thresholdProfiles.map(profile => ({
        ...profile,
        thresholds: defaultSurveillanceAlertThresholds(),
      }))
      this.persistThresholds()
      this.clearActiveAlerts()
      this.clearAlertsAcknowledgement()
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
    acknowledgeAlerts(): Record<string, SurveillanceAlertTrigger[]> {
      if (Object.keys(this.activeAlerts).length === 0) return {}
      const snapshot = structuredClone(this.activeAlerts)
      this.alertsAcknowledgedAt = new Date().toISOString()
      this.alertsAcknowledgedSnapshot = snapshotActiveAlerts(this.activeAlerts)
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
