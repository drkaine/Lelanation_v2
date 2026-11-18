import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(__dirname, '../../components/statistics/tabs/StatisticsBalanceTab.vue'),
  'utf8'
)

describe('Balance : carte champion (mobile / stats simplifiées)', () => {
  it("affiche l'image du champion", () => {
    const start = src.indexOf('class="ba-mcard"')
    const card = src.slice(start, src.indexOf('</StatisticsChampionDetailLink>', start))
    expect(card).toMatch(/<img[\s\S]*?class="ba-mcard-img"/)
    expect(card).toContain('getChampionImageUrl')
  })
})
