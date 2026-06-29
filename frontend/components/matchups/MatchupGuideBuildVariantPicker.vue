<template>
  <div class="build-variant-picker">
    <button
      type="button"
      class="build-variant-picker__trigger"
      :class="{ 'build-variant-picker__trigger--invalid': invalid }"
      @click="openModal"
    >
      {{ triggerLabel }}
    </button>
    <ul v-if="summaryLines.length" class="build-variant-picker__summary">
      <li v-for="line in summaryLines" :key="line.key">
        <span class="build-variant-picker__summary-label">{{ line.label }}</span>
        <span v-if="line.reason" class="build-variant-picker__summary-reason">{{
          line.reason
        }}</span>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="modalOpen"
        class="build-variant-picker-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="t('matchupGuideCreate.buildVariantModalTitle')"
        @click.self="closeModal"
      >
        <div class="build-variant-picker-modal__panel">
          <header class="build-variant-picker-modal__header">
            <h4 class="build-variant-picker-modal__title">
              {{ t('matchupGuideCreate.buildVariantModalTitle') }}
            </h4>
            <p class="build-variant-picker-modal__hint">
              {{ t('matchupGuideCreate.buildVariantModalHint') }}
            </p>
            <button
              type="button"
              class="build-variant-picker-modal__close"
              :aria-label="t('matchupGuideCreate.closeEntryEditor')"
              @click="closeModal"
            >
              ✕
            </button>
          </header>

          <div class="build-variant-picker-modal__grid">
            <button
              v-for="option in variantOptions"
              :key="variantRefKey(option.variant)"
              type="button"
              class="build-variant-picker-modal__card"
              :class="{
                'build-variant-picker-modal__card--selected': isDraftSelected(option.variant),
              }"
              @click="toggleDraftVariant(option.variant)"
            >
              <div class="build-variant-picker-modal__card-visual">
                <BuildCard
                  v-if="baseBuild"
                  :build="baseBuild"
                  :initial-displayed-variant-index="option.subIndex"
                  readonly
                  hide-top-actions
                  sheet-tooltips
                />
              </div>
              <span class="build-variant-picker-modal__card-label">{{ option.label }}</span>
            </button>
          </div>

          <div v-if="draftSelected.length > 1" class="build-variant-picker-modal__reasons">
            <p class="build-variant-picker-modal__reasons-title">
              {{ t('matchupGuideCreate.buildVariantReasonTitle') }}
            </p>
            <label
              v-for="pick in draftSelected"
              :key="`reason-${variantRefKey(pick.variant)}`"
              class="build-variant-picker-modal__reason-field"
            >
              <span>{{ buildVariantLabel(pick.variant, baseBuild, t) }}</span>
              <input
                type="text"
                :value="pick.reason ?? ''"
                :placeholder="t('matchupGuideCreate.buildVariantReasonPlaceholder')"
                @input="setDraftReason(pick.variant, ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>

          <footer class="build-variant-picker-modal__footer">
            <button type="button" class="build-variant-picker-modal__cancel" @click="closeModal">
              {{ t('matchupGuideCreate.cancel') }}
            </button>
            <button
              type="button"
              class="build-variant-picker-modal__confirm"
              @click="applySelection"
            >
              {{ t('matchupGuideCreate.confirm') }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MatchupBuildVariantPick, MatchupBuildVariantRef } from '@lelanation/shared-types'
import BuildCard from '~/components/Build/BuildCard.vue'
import { useBuildStore } from '~/stores/BuildStore'
import {
  buildVariantLabel,
  listBuildVariantOptions,
  variantRefKey,
} from '~/utils/matchupEntryUtils'

const props = defineProps<{
  modelValue: MatchupBuildVariantPick[] | undefined
  invalid?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: MatchupBuildVariantPick[] | undefined]
}>()

const { t } = useI18n()
const buildStore = useBuildStore()

const modalOpen = ref(false)
const draftSelected = ref<MatchupBuildVariantPick[]>([])

const baseBuild = computed(() => buildStore.currentBuild)
const variantOptions = computed(() => listBuildVariantOptions(baseBuild.value, t))

const triggerLabel = computed(() => {
  const count = props.modelValue?.length ?? 0
  if (count === 0) return t('matchupGuideCreate.buildVariantPick')
  return t('matchupGuideCreate.buildVariantSelectedCount', { count })
})

const summaryLines = computed(() =>
  (props.modelValue ?? []).map(pick => ({
    key: variantRefKey(pick.variant),
    label: buildVariantLabel(pick.variant, baseBuild.value, t),
    reason: pick.reason?.trim() || '',
  }))
)

