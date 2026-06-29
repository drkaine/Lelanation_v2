<template>
  <section v-if="entry" class="matchup-entry-editor">
    <header class="matchup-entry-editor__header">
      <img
        :src="getChampionImageUrl(version, entry.opponent.image.full)"
        :alt="entry.opponent.name"
        class="matchup-entry-editor__portrait"
      />
      <div>
        <h3 class="matchup-entry-editor__title">{{ entry.opponent.name }}</h3>
        <p class="matchup-entry-editor__subtitle">{{ t('matchupGuideCreate.entryEditorHint') }}</p>
      </div>
      <button
        type="button"
        class="matchup-entry-editor__close"
        :aria-label="t('matchupGuideCreate.closeEntryEditor')"
        @click="draftStore.setSelectedOpponent(null)"
      >
        ×
      </button>
    </header>

    <div class="matchup-entry-editor__fields">
      <label class="matchup-entry-editor__field">
        <span>{{ t('matchupGuideCreate.fieldOutcome') }}</span>
        <input
          :value="entry.outcome ?? ''"
          type="text"
          :placeholder="t('matchupGuideCreate.fieldOutcomePlaceholder')"
          @input="onPatch('outcome', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="matchup-entry-editor__field">
        <span>{{ t('matchupGuideCreate.fieldRunes') }}</span>
        <input
          :value="entry.runes ?? ''"
          type="text"
          :placeholder="t('matchupGuideCreate.fieldRunesPlaceholder')"
          @input="onPatch('runes', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="matchup-entry-editor__field">
        <span>{{ t('matchupGuideCreate.fieldItemPath') }}</span>
        <input
          :value="entry.itemPath ?? ''"
          type="text"
          :placeholder="t('matchupGuideCreate.fieldItemPathPlaceholder')"
          @input="onPatch('itemPath', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="matchup-entry-editor__field">
        <span>{{ t('matchupGuideCreate.fieldDifficulty') }}</span>
        <input
          :value="entry.difficulty ?? ''"
          type="text"
          :placeholder="t('matchupGuideCreate.fieldDifficultyPlaceholder')"
          @input="onPatch('difficulty', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="matchup-entry-editor__field matchup-entry-editor__field--full">
        <span>{{ t('matchupGuideCreate.fieldComments') }}</span>
        <textarea
          :value="entry.comments ?? ''"
          rows="6"
          :placeholder="t('matchupGuideCreate.fieldCommentsPlaceholder')"
          @input="onPatch('comments', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </div>
  </section>

  <p v-else class="matchup-entry-editor__empty">
    {{ t('matchupGuideCreate.selectEntryToEdit') }}
  </p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchupEntry } from '@lelanation/shared-types'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const { t } = useI18n()
const draftStore = useMatchupGuideDraftStore()
const { version } = useGameVersion()

const entry = computed(() => draftStore.selectedEntry)

function onPatch(field: keyof Omit<MatchupEntry, 'opponent'>, value: string) {
  const opponentId = entry.value?.opponent.id
  if (!opponentId) return
  draftStore.updateMatchupEntry(opponentId, { [field]: value || undefined })
}
</script>

<style scoped>
.matchup-entry-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-background) / 0.35);
  padding: 0.75rem;
}

.matchup-entry-editor__header {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}

.matchup-entry-editor__portrait {
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  object-fit: cover;
}

.matchup-entry-editor__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: rgb(var(--rgb-text-accent));
}

.matchup-entry-editor__subtitle {
  margin: 0.15rem 0 0;
  font-size: 0.72rem;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-entry-editor__close {
  margin-left: auto;
  display: inline-flex;
  width: 1.75rem;
  height: 1.75rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.45);
  border-radius: 0.35rem;
  background: transparent;
  font-size: 1.1rem;
  line-height: 1;
  color: rgb(var(--rgb-text));
  cursor: pointer;
}

.matchup-entry-editor__fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.matchup-entry-editor__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.75);
}

.matchup-entry-editor__field--full {
  grid-column: 1 / -1;
}

.matchup-entry-editor__field input,
.matchup-entry-editor__field textarea {
  width: 100%;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.4rem;
  background: rgb(var(--rgb-surface) / 0.6);
  padding: 0.4rem 0.5rem;
  font-size: 0.82rem;
  font-weight: 400;
  color: rgb(var(--rgb-text));
}

.matchup-entry-editor__field textarea {
  resize: vertical;
  min-height: 7rem;
}

.matchup-entry-editor__field input:focus,
.matchup-entry-editor__field textarea:focus {
  outline: none;
  border-color: rgb(var(--rgb-accent) / 0.75);
}

.matchup-entry-editor__empty {
  margin: 0;
  padding: 1.25rem 0.75rem;
  text-align: center;
  font-size: 0.82rem;
  color: rgb(var(--rgb-text) / 0.6);
  border: 1px dashed rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.75rem;
}

@media (max-width: 768px) {
  .matchup-entry-editor__fields {
    grid-template-columns: 1fr;
  }
}
</style>
