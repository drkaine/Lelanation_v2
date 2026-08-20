<template>
  <div class="build-detail-notes flex flex-col gap-6 lg:flex-row">
    <div class="w-full flex-shrink-0 lg:w-auto">
      <div class="build-detail-card-column w-full max-w-full md:max-w-[380px]">
        <BuildDetailCardBar :author="build.author" />
        <BuildCard
          :build="build"
          :initial-displayed-variant-index="displayedSubIndex"
          :readonly="true"
          :sheet-tooltips="true"
          :hide-top-actions="true"
          selection-mode="none"
          @variant-change="idx => emit('variant-change', idx)"
        />
      </div>

      <div
        v-if="showVariantNotesSelector"
        class="build-detail-notes__variant-tabs mt-3 flex flex-wrap gap-1.5"
      >
        <button
          type="button"
          class="build-detail-notes__variant-tab"
          :class="{ 'is-active': activeVariantKey === 'main' }"
          @click="emit('variant-change', null)"
        >
          {{ build.name || t('buildCard.mainBuildName') }}
        </button>
        <button
          v-for="(sub, index) in build.subBuilds ?? []"
          :key="`notes-detail-variant-${index}`"
          type="button"
          class="build-detail-notes__variant-tab"
          :class="{ 'is-active': activeVariantKey === index }"
          @click="emit('variant-change', index)"
        >
          {{ sub.title || t('buildCard.variantN', { n: index + 2 }) }}
        </button>
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <BuildNotesView v-if="hasNotes" :notes="activeNotes" :champion="build.champion" />
      <p v-else class="text-sm text-text/60">{{ t('buildNotesView.empty') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Build } from '~/types/build'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildDetailCardBar from '~/components/Build/BuildDetailCardBar.vue'
import BuildNotesView from '~/components/Build/BuildNotesView.vue'
import { getActiveBuildNotes } from '~/utils/buildNotes'

const props = defineProps<{
  build: Build
  displayedSubIndex: number | null
}>()

const emit = defineEmits<{
  'variant-change': [index: number | null]
}>()

const { t } = useI18n()

const activeVariantKey = computed<'main' | number>(() =>
  props.displayedSubIndex === null ? 'main' : props.displayedSubIndex
)

const showVariantNotesSelector = computed(
  () =>
    (props.build.notesMode ?? 'single') === 'multiple' && (props.build.subBuilds?.length ?? 0) > 0
)

const activeNotes = computed(() => getActiveBuildNotes(props.build, activeVariantKey.value))

const hasNotes = computed(() => {
  const notes = activeNotes.value
  if (notes.youtubeUrl?.trim()) return true
  if (notes.simpleCards.some(c => c.title.trim() || c.body.trim())) return true
  const d = notes.detailed
  return Boolean(d.howToTrade?.trim() || d.whatToWatchOutFor?.trim() || d.tips?.trim())
})
</script>

<style scoped>
.build-detail-notes__variant-tab {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}

.build-detail-notes__variant-tab.is-active {
  border-color: var(--color-accent, #c8aa6e);
  color: var(--color-accent, #c8aa6e);
}
</style>
