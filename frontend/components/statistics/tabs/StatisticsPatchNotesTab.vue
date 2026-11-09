<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useVersionStore } from '~/stores/VersionStore'
import { getChampionImageUrl, getItemImageUrl, getRuneImageUrl } from '~/utils/imageUrl'
import {
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
  PATCH_NOTES_CHIPS,
  applyPatchNotesChip,
  patchNotesChipActive,
  type PatchNotesChip,
} from '~/utils/statistics/patchNotesChips'
import {
  PATCH_NOTES_PERIODS,
  patchNotesBarSegments,
  patchNotesPeriodOf,
  patchNotesPeriodRange,
  type PatchNotesPeriod,
} from '~/utils/statistics/patchNotesBars'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()
const { locale } = useI18n()
const loc = computed(() => (String(locale.value).startsWith('fr') ? 'fr' : 'en'))

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

const TARGET_CHIPS: readonly PatchNotesChip[] = ['all', 'champion', 'items', 'runes']

const PERIOD_LABEL_KEYS: Record<PatchNotesPeriod | 'custom', string> = {
  all: 'statisticsPage.patchNotesPeriodAll',
  last3: 'statisticsPage.patchNotesPeriodLast3',
  last5: 'statisticsPage.patchNotesPeriodLast5',
  last10: 'statisticsPage.patchNotesPeriodLast10',
  custom: 'statisticsPage.patchNotesPeriodCustom',
}

const period = computed({
  get: () =>
    patchNotesPeriodOf(p.patchNotesVersionOptions, p.patchNotesFromVersion, p.patchNotesToVersion),
  set: (v: PatchNotesPeriod | 'custom') => {
    if (v === 'custom') return
    const r = patchNotesPeriodRange(p.patchNotesVersionOptions, v)
    p.patchNotesFromVersion = r.from
    p.patchNotesToVersion = r.to
  },
})

const maxTotal = computed(() =>
  Math.max(0, ...(p.paginatedPatchNotesRows ?? []).map(r => r.totalChanges))
)

function barSegments(row: PatchNotesStatsRow) {
  return patchNotesBarSegments(row, maxTotal.value)
}

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
  if (type === 'champion') return String(p.t('statisticsPage.patchNotesTypeChampion'))
  if (type === 'items') return String(p.t('statisticsPage.patchNotesTypeItem'))
  return String(p.t('statisticsPage.patchNotesTypeRune'))
}

function changeTypeLabel(type: PatchNotesChangeType): string {
  if (type === 'up') return String(p.t('patchNotesPage.changeTypes.buff') ?? 'Buff')
  if (type === 'nerf') return String(p.t('patchNotesPage.changeTypes.nerf') ?? 'Nerf')
  return String(p.t('patchNotesPage.changeTypes.adjustment') ?? 'Adjust')
}

function changeTypeTone(type: PatchNotesChangeType): string {
  if (type === 'up') return 'is-up'
  if (type === 'nerf') return 'is-nerf'
  return 'is-adjust'
}

