import type { RateLimitGateway } from '../../gateway/RateLimitGateway.js'
import { metrics } from '../../observability/MetricsCollector.js'
import { QueueClosedError, type AsyncQueue } from '../AsyncQueue.js'
import { platformToRegionalHost } from '../routing.js'
import type { MatchListJob, RankedPlayerJob } from '../types.js'

export class MatchListFetcher {
  private running = true

  constructor(
    private readonly input: AsyncQueue<RankedPlayerJob>,
    private readonly output: AsyncQueue<MatchListJob>,
    private readonly gateway: RateLimitGateway,
    private readonly concurrency = 20
  ) {}

  stop(): void {
    this.running = false
  }

  async run(): Promise<void> {
    await Promise.all(Array.from({ length: this.concurrency }, () => this.worker()))
  }

  private async worker(): Promise<void> {
    while (this.running) {
      let player: RankedPlayerJob
      try {
        player = await this.input.dequeue()
        metrics.recordQueueDepth({ stage: 'MatchListFetcher', depth: this.input.size() })
      } catch (error) {
        if (error instanceof QueueClosedError) return
        throw error
      }

      const startedAt = Date.now()
      try {
        const regionalHost = platformToRegionalHost(player.region)
        const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
        const matchIds = await this.gateway.execute<string[]>(
          regionalHost,
          `/lol/match/v5/matches/by-puuid/${encodeURIComponent(player.puuid)}/ids`,
          {
            queue: '420',
            type: 'ranked',
            count: '20',
            start: '0',
            startTime: String(since),
          }
        )

        if (matchIds.length === 0) continue
        await this.output.enqueue({ ...player, matchIds })
        metrics.recordStageItem({ stage: 'MatchListFetcher', success: true, durationMs: Date.now() - startedAt })
      } catch (error) {
        metrics.recordStageItem({ stage: 'MatchListFetcher', success: false, durationMs: Date.now() - startedAt })
        metrics.recordError({
          stage: 'MatchListFetcher',
          error: error instanceof Error ? error : new Error(String(error)),
          context: { puuid: player.puuid },
          puuid: player.puuid,
        })
        console.warn(
          JSON.stringify({
            stage: 'MatchListFetcher',
            puuid: player.puuid,
            err: error instanceof Error ? error.message : String(error),
          })
        )
      }
    }
  }
}
