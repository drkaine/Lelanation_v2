import 'dotenv/config'
import { join } from 'path'
import { DataDragonService } from '../services/DataDragonService.js'
import { CommunityDragonService } from '../services/CommunityDragonService.js'
import { ChampionMergeService } from '../services/ChampionMergeService.js'
import { VersionService } from '../services/VersionService.js'
import { YouTubeService } from '../services/YouTubeService.js'
import { DiscordService } from '../services/DiscordService.js'
import { StaticAssetsService } from '../services/StaticAssetsService.js'
import { FileManager } from '../utils/fileManager.js'

interface YouTubeChannelConfig {
  channelId: string
  channelName: string
}

type YouTubeChannelsConfigFile = {
  channels: Array<YouTubeChannelConfig | string>
}

async function main(): Promise<void> {
  const startTime = new Date()
  console.log('[sync:data] Starting manual data synchronization...')

  const discordService = new DiscordService()
  // await discordService.sendSuccess(
  //   '🔄 Manual Data Sync Started',
  //   'Manual data synchronization script has started',
  //   {
  //     startedAt: startTime.toISOString(),
  //   }
  // )

  // --- Data Dragon ---
  console.log('[sync:data] Checking latest Data Dragon version...')
  const versionService = new VersionService()
  const dataDragonService = new DataDragonService()

  const versionCheck = await versionService.checkForNewVersion()
  if (versionCheck.isErr()) {
    const err = versionCheck.unwrapErr()
    console.error('[sync:data] Failed to check Data Dragon version:', err)
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Manual Data Sync - Version Check Failed',
      'Failed to check for new game version',
      err,
      {
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      }
    )
    process.exitCode = 1
    return
  }

  const { latest } = versionCheck.unwrap()
  console.log(`[sync:data] Syncing Data Dragon data for version: ${latest}`)

  const ddSync = await dataDragonService.syncGameData(latest)
  if (ddSync.isErr()) {
    const err = ddSync.unwrapErr()
    console.error('[sync:data] Data Dragon sync failed:', err)
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Manual Data Sync - Data Dragon Failed',
      'Failed to synchronize Data Dragon data',
      err,
      {
        version: latest,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      }
    )
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

  // --- Community Dragon ---
  console.log('[sync:data] Syncing Community Dragon data...')
  const communityDragonService = new CommunityDragonService()

  const cdSync = await communityDragonService.syncAllChampions()
  if (cdSync.isErr()) {
    const err = cdSync.unwrapErr()
    console.error('[sync:data] Community Dragon sync failed:', err)
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Manual Data Sync - Community Dragon Failed',
      'Failed to synchronize Community Dragon data',
      err,
      {
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      }
    )
    process.exitCode = 1
    return
  }

  const cdSyncData = cdSync.unwrap()
  console.log(
    `[sync:data] Community Dragon sync OK. Synced: ${cdSyncData.synced}, Failed: ${cdSyncData.failed}, Skipped: ${cdSyncData.skipped}`
  )
  if (cdSyncData.errors.length > 0) {
    console.warn(
      `[sync:data] Community Dragon sync completed with ${cdSyncData.errors.length} errors:`
    )
    cdSyncData.errors.slice(0, 10).forEach((err) => {
      console.warn(`[sync:data]   - ${err.champion}: ${err.error}`)
    })
    if (cdSyncData.errors.length > 10) {
      console.warn(
        `[sync:data]   ... and ${cdSyncData.errors.length - 10} more errors`
      )
    }
  }

  // --- Merge champions (CD + DDragon) → single championFull (only for CD locale: fr_FR) ---
  console.log('[sync:data] Merging champion data (Community Dragon + Data Dragon)...')
  const championMergeService = new ChampionMergeService()
  const mergeResult = await championMergeService.mergeChampionFull(ddSyncData.version, 'fr_FR')
  if (mergeResult.isErr()) {
    console.warn('[sync:data] Merge failed:', mergeResult.unwrapErr().message)
  } else {
    const { merged, skipped } = mergeResult.unwrap()
    console.log(`[sync:data] Champion merge OK (fr_FR): ${merged} merged, ${skipped} skipped`)
  }

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
    const err = ytSync.unwrapErr()
    console.error('[sync:data] YouTube sync failed:', err)
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Manual Data Sync - YouTube Failed',
      'Failed to synchronize YouTube data',
      err,
      {
        channels: channels.length,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      }
    )
    process.exitCode = 1
    return
  }

  const ytSyncData = ytSync.unwrap()
  console.log(
    `[sync:data] YouTube sync OK. Synced ${ytSyncData.syncedChannels}/${channels.length} channels, totalVideos: ${ytSyncData.totalVideos}`
  )

  // --- Copy Assets to Frontend ---
  console.log('[sync:data] Copying assets to frontend...')
  const staticAssets = new StaticAssetsService()
  
  // Check if we should restart frontend (default: false, set RESTART_FRONTEND=true to enable)
  const shouldRestartFrontend = process.env.RESTART_FRONTEND === 'true'
  // Always build frontend when restarting to ensure new assets are included
  const shouldBuildFrontend = shouldRestartFrontend
  if (shouldRestartFrontend) {
    console.log('[sync:data] Frontend restart and build enabled (RESTART_FRONTEND=true)')
  }

  const copyResult = await staticAssets.copyAllAssetsToFrontend(
    ddSyncData.version,
    ['fr_FR', 'en_US'],
    shouldRestartFrontend,
    shouldBuildFrontend
  )

  if (copyResult.isErr()) {
    const err = copyResult.unwrapErr()
    console.error('[sync:data] Failed to copy assets to frontend:', err)
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Manual Data Sync - Asset Copy Failed',
      'Data sync succeeded but failed to copy assets to frontend',
      err,
      {
        version: ddSyncData.version,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      }
    )
    process.exitCode = 1
    return
  }

  const copyStats = copyResult.unwrap()
  console.log(
    `[sync:data] Assets copied to frontend: ${copyStats.dataCopied} data files, ${copyStats.imagesCopied} images (${copyStats.imagesSkipped} skipped)`
  )

  // Also copy YouTube data if it exists
  console.log('[sync:data] Copying YouTube data to frontend...')
  const youtubeResult = await staticAssets.copyYouTubeAssetsToFrontend(false) // Don't restart twice
  if (youtubeResult.isOk()) {
    const youtubeStats = youtubeResult.unwrap()
    console.log(
      `[sync:data] YouTube data copied: ${youtubeStats.copied} files, deleted ${youtubeStats.deleted} backend files`
    )
  } else {
    console.warn('[sync:data] Failed to copy YouTube data:', youtubeResult.unwrapErr())
    // Don't fail if YouTube data doesn't exist yet
  }

  // Send success notification with summary
  const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
  const successContext: Record<string, unknown> = {
    version: ddSyncData.version,
    dataDragonSyncedAt: ddSyncData.syncedAt.toISOString(),
    communityDragonSynced: cdSyncData.synced,
    communityDragonFailed: cdSyncData.failed,
    communityDragonSkipped: cdSyncData.skipped,
    youtubeChannels: `${ytSyncData.syncedChannels}/${channels.length}`,
    youtubeVideos: ytSyncData.totalVideos,
    assetsDataFiles: copyStats.dataCopied,
    assetsImagesCopied: copyStats.imagesCopied,
    assetsImagesSkipped: copyStats.imagesSkipped,
    duration: `${duration}s`,
    timestamp: new Date().toISOString(),
  }

  if (cdSyncData.errors.length > 0) {
    successContext.communityDragonErrors = cdSyncData.errors.length
  }

  if (youtubeResult.isOk()) {
    const youtubeStats = youtubeResult.unwrap()
    successContext.youtubeFilesCopied = youtubeStats.copied
    successContext.youtubeFilesDeleted = youtubeStats.deleted
  }

  if (shouldRestartFrontend) {
    successContext.frontendRestarted = true
  }

  // await discordService.sendSuccess(
  //   '✅ Manual Data Sync Completed Successfully',
  //   'All data sources synchronized and assets copied to frontend',
  //   successContext
  // )
}

main().catch(async (error) => {
  console.error('[sync:data] Unexpected error:', error)
  const discordService = new DiscordService()
  await discordService.sendAlert(
    '❌ Manual Data Sync - Fatal Error',
    'An unexpected error occurred during manual data synchronization',
    error,
    {
      timestamp: new Date().toISOString(),
    }
  )
  process.exitCode = 1
})

