<template>
  <div class="matchup-scale">
    <p class="matchup-scale__label matchup-scale__label--best">
      {{ t('matchupGuideDiscovery.bestMatchups') }}
    </p>

    <div class="matchup-scale__track">
      <div
        v-for="(entry, index) in rankedOpponents"
        :key="entry.opponent.id"
        class="matchup-scale__row"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover.prevent
        @drop="onDrop(index)"
      >
        <label class="matchup-scale__rank-label" @click.stop>
          <span class="sr-only">{{
            t('matchupGuideCreate.rankPosition', { name: entry.opponent.name })
          }}</span>
          <input
            type="number"
            class="matchup-scale__rank-input"
            :min="1"
            :max="rankedOpponents.length"
            :value="rankDisplayValue(entry.opponent.id, index)"
            :aria-label="t('matchupGuideCreate.rankPosition', { name: entry.opponent.name })"
            @focus="onRankFocus(entry.opponent.id, index)"
            @input="onRankInput(entry.opponent.id, $event)"
            @keydown.enter.prevent="commitRank(entry.opponent.id)"
            @blur="commitRank(entry.opponent.id)"
            @mousedown.stop
            @click.stop
            @dragstart.stop
          />
        </label>
        <img
          :src="getChampionImageUrl(version, entry.opponent.image.full)"
          :alt="entry.opponent.name"
          class="matchup-scale__portrait"
        />
        <span class="matchup-scale__name">{{ entry.opponent.name }}</span>
        <span v-if="entry.outcome || entry.difficulty" class="matchup-scale__badges">
          <span v-if="entry.outcome" class="matchup-scale__badge">{{ entry.outcome }}</span>
          <span v-if="entry.difficulty" class="matchup-scale__badge matchup-scale__badge--muted">
            {{ entry.difficulty }}
          </span>
        </span>
        <div class="matchup-scale__actions" @click.stop>
          <button
            type="button"
            class="matchup-scale__move"
            :disabled="index === 0"
            :aria-label="t('matchupGuideCreate.moveUp')"
            @click="draftStore.moveOpponent(index, index - 1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="matchup-scale__move"
            :disabled="index === rankedOpponents.length - 1"
            :aria-label="t('matchupGuideCreate.moveDown')"
            @click="draftStore.moveOpponent(index, index + 1)"
          >
            ↓
          </button>
          <button
            type="button"
            class="matchup-scale__remove"
            :aria-label="t('matchupGuideCreate.removeFromScale')"
            @click="draftStore.removeOpponent(entry.opponent.id)"
          >
            ×
          </button>
        </div>
      </div>

      <p v-if="rankedOpponents.length === 0" class="matchup-scale__empty">
        {{ t('matchupGuideCreate.scaleEmpty') }}
      </p>
    </div>

    <p class="matchup-scale__label matchup-scale__label--worst">
      {{ t('matchupGuideDiscovery.worstMatchups') }}
    </p>

    <p class="matchup-scale__hint">{{ t('matchupGuideCreate.scaleHint') }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const { t } = useI18n()
const draftStore = useMatchupGuideDraftStore()
const { version } = useGameVersion()
const dragIndex = ref<number | null>(null)

const rankedOpponents = computed(() => draftStore.matchupEntries)
const rankDraftById = ref<Record<string, string>>({})
const editingRankId = ref<string | null>(null)

function rankDisplayValue(opponentId: string, index: number): string {
  if (editingRankId.value === opponentId && rankDraftById.value[opponentId] !== undefined) {
    return rankDraftById.value[opponentId]
  }
  return String(index + 1)
}

function onRankFocus(opponentId: string, index: number) {
  editingRankId.value = opponentId
  rankDraftById.value[opponentId] = String(index + 1)
}

function onRankInput(opponentId: string, event: Event) {
  rankDraftById.value[opponentId] = (event.target as HTMLInputElement).value
}

function commitRank(opponentId: string) {
  const raw = rankDraftById.value[opponentId]
  const wasEditing = editingRankId.value === opponentId
  editingRankId.value = null
  delete rankDraftById.value[opponentId]
  if (!wasEditing || raw === undefined) return

  const fromIndex = draftStore.rankedOpponents.findIndex(o => o.id === opponentId)
  if (fromIndex < 0) return

  const parsed = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(parsed)) return
  draftStore.setOpponentRank(fromIndex, parsed)
}

