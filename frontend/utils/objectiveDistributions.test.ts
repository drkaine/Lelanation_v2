import { describe, expect, it } from 'vitest'
import { objectiveDistributions } from './objectiveDistributions'

describe('objectiveDistributions', () => {
  it('objective_distributions_reads_win_and_loss_histograms', () => {
    const objectives = { baron: { distributionByWin: { '1': 10 }, distributionByLoss: { '0': 4 } } }

    expect(objectiveDistributions(objectives, 'baron')).toEqual({
      byWin: { '1': 10 },
      byLoss: { '0': 4 },
    })
  })

  it('objective_distributions_returns_null_when_objective_has_no_histogram', () => {
    expect(objectiveDistributions({ baron: { firstByWin: 3 } }, 'baron')).toBeNull()
  })

  it('objective_distributions_drops_non_numeric_buckets', () => {
    const objectives = { baron: { distributionByWin: { '1': 'x', '2': 5 } } }

    expect(objectiveDistributions(objectives, 'baron')).toEqual({ byWin: { '2': 5 }, byLoss: {} })
  })

  it('objective_distributions_returns_null_when_objectives_missing', () => {
    expect(objectiveDistributions(undefined, 'baron')).toBeNull()
  })
})
