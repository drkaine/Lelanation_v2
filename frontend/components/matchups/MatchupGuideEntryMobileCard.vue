<template>
  <article
    class="matchup-guide-entry-mobile-card w-full overflow-hidden rounded-lg border bg-surface/40"
    :class="[cardBorderClass, { 'matchup-guide-entry-mobile-card--preview': preview }]"
    :style="cohortColor ? { '--cohort-color': cohortColor } : undefined"
  >
    <div
      class="matchup-guide-entry-mobile-card__header flex w-full min-w-0 items-center gap-2.5 p-3"
    >
      <button
        v-if="mode === 'edit'"
        type="button"
        class="matchup-guide-entry-mobile-card__cohort"
        :class="{
          'matchup-guide-entry-mobile-card__cohort--remove': cohortInActive,
        }"
        :title="cohortInActive ? removeCohortLabel : addCohortLabel"
        @click.stop="emit('toggle-cohort')"
      >
        {{ cohortInActive ? '−' : '+' }}
      </button>

      <div class="matchup-guide-entry-mobile-card__main flex min-w-0 flex-1 items-center gap-2.5">
        <span class="matchup-guide-entry-mobile-card__rank">{{ rank }}</span>
        <button
          type="button"
          class="matchup-guide-entry-mobile-card__champion flex min-w-0 flex-1 touch-manipulation items-center gap-2 text-left"
          @click="onChampionClick"
        >
          <img
            :src="portraitSrc"
            :alt="entry.opponent.name"
            class="matchup-guide-entry-mobile-card__portrait"
          />
          <div class="min-w-0 flex-1">
            <div class="matchup-guide-entry-mobile-card__name">
              {{ entry.opponent.name }}
              <span v-if="finalizeReady" class="matchup-guide-entry-mobile-card__done">✓</span>
            </div>
          </div>
        </button>
        <button
          type="button"
          class="matchup-guide-entry-mobile-card__expand flex shrink-0 touch-manipulation items-center gap-1 text-right"
          :aria-expanded="expanded"
          @click="emit('toggle')"
        >
          <div class="matchup-guide-entry-mobile-card__metrics text-right">
            <div class="matchup-guide-entry-mobile-card__metric">
              <div class="matchup-guide-entry-mobile-card__metric-label">
                {{ t('matchupGuideCreate.entriesTable.colDifficulty') }}
              </div>
              <div class="matchup-guide-entry-mobile-card__metric-value">
                {{ difficultyLabel }}
              </div>
            </div>
            <div class="matchup-guide-entry-mobile-card__metric">
              <div class="matchup-guide-entry-mobile-card__metric-label">
                {{ t('matchupGuideCreate.entriesTable.colOutcome') }}
              </div>
              <div class="matchup-guide-entry-mobile-card__metric-value">
                {{ outcomeLabel }}
              </div>
            </div>
          </div>
          <svg
            class="matchup-guide-entry-mobile-card__chevron shrink-0"
            :class="{ 'matchup-guide-entry-mobile-card__chevron--open': expanded }"
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
      </div>
    </div>

    <div
      v-if="expanded"
      class="matchup-guide-entry-mobile-card__body space-y-2 border-t border-primary/20 bg-black/20 px-3 py-2.5 text-sm text-text/85"
    >
      <div class="matchup-guide-entry-mobile-card__row">
        <span>{{ t('matchupGuideCreate.entriesTable.colBuild') }}</span>
        <span class="matchup-guide-entry-mobile-card__value">{{ buildLabel }}</span>
      </div>
      <div class="matchup-guide-entry-mobile-card__row">
        <span>{{ t('matchupGuideCreate.entriesTable.colPowerSpike') }}</span>
        <span class="matchup-guide-entry-mobile-card__value">{{ powerSpikeLabel }}</span>
      </div>
      <div class="matchup-guide-entry-mobile-card__row">
        <span>{{ t('matchupGuideCreate.entriesTable.colEarly') }}</span>
        <span class="matchup-guide-entry-mobile-card__value">{{ earlyLabel }}</span>
      </div>
      <div class="matchup-guide-entry-mobile-card__row">
        <span>{{ t('matchupGuideCreate.entriesTable.colMid') }}</span>
        <span class="matchup-guide-entry-mobile-card__value">{{ midLabel }}</span>
      </div>
      <div class="matchup-guide-entry-mobile-card__row">
        <span>{{ t('matchupGuideCreate.entriesTable.colLate') }}</span>
        <span class="matchup-guide-entry-mobile-card__value">{{ lateLabel }}</span>
      </div>
      <div
        class="matchup-guide-entry-mobile-card__row matchup-guide-entry-mobile-card__row--comments"
      >
        <span>{{ t('matchupGuideCreate.entriesTable.colComments') }}</span>
        <span class="matchup-guide-entry-mobile-card__value">{{ commentsLabel }}</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchupEntry } from '@lelanation/shared-types'
