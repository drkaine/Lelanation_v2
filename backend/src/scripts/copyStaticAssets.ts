import 'dotenv/config'
import { StaticAssetsService } from '../services/StaticAssetsService.js'
import { VersionService } from '../services/VersionService.js'
import { DiscordService } from '../services/DiscordService.js'

/**
 * Script to copy existing game data and images to frontend public directory
 * This can be run manually to populate static assets
 * 
 * Environment variables:
 * - RESTART_FRONTEND=true (default: false) - Restart frontend PM2 process after copying
 */
async function main() {
  const startTime = new Date()
  console.log('[Copy Static Assets] Starting...')

  const discordService = new DiscordService()
  // await discordService.sendSuccess(
  //   '🔄 Copy Static Assets Started',
  //   'Copying static assets to frontend',
  //   {
  //     startedAt: startTime.toISOString(),
  //   }
  // )

  const versionService = new VersionService()
  const staticAssets = new StaticAssetsService()

  // Get current version
  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isErr()) {
    const err = versionResult.unwrapErr()
    console.error('[Copy Static Assets] Failed to get current version:', err)
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Copy Static Assets - Version Check Failed',
      'Failed to get current game version',
      err,
      {
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      }
    )
    process.exit(1)
  }

  const versionInfo = versionResult.unwrap()
  if (!versionInfo || !versionInfo.currentVersion) {
    console.error('[Copy Static Assets] No current version found')
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Copy Static Assets - No Version Found',
      'No current version found in version.json',
      new Error('No current version'),
      {
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      }
    )
    process.exit(1)
  }

  const currentVersion = versionInfo.currentVersion
  console.log(`[Copy Static Assets] Current version: ${currentVersion}`)

  // Check if we should restart frontend (default: false, set RESTART_FRONTEND=true to enable)
  const shouldRestartFrontend = process.env.RESTART_FRONTEND === 'true'
  // Always build frontend when restarting to ensure new assets are included
  const shouldBuildFrontend = shouldRestartFrontend
  if (shouldRestartFrontend) {
    console.log('[Copy Static Assets] Frontend restart and build enabled (RESTART_FRONTEND=true)')
  }

  // Copy all assets (data + images) in one go
  console.log('[Copy Static Assets] Copying game data and images...')
  const copyResult = await staticAssets.copyAllAssetsToFrontend(
    currentVersion,
    ['fr_FR', 'en_US'],
    shouldRestartFrontend,
    shouldBuildFrontend
  )

  if (copyResult.isErr()) {
    const err = copyResult.unwrapErr()
    console.error('[Copy Static Assets] Failed to copy assets:', err)
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Copy Static Assets Failed',
      'Failed to copy static assets to frontend',
      err,
      {
        version: currentVersion,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      }
    )
    process.exit(1)
  }

  const stats = copyResult.unwrap()
  console.log(
    `[Copy Static Assets] Copied ${stats.dataCopied} data files, ${stats.imagesCopied} images (${stats.imagesSkipped} skipped)`
  )

  // Also copy YouTube data if it exists
  console.log('[Copy Static Assets] Copying YouTube data...')
  const youtubeResult = await staticAssets.copyYouTubeAssetsToFrontend(false) // Don't restart twice
  if (youtubeResult.isOk()) {
    const youtubeStats = youtubeResult.unwrap()
    console.log(
      `[Copy Static Assets] Copied ${youtubeStats.copied} YouTube files, deleted ${youtubeStats.deleted} backend files`
    )
  } else {
    console.warn('[Copy Static Assets] Failed to copy YouTube data:', youtubeResult.unwrapErr())
    // Don't fail if YouTube data doesn't exist yet
  }

  if (shouldRestartFrontend) {
    console.log('[Copy Static Assets] Frontend PM2 restart completed')
  }

  // Send success notification
  const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
  const successContext: Record<string, unknown> = {
    version: currentVersion,
    dataFiles: stats.dataCopied,
    imagesCopied: stats.imagesCopied,
    imagesSkipped: stats.imagesSkipped,
    duration: `${duration}s`,
    timestamp: new Date().toISOString(),
  }

  if (youtubeResult.isOk()) {
    const youtubeStats = youtubeResult.unwrap()
    successContext.youtubeFiles = youtubeStats.copied
    successContext.youtubeDeleted = youtubeStats.deleted
  }

  if (shouldRestartFrontend) {
    successContext.frontendRestarted = true
  }

  // await discordService.sendSuccess(
  //   '✅ Copy Static Assets Completed Successfully',
  //   'Static assets copied to frontend successfully',
  //   successContext
  // )

  console.log('[Copy Static Assets] Completed successfully!')
}

main().catch(async (error) => {
  console.error('[Copy Static Assets] Fatal error:', error)
  const discordService = new DiscordService()
  await discordService.sendAlert(
    '❌ Copy Static Assets - Fatal Error',
    'An unexpected error occurred during asset copy',
    error,
    {
      timestamp: new Date().toISOString(),
    }
  )
  process.exit(1)
})
