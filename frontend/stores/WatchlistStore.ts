import { defineStore } from 'pinia'
import type { WatchRule } from '~/types/watchlist'

const STORAGE_KEY = 'lelanation_watchlist_rules'

function loadRules(): WatchRule[] {
  if (import.meta.server) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isWatchRule)
  } catch {
    return []
  }
}

function isWatchRule(x: unknown): x is WatchRule {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  const rankOk =
    o.rankTier === undefined ||
    o.rankTier === null ||
    (typeof o.rankTier === 'string' && !o.rankTier.startsWith('['))
  return (
    typeof o.id === 'string' &&
    (o.targetType === 'CHAMPION' || o.targetType === 'ROLE' || o.targetType === 'GLOBAL') &&
    typeof o.metric === 'string' &&
    typeof o.operator === 'string' &&
    typeof o.threshold === 'number' &&
    typeof o.timeframe === 'number' &&
    rankOk
  )
}

function persist(rules: WatchRule[]): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
  } catch {
    // ignore
  }
}

/** Example: jungle lane meta — WR > 52 % vs ~7 days window (same as default timeframe). */
export function createExampleWatchRule(): WatchRule {
  return {
    id: crypto.randomUUID(),
    targetType: 'ROLE',
    targetValue: 'JUNGLE',
    metric: 'winRate',
    operator: '>',
    threshold: 52,
    timeframe: 7,
  }
}

export const useWatchlistStore = defineStore('watchlist', {
  state: () => ({
    rules: [] as WatchRule[],
    hydrated: false,
  }),
  actions: {
    init() {
      if (this.hydrated) return
      this.rules = loadRules()
      this.hydrated = true
    },
    addRule(rule: WatchRule) {
      this.init()
      this.rules = [...this.rules, rule]
      persist(this.rules)
    },
    removeRule(id: string) {
      this.init()
      this.rules = this.rules.filter(r => r.id !== id)
      persist(this.rules)
    },
    replaceRules(rules: WatchRule[]) {
      this.rules = rules
      persist(rules)
    },
    loadExampleRule() {
      this.init()
      this.rules = [...this.rules, createExampleWatchRule()]
      persist(this.rules)
    },
  },
})
