<script setup lang="ts">
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
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

const p = inject('statisticsPageCtx') as Record<string, unknown>

const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const { currentVersion: gameVersionFromStore } = storeToRefs(useVersionStore())

const patchNotesMobileSortColumn = computed({
  get: () => String(p.patchNotesSortColumn ?? 'totalChanges'),
  set: (v: string) => {
    ;(p.setPatchNotesSort as (c: PatchNotesSortCol) => void)?.(v as PatchNotesSortCol)
  },
})

const patchNotesMobileSortDir = computed({
  get: () => (p.patchNotesSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  set: (v: 'asc' | 'desc') => {
    p.patchNotesSortDir = v
  },
})

const patchNotesMobileSortOptionsComputed = computed(() =>
  patchNotesMobileSortOptions((key: string) => String(p.t?.(key) ?? key))
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
  if (type === 'champion') return String(p.t?.('statisticsPage.patchNotesTargetChampion') ?? type)
  if (type === 'items') return String(p.t?.('statisticsPage.patchNotesTargetItems') ?? type)
  return String(p.t?.('statisticsPage.patchNotesTargetRunes') ?? type)
}

function changeTypeLabel(type: PatchNotesChangeType): string {
  if (type === 'up') return String(p.t?.('patchNotesPage.changeTypes.buff') ?? 'Buff')
  if (type === 'nerf') return String(p.t?.('patchNotesPage.changeTypes.nerf') ?? 'Nerf')
  return String(p.t?.('patchNotesPage.changeTypes.adjustment') ?? 'Adjust')
}

function changeTypeClass(type: PatchNotesChangeType): string {
  if (type === 'up') return 'text-emerald-300'
  if (type === 'nerf') return 'text-rose-300'
  return 'text-amber-200'
}

function formatRegularity(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function sortIndicator(col: PatchNotesSortCol): string {
  if (p.patchNotesSortColumn !== col) return ''
  return p.patchNotesSortDir === 'asc' ? ' ▲' : ' ▼'
}

function patchNotesMessage(message: string | undefined): string {
  if (!message) return ''
  if (message === 'No patch notes data in selected version range') {
    return String(p.t?.('statisticsPage.patchNotesNoDataInRange') ?? message)
  }
  if (message === 'Database not configured') {
    return String(p.t?.('statisticsPage.patchNotesDbNotConfigured') ?? message)
  }
  return message
}
</script>

<template>
  <div class="space-y-3">
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

      <div class="statistics-patch-notes-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in p.paginatedPatchNotesRows"
          :key="'pn-mobile-' + row.targetType + '-' + row.targetId"
          class="statistics-patch-notes-mobile-card rounded-lg border border-primary/30 bg-surface/40 p-3"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="entityImageUrl(row)"
              :src="entityImageUrl(row)!"
              :alt="entityLabel(row)"
              class="h-11 w-11 shrink-0 rounded-full object-cover"
              width="44"
              height="44"
            />
            <div
              v-else
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-text/70"
            >
              ?
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-accent">{{ entityLabel(row) }}</div>
              <div class="text-[10px] uppercase tracking-wide text-text/50">
                {{ targetTypeLabel(row.targetType) }}
              </div>
            </div>
            <div class="text-right">
              <div class="text-[10px] uppercase text-text/50">
                {{ p.t('statisticsPage.patchNotesColTotal') }}
              </div>
              <div class="text-xl font-bold tabular-nums text-text">{{ row.totalChanges }}</div>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div class="rounded bg-emerald-500/10 px-2 py-1.5">
              <div class="text-[10px] uppercase text-text/55">
                {{ p.t('statisticsPage.patchNotesColUp') }}
              </div>
              <div class="font-bold tabular-nums text-emerald-300">{{ row.countUp }}</div>
            </div>
            <div class="rounded bg-rose-500/10 px-2 py-1.5">
              <div class="text-[10px] uppercase text-text/55">
                {{ p.t('statisticsPage.patchNotesColNerf') }}
              </div>
              <div class="font-bold tabular-nums text-rose-300">{{ row.countNerf }}</div>
            </div>
            <div class="rounded bg-amber-500/10 px-2 py-1.5">
              <div class="text-[10px] uppercase text-text/55">
                {{ p.t('statisticsPage.patchNotesColAdjust') }}
              </div>
              <div class="font-bold tabular-nums text-amber-200">{{ row.countAjust }}</div>
            </div>
          </div>
          <div
            class="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text/75"
          >
            <span>
              {{ p.t('statisticsPage.patchNotesColLastMod') }}:
              <strong>{{ row.lastModPatch }}</strong>
              <span class="ml-1" :class="changeTypeClass(row.lastModType)">
                {{ changeTypeLabel(row.lastModType) }}
              </span>
            </span>
            <span>
              {{ p.t('statisticsPage.patchNotesColRegularity') }}:
              <strong class="tabular-nums">{{ formatRegularity(row.regularity) }}</strong>
              <span class="text-text/50"> ({{ row.patchesTouched }}/{{ row.totalPatches }}) </span>
            </span>
          </div>
        </article>
      </div>

      <div class="hidden overflow-x-auto md:block">
        <table class="statistics-table w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr
              class="border-b border-primary/30 text-left text-xs uppercase tracking-wide text-text/60"
            >
              <th class="px-2 py-2">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPatchNotesSort('target')"
                >
                  {{ p.t('statisticsPage.patchNotesColTarget') }}{{ sortIndicator('target') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPatchNotesSort('countUp')"
                >
                  {{ p.t('statisticsPage.patchNotesColUp') }}{{ sortIndicator('countUp') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPatchNotesSort('countNerf')"
                >
                  {{ p.t('statisticsPage.patchNotesColNerf') }}{{ sortIndicator('countNerf') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPatchNotesSort('countAjust')"
                >
                  {{ p.t('statisticsPage.patchNotesColAdjust') }}{{ sortIndicator('countAjust') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPatchNotesSort('totalChanges')"
                >
                  {{ p.t('statisticsPage.patchNotesColTotal') }}{{ sortIndicator('totalChanges') }}
                </button>
              </th>
              <th class="px-2 py-2">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPatchNotesSort('lastMod')"
                >
                  {{ p.t('statisticsPage.patchNotesColLastMod') }}{{ sortIndicator('lastMod') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPatchNotesSort('regularity')"
                >
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
              class="border-b border-primary/15 hover:bg-primary/5"
            >
              <td class="px-2 py-2">
                <div class="flex min-w-0 items-center gap-2">
                  <img
                    v-if="entityImageUrl(row)"
                    :src="entityImageUrl(row)!"
                    :alt="entityLabel(row)"
                    class="h-8 w-8 shrink-0 rounded-full object-cover"
                    width="32"
                    height="32"
                  />
                  <div class="min-w-0">
                    <div class="truncate font-medium text-text">{{ entityLabel(row) }}</div>
                    <div class="text-[10px] uppercase text-text/50">
                      {{ targetTypeLabel(row.targetType) }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-2 py-2 text-right tabular-nums text-emerald-300">{{ row.countUp }}</td>
              <td class="px-2 py-2 text-right tabular-nums text-rose-300">{{ row.countNerf }}</td>
              <td class="px-2 py-2 text-right tabular-nums text-amber-200">{{ row.countAjust }}</td>
              <td class="px-2 py-2 text-right font-semibold tabular-nums">
                {{ row.totalChanges }}
              </td>
              <td class="px-2 py-2">
                <span class="tabular-nums">{{ row.lastModPatch }}</span>
                <span class="ml-1 text-xs" :class="changeTypeClass(row.lastModType)">
                  {{ changeTypeLabel(row.lastModType) }}
                </span>
              </td>
              <td class="px-2 py-2 text-right tabular-nums">
                {{ formatRegularity(row.regularity) }}
                <span class="text-xs text-text/50"
                  >({{ row.patchesTouched }}/{{ row.totalPatches }})</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <StatisticsTabPagination
        v-if="p.totalPatchNotesPages > 1"
        :page="p.patchNotesPage"
        :total-pages="p.totalPatchNotesPages"
        @prev="p.onPatchNotesPageUpdated(Math.max(1, p.patchNotesPage - 1))"
        @next="p.onPatchNotesPageUpdated(Math.min(p.totalPatchNotesPages, p.patchNotesPage + 1))"
      />
    </template>
  </div>
</template>
