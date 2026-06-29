<template>
  <div class="matchup-copy-trigger">
    <button
      type="button"
      class="matchup-copy-trigger__button"
      :disabled="!hasSelection"
      @click="openModal"
    >
      {{ t('matchupGuideCreate.copyFieldsButton') }}
    </button>

    <Teleport to="body">
      <div
        v-if="modalOpen"
        class="matchup-copy-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="t('matchupGuideCreate.copyFieldsTitle')"
        @click.self="closeModal"
      >
        <div class="matchup-copy-modal__panel">
          <header class="matchup-copy-modal__header">
            <h4 class="matchup-copy-modal__title">
              {{ t('matchupGuideCreate.copyFieldsTitle') }}
            </h4>
            <p class="matchup-copy-modal__hint">{{ t('matchupGuideCreate.copyFieldsHint') }}</p>
            <button
              type="button"
              class="matchup-copy-modal__close"
              :aria-label="t('matchupGuideCreate.closeEntryEditor')"
              @click="closeModal"
            >
              ✕
            </button>
          </header>

          <div class="matchup-copy-modal__body">
            <label class="matchup-copy-modal__field">
              <span>{{ t('matchupGuideCreate.copySourceLabel') }}</span>
              <select v-model="sourceOpponentId">
                <option
                  v-for="entry in entries"
                  :key="entry.opponent.id"
                  :value="entry.opponent.id"
                >
                  {{ entry.opponent.name }}
                </option>
              </select>
            </label>

            <div class="matchup-copy-modal__field">
              <div class="matchup-copy-modal__field-row">
                <span>{{ t('matchupGuideCreate.copyFieldsLabel') }}</span>
                <button type="button" class="matchup-copy-modal__link" @click="toggleAllFields">
                  {{
                    allFieldsSelected
                      ? t('matchupGuideCreate.copyFieldsClearAll')
                      : t('matchupGuideCreate.copyFieldsSelectAll')
                  }}
                </button>
              </div>
              <div class="matchup-copy-modal__checks">
                <label
                  v-for="field in MATCHUP_COPY_FIELD_KEYS"
                  :key="field"
                  class="matchup-copy-modal__check"
                >
                  <input v-model="selectedFields" type="checkbox" :value="field" />
                  <span>{{ t(`matchupGuideCreate.copyField.${field}`) }}</span>
                </label>
              </div>
            </div>

            <p class="matchup-copy-modal__targets">
              {{
                targetCount > 0
                  ? t('matchupGuideCreate.copyTargetsSelected', { count: targetCount })
                  : t('matchupGuideCreate.copyNoTargets')
              }}
            </p>

            <p v-if="copyMessage" class="matchup-copy-modal__message">{{ copyMessage }}</p>
          </div>

          <footer class="matchup-copy-modal__footer">
            <button type="button" class="matchup-copy-modal__cancel" @click="closeModal">
              {{ t('matchupGuideCreate.cancel') }}
            </button>
            <button
              type="button"
              class="matchup-copy-modal__apply"
              :disabled="!canApply"
              @click="applyCopy"
            >
              {{ t('matchupGuideCreate.copyFieldsApply') }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { MATCHUP_COPY_FIELD_KEYS, type MatchupCopyFieldKey } from '~/utils/matchupEntryUtils'

defineProps<{
  hasSelection?: boolean
}>()

const { t } = useI18n()
const draftStore = useMatchupGuideDraftStore()

const modalOpen = ref(false)
const sourceOpponentId = ref('')
const selectedFields = ref<MatchupCopyFieldKey[]>([...MATCHUP_COPY_FIELD_KEYS])
const copyMessage = ref('')

const entries = computed(() => draftStore.matchupEntries)
const targetIds = computed(() => draftStore.selectedOpponentIds)
const targetCount = computed(() => targetIds.value.length)

const allFieldsSelected = computed(
  () => selectedFields.value.length === MATCHUP_COPY_FIELD_KEYS.length
)

const canApply = computed(
  () =>
    Boolean(sourceOpponentId.value) &&
    targetCount.value > 0 &&
    selectedFields.value.length > 0 &&
    targetIds.value.some(id => id !== sourceOpponentId.value)
)

watch(
  entries,
  list => {
    if (!list.length) {
      sourceOpponentId.value = ''
      return
    }
    if (!list.some(entry => entry.opponent.id === sourceOpponentId.value)) {
      const firstNonTarget = list.find(entry => !targetIds.value.includes(entry.opponent.id))
      sourceOpponentId.value = firstNonTarget?.opponent.id ?? list[0].opponent.id
    }
  },
  { immediate: true }
)

watch(targetIds, ids => {
  if (ids.length === 1 && ids[0] === sourceOpponentId.value) {
    const fallback = entries.value.find(entry => entry.opponent.id !== ids[0])
    if (fallback) sourceOpponentId.value = fallback.opponent.id
  }
})

function openModal() {
  copyMessage.value = ''
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

function toggleAllFields() {
  selectedFields.value = allFieldsSelected.value ? [] : [...MATCHUP_COPY_FIELD_KEYS]
}

function applyCopy() {
  copyMessage.value = ''
  if (!canApply.value) {
    copyMessage.value = t('matchupGuideCreate.copyFieldsError')
    return
  }

  const ok = draftStore.copyMatchupFieldsToTargets(
    sourceOpponentId.value,
    targetIds.value,
    selectedFields.value
  )

  if (ok) {
    copyMessage.value = t('matchupGuideCreate.copyFieldsSuccess')
    closeModal()
    return
  }

  copyMessage.value = t('matchupGuideCreate.copyFieldsError')
}
</script>

<style scoped>
.matchup-copy-trigger__button {
  border: 1px solid rgb(var(--rgb-primary) / 0.45);
  border-radius: 0.45rem;
  background: rgb(var(--rgb-background) / 0.45);
  padding: 0.38rem 0.65rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: rgb(var(--rgb-text));
  cursor: pointer;
  white-space: nowrap;
}

.matchup-copy-trigger__button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.matchup-copy-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.55);
}

