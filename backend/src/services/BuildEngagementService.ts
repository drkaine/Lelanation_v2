import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { buildsDir } from './BuildIndexService.js'

export type BuildShareType = 'link' | 'image' | 'image_with_meta'

type BuildShareStats = Record<BuildShareType, number>

export type BuildEngagementEntry = {
  buildId: string
  views: number
  shares: BuildShareStats
  imports: number
  lastViewedAt: string | null
  lastSharedAt: string | null
  lastImportedAt: string | null
  updatedAt: string
}

type BuildEngagementStore = {
  builds: Record<string, BuildEngagementEntry>
}

const BUILD_ENGAGEMENT_FILE = join(buildsDir, 'engagement.json')

let writeChain: Promise<void> = Promise.resolve()

function defaultShares(): BuildShareStats {
  return { link: 0, image: 0, image_with_meta: 0 }
}

function createEmptyEntry(buildId: string): BuildEngagementEntry {
  return {
    buildId,
    views: 0,
    shares: defaultShares(),
    imports: 0,
    lastViewedAt: null,
    lastSharedAt: null,
    lastImportedAt: null,
    updatedAt: new Date().toISOString(),
  }
}

async function readStore(): Promise<BuildEngagementStore> {
  const result = await FileManager.readJson<BuildEngagementStore>(BUILD_ENGAGEMENT_FILE)
  if (result.isErr()) return { builds: {} }
  const data = result.unwrap()
  return data && typeof data === 'object' && data.builds ? data : { builds: {} }
}

async function saveStore(store: BuildEngagementStore): Promise<void> {
  const writeResult = await FileManager.writeJson(BUILD_ENGAGEMENT_FILE, store)
  if (writeResult.isErr()) {
    throw new Error(writeResult.unwrapErr().message)
  }
}

async function mutateBuildEntry(
  buildId: string,
  mutate: (entry: BuildEngagementEntry, nowIso: string) => void
): Promise<BuildEngagementEntry> {
  if (!buildId || !buildId.trim()) throw new Error('buildId is required')
  const id = buildId.trim()
  let out: BuildEngagementEntry = createEmptyEntry(id)

  writeChain = writeChain.then(async () => {
    const store = await readStore()
    const current = store.builds[id] ?? createEmptyEntry(id)
    const nowIso = new Date().toISOString()
    mutate(current, nowIso)
    current.updatedAt = nowIso
    store.builds[id] = current
    await saveStore(store)
    out = current
  })

  await writeChain
  return out
}

export async function trackBuildView(buildId: string): Promise<BuildEngagementEntry> {
  return mutateBuildEntry(buildId, (entry, nowIso) => {
    entry.views += 1
    entry.lastViewedAt = nowIso
  })
}

export async function trackBuildShare(
  buildId: string,
  shareType: BuildShareType
): Promise<BuildEngagementEntry> {
  return mutateBuildEntry(buildId, (entry, nowIso) => {
    entry.shares[shareType] += 1
    entry.lastSharedAt = nowIso
  })
}

export async function trackBuildAppImport(buildId: string): Promise<BuildEngagementEntry> {
  return mutateBuildEntry(buildId, (entry, nowIso) => {
    entry.imports = (entry.imports ?? 0) + 1
    entry.lastImportedAt = nowIso
  })
}

export async function getBuildEngagement(buildId: string): Promise<BuildEngagementEntry> {
  const id = buildId.trim()
  const store = await readStore()
  return store.builds[id] ?? createEmptyEntry(id)
}

export async function getEngagementViewCounts(): Promise<Map<string, number>> {
  const store = await readStore()
  const out = new Map<string, number>()
  for (const [id, entry] of Object.entries(store.builds)) {
    if (entry.views > 0) out.set(id, entry.views)
  }
  return out
}

export async function removeBuildEngagement(buildId: string): Promise<boolean> {
  const id = buildId.trim()
  if (!id) return false
  let removed = false

  writeChain = writeChain.then(async () => {
    const store = await readStore()
    if (!store.builds[id]) return
    delete store.builds[id]
    await saveStore(store)
    removed = true
  })

  await writeChain
  return removed
}

/** Supprime les stats dont le build public n'existe plus. */
export async function purgeOrphanBuildEngagement(validBuildIds: Set<string>): Promise<number> {
  let removedCount = 0

  writeChain = writeChain.then(async () => {
    const store = await readStore()
    let changed = false
    for (const id of Object.keys(store.builds)) {
      if (!validBuildIds.has(id)) {
        delete store.builds[id]
        removedCount += 1
        changed = true
      }
    }
    if (changed) await saveStore(store)
  })

  await writeChain
  return removedCount
}

