<script setup lang="ts">
import { computed } from 'vue'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { miscMobileSortOptions } from '~/composables/statistics/useStatisticsMiscTab'
import {
  CHAMPION_MISC_GROWTH_STAT_KEYS,
  CHAMPION_MISC_STAT_ICON_KEYS,
  type ChampionMiscBaseStatKey,
  type ChampionMiscGrowthStatKey,
  type ChampionMiscSortCol,
  type ChampionMiscStatRow,
} from '~/utils/championBaseStatsFromJson'
import {
  CHAMPION_MISC_MAX_LEVEL,
  CHAMPION_MISC_MIN_LEVEL,
  championMiscStatUnavailable,
  championMiscStatValueAtLevel,
  clampChampionMiscLevel,
} from '~/utils/championMiscStatLevel'
import {
  championMiscStatDisplayName,
  championMiscStatRowKey,
} from '~/utils/championMiscStatVariants'
import {
  MISC_STAT_GROUPS,
  formatMiscGrowth,
  formatMiscValue,
  miscResourceCell,
  miscStatMeta,
} from '~/utils/statistics/miscStatCells'

const { locale } = useI18n()
const loc = computed<'fr' | 'en'>(() => (String(locale.value).startsWith('fr') ? 'fr' : 'en'))

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

const MISC_MOBILE_KEYS = [
  'armor',
  'magicResist',
  'attackDamage',
  'attackSpeed',
  'attackRange',
  'movespeed',
  'mp',
] as const satisfies readonly ChampionMiscBaseStatKey[]

const miscMobileSortColumn = computed({
  get: () => String(p.miscSortColumn ?? 'base_hp'),
  set: (v: string) => {
    ;(p.setMiscSort as (c: ChampionMiscSortCol) => void)?.(v as ChampionMiscSortCol)
  },
})