function sortIndicator(col: PatchNotesSortCol): string {
  if (p.patchNotesSortColumn !== col) return ''
  return p.patchNotesSortDir === 'asc' ? ' ▲' : ' ▼'
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
  <div class="space-y-4 pt-2 md:pt-8">
    <div class="pn-bar">
      <label class="pn-search">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          v-model.trim="p.championSearchQuery"
          type="search"
          :placeholder="p.t('statisticsPage.patchNotesSearchPlaceholder')"
          :aria-label="p.t('statisticsPage.patchNotesSearchPlaceholder')"
        />
      </label>
      <div class="pn-seg" role="group">
        <button
          v-for="chip in TARGET_CHIPS"
          :key="'pn-seg-' + chip"
          type="button"
          :class="{ 'is-active': isChipActive(chip) }"
          :aria-pressed="isChipActive(chip)"
          @click="onChip(chip)"
        >
          {{ p.t(PATCH_NOTES_CHIP_LABEL_KEYS[chip]) }}
        </button>
      </div>
      <label class="pn-period hidden md:inline-flex">
        <span>{{ p.t('statisticsPage.patchNotesPeriod') }}</span>
        <select v-model="period">
          <option v-for="per in PATCH_NOTES_PERIODS" :key="'pn-per-' + per" :value="per">
            {{ p.t(PERIOD_LABEL_KEYS[per]) }}
          </option>
          <option v-if="period === 'custom'" value="custom">
            {{ p.t(PERIOD_LABEL_KEYS.custom) }}
          </option>
        </select>
      </label>
      <div class="pn-legend">
        <span><i class="is-up" />{{ p.t('patchNotesPage.changeTypes.buff') }}</span>
        <span><i class="is-nerf" />{{ p.t('patchNotesPage.changeTypes.nerf') }}</span>
        <span><i class="is-adjust" />{{ p.t('patchNotesPage.changeTypes.adjustment') }}</span>
      </div>
    </div>
    <div
      class="statistics-patch-notes-chips hidden"
      role="group"
      :aria-label="p.t('statisticsPage.patchNotesChipsAria')"
    >
      <button
        v-for="chip in PATCH_NOTES_CHIPS"
        :key="chip"
        type="button"
        class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
        :class="
          isChipActive(chip)
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-primary/40 text-text/80 hover:border-accent/60'
        "
        :aria-pressed="isChipActive(chip)"
        @click="onChip(chip)"
      >
        {{ p.t(PATCH_NOTES_CHIP_LABEL_KEYS[chip]) }}
      </button>
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
      <ul class="pn-mlist md:hidden">
        <li
          v-for="row in p.paginatedPatchNotesRows"
          :key="'pn-m-' + row.targetType + '-' + row.targetId"
          class="pn-mrow"
        >
          <img
            v-if="entityImageUrl(row)"
            loading="lazy"
            decoding="async"
            :src="entityImageUrl(row)!"
            :alt="entityLabel(row)"
            class="pn-mimg"
            width="40"
            height="40"
          />
          <span v-else class="pn-mimg pn-img-empty">?</span>
          <span class="pn-mbody">
            <span class="pn-mname">
              <b class="truncate">{{ entityLabel(row) }}</b>
              <span class="pn-type">{{ targetTypeLabel(row.targetType) }}</span>
            </span>
            <span class="pn-stack">
              <span
                v-for="seg in barSegments(row)"
                :key="seg.type"
                :class="'is-' + seg.type"
                :style="{ width: seg.pct + '%' }"
              />
            </span>
          </span>
          <span class="pn-mnums">
            <b class="pn-mtotal">{{ row.totalChanges }}</b>
            <span class="pn-mlast" :class="changeTypeTone(row.lastModType)">
              {{
                p.t('statisticsPage.patchNotesMobileLast', {
                  type: changeTypeLabel(row.lastModType).toLowerCase(),
                  patch: row.lastModPatch,
                })
              }}
            </span>
          </span>
        </li>
      </ul>

      <div class="pn-card hidden md:block">
        <div class="overflow-x-auto">
          <table class="pn-table">
            <thead>
              <tr>
                <th class="pn-th-target" @click="p.setPatchNotesSort('target')">
                  {{ p.t('statisticsPage.patchNotesColTarget') }}{{ sortIndicator('target') }}
                </th>
                <th
                  class="pn-th-changes"
                  :class="{ 'is-sorted': p.patchNotesSortColumn === 'totalChanges' }"
                  @click="p.setPatchNotesSort('totalChanges')"
                >
                  {{ p.t('statisticsPage.patchNotesColChanges')
                  }}{{ sortIndicator('totalChanges') }}
                </th>
                <th class="pn-th-num" @click="p.setPatchNotesSort('totalChanges')">
                  {{ p.t('statisticsPage.patchNotesColTotal') }}
                </th>
                <th @click="p.setPatchNotesSort('lastMod')">
                  {{ p.t('statisticsPage.patchNotesColLastMod') }}{{ sortIndicator('lastMod') }}
                </th>
                <th @click="p.setPatchNotesSort('regularity')">
                  {{ p.t('statisticsPage.patchNotesColTouched') }}{{ sortIndicator('regularity') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in p.paginatedPatchNotesRows"
                :key="'pn-' + row.targetType + '-' + row.targetId"
              >
                <td class="pn-td-target">
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
                  <span v-else class="pn-img pn-img-empty">?</span>
                  <span class="min-w-0">
                    <span class="pn-name">{{ entityLabel(row) }}</span>
                    <span class="pn-type">{{ targetTypeLabel(row.targetType) }}</span>
                  </span>
                </td>
                <td class="pn-td-changes">
                  <div class="pn-stack">
                    <span
                      v-for="seg in barSegments(row)"
                      :key="seg.type"
                      :class="'is-' + seg.type"
                      :style="{ width: seg.pct + '%' }"
                    />
                  </div>
                  <div class="pn-counts">
                    <span class="is-up">{{ row.countUp }} buffs</span> ·
                    <span class="is-nerf">{{ row.countNerf }} nerfs</span> ·
                    <span class="is-adjust"
                      >{{ row.countAjust }} {{ loc === 'fr' ? 'ajust.' : 'adj.' }}</span
                    >
                  </div>
                </td>
                <td class="pn-total">{{ row.totalChanges }}</td>
                <td class="pn-last">
                  <span class="tabular-nums">{{ row.lastModPatch }}</span>
                  <span class="pn-pill" :class="changeTypeTone(row.lastModType)">
                    {{ changeTypeLabel(row.lastModType) }}
                  </span>
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
      </div>
      <p class="pn-footnote hidden md:block">{{ p.t('statisticsPage.patchNotesFootnote') }}</p>

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
.pn-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.pn-search {
  display: flex;
  flex: 0 1 340px;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid #463714;
  border-radius: 8px;
  background: #010a13;
  color: #a09b8c;
}
.pn-search input {
  flex: 1;
  min-width: 0;
  background: transparent;
  color: #f0e6d2;
  font-size: 14px;
  outline: none;
}
.pn-seg {
  gap: 2px;
  padding: 3px;
  border: 1px solid #0a323c;
  border-radius: 8px;
  background: #010a13;
}
.pn-seg button {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  color: #a09b8c;
}
.pn-seg button.is-active {
  background: #0a323c;
  color: #f0e6d2;
  font-weight: 600;
}
.pn-period {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #a09b8c;
}
.pn-period select {
  padding: 7px 10px;
  border: 1px solid #463714;
  border-radius: 8px;
  background: #010a13;
  color: #f0e6d2;
  font-weight: 600;
  font-size: 13px;
}
.pn-legend {
  margin-left: auto;
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
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
.pn-legend i.is-up,
.pn-stack .is-up {
  background: #0ac8b9;
}
.pn-legend i.is-nerf,
.pn-stack .is-nerf {
  background: #e2665a;
}
.pn-legend i.is-adjust,
.pn-stack .is-adjust {
  background: #0397ab;
}
.pn-card {
  border: 1px solid #463714;
  border-radius: 12px;
  background: #0a1428;
  overflow: hidden;
}
.pn-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  font-size: 13px;
  color: #f0e6d2;
}
.pn-table th {
  padding: 12px 20px;
  border-bottom: 1px solid #0a323c;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.pn-table th.is-sorted {
  color: #c8aa6e;
}
.pn-table th.pn-th-num {
  text-align: right;
}
.pn-table tbody tr {
  border-bottom: 1px solid #1e2328;
}
.pn-table tbody tr:last-child {
  border-bottom: 0;
}
.pn-table td {
  padding: 9px 20px;
  vertical-align: middle;
}
.pn-td-target {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 220px;
}
.pn-img {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 6px;
  object-fit: cover;
}
.pn-img-empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #0a323c;
  color: #a09b8c;
  font-size: 11px;
}
.pn-name {
  display: block;
  font-weight: 500;
  font-size: 14px;
}
.pn-type {
  display: block;
  font-size: 11px;
  color: #a09b8c;
}
.pn-td-changes {
  width: 42%;
}
.pn-stack {
  display: flex;
  gap: 2px;
  height: 8px;
}
.pn-stack span {
  height: 100%;
  border-radius: 2px;
}
.pn-counts {
  margin-top: 4px;
  font-size: 12px;
  color: #a09b8c;
}
.pn-counts .is-up {
  color: #0ac8b9;
}
.pn-counts .is-nerf {
  color: #e2665a;
}
.pn-counts .is-adjust {
  color: #0397ab;
}
.pn-total {
  text-align: right;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.pn-last {
  white-space: nowrap;
  font-weight: 600;
}
.pn-pill {
  margin-left: 8px;
  padding: 2px 8px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}
.pn-pill.is-up {
  color: #0ac8b9;
}
.pn-pill.is-nerf {
  color: #e2665a;
}
.pn-pill.is-adjust {
  color: #0397ab;
}
.pn-touched {
  white-space: nowrap;
}
.pn-footnote {
  font-size: 12px;
  color: #a09b8c;
}

.pn-mlist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pn-mrow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #463714;
  border-radius: 12px;
  background: #0a1428;
  color: #f0e6d2;
}
.pn-mimg {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
}
.pn-mbody {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.pn-mname {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  font-size: 14px;
}
.pn-mbody .pn-stack {
  height: 8px;
}
.pn-mnums {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  width: 118px;
}
.pn-mtotal {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
.pn-mlast {
  margin-top: 4px;
  font-size: 11px;
}
.pn-mlast.is-up {
  color: #0ac8b9;
}
.pn-mlast.is-nerf {
  color: #e2665a;
}
.pn-mlast.is-adjust {
  color: #0397ab;
}
@media (max-width: 767px) {
  .pn-search {
    flex: 1 1 100%;
  }
  .pn-seg {
    display: flex;
    width: 100%;
  }
  .pn-seg button {
    flex: 1;
    padding: 9px 4px;
  }
  .pn-legend {
    display: flex;
    margin-left: 0;
  }
  .pn-period {
    display: none !important;
  }
}
</style>
