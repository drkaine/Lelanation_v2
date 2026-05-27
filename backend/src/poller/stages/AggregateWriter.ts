import { parseMatch } from '../../parsers/match.parser.js'
import { updateMatchStatus } from '../../db/queries/matches.js'
import { writeBanAggregates, writeParticipantAggregates, writeTeamAggregates } from '../../db/queries/aggregates.js'
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
          await writeParticipantAggregates({
            participant,
            patch: job.patch,
            rankTier,
            region,
          })
        }

        await writeTeamAggregates({ ...job, rankTier, region })
        await writeBanAggregates({ ...job, rankTier, region })
        await updateMatchStatus(job.matchId, job.patch, 'done')

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
