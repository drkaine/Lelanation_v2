import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import {
  claimOldestMatchIngestQueueFilePaths,
  countMatchIngestQueueFiles,
  tryEnqueueMatchIngestPayload,
} from './matchIngestQueue.js'

async function withQueueDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), 'lelanation-match-ingest-'))
  const previous = process.env.MATCH_INGEST_QUEUE_DIR
  process.env.MATCH_INGEST_QUEUE_DIR = dir
  try {
    await run(dir)
  } finally {
    if (previous == null) delete process.env.MATCH_INGEST_QUEUE_DIR
    else process.env.MATCH_INGEST_QUEUE_DIR = previous
    await rm(dir, { recursive: true, force: true })
  }
}

test('matchIngestQueue: enqueue is idempotent and count excludes processing files', async () => {
  await withQueueDir(async () => {
    const payload = {
      v: 1 as const,
      stepId: 's1',
      matchId: 'EUW1_123',
      region: 'euw1',
      matchDto: { metadata: { matchId: 'EUW1_123' }, info: { participants: [] } },
      timelineDto: null,
      puuidKeyVersion: null,
      trackerIdx: 0,
      enqueuedAt: Date.now(),
    }
    const r1 = await tryEnqueueMatchIngestPayload(payload)
    const r2 = await tryEnqueueMatchIngestPayload(payload)
    assert.equal(r1, 'written')
    assert.equal(r2, 'duplicate')
    assert.equal(await countMatchIngestQueueFiles(), 1)

    const claimed = await claimOldestMatchIngestQueueFilePaths(1)
    assert.equal(claimed.length, 1)
    assert.equal(await countMatchIngestQueueFiles(), 0)
  })
})

test('matchIngestQueue: claim is atomic and never double-claims same file', async () => {
  await withQueueDir(async () => {
    for (let i = 0; i < 3; i++) {
      await tryEnqueueMatchIngestPayload({
        v: 1,
        stepId: `s-${i}`,
        matchId: `EUW1_${i}`,
        region: 'euw1',
        matchDto: { metadata: { matchId: `EUW1_${i}` }, info: { participants: [] } },
        timelineDto: null,
        puuidKeyVersion: null,
        trackerIdx: i,
        enqueuedAt: Date.now(),
      })
    }

    const first = await claimOldestMatchIngestQueueFilePaths(2)
    const second = await claimOldestMatchIngestQueueFilePaths(2)
    const all = [...first, ...second]
    assert.equal(all.length, 3)
    assert.equal(new Set(all).size, 3)
    assert.equal(await countMatchIngestQueueFiles(), 0)

    const names = await readdir(process.env.MATCH_INGEST_QUEUE_DIR!)
    const processingCount = names.filter((n) => n.includes('.processing.')).length
    assert.equal(processingCount, 3)
  })
})
