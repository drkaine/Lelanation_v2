/**
 * Read entity stats from a freshly scraped EN patch JSON.
 */
import { readFile } from 'fs/promises'
import { join } from 'path'

export type PatchScrapeStats = {
  entitiesEn: number
  changesEn: number
  hasSummaryImage: boolean
}

export async function readPatchScrapeStats(
  patchVersion: string,
  outputDir: string
): Promise<PatchScrapeStats | null> {
  try {
    const filePath = join(outputDir, patchVersion, `patch-${patchVersion}-en-GB.json`)
    const raw = await readFile(filePath, 'utf-8')
    const json = JSON.parse(raw) as {
      entities?: Array<{ changes?: unknown[] }>
      summaryImage?: { publicPath?: string } | null
    }
    const entities = json.entities ?? []
    return {
      entitiesEn: entities.length,
      changesEn: entities.reduce((sum, entity) => sum + (entity.changes?.length ?? 0), 0),
      hasSummaryImage: Boolean(json.summaryImage?.publicPath),
    }
  } catch {
    return null
  }
}
