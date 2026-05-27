import { obsLogger } from './logger.js'
import type { ActiveAlert, HourlySummary, StageName, WindowSnapshot } from './types.js'

const THRESHOLDS = {
  headroomMin: 6,
  count429PerWindow: 1,
  stageFailureRatePercent: 5,
  queueDepthMax: 400,
  hourlyErrorsMax: 50,
  requestsPer120sMin: 80,
}

export class AlertManager {
  private static instance: AlertManager | null = null
  private readonly active = new Map<string, ActiveAlert>()

  static getInstance(): AlertManager {
    if (!AlertManager.instance) AlertManager.instance = new AlertManager()
    return AlertManager.instance
  }

  evaluateWindow(w: WindowSnapshot): void {
    if (w.headroomMin < THRESHOLDS.headroomMin) {
      this.raise('error', 'LOW_HEADROOM', `Headroom min = ${w.headroomMin} (seuil ${THRESHOLDS.headroomMin})`)
    } else {
      this.clear('LOW_HEADROOM')
    }

    if (w.count429 >= THRESHOLDS.count429PerWindow) {
      this.raise('error', 'RATE_LIMIT_HIT', `${w.count429} 429 sur cette fenêtre`)
    } else {
      this.clear('RATE_LIMIT_HIT')
    }

    if (w.requestsSent < THRESHOLDS.requestsPer120sMin) {
      this.raise('warn', 'POLLER_SLOW', `Seulement ${w.requestsSent} req sur 120s (cible ${w.requestsTarget})`)
    } else {
      this.clear('POLLER_SLOW')
    }
  }

  evaluateStage(stage: StageName, failureRatePercent: number, queueDepth: number): void {
    const failureCode = `STAGE_FAILURES_${stage}`
    if (failureRatePercent > THRESHOLDS.stageFailureRatePercent) {
      this.raise('warn', failureCode, `${stage} taux d'échec = ${failureRatePercent.toFixed(1)}%`)
    } else {
      this.clear(failureCode)
    }

    const queueCode = `QUEUE_FULL_${stage}`
    if (queueDepth > THRESHOLDS.queueDepthMax) {
      this.raise('warn', queueCode, `Queue ${stage} = ${queueDepth} items`)
    } else {
      this.clear(queueCode)
    }
  }

  evaluateHourly(hourly: HourlySummary): void {
    if (hourly.errors > THRESHOLDS.hourlyErrorsMax) {
      this.raise('error', 'HOURLY_ERRORS', `Erreurs heure courante = ${hourly.errors}`)
    } else {
      this.clear('HOURLY_ERRORS')
    }
  }

  getActiveAlerts(): ActiveAlert[] {
    return [...this.active.values()]
  }

  private raise(level: 'warn' | 'error', code: string, message: string): void {
    if (this.active.has(code)) return
    this.active.set(code, { level, code, message, since: Date.now() })
    obsLogger[level]({ alert: code }, message)
  }

  private clear(code: string): void {
    this.active.delete(code)
  }
}
