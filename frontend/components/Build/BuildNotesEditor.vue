<template>
  <div class="build-notes-editor ui-build-card-surface p-4">
    <div v-if="showVariantControls" class="build-notes-editor-variant-bar mb-4">
      <div class="build-notes-editor-variant-tabs">
        <button
          type="button"
          class="build-notes-editor-variant-tab ui-build-card-button"
          :class="{ 'is-active': activeVariantKey === 'main' }"
          @click="selectVariant('main')"
        >
          {{ mainVariantLabel }}
        </button>
        <button
          v-for="(sub, index) in subBuilds"
          :key="`notes-variant-${index}`"
          type="button"
          class="build-notes-editor-variant-tab ui-build-card-button"
          :class="{ 'is-active': activeVariantKey === index }"
          @click="selectVariant(index)"
        >
          {{ sub.title || t('buildCard.variantN', { n: index + 2 }) }}
        </button>
      </div>
      <label v-if="showNotesModeToggle" class="build-notes-editor-mode-toggle">
        <input
          type="checkbox"
          :checked="notesMode === 'single'"
          @change="toggleCommonNotes(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('buildNotes.commonNotes') }}</span>
      </label>
      <button
        v-if="subBuilds.length > 0"
        type="button"
        class="build-notes-editor-copy-btn ui-build-card-button"
        @click="openCopyPicker"
      >
        {{ t('buildNotes.copyNotes') }}
      </button>
    </div>

    <div class="build-notes-editor-toolbar-row">
      <div class="build-notes-editor-toolbar-group">
        <span class="build-notes-editor-label">{{ t('buildNotes.layout') }}</span>
        <div class="build-notes-editor-layout-tabs">
          <button
            v-for="option in layoutOptions"
            :key="option.value"
            type="button"
            class="build-notes-editor-layout-tab ui-build-card-button"
            :class="{ 'is-active': localNotes.layout === option.value }"
            @click="setLayout(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="build-notes-editor-toolbar-group build-notes-editor-youtube-group">
        <label class="build-notes-editor-label" for="build-notes-youtube">
          {{ t('buildNotes.youtube') }}
        </label>
        <div
          class="build-notes-editor-youtube-wrap"
          @mouseenter="youtubePreviewOpen = true"
          @mouseleave="youtubePreviewOpen = false"
        >
          <input
            id="build-notes-youtube"
            v-model="youtubeDraft"
            type="url"
            class="build-notes-editor-input"
            :placeholder="t('buildNotes.youtubePlaceholder')"
            @blur="commitYoutube"
            @input="onYoutubeInput"
          />
          <a
            v-if="youtubeDraft.trim() && youtubeEmbedUrl"
            class="build-notes-editor-youtube-link"
            :href="normalizedYoutubeUrl"
            target="_blank"
            rel="noopener noreferrer"
            @mouseenter="youtubePreviewOpen = true"
            @mouseleave="youtubePreviewOpen = false"
          >
            {{ t('buildNotes.youtubePreviewLink') }}
          </a>
          <div
            v-if="youtubeEmbedUrl && youtubePreviewOpen"
            class="build-notes-editor-youtube-hover-preview"
          >
            <iframe
              :src="youtubeEmbedUrl"
              title="YouTube"
              frameborder="0"
              allow="
                accelerometer;
                autoplay;
                clipboard-write;
                encrypted-media;
                gyroscope;
                picture-in-picture;
              "
              allowfullscreen
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSimpleSection" class="build-notes-editor-section">
      <div class="build-notes-editor-section-head">
        <h3 class="build-notes-editor-section-title">{{ t('buildNotes.simpleCards') }}</h3>
        <button
          type="button"
          class="build-notes-editor-add-btn ui-build-card-button"
          @click="addSimpleCard"
        >
          + {{ t('buildNotes.addCard') }}
        </button>
      </div>

      <div
        v-if="localNotes.simpleCards.length === 0"
        class="build-notes-editor-empty ui-build-card-surface"
      >
        <p>{{ t('buildNotes.noCards') }}</p>
        <button
          type="button"
          class="build-notes-editor-add-btn ui-build-card-button is-active"
          @click="addSimpleCard"
        >
          + {{ t('buildNotes.addCard') }}
        </button>
      </div>

      <div
        v-for="(card, index) in localNotes.simpleCards"
        :key="card.id"
        class="build-notes-card ui-build-card-surface"
      >
        <div class="build-notes-card-head">
          <input
            v-model="card.title"
            type="text"
            class="build-notes-card-title-input"
            :placeholder="t('buildNotes.cardTitlePlaceholder')"
            @input="commitNotes"
          />
          <button
            type="button"
            class="build-notes-editor-remove-btn"
            :aria-label="t('buildNotes.removeCard')"
            @click="removeSimpleCard(index)"
          >
            ✕
          </button>
        </div>
        <hr class="build-notes-card-sep" />
        <NotesRichEditor
          :model-value="card.body"
          :max-chars="BUILD_NOTES_SIMPLE_CARD_MAX_CHARS"
          :placeholder="t('buildNotes.cardBodyPlaceholder')"
          @update:model-value="value => updateSimpleCardBody(index, value)"
        />
      </div>
    </div>

    <div v-if="showDetailedSection" class="build-notes-editor-section">
      <h3 class="build-notes-editor-section-title">{{ t('buildNotes.detailedSection') }}</h3>
      <div
        v-for="section in detailedSections"
        :key="section.key"
        class="build-notes-card ui-build-card-surface"
      >
        <h4 class="build-notes-card-title" :class="`build-notes-card-title--${section.key}`">
          {{ section.label }}
        </h4>
        <hr class="build-notes-card-sep" />
        <NotesRichEditor
          :model-value="localNotes.detailed[section.key] ?? ''"
          :max-chars="BUILD_NOTES_DETAILED_SECTION_MAX_CHARS"
          :placeholder="section.placeholder"
          @update:model-value="value => updateDetailedSection(section.key, value)"
        />
      </div>
    </div>

    <div v-if="copyPickerOpen" class="build-notes-copy-overlay" @click.self="closeCopyPicker">
      <div class="build-notes-copy-modal ui-build-card-surface">
        <h3 class="build-notes-copy-title">{{ t('buildNotes.copyTitle') }}</h3>
        <label class="build-notes-copy-field">
          <span>{{ t('buildNotes.copySource') }}</span>
          <select
            class="build-notes-editor-input"
            :value="String(copySource)"
            @change="copySource = normalizeVariantKey(($event.target as HTMLSelectElement).value)"
          >
            <option value="main">{{ mainVariantLabel }}</option>
            <option v-for="(sub, index) in subBuilds" :key="`copy-src-${index}`" :value="index">
              {{ sub.title || t('buildCard.variantN', { n: index + 2 }) }}
            </option>
          </select>
        </label>
        <div class="build-notes-copy-destinations">
          <span>{{ t('buildNotes.copyDestinations') }}</span>
          <label>
            <input
              type="checkbox"
              :checked="copyDestinations.includes('main')"
              @change="toggleCopyDestination('main', ($event.target as HTMLInputElement).checked)"
            />
            {{ mainVariantLabel }}
          </label>
          <label v-for="(sub, index) in subBuilds" :key="`copy-dest-${index}`">
            <input
              type="checkbox"
              :checked="copyDestinations.includes(index)"
              @change="toggleCopyDestination(index, ($event.target as HTMLInputElement).checked)"
            />
            {{ sub.title || t('buildCard.variantN', { n: index + 2 }) }}
          </label>
        </div>
        <div class="build-notes-copy-actions">
          <button type="button" class="btn-cancel ui-build-card-button" @click="closeCopyPicker">
            {{ t('buildNotes.copyCancel') }}
          </button>
          <button
            type="button"
            class="btn-confirm ui-build-card-button is-active"
            :disabled="!canApplyCopy"
            @click="applyCopy"
          >
            {{ t('buildNotes.copyApply') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  BuildNotesContent,
  BuildNotesDetailed,
  BuildNotesLayout,
} from '@lelanation/shared-types'
import {
  BUILD_NOTES_DETAILED_SECTION_MAX_CHARS,
  BUILD_NOTES_SIMPLE_CARD_MAX_CHARS,
} from '@lelanation/shared-types'
import { useBuildStore } from '~/stores/BuildStore'
import NotesRichEditor from '~/components/Build/NotesRichEditor.vue'
import {
  cloneNotesContent,
  createNotesCardId,
  extractYoutubeVideoId,
  normalizeYoutubeUrl,
} from '~/utils/buildNotes'

const { t } = useI18n()
const buildStore = useBuildStore()

const localNotes = ref<BuildNotesContent>(cloneNotesContent(buildStore.getActiveNotes()))
const youtubeDraft = ref(localNotes.value.youtubeUrl ?? '')
const youtubePreviewOpen = ref(false)
const copyPickerOpen = ref(false)
const copySource = ref<'main' | number>('main')
const copyDestinations = ref<Array<'main' | number>>([])

function normalizeVariantKey(value: string | number): 'main' | number {
  if (value === 'main') return 'main'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 'main'
}

const subBuilds = computed(() => buildStore.currentBuild?.subBuilds ?? [])
const notesMode = computed(() => buildStore.currentBuild?.notesMode ?? 'single')
const activeVariantKey = computed(() => buildStore.displayedVariant)
const mainVariantLabel = computed(
  () => buildStore.currentBuild?.name || t('buildCard.mainBuildName')
)
const showVariantControls = computed(() => subBuilds.value.length > 0)
const showNotesModeToggle = computed(() => subBuilds.value.length > 0)

const layoutOptions = computed(() => [
  { value: 'simple' as const, label: t('buildNotes.layoutSimple') },
  { value: 'detailed' as const, label: t('buildNotes.layoutDetailed') },
  { value: 'both' as const, label: t('buildNotes.layoutBoth') },
])

const showSimpleSection = computed(
  () => localNotes.value.layout === 'simple' || localNotes.value.layout === 'both'
)
const showDetailedSection = computed(
  () => localNotes.value.layout === 'detailed' || localNotes.value.layout === 'both'
)

const detailedSections = computed(() => [
  {
    key: 'howToTrade' as const,
    label: t('buildNotes.howToTrade'),
    placeholder: t('buildNotes.howToTradePlaceholder'),
  },
  {
    key: 'whatToWatchOutFor' as const,
    label: t('buildNotes.whatToWatchOutFor'),
    placeholder: t('buildNotes.whatToWatchOutForPlaceholder'),
  },
  {
    key: 'tips' as const,
    label: t('buildNotes.tips'),
    placeholder: t('buildNotes.tipsPlaceholder'),
  },
])

const normalizedYoutubeUrl = computed(() => normalizeYoutubeUrl(youtubeDraft.value))

const youtubeEmbedUrl = computed(() => {
  const id = extractYoutubeVideoId(youtubeDraft.value || localNotes.value.youtubeUrl)
  return id ? `https://www.youtube.com/embed/${id}` : null
})

const canApplyCopy = computed(() => copyDestinations.value.length > 0)

function reloadLocalNotes() {
  localNotes.value = cloneNotesContent(buildStore.getActiveNotes())
  youtubeDraft.value = localNotes.value.youtubeUrl ?? ''
}

watch(
  () => [buildStore.displayedVariant, buildStore.currentBuild?.notesMode] as const,
  () => reloadLocalNotes()
)

function commitNotes() {
  buildStore.setActiveNotes(cloneNotesContent(localNotes.value))
}

function setLayout(layout: BuildNotesLayout) {
  localNotes.value.layout = layout
  commitNotes()
}

function onYoutubeInput() {
  if (!youtubeDraft.value.trim()) {
    localNotes.value.youtubeUrl = ''
    commitNotes()
  }
}

function commitYoutube() {
  localNotes.value.youtubeUrl = normalizeYoutubeUrl(youtubeDraft.value)
  youtubeDraft.value = localNotes.value.youtubeUrl
  commitNotes()
}

function addSimpleCard() {
  localNotes.value.simpleCards.push({
    id: createNotesCardId(),
    title: '',
    body: '',
  })
  commitNotes()
}

function removeSimpleCard(index: number) {
  localNotes.value.simpleCards.splice(index, 1)
  commitNotes()
}

function updateSimpleCardBody(index: number, value: string) {
  const card = localNotes.value.simpleCards[index]
  if (!card) return
  card.body = value
  commitNotes()
}

function updateDetailedSection(key: keyof BuildNotesDetailed, value: string) {
  localNotes.value.detailed[key] = value
  commitNotes()
}

function selectVariant(key: 'main' | number) {
  if (key === 'main') buildStore.showMainBuild()
  else buildStore.showSubBuild(key)
}

function toggleCommonNotes(enabled: boolean) {
  buildStore.setNotesMode(enabled ? 'single' : 'multiple')
}

function openCopyPicker() {
  copySource.value = buildStore.displayedVariant === 'main' ? 'main' : buildStore.displayedVariant
  copyDestinations.value = []
  copyPickerOpen.value = true
}

function closeCopyPicker() {
  copyPickerOpen.value = false
  copyDestinations.value = []
}

function toggleCopyDestination(key: 'main' | number, checked: boolean) {
  if (checked) {
    if (!copyDestinations.value.includes(key)) {
      copyDestinations.value = [...copyDestinations.value, key]
    }
  } else {
    copyDestinations.value = copyDestinations.value.filter(k => k !== key)
  }
}

function applyCopy() {
  const source = normalizeVariantKey(copySource.value)
  for (const dest of copyDestinations.value) {
    const destKey = normalizeVariantKey(dest)
    if (destKey === source) continue
    buildStore.copyVariantFieldsTo(source, destKey, { notes: true })
  }
  closeCopyPicker()
  reloadLocalNotes()
}
</script>

<style scoped>
.build-notes-editor {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.build-notes-editor-variant-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.build-notes-editor-variant-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.build-notes-editor-variant-tab {
  padding: 0.25rem 0.65rem;
  font-size: 12px;
  font-weight: 700;
}

.build-notes-editor-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12px;
  color: rgb(var(--rgb-text) / 0.75);
}

.build-notes-editor-copy-btn {
  margin-left: auto;
  padding: 0.25rem 0.6rem;
  font-size: 12px;
  font-weight: 700;
}

.build-notes-editor-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem 1.5rem;
}

