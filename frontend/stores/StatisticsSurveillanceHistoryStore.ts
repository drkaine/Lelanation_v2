import { defineStore } from 'pinia'
import type { BuildSurveillanceTrigger } from '~/utils/buildSurveillance'
import type { SurveillanceAlertTrigger } from '~/utils/statisticsSurveillanceAlerts'

const HISTORY_KEY = 'lelanation_surveillance_alert_history'
const MAX_ENTRIES = 50

export interface SurveillanceAlertHistoryEntry {
  id: string
  acknowledgedAt: string
  statsAlerts: Record<string, SurveillanceAlertTrigger[]>
  buildAlerts: Record<string, BuildSurveillanceTrigger[]>
}

interface SurveillanceHistoryState {
  entries: SurveillanceAlertHistoryEntry[]
}

function loadHistory(): SurveillanceAlertHistoryEntry[] {
  if (import.meta.server) return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SurveillanceAlertHistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistHistory(entries: SurveillanceAlertHistoryEntry[]): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // ignore
  }
}

function hasAlertContent(
  statsAlerts: Record<string, SurveillanceAlertTrigger[]>,
  buildAlerts: Record<string, BuildSurveillanceTrigger[]>
): boolean {
  const statsCount = Object.values(statsAlerts).reduce((sum, list) => sum + list.length, 0)
  const buildCount = Object.values(buildAlerts).reduce((sum, list) => sum + list.length, 0)
  return statsCount > 0 || buildCount > 0
}

export const useStatisticsSurveillanceHistoryStore = defineStore('statisticsSurveillanceHistory', {
  state: (): SurveillanceHistoryState => ({
    entries: [],
  }),
  getters: {
    hasEntries(state): boolean {
      return state.entries.length > 0
    },
  },
  actions: {
    init() {
      if (import.meta.server) return
      this.entries = loadHistory()
    },
    appendEntry(input: {
      statsAlerts: Record<string, SurveillanceAlertTrigger[]>
      buildAlerts: Record<string, BuildSurveillanceTrigger[]>
      acknowledgedAt?: string
    }) {
      if (!hasAlertContent(input.statsAlerts, input.buildAlerts)) return
      const entry: SurveillanceAlertHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        acknowledgedAt: input.acknowledgedAt ?? new Date().toISOString(),
        statsAlerts: structuredClone(input.statsAlerts),
        buildAlerts: structuredClone(input.buildAlerts),
      }
      this.entries = [entry, ...this.entries].slice(0, MAX_ENTRIES)
      persistHistory(this.entries)
    },
    clearHistory() {
      this.entries = []
      persistHistory(this.entries)
    },
  },
})
