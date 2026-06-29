<template>
  <section v-if="previewEntry" class="matchup-detail-editor">
    <header class="matchup-detail-editor__header">
      <div class="matchup-detail-editor__header-row">
        <div class="matchup-detail-editor__header-start">
          <h3 class="matchup-detail-editor__title">{{ previewEntry.opponent.name }}</h3>
          <p class="matchup-detail-editor__subtitle">
            {{ t('matchupGuideCreate.previewModeHint') }}
          </p>
        </div>
        <p class="matchup-detail-editor__progress">
          {{
            t('matchupGuideCreate.finalizeProgress', {
              ready: finalizeReadyCount,
              total: totalEntries,
            })
          }}
        </p>
      </div>
    </header>
    <MatchupGuideMatchupFilledPreview :entry="previewEntry" />
  </section>

  <section v-else-if="hasSelection" class="matchup-detail-editor">
    <header class="matchup-detail-editor__header">
      <div class="matchup-detail-editor__header-row">
        <div class="matchup-detail-editor__header-start">
          <h3 class="matchup-detail-editor__title">{{ selectionTitle }}</h3>
          <p v-if="isGroupEdit" class="matchup-detail-editor__subtitle">
            {{ t('matchupGuideCreate.groupEditHint') }}
          </p>
        </div>
        <p class="matchup-detail-editor__progress">
          {{
            t('matchupGuideCreate.finalizeProgress', {
              ready: finalizeReadyCount,
              total: totalEntries,
            })
          }}
        </p>
        <div class="matchup-detail-editor__actions">
          <MatchupGuideMatchupCopyPanel :has-selection="hasSelection" />
          <button
            type="button"
            class="matchup-detail-editor__save-button"
            :class="{ 'matchup-detail-editor__save-button--saved': selectionReady }"
            @click="markSaved"
          >
            {{ saveButtonLabel }}
          </button>
        </div>
      </div>
      <p v-if="showValidation" class="matchup-detail-editor__validation-message">
        {{ t('matchupGuideCreate.markSavedMissingFields') }}
      </p>
      <p v-else-if="saveMessage" class="matchup-detail-editor__save-message">{{ saveMessage }}</p>
    </header>

    <div class="matchup-detail-editor__sections">
      <div
        class="matchup-detail-editor__section"
        :class="{ 'matchup-detail-editor__section--missing': isFieldMissing('difficulty') }"
      >
        <span class="matchup-detail-editor__label">{{
          t('matchupGuideCreate.fieldDifficulty')
        }}</span>
        <div class="matchup-detail-editor__mode-row">
          <button
            v-for="mode in DIFFICULTY_MODES"
            :key="mode"
            type="button"
            class="matchup-detail-editor__chip"
            :class="{ 'matchup-detail-editor__chip--active': difficultyMode === mode }"
            @click="patch({ difficultyMode: mode })"
          >
            {{ t(`matchupGuideCreate.difficultyMode.${mode}`) }}
          </button>
        </div>
        <div v-if="difficultyMode === 'score'" class="matchup-detail-editor__score-row">
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            :value="difficultyScore ?? 5"
            @input="
              patch({
                difficultyScore: Number(($event.target as HTMLInputElement).value),
                difficultyMode: 'score',
              })
            "
          />
          <span class="matchup-detail-editor__score-value">{{ difficultyScore ?? '—' }}/10</span>
        </div>
        <div v-else class="matchup-detail-editor__chip-row">
          <button
            v-for="band in DIFFICULTY_BANDS"
            :key="band"
            type="button"
            class="matchup-detail-editor__chip"
            :class="{ 'matchup-detail-editor__chip--active': difficultyBand === band }"
            @click="patch({ difficultyBand: band, difficultyMode: 'band' })"
          >
            {{ t(`matchupGuideCreate.difficultyBand.${band}`) }}
          </button>
        </div>
      </div>

      <div class="matchup-detail-editor__section">
        <span class="matchup-detail-editor__label">{{ t('matchupGuideCreate.fieldOutcome') }}</span>
        <div class="matchup-detail-editor__chip-row">
          <button
            v-for="kind in OUTCOME_KINDS"
            :key="kind"
            type="button"
            class="matchup-detail-editor__chip"
            :class="{ 'matchup-detail-editor__chip--active': outcomeKind === kind }"
            @click="patch({ outcomeKind: kind })"
          >
            {{ t(`matchupGuideCreate.outcomeKind.${kind}`) }}
          </button>
        </div>
        <div v-if="outcomeKind === 'skill'" class="matchup-detail-editor__chip-row">
          <span class="matchup-detail-editor__sub-label">{{
            t('matchupGuideCreate.skillFavorLabel')
          }}</span>
          <button
            v-for="favor in SKILL_FAVORS"
            :key="favor"
            type="button"
            class="matchup-detail-editor__chip"
            :class="{ 'matchup-detail-editor__chip--active': skillFavor === favor }"
            @click="patch({ skillFavor: favor, outcomeKind: 'skill' })"
          >
            {{ t(`matchupGuideCreate.skillFavor.${favor}`) }}
          </button>
        </div>
      </div>

      <div
        class="matchup-detail-editor__section"
        :class="{ 'matchup-detail-editor__section--missing': isFieldMissing('build') }"
      >
        <span class="matchup-detail-editor__label">{{
          t('matchupGuideCreate.fieldBuildVariant')
        }}</span>
        <MatchupGuideBuildVariantPicker
          :model-value="buildVariants"
          :invalid="isFieldMissing('build')"
          @update:model-value="onBuildVariantsChange"
        />
      </div>

      <div class="matchup-detail-editor__section">
        <MatchupGuidePowerSpikeEditor
          :model-value="powerSpike"
          @update:model-value="onPowerSpikeChange"
        />
      </div>

      <div
        v-for="phase in PHASES"
        :key="phase.id"
        class="matchup-detail-editor__section matchup-detail-editor__phase"
      >
        <span class="matchup-detail-editor__label">{{
          t(`matchupGuideCreate.phase.${phase.id}`)
        }}</span>
        <div class="matchup-detail-editor__chip-row">
          <button
            v-for="tag in PHASE_TAGS"
            :key="`${phase.id}-${tag}`"
            type="button"
            class="matchup-detail-editor__chip matchup-detail-editor__chip--small"
            :class="{ 'matchup-detail-editor__chip--active': hasPhaseTag(phase.id, tag) }"
            @click="togglePhaseTag(phase.id, tag)"
          >
            {{ t(`matchupGuideCreate.phaseTag.${tag}`) }}
          </button>
        </div>
        <textarea
          rows="2"
          :value="phaseNotes(phase.id)"
          :placeholder="t('matchupGuideCreate.phaseNotesPlaceholder')"
          @input="setPhaseNotes(phase.id, ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <label
        class="matchup-detail-editor__field"
        :class="{ 'matchup-detail-editor__field--missing': isFieldMissing('comments') }"
      >
        <span>{{ t('matchupGuideCreate.fieldComments') }}</span>
        <textarea
          rows="4"
          :value="comments"
          :placeholder="t('matchupGuideCreate.fieldCommentsPlaceholder')"
          @input="patch({ comments: ($event.target as HTMLTextAreaElement).value || undefined })"
        />
      </label>
    </div>
  </section>

  <section v-else class="matchup-detail-editor matchup-detail-editor--idle">
    <header class="matchup-detail-editor__header">
      <div class="matchup-detail-editor__header-row">
        <div class="matchup-detail-editor__header-start">
          <h3 class="matchup-detail-editor__title">
            {{ t('matchupGuideCreate.cohortColorLabel') }}
          </h3>
          <p class="matchup-detail-editor__subtitle">
            {{ t('matchupGuideCreate.cohortIdleSubtitle') }}
          </p>
        </div>
        <p class="matchup-detail-editor__progress">
          {{
            t('matchupGuideCreate.finalizeProgress', {
              ready: finalizeReadyCount,
              total: totalEntries,
            })
          }}
        </p>
      </div>
    </header>
    <div class="matchup-detail-editor__idle-cohort">
      <span
        class="matchup-detail-editor__idle-swatch"
        :style="{ backgroundColor: activeCohortColor }"
        aria-hidden="true"
      />
      <p>{{ t('matchupGuideCreate.cohortEmptyHint') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type {
  MatchupBuildVariantPick,
  MatchupEntry,
  MatchupPhaseNotes,
  MatchupPhaseTag,
  MatchupPowerSpike,
} from '@lelanation/shared-types'
import MatchupGuideBuildVariantPicker from '~/components/matchups/MatchupGuideBuildVariantPicker.vue'
import MatchupGuideMatchupCopyPanel from '~/components/matchups/MatchupGuideMatchupCopyPanel.vue'
import MatchupGuideMatchupFilledPreview from '~/components/matchups/MatchupGuideMatchupFilledPreview.vue'
import MatchupGuidePowerSpikeEditor from '~/components/matchups/MatchupGuidePowerSpikeEditor.vue'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import {
  countMatchupsFinalizeReady,
  getMissingRequiredFieldsForEntries,
  isMatchupEntryFinalizeReady,
  type MatchupRequiredFieldKey,
} from '~/utils/matchupGuideCreateSteps'
import {
  DIFFICULTY_BANDS,
  DIFFICULTY_MODES,
  OUTCOME_KINDS,
  PHASE_TAGS,
  SKILL_FAVORS,
} from '~/utils/matchupEntryUtils'

const PHASES = [{ id: 'early' as const }, { id: 'mid' as const }, { id: 'late' as const }]

const { t } = useI18n()
const draftStore = useMatchupGuideDraftStore()
const { activeCohortColor, previewOpponentId } = storeToRefs(draftStore)
const saveMessage = ref('')
const showValidation = ref(false)

const selectedEntries = computed(() => draftStore.selectedEntries)
const previewEntry = computed(() => {
  const id = previewOpponentId.value
  if (!id) return null
  return draftStore.matchupEntries.find(entry => entry.opponent.id === id) ?? null
})
const hasSelection = computed(() => selectedEntries.value.length > 0)
const isGroupEdit = computed(() => selectedEntries.value.length > 1)
const savedIds = computed(() => draftStore.savedOpponentIdSet)
const totalEntries = computed(() => draftStore.matchupEntries.length)
const finalizeReadyCount = computed(() => countMatchupsFinalizeReady(draftStore.matchupEntries))

const selectionReady = computed(
  () =>
    selectedEntries.value.length > 0 &&
    selectedEntries.value.every(entry => isMatchupEntryFinalizeReady(entry))
)

const missingRequiredFields = computed(() =>
  getMissingRequiredFieldsForEntries(selectedEntries.value)
)

const allSelectedSaved = computed(() =>
  selectedEntries.value.every(entry => savedIds.value.has(entry.opponent.id))
)

const saveButtonLabel = computed(() =>
  allSelectedSaved.value && !draftStore.allMatchupsSaved
    ? t('matchupGuideCreate.markSavedNext')
    : t('matchupGuideCreate.markSaved')
)

watch(selectedEntries, () => {
  saveMessage.value = ''
  showValidation.value = false
})

watch(missingRequiredFields, fields => {
  if (fields.size === 0) {
    showValidation.value = false
  }
})

const selectionTitle = computed(() => {
  const entries = selectedEntries.value
  if (entries.length === 0) return ''
  if (entries.length === 1) return entries[0].opponent.name
  return t('matchupGuideCreate.groupSelectionTitle', { count: entries.length })
})

function isFieldMissing(field: MatchupRequiredFieldKey): boolean {
  return showValidation.value && missingRequiredFields.value.has(field)
}

function commonValue<K extends keyof MatchupEntry>(key: K): MatchupEntry[K] | undefined {
  const entries = selectedEntries.value
  if (!entries.length) return undefined
  const first = entries[0][key]
  return entries.every(entry => entry[key] === first) ? first : undefined
}

function commonObjectValue<T>(getter: (entry: MatchupEntry) => T | undefined): T | undefined {
  const entries = selectedEntries.value
  if (!entries.length) return undefined
  const first = getter(entries[0])
  const key = JSON.stringify(first ?? null)
  return entries.every(entry => JSON.stringify(getter(entry) ?? null) === key) ? first : undefined
}

const difficultyMode = computed(() => commonValue('difficultyMode') ?? 'score')
const difficultyScore = computed(() => commonValue('difficultyScore'))
const difficultyBand = computed(() => commonValue('difficultyBand'))
const outcomeKind = computed(() => commonValue('outcomeKind'))
const skillFavor = computed(() => commonValue('skillFavor'))
const comments = computed(() => commonValue('comments') ?? '')
const buildVariants = computed(() => commonObjectValue(entry => entry.buildVariants))
const powerSpike = computed(() => commonObjectValue(entry => entry.powerSpike))

function patch(partial: Partial<Omit<MatchupEntry, 'opponent'>>) {
  draftStore.updateSelectedMatchupEntries(partial)
}

function onBuildVariantsChange(value: MatchupBuildVariantPick[] | undefined) {
  patch({ buildVariants: value, buildVariant: undefined })
}

function onPowerSpikeChange(value: MatchupPowerSpike | undefined) {
  patch({ powerSpike: value })
}

function phaseNotes(phase: 'early' | 'mid' | 'late'): string {
  return commonValue(phase)?.notes ?? ''
}

function hasPhaseTag(phase: 'early' | 'mid' | 'late', tag: MatchupPhaseTag): boolean {
  const tags = commonValue(phase)?.tags
  return Boolean(tags?.includes(tag))
}

function togglePhaseTag(phase: 'early' | 'mid' | 'late', tag: MatchupPhaseTag) {
  const current = commonValue(phase) ?? {}
  const tags = new Set(current.tags ?? [])
  if (tags.has(tag)) tags.delete(tag)
  else tags.add(tag)
  const next: MatchupPhaseNotes = {
    ...current,
    tags: [...tags],
  }
  patch({ [phase]: next.tags.length || next.notes ? next : undefined })
}

function setPhaseNotes(phase: 'early' | 'mid' | 'late', notes: string) {
  const current = commonValue(phase) ?? {}
  const next: MatchupPhaseNotes = {
    ...current,
    notes: notes.trim() || undefined,
  }
  patch({ [phase]: next.tags?.length || next.notes ? next : undefined })
}

function markSaved() {
  saveMessage.value = ''

  if (!selectionReady.value) {
    showValidation.value = true
    return
  }

  showValidation.value = false
  const result = draftStore.markSelectedAsSaved()
  if (result === 'none') return
  if (result === 'all_done') {
    saveMessage.value = t('matchupGuideCreate.markSavedAllDone')
    return
  }
  saveMessage.value =
    result === 'saved'
      ? t('matchupGuideCreate.markSavedSuccess')
      : t('matchupGuideCreate.markSavedNextSuccess')
}
</script>

<style scoped>
.matchup-detail-editor {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-background) / 0.35);
  padding: 0.85rem;
}

