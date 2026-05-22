<template>
  <div class="theorycraft-page min-h-screen py-4 pl-4 pr-0 text-text">
    <div class="theorycraft-page__shell">
      <div class="theorycraft-page-header mb-4 pr-4">
        <button
          type="button"
          class="theorycraft-header-actions__panel"
          :class="{ 'theorycraft-header-actions__panel--active': activePanel === 'theorycraft' }"
          @click="activePanel = 'theorycraft'"
        >
          {{ t('theorycraft.panel.theorycraftButton') }}
        </button>
        <TheorycraftRuneStackPanel variant="header" />
      </div>

      <div
        class="build-layout mb-6 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'build-layout--streamer': isLayoutScaled }"
      >
        <div class="build-card-wrapper w-full flex-shrink-0 md:order-1">
          <div class="build-card-toolbar">
            <button
              type="button"
              class="build-card-toolbar__flip build-card-toolbar__stats"
              :class="{ 'build-card-toolbar__flip--active': statsFlipActive }"
              :title="statsFlipTitle"
              :aria-label="statsFlipTitle"
              @click="toggleStatsFlip"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 20V10" />
                <path d="M10 20V4" />
                <path d="M16 20v-6" />
                <path d="M22 20V8" />
              </svg>
            </button>
            <div class="build-card-toolbar__save">
              <BuildSaveButton @highlight-missing="highlightMissingFields = $event" />
            </div>
            <label class="build-card-toolbar__level">
              <span class="build-card-toolbar__level-label">{{
                t('theorycraft.spells.level')
              }}</span>
              <select
                :value="theorycraftLevel"
                class="build-card-toolbar__level-select"
                @change="onLevelSelectChange"
              >
                <option v-for="lvl in maxChampionLevel" :key="lvl" :value="lvl">{{ lvl }}</option>
              </select>
            </label>
          </div>
          <BuildCard
            v-model:flipped="cardFlipped"
            :sheet-tooltips="true"
            :highlight-missing-fields="highlightMissingFields"
            selection-mode="theorycraft"
            :flip-back-face="cardBackFace"
            :active-selection-region="activePanel === 'theorycraft' ? null : activePanel"
            @select-region="onSelectRegion"
            @toggle-description-flip="toggleDescriptionFlip"
          />
        </div>

        <div class="theorycraft-workspace-col w-full min-w-0 flex-1 md:order-2">
          <TheorycraftWorkspacePanel
            :active-panel="activePanel"
            :champion-id="championId"
            :champion-data="championData"
            :level="theorycraftLevel"
            :build-stats="theorycraftStats"
            @set-panel="activePanel = $event"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import TheorycraftRuneStackPanel from '~/components/Build/TheorycraftRuneStackPanel.vue'
import TheorycraftWorkspacePanel, {
  type TheorycraftPanel,
} from '~/components/Build/TheorycraftWorkspacePanel.vue'
import { useChampionData } from '~/composables/useChampionData'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useBuildStore } from '~/stores/BuildStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { isTheorycraftRoutePath } from '~/utils/theorycraftRoute'
import { toTheorycraftBuildStats } from '~/utils/theorycraftStats'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const buildStore = useBuildStore()

if (import.meta.client) {
  buildStore.enterTheorycraftSession()
}

const itemsStore = useItemsStore()
const { loadChampion } = useChampionData()
const { isLayoutScaled } = useLayoutScaled()

const activePanel = ref<TheorycraftPanel>('theorycraft')
const theorycraftLevel = ref(18)
const cardFlipped = ref(false)
const cardBackFace = ref<'stats' | 'description'>('stats')
const highlightMissingFields = ref(false)
const championData = ref<Record<string, unknown> | null>(null)

const statsFlipActive = computed(() => cardFlipped.value && cardBackFace.value === 'stats')

const statsFlipTitle = computed(() =>
  statsFlipActive.value ? t('theorycraft.stats.showBuild') : t('theorycraft.stats.showStats')
)

function toggleDescriptionFlip() {
  if (cardFlipped.value && cardBackFace.value === 'description') {
    cardFlipped.value = false
    return
  }
  cardBackFace.value = 'description'
  cardFlipped.value = true
}

function toggleStatsFlip() {
  if (statsFlipActive.value) {
    cardFlipped.value = false
    return
  }
  cardBackFace.value = 'stats'
  cardFlipped.value = true
}

const championId = computed(() => buildStore.currentBuild?.champion?.id ?? null)

