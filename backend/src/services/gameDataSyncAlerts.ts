/**
 * Discord success/info notifications for game data sync pipeline.
 */

import { DiscordService } from './DiscordService.js'

export type NewVersionAlertContext = {
  previousVersion?: string
  latestVersion: string
  triggeredBy?: string
}

export type DataDragonSyncedContext = {
  version: string
  previousVersion?: string
  syncedAt: string
  durationSeconds?: number
  theorycraftChampions?: number
  assetsDataFiles?: number
  assetsImagesCopied?: number
  triggeredBy?: string
}

export type CommunityDragonSyncedContext = {
  synced: number
  failed: number
  emblemsSynced?: number
  objectiveIconsSynced?: number
  pingIconsSynced?: number
  mapPlannerSynced?: number
  kaynHudSynced?: number
  durationSeconds?: number
  triggeredBy?: string
}

export type PatchNotesScrapedContext = {
  patchVersion: string
  url?: string
  entitiesEn?: number
  changesEn?: number
  hasSummaryImage?: boolean
  locales?: string[]
  triggeredBy?: string
}

async function notify(
  send: (discord: DiscordService) => Promise<unknown>,
  label: string
): Promise<void> {
  try {
    await send(new DiscordService())
  } catch (error) {
    console.error(`[gameDataSyncAlerts] Failed to send ${label}:`, error)
  }
}

/** New game version spotted (before sync starts). */
export async function notifyNewVersionDetected(
  context: NewVersionAlertContext
): Promise<void> {
  await notify(async discord => {
    await discord.sendInfo(
      '🆕 Nouvelle version LoL détectée',
      `Passage ${context.previousVersion ?? '—'} → **${context.latestVersion}**`,
      {
        previousVersion: context.previousVersion ?? 'none',
        latestVersion: context.latestVersion,
        ...(context.triggeredBy ? { triggeredBy: context.triggeredBy } : {}),
      }
    )
  }, 'new version')
}

/** Data Dragon (ddragon) sync completed. */
export async function notifyDataDragonSynced(context: DataDragonSyncedContext): Promise<void> {
  await notify(async discord => {
    await discord.sendSuccess(
      '✅ Data Dragon synchronisé',
      `Données **ddragon** récupérées pour la version **${context.version}**`,
      {
        version: context.version,
        ...(context.previousVersion ? { previousVersion: context.previousVersion } : {}),
        syncedAt: context.syncedAt,
        ...(context.durationSeconds != null ? { duration: `${context.durationSeconds}s` } : {}),
        ...(context.theorycraftChampions != null
          ? { theorycraftChampions: context.theorycraftChampions }
          : {}),
        ...(context.assetsDataFiles != null ? { dataFiles: context.assetsDataFiles } : {}),
        ...(context.assetsImagesCopied != null
          ? { imagesCopied: context.assetsImagesCopied }
          : {}),
        ...(context.triggeredBy ? { triggeredBy: context.triggeredBy } : {}),
      }
    )
  }, 'ddragon sync')
}

/** Community Dragon (cdragon) assets sync completed. */
export async function notifyCommunityDragonSynced(
  context: CommunityDragonSyncedContext
): Promise<void> {
  await notify(async discord => {
    const hasErrors = context.failed > 0
    await discord.sendSuccess(
      hasErrors
        ? '⚠️ Community Dragon synchronisé (erreurs partielles)'
        : '✅ Community Dragon synchronisé',
      hasErrors
        ? `${context.synced} assets OK, ${context.failed} en échec`
        : `Assets **cdragon** récupérés (${context.synced} fichiers)`,
      {
        synced: context.synced,
        failed: context.failed,
        ...(context.emblemsSynced != null ? { emblems: context.emblemsSynced } : {}),
        ...(context.objectiveIconsSynced != null
          ? { objectiveIcons: context.objectiveIconsSynced }
          : {}),
        ...(context.pingIconsSynced != null ? { pingIcons: context.pingIconsSynced } : {}),
        ...(context.mapPlannerSynced != null ? { mapPlanner: context.mapPlannerSynced } : {}),
        ...(context.kaynHudSynced != null ? { kaynHud: context.kaynHudSynced } : {}),
        ...(context.durationSeconds != null ? { duration: `${context.durationSeconds}s` } : {}),
        ...(context.triggeredBy ? { triggeredBy: context.triggeredBy } : {}),
      }
    )
  }, 'cdragon sync')
}

/** Patch notes scrape + summary completed. */
export async function notifyPatchNotesScraped(context: PatchNotesScrapedContext): Promise<void> {
  await notify(async discord => {
    const parts = [
      `Patch **${context.patchVersion}** scrapé`,
      context.entitiesEn != null ? `${context.entitiesEn} entités (EN)` : null,
      context.hasSummaryImage ? 'résumé visuel OK' : 'pas de résumé visuel',
    ].filter(Boolean)

    await discord.sendSuccess(
      '✅ Patch notes récupérées',
      parts.join(' — '),
      {
        patchVersion: context.patchVersion,
        ...(context.url ? { url: context.url } : {}),
        ...(context.entitiesEn != null ? { entitiesEn: context.entitiesEn } : {}),
        ...(context.changesEn != null ? { changesEn: context.changesEn } : {}),
        hasSummaryImage: context.hasSummaryImage ? 'yes' : 'no',
        ...(context.locales?.length ? { locales: context.locales.join(', ') } : {}),
        ...(context.triggeredBy ? { triggeredBy: context.triggeredBy } : {}),
      }
    )
  }, 'patch notes scrape')
}
