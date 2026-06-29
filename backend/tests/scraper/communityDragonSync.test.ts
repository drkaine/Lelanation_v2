import { beforeEach, describe, expect, test, vi } from 'vitest'
import { Result } from '../../src/utils/Result.js'

const checkForNewVersion = vi.fn()
const syncRankedEmblems = vi.fn()
const markStart = vi.fn()
const markSuccess = vi.fn()
const markFailure = vi.fn()

vi.mock('../../src/services/VersionService.js', () => ({
  VersionService: class MockVersionService {
    checkForNewVersion = checkForNewVersion
  },
}))

vi.mock('../../src/services/CommunityDragonService.js', () => ({
  CommunityDragonService: class MockCommunityDragonService {
    syncRankedEmblems = syncRankedEmblems
    syncScoreboardObjectiveIcons = vi.fn(async () => Result.ok({ synced: 0, failed: 0, errors: [] }))
    syncMinimapPingIcons = vi.fn(async () => Result.ok({ synced: 0, failed: 0, errors: [] }))
    syncMapPlannerAssets = vi.fn(async () => Result.ok({ synced: 0, failed: 0, errors: [] }))
    syncKaynHudImages = vi.fn(async () => Result.ok({ synced: 0, failed: 0, errors: [] }))
  },
}))

vi.mock('../../src/services/CronStatusService.js', () => ({
  CronStatusService: class MockCronStatusService {
    markStart = markStart
    markSuccess = markSuccess
    markFailure = markFailure
  },
}))

vi.mock('../../src/logging/unifiedAppLog.js', () => ({
  appendUnifiedLog: vi.fn(),
}))

vi.mock('../../src/utils/cronLogger.js', () => ({
  createCronLogger: () => ({
    info: vi.fn(),
    step: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('../../src/services/gameDataSyncAlerts.js', () => ({
  notifyCommunityDragonSynced: vi.fn(),
}))

describe('runCommunityDragonSyncOnce', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    syncRankedEmblems.mockResolvedValue(Result.ok({ synced: 1, failed: 0, errors: [] }))
  })

  test('skips sync when game version unchanged', async () => {
    checkForNewVersion.mockResolvedValue({
      isErr: () => false,
      unwrap: () => ({ hasNew: false, current: '16.13.1', latest: '16.13.1' }),
    })

    const { runCommunityDragonSyncOnce } = await import('../../src/cron/communityDragonSync.js')
    const result = await runCommunityDragonSyncOnce()

    expect(result).toMatchObject({ ok: true, synced: 0, failed: 0, updated: false })
    expect(syncRankedEmblems).not.toHaveBeenCalled()
    expect(markSuccess).toHaveBeenCalled()
  })

  test('runs sync when force=true even if version unchanged', async () => {
    const { runCommunityDragonSyncOnce } = await import('../../src/cron/communityDragonSync.js')
    const result = await runCommunityDragonSyncOnce({ force: true })

    expect(result).toMatchObject({ ok: true, updated: true })
    expect(syncRankedEmblems).toHaveBeenCalled()
    expect(checkForNewVersion).not.toHaveBeenCalled()
  })
})
