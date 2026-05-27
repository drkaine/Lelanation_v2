import { RateLimitGateway } from '../gateway/RateLimitGateway.js'
import { AsyncQueue } from './AsyncQueue.js'
import type { MatchDataJob, MatchListJob, NewMatchJob, PlayerJob, RankedPlayerJob } from './types.js'
import { PlayerSource } from './stages/PlayerSource.js'
import { RankFetcher } from './stages/RankFetcher.js'
import { MatchListFetcher } from './stages/MatchListFetcher.js'
import { MatchFilter } from './stages/MatchFilter.js'
import { MatchDataFetcher } from './stages/MatchDataFetcher.js'
import { ParticipantHandler } from './stages/ParticipantHandler.js'
import { AggregateWriter } from './stages/AggregateWriter.js'

type StageRunner = {
  run: () => Promise<void>
  stop: () => void
}

export type PollerRuntime = {
  stop: () => Promise<void>
}

export async function startPoller(apiKey: string): Promise<PollerRuntime> {
  const gateway = RateLimitGateway.getInstance(apiKey)

  const q1 = new AsyncQueue<PlayerJob>(50)
  const q2 = new AsyncQueue<RankedPlayerJob>(100)
  const q3 = new AsyncQueue<MatchListJob>(200)
  const q4 = new AsyncQueue<NewMatchJob>(500)
  const q5 = new AsyncQueue<MatchDataJob>(200)
  const q6 = new AsyncQueue<MatchDataJob>(200)

  const source = new PlayerSource(q1, 50)
  const ranker = new RankFetcher(q1, q2, gateway, 20)
  const matchList = new MatchListFetcher(q2, q3, gateway, 20)
  const filter = new MatchFilter(q3, q4)
  const fetcher = new MatchDataFetcher(q4, q5, gateway, 20)
  const participants = new ParticipantHandler(q5, q6, gateway, 10)
  const writer = new AggregateWriter(q6, 5)

  const stages: StageRunner[] = [source, ranker, matchList, filter, fetcher, participants, writer]
  const stagePromises = stages.map((stage) => stage.run())

  const monitorId = setInterval(() => {
    console.log(
      JSON.stringify({
        stage: 'PollerOrchestrator',
        q1: q1.size(),
        q2: q2.size(),
        q3: q3.size(),
        q4: q4.size(),
        q5: q5.size(),
        q6: q6.size(),
        gateway: gateway.getStats(),
      })
    )
  }, 30_000)

  let stopped = false
  return {
    stop: async () => {
      if (stopped) return
      stopped = true
      clearInterval(monitorId)
      for (const stage of stages) stage.stop()
      q1.close()
      q2.close()
      q3.close()
      q4.close()
      q5.close()
      q6.close()
      gateway.gracefulShutdown('Poller orchestrator stopped')
      await Promise.allSettled(stagePromises)
    },
  }
}
