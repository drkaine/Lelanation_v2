<template>
  <AppModal
    :open="open"
    size="xl"
    dialog-class="matchup-build-picker-modal__dialog"
    scrollable
    :close-label="t('matchupGuideCreate.closeEntryEditor')"
    @close="close"
  >
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <button
        v-for="tab in BUILD_PICKER_TABS"
        :key="tab"
        type="button"
        class="ui-build-card-button rounded-lg px-3 py-1.5 text-sm"
        :class="{ 'matchup-build-picker-modal__tab--active': activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ t(TAB_LABELS[tab]) }}
      </button>
      <input
        v-model="searchQuery"
        type="search"
        class="ml-auto min-w-[12rem] flex-1 rounded-lg border border-primary/40 bg-background/60 px-3 py-1.5 text-sm"
        :placeholder="t('matchupGuideCreate.pickBuildSearch')"
      />
    </div>

    <p v-if="availableBuilds.length === 0" class="text-sm text-text/70">
      {{ t('matchupGuideCreate.pickBuildEmpty') }}
    </p>

    <div v-else class="matchup-build-picker-modal__grid">
      <button
        v-for="build in availableBuilds"
        :key="build.id"
        type="button"
        class="matchup-build-picker-modal__card"
        @click="selectBuild(build)"
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
import { computed, ref, watch } from 'vue'
import type { Build } from '@lelanation/shared-types'
import BuildCard from '~/components/Build/BuildCard.vue'
import { useBuildStore } from '~/stores/BuildStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import { BUILD_PICKER_TABS, buildPickerList, type BuildPickerTab } from '~/utils/buildPickerTabs'

const TAB_LABELS: Record<BuildPickerTab, string> = {
  favorites: 'buildsPage.myFavorites',
  discover: 'buildsPage.discover',
  mine: 'buildsPage.myBuilds',
}

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [build: Build]
}>()

const { t } = useI18n()
const buildStore = useBuildStore()
const discoveryStore = useBuildDiscoveryStore()
const favoritesStore = useFavoritesStore()

const activeTab = ref<BuildPickerTab>('mine')
const searchQuery = ref('')

watch(
  () => props.open,
  isOpen => {
    if (!isOpen) return
    favoritesStore.init()
    if (discoveryStore.builds.length === 0) discoveryStore.loadBuilds().catch(() => {})
  },
  { immediate: true }
)

const availableBuilds = computed<Build[]>(() =>
  buildPickerList(
    activeTab.value,
    {
      saved: buildStore.getSavedBuilds(),
      discovery: discoveryStore.builds,
      favoriteIds: favoritesStore.favoriteBuildIds,
    },
    searchQuery.value
  )
)

function close(): void {
  emit('update:open', false)
}

function selectBuild(build: Build): void {
  emit('select', build)
  close()
}
</script>

<style scoped>
.matchup-build-picker-modal__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(316px, 100%), 1fr));
  justify-items: center;
  gap: 0.75rem;
}

.matchup-build-picker-modal__tab--active {
  border-color: rgb(var(--rgb-accent) / 0.85);
  color: rgb(var(--rgb-accent));
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
  width: 300px;
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

<style>
.app-modal__dialog.matchup-build-picker-modal__dialog {
  width: 80vw;
  max-width: 80vw;
  height: 80vh;
  max-height: 80vh;
}

@media (max-width: 639px) {
  .app-modal__dialog.matchup-build-picker-modal__dialog {
    width: 100%;
    max-width: 100%;
    height: 90vh;
    max-height: 90vh;
  }
}
</style>
