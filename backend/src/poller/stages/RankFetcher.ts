import type { RateLimitGateway } from '../../gateway/RateLimitGateway.js'
import { hasRankToday, insertRankHistory } from '../../db/queries/ranks.js'
import { updatePlayerLastSeen } from '../../db/queries/players.js'
import type { RankDto } from '../../riot/types.js'
import { metrics } from '../../observability/MetricsCollector.js'
import { QueueClosedError, type AsyncQueue } from '../AsyncQueue.js'
import type { PlayerJob, RankedPlayerJob } from '../types.js'

export class RankFetcher {
  private running = true

  constructor(
    private readonly input: AsyncQueue<PlayerJob>,
    private readonly output: AsyncQueue<RankedPlayerJob>,
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
      let player: PlayerJob
      try {
        player = await this.input.dequeue()
        metrics.recordQueueDepth({ stage: 'RankFetcher', depth: this.input.size() })
      } catch (error) {
        if (error instanceof QueueClosedError) return
        throw error
      }

      const startedAt = Date.now()
      try {
        const entries = await this.gateway.execute<RankDto[]>(
          player.region,
          `/lol/league/v4/entries/by-puuid/${encodeURIComponent(player.puuid)}`,
          {}
        )
        const soloEntry =
          entries.find((entry) => String(entry.queueType ?? '').toUpperCase() === 'RANKED_SOLO_5X5') ??
          entries.find((entry) => String(entry.queueType ?? '').toUpperCase().includes('RANKED_SOLO'))

        if (!soloEntry) {
          await updatePlayerLastSeen(player.puuid)
          continue
        }

        const alreadyHasRank = await hasRankToday(player.puuid, player.region)
        if (!alreadyHasRank) {
          await insertRankHistory({
            puuid: player.puuid,
            region: player.region,
            rankTier: String(soloEntry.tier ?? 'UNRANKED').toUpperCase(),
            rankDivision: String(soloEntry.rank ?? 'UNRANKED').toUpperCase(),
            rankLp: Math.max(0, Math.trunc(Number(soloEntry.leaguePoints ?? 0))),
            rankedAt: new Date(),
          })
        }

        await updatePlayerLastSeen(player.puuid)
        await this.output.enqueue({
          ...player,
          rankTier: String(soloEntry.tier ?? 'UNRANKED').toUpperCase(),
          rankDivision: String(soloEntry.rank ?? 'UNRANKED').toUpperCase(),
          rankLp: Math.max(0, Math.trunc(Number(soloEntry.leaguePoints ?? 0))),
          rankedAt: new Date(),
        })
        metrics.recordStageItem({ stage: 'RankFetcher', success: true, durationMs: Date.now() - startedAt })
      } catch (error) {
        metrics.recordStageItem({ stage: 'RankFetcher', success: false, durationMs: Date.now() - startedAt })
        metrics.recordError({
          stage: 'RankFetcher',
          error: error instanceof Error ? error : new Error(String(error)),
          context: { puuid: player.puuid },
          puuid: player.puuid,
        })
        console.warn(
          JSON.stringify({
            stage: 'RankFetcher',
            puuid: player.puuid,
            err: error instanceof Error ? error.message : String(error),
          })
        )
      }
    }
  }
}
