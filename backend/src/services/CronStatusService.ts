import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'

export type CronJobKey = 'dataDragonSync' | 'youtubeSync' | 'communityDragonSync'

export type CronJobStatus = {
  job: CronJobKey
  lastStartAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastFailureMessage: string | null
}

type CronStatusFile = {
  jobs: Record<CronJobKey, CronJobStatus>
}

export class CronStatusService {
  private readonly filePath: string

  constructor(filePath: string = join(process.cwd(), 'data', 'cron', 'status.json')) {
    this.filePath = filePath
  }

  private defaultFile(): CronStatusFile {
    return {
      jobs: {
        dataDragonSync: {
          job: 'dataDragonSync',
          lastStartAt: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastFailureMessage: null
        },
        youtubeSync: {
          job: 'youtubeSync',
          lastStartAt: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastFailureMessage: null
        },
        communityDragonSync: {
          job: 'communityDragonSync',
          lastStartAt: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastFailureMessage: null
        }
      }
    }
  }

  async getStatus(): Promise<Result<CronStatusFile, AppError>> {
    const read = await FileManager.readJson<CronStatusFile>(this.filePath)
    if (read.isErr()) {
      if (read.unwrapErr().code === 'FILE_NOT_FOUND') {
        const init = this.defaultFile()
        const write = await FileManager.writeJson(this.filePath, init)
        if (write.isErr()) return Result.err(write.unwrapErr())
        return Result.ok(init)
      }
      return Result.err(read.unwrapErr())
    }
    const value = read.unwrap()
    if (!value?.jobs) return Result.ok(this.defaultFile())
    return Result.ok(value)
  }

  async markStart(job: CronJobKey): Promise<Result<void, AppError>> {
    const status = await this.getStatus()
    if (status.isErr()) return Result.err(status.unwrapErr())
    const file = status.unwrap()
    file.jobs[job].lastStartAt = new Date().toISOString()
    const write = await FileManager.writeJson(this.filePath, file)
    if (write.isErr()) return Result.err(write.unwrapErr())
    return Result.ok(undefined)
  }

  async markSuccess(job: CronJobKey): Promise<Result<void, AppError>> {
    const status = await this.getStatus()
    if (status.isErr()) return Result.err(status.unwrapErr())
    const file = status.unwrap()
    file.jobs[job].lastSuccessAt = new Date().toISOString()
    file.jobs[job].lastFailureAt = null
    file.jobs[job].lastFailureMessage = null
    const write = await FileManager.writeJson(this.filePath, file)
    if (write.isErr()) return Result.err(write.unwrapErr())
    return Result.ok(undefined)
  }

  async markFailure(job: CronJobKey, error: unknown): Promise<Result<void, AppError>> {
    const status = await this.getStatus()
    if (status.isErr()) return Result.err(status.unwrapErr())
    const file = status.unwrap()
    file.jobs[job].lastFailureAt = new Date().toISOString()
    file.jobs[job].lastFailureMessage = error instanceof Error ? error.message : String(error)
    const write = await FileManager.writeJson(this.filePath, file)
    if (write.isErr()) return Result.err(write.unwrapErr())
    return Result.ok(undefined)
  }
}

