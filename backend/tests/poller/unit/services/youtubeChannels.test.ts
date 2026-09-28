import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  addChannelToConfig,
  channelSyncStatus,
  readChannelsConfig,
  removeChannelFromConfig,
} from '../../../../src/services/youtubeChannels.js'

function tmp() {
  const root = mkdtempSync(join(tmpdir(), 'yt-'))
  const dirs = { backendDir: join(root, 'back'), frontendDir: join(root, 'front') }
  mkdirSync(dirs.backendDir, { recursive: true })
  mkdirSync(dirs.frontendDir, { recursive: true })
  return { root, dirs, configFile: join(dirs.backendDir, 'channels.json') }
}

describe('channels config', () => {
  it('reads a missing config as empty', async () => {
    const { configFile } = tmp()
    expect(await readChannelsConfig(configFile)).toEqual({ ok: true, value: { channels: [] } })
  })

  it('adds a channel once, then removes it (string or object entries)', async () => {
    const { configFile } = tmp()
    writeFileSync(configFile, JSON.stringify({ channels: ['UCold'] }))
    const channel = { channelId: 'UCnew', channelName: 'New' }
    const added = await addChannelToConfig(configFile, channel)
    expect(added).toEqual({ ok: true, channels: ['UCold', channel] })
    expect(await addChannelToConfig(configFile, channel)).toEqual(added)
    expect(await removeChannelFromConfig(configFile, 'UCold')).toEqual({ ok: true, channels: [channel] })
  })
})

describe('channelSyncStatus', () => {
  it('reports unsynced channels, then reads the backend or frontend file', async () => {
    const { dirs } = tmp()
    expect(await channelSyncStatus({ channelId: 'UC1', channelName: 'One' }, dirs)).toEqual({
      channelId: 'UC1',
      channelName: 'One',
      synced: false,
      lastSync: null,
      videoCount: 0,
    })
    writeFileSync(join(dirs.frontendDir, 'UC1.json'), JSON.stringify({ channelId: 'UC1', lastSync: 'x', videos: [1, 2] }))
    expect(await channelSyncStatus('UC1', dirs)).toEqual({
      channelId: 'UC1',
      channelName: 'UC1',
      synced: true,
      lastSync: 'x',
      videoCount: 2,
    })
  })
})
