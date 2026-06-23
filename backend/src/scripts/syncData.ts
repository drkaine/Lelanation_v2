import 'dotenv/config'
import { join } from 'path'
import { DataDragonService } from '../services/DataDragonService.js'
import { CommunityDragonService } from '../services/CommunityDragonService.js'
import { VersionService } from '../services/VersionService.js'
import { YouTubeService } from '../services/YouTubeService.js'
import { DiscordService } from '../services/DiscordService.js'
import { StaticAssetsService } from '../services/StaticAssetsService.js'
import { TheorycraftDataBuilderService } from '../services/TheorycraftDataBuilderService.js'
import { FileManager } from '../utils/fileManager.js'
import { refreshApiRiotFixturesOnPatchChange } from '../services/ApiRiotFixturesService.js'
import { normalizeGamePatchKey } from '../services/VersionService.js'

interface YouTubeChannelConfig {
  channelId: string
  channelName: string
}

type YouTubeChannelsConfigFile = {
  channels: Array<YouTubeChannelConfig | string>
}

async function main(): Promise<void> {
  const startTime = new Date()

  const discordService = new DiscordService()
  // await discordService.sendSuccess(
  //   '🔄 Manual Data Sync Started',
  //   'Manual data synchronization script has started',
  //   {
  //     startedAt: startTime.toISOString(),
  //   }
  // )

  // --- Data Dragon ---
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

  const patchLabel = normalizeGamePatchKey(ddSyncData.version)
  if (patchLabel) {
    try {
      const fixtureResult = await refreshApiRiotFixturesOnPatchChange(patchLabel)
      if (fixtureResult.refreshed) {
        console.log(
          `[sync:data] API Riot fixtures refreshed patch=${fixtureResult.patch} matchId=${fixtureResult.matchId}`,
        )
      } else {
        console.log(
          `[sync:data] API Riot fixtures skipped patch=${fixtureResult.patch ?? patchLabel} reason=${fixtureResult.reason ?? 'unknown'}`,
        )
      }
    } catch (fixtureError) {
      const message = fixtureError instanceof Error ? fixtureError.message : String(fixtureError)
      console.warn('[sync:data] API Riot fixtures refresh failed (non-blocking):', message)
    }
  }

  // --- Community Dragon (static assets only; theorycraft CD data via TheorycraftDataBuilder) ---
  const communityDragonService = new CommunityDragonService()

  const emblemSync = await communityDragonService.syncRankedEmblems()
  if (emblemSync.isErr()) {
    console.warn('[sync:data] Ranked emblems sync failed:', emblemSync.unwrapErr())
  } else {
    const emblemData = emblemSync.unwrap()
    if (emblemData.failed > 0) {
      console.warn(`[sync:data] Ranked emblems sync completed with ${emblemData.failed} failures`)
    }
  }

  const objectiveIconsSync = await communityDragonService.syncScoreboardObjectiveIcons()
  if (objectiveIconsSync.isErr()) {
    console.warn('[sync:data] Scoreboard objective icons sync failed:', objectiveIconsSync.unwrapErr())
  } else {
    const objectiveIconsData = objectiveIconsSync.unwrap()
    if (objectiveIconsData.failed > 0) {
      console.warn(
        `[sync:data] Scoreboard objective icons sync completed with ${objectiveIconsData.failed} failures`
      )
    }
  }

  const pingIconsSync = await communityDragonService.syncMinimapPingIcons()
  if (pingIconsSync.isErr()) {
    console.warn('[sync:data] Minimap ping icons sync failed:', pingIconsSync.unwrapErr())
  } else {
    const pingIconsData = pingIconsSync.unwrap()
    if (pingIconsData.failed > 0) {
      console.warn(
        `[sync:data] Minimap ping icons sync completed with ${pingIconsData.failed} failures`
      )
    }
  }

  const mapPlannerSync = await communityDragonService.syncMapPlannerAssets()
  if (mapPlannerSync.isErr()) {
    console.warn('[sync:data] Map planner assets sync failed:', mapPlannerSync.unwrapErr())
  } else {
    const mapPlannerData = mapPlannerSync.unwrap()
    if (mapPlannerData.failed > 0) {
      console.warn(
        `[sync:data] Map planner assets sync completed with ${mapPlannerData.failed} failures`
      )
    }
  }

  const kaynHudSync = await communityDragonService.syncKaynHudImages()
  if (kaynHudSync.isErr()) {
    console.warn('[sync:data] Kayn HUD images sync failed:', kaynHudSync.unwrapErr())
  } else {
    const kaynHudData = kaynHudSync.unwrap()
    if (kaynHudData.failed > 0) {
      console.warn(`[sync:data] Kayn HUD images sync completed with ${kaynHudData.failed} failures`)
    }
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
      return
    }

    console.error('[sync:data] Failed to read YouTube channels config:', err)
    process.exitCode = 1
    return
  }

  const channels = channelsResult.unwrap().channels ?? []
  if (channels.length === 0) {
    return
  }

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

  // --- Copy Assets to Frontend ---
  const staticAssets = new StaticAssetsService()
  const theorycraftBuilder = new TheorycraftDataBuilderService()
  const theorycraftBuild = await theorycraftBuilder.build(ddSyncData.version)
  if (theorycraftBuild.isErr()) {
    console.warn('[sync:data] Theorycraft data build failed:', theorycraftBuild.unwrapErr())
  }
  
  // Check if we should restart frontend (default: false, set RESTART_FRONTEND=true to enable)
  const shouldRestartFrontend = process.env.RESTART_FRONTEND === 'true'
  // Always build frontend when restarting to ensure new assets are included
  const shouldBuildFrontend = shouldRestartFrontend 

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

  // Also copy YouTube data if it exists
  const youtubeResult = await staticAssets.copyYouTubeAssetsToFrontend(false) // Don't restart twice


  // Send success notification with summary
  const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
  const successContext: Record<string, unknown> = {
    version: ddSyncData.version,
    dataDragonSyncedAt: ddSyncData.syncedAt.toISOString(),
    communityDragonEmblemsSynced: emblemSync.isOk() ? emblemSync.unwrap().synced : 0,
    communityDragonObjectiveIconsSynced: objectiveIconsSync.isOk()
      ? objectiveIconsSync.unwrap().synced
      : 0,
    communityDragonMapPlannerSynced: mapPlannerSync.isOk() ? mapPlannerSync.unwrap().synced : 0,
    youtubeChannels: `${ytSyncData.syncedChannels}/${channels.length}`,
    youtubeVideos: ytSyncData.totalVideos,
    assetsDataFiles: copyStats.dataCopied,
    assetsImagesCopied: copyStats.imagesCopied,
    assetsImagesSkipped: copyStats.imagesSkipped,
    duration: `${duration}s`,
    timestamp: new Date().toISOString(),
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

