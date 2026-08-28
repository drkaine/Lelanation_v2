import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

let dir: string
let getAdminBuildEngagementRecap: typeof import('../../../src/services/AdminBuildEngagementService.js').getAdminBuildEngagementRecap
let removeBuildEngagement: typeof import('../../../src/services/BuildEngagementService.js').removeBuildEngagement
let purgeOrphanBuildEngagement: typeof import('../../../src/services/BuildEngagementService.js').purgeOrphanBuildEngagement
let trackBuildAppImport: typeof import('../../../src/services/BuildEngagementService.js').trackBuildAppImport
let trackBuildFavorite: typeof import('../../../src/services/BuildEngagementService.js').trackBuildFavorite
let invalidateBuildIndex: typeof import('../../../src/services/BuildIndexService.js').invalidateBuildIndex

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'

const engagementFixture = {
  builds: {
    [UUID_A]: {
      buildId: UUID_A,
      views: 10,
      shares: { link: 2, image: 1, image_with_meta: 0 },
      imports: 3,
      lastViewedAt: '2026-01-01T00:00:00.000Z',
      lastSharedAt: '2026-01-02T00:00:00.000Z',
      lastImportedAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
    [UUID_B]: {
      buildId: UUID_B,
      views: 3,
      shares: { link: 0, image: 0, image_with_meta: 1 },
      lastViewedAt: null,
      lastSharedAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    },
  },
}

async function resetEngagementStore(): Promise<void> {
  await writeFile(join(dir, 'engagement.json'), JSON.stringify(engagementFixture))
  await writeFile(
    join(dir, 'votes.json'),
    JSON.stringify({
      builds: {
        [UUID_A]: {
          buildId: UUID_A,
          upvotes: 5,
          downvotes: 1,
          voters: { voter1: 'up', voter2: 'down' },
          updatedAt: '2026-01-04T00:00:00.000Z',
        },
      },
    })
  )
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'build-engagement-admin-'))
  await mkdir(dir, { recursive: true })
  process.env.BUILDS_DIR = dir

  await writeFile(
    join(dir, `${UUID_A}.json`),
    JSON.stringify({
      id: UUID_A,
      name: 'Build A',
      author: 'Alice',
      champion: { name: 'Ahri' },
    })
  )

  const indexMod = await import('../../../src/services/BuildIndexService.js')
  invalidateBuildIndex = indexMod.invalidateBuildIndex

  const engagementMod = await import('../../../src/services/BuildEngagementService.js')
  removeBuildEngagement = engagementMod.removeBuildEngagement
  purgeOrphanBuildEngagement = engagementMod.purgeOrphanBuildEngagement
  trackBuildAppImport = engagementMod.trackBuildAppImport
  trackBuildFavorite = engagementMod.trackBuildFavorite

  const mod = await import('../../../src/services/AdminBuildEngagementService.js')
  getAdminBuildEngagementRecap = mod.getAdminBuildEngagementRecap
})

beforeEach(async () => {
  await resetEngagementStore()
  invalidateBuildIndex()
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('removeBuildEngagement', () => {
  it('removes stats for a build id', async () => {
    const removed = await removeBuildEngagement(UUID_A)
    expect(removed).toBe(true)

    const raw = JSON.parse(await readFile(join(dir, 'engagement.json'), 'utf8')) as {
      builds: Record<string, unknown>
    }
    expect(raw.builds[UUID_A]).toBeUndefined()
    expect(raw.builds[UUID_B]).toBeDefined()
  })
})

describe('trackBuildAppImport', () => {
  it('increments imports and stores lastImportedAt', async () => {
    await trackBuildAppImport(UUID_A)
    const raw = JSON.parse(await readFile(join(dir, 'engagement.json'), 'utf8')) as {
      builds: Record<string, { imports?: number; lastImportedAt?: string | null }>
    }
    expect(raw.builds[UUID_A]?.imports).toBe(4)
    expect(raw.builds[UUID_A]?.lastImportedAt).toBeTruthy()
  })
})

describe('purgeOrphanBuildEngagement', () => {
  it('removes stats without a matching public build file', async () => {
    const removed = await purgeOrphanBuildEngagement(new Set([UUID_A]))
    expect(removed).toBe(1)

    const raw = JSON.parse(await readFile(join(dir, 'engagement.json'), 'utf8')) as {
      builds: Record<string, unknown>
    }
    expect(Object.keys(raw.builds)).toEqual([UUID_A])
  })
})

describe('trackBuildFavorite', () => {
  it('increments favorites on add and decrements on remove', async () => {
    await trackBuildFavorite(UUID_A, 'add')
    await trackBuildFavorite(UUID_A, 'add')
    await trackBuildFavorite(UUID_A, 'remove')

    const raw = JSON.parse(await readFile(join(dir, 'engagement.json'), 'utf8')) as {
      builds: Record<string, { favorites?: number; lastFavoritedAt?: string | null }>
    }
    expect(raw.builds[UUID_A]?.favorites).toBe(1)
    expect(raw.builds[UUID_A]?.lastFavoritedAt).toBeTruthy()
  })
})

describe('getAdminBuildEngagementRecap', () => {
  it('includes builds with favorites only', async () => {
    await writeFile(
      join(dir, 'engagement.json'),
      JSON.stringify({
        builds: {
          [UUID_A]: {
            buildId: UUID_A,
            views: 0,
            shares: { link: 0, image: 0, image_with_meta: 0 },
            imports: 0,
            favorites: 2,
            lastViewedAt: null,
            lastSharedAt: null,
            lastImportedAt: null,
            lastFavoritedAt: '2026-01-06T00:00:00.000Z',
            updatedAt: '2026-01-06T00:00:00.000Z',
          },
        },
      })
    )

    const recap = await getAdminBuildEngagementRecap()
    expect(recap.totals.builds).toBe(1)
    expect(recap.totals.favorites).toBe(2)
    expect(recap.rows[0]?.favorites).toBe(2)
  })

  it('purges orphan stats and lists only builds with engagement', async () => {
    const recap = await getAdminBuildEngagementRecap()
    expect(recap.totals.builds).toBe(1)
    expect(recap.totals.views).toBe(10)
    expect(recap.totals.sharesLink).toBe(2)
    expect(recap.totals.sharesImage).toBe(1)
    expect(recap.totals.sharesImageWithMeta).toBe(0)
    expect(recap.totals.sharesTotal).toBe(3)
    expect(recap.totals.upvotes).toBe(5)
    expect(recap.totals.downvotes).toBe(1)
    expect(recap.totals.imports).toBe(3)
    expect(recap.rows).toHaveLength(1)
    expect(recap.rows[0]?.buildId).toBe(UUID_A)
    expect(recap.rows[0]?.upvotes).toBe(5)
    expect(recap.rows[0]?.downvotes).toBe(1)
    expect(recap.rows[0]?.imports).toBe(3)

    const raw = JSON.parse(await readFile(join(dir, 'engagement.json'), 'utf8')) as {
      builds: Record<string, unknown>
    }
    expect(raw.builds[UUID_B]).toBeUndefined()
  })

  it('excludes public builds without views or shares', async () => {
    const UUID_C = '33333333-3333-4333-8333-333333333333'
    await writeFile(
      join(dir, `${UUID_C}.json`),
      JSON.stringify({ id: UUID_C, name: 'Silent build', author: 'Bob' })
    )
    invalidateBuildIndex()

    const recap = await getAdminBuildEngagementRecap()
    expect(recap.rows.some(r => r.buildId === UUID_C)).toBe(false)
    expect(recap.rows).toHaveLength(1)
  })
})
