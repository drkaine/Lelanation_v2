<template>
  <div class="theorycraft-page min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          class="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
          :class="
            activePanel === 'theorycraft'
              ? 'border-accent bg-accent/20 text-accent'
              : 'border-border bg-surface text-text hover:border-accent hover:text-accent'
          "
          @click="activePanel = 'theorycraft'"
        >
          {{ t('theorycraft.panel.theorycraftButton') }}
        </button>
        <NuxtLink
          :to="localePath('/builds')"
          class="rounded-lg bg-surface px-4 py-2 text-text transition-colors hover:bg-primary hover:text-white"
        >
          {{ t('theorycraft.backToBuilds') }}
        </NuxtLink>
      </div>

      <div
        class="build-layout mb-6 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'build-layout--streamer': isLayoutScaled }"
      >
        <div class="build-card-wrapper w-full flex-shrink-0 md:order-1">
          <div class="build-card-toolbar">
            <button
              type="button"
              class="build-card-toolbar__stats"
              :class="{ 'build-card-toolbar__stats--active': cardFlipped }"
              :title="
                cardFlipped ? t('theorycraft.stats.showBuild') : t('theorycraft.stats.showStats')
              "
              @click="cardFlipped = !cardFlipped"
            >
              {{ t('theorycraft.stats.toggle') }}
            </button>
            <div class="build-card-toolbar__save">
              <BuildSaveButton @highlight-missing="highlightMissingFields = $event" />
            </div>
            <label class="build-card-toolbar__level">
              <span class="build-card-toolbar__level-label">{{
                t('theorycraft.spells.championLevel')
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
            flip-back-face="stats"
            hide-top-actions
            :active-selection-region="activePanel === 'theorycraft' ? null : activePanel"
            @select-region="onSelectRegion"
          />
        </div>

        <div class="w-full flex-1 md:order-2">
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import TheorycraftWorkspacePanel, {
  type TheorycraftPanel,
} from '~/components/Build/TheorycraftWorkspacePanel.vue'
import { useChampionData } from '~/composables/useChampionData'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useBuildStore } from '~/stores/BuildStore'
import { toTheorycraftBuildStats } from '~/utils/theorycraftStats'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const buildStore = useBuildStore()
const { loadChampion } = useChampionData()
const { isLayoutScaled } = useLayoutScaled()

const activePanel = ref<TheorycraftPanel>(null)
const theorycraftLevel = ref(18)
const cardFlipped = ref(false)
const highlightMissingFields = ref(false)
const championData = ref<Record<string, unknown> | null>(null)

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

onMounted(async () => {
  buildStore.enterTheorycraftSession()
  theorycraftLevel.value = buildStore.statsLevel

  const queryChampion = typeof route.query.champion === 'string' ? route.query.champion : null
  if (queryChampion && !buildStore.currentBuild?.champion) {
    activePanel.value = 'champion'
  }

  await loadChampionDataForPanel()
})

onUnmounted(() => {
  buildStore.leaveTheorycraftSession()
})
</script>

<style scoped>
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

.build-card-toolbar {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  margin-bottom: 0.5rem;
  align-items: stretch;
}

.build-card-toolbar__stats {
  flex-shrink: 0;
  height: 38px;
  border-radius: 0.5rem;
  border: 1px solid rgb(200 155 60 / 0.5);
  background: var(--color-background, #0a1428);
  padding: 0 0.75rem;
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

.build-card-toolbar__stats:hover {
  border-color: var(--color-accent, #c89b3c);
  color: var(--color-accent, #c89b3c);
}

.build-card-toolbar__stats--active {
  border-color: var(--color-accent, #c89b3c);
  background: rgb(200 155 60 / 0.15);
  color: var(--color-accent, #c89b3c);
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

.build-card-toolbar__level {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.125rem;
  flex-shrink: 0;
}

.build-card-toolbar__level-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 0.65);
  line-height: 1;
}

.build-card-toolbar__level-select {
  height: 38px;
  min-width: 3.25rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(200 155 60 / 0.5);
  background: var(--color-background, #0a1428);
  padding: 0 0.375rem;
  font-size: 0.875rem;
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
