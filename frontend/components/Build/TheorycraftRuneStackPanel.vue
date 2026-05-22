<template>
  <div
    v-if="isTheorycraft && showPanel"
    class="theorycraft-rune-panel"
    :class="{ 'theorycraft-rune-panel--header': variant === 'header' }"
  >
    <p v-if="variant !== 'header'" class="theorycraft-rune-panel__title">
      {{ t('theorycraft.runes.stacksTitle') }}
    </p>

    <label v-if="usesGameDuration" class="theorycraft-rune-panel__duration">
      <span>{{ t('theorycraft.runes.gameDuration') }}</span>
      <input
        type="number"
        min="0"
        max="90"
        class="theorycraft-rune-panel__duration-input"
        :value="buildStore.theorycraftGameDurationMinutes"
        @input="onDurationInput"
      />
      <span class="theorycraft-rune-panel__duration-unit">{{
        t('theorycraft.runes.minutes')
      }}</span>
    </label>

    <div v-if="stackableRunes.length > 0" class="theorycraft-rune-panel__stacks">
      <TheorycraftRuneStackControls
        v-for="entry in stackableRunes"
        :key="entry.runeId"
        :rune-id="entry.runeId"
        :label="runeLabel(entry.runeId)"
      />
    </div>
    <p v-else-if="variant !== 'header' && !usesGameDuration" class="theorycraft-rune-panel__empty">
      {{ t('theorycraft.runes.noStackableRunes') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import { useRunesStore } from '~/stores/RunesStore'
import TheorycraftRuneStackControls from '~/components/Build/TheorycraftRuneStackControls.vue'
import {
  listSelectedRuneIds,
  runeSelectionUsesGameDuration,
  selectedTheorycraftStackableRunes,
} from '~/utils/theorycraftRuneModifiers'

const props = withDefaults(
  defineProps<{
    variant?: 'panel' | 'header'
  }>(),
  { variant: 'panel' }
)

const { t } = useI18n()
const buildStore = useBuildStore()
const runesStore = useRunesStore()

const isTheorycraft = computed(() => buildStore.builderSession === 'theorycraft')

const runes = computed(() => buildStore.displayedBuild?.runes ?? buildStore.currentBuild?.runes)

const stackableRunes = computed(() => selectedTheorycraftStackableRunes(runes.value))

const selectedRuneIds = computed(() => listSelectedRuneIds(runes.value))

const usesGameDuration = computed(() => runeSelectionUsesGameDuration(selectedRuneIds.value))

const showPanel = computed(
  () => usesGameDuration.value || stackableRunes.value.length > 0 || props.variant !== 'header'
)

function runeLabel(runeId: number): string {
  for (const path of runesStore.runePaths) {
    for (const slot of path.slots ?? []) {
      const rune = slot.runes?.find(r => r.id === runeId)
      if (rune?.name) return rune.name
    }
  }
  return String(runeId)
}

function onDurationInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  buildStore.setTheorycraftGameDurationMinutes(value)
}
</script>

<style scoped>
.theorycraft-rune-panel {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgb(200 155 60 / 0.25);
}

.theorycraft-rune-panel--header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-top: 0;
  padding-top: 0;
  border-top: none;
  flex: 1;
  min-width: 0;
}

.theorycraft-rune-panel__title {
  margin: 0 0 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-accent, #c89b3c);
}

.theorycraft-rune-panel--header .theorycraft-rune-panel__title {
  margin: 0;
  width: 100%;
}

.theorycraft-rune-panel__duration {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
  font-size: 0.7rem;
  color: rgb(255 255 255 / 0.85);
}

.theorycraft-rune-panel--header .theorycraft-rune-panel__duration {
  margin-bottom: 0;
  height: 38px;
  padding: 0 0.65rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(200 155 60 / 0.35);
  background: var(--color-background, #0a1428);
}

.theorycraft-rune-panel__duration-input {
  width: 3rem;
  height: 1.4em;
  border-radius: 0.2em;
  border: 1px solid rgb(200 155 60 / 0.45);
  background: rgb(10 20 40 / 0.95);
  padding: 0 0.35em;
  font-size: inherit;
  font-weight: 600;
  text-align: center;
  color: rgb(255 255 255 / 0.9);
}

.theorycraft-rune-panel--header .theorycraft-rune-panel__duration-input {
  height: 26px;
}

.theorycraft-rune-panel__duration-unit {
  color: rgb(255 255 255 / 0.55);
}

.theorycraft-rune-panel__stacks {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.theorycraft-rune-panel--header .theorycraft-rune-panel__stacks {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.theorycraft-rune-panel__empty {
  margin: 0;
  font-size: 0.65rem;
  color: rgb(255 255 255 / 0.5);
}

.theorycraft-rune-panel--header :deep(.theorycraft-rune-stack) {
  height: 38px;
  padding: 0 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(200 155 60 / 0.35);
  background: var(--color-background, #0a1428);
}
</style>
