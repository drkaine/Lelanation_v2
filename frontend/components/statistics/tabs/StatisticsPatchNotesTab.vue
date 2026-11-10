<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { isOneOf } from '~/utils/statistics/isOneOf'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useVersionStore } from '~/stores/VersionStore'
import { getChampionImageUrl, getItemImageUrl, getRuneImageUrl } from '~/utils/imageUrl'
import {
  patchNotesMobileSortOptions,
  type PatchNotesChangeType,
  type PatchNotesSortCol,
  type PatchNotesStatsRow,
  type PatchNotesTargetType,
} from '~/composables/statistics/useStatisticsPatchNotesTab'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import {
  applyPatchNotesChip,
  patchNotesChipActive,
  type PatchNotesChip,
} from '~/utils/statistics/patchNotesChips'
import { PATCH_NOTES_TARGET_SEGMENTS, patchNotesBar } from '~/utils/statistics/patchNotesBar'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const { currentVersion: gameVersionFromStore } = storeToRefs(useVersionStore())

const PATCH_NOTES_CHIP_LABEL_KEYS: Record<PatchNotesChip, string> = {
  all: 'statisticsPage.patchNotesChipAll',
  champion: 'statisticsPage.patchNotesTargetChampion',
  items: 'statisticsPage.patchNotesTargetItems',
  runes: 'statisticsPage.patchNotesTargetRunes',
  up: 'patchNotesPage.changeTypes.buff',
  nerf: 'patchNotesPage.changeTypes.nerf',
  adjust: 'patchNotesPage.changeTypes.adjustment',
}

function isChipActive(chip: PatchNotesChip): boolean {
  return patchNotesChipActive(chip, p.patchNotesTargetFilters, p.patchNotesChangeFilter)
}

function onChip(chip: PatchNotesChip): void {
  const next = applyPatchNotesChip(chip, p.patchNotesChangeFilter)
  if (next.targets) p.patchNotesTargetFilters = next.targets
  p.patchNotesChangeFilter = next.change
}

const PATCH_NOTES_SORT_COLS: readonly PatchNotesSortCol[] = [
  'target',
  'countUp',
  'countNerf',
  'countAjust',
  'totalChanges',
  'lastMod',
  'regularity',
]

const patchNotesMobileSortColumn = computed({
  get: () => p.patchNotesSortColumn,
  set: (v: string) => {
    if (isOneOf(PATCH_NOTES_SORT_COLS, v)) p.setPatchNotesSort(v)
  },
})

const patchNotesMobileSortDir = computed({
  get: () => p.patchNotesSortDir,
  set: (v: 'asc' | 'desc') => {
    p.patchNotesSortDir = v
  },
})

const patchNotesMobileSortOptionsComputed = computed(() =>
  patchNotesMobileSortOptions((key: string) => p.t(key))
)

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .trim()
}

function championByPatchId(id: string) {
  const key = normalizeKey(id)
  return championsStore.champions.find(
    c => normalizeKey(c.id) === key || normalizeKey(c.name) === key
  )
}

function itemByPatchId(id: string) {
  const key = normalizeKey(id)
  return itemsStore.items.find(i => String(i.id) === id || normalizeKey(i.name) === key) ?? null
}

function runeByPatchId(id: string) {
  const numeric = Number(id)
  for (const path of runesStore.runePaths) {
    for (const slot of path.slots) {
      for (const rune of slot.runes) {
        if (String(rune.id) === id) return rune
        if (Number.isFinite(numeric) && rune.id === numeric) return rune
        if (normalizeKey(rune.key) === normalizeKey(id)) return rune
        if (normalizeKey(rune.name) === normalizeKey(id)) return rune
      }
    }
  }
  return null
}

function entityLabel(row: PatchNotesStatsRow): string {
  if (row.targetType === 'champion') {
    return championByPatchId(row.targetId)?.name ?? row.targetId
  }
  if (row.targetType === 'items') {
    return itemByPatchId(row.targetId)?.name ?? row.targetId
  }
  return runeByPatchId(row.targetId)?.name ?? row.targetId
}

