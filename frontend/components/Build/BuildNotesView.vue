<template>
  <div class="build-notes-view">
    <div v-if="showViewToggle || youtubeEmbedUrl" class="build-notes-view__toolbar">
      <template v-if="showViewToggle">
        <span class="build-notes-view__toolbar-label">{{ t('buildNotesView.matchupView') }}</span>
        <div
          class="build-notes-view__toggle"
          role="tablist"
          :aria-label="t('buildNotesView.matchupView')"
        >
          <button
            type="button"
            role="tab"
            class="build-notes-view__toggle-btn"
            :class="{ 'is-active': activeView === 'simple' }"
            :aria-selected="activeView === 'simple'"
            @click="activeView = 'simple'"
          >
            {{ t('buildNotes.layoutSimple') }}
          </button>
          <button
            type="button"
            role="tab"
            class="build-notes-view__toggle-btn"
            :class="{ 'is-active': activeView === 'detailed' }"
            :aria-selected="activeView === 'detailed'"
            @click="activeView = 'detailed'"
          >
            {{ t('buildNotes.layoutDetailed') }}
          </button>
        </div>
      </template>

      <button
        v-if="youtubeEmbedUrl"
        type="button"
        class="build-notes-view__vod-btn ui-build-card-button is-active"
        @click="vodModalOpen = true"
      >
        {{ t('buildNotesView.openVod') }}
      </button>
    </div>

    <div
      v-if="showSimplePanel"
      class="build-notes-view__panel build-notes-view__panel--grid ui-card-grid"
    >
      <div
        v-for="card in visibleSimpleCards"
        :key="card.id"
        class="build-notes-view__card ui-build-card-surface"
      >
        <h3 v-if="card.title.trim()" class="build-notes-view__card-title">{{ card.title }}</h3>
        <hr v-if="card.title.trim()" class="build-notes-view__card-sep" />
        <NotesContentRenderer v-if="card.body.trim()" :html="card.body" :champion="champion" />
      </div>
      <p
        v-if="visibleSimpleCards.length === 0"
        class="build-notes-view__empty build-notes-view__empty--full"
      >
        {{ t('buildNotesView.noSimpleNotes') }}
      </p>
    </div>

    <div
      v-if="showDetailedPanel"
      class="build-notes-view__panel build-notes-view__panel--grid ui-card-grid"
    >
      <section
        v-for="section in visibleDetailedSections"
        :key="section.key"
        class="build-notes-view__detailed-block ui-build-card-surface"
      >
        <h3
          class="build-notes-view__detailed-title"
          :class="`build-notes-view__detailed-title--${section.key}`"
        >
          {{ section.label }}
        </h3>
        <hr class="build-notes-view__card-sep" />
        <div class="build-notes-view__detailed-body">
          <NotesContentRenderer :html="section.html" :champion="champion" />
        </div>
      </section>
      <p
        v-if="visibleDetailedSections.length === 0"
        class="build-notes-view__empty build-notes-view__empty--full"
      >
        {{ t('buildNotesView.noDetailedNotes') }}
      </p>
    </div>

    <Teleport to="body">
      <div
        v-if="vodModalOpen && youtubeEmbedUrl"
        class="build-notes-vod-overlay"
        role="presentation"
        @click.self="vodModalOpen = false"
      >
        <div
          class="build-notes-vod-modal ui-build-card-surface"
          role="dialog"
          aria-modal="true"
          :aria-label="t('buildNotesView.matchupVod')"
        >
          <div class="build-notes-vod-modal__head">
            <h2 class="build-notes-vod-modal__title">{{ t('buildNotesView.matchupVod') }}</h2>
            <button
              type="button"
              class="build-notes-vod-modal__close ui-build-card-button"
              :aria-label="t('buildNotesView.closeVod')"
              @click="vodModalOpen = false"
            >
              ×
            </button>
          </div>
          <div class="build-notes-vod-modal__video-wrap">
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
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { BuildNotesContent, Champion } from '@lelanation/shared-types'
import NotesContentRenderer from '~/components/Build/NotesContentRenderer.vue'
import { extractYoutubeVideoId } from '~/utils/buildNotes'

