import { join } from 'path'
import { CronStatusService } from './CronStatusService.js'
import { FileManager } from '../utils/fileManager.js'

const STATUS_FILE_PATH = join(process.cwd(), 'data', 'cron', 'status.json')

export type RiotPollerStatusState = 'running' | 'stopped' | 'error'

export interface RiotPollerStatus {
  status: RiotPollerStatusState
  lastLoopAt?: string | null
  lastErrorAt?: string | null
  lastErrorMessage?: string | null
  requestsPerSecond?: number
  requestsPerMinute?: number
  requestsPerHour?: number
  count429LastHour?: number
  count429Total?: number
}

/**
 * Small helper to read/write poller section in data/cron/status.json
 * without changing existing CronStatusService API.
 */
export class RiotPollerStatusService {
  private readonly cronStatus: CronStatusService

  constructor() {
    this.cronStatus = new CronStatusService()
  }

  async update(partial: Partial<RiotPollerStatus>): Promise<void> {
    // Ensure status.json exists and default jobs are present
    const base = await this.cronStatus.getStatus()
    const current = (base.isOk() && base.unwrap() ? base.unwrap() : { jobs: {} }) as {
      jobs: unknown
      poller?: RiotPollerStatus
      [key: string]: unknown
    }

    const nextPoller: RiotPollerStatus = {
      status: current.poller?.status ?? 'stopped',
      ...current.poller,
      ...partial,
    }

    const next = {
      ...current,
      poller: nextPoller,
    }

    const write = await FileManager.writeJson(STATUS_FILE_PATH, next)
    if (write.isErr()) {
      // Best-effort only; do not throw in the poller loop
      // eslint-disable-next-line no-console
      console.warn('[RiotPollerStatusService] Failed to write status.json:', write.unwrapErr())
    }
  }
}