import type { Build } from '~/types/build'
import {
  formatBuildVariantsCell,
  formatMatchupDifficulty,
  formatMatchupOutcome,
  formatPhaseCell,
  formatPowerSpikeCell,
} from '~/utils/matchupEntryUtils'
import { isMatchupEntryFinalizeReady } from '~/utils/matchupGuideCreateSteps'

const props = withDefaults(
  defineProps<{
    entry: MatchupEntry
    rank: number
    portraitSrc: string
    build: Build | null
    expanded?: boolean
    mode?: 'edit' | 'readonly'
    preview?: boolean
    inCohort?: boolean
    cohortInActive?: boolean
    cohortColor?: string
  }>(),
  {
    expanded: false,
    mode: 'readonly',
    preview: false,
    inCohort: false,
    cohortInActive: false,
    cohortColor: undefined,
  }
)

const emit = defineEmits<{
  toggle: []
  'toggle-cohort': []
  preview: []
}>()

const { t } = useI18n()

const addCohortLabel = computed(() => t('matchupGuideCreate.addToCohort'))
const removeCohortLabel = computed(() => t('matchupGuideCreate.removeFromCohort'))

const finalizeReady = computed(() => isMatchupEntryFinalizeReady(props.entry))

const difficultyLabel = computed(() => formatMatchupDifficulty(props.entry, t))
const outcomeLabel = computed(() => formatMatchupOutcome(props.entry, t))
const buildLabel = computed(() => formatBuildVariantsCell(props.entry, props.build, t))
const powerSpikeLabel = computed(() => formatPowerSpikeCell(props.entry))
const earlyLabel = computed(() => formatPhaseCell(props.entry.early, t))
const midLabel = computed(() => formatPhaseCell(props.entry.mid, t))
const lateLabel = computed(() => formatPhaseCell(props.entry.late, t))
const commentsLabel = computed(() => props.entry.comments?.trim() || '—')

const cardBorderClass = computed(() => {
  if (props.preview) return 'border-primary/60 ring-1 ring-primary/35'
  if (props.inCohort) return 'border-primary/45 matchup-guide-entry-mobile-card--cohort'
  return 'border-primary/30'
})

function onChampionClick() {
  if (props.mode === 'edit') {
    emit('preview')
  }
}
</script>

<style scoped>
.matchup-guide-entry-mobile-card--cohort {
  background: color-mix(in srgb, var(--cohort-color, transparent) 10%, transparent);
}

.matchup-guide-entry-mobile-card__header {
  align-items: stretch;
}

.matchup-guide-entry-mobile-card__cohort {
  flex-shrink: 0;
  align-self: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.35rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  background: rgb(var(--rgb-background) / 0.45);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  color: rgb(var(--rgb-text-accent));
  cursor: pointer;
}

.matchup-guide-entry-mobile-card__cohort--remove {
  border-color: rgb(248 113 113 / 0.45);
  color: rgb(248 113 113);
}

.matchup-guide-entry-mobile-card__main {
  min-width: 0;
}

.matchup-guide-entry-mobile-card__champion,
.matchup-guide-entry-mobile-card__expand {
  border: none;
  background: transparent;
  padding: 0;
  color: inherit;
  cursor: pointer;
}

.matchup-guide-entry-mobile-card__rank {
  flex-shrink: 0;
  width: 1.35rem;
  font-size: 0.82rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--rgb-text) / 0.65);
  text-align: center;
}

.matchup-guide-entry-mobile-card__portrait {
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  object-fit: cover;
}

.matchup-guide-entry-mobile-card__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
  font-weight: 700;
  color: rgb(var(--rgb-text));
}

.matchup-guide-entry-mobile-card__done {
  margin-left: 0.25rem;
  color: rgb(74 222 128);
  font-size: 0.75rem;
}

.matchup-guide-entry-mobile-card__metrics {
  display: grid;
  gap: 0.35rem;
  max-width: 5.5rem;
}

.matchup-guide-entry-mobile-card__metric-label {
  font-size: 9px;
  font-weight: 600;
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(var(--rgb-text) / 0.55);
}

.matchup-guide-entry-mobile-card__metric-value {
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.matchup-guide-entry-mobile-card__chevron {
  width: 1rem;
  height: 1rem;
  color: rgb(var(--rgb-text) / 0.55);
  transition: transform 0.2s ease;
}

.matchup-guide-entry-mobile-card__chevron--open {
  transform: rotate(180deg);
}

.matchup-guide-entry-mobile-card__row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem 0.75rem;
  font-size: 0.8125rem;
}

.matchup-guide-entry-mobile-card__row > span:first-child {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.55);
}

.matchup-guide-entry-mobile-card__value {
  min-width: 0;
  flex: 1 1 auto;
  text-align: right;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.matchup-guide-entry-mobile-card__row--comments .matchup-guide-entry-mobile-card__value {
  text-align: left;
  flex-basis: 100%;
  white-space: pre-wrap;
}
</style>
