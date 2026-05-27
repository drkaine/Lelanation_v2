import { metrics } from './MetricsCollector.js'
import { obsLogger } from './logger.js'

let timer: NodeJS.Timeout | null = null

export function startTerminalSummary(): void {
  if (timer) return
  timer = setInterval(() => {
    const snap = metrics.getSnapshot()
    const rl = snap.rateLimitCurrent

    obsLogger.info(
      {
        rateLimit: {
          sent: rl.requestsSent,
          target: rl.target,
          limit: rl.limit,
          headroom: rl.headroom,
          count429: rl.count429,
          queueGateway: rl.queueDepth,
        },
        stages: Object.fromEntries(
          Object.entries(snap.stages).map(([stage, value]) => [
            stage,
            {
              ok: value.itemsLast60s,
              err: value.failuresLast60s,
              p95ms: value.p95DurationMs,
              q: value.queueDepth,
            },
          ])
        ),
        hourly: snap.hourly,
        alerts: snap.alerts.length,
      },
      '[obs] 30s snapshot'
    )

    if (snap.alerts.length > 0) {
      obsLogger.warn({ alerts: snap.alerts }, '[obs] Alertes actives')
    }
  }, 30_000)
}

export function stopTerminalSummary(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
