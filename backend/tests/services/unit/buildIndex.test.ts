import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

let dir: string
let getBuildIndex: typeof import('../../../src/services/BuildIndexService.js').getBuildIndex
let invalidateBuildIndex: typeof import('../../../src/services/BuildIndexService.js').invalidateBuildIndex

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'
const UUID_C = '33333333-3333-4333-8333-333333333333'
const UUID_PRIV = '44444444-4444-4444-8444-444444444444'

async function writeBuild(uuid: string, extra: Record<string, unknown> = {}): Promise<void> {
  await writeFile(join(dir, `${uuid}.json`), JSON.stringify({ id: uuid, createdAt: '2026-01-01T00:00:00.000Z', ...extra }))
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'builds-index-'))
  await mkdir(dir, { recursive: true })
  process.env.BUILDS_DIR = dir
  process.env.BUILDS_INDEX_TTL_MS = '5000'
  const mod = await import('../../../src/services/BuildIndexService.js')
  getBuildIndex = mod.getBuildIndex
  invalidateBuildIndex = mod.invalidateBuildIndex
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getBuildIndex', () => {
  it('lists only build-pattern files and exposes visibility + fileCount', async () => {
    invalidateBuildIndex()
    await writeBuild(UUID_A)
    await writeBuild(UUID_PRIV, { visibility: 'private' })
    await writeFile(join(dir, 'not-a-build.json'), JSON.stringify({ id: 'x' }))
    await writeFile(join(dir, `${UUID_B}.txt`), 'nope')

    const { entries, fileCount } = await getBuildIndex()
    const ids = entries.map(e => e.id).sort()
    expect(ids).toEqual([UUID_A, UUID_PRIV].sort())
    expect(fileCount).toBe(2)
    expect(entries.find(e => e.id === UUID_PRIV)?.visibility).toBe('private')
  })

  it('serves from cache within TTL and re-scans after expiry', async () => {
    invalidateBuildIndex()
    for (const f of [UUID_A, UUID_B, UUID_C, UUID_PRIV]) {
      await unlink(join(dir, `${f}.json`)).catch(() => {})
    }
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'))

    await writeBuild(UUID_A)
    const first = await getBuildIndex()
    expect(first.entries.map(e => e.id)).toEqual([UUID_A])

    // New file on disk is invisible while the cache is still fresh.
    await writeBuild(UUID_B)
    const cached = await getBuildIndex()
    expect(cached.entries.map(e => e.id)).toEqual([UUID_A])

    // After TTL elapses, a re-scan picks it up.
    vi.setSystemTime(new Date('2026-06-01T00:00:06.000Z'))
    const refreshed = await getBuildIndex()
    expect(refreshed.entries.map(e => e.id).sort()).toEqual([UUID_A, UUID_B].sort())
  })

  it('reflects changes immediately after invalidateBuildIndex()', async () => {
    invalidateBuildIndex()
    await getBuildIndex()
    await writeBuild(UUID_C)
    invalidateBuildIndex()
    const after = await getBuildIndex()
    expect(after.entries.map(e => e.id)).toContain(UUID_C)
  })
})
