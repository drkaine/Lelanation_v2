import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DASHBOARD_METRIC_KEYS,
  DASHBOARD_RADAR_AXES,
  dashboardBreakdowns,
  kdaRatio,
  metricPercentiles,
  percentileRank,
  radarScores,
  type DashboardMetricValues,
} from './championDashboardMath.js'

function metrics(fill: number, overrides: Partial<DashboardMetricValues> = {}): DashboardMetricValues {
  const out = {} as DashboardMetricValues
  for (const key of DASHBOARD_METRIC_KEYS) out[key] = fill
  return { ...out, ...overrides }
}

test('percentileRank: population vide → 0', () => {
  assert.equal(percentileRank([], 5), 0)
})

test('percentileRank: plus grande valeur proche de 100, plus petite proche de 0', () => {
  const pop = [1, 2, 3, 4]
  assert.equal(percentileRank(pop, 4), 87.5)
  assert.equal(percentileRank(pop, 1), 12.5)
})

test('percentileRank: les égalités comptent pour moitié', () => {
  assert.equal(percentileRank([5, 5, 5, 5], 5), 50)
})

test('percentileRank: valeur hors population', () => {
  assert.equal(percentileRank([1, 2, 3], 10), 100)
  assert.equal(percentileRank([1, 2, 3], -1), 0)
})

test('metricPercentiles: calcule chaque clé indépendamment', () => {
  const population = [metrics(1, { kills: 10 }), metrics(2, { kills: 1 }), metrics(3, { kills: 5 })]
  const target = metrics(3, { kills: 10 })
  const p = metricPercentiles(target, population)
  assert.equal(p.gold, 83.3)
  assert.equal(p.kills, 83.3)
})

test('radarScores: moyenne des percentiles de chaque axe, 8 axes', () => {
  const p = metrics(50, { tanked: 100, mitigated: 0, kills: 80, firstBlood: 60 })
  const scores = radarScores(p)
  assert.equal(Object.keys(scores).length, DASHBOARD_RADAR_AXES.length)
  assert.equal(scores.tank, 50)
  assert.equal(scores.aggro, 70)
  assert.equal(scores.damage, 50)
})

test("radarScores: les morts n'entrent pas dans le radar", () => {
  assert.deepEqual(radarScores(metrics(50, { deaths: 0 })), radarScores(metrics(50, { deaths: 100 })))
})

test('kdaRatio: garde-fou division par zéro', () => {
  assert.equal(kdaRatio(10, 0, 5), 15)
  assert.equal(kdaRatio(6, 3, 3), 3)
})

test('dashboardBreakdowns: moyennes par partie de chaque sous-ligne, sur leur propre dénominateur', () => {
  const b = dashboardBreakdowns({
    damage: { games: 10, physical: 1000, magic: 500, true: 100 },
    tanked: { games: 20, physical: 2000, magic: 400, true: 0 },
    laneEvents: {
      games: 4,
      killByGank: 6,
      killByDive: 2,
      deathByGank: 3,
      deathByDive: 1,
    },
  })
  assert.deepEqual(b.damage, [
    { key: 'physical', value: 100 },
    { key: 'magic', value: 50 },
    { key: 'true', value: 10 },
  ])
  assert.deepEqual(b.tanked, [
    { key: 'physical', value: 100 },
    { key: 'magic', value: 20 },
    { key: 'true', value: 0 },
  ])
  assert.deepEqual(b.deaths, [
    { key: 'gank', value: 0.75 },
    { key: 'dive', value: 0.25 },
  ])
  // Les participations gank/dive (kill ou assist) alimentent Kills et Assists.
  assert.deepEqual(b.kills, [
    { key: 'gank', value: 1.5 },
    { key: 'dive', value: 0.5 },
  ])
  assert.deepEqual(b.assists, b.kills)
})

test('dashboardBreakdowns: dénominateur nul → sous-lignes à 0', () => {
  const b = dashboardBreakdowns({
    damage: { games: 0, physical: 5, magic: 5, true: 5 },
    tanked: { games: 0, physical: 0, magic: 0, true: 0 },
    laneEvents: { games: 0, killByGank: 1, killByDive: 1, deathByGank: 1, deathByDive: 1 },
  })
  assert.deepEqual(
    b.damage.map(r => r.value),
    [0, 0, 0]
  )
  assert.deepEqual(
    b.deaths.map(r => r.value),
    [0, 0]
  )
})
