#!/usr/bin/env tsx
/**
 * Send test Discord notifications for the game data sync pipeline.
 * Usage: npm run script:test-discord-sync
 */
import 'dotenv/config'
import {
  notifyCommunityDragonSynced,
  notifyDataDragonSynced,
  notifyNewVersionDetected,
  notifyPatchNotesScraped,
} from '../services/gameDataSyncAlerts.js'

const triggeredBy = 'testDiscordSyncNotifications'

async function main(): Promise<void> {
  if (!process.env.DISCORD_WEBHOOK_URL?.trim()) {
    console.error('DISCORD_WEBHOOK_URL is not set — cannot send test notifications.')
    process.exitCode = 1
    return
  }

  console.log('[test-discord-sync] Sending 4 test notifications…')

  await notifyNewVersionDetected({
    previousVersion: '16.12.1',
    latestVersion: '16.13.1',
    triggeredBy,
  })
  console.log('  ✓ new version')

  await notifyDataDragonSynced({
    version: '16.13.1',
    previousVersion: '16.12.1',
    syncedAt: new Date().toISOString(),
    durationSeconds: 42,
    theorycraftChampions: 173,
    assetsDataFiles: 128,
    assetsImagesCopied: 540,
    triggeredBy,
  })
  console.log('  ✓ ddragon')

  await notifyCommunityDragonSynced({
    synced: 87,
    failed: 0,
    emblemsSynced: 10,
    objectiveIconsSynced: 12,
    pingIconsSynced: 15,
    mapPlannerSynced: 40,
    kaynHudSynced: 10,
    durationSeconds: 18,
    triggeredBy,
  })
  console.log('  ✓ cdragon')

  await notifyPatchNotesScraped({
    patchVersion: '16.13',
    url: 'https://www.leagueoflegends.com/en-us/news/game-updates/patch-16-13-notes',
    entitiesEn: 24,
    changesEn: 68,
    hasSummaryImage: true,
    locales: ['en-GB', 'fr-FR'],
    triggeredBy,
  })
  console.log('  ✓ patch notes summary')

  console.log('[test-discord-sync] Done — check Discord.')
}

main().catch(error => {
  console.error('[test-discord-sync] Fatal:', error)
  process.exitCode = 1
})
