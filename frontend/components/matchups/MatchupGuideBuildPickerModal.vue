<template>
  <AppModal
    :open="open"
    size="xl"
    scrollable
    :close-label="t('matchupGuideCreate.closeEntryEditor')"
    @close="close"
  >
    <template #header>
      <div>
        <h2 class="text-lg font-semibold text-accent md:text-xl">
          {{ t('matchupGuideCreate.pickBuildModalTitle') }}
        </h2>
        <p class="mt-1 text-sm text-text/70">
          {{ t('matchupGuideCreate.pickBuildModalHint') }}
        </p>
      </div>
    </template>

    <p v-if="availableBuilds.length === 0" class="text-sm text-text/70">
      {{ t('matchupGuideCreate.noSavedBuilds') }}
    </p>

    <div v-else class="matchup-build-picker-modal__grid">
      <button
        v-for="build in availableBuilds"
        :key="build.id"
        type="button"
        class="matchup-build-picker-modal__card"
        @click="selectBuild(build.id)"
      >
        <div class="matchup-build-picker-modal__card-visual">
          <BuildCard :build="build" readonly hide-top-actions sheet-tooltips />
        </div>
        <span class="matchup-build-picker-modal__card-label">
          {{ build.name?.trim() || t('buildDiscovery.anonymous') }}
        </span>
      </button>
    </div>

    <template #footer>
      <button
        type="button"
        class="ui-build-card-button rounded-lg px-4 py-2 text-sm"
        @click="close"
      >
        {{ t('matchupGuideCreate.cancel') }}
      </button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Build } from '@lelanation/shared-types'
import BuildCard from '~/components/Build/BuildCard.vue'
import { useBuildStore } from '~/stores/BuildStore'
import { filterStandaloneLibraryBuilds } from '~/utils/buildLibrary'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [buildId: string]
}>()

const { t } = useI18n()
const buildStore = useBuildStore()

const availableBuilds = computed<Build[]>(() =>
  filterStandaloneLibraryBuilds(buildStore.getSavedBuilds()).sort((a, b) =>
    String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))
  )
)

function close(): void {
  emit('update:open', false)
}

function selectBuild(buildId: string): void {
  emit('select', buildId)
  close()
}
</script>

<style scoped>
.matchup-build-picker-modal__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.matchup-build-picker-modal__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  border: 2px solid rgb(var(--rgb-primary) / 0.35);
  border-radius: 0.65rem;
  background: rgb(var(--rgb-background) / 0.45);
  padding: 0.45rem;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.matchup-build-picker-modal__card:hover {
  border-color: rgb(var(--rgb-accent) / 0.75);
  box-shadow: 0 0 0 1px rgb(var(--rgb-accent) / 0.35);
}

.matchup-build-picker-modal__card-visual {
  width: 100%;
  overflow: hidden;
  border-radius: 0.45rem;
}

.matchup-build-picker-modal__card-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 600;
  color: rgb(var(--rgb-text));
}
</style>
