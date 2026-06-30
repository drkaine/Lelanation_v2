<template>
  <div class="matchup-entries-table">
    <section
      v-if="showFilters"
      class="matchup-entries-table__filters rounded-lg border border-primary/25 bg-surface/30"
      :class="{ 'matchup-entries-table__filters--collapsed': !filtersOpen }"
    >
      <header class="matchup-entries-table__filters-header">
        <button
          type="button"
          class="matchup-entries-table__filters-toggle"
          :aria-expanded="filtersOpen"
          @click="filtersOpen = !filtersOpen"
        >
          <span class="matchup-entries-table__filters-title">
            {{ t('matchupGuideCreate.entriesTable.filtersTitle') }}
          </span>
          <span v-if="activeFiltersCount > 0" class="matchup-entries-table__filters-badge">
            {{ activeFiltersCount }}
          </span>
          <svg
            class="matchup-entries-table__filters-chevron"
            :class="{ 'matchup-entries-table__filters-chevron--open': filtersOpen }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        <button
          v-if="activeFiltersCount > 0"
          type="button"
          class="matchup-entries-table__filters-reset"
          @click="resetFilters"
        >
          {{ t('matchupGuideDiscovery.clearFilters') }}
        </button>
      </header>

      <div v-show="filtersOpen" class="matchup-entries-table__filters-body">
        <div class="matchup-entries-table__filters-grid">
          <label class="matchup-entries-table__filter">
            <span>{{ t('matchupGuideCreate.entriesTable.colRank') }}</span>
            <div class="matchup-entries-table__filter-range">
              <input
                v-model="filters.rankMin"
                type="number"
                min="1"
                :placeholder="t('matchupGuideCreate.entriesTable.min')"
              />
              <span aria-hidden="true">–</span>
              <input
                v-model="filters.rankMax"
                type="number"
                min="1"
                :placeholder="t('matchupGuideCreate.entriesTable.max')"
              />
            </div>
          </label>

          <label class="matchup-entries-table__filter">
            <span>{{ t('matchupGuideCreate.entriesTable.colChampion') }}</span>
            <input
              v-model="filters.champion"
              type="search"
              :placeholder="t('matchupGuideCreate.entriesTable.searchChampion')"
            />
          </label>

          <label class="matchup-entries-table__filter">
            <span>{{ t('matchupGuideCreate.entriesTable.colDifficulty') }}</span>
            <div class="matchup-entries-table__filter-range">
              <input
                v-model="filters.difficultyMin"
                type="number"
                min="1"
                max="10"
                :placeholder="t('matchupGuideCreate.entriesTable.min')"
              />
              <span aria-hidden="true">–</span>
              <input
                v-model="filters.difficultyMax"
                type="number"
                min="1"
                max="10"
                :placeholder="t('matchupGuideCreate.entriesTable.max')"
              />
            </div>
            <select v-model="filters.difficultyBand">
              <option value="">{{ t('matchupGuideCreate.entriesTable.allBands') }}</option>
              <option v-for="band in DIFFICULTY_BANDS" :key="band" :value="band">
                {{ t(`matchupGuideCreate.difficultyBand.${band}`) }}
              </option>
            </select>
          </label>

          <label class="matchup-entries-table__filter">
            <span>{{ t('matchupGuideCreate.entriesTable.colOutcome') }}</span>
            <select v-model="filters.outcome">
              <option value="">{{ t('matchupGuideCreate.entriesTable.allOutcomes') }}</option>
              <option v-for="kind in OUTCOME_KINDS" :key="kind" :value="kind">
                {{ t(`matchupGuideCreate.outcomeKind.${kind}`) }}
              </option>
            </select>
          </label>

          <label class="matchup-entries-table__filter">
            <span>{{ t('matchupGuideCreate.entriesTable.colBuild') }}</span>
            <input
              v-model="filters.build"
              type="search"
              :placeholder="t('matchupGuideCreate.entriesTable.searchBuild')"
            />
          </label>

          <label class="matchup-entries-table__filter">
            <span>{{ t('matchupGuideCreate.entriesTable.colComments') }}</span>
            <input
              v-model="filters.comments"
              type="search"
              :placeholder="t('matchupGuideCreate.entriesTable.searchComments')"
            />
          </label>
        </div>
      </div>
    </section>

    <div v-if="mode === 'edit'" class="matchup-entries-table__toolbar">
      <MatchupGuideCohortColorPicker />
      <p class="matchup-entries-table__hint">
        {{ t('matchupGuideCreate.pickMatchupTargetsHint') }}
      </p>
    </div>

    <div class="matchup-entries-table__mobile">
      <p
        v-if="displayRows.length === 0"
        class="matchup-entries-table__empty matchup-entries-table__empty--mobile"
      >
        {{ t('matchupGuideCreate.entriesTable.noResults') }}
      </p>
      <ul v-else class="matchup-entries-table__mobile-list">
        <li v-for="row in displayRows" :key="row.entry.opponent.id">
          <MatchupGuideEntryMobileCard
            :entry="row.entry"
            :rank="row.rank"
            :portrait-src="getChampionImageUrl(version, row.entry.opponent.image.full)"
            :build="resolvedBuild"
            :mode="mode"
            :preview="previewOpponentId === row.entry.opponent.id"
            :in-cohort="cohortUi(row.entry.opponent.id).inCohort"
            :cohort-in-active="cohortUi(row.entry.opponent.id).inActive"
            :cohort-color="cohortUi(row.entry.opponent.id).color"
            :expanded="Boolean(expandedMobileOpponentIds[row.entry.opponent.id])"
            @toggle="toggleMobileExpanded(row.entry.opponent.id)"
            @toggle-cohort="toggleCohort(row.entry.opponent.id)"
            @preview="openPreview(row.entry.opponent.id)"
          />
        </li>
      </ul>
    </div>

    <div class="matchup-entries-table__wrap overflow-x-auto">
      <table class="matchup-entries-table__table">
        <thead>
          <tr>
            <th v-if="mode === 'edit'" class="matchup-entries-table__th-cohort" />
            <th class="matchup-entries-table__th-sort">
              <button
                type="button"
                class="matchup-entries-table__sort-btn"
                @click="toggleSort('rank')"
              >
                {{ t('matchupGuideCreate.entriesTable.colRank') }}{{ sortIcon('rank') }}
              </button>
            </th>
            <th>{{ t('matchupGuideCreate.entriesTable.colChampion') }}</th>
            <th class="matchup-entries-table__th-sort">
              <button
                type="button"
                class="matchup-entries-table__sort-btn"
                @click="toggleSort('difficulty')"
              >
                {{ t('matchupGuideCreate.entriesTable.colDifficulty') }}{{ sortIcon('difficulty') }}
              </button>
            </th>
            <th>{{ t('matchupGuideCreate.entriesTable.colOutcome') }}</th>
            <th>{{ t('matchupGuideCreate.entriesTable.colBuild') }}</th>
            <th>{{ t('matchupGuideCreate.entriesTable.colPowerSpike') }}</th>
            <th>{{ t('matchupGuideCreate.entriesTable.colEarly') }}</th>
            <th>{{ t('matchupGuideCreate.entriesTable.colMid') }}</th>
            <th>{{ t('matchupGuideCreate.entriesTable.colLate') }}</th>
            <th>{{ t('matchupGuideCreate.entriesTable.colComments') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="displayRows.length === 0">
            <td :colspan="emptyColspan" class="matchup-entries-table__empty">
              {{ t('matchupGuideCreate.entriesTable.noResults') }}
            </td>
          </tr>
          <tr
            v-for="row in displayRows"
            :key="row.entry.opponent.id"
            class="matchup-entries-table__row"
            :class="rowClass(row.entry.opponent.id)"
            :style="rowStyle(row.entry.opponent.id)"
          >
            <td v-if="mode === 'edit'" class="matchup-entries-table__cohort-cell">
              <button
                type="button"
                class="matchup-entries-table__cohort-toggle"
                :class="{
                  'matchup-entries-table__cohort-toggle--remove': cohortUi(row.entry.opponent.id)
                    .inActive,
                }"
                :title="
                  cohortUi(row.entry.opponent.id).inActive
                    ? t('matchupGuideCreate.removeFromCohort')
                    : t('matchupGuideCreate.addToCohort')
                "
                @click.stop="toggleCohort(row.entry.opponent.id)"
              >
                {{ cohortUi(row.entry.opponent.id).inActive ? '−' : '+' }}
              </button>
            </td>
            <td class="matchup-entries-table__rank">{{ row.rank }}</td>
            <td>
              <button
                v-if="mode === 'edit'"
                type="button"
                class="matchup-entries-table__champion-btn"
                @click="openPreview(row.entry.opponent.id)"
              >
                <img
                  :src="getChampionImageUrl(version, row.entry.opponent.image.full)"
                  :alt="row.entry.opponent.name"
                  class="matchup-entries-table__portrait"
                />
                <span>{{ row.entry.opponent.name }}</span>
                <span v-if="isFinalizeReady(row.entry)" class="matchup-entries-table__done">✓</span>
              </button>
              <div v-else class="matchup-entries-table__champion">
                <img
                  :src="getChampionImageUrl(version, row.entry.opponent.image.full)"
                  :alt="row.entry.opponent.name"
                  class="matchup-entries-table__portrait"
                />
                <span>{{ row.entry.opponent.name }}</span>
              </div>
            </td>
            <td>{{ formatMatchupDifficulty(row.entry, t) }}</td>
            <td>{{ formatMatchupOutcome(row.entry, t) }}</td>
            <td
              class="matchup-entries-table__build-cell"
              @mouseenter="showBuildPopover(row.entry, $event)"
              @mouseleave="scheduleHideBuildPopover"
            >
              {{ formatBuildVariantsCell(row.entry, resolvedBuild, t) }}
            </td>
            <td class="matchup-entries-table__phase">{{ formatPowerSpikeCell(row.entry) }}</td>
            <td class="matchup-entries-table__phase">{{ formatPhaseCell(row.entry.early, t) }}</td>
            <td class="matchup-entries-table__phase">{{ formatPhaseCell(row.entry.mid, t) }}</td>
            <td class="matchup-entries-table__phase">{{ formatPhaseCell(row.entry.late, t) }}</td>
            <td class="matchup-entries-table__comments">{{ row.entry.comments?.trim() || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div
        v-if="buildPopover"
        class="matchup-entries-table__build-popover"
        :style="buildPopoverStyle"
        @mouseenter="cancelHideBuildPopover"
        @mouseleave="scheduleHideBuildPopover"
      >
        <BuildCard
          v-if="resolvedBuild"
          :build="resolvedBuild"
          :initial-displayed-variant-index="buildPopover.variantIndex"
          readonly
          hide-top-actions
          sheet-tooltips
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { MatchupEntry } from '@lelanation/shared-types'
import type { Build } from '~/types/build'
import BuildCard from '~/components/Build/BuildCard.vue'
import MatchupGuideCohortColorPicker from '~/components/matchups/MatchupGuideCohortColorPicker.vue'
import MatchupGuideEntryMobileCard from '~/components/matchups/MatchupGuideEntryMobileCard.vue'
import { useGameVersion } from '~/composables/useGameVersion'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import {
  DIFFICULTY_BANDS,
  formatBuildVariantsCell,
  formatMatchupDifficulty,
  formatMatchupOutcome,
  formatPhaseCell,
  formatPowerSpikeCell,
  getMatchupBuildVariants,
  OUTCOME_KINDS,
} from '~/utils/matchupEntryUtils'
import { isMatchupEntryFinalizeReady } from '~/utils/matchupGuideCreateSteps'
import { opponentHasVisibleCohortColor } from '~/utils/matchupGuideCohorts'
import {
  countActiveMatchupEntriesFilters,
  createEmptyMatchupEntriesFilters,
  filterAndSortMatchupEntries,
  type MatchupEntriesSortDir,
  type MatchupEntriesSortKey,
} from '~/utils/matchupEntriesTable'

const props = withDefaults(
  defineProps<{
    entries?: MatchupEntry[]
    build?: Build | null
    mode?: 'edit' | 'readonly'
    showFilters?: boolean
  }>(),
  {
    entries: undefined,
    build: undefined,
    mode: 'edit',
    showFilters: undefined,
  }
)

const { t } = useI18n()
const { version } = useGameVersion()
const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()
const {
  matchupEntries,
  opponentCohortColors,
  activeCohortColor,
  soloSelectedOpponentIds,
  previewOpponentId,
} = storeToRefs(draftStore)

const filtersOpen = ref(true)
const filters = ref(createEmptyMatchupEntriesFilters())
const sortKey = ref<MatchupEntriesSortKey>('rank')
const sortDir = ref<MatchupEntriesSortDir>('asc')

const showFilters = computed(() => props.showFilters ?? props.mode === 'edit')
const emptyColspan = computed(() => (props.mode === 'edit' ? 11 : 10))

const sourceEntries = computed(() => {
  if (props.entries != null) return props.entries
  return matchupEntries.value
})

const resolvedBuild = computed(() => {
  if (props.build) return props.build
  if (props.mode === 'edit' || matchupEntries.value.length > 0) {
    return buildStore.currentBuild
  }
  return null
})

const activeFiltersCount = computed(() => countActiveMatchupEntriesFilters(filters.value))

const displayRows = computed(() =>
  filterAndSortMatchupEntries({
    entries: sourceEntries.value,
    filters: filters.value,
    sortKey: sortKey.value,
    sortDir: sortDir.value,
    build: resolvedBuild.value,
    t,
  })
)

type BuildPopoverState = {
  variantIndex: number | null
  top: number
  left: number
}

const buildPopover = ref<BuildPopoverState | null>(null)
const expandedMobileOpponentIds = ref<Record<string, true>>({})
let hidePopoverTimer: ReturnType<typeof setTimeout> | null = null

const buildPopoverStyle = computed(() => {
  if (!buildPopover.value) return {}
  return {
    top: `${buildPopover.value.top}px`,
    left: `${buildPopover.value.left}px`,
  }
})

function resetFilters(): void {
  filters.value = createEmptyMatchupEntriesFilters()
}

function toggleSort(key: MatchupEntriesSortKey): void {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDir.value = key === 'rank' ? 'asc' : 'desc'
}

function sortIcon(key: MatchupEntriesSortKey): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ↑' : ' ↓'
}

function cohortUi(opponentId: string) {
  if (props.mode === 'readonly') {
    return {
      inCohort: false,
      inActive: false,
      soloSelected: false,
      color: undefined as string | undefined,
    }
  }
  const colors = opponentCohortColors.value
  const color = colors[opponentId]
  const inCohort = opponentHasVisibleCohortColor(colors, opponentId)
  const soloSelected = soloSelectedOpponentIds.value.includes(opponentId)
  const inActive = soloSelected || color === activeCohortColor.value
  return { inCohort, inActive, soloSelected, color }
}

function rowClass(opponentId: string): Record<string, boolean> {
  const ui = cohortUi(opponentId)
  return {
    'matchup-entries-table__row--active': ui.inActive,
    'matchup-entries-table__row--preview': previewOpponentId.value === opponentId,
    'matchup-entries-table__row--cohort': ui.inCohort,
  }
}

function rowStyle(opponentId: string): Record<string, string> | undefined {
  const ui = cohortUi(opponentId)
  if (!ui.inCohort || !ui.color) return undefined
  return { '--cohort-color': ui.color }
}

function toggleCohort(opponentId: string): void {
  draftStore.toggleSelectedOpponent(opponentId)
}

function openPreview(opponentId: string): void {
  draftStore.setPreviewOpponent(opponentId)
}

function toggleMobileExpanded(opponentId: string): void {
  const next = { ...expandedMobileOpponentIds.value }
  if (next[opponentId]) {
    delete next[opponentId]
  } else {
    next[opponentId] = true
  }
  expandedMobileOpponentIds.value = next
}

function isFinalizeReady(entry: MatchupEntry): boolean {
  return isMatchupEntryFinalizeReady(entry)
}

function variantIndexForEntry(entry: MatchupEntry): number | null {
  const picks = getMatchupBuildVariants(entry)
  if (!picks.length) return null
  const variant = picks[0].variant
  return variant === 'main' ? null : variant
}

function showBuildPopover(entry: MatchupEntry, event: MouseEvent): void {
  if (!resolvedBuild.value || !getMatchupBuildVariants(entry).length) return
  cancelHideBuildPopover()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const popoverWidth = 300
  let left = rect.left
  if (left + popoverWidth > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - popoverWidth - 12)
  }
  buildPopover.value = {
    variantIndex: variantIndexForEntry(entry),
    top: rect.bottom + 8,
    left,
  }
}

function scheduleHideBuildPopover(): void {
  cancelHideBuildPopover()
  hidePopoverTimer = setTimeout(() => {
    buildPopover.value = null
  }, 120)
}

function cancelHideBuildPopover(): void {
  if (hidePopoverTimer) {
    clearTimeout(hidePopoverTimer)
    hidePopoverTimer = null
  }
}
</script>

<style scoped>
.matchup-entries-table {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.matchup-entries-table__filters {
  overflow: hidden;
}

.matchup-entries-table__filters-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.2);
}