function entityImageUrl(row: PatchNotesStatsRow): string | null {
  const version = String(p.gameVersion ?? gameVersionFromStore.value ?? '').trim()
  if (!version) return null

  if (row.targetType === 'champion') {
    const champion = championByPatchId(row.targetId)
    if (!champion) return null
    return getChampionImageUrl(version, champion.image.full)
  }
  if (row.targetType === 'items') {
    const item = itemByPatchId(row.targetId)
    if (!item?.image?.full) return null
    return getItemImageUrl(version, item.image.full)
  }
  const rune = runeByPatchId(row.targetId)
  if (!rune?.icon) return null
  return getRuneImageUrl(version, rune.icon)
}

function targetTypeLabel(type: PatchNotesTargetType): string {
  if (type === 'champion') return String(p.t('statisticsPage.patchNotesTargetChampion') ?? type)
  if (type === 'items') return String(p.t('statisticsPage.patchNotesTargetItems') ?? type)
  return String(p.t('statisticsPage.patchNotesTargetRunes') ?? type)
}

function changeTypeLabel(type: PatchNotesChangeType): string {
  if (type === 'up') return String(p.t('patchNotesPage.changeTypes.buff') ?? 'Buff')
  if (type === 'nerf') return String(p.t('patchNotesPage.changeTypes.nerf') ?? 'Nerf')
  return String(p.t('patchNotesPage.changeTypes.adjustment') ?? 'Adjust')
}

function sortIndicator(col: PatchNotesSortCol): string {
  if (p.patchNotesSortColumn !== col) return ''
  return p.patchNotesSortDir === 'asc' ? ' ▲' : ' ▼'
}

function isSorted(col: PatchNotesSortCol): boolean {
  return p.patchNotesSortColumn === col
}

const maxTotalChanges = computed(() =>
  Math.max(0, ...(p.paginatedPatchNotesRows ?? []).map((r: PatchNotesStatsRow) => r.totalChanges))
)

function barOf(row: PatchNotesStatsRow) {
  return patchNotesBar(row, maxTotalChanges.value)
}

function patchNotesMessage(message: string | undefined): string {
  if (!message) return ''
  if (message === 'No patch notes data in selected version range') {
    return String(p.t('statisticsPage.patchNotesNoDataInRange') ?? message)
  }
  if (message === 'Database not configured') {
    return String(p.t('statisticsPage.patchNotesDbNotConfigured') ?? message)
  }
  return message
}
</script>

