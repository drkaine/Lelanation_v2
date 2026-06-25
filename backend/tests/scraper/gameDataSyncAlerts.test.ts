import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  notifyCommunityDragonSynced,
  notifyDataDragonSynced,
  notifyNewVersionDetected,
  notifyPatchNotesScraped,
} from '../../src/services/gameDataSyncAlerts.js'

const sendSuccess = vi.fn().mockResolvedValue({ isOk: () => true })
const sendInfo = vi.fn().mockResolvedValue({ isOk: () => true })

vi.mock('../../src/services/DiscordService.js', () => ({
  DiscordService: class MockDiscordService {
    sendSuccess = sendSuccess
    sendInfo = sendInfo
    sendAlert = vi.fn()
  },
}))

describe('gameDataSyncAlerts', () => {
  beforeEach(() => {
    sendSuccess.mockClear()
    sendInfo.mockClear()
  })

  it('notifyNewVersionDetected uses sendInfo', async () => {
    await notifyNewVersionDetected({
      previousVersion: '16.12.1',
      latestVersion: '16.13.1',
      triggeredBy: 'test',
    })

    expect(sendInfo).toHaveBeenCalledOnce()
    expect(sendInfo.mock.calls[0][0]).toContain('Nouvelle version')
    expect(sendInfo.mock.calls[0][2]).toMatchObject({
      latestVersion: '16.13.1',
      triggeredBy: 'test',
    })
  })

  it('notifyDataDragonSynced uses sendSuccess', async () => {
    await notifyDataDragonSynced({
      version: '16.13.1',
      syncedAt: '2026-06-25T00:00:00.000Z',
      triggeredBy: 'dataDragonSync',
    })

    expect(sendSuccess).toHaveBeenCalledOnce()
    expect(sendSuccess.mock.calls[0][0]).toContain('Data Dragon')
    expect(sendSuccess.mock.calls[0][2]).toMatchObject({
      version: '16.13.1',
      triggeredBy: 'dataDragonSync',
    })
  })

  it('notifyCommunityDragonSynced uses sendSuccess', async () => {
    await notifyCommunityDragonSynced({
      synced: 12,
      failed: 0,
      triggeredBy: 'communityDragonSync',
    })

    expect(sendSuccess).toHaveBeenCalledOnce()
    expect(sendSuccess.mock.calls[0][0]).toContain('Community Dragon')
  })

  it('notifyPatchNotesScraped includes summary stats', async () => {
    await notifyPatchNotesScraped({
      patchVersion: '16.13',
      entitiesEn: 20,
      changesEn: 55,
      hasSummaryImage: true,
      triggeredBy: 'dataDragonSync',
    })

    expect(sendSuccess).toHaveBeenCalledOnce()
    expect(sendSuccess.mock.calls[0][0]).toContain('Patch notes')
    expect(sendSuccess.mock.calls[0][2]).toMatchObject({
      patchVersion: '16.13',
      entitiesEn: 20,
      hasSummaryImage: 'yes',
    })
  })
})