.matchup-entries-table__filters--collapsed .matchup-entries-table__filters-header {
  border-bottom: none;
}

.matchup-entries-table__filters-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: rgb(var(--rgb-text-accent));
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.matchup-entries-table__filters-badge {
  display: inline-flex;
  min-width: 1.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgb(var(--rgb-accent));
  padding: 0 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: rgb(var(--rgb-background));
}

.matchup-entries-table__filters-chevron {
  width: 1rem;
  height: 1rem;
  transition: transform 0.2s ease;
}

.matchup-entries-table__filters-chevron--open {
  transform: rotate(180deg);
}

.matchup-entries-table__filters-reset {
  border: 0;
  background: transparent;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgb(147 197 253);
  cursor: pointer;
}

.matchup-entries-table__filters-reset:hover {
  color: rgb(191 219 254);
}

.matchup-entries-table__filters-body {
  padding: 0.75rem;
}

.matchup-entries-table__filters-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 0.65rem;
}

@media (min-width: 640px) {
  .matchup-entries-table__filters-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .matchup-entries-table__filters-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.matchup-entries-table__filter {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.68rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.7);
}

.matchup-entries-table__filter input,
.matchup-entries-table__filter select {
  width: 100%;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.375rem;
  background: rgb(var(--rgb-background) / 0.45);
  padding: 0.35rem 0.45rem;
  font-size: 0.78rem;
  font-weight: 400;
  color: rgb(var(--rgb-text));
}

