<template>
  <div class="matchup-target-selector">
    <MatchupGuideCohortColorPicker />

    <p class="matchup-target-selector__hint">
      {{ t('matchupGuideCreate.pickMatchupTargetsHint') }}
    </p>

    <div class="matchup-target-selector__list">
      <div
        v-for="(entry, index) in entries"
        :key="entry.opponent.id"
        class="matchup-target-selector__item"
        :class="{
          'matchup-target-selector__item--in-cohort': cohortUi(entry.opponent.id).inCohort,
          'matchup-target-selector__item--active-cohort':
            cohortUi(entry.opponent.id).inCohort && cohortUi(entry.opponent.id).inActive,
          'matchup-target-selector__item--solo-selected': cohortUi(entry.opponent.id).soloSelected,
          'matchup-target-selector__item--preview': isPreview(entry.opponent.id),
        }"
        :style="cohortUi(entry.opponent.id).style"
      >
        <button
          type="button"
          class="matchup-target-selector__toggle"
          :class="{
            'matchup-target-selector__toggle--remove': cohortUi(entry.opponent.id).inActive,
          }"
          :title="
            cohortUi(entry.opponent.id).inActive
              ? t('matchupGuideCreate.removeFromCohort')
              : t('matchupGuideCreate.addToCohort')
          "
          :aria-label="
            cohortUi(entry.opponent.id).inActive
              ? t('matchupGuideCreate.removeFromCohortFor', { name: entry.opponent.name })
              : t('matchupGuideCreate.addToCohortFor', { name: entry.opponent.name })
          "
          @click.stop="toggleCohort(entry.opponent.id)"
        >
          {{ cohortUi(entry.opponent.id).inActive ? '−' : '+' }}
        </button>
        <span class="matchup-target-selector__rank">{{ index + 1 }}</span>
        <button
          type="button"
          class="matchup-target-selector__body"
          @click="openPreview(entry.opponent.id)"
        >
          <img
            :src="getChampionImageUrl(version, entry.opponent.image.full)"
            :alt="entry.opponent.name"
            class="matchup-target-selector__portrait"
          />
          <span class="matchup-target-selector__name">{{ entry.opponent.name }}</span>
          <span v-if="isFinalizeReady(entry)" class="matchup-target-selector__done">✓</span>
          <span
            v-else-if="hasPartialContent(entry)"
            class="matchup-target-selector__draft"
            aria-hidden="true"
          >
            •
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { MatchupEntry } from '@lelanation/shared-types'
import MatchupGuideCohortColorPicker from '~/components/matchups/MatchupGuideCohortColorPicker.vue'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'
import { isMatchupEntryFinalizeReady } from '~/utils/matchupGuideCreateSteps'
import { opponentHasVisibleCohortColor } from '~/utils/matchupGuideCohorts'

type CohortUiState = {
  inCohort: boolean
  inActive: boolean
  soloSelected: boolean
  style?: Record<string, string>
}

const { t } = useI18n()
const draftStore = useMatchupGuideDraftStore()
const {
  matchupEntries,
  opponentCohortColors,
  activeCohortColor,
  soloSelectedOpponentIds,
  previewOpponentId,
} = storeToRefs(draftStore)
const { version } = useGameVersion()

const entries = computed(() => matchupEntries.value)

const cohortUiByOpponentId = computed(() => {
  const colors = opponentCohortColors.value
  const active = activeCohortColor.value
  const solos = new Set(soloSelectedOpponentIds.value)
  const next: Record<string, CohortUiState> = {}

  for (const entry of matchupEntries.value) {
    const opponentId = entry.opponent.id
    const color = colors[opponentId]
    const inCohort = opponentHasVisibleCohortColor(colors, opponentId)
    const soloSelected = solos.has(opponentId)
    const inActive = soloSelected || color === active

    next[opponentId] = {
      inCohort,
      inActive,
      soloSelected: soloSelected && !inCohort,
      style: inCohort
        ? {
            '--cohort-color': color,
            borderColor: color,
            borderWidth: '2px',
          }
        : undefined,
    }
  }

  return next
})

function cohortUi(opponentId: string): CohortUiState {
  return (
    cohortUiByOpponentId.value[opponentId] ?? {
      inCohort: false,
      inActive: false,
      soloSelected: false,
    }
  )
}

function isPreview(opponentId: string): boolean {
  return previewOpponentId.value === opponentId
}

function toggleCohort(opponentId: string) {
  draftStore.toggleSelectedOpponent(opponentId)
}

function openPreview(opponentId: string) {
  draftStore.setPreviewOpponent(opponentId)
}

function isFinalizeReady(entry: MatchupEntry): boolean {
  return isMatchupEntryFinalizeReady(entry)
}

function hasPartialContent(entry: MatchupEntry): boolean {
  return (
    !isFinalizeReady(entry) &&
    (Boolean(entry.comments?.trim()) ||
      entry.difficultyBand !== undefined ||
      entry.difficultyScore !== undefined ||
      Boolean(entry.buildVariants?.length) ||
      entry.buildVariant !== undefined)
  )
}
</script>

<style scoped>
.matchup-target-selector__hint {
  margin: 0 0 0.75rem;
  font-size: 0.78rem;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-target-selector__list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: min(70vh, 640px);
  overflow-y: auto;
}

.matchup-target-selector__item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-background) / 0.35);
  padding: 0.25rem 0.35rem 0.25rem 0.25rem;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}

.matchup-target-selector__item--in-cohort {
  background: color-mix(in srgb, var(--cohort-color) 14%, rgb(var(--rgb-background) / 0.35));
}

.matchup-target-selector__item--active-cohort {
  box-shadow: inset 0 0 0 1px var(--cohort-color);
}

.matchup-target-selector__item--solo-selected {
  box-shadow: inset 0 0 0 1px rgb(var(--rgb-accent) / 0.55);
}

.matchup-target-selector__item--preview {
  box-shadow:
    inset 0 0 0 1px rgb(var(--rgb-text-accent) / 0.55),
    0 0 0 1px rgb(var(--rgb-text-accent) / 0.25);
}

.matchup-target-selector__toggle {
  display: inline-flex;
  width: 1.35rem;
  height: 1.35rem;
  flex-shrink: 0;
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

.matchup-target-selector__toggle--remove {
  border-color: rgb(248 113 113 / 0.65);
  background: rgb(248 113 113 / 0.12);
  color: rgb(252 165 165);
}

.matchup-target-selector__rank {
  width: 1.1rem;
  flex-shrink: 0;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-target-selector__body {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 0.45rem;
  border: 0;
  background: transparent;
  padding: 0.1rem 0.15rem;
  cursor: pointer;
  text-align: left;
}

.matchup-target-selector__portrait {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 9999px;
  object-fit: cover;
}

.matchup-target-selector__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 600;
  color: rgb(var(--rgb-text));
}

.matchup-target-selector__done {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: rgb(74 222 128);
}

.matchup-target-selector__draft {
  flex-shrink: 0;
  font-size: 0.85rem;
  line-height: 1;
  color: rgb(var(--rgb-accent));
}
</style>
