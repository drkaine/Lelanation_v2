<template>
  <div class="power-spike-editor">
    <span class="power-spike-editor__label">{{ t('matchupGuideCreate.fieldPowerSpike') }}</span>
    <div class="power-spike-editor__levels">
      <button
        v-for="level in maxLevel"
        :key="level"
        type="button"
        class="power-spike-editor__level"
        :class="{ 'power-spike-editor__level--active': selectedLevels.has(level) }"
        @click="toggleLevel(level)"
      >
        {{ level }}
      </button>
    </div>
    <textarea
      rows="2"
      :value="notes"
      :placeholder="t('matchupGuideCreate.powerSpikeNotesPlaceholder')"
      @input="onNotesInput(($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchupPowerSpike } from '@lelanation/shared-types'
import { useBuildStore } from '~/stores/BuildStore'
import { maxChampionLevelForRoles } from '~/utils/theorycraftStats'

const props = defineProps<{
  modelValue: MatchupPowerSpike | undefined
}>()

const emit = defineEmits<{
  'update:modelValue': [value: MatchupPowerSpike | undefined]
}>()

const { t } = useI18n()
const buildStore = useBuildStore()

const maxLevel = computed(() => maxChampionLevelForRoles(buildStore.currentBuild?.roles ?? []))

const selectedLevels = computed(() => new Set(props.modelValue?.levels ?? []))
const notes = computed(() => props.modelValue?.notes ?? '')

function emitNext(levels: number[], nextNotes: string) {
  const sortedLevels = [...new Set(levels)].sort((a, b) => a - b)
  const trimmedNotes = nextNotes.trim()
  if (!sortedLevels.length && !trimmedNotes) {
    emit('update:modelValue', undefined)
    return
  }
  emit('update:modelValue', {
    levels: sortedLevels,
    notes: trimmedNotes || undefined,
  })
}

function toggleLevel(level: number) {
  const levels = new Set(props.modelValue?.levels ?? [])
  if (levels.has(level)) levels.delete(level)
  else levels.add(level)
  emitNext([...levels], notes.value)
}

function onNotesInput(value: string) {
  emitNext([...(props.modelValue?.levels ?? [])], value)
}
</script>

<style scoped>
.power-spike-editor {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.power-spike-editor__label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.75);
}

.power-spike-editor__levels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.power-spike-editor__level {
  min-width: 2rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.45);
  border-radius: 0.35rem;
  background: rgb(var(--rgb-background) / 0.35);
  padding: 0.2rem 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgb(var(--rgb-text));
  cursor: pointer;
}

.power-spike-editor__level--active {
  border-color: rgb(var(--rgb-accent));
  background: rgb(var(--rgb-accent) / 0.22);
  color: rgb(var(--rgb-text-accent));
}

.power-spike-editor textarea {
  width: 100%;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.4rem;
  background: rgb(var(--rgb-surface) / 0.6);
  padding: 0.4rem 0.5rem;
  font-size: 0.82rem;
  font-weight: 400;
  color: rgb(var(--rgb-text));
  resize: vertical;
}
</style>
