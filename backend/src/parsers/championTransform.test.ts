import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  championTransformFromEventType,
  extractChampionTransformInfo,
  normalizeChampionTransform,
} from './championTransform.js'
import type { MatchTimelineEventDto } from '../riot/types.js'

test('normalizeChampionTransform clamps to 0|1|2', () => {
  assert.equal(normalizeChampionTransform(undefined), 0)
  assert.equal(normalizeChampionTransform(1), 1)
  assert.equal(normalizeChampionTransform(2), 2)
  assert.equal(normalizeChampionTransform(99), 0)
})

test('championTransformFromEventType maps Riot transform labels', () => {
  assert.equal(championTransformFromEventType('SLAYER'), 1)
  assert.equal(championTransformFromEventType('Rhaast'), 1)
  assert.equal(championTransformFromEventType('ASSASSIN'), 2)
  assert.equal(championTransformFromEventType('ShadowAssassin'), 2)
  assert.equal(championTransformFromEventType('UNKNOWN'), 0)
})

test('extractChampionTransformInfo reads CHAMPION_TRANSFORM timeline event', () => {
  const events: MatchTimelineEventDto[] = [
    {
      type: 'CHAMPION_TRANSFORM',
      timestamp: 612_345,
      participantId: 3,
      transformType: 'SLAYER',
    } as MatchTimelineEventDto,
  ]
  const info = extractChampionTransformInfo(events, 3, 2)
  assert.equal(info.championTransform, 1)
  assert.equal(info.transformTimestampMs, 612_345)
})

test('extractChampionTransformInfo falls back to end-state participant transform', () => {
  const info = extractChampionTransformInfo([], 5, 2)
  assert.equal(info.championTransform, 2)
  assert.equal(info.transformTimestampMs, 0)
})
