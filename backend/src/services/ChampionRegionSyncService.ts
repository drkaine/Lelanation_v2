import { join } from 'path'
import { chromium, type Browser } from 'playwright'
import { FileManager } from '../utils/fileManager.js'
import { createCronLogger } from '../utils/cronLogger.js'
import {
  applyAutoChampionRegionUpdates,
  compareChampionRegions,
  sortChampionMapping,
  type ChampionRegionDiff,
  type UniverseChampionEntry,
} from './championRegionCompare.js'
import { normalizeChampionKey } from './championRegionFactionMap.js'
import {
  notifyChampionRegionsChecked,
  notifyChampionRegionsSyncFailure,
  notifyChampionRegionsUpdated,
} from './gameDataSyncAlerts.js'

const UNIVERSE_CHAMPIONS_URL = 'https://universe.leagueoflegends.com/fr_FR/champions/'
const UNIVERSE_BROWSE_JSON_FRAGMENT = 'champion-browse/index.json'

export type RegionsFilePayload = {
  regionsData: Record<string, [string, string]>
  championMapping: Record<string, string>
}

export type ChampionLiteEntry = {
  id: string
  name: string
}

export type ChampionRegionSyncResult = {
  ok: true
  universeCount: number
  fileUpdated: boolean
  applied: ChampionRegionDiff[]
  manualReview: ChampionRegionDiff[]
  unknownFactionSlugs: string[]
  unresolved: Array<{ slug: string; name: string }>
  triggeredBy?: string
}

export type ChampionRegionSyncError = {
  ok: false
  error: string
  triggeredBy?: string
}

type UniverseBrowseChampion = {
  slug: string
  name: string
  'associated-faction-slug': string
}

function resolveFrontendPublicDir(): string {
  return join(process.cwd(), '..', 'frontend', 'public')
}

function resolveRegionsPath(): string {
  return join(resolveFrontendPublicDir(), 'data', 'regions.json')
}

function resolveChampionsLitePath(): string {
  return join(resolveFrontendPublicDir(), 'data', 'champions-lite.json')
}

function buildChampionIdLookup(champions: ChampionLiteEntry[]): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const champion of champions) {
    lookup.set(normalizeChampionKey(champion.id), champion.id)
    lookup.set(normalizeChampionKey(champion.name), champion.id)
  }
  return lookup
}

async function fetchUniverseChampions(browser?: Browser): Promise<UniverseChampionEntry[]> {
  const ownsBrowser = !browser
  const activeBrowser = browser ?? (await chromium.launch({ headless: true }))
  const page = await activeBrowser.newPage()

  const browseResponsePromise = page.waitForResponse(
    response => response.url().includes(UNIVERSE_BROWSE_JSON_FRAGMENT),
    { timeout: 90_000 },
  )

  try {
    await page.goto(UNIVERSE_CHAMPIONS_URL, {
      waitUntil: 'networkidle',
      timeout: 90_000,
    })

    const browseResponse = await browseResponsePromise
    const payload = (await browseResponse.json()) as { champions?: UniverseBrowseChampion[] }

    if (!payload.champions?.length) {
      throw new Error('Universe champion browse payload not captured')
    }

    return payload.champions.map(champion => ({
      slug: champion.slug,
      name: champion.name,
      factionSlug: champion['associated-faction-slug'],
    }))
  } finally {
    await page.close()
    if (ownsBrowser) await activeBrowser.close()
  }
}

export async function syncChampionRegions(options?: {
  triggeredBy?: string
  dryRun?: boolean
}): Promise<ChampionRegionSyncResult | ChampionRegionSyncError> {
  const log = createCronLogger('championRegionSync')
  const triggeredBy = options?.triggeredBy ?? 'manual'

  try {
    const regionsPath = resolveRegionsPath()
    const championsLitePath = resolveChampionsLitePath()

    const [regionsResult, championsLiteResult] = await Promise.all([
      FileManager.readJson<RegionsFilePayload>(regionsPath),
      FileManager.readJson<{ champions: ChampionLiteEntry[] }>(championsLitePath),
    ])

    if (regionsResult.isErr()) {
      throw new Error(`Failed to read regions.json: ${regionsResult.unwrapErr()}`)
    }
    if (championsLiteResult.isErr()) {
      throw new Error(`Failed to read champions-lite.json: ${championsLiteResult.unwrapErr()}`)
    }

    const regionsFile = regionsResult.unwrap()
    const championLookup = buildChampionIdLookup(championsLiteResult.unwrap().champions ?? [])
    const universeChampions = await fetchUniverseChampions()

    const comparison = compareChampionRegions(
      universeChampions,
      championLookup,
      regionsFile.championMapping
    )

    const { mapping: nextMapping, applied } = applyAutoChampionRegionUpdates(
      regionsFile.championMapping,
      comparison.diffs
    )

    const manualReview = comparison.diffs.filter(
      diff => !applied.some(entry => entry.championId === diff.championId)
    )
    const fileUpdated = applied.length > 0 && !options?.dryRun

    if (fileUpdated) {
      const payload: RegionsFilePayload = {
        regionsData: regionsFile.regionsData,
        championMapping: sortChampionMapping(nextMapping),
      }
      const writeResult = await FileManager.writeJson(regionsPath, payload)
      if (writeResult.isErr()) {
        throw new Error(`Failed to write regions.json: ${writeResult.unwrapErr()}`)
      }
    }

    await log.info('Champion region sync completed', {
      universeCount: universeChampions.length,
      applied: applied.length,
      manualReview: manualReview.length,
      unknownFactionSlugs: comparison.unknownFactionSlugs,
      unresolved: comparison.unresolved.length,
      fileUpdated,
      triggeredBy,
    })

    if (comparison.unknownFactionSlugs.length > 0 || comparison.unresolved.length > 0) {
      await notifyChampionRegionsChecked({
        universeCount: universeChampions.length,
        applied,
        manualReview,
        unknownFactionSlugs: comparison.unknownFactionSlugs,
        unresolved: comparison.unresolved,
        triggeredBy,
      })
    } else if (applied.length > 0) {
      await notifyChampionRegionsUpdated({
        applied,
        universeCount: universeChampions.length,
        triggeredBy,
      })
    }

    return {
      ok: true,
      universeCount: universeChampions.length,
      fileUpdated,
      applied,
      manualReview,
      unknownFactionSlugs: comparison.unknownFactionSlugs,
      unresolved: comparison.unresolved,
      triggeredBy,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log.error('Champion region sync failed', { error: message, triggeredBy })
    await notifyChampionRegionsSyncFailure(message, { triggeredBy })
    return { ok: false, error: message, triggeredBy }
  }
}
