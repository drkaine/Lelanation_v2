import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeChampionMatchupNoteFromVsRows,
  computeSingleMatchupScore,
} from './championMatchupScoreCompute.js'

test('computeSingleMatchupScore blends WR delta with lane z-scores', () => {
  const peers = [
    {
      champion_id: 1,
      opponent_champion_id: 99,
      role: 'MIDDLE',
      games: 100,
      wins: 45,
      sum_gold_difference_15min: -500,
    },
    {
      champion_id: 2,
      opponent_champion_id: 99,
      role: 'MIDDLE',
      games: 100,
      wins: 50,
      sum_gold_difference_15min: 0,
    },
  ]
  const myRow = {
    champion_id: 1,
    opponent_champion_id: 99,
    role: 'MIDDLE',
    games: 80,
    wins: 48,
    sum_gold_difference_15min: 400,
  }
  const score = computeSingleMatchupScore({
    myRow,
    peers,
    selfChampionId: 1,
    totalRoleGames: 400,
  })
  assert.ok(Number.isFinite(score))
  assert.notEqual(score, 0)
})

test('computeChampionMatchupNoteFromVsRows sums per-opponent scores on role', () => {
  const vsRows = [
    {
      champion_id: 10,
      opponent_champion_id: 20,
      role: 'TOP',
      games: 50,
      wins: 28,
      sum_gold_difference_15min: 200,
    },
    {
      champion_id: 11,
      opponent_champion_id: 20,
      role: 'TOP',
      games: 50,
      wins: 22,
      sum_gold_difference_15min: -100,
    },
    {
      champion_id: 10,
      opponent_champion_id: 30,
      role: 'TOP',
      games: 40,
      wins: 24,
      sum_gold_difference_15min: 150,
    },
    {
      champion_id: 11,
      opponent_champion_id: 30,
      role: 'TOP',
      games: 40,
      wins: 20,
      sum_gold_difference_15min: 0,
    },
  ]
  const note = computeChampionMatchupNoteFromVsRows(10, 'TOP', 90, vsRows, (r) => r.toUpperCase())
  assert.ok(Number.isFinite(note))
})