.matchup-entries-table__filter-range {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.matchup-entries-table__filter-range input {
  min-width: 0;
  flex: 1;
}

.matchup-entries-table__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.matchup-entries-table__hint {
  margin: 0;
  flex: 1;
  min-width: 12rem;
  font-size: 0.78rem;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-entries-table__mobile {
  display: block;
  width: 100%;
}

.matchup-entries-table__wrap {
  display: none;
  width: 100%;
  border: 1px solid rgb(var(--rgb-primary) / 0.3);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-background) / 0.35);
}

@media (min-width: 768px) {
  .matchup-entries-table__mobile {
    display: none;
  }

  .matchup-entries-table__wrap {
    display: block;
  }
}

.matchup-entries-table__table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.matchup-entries-table__table th,
.matchup-entries-table__table td {
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.2);
  padding: 0.45rem 0.55rem;
  text-align: left;
  vertical-align: middle;
}

.matchup-entries-table__table th {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.7);
  background: rgb(var(--rgb-surface) / 0.35);
}

.matchup-entries-table__sort-btn {
  border: 0;
  background: transparent;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.matchup-entries-table__sort-btn:hover {
  color: rgb(var(--rgb-text-accent));
}

.matchup-entries-table__th-cohort {
  width: 2rem;
}

.matchup-entries-table__rank {
  width: 2.5rem;
  text-align: center;
  font-weight: 700;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-entries-table__cohort-toggle {
  display: inline-flex;
  width: 1.35rem;
  height: 1.35rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.55);
  border-radius: 0.35rem;
  background: rgb(var(--rgb-accent) / 0.12);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1;
  color: rgb(var(--rgb-text-accent));
  cursor: pointer;
}

.matchup-entries-table__cohort-toggle--remove {
  border-color: rgb(248 113 113 / 0.65);
  background: rgb(248 113 113 / 0.12);
  color: rgb(252 165 165);
}

.matchup-entries-table__champion,
.matchup-entries-table__champion-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.matchup-entries-table__champion-btn {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
  color: inherit;
}

.matchup-entries-table__portrait {
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  border-radius: 9999px;
  object-fit: cover;
}

.matchup-entries-table__done {
  color: rgb(74 222 128);
  font-size: 0.75rem;
}

.matchup-entries-table__build-cell {
  max-width: 14rem;
  cursor: default;
}

.matchup-entries-table__phase {
  min-width: 7rem;
  max-width: 14rem;
  white-space: pre-wrap;
  line-height: 1.35;
  font-size: 0.74rem;
  color: rgb(var(--rgb-text) / 0.85);
}

.matchup-entries-table__comments {
  max-width: 20rem;
  white-space: pre-wrap;
  line-height: 1.4;
  color: rgb(var(--rgb-text) / 0.85);
}

.matchup-entries-table__empty {
  padding: 1.25rem !important;
  text-align: center;
  color: rgb(var(--rgb-text) / 0.6);
}

.matchup-entries-table__mobile-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
}

.matchup-entries-table__empty--mobile {
  padding: 1rem;
}

.matchup-entries-table__row--cohort {
  background: color-mix(in srgb, var(--cohort-color, transparent) 10%, transparent);
}

.matchup-entries-table__row--active {
  box-shadow: inset 2px 0 0 rgb(var(--rgb-accent) / 0.75);
}

.matchup-entries-table__row--preview {
  background: rgb(var(--rgb-primary) / 0.12);
}

.matchup-entries-table__build-popover {
  position: fixed;
  z-index: 10040;
  width: 300px;
  pointer-events: auto;
  filter: drop-shadow(0 12px 28px rgb(0 0 0 / 0.45));
}

.matchup-entries-table__build-popover :deep(.build-card-wrapper) {
  --build-card-width: 300px;
}
</style>