const miscMobileSortDir = computed({
  get: () => (p.miscSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  set: (v: 'asc' | 'desc') => {
    p.miscSortDir = v
  },
})

const miscMobileSortOptionsComputed = computed(() =>
  miscMobileSortOptions((key: string) => String(p.t?.(key) ?? key))
)

const miscPageSize = computed({
  get: () => Number(p.championsPageSize) || 20,
  set: (value: number) => {
    p.onMiscPageSizeUpdated?.(value)
  },
})

const miscLevel = computed(() => Number(p.miscLevel) || 1)

function onMiscLevelInput(event: Event): void {
  p.miscLevel = clampChampionMiscLevel(Number((event.target as HTMLInputElement).value))
}

function championPortraitSrc(row: ChampionMiscStatRow): string | null {
  if (!p.gameVersion || !row.imageFull) return null
  return p.getChampionImageUrl(p.gameVersion, row.imageFull)
}

function statLabel(key: ChampionMiscBaseStatKey | ChampionMiscGrowthStatKey): string {
  const iconKey = CHAMPION_MISC_STAT_ICON_KEYS[key]
  return String(p.t?.(`stats.labels.${iconKey}`) ?? key)
}

function baseSortCol(key: ChampionMiscBaseStatKey): ChampionMiscSortCol {
  return `base_${key}`
}

function hasMiscGrowthColumn(key: ChampionMiscBaseStatKey): boolean {
  return (CHAMPION_MISC_GROWTH_STAT_KEYS as readonly string[]).includes(key)
}

function sortIndicator(col: ChampionMiscSortCol): string {
  return p.miscSortHint?.(col) ?? ''
}

function miscUnavailableLabel(): string {
  return String(p.t?.('statisticsPage.miscStatNA') ?? 'NA')
}

function cellValue(row: ChampionMiscStatRow, key: ChampionMiscBaseStatKey): string {
  const v = championMiscStatValueAtLevel(row, key, miscLevel.value)
  if (key === 'mp') return miscResourceCell(row, v, loc.value)
  if (championMiscStatUnavailable(row, key)) return miscUnavailableLabel()
  return formatMiscValue(key, v, loc.value)
}

function cellGrowth(row: ChampionMiscStatRow, key: ChampionMiscBaseStatKey): string | null {
  if (!hasMiscGrowthColumn(key) || championMiscStatUnavailable(row, key)) return null
  const g = formatMiscGrowth(key, row.growth[key as ChampionMiscGrowthStatKey] ?? 0, loc.value)
  if (!g) return null
  return key === 'hp' ? `${g} ${p.t('statisticsPage.miscPerLevel')}` : g
}

function cellTitle(row: ChampionMiscStatRow, key: ChampionMiscBaseStatKey): string | undefined {
  const regenKey = key === 'hp' ? 'hpRegen' : key === 'mp' ? 'mpRegen' : null
  if (!regenKey || championMiscStatUnavailable(row, regenKey)) return undefined
  return String(
    p.t('statisticsPage.miscRegen', {
      value: formatMiscValue(
        regenKey,
        championMiscStatValueAtLevel(row, regenKey, miscLevel.value),
        loc.value
      ),
      growth: formatMiscValue(regenKey, row.growth[regenKey] ?? 0, loc.value),
    })
  )
}

function groupLabel(key: 'survival' | 'attack' | 'other'): string {
  const k = { survival: 'miscGroupSurvival', attack: 'miscGroupAttack', other: 'miscGroupOther' }[
    key
  ]
  return String(p.t(`statisticsPage.${k}`))
}

function columnLabel(key: ChampionMiscBaseStatKey): string {
  if (key === 'mp') return String(p.t('statisticsPage.miscColResource'))
  const k = `statisticsPage.miscShort.${key}`
  const v = String(p.t(k))
  return v === k ? statLabel(key) : v
}

function rowDisplayName(row: ChampionMiscStatRow): string {
  return championMiscStatDisplayName(row, (key: string) => String(p.t?.(key) ?? key))
}

function rowKey(row: ChampionMiscStatRow): string {
  return championMiscStatRowKey(row.championId, row.variant)
}
</script>

<template>
  <div class="space-y-4 pt-2 md:pt-4">
    <div v-if="p.miscPending" class="text-text/70">{{ p.t('statisticsPage.loading') }}</div>
    <div v-else-if="p.miscError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.miscError }}
    </div>
    <div v-else-if="!p.paginatedMiscRows?.length" class="text-text/70">
      {{ p.t('statisticsPage.noData') }}
    </div>
    <template v-else>
      <div class="misc-level">
        <label for="misc-level-slider" class="misc-level-label">
          {{ p.t('statisticsPage.miscLevelLabel') }}
        </label>
        <input
          id="misc-level-slider"
          type="range"
          class="misc-level-range"
          :min="CHAMPION_MISC_MIN_LEVEL"
          :max="CHAMPION_MISC_MAX_LEVEL"
          step="1"
          :value="miscLevel"
          @input="onMiscLevelInput"
        />
        <span class="misc-level-value">{{ miscLevel }}</span>
        <span class="misc-level-hint hidden md:inline">{{
          p.t('statisticsPage.miscLevelHint')
        }}</span>
      </div>
      <StatisticsMobileSortBar
        id="misc-mobile-sort"
        v-model:column="miscMobileSortColumn"
        v-model:direction="miscMobileSortDir"
        class="misc-msortbar"
        :options="miscMobileSortOptionsComputed"
      />

      <div class="misc-mlist md:hidden">
        <StatisticsChampionDetailLink
          v-for="row in p.paginatedMiscRows"
          :key="'misc-mobile-' + rowKey(row)"
          :champion-id="row.championId"
          class="misc-mcard"
        >
          <div class="misc-mcard-top">
            <img
              v-if="championPortraitSrc(row)"
              :src="championPortraitSrc(row)!"
              :alt="rowDisplayName(row)"
              class="misc-mcard-img"
              loading="lazy"
            />
            <span class="misc-mcard-name">{{ rowDisplayName(row) }}</span>
            <span class="misc-mcard-hp">
              {{ cellValue(row, 'hp') }}<small>{{ p.t('statisticsPage.miscMobile.hp') }}</small>
            </span>
          </div>
          <div class="misc-mcard-grid">
            <span v-for="key in MISC_MOBILE_KEYS" :key="'mm-' + key">
              <em
                ><img :src="miscStatMeta(key).icon" alt="" class="misc-icon" />{{
                  p.t(`statisticsPage.miscMobile.${key}`)
                }}</em
              >
              <b :style="{ color: miscStatMeta(key).color }">{{ cellValue(row, key) }}</b>
            </span>
          </div>
        </StatisticsChampionDetailLink>
      </div>

      <div class="misc-card hidden md:block">
        <div class="overflow-x-auto">
          <table class="misc-table">
            <thead>
              <tr class="misc-group-row">
                <th rowspan="2" class="misc-th-champ" @click="p.setMiscSort('champion')">
                  {{ p.t('statisticsPage.miscColChampion') }}{{ sortIndicator('champion') }}
                </th>
                <th
                  v-for="g in MISC_STAT_GROUPS"
                  :key="'misc-g-' + g.key"
                  :colspan="g.stats.length"
                  class="misc-th-group"
                >
                  {{ groupLabel(g.key) }}
                </th>
              </tr>
              <tr>
                <template v-for="g in MISC_STAT_GROUPS" :key="'misc-gs-' + g.key">
                  <th
                    v-for="(key, i) in g.stats"
                    :key="'misc-th-' + key"
                    class="misc-th"
                    :class="{ 'is-first': i === 0 }"
                    @click="p.setMiscSort(baseSortCol(key))"
                  >
                    <span class="misc-th-in">
                      <img :src="miscStatMeta(key).icon" alt="" class="misc-icon" />
                      {{ columnLabel(key) }}{{ sortIndicator(baseSortCol(key)) }}
                    </span>
                  </th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in p.paginatedMiscRows" :key="'misc-' + rowKey(row)">
                <td class="misc-td-champ">
                  <StatisticsChampionTableLink
                    :champion-id="row.championId"
                    :name="rowDisplayName(row)"
                    :portrait-src="championPortraitSrc(row)"
                    :query="p.championSearchQuery"
                  />
                </td>
                <template v-for="g in MISC_STAT_GROUPS" :key="'misc-tdg-' + g.key">
                  <td
                    v-for="(key, i) in g.stats"
                    :key="'misc-td-' + key"
                    class="misc-td"
                    :class="{ 'is-first': i === 0 }"
                    :title="cellTitle(row, key)"
                  >
                    <span class="misc-val" :style="{ color: miscStatMeta(key).color }">{{
                      cellValue(row, key)
                    }}</span>
                    <span v-if="cellGrowth(row, key)" class="misc-growth">{{
                      cellGrowth(row, key)
                    }}</span>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="misc-footnote hidden md:block">{{ p.t('statisticsPage.miscFootnote') }}</p>

      <StatisticsTabPagination
        v-model:page="p.miscPage"
        v-model:page-size="miscPageSize"
        :total-pages="p.totalMiscPages"
        :total-count="p.totalMiscCount"
        :page-size-options="p.PAGE_SIZE_OPTIONS"
      />
    </template>
  </div>
</template>

<style scoped>
.misc-mlist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
@media (min-width: 768px) {
  .misc-mlist {
    display: none;
  }
}
.misc-mcard {
  display: block;
  padding: 12px 14px;
  border: 1px solid #463714;
  border-radius: 12px;
  background: #0a1428;
  color: #f0e6d2;
}
.misc-mcard-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.misc-mcard-img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
}
.misc-mcard-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 14px;
}
.misc-mcard-hp {
  font-family: var(--font-display, inherit);
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.misc-mcard-hp small {
  margin-left: 4px;
  font-size: 10px;
  color: #a09b8c;
}
.misc-mcard-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 6px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.misc-mcard-grid em {
  display: block;
  white-space: nowrap;
  font-style: normal;
  font-weight: 400;
  color: #a09b8c;
}
@media (max-width: 767px) {
  .misc-msortbar {
    display: none !important;
  }
}
.misc-level {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border: 1px solid #463714;
  border-radius: 12px;
  background: #0a1428;
}
.misc-level-label {
  font-size: 14px;
  color: #f0e6d2;
}
.misc-level-range {
  flex: 1 1 260px;
  min-width: 120px;
  accent-color: #c8aa6e;
}
.misc-level-value {
  min-width: 44px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #0a323c;
  text-align: center;
  font-family: 'Barlow', sans-serif;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  color: #f0e6d2;
}
.misc-level-hint {
  font-size: 12px;
  color: #a09b8c;
}
.misc-card {
  border: 1px solid #463714;
  border-radius: 12px;
  background: #0a1428;
  overflow: hidden;
}
.misc-table {
  width: 100%;
  min-width: 960px;
  border-collapse: collapse;
  font-size: 13px;
  color: #f0e6d2;
}
.misc-table th {
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  border-bottom: 1px solid #0a323c;
  padding: 9px 14px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.misc-th-champ {
  text-align: left;
  padding-left: 20px !important;
}
.misc-th-group {
  text-align: center;
  font-size: 11px !important;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #c8aa6e !important;
  border-left: 1px solid #1e2328;
  cursor: default !important;
}
.misc-th,
.misc-td {
  text-align: right;
}
.misc-th.is-first,
.misc-td.is-first {
  border-left: 1px solid #1e2328;
}
.misc-table tbody tr {
  border-bottom: 1px solid #1e2328;
}
.misc-table tbody tr:hover {
  background: rgb(200 170 110 / 0.04);
}
.misc-td-champ {
  padding: 8px 20px;
}
.misc-td {
  padding: 8px 14px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.misc-th-in {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.misc-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 4px;
  vertical-align: -3px;
  object-fit: contain;
}
.misc-th-in .misc-icon {
  margin-right: 0;
}
.misc-val {
  display: block;
  font-weight: 700;
}
.misc-growth {
  display: block;
  font-size: 11px;
  color: #a09b8c;
}
.misc-footnote {
  font-size: 12px;
  color: #a09b8c;
}
</style>
