import { parseMatch } from '../../parsers/match.parser.js'
import { updateMatchStatus } from '../../db/queries/matches.js'
import { writeBanAggregates, writeParticipantAggregates, writeTeamAggregates } from '../../db/queries/aggregates.js'
import { metrics } from '../../observability/MetricsCollector.js'
import { QueueClosedError, type AsyncQueue } from '../AsyncQueue.js'
import type { MatchDataJob } from '../types.js'

function normalizeRankTier(value: string): string {
  const tier = String(value ?? '')
    .trim()
    .toUpperCase()
  return tier.length > 0 ? tier : 'UNRANKED'
}

export class AggregateWriter {
  private running = true

  constructor(
    private readonly input: AsyncQueue<MatchDataJob>,
    private readonly concurrency = 5
  ) {}

  stop(): void {
    this.running = false
  }

  async run(): Promise<void> {
    await Promise.all(Array.from({ length: this.concurrency }, () => this.worker()))
  }

  private async worker(): Promise<void> {
    while (this.running) {
      let job: MatchDataJob
      try {
        job = await this.input.dequeue()
        metrics.recordQueueDepth({ stage: 'AggregateWriter', depth: this.input.size() })
      } catch (error) {
        if (error instanceof QueueClosedError) return
        throw error
      }

      const startedAt = Date.now()
      try {
        const region = String(job.matchData.info.platformId ?? 'euw1')
          .trim()
          .toLowerCase()
        const rankTier = normalizeRankTier(job.rankTier)

        const parsedParticipants = parseMatch(job.matchData, job.timeline, job.patch, region).filter(
          (participant): participant is NonNullable<typeof participant> => participant != null
        )

        for (const participant of parsedParticipants) {
          const dbStartedAt = Date.now()
          await writeParticipantAggregates({
            participant,
            patch: job.patch,
            rankTier,
            region,
          })
          metrics.recordDBWrite({
            table: 'champion_stats',
            rows: 1,
            durationMs: Date.now() - dbStartedAt,
          })
        }

        const teamDbStartedAt = Date.now()
        await writeTeamAggregates({ ...job, rankTier, region })
        metrics.recordDBWrite({
          table: 'team_core_stat',
          rows: 2,
          durationMs: Date.now() - teamDbStartedAt,
        })

        const bansDbStartedAt = Date.now()
        await writeBanAggregates({ ...job, rankTier, region })
        metrics.recordDBWrite({
          table: 'champion_bans_by_banner',
          rows: 1,
          durationMs: Date.now() - bansDbStartedAt,
        })

        const statusDbStartedAt = Date.now()
        await updateMatchStatus(job.matchId, job.patch, 'done')
        metrics.recordDBWrite({
          table: 'processed_matches',
          rows: 1,
          durationMs: Date.now() - statusDbStartedAt,
        })
        metrics.recordStageItem({ stage: 'AggregateWriter', success: true, durationMs: Date.now() - startedAt })

        console.log(
          JSON.stringify({
            stage: 'AggregateWriter',
            matchId: job.matchId,
            durationMs: Date.now() - startedAt,
            participants: parsedParticipants.length,
            status: 'done',
          })
        )
      } catch (error) {
        await updateMatchStatus(job.matchId, job.patch, 'error')
        metrics.recordDBError('processed_matches', error instanceof Error ? error : new Error(String(error)))
        metrics.recordStageItem({ stage: 'AggregateWriter', success: false, durationMs: Date.now() - startedAt })
        metrics.recordError({
          stage: 'AggregateWriter',
          error: error instanceof Error ? error : new Error(String(error)),
          context: { matchId: job.matchId },
          matchId: job.matchId,
        })
        console.error(
          JSON.stringify({
            stage: 'AggregateWriter',
            matchId: job.matchId,
            durationMs: Date.now() - startedAt,
            status: 'error',
            err: error instanceof Error ? error.message : String(error),
          })
        )
      }
    }
  }
}
