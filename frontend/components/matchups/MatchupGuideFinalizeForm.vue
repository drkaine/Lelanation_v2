<template>
  <form class="matchup-finalize-form" @submit.prevent>
    <div class="matchup-finalize-form__visibility">
      <div class="matchup-finalize-form__visibility-row">
        <span class="matchup-finalize-form__visibility-label">
          {{ t('matchupGuideCreate.finalizeVisibilityLabel') }}
        </span>
        <span
          class="matchup-finalize-form__visibility-badge"
          :class="{
            'matchup-finalize-form__visibility-badge--private': visibility === 'private',
          }"
        >
          {{ visibility === 'private' ? t('buildsPage.private') : t('buildsPage.public') }}
        </span>
      </div>
      <p class="matchup-finalize-form__visibility-hint">
        {{ t('matchupGuideCreate.finalizeVisibilityHint') }}
        <NuxtLink :to="infoStepHref" class="matchup-finalize-form__visibility-link">
          {{ t('matchupGuideCreate.finalizeVisibilityLink') }}
        </NuxtLink>
      </p>
    </div>

    <section class="matchup-finalize-form__section">
      <h2 class="matchup-finalize-form__heading">
        {{ t('matchupGuideCreate.finalizeSectionIdentity') }}
      </h2>

      <div class="matchup-finalize-form__grid">
        <label
          class="matchup-finalize-form__field"
          :class="{ 'matchup-finalize-form__field--missing': isMissing('guideName') }"
        >
          <span>{{ t('matchupGuideCreate.fieldGuideName') }} *</span>
          <input
            type="text"
            :value="guideName"
            :placeholder="t('matchupGuideCreate.fieldGuideNamePlaceholder')"
            @input="onGuideName(($event.target as HTMLInputElement).value)"
          />
        </label>

        <label
          class="matchup-finalize-form__field"
          :class="{ 'matchup-finalize-form__field--missing': isMissing('author') }"
        >
          <span>{{ t('createBuild.author') }} *</span>
          <input
            type="text"
            :value="author"
            :placeholder="t('createBuild.authorPlaceholder')"
            @input="onAuthor(($event.target as HTMLInputElement).value)"
          />
        </label>

        <label
          class="matchup-finalize-form__field"
          :class="{ 'matchup-finalize-form__field--missing': isMissing('shortDescription') }"
        >
          <span>{{ t('matchupGuideCreate.fieldShortDescription') }} *</span>
          <textarea
            rows="2"
            :value="meta.shortDescription ?? ''"
            :maxlength="shortDescriptionMax"
            :placeholder="t('matchupGuideCreate.fieldShortDescriptionPlaceholder')"
            @input="onMeta('shortDescription', ($event.target as HTMLTextAreaElement).value)"
          />
          <span class="matchup-finalize-form__hint">
            {{
              t('matchupGuideCreate.fieldShortDescriptionHint', {
                count: (meta.shortDescription ?? '').length,
                max: shortDescriptionMax,
              })
            }}
          </span>
        </label>

        <label class="matchup-finalize-form__field">
          <span>{{ t('matchupGuideCreate.fieldOpggUrl') }}</span>
          <input
            type="url"
            :value="meta.opggUrl ?? ''"
            :placeholder="t('matchupGuideCreate.fieldOpggUrlPlaceholder')"
            @input="onMeta('opggUrl', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="matchup-finalize-form__field matchup-finalize-form__field--wide">
          <span>{{ t('matchupGuideCreate.fieldAuthorAbout') }}</span>
          <textarea
            rows="4"
            :value="meta.authorAbout ?? ''"
            :placeholder="t('matchupGuideCreate.fieldAuthorAboutPlaceholder')"
            @input="onMeta('authorAbout', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>

        <label class="matchup-finalize-form__field matchup-finalize-form__field--wide">
          <span>{{ t('createBuild.description') }}</span>
          <textarea
            rows="4"
            :value="description"
            :placeholder="t('matchupGuideCreate.fieldGuideDescriptionPlaceholder')"
            @input="onDescription(($event.target as HTMLTextAreaElement).value)"
          />
        </label>
      </div>
    </section>

    <section class="matchup-finalize-form__section">
      <h2 class="matchup-finalize-form__heading">
        {{ t('matchupGuideCreate.finalizeSectionGeneral') }}
      </h2>

      <div class="matchup-finalize-form__grid">
        <label class="matchup-finalize-form__field">
          <span>{{ t('matchupGuideCreate.fieldPermaban') }}</span>
          <textarea
            :value="meta.permabanNotes ?? ''"
            rows="5"
            :placeholder="t('matchupGuideCreate.fieldPermabanPlaceholder')"
            @input="onMeta('permabanNotes', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>

        <label class="matchup-finalize-form__field">
          <span>{{ t('matchupGuideCreate.fieldGeneralBuild') }}</span>
          <textarea
            :value="meta.generalBuildNotes ?? ''"
            rows="5"
            :placeholder="t('matchupGuideCreate.fieldGeneralBuildPlaceholder')"
            @input="onMeta('generalBuildNotes', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
      </div>
    </section>
  </form>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchupGuideMeta } from '@lelanation/shared-types'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { MATCHUP_GUIDE_SHORT_DESCRIPTION_MAX } from '~/utils/matchupGuideText'
