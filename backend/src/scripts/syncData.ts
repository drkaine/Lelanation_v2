import 'dotenv/config'
import { join } from 'path'
import { DataDragonService } from '../services/DataDragonService.js'
import { VersionService } from '../services/VersionService.js'
import { YouTubeService } from '../services/YouTubeService.js'
import { FileManager } from '../utils/fileManager.js'

interface YouTubeChannelConfig {
  channelId: string
  channelName: string
}

type YouTubeChannelsConfigFile = {
  channels: Array<YouTubeChannelConfig | string>
}

async function main(): Promise<void> {
  console.log('[sync:data] Starting manual data synchronization...')

  // --- Data Dragon ---
  console.log('[sync:data] Checking latest Data Dragon version...')
  const versionService = new VersionService()
  const dataDragonService = new DataDragonService()

  const versionCheck = await versionService.checkForNewVersion()
  if (versionCheck.isErr()) {
    const err = versionCheck.unwrapErr()
    console.error('[sync:data] Failed to check Data Dragon version:', err)
    process.exitCode = 1
    return
  }

  const { latest } = versionCheck.unwrap()
  console.log(`[sync:data] Syncing Data Dragon data for version: ${latest}`)

  const ddSync = await dataDragonService.syncGameData(latest)
  if (ddSync.isErr()) {
    const err = ddSync.unwrapErr()
    console.error('[sync:data] Data Dragon sync failed:', err)
    process.exitCode = 1
    return
  }

  const ddSyncData = ddSync.unwrap()
  const updateVersion = await versionService.updateVersion(ddSyncData.version)
  if (updateVersion.isErr()) {
    console.error(
      '[sync:data] Data Dragon sync succeeded but failed to update version.json:',
      updateVersion.unwrapErr()
    )
    process.exitCode = 1
    return
  }

  console.log(
    `[sync:data] Data Dragon sync OK. Version: ${ddSyncData.version}, syncedAt: ${ddSyncData.syncedAt.toISOString()}`
  )

  // --- YouTube ---
  const youtubeChannelsFile = join(process.cwd(), 'data', 'youtube', 'channels.json')
  const youtubeService = new YouTubeService()

  const channelsResult = await FileManager.readJson<YouTubeChannelsConfigFile>(youtubeChannelsFile)

  if (channelsResult.isErr()) {
    const err = channelsResult.unwrapErr()
    // If config is missing, create an empty one and finish without error.
    if ((err as { code?: string }).code === 'FILE_NOT_FOUND') {
      await FileManager.writeJson(youtubeChannelsFile, { channels: [] })
      console.log(
        `[sync:data] Created missing ${youtubeChannelsFile}. No channels configured, skipping YouTube sync.`
      )
      return
    }

    console.error('[sync:data] Failed to read YouTube channels config:', err)
    process.exitCode = 1
    return
  }

  const channels = channelsResult.unwrap().channels ?? []
  if (channels.length === 0) {
    console.log(
      `[sync:data] No YouTube channels configured in ${youtubeChannelsFile}. Skipping YouTube sync.`
    )
    return
  }

  console.log(`[sync:data] Syncing YouTube channels: ${channels.length}`)
  const ytSync = await youtubeService.syncChannels(channels)
  if (ytSync.isErr()) {
    console.error('[sync:data] YouTube sync failed:', ytSync.unwrapErr())
    process.exitCode = 1
    return
  }

  const ytSyncData = ytSync.unwrap()
  console.log(
    `[sync:data] YouTube sync OK. Synced ${ytSyncData.syncedChannels}/${channels.length} channels, totalVideos: ${ytSyncData.totalVideos}`
  )
}

main().catch((error) => {
  console.error('[sync:data] Unexpected error:', error)
  process.exitCode = 1
})

