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

export type ChampionRegionChange = {
  championId: string
  name: string
  from?: string
  to: string
}

export type ChampionRegionsUpdatedContext = {
  applied: ChampionRegionChange[]
  universeCount: number
  triggeredBy?: string
}

export type ChampionRegionsCheckedContext = {
  universeCount: number
  applied: ChampionRegionChange[]
  manualReview: ChampionRegionChange[]
  unknownFactionSlugs: string[]
  unresolved: Array<{ slug: string; name: string }>
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

function formatChampionRegionChanges(changes: ChampionRegionChange[], limit = 8): string {
  if (changes.length === 0) return '—'
  const lines = changes.slice(0, limit).map(change => {
    if (change.from) return `${change.name} (${change.championId}): ${change.from} → ${change.to}`
    return `${change.name} (${change.championId}): ${change.to}`
  })
  if (changes.length > limit) lines.push(`… +${changes.length - limit} autres`)
  return lines.join('\n')
}

/** Champion regions auto-updated from LoL Universe. */
export async function notifyChampionRegionsUpdated(
  context: ChampionRegionsUpdatedContext
): Promise<void> {
  await notify(async discord => {
    await discord.sendSuccess(
      '✅ Régions champions mises à jour',
      `${context.applied.length} entrée(s) synchronisée(s) depuis l’Univers LoL`,
      {
        universeChampions: context.universeCount,
        updated: context.applied.length,
        changes: formatChampionRegionChanges(context.applied),
        ...(context.triggeredBy ? { triggeredBy: context.triggeredBy } : {}),
      }
    )
  }, 'champion regions updated')
}

/** Champion regions checked — manual review or unknown factions. */
export async function notifyChampionRegionsChecked(
  context: ChampionRegionsCheckedContext
): Promise<void> {
  await notify(async discord => {
    const needsAttention =
      context.unknownFactionSlugs.length > 0 ||
      context.manualReview.length > 0 ||
      context.unresolved.length > 0

    await discord.sendInfo(
      needsAttention
        ? '⚠️ Régions champions — revue manuelle'
        : 'ℹ️ Régions champions vérifiées',
      needsAttention
        ? 'Écarts détectés entre Lelanation et l’Univers LoL'
        : 'Aucune action automatique requise',
      {
        universeChampions: context.universeCount,
        autoApplied: context.applied.length,
        manualReview: context.manualReview.length,
        unknownFactions: context.unknownFactionSlugs.join(', ') || 'none',
        unresolved: context.unresolved.map(entry => entry.name).join(', ') || 'none',
        ...(context.manualReview.length
          ? { manualChanges: formatChampionRegionChanges(context.manualReview) }
          : {}),
        ...(context.triggeredBy ? { triggeredBy: context.triggeredBy } : {}),
      }
    )
  }, 'champion regions checked')
}

/** Champion region sync failed. */
export async function notifyChampionRegionsSyncFailure(
  error: string,
  context?: { triggeredBy?: string }
): Promise<void> {
  await notify(async discord => {
    await discord.sendAlert(
      '❌ Sync régions champions échouée',
      'La vérification des régions champions depuis l’Univers LoL a échoué',
      error,
      {
        ...(context?.triggeredBy ? { triggeredBy: context.triggeredBy } : {}),
      }
    )
  }, 'champion regions sync failure')
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
