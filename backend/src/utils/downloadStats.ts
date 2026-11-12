export interface DownloadStats {
  total: number
  daily: Record<string, number>
}

const DEFAULT_KEEP_DAYS = 400

/** Count one download for `today` (YYYY-MM-DD) and keep only the most recent days. */
export function bumpDownloadStats(
  stats: DownloadStats,
  today: string,
  keepDays = DEFAULT_KEEP_DAYS
): DownloadStats {
  const total = typeof stats?.total === 'number' && Number.isFinite(stats.total) ? stats.total : 0
  const previous = stats?.daily && typeof stats.daily === 'object' ? stats.daily : {}
  const daily: Record<string, number> = { ...previous, [today]: (Number(previous[today]) || 0) + 1 }
  const days = Object.keys(daily).sort()
  for (const day of days.slice(0, Math.max(0, days.length - keepDays))) delete daily[day]
  return { total: total + 1, daily }
}

/** Runs async tasks strictly one after the other (read-modify-write on a file). */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task)
    tail = result.catch(() => undefined)
    return result
  }
}
