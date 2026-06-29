<template>
  <div class="matchup-target-selector">
    <p class="matchup-target-selector__hint">
      {{ t('matchupGuideCreate.pickMatchupTargetsHint') }}
    </p>

    <div class="matchup-target-selector__list">
      <button
        v-for="(entry, index) in entries"
        :key="entry.opponent.id"
        type="button"
        class="matchup-target-selector__item"
        :class="{ 'matchup-target-selector__item--selected': isSelected(entry.opponent.id) }"
        @click="draftStore.toggleSelectedOpponent(entry.opponent.id)"
      >
        <span class="matchup-target-selector__rank">{{ index + 1 }}</span>
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchupEntry } from '@lelanation/shared-types'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'
import { isMatchupEntryFinalizeReady } from '~/utils/matchupGuideCreateSteps'

const { t } = useI18n()
const draftStore = useMatchupGuideDraftStore()
const { version } = useGameVersion()

const entries = computed(() => draftStore.matchupEntries)

function isSelected(opponentId: string): boolean {
  return draftStore.selectedOpponentIds.includes(opponentId)
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
      entry.buildVariants?.length ||
      entry.buildVariant !== undefined)
  )
}
</script>

<style scoped>
.matchup-target-selector__title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 700;
  color: rgb(var(--rgb-text-accent));
}

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
  gap: 0.45rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-background) / 0.35);
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  text-align: left;
}

.matchup-target-selector__item--selected {
  border-color: rgb(var(--rgb-accent) / 0.75);
  background: rgb(var(--rgb-accent) / 0.1);
}

.matchup-target-selector__rank {
  width: 1.25rem;
  flex-shrink: 0;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgb(var(--rgb-text) / 0.65);
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
