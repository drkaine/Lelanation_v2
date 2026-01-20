type MetricSnapshot = {
  startedAt: string
  uptimeSec: number
  requestCount: number
  errorCount: number
  avgResponseTimeMs: number
  p95ResponseTimeMs: number
  nodeVersion: string
  memory: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
  }
}

export class MetricsService {
  private static instance: MetricsService | null = null
  static getInstance(): MetricsService {
    if (!this.instance) this.instance = new MetricsService()
    return this.instance
  }

  private readonly startedAt = new Date()
  private requestCount = 0
  private errorCount = 0
  private readonly durations: number[] = []
  private readonly maxDurations = 2000

  recordRequest(durationMs: number, statusCode: number) {
    this.requestCount++
    if (statusCode >= 500) this.errorCount++
    this.durations.push(durationMs)
    if (this.durations.length > this.maxDurations) {
      this.durations.splice(0, this.durations.length - this.maxDurations)
    }
  }

  snapshot(): MetricSnapshot {
    const mem = process.memoryUsage()
    const durations = [...this.durations].sort((a, b) => a - b)
    const avg =
      durations.length === 0 ? 0 : durations.reduce((sum, v) => sum + v, 0) / durations.length
    const p95 =
      durations.length === 0 ? 0 : durations[Math.floor(durations.length * 0.95)] ?? durations.at(-1) ?? 0

    return {
      startedAt: this.startedAt.toISOString(),
      uptimeSec: process.uptime(),
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      avgResponseTimeMs: Math.round(avg * 100) / 100,
      p95ResponseTimeMs: Math.round(p95 * 100) / 100,
      nodeVersion: process.version,
      memory: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external
      }
    }
  }
}