const props = defineProps<{
  notes: BuildNotesContent
  champion?: Champion | null
}>()

const { t } = useI18n()

const activeView = ref<'simple' | 'detailed'>('simple')
const vodModalOpen = ref(false)

const showViewToggle = computed(() => props.notes.layout === 'both')

const showSimplePanel = computed(() => {
  if (props.notes.layout === 'detailed') return false
  if (props.notes.layout === 'both') return activeView.value === 'simple'
  return true
})

const showDetailedPanel = computed(() => {
  if (props.notes.layout === 'simple') return false
  if (props.notes.layout === 'both') return activeView.value === 'detailed'
  return true
})

const visibleSimpleCards = computed(() =>
  props.notes.simpleCards.filter(card => card.title.trim() || card.body.trim())
)

const visibleDetailedSections = computed(() => {
  const d = props.notes.detailed
  const sections = [
    { key: 'howToTrade' as const, label: t('buildNotes.howToTrade'), html: d.howToTrade ?? '' },
    {
      key: 'whatToWatchOutFor' as const,
      label: t('buildNotes.whatToWatchOutFor'),
      html: d.whatToWatchOutFor ?? '',
    },
    { key: 'tips' as const, label: t('buildNotes.tips'), html: d.tips ?? '' },
  ]
  return sections.filter(section => section.html.trim())
})

const youtubeEmbedUrl = computed(() => {
  const id = extractYoutubeVideoId(props.notes.youtubeUrl)
  return id ? `https://www.youtube.com/embed/${id}` : null
})

watch(
  () => props.notes.layout,
  layout => {
    if (layout === 'detailed') activeView.value = 'detailed'
    else activeView.value = 'simple'
  },
  { immediate: true }
)

watch(
  () => props.notes.youtubeUrl,
  () => {
    vodModalOpen.value = false
  }
)
</script>

<style scoped>
.build-notes-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.build-notes-view__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.build-notes-view__toolbar-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}

.build-notes-view__toggle {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.28);
}

.build-notes-view__toggle-btn {
  border: none;
  background: transparent;
  padding: 0.35rem 0.9rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.build-notes-view__toggle-btn.is-active {
  background: color-mix(in srgb, var(--color-accent, #c8aa6e) 22%, transparent);
  color: var(--color-accent, #c8aa6e);
}

.build-notes-view__vod-btn {
  padding: 0.35rem 0.9rem;
  font-size: 0.8125rem;
  font-weight: 700;
}

.build-notes-view__panel--grid {
  --ui-card-grid-max: 300px;
  --ui-card-grid-gap: 15px;
  --ui-card-grid-padding-inline: 0;
  justify-content: flex-start;
}

.build-notes-view__card,
.build-notes-view__detailed-block {
  padding: 1rem 1.1rem;
  box-sizing: border-box;
}

.build-notes-view__card-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.25;
  color: var(--color-accent, #c8aa6e);
}

.build-notes-view__card-sep {
  margin: 0.65rem 0 0.85rem;
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.build-notes-view__detailed-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.build-notes-view__detailed-title--howToTrade {
  color: #34d399;
}

.build-notes-view__detailed-title--whatToWatchOutFor {
  color: #f87171;
}

.build-notes-view__detailed-title--tips {
  color: var(--color-gold-300, #c8aa6e);
}

.build-notes-view__detailed-body {
  padding-top: 0.15rem;
}

.build-notes-view__empty {
  margin: 0;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.45);
}

.build-notes-view__empty--full {
  width: 100%;
  flex: 1 1 100%;
}

.build-notes-vod-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.72);
}

.build-notes-vod-modal {
  width: min(900px, calc(100vw - 2rem));
  padding: 1rem;
}

.build-notes-vod-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.build-notes-vod-modal__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--color-gold-300, #c8aa6e);
}

.build-notes-vod-modal__close {
  width: 2rem;
  height: 2rem;
  padding: 0;
  font-size: 1.35rem;
  line-height: 1;
}

.build-notes-vod-modal__video-wrap {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #000;
}

.build-notes-vod-modal__video-wrap iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