.matchup-detail-editor__header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.matchup-detail-editor__header-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
}

.matchup-detail-editor__header-start {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.15rem;
  justify-self: start;
}

.matchup-detail-editor__actions {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
  gap: 0.4rem;
}

.matchup-detail-editor__save-button {
  border: 1px solid rgb(var(--rgb-primary) / 0.45);
  border-radius: 0.45rem;
  background: rgb(var(--rgb-background) / 0.45);
  padding: 0.38rem 0.65rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: rgb(var(--rgb-text));
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.matchup-detail-editor__save-button--saved {
  border-color: rgb(74 222 128 / 0.75);
  background: rgb(74 222 128 / 0.22);
  color: rgb(187 247 208);
}

.matchup-detail-editor__save-button--saved:hover {
  border-color: rgb(74 222 128 / 0.95);
  background: rgb(74 222 128 / 0.32);
}

.matchup-detail-editor__cohort-button {
  border: 1px solid rgb(var(--rgb-accent) / 0.55);
  border-radius: 0.45rem;
  background: rgb(var(--rgb-accent) / 0.12);
  padding: 0.38rem 0.65rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: rgb(var(--rgb-text-accent));
  cursor: pointer;
  white-space: nowrap;
}

.matchup-detail-editor__progress {
  margin: 0;
  justify-self: center;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgb(74 222 128);
  white-space: nowrap;
}

.matchup-detail-editor__validation-message {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 600;
  color: rgb(248 113 113);
}

.matchup-detail-editor__save-message {
  margin: 0;
  font-size: 0.68rem;
  color: rgb(74 222 128);
}

.matchup-detail-editor__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: rgb(var(--rgb-text-accent));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.matchup-detail-editor__subtitle {
  margin: 0;
  font-size: 0.72rem;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-detail-editor__section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  border-radius: 0.5rem;
  padding: 0.15rem;
  transition: box-shadow 0.2s ease;
}

.matchup-detail-editor__section--missing {
  box-shadow: inset 0 0 0 1px rgb(248 113 113 / 0.75);
  background: rgb(248 113 113 / 0.06);
}

.matchup-detail-editor__section--missing .matchup-detail-editor__label {
  color: rgb(248 113 113);
}

.matchup-detail-editor__field--missing > span:first-child {
  color: rgb(248 113 113);
}

.matchup-detail-editor__field--missing textarea {
  border-color: rgb(248 113 113 / 0.85);
  box-shadow: 0 0 0 1px rgb(248 113 113 / 0.25);
}

.matchup-detail-editor__label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.75);
}