.build-notes-editor-toolbar-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.build-notes-editor-youtube-group {
  flex: 1;
  min-width: min(100%, 320px);
}

.build-notes-editor-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.55);
}

.build-notes-editor-layout-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.build-notes-editor-layout-tab {
  padding: 0.35rem 0.75rem;
  font-size: 12px;
  font-weight: 700;
}

.build-notes-editor-youtube-wrap {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.build-notes-editor-input {
  flex: 1;
  min-width: 180px;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 8px;
  padding: 0.45rem 0.65rem;
  background: rgb(var(--rgb-background) / 0.35);
  color: rgb(var(--rgb-text) / 0.92);
  font-size: 13px;
}

.build-notes-editor-input:focus {
  outline: none;
  border-color: rgb(var(--rgb-accent) / 0.75);
  box-shadow: 0 0 0 2px rgb(var(--rgb-accent) / 0.15);
}

.build-notes-editor-youtube-link {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-gold-300);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.build-notes-editor-youtube-hover-preview {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 40;
  width: min(360px, calc(100vw - 2rem));
  padding-top: 56.25%;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid transparent;
  background: #000;
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.55);
}

.build-notes-editor-youtube-hover-preview iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.build-notes-editor-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.build-notes-editor-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.build-notes-editor-section-title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-gold-300);
}

