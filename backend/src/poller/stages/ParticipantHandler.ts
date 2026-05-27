import pLimit from 'p-limit'
import type { RateLimitGateway } from '../../gateway/RateLimitGateway.js'
import { upsertPlayersIfMissing } from '../../db/queries/players.js'
import { getMissingRanksToday, insertRankHistory } from '../../db/queries/ranks.js'
import type { RankDto } from '../../riot/types.js'
import { QueueClosedError, type AsyncQueue } from '../AsyncQueue.js'
import type { MatchDataJob } from '../types.js'

export class ParticipantHandler {
  private running = true
  private readonly rankFetchLimit = pLimit(5)

  constructor(
    private readonly input: AsyncQueue<MatchDataJob>,
    private readonly output: AsyncQueue<MatchDataJob>,
    private readonly gateway: RateLimitGateway,
    private readonly concurrency = 10
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

      try {
        const participants = job.matchData.info.participants ?? []
        const puuids = Array.from(
          new Set(participants.map((participant) => String(participant.puuid ?? '').trim()).filter(Boolean))
        )
        const platformRegion = String(job.matchData.info.platformId ?? 'euw1')
          .trim()
          .toLowerCase()

        await upsertPlayersIfMissing(puuids, platformRegion)
        const missing = await getMissingRanksToday(puuids, platformRegion)

        await Promise.all(
          missing.map((puuid) =>
            this.rankFetchLimit(async () => {
              try {
                const entries = await this.gateway.execute<RankDto[]>(
                  platformRegion,
                  `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`,
                  {}
                )
                const solo =
                  entries.find((entry) => String(entry.queueType ?? '').toUpperCase() === 'RANKED_SOLO_5X5') ??
                  entries.find((entry) => String(entry.queueType ?? '').toUpperCase().includes('RANKED_SOLO'))

                if (!solo) return
                await insertRankHistory({
                  puuid,
                  region: platformRegion,
                  rankTier: String(solo.tier ?? 'UNRANKED').toUpperCase(),
                  rankDivision: String(solo.rank ?? 'UNRANKED').toUpperCase(),
                  rankLp: Math.max(0, Math.trunc(Number(solo.leaguePoints ?? 0))),
                  rankedAt: new Date(),
                })
              } catch (error) {
                console.warn(
                  JSON.stringify({
                    stage: 'ParticipantHandler',
                    puuid,
                    err: error instanceof Error ? error.message : String(error),
                  })
                )
              }
            })
          )
        )

        await this.output.enqueue(job)
      } catch (error) {
        console.warn(
          JSON.stringify({
            stage: 'ParticipantHandler',
            matchId: job.matchId,
            err: error instanceof Error ? error.message : String(error),
          })
        )
      }
    }
  }
}