.matchup-detail-editor__sub-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.6);
}

.matchup-detail-editor__mode-row,
.matchup-detail-editor__chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.matchup-detail-editor__chip {
  border: 1px solid rgb(var(--rgb-accent) / 0.45);
  border-radius: 9999px;
  background: rgb(var(--rgb-background) / 0.35);
  padding: 0.25rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgb(var(--rgb-text));
  cursor: pointer;
}

.matchup-detail-editor__chip--small {
  font-size: 0.68rem;
  padding: 0.2rem 0.45rem;
}

.matchup-detail-editor__chip--active {
  border-color: rgb(var(--rgb-accent));
  background: rgb(var(--rgb-accent) / 0.2);
  color: rgb(var(--rgb-text-accent));
}

.matchup-detail-editor__score-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.matchup-detail-editor__score-row input[type='range'] {
  flex: 1;
}

.matchup-detail-editor__score-value {
  min-width: 2.5rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.matchup-detail-editor__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.75);
  border-radius: 0.5rem;
  padding: 0.15rem;
  transition: box-shadow 0.2s ease;
}

.matchup-detail-editor__field--missing {
  box-shadow: inset 0 0 0 1px rgb(248 113 113 / 0.75);
  background: rgb(248 113 113 / 0.06);
}

.matchup-detail-editor__field input,
.matchup-detail-editor__field select,
.matchup-detail-editor__field textarea,
.matchup-detail-editor__phase textarea {
  width: 100%;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.4rem;
  background: rgb(var(--rgb-surface) / 0.6);
  padding: 0.4rem 0.5rem;
  font-size: 0.82rem;
  font-weight: 400;
  color: rgb(var(--rgb-text));
}

.matchup-detail-editor__field textarea,
.matchup-detail-editor__phase textarea {
  resize: vertical;
}

.matchup-detail-editor__empty {
  margin: 0;
  padding: 1.25rem 0.75rem;
  text-align: center;
  font-size: 0.82rem;
  color: rgb(var(--rgb-text) / 0.6);
  border: 1px dashed rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.75rem;
}

.matchup-detail-editor--idle {
  min-height: 12rem;
}

.matchup-detail-editor__idle-cohort {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px dashed rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.55rem;
  padding: 1rem 0.85rem;
}

.matchup-detail-editor__idle-swatch {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  border-radius: 9999px;
  box-shadow:
    0 0 0 2px rgb(var(--rgb-background)),
    0 0 0 3px rgb(var(--rgb-text) / 0.2);
}

.matchup-detail-editor__idle-cohort p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.72);
}

@media (min-width: 1280px) {
  .matchup-detail-editor__sections {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem 1.25rem;
  }
}
</style>