function openModal() {
  draftSelected.value = (props.modelValue ?? []).map(pick => ({ ...pick }))
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

function isDraftSelected(variant: MatchupBuildVariantRef): boolean {
  return draftSelected.value.some(pick => pick.variant === variant)
}

function toggleDraftVariant(variant: MatchupBuildVariantRef) {
  if (isDraftSelected(variant)) {
    draftSelected.value = draftSelected.value.filter(pick => pick.variant !== variant)
    return
  }
  draftSelected.value = [...draftSelected.value, { variant }]
}

function setDraftReason(variant: MatchupBuildVariantRef, reason: string) {
  draftSelected.value = draftSelected.value.map(pick =>
    pick.variant === variant ? { ...pick, reason: reason.trim() || undefined } : pick
  )
}

function applySelection() {
  const next = draftSelected.value.length
    ? draftSelected.value.map(pick => ({
        variant: pick.variant,
        reason: draftSelected.value.length > 1 ? pick.reason?.trim() || undefined : undefined,
      }))
    : undefined
  emit('update:modelValue', next)
  closeModal()
}

watch(modalOpen, open => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
})
</script>

<style scoped>
.build-variant-picker {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.build-variant-picker__trigger {
  align-self: flex-start;
  border: 1px solid rgb(var(--rgb-accent) / 0.55);
  border-radius: 0.45rem;
  background: rgb(var(--rgb-accent) / 0.12);
  padding: 0.4rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: rgb(var(--rgb-text-accent));
  cursor: pointer;
}

.build-variant-picker__trigger--invalid {
  border-color: rgb(248 113 113 / 0.85);
  background: rgb(248 113 113 / 0.1);
  color: rgb(254 202 202);
  box-shadow: 0 0 0 1px rgb(248 113 113 / 0.25);
}

.build-variant-picker__summary {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.build-variant-picker__summary-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgb(var(--rgb-text));
}

.build-variant-picker__summary-reason {
  display: block;
  font-size: 0.72rem;
  font-weight: 400;
  color: rgb(var(--rgb-text) / 0.65);
}

.build-variant-picker-modal {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.72);
}

.build-variant-picker-modal__panel {
  position: relative;
  width: min(100%, 920px);
  max-height: min(92vh, 900px);
  overflow: auto;
  border: 1px solid rgb(var(--rgb-primary) / 0.45);
  border-radius: 0.85rem;
  background: rgb(var(--rgb-background));
  padding: 1rem;
}

.build-variant-picker-modal__header {
  margin-bottom: 0.85rem;
  padding-right: 2rem;
}

.build-variant-picker-modal__title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 700;
  color: rgb(var(--rgb-text-accent));
}

.build-variant-picker-modal__hint {
  margin: 0;
  font-size: 0.78rem;
  color: rgb(var(--rgb-text) / 0.65);
}

.build-variant-picker-modal__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  border: none;
  background: transparent;
  color: rgb(var(--rgb-text) / 0.7);
  font-size: 1rem;
  cursor: pointer;
}

.build-variant-picker-modal__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.build-variant-picker-modal__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  border: 2px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.65rem;
  background: rgb(var(--rgb-surface) / 0.35);
  padding: 0.45rem;
  cursor: pointer;
}

.build-variant-picker-modal__card--selected {
  border-color: rgb(var(--rgb-accent));
  box-shadow: 0 0 0 1px rgb(var(--rgb-accent) / 0.35);
}

.build-variant-picker-modal__card-visual {
  width: 100%;
  height: 250px;
  overflow: hidden;
  display: flex;
  justify-content: center;
}

.build-variant-picker-modal__card-visual :deep(.build-card-wrapper) {
  transform: scale(0.52);
  transform-origin: top center;
}

.build-variant-picker-modal__card-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
  color: rgb(var(--rgb-text));
}

.build-variant-picker-modal__reasons {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.build-variant-picker-modal__reasons-title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: rgb(var(--rgb-text-accent));
}

.build-variant-picker-modal__reason-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.75);
}

.build-variant-picker-modal__reason-field input {
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.4rem;
  background: rgb(var(--rgb-surface) / 0.6);
  padding: 0.4rem 0.5rem;
  font-size: 0.82rem;
  font-weight: 400;
  color: rgb(var(--rgb-text));
}

.build-variant-picker-modal__footer {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.build-variant-picker-modal__cancel,
.build-variant-picker-modal__confirm {
  border-radius: 0.45rem;
  padding: 0.45rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.build-variant-picker-modal__cancel {
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  background: transparent;
  color: rgb(var(--rgb-text) / 0.8);
}

.build-variant-picker-modal__confirm {
  border: 1px solid rgb(var(--rgb-accent));
  background: rgb(var(--rgb-accent));
  color: rgb(var(--rgb-background));
}
</style>
