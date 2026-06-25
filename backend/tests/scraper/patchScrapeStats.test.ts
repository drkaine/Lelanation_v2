import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { readPatchScrapeStats } from '../../src/services/patchScrapeStats.js'

describe('readPatchScrapeStats', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'patch-stats-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('reads entity and summary counts from EN patch JSON', async () => {
    const patchVersion = '16.13'
    const versionDir = join(tempDir, patchVersion)
    await mkdir(versionDir, { recursive: true })
    await writeFile(
      join(versionDir, `patch-${patchVersion}-en-GB.json`),
      JSON.stringify({
        entities: [{ changes: [1, 2] }, { changes: [3] }],
        summaryImage: { publicPath: '/data/patch-notes/16.13/summary-en.png' },
      })
    )

    const stats = await readPatchScrapeStats(patchVersion, tempDir)

    expect(stats).toEqual({
      entitiesEn: 2,
      changesEn: 3,
      hasSummaryImage: true,
    })
  })
})
