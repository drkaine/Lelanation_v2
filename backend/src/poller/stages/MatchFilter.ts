import { filterNewMatches, insertPendingMatches } from '../../db/queries/matches.js'
import { QueueClosedError, type AsyncQueue } from '../AsyncQueue.js'
import { currentPatch } from '../PatchConfig.js'
import { platformToRegionalHost } from '../routing.js'
import type { MatchListJob, NewMatchJob } from '../types.js'

export class MatchFilter {
  private running = true

  constructor(
    private readonly input: AsyncQueue<MatchListJob>,
    private readonly output: AsyncQueue<NewMatchJob>
  ) {}

  stop(): void {
    this.running = false
  }

  async run(): Promise<void> {
    while (this.running) {
      let job: MatchListJob
      try {
        job = await this.input.dequeue()
      } catch (error) {
        if (error instanceof QueueClosedError) return
        throw error
      }

      try {
        const patch = await currentPatch()
        const newMatchIds = await filterNewMatches(job.matchIds, patch)
        if (newMatchIds.length === 0) continue

        await insertPendingMatches(newMatchIds, patch, job.rankTier)
        for (const matchId of newMatchIds) {
          await this.output.enqueue({
            matchId,
            region: platformToRegionalHost(job.region),
            patch,
            rankTier: job.rankTier,
          })
        }
      } catch (error) {
        console.warn(
          JSON.stringify({
            stage: 'MatchFilter',
            err: error instanceof Error ? error.message : String(error),
          })
        )
      }
    }
  }
}
