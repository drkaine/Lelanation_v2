<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="matchup-build-picker-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="t('matchupGuideCreate.pickBuildModalTitle')"
      @click.self="close"
    >
      <div class="matchup-build-picker-modal__panel">
        <header class="matchup-build-picker-modal__header">
          <h4 class="matchup-build-picker-modal__title">
            {{ t('matchupGuideCreate.pickBuildModalTitle') }}
          </h4>
          <p class="matchup-build-picker-modal__hint">
            {{ t('matchupGuideCreate.pickBuildModalHint') }}
          </p>
          <button
            type="button"
            class="matchup-build-picker-modal__close"
            :aria-label="t('matchupGuideCreate.closeEntryEditor')"
            @click="close"
          >
            ✕
          </button>
        </header>

        <p v-if="availableBuilds.length === 0" class="matchup-build-picker-modal__empty">
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

        <footer class="matchup-build-picker-modal__footer">
          <button type="button" class="matchup-build-picker-modal__cancel" @click="close">
            {{ t('matchupGuideCreate.cancel') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
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
.matchup-build-picker-modal {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.72);
}

.matchup-build-picker-modal__panel {
  position: relative;
  width: min(100%, 920px);
  max-height: min(92vh, 900px);
  overflow: auto;
  border: 1px solid rgb(var(--rgb-primary) / 0.45);
  border-radius: 0.85rem;
  background: rgb(var(--rgb-background));
  padding: 1rem;
}

.matchup-build-picker-modal__header {
  margin-bottom: 0.85rem;
  padding-right: 2rem;
}

.matchup-build-picker-modal__title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 700;
  color: rgb(var(--rgb-text-accent));
}

.matchup-build-picker-modal__hint {
  margin: 0;
  font-size: 0.78rem;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-build-picker-modal__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  border: none;
  background: transparent;
  color: rgb(var(--rgb-text) / 0.7);
  font-size: 1rem;
  cursor: pointer;
}

.matchup-build-picker-modal__empty {
  margin: 0.5rem 0 1rem;
  font-size: 0.875rem;
  color: rgb(var(--rgb-text) / 0.7);
}

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
  background: rgb(var(--rgb-surface) / 0.35);
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

.matchup-build-picker-modal__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.85rem;
}

.matchup-build-picker-modal__cancel {
  border: 1px solid rgb(var(--rgb-primary) / 0.45);
  border-radius: 0.45rem;
  background: transparent;
  padding: 0.45rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.85);
  cursor: pointer;
}
</style>