const maxChampionLevel = computed(() => buildStore.maxStatsLevel)

const theorycraftStats = computed(() => {
  const build = buildStore.displayedBuild ?? buildStore.currentBuild
  const stats = buildStore.calculatedStats
  if (!build?.champion || !stats) return null
  return toTheorycraftBuildStats(stats, build.champion, theorycraftLevel.value)
})

function onSelectRegion(region: 'champion' | 'items' | 'runes') {
  activePanel.value = region
}

function onLevelChange(level: number) {
  theorycraftLevel.value = level
  buildStore.setStatsLevel(level)
}

function onLevelSelectChange(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (Number.isFinite(value)) onLevelChange(value)
}

async function loadChampionDataForPanel() {
  const id = championId.value
  if (!id) {
    championData.value = null
    return
  }
  championData.value = await loadChampion(id)
  if (championData.value) {
    buildStore.mergeTheorycraftChampionDetail(championData.value)
  }
}

watch(championId, () => {
  loadChampionDataForPanel().catch(() => undefined)
})

watch(
  () => buildStore.statsLevel,
  level => {
    theorycraftLevel.value = level
  }
)

watch(maxChampionLevel, max => {
  if (theorycraftLevel.value > max) {
    buildStore.setStatsLevel(max)
  }
})

watch(
  () => itemsStore.items.length,
  (length, previous) => {
    if (length > 0 && (previous ?? 0) === 0) {
      buildStore.recalculateStats()
    }
  }
)

onMounted(async () => {
  theorycraftLevel.value = buildStore.statsLevel
  await loadChampionDataForPanel()
})

onBeforeRouteLeave(to => {
  if (isTheorycraftRoutePath(to.path)) return
  buildStore.leaveTheorycraftSession()
})
</script>

<style scoped>
.theorycraft-page__shell {
  width: 100%;
  max-width: 100%;
}

.theorycraft-workspace-col {
  margin-right: 0;
  align-self: flex-start;
}

.build-layout {
  --build-card-width: 293.9px;
}

.build-layout--streamer {
  --build-card-width: 390px;
}

.build-card-wrapper {
  width: var(--build-card-width);
  margin-top: 0;
}

.theorycraft-page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.theorycraft-header-actions__panel,
.theorycraft-header-actions__panel--active {
  height: 38px;
  border-radius: 0.5rem;
  border: 1px solid rgb(200 155 60 / 0.5);
  background: var(--color-background, #0a1428);
  padding: 0 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 0.85);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.theorycraft-header-actions__panel:hover {
  border-color: var(--color-accent, #c89b3c);
  color: var(--color-accent, #c89b3c);
}

.theorycraft-header-actions__panel--active {
  border-color: var(--color-accent, #c89b3c);
  background: rgb(200 155 60 / 0.15);
  color: var(--color-accent, #c89b3c);
}

.build-card-toolbar {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  margin-bottom: 0.5rem;
  align-items: center;
}

.build-card-toolbar__save {
  flex: 1;
  min-width: 0;
}

.build-card-toolbar__save :deep(.save-build-wrapper) {
  margin-bottom: 0;
  width: 100%;
}

.build-card-toolbar__save :deep(.save-build-button) {
  width: 100%;
  max-width: none;
  min-height: 38px;
}

.build-card-toolbar__flip {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 0.5rem;
  border: 1px solid rgb(200 155 60 / 0.5);
  background: var(--color-background, #0a1428);
  color: rgb(255 255 255 / 0.85);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.build-card-toolbar__flip:hover {
  border-color: var(--color-accent, #c89b3c);
  color: var(--color-accent, #c89b3c);
}

.build-card-toolbar__flip--active {
  border-color: var(--color-accent, #c89b3c);
  background: rgb(200 155 60 / 0.15);
  color: var(--color-accent, #c89b3c);
}

.build-card-toolbar__level {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.build-card-toolbar__level-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 0.65);
  line-height: 1;
  white-space: nowrap;
}

.build-card-toolbar__level-select {
  height: 28px;
  width: 2.75rem;
  min-width: 0;
  border-radius: 0.375rem;
  border: 1px solid rgb(200 155 60 / 0.5);
  background: var(--color-background, #0a1428);
  padding: 0 0.2rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text, #fff);
}

@media (max-width: 768px) {
  .build-card-wrapper {
    width: 100%;
    max-width: 100%;
  }
}
</style>
