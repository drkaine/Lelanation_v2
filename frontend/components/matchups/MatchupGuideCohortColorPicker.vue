<template>
  <div class="cohort-color-picker">
    <span class="cohort-color-picker__label">{{ t('matchupGuideCreate.cohortColorLabel') }}</span>
    <div
      class="cohort-color-picker__swatches"
      role="radiogroup"
      :aria-label="t('matchupGuideCreate.cohortColorLabel')"
    >
      <button
        v-for="option in MATCHUP_COHORT_COLORS"
        :key="option.id"
        type="button"
        class="cohort-color-picker__swatch"
        :class="{ 'cohort-color-picker__swatch--active': option.value === activeCohortColor }"
        :style="{ '--cohort-color': option.value, backgroundColor: option.value }"
        :title="t('matchupGuideCreate.cohortColorOption', { count: memberCount(option.value) })"
        :aria-label="
          t('matchupGuideCreate.cohortColorOption', { count: memberCount(option.value) })
        "
        :aria-checked="option.value === activeCohortColor"
        role="radio"
        @click="draftStore.setActiveCohortColor(option.value)"
      >
        <span v-if="memberCount(option.value) > 0" class="cohort-color-picker__count">
          {{ memberCount(option.value) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { MATCHUP_COHORT_COLORS, realCohortColorMemberCount } from '~/utils/matchupGuideCohorts'

const { t } = useI18n()
const draftStore = useMatchupGuideDraftStore()
const { activeCohortColor, opponentCohortColors } = storeToRefs(draftStore)

const memberCounts = computed(() => {
  const colors = opponentCohortColors.value
  const counts: Record<string, number> = {}
  for (const option of MATCHUP_COHORT_COLORS) {
    counts[option.value] = realCohortColorMemberCount(colors, option.value)
  }
  return counts
})

function memberCount(color: string): number {
  return memberCounts.value[color] ?? 0
}
</script>

<style scoped>
.cohort-color-picker {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 0.75rem;
}

.cohort-color-picker__label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.7);
}

.cohort-color-picker__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.cohort-color-picker__swatch {
  position: relative;
  width: 1.55rem;
  height: 1.55rem;
  border: 2px solid rgb(var(--rgb-background) / 0.85);
  border-radius: 9999px;
  cursor: pointer;
  box-shadow: 0 0 0 1px rgb(var(--rgb-text) / 0.18);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.cohort-color-picker__swatch--active {
  transform: scale(1.08);
  box-shadow:
    0 0 0 2px rgb(var(--rgb-background)),
    0 0 0 4px var(--cohort-color);
}

.cohort-color-picker__count {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.58rem;
  font-weight: 800;
  color: rgb(15 23 42);
  text-shadow: 0 0 2px rgb(255 255 255 / 0.85);
}
</style>
