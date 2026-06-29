<template>
  <form class="matchup-finalize-form" @submit.prevent>
    <section class="matchup-finalize-form__section">
      <h2 class="matchup-finalize-form__heading">
        {{ t('matchupGuideCreate.finalizeSectionIdentity') }}
      </h2>

      <label class="matchup-finalize-form__field">
        <span>{{ t('matchupGuideCreate.fieldGuideName') }}</span>
        <input
          type="text"
          :value="guideName"
          :placeholder="t('matchupGuideCreate.fieldGuideNamePlaceholder')"
          @input="onGuideName(($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="matchup-finalize-form__field">
        <span>{{ t('createBuild.author') }}</span>
        <input
          type="text"
          :value="author"
          :placeholder="t('createBuild.authorPlaceholder')"
          @input="onAuthor(($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="matchup-finalize-form__field">
        <span>{{ t('createBuild.description') }}</span>
        <textarea
          rows="3"
          :value="description"
          :placeholder="t('matchupGuideCreate.fieldGuideDescriptionPlaceholder')"
          @input="onDescription(($event.target as HTMLTextAreaElement).value)"
        />
      </label>

      <div class="matchup-finalize-form__field">
        <span>{{ t('createBuild.visibility') }}</span>
        <label class="matchup-finalize-form__publish-toggle">
          <input
            type="checkbox"
            class="matchup-finalize-form__publish-input"
            :checked="isPublished"
            @change="onPublishToggle"
          />
          <span class="matchup-finalize-form__publish-track" aria-hidden="true">
            <span class="matchup-finalize-form__publish-thumb"></span>
          </span>
          <span class="matchup-finalize-form__publish-label">
            {{ t('matchupGuideCreate.publishGuide') }}
          </span>
        </label>
        <p class="matchup-finalize-form__hint">
          {{ isPublished ? t('createBuild.visibleToAll') : t('createBuild.onlyForYou') }}
        </p>
      </div>
    </section>

    <section class="matchup-finalize-form__section">
      <h2 class="matchup-finalize-form__heading">
        {{ t('matchupGuideCreate.finalizeSectionGeneral') }}
      </h2>

      <label class="matchup-finalize-form__field">
        <span>{{ t('matchupGuideCreate.fieldPermaban') }}</span>
        <textarea
          :value="meta.permabanNotes ?? ''"
          rows="3"
          :placeholder="t('matchupGuideCreate.fieldPermabanPlaceholder')"
          @input="onMeta('permabanNotes', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>

      <label class="matchup-finalize-form__field">
        <span>{{ t('matchupGuideCreate.fieldGeneralBuild') }}</span>
        <textarea
          :value="meta.generalBuildNotes ?? ''"
          rows="4"
          :placeholder="t('matchupGuideCreate.fieldGeneralBuildPlaceholder')"
          @input="onMeta('generalBuildNotes', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </section>
  </form>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'

const { t } = useI18n()
const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()

const meta = computed(() => draftStore.meta)
const guideName = computed(() => buildStore.currentBuild?.name ?? '')
const author = computed(() => buildStore.currentBuild?.author ?? '')
const description = computed(() => buildStore.currentBuild?.description ?? '')
const isPublished = computed(() => (buildStore.currentBuild?.visibility ?? 'public') === 'public')

function persistBuild() {
  buildStore.persistCurrentBuildDraft()
}

function onGuideName(value: string) {
  buildStore.setName(value)
  persistBuild()
}

function onAuthor(value: string) {
  buildStore.setAuthor(value)
  persistBuild()
}

function onDescription(value: string) {
  buildStore.setDescription(value)
  persistBuild()
}

function onPublishToggle(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  buildStore.setVisibility(checked ? 'public' : 'private')
  persistBuild()
}

function onMeta(field: 'permabanNotes' | 'generalBuildNotes', value: string) {
  draftStore.updateMeta({ [field]: value || undefined })
}
</script>

<style scoped>
.matchup-finalize-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.matchup-finalize-form__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-background) / 0.35);
  padding: 1rem;
}

.matchup-finalize-form__heading {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text-accent));
}

.matchup-finalize-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.75);
}

.matchup-finalize-form__field input,
.matchup-finalize-form__field textarea {
  width: 100%;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.4rem;
  background: rgb(var(--rgb-surface) / 0.6);
  padding: 0.45rem 0.55rem;
  font-size: 0.85rem;
  font-weight: 400;
  color: rgb(var(--rgb-text));
}

.matchup-finalize-form__field textarea {
  resize: vertical;
}

.matchup-finalize-form__field input:focus,
.matchup-finalize-form__field textarea:focus {
  outline: none;
  border-color: rgb(var(--rgb-accent) / 0.75);
}

.matchup-finalize-form__hint {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 400;
  color: rgb(var(--rgb-text) / 0.55);
}

.matchup-finalize-form__publish-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  user-select: none;
}

.matchup-finalize-form__publish-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.matchup-finalize-form__publish-track {
  position: relative;
  width: 2.2rem;
  height: 1.2rem;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px solid rgb(var(--rgb-accent) / 0.45);
  background: rgb(var(--rgb-background) / 0.45);
  transition: background-color 0.2s ease;
}

.matchup-finalize-form__publish-thumb {
  position: absolute;
  top: 0.12rem;
  left: 0.12rem;
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 9999px;
  background: rgb(var(--rgb-text) / 0.55);
  transition:
    transform 0.2s ease,
    background-color 0.2s ease;
}

.matchup-finalize-form__publish-input:checked + .matchup-finalize-form__publish-track {
  background: rgb(var(--rgb-accent) / 0.35);
  border-color: rgb(var(--rgb-accent) / 0.75);
}

.matchup-finalize-form__publish-input:checked
  + .matchup-finalize-form__publish-track
  .matchup-finalize-form__publish-thumb {
  transform: translateX(1rem);
  background: rgb(var(--rgb-accent));
}

.matchup-finalize-form__publish-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.85);
}
</style>