.build-notes-editor-add-btn {
  padding: 0.4rem 0.85rem;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.build-notes-editor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem;
  text-align: center;
}

.build-notes-editor-empty p {
  margin: 0;
  font-size: 13px;
  color: rgb(var(--rgb-text) / 0.55);
}

.build-notes-card {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
}

.build-notes-card-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.build-notes-card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.25;
  color: var(--color-gold-300);
}

.build-notes-card-title--howToTrade {
  color: #34d399;
}

.build-notes-card-title--whatToWatchOutFor {
  color: #f87171;
}

.build-notes-card-title--tips {
  color: var(--color-gold-300);
}

.build-notes-card-title-input {
  flex: 1;
  border: none;
  border-bottom: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 0;
  padding: 0.15rem 0 0.35rem;
  background: transparent;
  color: var(--color-gold-300);
  font-size: 1rem;
  font-weight: 800;
}

.build-notes-card-title-input::placeholder {
  color: rgb(var(--rgb-text) / 0.35);
  font-weight: 600;
}

.build-notes-card-title-input:focus {
  outline: none;
  border-bottom-color: var(--color-gold-300);
}

.build-notes-card-sep {
  border: none;
  border-top: 1px solid rgb(var(--rgb-accent) / 0.22);
  margin: 0;
}

.build-notes-editor-remove-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 6px;
  background: rgb(var(--rgb-background) / 0.25);
  color: rgb(var(--rgb-text) / 0.65);
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;
}

.build-notes-editor-remove-btn:hover {
  border-color: #f87171;
  color: #f87171;
}

.build-notes-copy-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
}

.build-notes-copy-modal {
  width: min(420px, calc(100vw - 2rem));
  padding: 1rem;
}

.build-notes-copy-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-gold-300);
}

.build-notes-copy-field,
.build-notes-copy-destinations {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
  font-size: 13px;
}

.build-notes-copy-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-cancel,
.btn-confirm {
  padding: 0.4rem 0.75rem;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.btn-confirm:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
