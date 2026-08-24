import { join } from 'path'
import { promises as fs } from 'fs'
import { FileManager } from '../utils/fileManager.js'
import { buildsDir, invalidateBuildIndex } from './BuildIndexService.js'
import { shouldAutoPrivatizeFromCommunityVotes } from './buildVoteVisibility.js'

export type BuildVoteDirection = 'up' | 'down'
export type BuildUserVote = BuildVoteDirection | null

export type BuildVoteStats = {
  buildId: string
  upvotes: number
  downvotes: number
  userVote: BuildUserVote
  updatedAt: string
}

type BuildVoteEntry = {
  buildId: string
  upvotes: number
  downvotes: number
  voters: Record<string, BuildVoteDirection>
  updatedAt: string
}

type BuildVoteStore = {
  builds: Record<string, BuildVoteEntry>
}

const BUILD_VOTES_FILE = join(process.cwd(), 'data', 'builds', 'votes.json')

let writeChain: Promise<void> = Promise.resolve()

/** Serialized vote writes — recover after I/O errors instead of blocking forever. */
async function runVoteWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.catch(() => undefined).then(fn)
  writeChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function createEmptyEntry(buildId: string): BuildVoteEntry {
  return {
    buildId,
    upvotes: 0,
    downvotes: 0,
    voters: {},
    updatedAt: new Date().toISOString(),
  }
}

function toStats(entry: BuildVoteEntry, voterId?: string | null): BuildVoteStats {
  return {
    buildId: entry.buildId,
    upvotes: entry.upvotes,
    downvotes: entry.downvotes,
    userVote: voterId ? (entry.voters[voterId] ?? null) : null,
    updatedAt: entry.updatedAt,
  }
}

async function readStore(): Promise<BuildVoteStore> {
  const result = await FileManager.readJson<BuildVoteStore>(BUILD_VOTES_FILE)
  if (result.isErr()) return { builds: {} }
  const data = result.unwrap()
  return data && typeof data === 'object' && data.builds ? data : { builds: {} }
}

async function saveStore(store: BuildVoteStore): Promise<void> {
  const writeResult = await FileManager.writeJson(BUILD_VOTES_FILE, store)
  if (writeResult.isErr()) {
    throw new Error(writeResult.unwrapErr().message)
  }
}

function applyToggleUp(entry: BuildVoteEntry, voterId: string): BuildUserVote {
  const current = entry.voters[voterId] ?? null
  if (current === 'down') {
    entry.downvotes = Math.max(0, entry.downvotes - 1)
  }
  if (current === 'up') {
    entry.upvotes = Math.max(0, entry.upvotes - 1)
    delete entry.voters[voterId]
    return null
  }
  entry.upvotes += 1
  entry.voters[voterId] = 'up'
  return 'up'
}

function applyToggleDown(entry: BuildVoteEntry, voterId: string): BuildUserVote {
  const current = entry.voters[voterId] ?? null
  if (current === 'up') {
    entry.upvotes = Math.max(0, entry.upvotes - 1)
  }
  if (current === 'down') {
    entry.downvotes = Math.max(0, entry.downvotes - 1)
    delete entry.voters[voterId]
    return null
  }
  entry.downvotes += 1
  entry.voters[voterId] = 'down'
  return 'down'
}

function applySetVote(entry: BuildVoteEntry, voterId: string, target: BuildUserVote): void {
  const current = entry.voters[voterId] ?? null
  if (current === target) return

  if (current === 'up') {
    entry.upvotes = Math.max(0, entry.upvotes - 1)
    delete entry.voters[voterId]
  } else if (current === 'down') {
    entry.downvotes = Math.max(0, entry.downvotes - 1)
    delete entry.voters[voterId]
  }

  if (target === 'up') {
    entry.upvotes += 1
    entry.voters[voterId] = 'up'
  } else if (target === 'down') {
    entry.downvotes += 1
    entry.voters[voterId] = 'down'
  }
}

export async function deletePublicBuildIfExists(buildId: string): Promise<boolean> {
  const id = buildId.trim()
  if (!id) return false
  const publicPath = join(buildsDir, `${id}.json`)
  try {
    await fs.unlink(publicPath)
    invalidateBuildIndex()
    return true
  } catch {
    return false
  }
}

export async function getBuildVoteStats(
  buildId: string,
  voterId?: string | null,
): Promise<BuildVoteStats> {
  const id = buildId.trim()
  const store = await readStore()
  const entry = store.builds[id] ?? createEmptyEntry(id)
  return toStats(entry, voterId)
}

export async function getBuildVoteStatsBatch(
  buildIds: string[],
  voterId?: string | null,
): Promise<Record<string, BuildVoteStats>> {
  const store = await readStore()
  const out: Record<string, BuildVoteStats> = {}
  for (const rawId of buildIds) {
    const id = rawId.trim()
    if (!id) continue
    const entry = store.builds[id] ?? createEmptyEntry(id)
    out[id] = toStats(entry, voterId)
  }
  return out
}

export async function castBuildVote(
  buildId: string,
  voterId: string,
  direction: BuildVoteDirection,
): Promise<{ stats: BuildVoteStats; autoPrivatized: boolean }> {
  const id = buildId.trim()
  const voter = voterId.trim()
  if (!id) throw new Error('buildId is required')
  if (!voter || voter.length > 128) throw new Error('voterId is required')

  return runVoteWrite(async () => {
    const store = await readStore()
    const entry = store.builds[id] ?? createEmptyEntry(id)
    if (direction === 'up') applyToggleUp(entry, voter)
    else applyToggleDown(entry, voter)
    entry.updatedAt = new Date().toISOString()
    store.builds[id] = entry
    await saveStore(store)

    let autoPrivatized = false
    if (shouldAutoPrivatizeFromCommunityVotes(entry.upvotes, entry.downvotes)) {
      autoPrivatized = await deletePublicBuildIfExists(id)
    }

    return { stats: toStats(entry, voter), autoPrivatized }
  })
}

/** Idempotent: set a voter's vote on each build (legacy localStorage migration). */
export async function syncBuildVotesForVoter(
  voterId: string,
  votes: Record<string, BuildVoteDirection>,
): Promise<{ votes: Record<string, BuildVoteStats>; autoPrivatizedBuildIds: string[] }> {
  const voter = voterId.trim()
  if (!voter || voter.length > 128) throw new Error('voterId is required')

  const entries = Object.entries(votes)
    .map(([buildId, direction]) => [buildId.trim(), direction] as const)
    .filter(([buildId, direction]) => buildId && (direction === 'up' || direction === 'down'))
    .slice(0, 100)

  const out: Record<string, BuildVoteStats> = {}
  const autoPrivatizedBuildIds: string[] = []

  return runVoteWrite(async () => {
    const store = await readStore()
    const nowIso = new Date().toISOString()

    for (const [buildId, direction] of entries) {
      const entry = store.builds[buildId] ?? createEmptyEntry(buildId)
      applySetVote(entry, voter, direction)
      entry.updatedAt = nowIso
      store.builds[buildId] = entry
      out[buildId] = toStats(entry, voter)

      if (shouldAutoPrivatizeFromCommunityVotes(entry.upvotes, entry.downvotes)) {
        const removed = await deletePublicBuildIfExists(buildId)
        if (removed) autoPrivatizedBuildIds.push(buildId)
      }
    }

    if (entries.length > 0) await saveStore(store)
    return { votes: out, autoPrivatizedBuildIds }
  })
}