.matchup-copy-modal__panel {
  width: min(100%, 28rem);
  max-height: min(90vh, 640px);
  overflow: auto;
  border: 1px solid rgb(var(--rgb-primary) / 0.45);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-surface));
  box-shadow: 0 16px 40px rgb(0 0 0 / 0.35);
}

.matchup-copy-modal__header {
  position: relative;
  padding: 0.85rem 2.25rem 0.65rem 0.85rem;
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.25);
}

.matchup-copy-modal__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: rgb(var(--rgb-text-accent));
}

.matchup-copy-modal__hint {
  margin: 0.25rem 0 0;
  font-size: 0.72rem;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-copy-modal__close {
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  border: none;
  background: transparent;
  font-size: 1rem;
  line-height: 1;
  color: rgb(var(--rgb-text) / 0.7);
  cursor: pointer;
}

.matchup-copy-modal__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.75rem 0.85rem;
}

.matchup-copy-modal__targets,
.matchup-copy-modal__message {
  margin: 0;
  font-size: 0.72rem;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-copy-modal__message {
  color: rgb(var(--rgb-text-accent));
}

.matchup-copy-modal__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.75);
}

.matchup-copy-modal__field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
}

.matchup-copy-modal__field select {
  width: 100%;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.4rem;
  background: rgb(var(--rgb-background) / 0.35);
  padding: 0.35rem 0.45rem;
  font-size: 0.82rem;
  font-weight: 400;
  color: rgb(var(--rgb-text));
}

.matchup-copy-modal__checks {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.matchup-copy-modal__check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 500;
  cursor: pointer;
}

.matchup-copy-modal__link {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 0.68rem;
  font-weight: 600;
  color: rgb(var(--rgb-accent));
  cursor: pointer;
}

.matchup-copy-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem 0.85rem;
  border-top: 1px solid rgb(var(--rgb-primary) / 0.25);
}

.matchup-copy-modal__cancel,
.matchup-copy-modal__apply {
  border-radius: 0.45rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.matchup-copy-modal__cancel {
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  background: transparent;
  color: rgb(var(--rgb-text));
}

.matchup-copy-modal__apply {
  border: 1px solid rgb(var(--rgb-accent) / 0.55);
  background: rgb(var(--rgb-accent) / 0.15);
  color: rgb(var(--rgb-text-accent));
}

.matchup-copy-modal__apply:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
