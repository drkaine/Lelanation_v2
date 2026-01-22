import 'dotenv/config'
import { StaticAssetsService } from '../services/StaticAssetsService.js'
import { VersionService } from '../services/VersionService.js'

/**
 * Script to copy existing game data and images to frontend public directory
 * This can be run manually to populate static assets
 * 
 * Environment variables:
 * - RESTART_FRONTEND=true (default: false) - Restart frontend PM2 process after copying
 */
async function main() {
  console.log('[Copy Static Assets] Starting...')

  const versionService = new VersionService()
  const staticAssets = new StaticAssetsService()

  // Get current version
  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isErr()) {
    console.error('[Copy Static Assets] Failed to get current version:', versionResult.unwrapErr())
    process.exit(1)
  }

  const versionInfo = versionResult.unwrap()
  if (!versionInfo || !versionInfo.currentVersion) {
    console.error('[Copy Static Assets] No current version found')
    process.exit(1)
  }

  const currentVersion = versionInfo.currentVersion
  console.log(`[Copy Static Assets] Current version: ${currentVersion}`)

  // Check if we should restart frontend (default: false, set RESTART_FRONTEND=true to enable)
  const shouldRestartFrontend = process.env.RESTART_FRONTEND === 'true'
  if (shouldRestartFrontend) {
    console.log('[Copy Static Assets] Frontend restart enabled (RESTART_FRONTEND=true)')
  }

  // Copy all assets (data + images) in one go
  console.log('[Copy Static Assets] Copying game data and images...')
  const copyResult = await staticAssets.copyAllAssetsToFrontend(
    currentVersion,
    ['fr_FR', 'en_US'],
    shouldRestartFrontend
  )

  if (copyResult.isErr()) {
    console.error('[Copy Static Assets] Failed to copy assets:', copyResult.unwrapErr())
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

  console.log('[Copy Static Assets] Completed successfully!')
}

main().catch(error => {
  console.error('[Copy Static Assets] Fatal error:', error)
  process.exit(1)
})
