import { describe, expect, it } from 'vitest'
import { bumpDownloadStats, createSerialQueue } from '../../../../src/utils/downloadStats.js'

describe('downloadStats', () => {
  it('download_total_is_incremented_when_a_download_is_tracked', () => {
    const next = bumpDownloadStats({ total: 4, daily: { '2026-11-12': 1 } }, '2026-11-12')
    expect(next).toEqual({ total: 5, daily: { '2026-11-12': 2 } })
  })

  it('old_days_are_pruned_when_daily_history_exceeds_the_limit', () => {
    const next = bumpDownloadStats({ total: 2, daily: { '2026-01-01': 1, '2026-01-02': 1 } }, '2026-01-03', 2)
    expect(Object.keys(next.daily)).toEqual(['2026-01-02', '2026-01-03'])
  })

  it('malformed_stats_are_reset_when_file_content_is_invalid', () => {
    const next = bumpDownloadStats({ total: 'x', daily: null } as never, '2026-01-03')
    expect(next).toEqual({ total: 1, daily: { '2026-01-03': 1 } })
  })

  it('tasks_run_one_after_the_other_when_queued_concurrently', async () => {
    const run = createSerialQueue()
    let value = 0
    const bump = () =>
      run(async () => {
        const read = value
        await new Promise((r) => setTimeout(r, 5))
        value = read + 1
      })
    await Promise.all([bump(), bump(), bump()])
    expect(value).toBe(3)
  })

  it('queue_keeps_running_when_a_task_fails', async () => {
    const run = createSerialQueue()
    await run(async () => { throw new Error('boom') }).catch(() => undefined)
    await expect(run(async () => 'ok')).resolves.toBe('ok')
  })
})
