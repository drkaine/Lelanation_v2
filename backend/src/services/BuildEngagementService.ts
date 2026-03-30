import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'

export type BuildShareType = 'link' | 'image' | 'image_with_meta'

type BuildShareStats = Record<BuildShareType, number>

export type BuildEngagementEntry = {
  buildId: string
  views: number
  shares: BuildShareStats
  lastViewedAt: string | null
  lastSharedAt: string | null
  updatedAt: string
}

type BuildEngagementStore = {
  builds: Record<string, BuildEngagementEntry>
}

const BUILD_ENGAGEMENT_FILE = join(process.cwd(), 'data', 'builds', 'engagement.json')

let writeChain: Promise<void> = Promise.resolve()

function defaultShares(): BuildShareStats {
  return { link: 0, image: 0, image_with_meta: 0 }
}

function createEmptyEntry(buildId: string): BuildEngagementEntry {
  return {
    buildId,
    views: 0,
    shares: defaultShares(),
    lastViewedAt: null,
    lastSharedAt: null,
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

export async function getBuildEngagement(buildId: string): Promise<BuildEngagementEntry> {
  const id = buildId.trim()
  const store = await readStore()
  return store.builds[id] ?? createEmptyEntry(id)
}

