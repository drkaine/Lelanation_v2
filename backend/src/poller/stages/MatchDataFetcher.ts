import type { RateLimitGateway } from '../../gateway/RateLimitGateway.js'
import { updateMatchStatus } from '../../db/queries/matches.js'
import type { MatchDto, MatchTimelineDto } from '../../riot/types.js'
import { QueueClosedError, type AsyncQueue } from '../AsyncQueue.js'
import type { MatchDataJob, NewMatchJob } from '../types.js'

export class MatchDataFetcher {
  private running = true

  constructor(
    private readonly input: AsyncQueue<NewMatchJob>,
    private readonly output: AsyncQueue<MatchDataJob>,
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
      let job: NewMatchJob
      try {
        job = await this.input.dequeue()
      } catch (error) {
        if (error instanceof QueueClosedError) return
        throw error
      }

      try {
        const [matchData, timeline] = await Promise.all([
          this.gateway.execute<MatchDto>(job.region, `/lol/match/v5/matches/${encodeURIComponent(job.matchId)}`, {}),
          this.gateway.execute<MatchTimelineDto>(
            job.region,
            `/lol/match/v5/matches/${encodeURIComponent(job.matchId)}/timeline`,
            {}
          ),
        ])

        await this.output.enqueue({
          ...job,
          matchData,
          timeline,
        })
      } catch (error) {
        await updateMatchStatus(job.matchId, job.patch, 'error')
        console.warn(
          JSON.stringify({
            stage: 'MatchDataFetcher',
            matchId: job.matchId,
            err: error instanceof Error ? error.message : String(error),
          })
        )
      }
    }
  }
}
