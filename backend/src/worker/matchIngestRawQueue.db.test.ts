import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDatabaseConfigured, prisma } from '../db.js'
import {
  claimRawIngestRows,
  markRawIngestDone,
  markRawIngestError,
  requeueRawIngestErrors,
  tryInsertRawIngestPayload,
} from './matchIngestRawQueue.js'

const dbAvailable = isDatabaseConfigured()
const skipDbReason = dbAvailable ? false : 'DATABASE_URL not set'

test('matchIngestRawQueue: lifecycle pending->processing->error->pending->done', { skip: skipDbReason }, async () => {
  const matchId = `EUW1_RAW_TEST_${Date.now()}`
  await tryInsertRawIngestPayload({
    v: 1,
    stepId: 'test',
    matchId,
    region: 'euw1',
    matchDto: { metadata: { matchId }, info: { participants: [] } },
    timelineDto: null,
    puuidKeyVersion: null,
    trackerIdx: -1,
    enqueuedAt: Date.now(),
  })

  const claimed = await claimRawIngestRows(10)
  const row = claimed.find((r) => r.riotMatchId === matchId)
  assert.ok(row, 'row should be claimable')

  await markRawIngestError(row!.id, 'test_error', 1_000)
  const requeued = await requeueRawIngestErrors(100)
  assert.ok(requeued >= 1, 'should requeue at least one error row')

  const claimedAgain = await claimRawIngestRows(10)
  const rowAgain = claimedAgain.find((r) => r.riotMatchId === matchId)
  assert.ok(rowAgain, 'row should be claimable again after requeue')

  await markRawIngestDone(rowAgain!.id)

  const doneCount = await prisma.$queryRaw<Array<{ cnt: bigint | number }>>`
    SELECT COUNT(*) AS cnt
    FROM match_ingest_raw
    WHERE riot_match_id = ${matchId}
      AND status = 'done'
  `
  const cnt = typeof doneCount[0]?.cnt === 'bigint' ? Number(doneCount[0].cnt) : Number(doneCount[0]?.cnt ?? 0)
  assert.ok(cnt >= 1, 'done status should be persisted')
})
