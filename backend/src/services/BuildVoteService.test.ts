import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tempDir = ''
const originalCwd = process.cwd()

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'build-votes-'))
  await mkdir(join(tempDir, 'data', 'builds'), { recursive: true })
  process.chdir(tempDir)
})

after(async () => {
  process.chdir(originalCwd)
  await rm(tempDir, { recursive: true, force: true })
})

test('syncBuildVotesForVoter sets votes idempotently', async () => {
  const { syncBuildVotesForVoter, getBuildVoteStats } = await import('./BuildVoteService.js')

  await syncBuildVotesForVoter('voter-a', { 'build-2': 'up', 'build-3': 'down' })
  let stats = await getBuildVoteStats('build-2', 'voter-a')
  assert.equal(stats.upvotes, 1)
  assert.equal(stats.userVote, 'up')

  stats = await getBuildVoteStats('build-3', 'voter-a')
  assert.equal(stats.downvotes, 1)
  assert.equal(stats.userVote, 'down')

  await syncBuildVotesForVoter('voter-a', { 'build-2': 'up' })
  stats = await getBuildVoteStats('build-2', 'voter-a')
  assert.equal(stats.upvotes, 1)
})

test('castBuildVote toggles up/down per voter and aggregates across voters', async () => {
  const { castBuildVote, getBuildVoteStats } = await import('./BuildVoteService.js')

  let result = await castBuildVote('build-1', 'voter-a', 'up')
  assert.equal(result.stats.upvotes, 1)
  assert.equal(result.stats.downvotes, 0)
  assert.equal(result.stats.userVote, 'up')

  result = await castBuildVote('build-1', 'voter-b', 'down')
  assert.equal(result.stats.upvotes, 1)
  assert.equal(result.stats.downvotes, 1)

  result = await castBuildVote('build-1', 'voter-a', 'up')
  assert.equal(result.stats.upvotes, 0)
  assert.equal(result.stats.userVote, null)

  const stats = await getBuildVoteStats('build-1', 'voter-b')
  assert.equal(stats.downvotes, 1)
  assert.equal(stats.userVote, 'down')
})