import {
  areAllMatchupsFinalizeReady,
  getMissingFinalizeIdentityFields,
  type MatchupGuideFinalizeIdentityField,
} from '~/utils/matchupGuideCreateSteps'
import { matchupGuideCreateRouteQuery } from '~/utils/matchupGuideFromBuildSession'

const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()

const shortDescriptionMax = MATCHUP_GUIDE_SHORT_DESCRIPTION_MAX
const meta = computed(() => draftStore.meta)
const guideName = computed(() => buildStore.currentBuild?.name ?? '')
const author = computed(() => buildStore.currentBuild?.author ?? '')
const description = computed(() => buildStore.currentBuild?.description ?? '')
const visibility = computed(
  () => (buildStore.currentBuild?.visibility as 'public' | 'private' | undefined) ?? 'public'
)

const infoStepHref = computed(() =>
  localePath({
    path: '/matchups/sheets/create/info',
    query: matchupGuideCreateRouteQuery(route.query),
  })
)

const showRequiredHints = computed(
  () =>
    areAllMatchupsFinalizeReady(draftStore.matchupEntries) &&
    getMissingFinalizeIdentityFields({
      guideName: guideName.value,
      author: author.value,
      shortDescription: meta.value.shortDescription,
    }).length > 0
)

function isMissing(field: MatchupGuideFinalizeIdentityField): boolean {
  if (!showRequiredHints.value) return false
  return getMissingFinalizeIdentityFields({
    guideName: guideName.value,
    author: author.value,
    shortDescription: meta.value.shortDescription,
  }).includes(field)
}

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

type MetaField = keyof Pick<
  MatchupGuideMeta,
  'shortDescription' | 'permabanNotes' | 'generalBuildNotes' | 'authorAbout' | 'opggUrl'
>

function onMeta(field: MetaField, value: string) {
  draftStore.updateMeta({ [field]: value || undefined })
}
</script>

<style scoped>
.matchup-finalize-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.matchup-finalize-form__visibility {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-accent) / 0.08);
  padding: 0.85rem 1rem;
}

.matchup-finalize-form__visibility-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.matchup-finalize-form__visibility-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.75);
}

.matchup-finalize-form__visibility-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  background: rgb(74 222 128 / 0.18);
  padding: 0.15rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgb(187 247 208);
}

.matchup-finalize-form__visibility-badge--private {
  background: rgb(var(--rgb-text) / 0.12);
  color: rgb(var(--rgb-text) / 0.75);
}

.matchup-finalize-form__visibility-hint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.72);
}

.matchup-finalize-form__visibility-link {
  font-weight: 600;
  color: rgb(var(--rgb-text-accent));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.matchup-finalize-form__section {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-background) / 0.35);
  padding: 1rem;
}

.matchup-finalize-form__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem 1.25rem;
}

@media (min-width: 900px) {
  .matchup-finalize-form__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .matchup-finalize-form__field--wide {
    grid-column: 1 / -1;
  }
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

.matchup-finalize-form__hint {
  font-size: 0.65rem;
  font-weight: 500;
  color: rgb(var(--rgb-text) / 0.55);
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
  min-height: 4.5rem;
}

.matchup-finalize-form__field input:focus,
.matchup-finalize-form__field textarea:focus {
  outline: none;
  border-color: rgb(var(--rgb-accent) / 0.75);
}

.matchup-finalize-form__field--missing > span:first-child {
  color: rgb(248 113 113);
}

.matchup-finalize-form__field--missing input,
.matchup-finalize-form__field--missing textarea {
  border-color: rgb(248 113 113 / 0.85);
  box-shadow: 0 0 0 1px rgb(248 113 113 / 0.25);
}
</style>