<template>
  <div class="space-y-3">
    <h2 class="pn-title hidden md:block">{{ p.t('statisticsPage.patchNotesTitle') }}</h2>
    <div class="pn-toolbar">
      <div
        class="pn-seg-group"
        role="group"
        :aria-label="p.t('statisticsPage.patchNotesChipsAria')"
      >
        <button
          v-for="seg in PATCH_NOTES_TARGET_SEGMENTS"
          :key="seg"
          type="button"
          class="pn-seg-btn"
          :class="{ 'is-active': isChipActive(seg) }"
          :aria-pressed="isChipActive(seg)"
          @click="onChip(seg)"
        >
          {{ p.t(PATCH_NOTES_CHIP_LABEL_KEYS[seg]) }}
        </button>
      </div>
      <div class="pn-legend">
        <span><i class="is-up" />{{ changeTypeLabel('up') }}</span>
        <span><i class="is-nerf" />{{ changeTypeLabel('nerf') }}</span>
        <span><i class="is-ajust" />{{ changeTypeLabel('ajust') }}</span>
      </div>
    </div>
    <div v-if="p.patchNotesPending" class="text-text/70">{{ p.t('statisticsPage.loading') }}</div>
    <div
      v-else-if="p.patchNotesError"
      class="rounded border border-error bg-surface p-3 text-error"
    >
      {{ p.patchNotesError }}
    </div>
    <div
      v-else-if="p.patchNotesData?.message && !p.patchNotesData?.rows?.length"
      class="text-text/70"
    >
      {{ patchNotesMessage(p.patchNotesData.message) }}
    </div>
    <div v-else-if="!p.paginatedPatchNotesRows?.length" class="text-text/70">
      {{ p.t('statisticsPage.noData') }}
    </div>
    <template v-else>
      <StatisticsMobileSortBar
        id="patch-notes-mobile-sort"
        v-model:column="patchNotesMobileSortColumn"
        v-model:direction="patchNotesMobileSortDir"
        :options="patchNotesMobileSortOptionsComputed"
      />

      <ol class="pn-mlist md:hidden">
        <li
          v-for="row in p.paginatedPatchNotesRows"
          :key="'pn-mobile-' + row.targetType + '-' + row.targetId"
          class="pn-mcard"
        >
          <img
            v-if="entityImageUrl(row)"
            loading="lazy"
            decoding="async"
            :src="entityImageUrl(row)!"
            :alt="entityLabel(row)"
            class="pn-img pn-mimg"
            width="32"
            height="32"
          />
          <div v-else class="pn-img pn-img-empty pn-mimg">?</div>
          <span class="pn-mname">
            <span class="pn-name">{{ entityLabel(row) }}</span>
            <span class="pn-type">{{ targetTypeLabel(row.targetType) }}</span>
          </span>
          <span class="pn-mtotal">{{ row.totalChanges }}</span>
          <div
            class="pn-bar pn-mbar"
            role="img"
            :aria-label="
              p.t('statisticsPage.patchNotesCountBuffs', { n: row.countUp }) +
              ', ' +
              p.t('statisticsPage.patchNotesCountNerfs', { n: row.countNerf }) +
              ', ' +
              p.t('statisticsPage.patchNotesCountAdjusts', { n: row.countAjust })
            "
            :style="{ width: barOf(row).widthPct + '%' }"
          >
            <span
              v-for="seg in barOf(row).segments"
              :key="seg.kind"
              class="pn-seg"
              :class="'is-' + seg.kind"
              :style="{ flex: seg.count }"
            />
          </div>
          <span class="pn-mlast" :class="'is-' + row.lastModType">
            {{ changeTypeLabel(row.lastModType) }} {{ row.lastModPatch }}
          </span>
        </li>
      </ol>

      <div class="pn-dtable-wrap hidden md:block">
        <table class="pn-dtable">
          <thead>
            <tr class="pn-dhead">
              <th class="text-left" :class="{ 'is-sorted': isSorted('target') }">
                <button type="button" class="pn-dsort" @click="p.setPatchNotesSort('target')">
                  {{ p.t('statisticsPage.patchNotesColTarget') }}{{ sortIndicator('target') }}
                </button>
              </th>
              <th class="text-left" :class="{ 'is-sorted': isSorted('totalChanges') }">
                <button type="button" class="pn-dsort" @click="p.setPatchNotesSort('totalChanges')">
                  {{ p.t('statisticsPage.patchNotesColChanges')
                  }}{{ sortIndicator('totalChanges') }}
                </button>
              </th>
              <th class="text-right" :class="{ 'is-sorted': isSorted('totalChanges') }">
                {{ p.t('statisticsPage.patchNotesColTotal') }}
              </th>
              <th class="text-left" :class="{ 'is-sorted': isSorted('lastMod') }">
                <button type="button" class="pn-dsort" @click="p.setPatchNotesSort('lastMod')">
                  {{ p.t('statisticsPage.patchNotesColLastMod') }}{{ sortIndicator('lastMod') }}
                </button>
              </th>
              <th class="text-left" :class="{ 'is-sorted': isSorted('regularity') }">
                <button type="button" class="pn-dsort" @click="p.setPatchNotesSort('regularity')">
                  {{ p.t('statisticsPage.patchNotesColRegularity')
                  }}{{ sortIndicator('regularity') }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in p.paginatedPatchNotesRows"
              :key="'pn-' + row.targetType + '-' + row.targetId"
              class="pn-drow"
            >
              <td>
                <div class="pn-target">
                  <img
                    v-if="entityImageUrl(row)"
                    loading="lazy"
                    decoding="async"
                    :src="entityImageUrl(row)!"
                    :alt="entityLabel(row)"
                    class="pn-img"
                    width="32"
                    height="32"
                  />
                  <div v-else class="pn-img pn-img-empty">?</div>
                  <div class="min-w-0">
                    <div class="pn-name">{{ entityLabel(row) }}</div>
                    <div class="pn-type">{{ targetTypeLabel(row.targetType) }}</div>
                  </div>
                </div>
              </td>
              <td class="pn-changes">
                <div class="pn-bar" :style="{ width: barOf(row).widthPct + '%' }">
                  <span
                    v-for="seg in barOf(row).segments"
                    :key="seg.kind"
                    class="pn-seg"
                    :class="'is-' + seg.kind"
                    :style="{ flex: seg.count }"
                  />
                </div>
                <div class="pn-counts">
                  <span class="is-up">{{
                    p.t('statisticsPage.patchNotesCountBuffs', { n: row.countUp })
                  }}</span>
                  ·
                  <span class="is-nerf">{{
                    p.t('statisticsPage.patchNotesCountNerfs', { n: row.countNerf })
                  }}</span>
                  ·
                  <span class="is-ajust">{{
                    p.t('statisticsPage.patchNotesCountAdjusts', { n: row.countAjust })
                  }}</span>
                </div>
              </td>
              <td class="pn-total">{{ row.totalChanges }}</td>
              <td>
                <div class="pn-last">
                  <span class="pn-last-ver">{{ row.lastModPatch }}</span>
                  <span class="pn-pill" :class="'is-' + row.lastModType">
                    {{ changeTypeLabel(row.lastModType) }}
                  </span>
                </div>
              </td>
              <td class="pn-touched">
                {{
                  p.t('statisticsPage.patchNotesTouchedIn', {
                    n: row.patchesTouched,
                    total: row.totalPatches,
                  })
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <StatisticsTabPagination
        v-if="p.totalPatchNotesPages > 1"
        v-model:page="p.patchNotesPage"
        v-model:page-size="p.patchNotesPageSize"
        :total-pages="p.totalPatchNotesPages"
      />
    </template>
  </div>
</template>

<style scoped>
.pn-title {
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.pn-toolbar {
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.pn-seg-group {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid #0a323c;
  border-radius: 8px;
  background: #0a1428;
}
.pn-seg-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 14px;
  color: #a09b8c;
}
.pn-seg-btn:hover {
  color: #f0e6d2;
}
.pn-seg-btn.is-active {
  color: #f0e6d2;
  font-weight: 600;
  background: #0a323c;
}
.pn-legend {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: #a09b8c;
}
.pn-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pn-legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.is-up {
  color: #0ac8b9;
}
.is-nerf {
  color: #e2665a;
}
.is-ajust {
  color: #0397ab;
}
.pn-legend i.is-up,
.pn-seg.is-up {
  background: #0ac8b9;
}
.pn-legend i.is-nerf,
.pn-seg.is-nerf {
  background: #e2665a;
}
.pn-legend i.is-ajust,
.pn-seg.is-ajust {
  background: #0397ab;
}
.pn-dtable-wrap {
  overflow-x: auto;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.pn-dtable {
  width: 100%;
  min-width: 960px;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.pn-dhead th {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.pn-dhead th.is-sorted {
  color: #c8aa6e;
}
.pn-dsort {
  color: inherit;
  font-weight: inherit;
}
.pn-dsort:hover {
  color: #f0e6d2;
}
.pn-drow td {
  padding: 10px 12px;
  border-bottom: 1px solid #1e2328;
  vertical-align: middle;
}
.pn-drow:last-child td {
  border-bottom: 0;
}
.pn-drow:hover {
  background: rgba(10, 50, 60, 0.35);
}
.pn-target {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.pn-img {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid #463714;
}
.pn-img-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #a09b8c;
  background: #1e2328;
}
.pn-name {
  font-weight: 600;
  color: #f0e6d2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pn-type {
  font-size: 11px;
  color: #a09b8c;
}
.pn-changes {
  min-width: 280px;
}
.pn-bar {
  display: flex;
  gap: 2px;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  min-width: 4px;
}
.pn-seg {
  display: block;
  height: 100%;
}
.pn-counts {
  margin-top: 6px;
  font-size: 12px;
  color: #5b5a56;
}
.pn-total {
  text-align: right;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.pn-last {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pn-last-ver {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.pn-pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border-radius: 11px;
  border: 1px solid currentColor;
  font-size: 12px;
  font-weight: 600;
}
.pn-touched {
  color: #cbc3b0;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.pn-seg-group {
  flex: 1 1 auto;
}
@media (min-width: 768px) {
  .pn-seg-group {
    flex: 0 0 auto;
  }
}
.pn-seg-btn {
  flex: 1;
}
.pn-mlist {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pn-mcard {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  gap: 6px 10px;
  align-items: center;
  padding: 10px 12px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 10px;
}
.pn-mimg {
  grid-row: span 2;
}
.pn-mname {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.pn-mtotal {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 20px;
  font-weight: 700;
  text-align: right;
  color: #f0e6d2;
}
.pn-mbar {
  height: 8px;
  border-radius: 4px;
}
.pn-mlast {
  font-size: 11px;
  white-space: nowrap;
  text-align: right;
}
</style>
