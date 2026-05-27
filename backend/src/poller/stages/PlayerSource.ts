import { fetchNextPlayerBatch } from '../../db/queries/players.js'
import { metrics } from '../../observability/MetricsCollector.js'
import type { AsyncQueue } from '../AsyncQueue.js'
import type { PlayerJob } from '../types.js'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class PlayerSource {
  private running = true

  constructor(
    private readonly queue: AsyncQueue<PlayerJob>,
    private readonly batchSize = 50
  ) {}

  stop(): void {
    this.running = false
  }

  async run(): Promise<void> {
    while (this.running) {
      const players = await fetchNextPlayerBatch(this.batchSize)
      if (players.length === 0) {
        await sleep(30_000)
        continue
      }

      for (const player of players) {
        if (!this.running) return
        const startedAt = Date.now()
        try {
          await this.queue.enqueue(player)
          metrics.recordStageItem({ stage: 'PlayerSource', success: true, durationMs: Date.now() - startedAt })
          metrics.recordQueueDepth({ stage: 'PlayerSource', depth: this.queue.size() })
        } catch (error) {
          metrics.recordStageItem({ stage: 'PlayerSource', success: false, durationMs: Date.now() - startedAt })
          metrics.recordError({
            stage: 'PlayerSource',
            error: error instanceof Error ? error : new Error(String(error)),
            context: { puuid: player.puuid },
            puuid: player.puuid,
          })
          throw error
        }
      }
    }
  }
}