function onDragStart(index: number) {
  dragIndex.value = index
}

function onDrop(targetIndex: number) {
  if (dragIndex.value === null) return
  draftStore.moveOpponent(dragIndex.value, targetIndex)
  dragIndex.value = null
}
</script>

<style scoped>
.matchup-scale {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.matchup-scale__label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  text-align: center;
}

.matchup-scale__label--best {
  color: rgb(74 222 128);
}

.matchup-scale__label--worst {
  color: rgb(248 113 113);
}

.matchup-scale__track {
  display: flex;
  min-height: 280px;
  flex-direction: column;
  gap: 0.35rem;
  border: 2px solid transparent;
  border-radius: 0.75rem;
  background:
    linear-gradient(rgb(var(--rgb-surface)), rgb(var(--rgb-surface))) padding-box,
    linear-gradient(
        180deg,
        rgb(74 222 128 / 0.55) 0%,
        rgb(var(--rgb-text) / 0.2) 50%,
        rgb(248 113 113 / 0.55) 100%
      )
      border-box;
  padding: 0.65rem;
}

.matchup-scale__row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  background: rgb(var(--rgb-background) / 0.35);
  padding: 0.35rem 0.45rem;
  cursor: grab;
}

.matchup-scale__rank-label {
  flex-shrink: 0;
}

.matchup-scale__rank-input {
  width: 2.65rem;
  padding: 0.15rem 0.2rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.4);
  border-radius: 0.35rem;
  background: rgb(var(--rgb-background) / 0.55);
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgb(var(--rgb-text));
  cursor: text;
  -moz-appearance: textfield;
}

.matchup-scale__rank-input::-webkit-outer-spin-button,
.matchup-scale__rank-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.matchup-scale__rank-input:focus {
  outline: none;
  border-color: rgb(var(--rgb-accent) / 0.75);
  box-shadow: 0 0 0 1px rgb(var(--rgb-accent) / 0.35);
}

.matchup-scale__portrait {
  width: 2.4rem;
  height: 2.4rem;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  object-fit: cover;
}

.matchup-scale__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 600;
}

.matchup-scale__badges {
  display: none;
  flex-shrink: 0;
  gap: 0.2rem;
}

@media (min-width: 900px) {
  .matchup-scale__badges {
    display: flex;
  }
}

.matchup-scale__badge {
  max-width: 4.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 9999px;
  background: rgb(74 222 128 / 0.15);
  padding: 0.1rem 0.35rem;
  font-size: 0.62rem;
  font-weight: 700;
  color: rgb(74 222 128);
}

.matchup-scale__badge--muted {
  background: rgb(var(--rgb-text) / 0.12);
  color: rgb(var(--rgb-text) / 0.75);
}

.matchup-scale__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.2rem;
}

.matchup-scale__move,
.matchup-scale__remove {
  display: inline-flex;
  width: 1.6rem;
  height: 1.6rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.45);
  border-radius: 0.35rem;
  background: rgb(var(--rgb-background) / 0.35);
  font-size: 0.75rem;
  color: rgb(var(--rgb-text));
  cursor: pointer;
}

.matchup-scale__move:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.matchup-scale__remove {
  border-color: rgb(248 113 113 / 0.55);
  color: rgb(248 113 113);
}

.matchup-scale__empty {
  margin: auto;
  padding: 1rem;
  text-align: center;
  font-size: 0.82rem;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-scale__hint {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.35;
  color: rgb(var(--rgb-text) / 0.6);
  text-align: center;
}
</style>
