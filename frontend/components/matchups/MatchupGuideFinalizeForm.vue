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
</style>
