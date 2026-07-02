<template>
  <div class="build-detail-theorycraft w-full">
    <div class="theorycraft-page-header mb-4">
      <button
        type="button"
        class="theorycraft-vs-toggle"
        :class="{ 'theorycraft-vs-toggle--active': showVersus }"
        :title="showVersus ? t('theorycraft.panel.vsDisable') : t('theorycraft.panel.vsEnable')"
        :aria-label="
          showVersus ? t('theorycraft.panel.vsDisable') : t('theorycraft.panel.vsEnable')
        "
        @click="toggleVersus"
      >
        {{ t('theorycraft.panel.vsButton') }}
      </button>
      <TheorycraftRuneStackPanel variant="header" />
    </div>

    <div
      class="build-layout flex flex-col items-start gap-4 md:flex-row"
      :class="{
        'build-layout--streamer': isLayoutScaled,
        'build-layout--versus': showVersus,
      }"
    >
      <div class="build-card-wrapper w-full flex-shrink-0 md:order-1" @click="activateSide('ally')">
        <div class="build-card-toolbar">
          <div class="build-card-toolbar__actions">
            <button
              type="button"
              class="build-card-toolbar__flip build-card-toolbar__stats"
              :class="{ 'build-card-toolbar__flip--active': statsFlipActive('ally') }"
              :title="statsFlipTitle('ally')"
              :aria-label="statsFlipTitle('ally')"
              @click="toggleStatsFlip('ally')"
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
            <button
              type="button"
              class="build-card-toolbar__flip build-card-toolbar__theorycraft"
              :class="{ 'build-card-toolbar__flip--active': theorycraftPanelActive('ally') }"
              :title="theorycraftPanelTitle"
              :aria-label="theorycraftPanelTitle"
              @click="activateTheorycraft('ally')"
            >
              <img
                src="/icons/theorycraft.png"
                alt=""
                class="build-card-toolbar__theorycraft-icon"
                aria-hidden="true"
              />
            </button>
          </div>
          <div class="build-card-toolbar__save" />
          <label class="build-card-toolbar__level">
            <span class="build-card-toolbar__level-label">{{ t('theorycraft.spells.level') }}</span>
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
          v-model:flipped="allyCardFlipped"
          :sheet-tooltips="true"
          :readonly="false"
          :build="showVersus && activeSide !== 'ally' ? sideBuilds.ally : null"
          :calculated-stats="
            showVersus && activeSide !== 'ally' ? (sideCalculatedStats.ally ?? null) : null
          "
          :stats-level="theorycraftLevel"
          selection-mode="theorycraft"
          :flip-back-face="sideBackFace.ally"
          :active-selection-region="null"
          @toggle-description-flip="toggleDescriptionFlip('ally')"
        />
      </div>

      <div class="theorycraft-workspace-col w-full min-w-0 flex-1 md:order-2">
        <TheorycraftWorkspacePanel
          :active-panel="activePanel"
          :champion-id="championId"
          :champion-data="championData"
          :level="theorycraftLevel"
          :build-stats="theorycraftStats"
          :attacker-raw-stats="attackerRawStats"
          :opponent-build-stats="opponentTheorycraftStats"
          :opponent-raw-stats="opponentRawStats"
        />
      </div>

      <div
        v-if="showVersus"
        class="build-card-wrapper w-full flex-shrink-0 md:order-3"
        @click="activateSide('enemy')"
      >
        <div class="build-card-toolbar">
          <div class="build-card-toolbar__actions">
            <button
              type="button"
              class="build-card-toolbar__flip build-card-toolbar__stats"
              :class="{ 'build-card-toolbar__flip--active': statsFlipActive('enemy') }"
              :title="statsFlipTitle('enemy')"
              :aria-label="statsFlipTitle('enemy')"
              @click="toggleStatsFlip('enemy')"
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
            <button
              type="button"
              class="build-card-toolbar__flip build-card-toolbar__theorycraft"
              :class="{ 'build-card-toolbar__flip--active': theorycraftPanelActive('enemy') }"
              :title="theorycraftPanelTitle"
              :aria-label="theorycraftPanelTitle"
              @click="activateTheorycraft('enemy')"
            >
              <img
                src="/icons/theorycraft.png"
                alt=""
                class="build-card-toolbar__theorycraft-icon"
                aria-hidden="true"
              />
            </button>
          </div>
          <div class="build-card-toolbar__save">
            <span
              class="build-card-toolbar__side-label"
              :class="{ 'build-card-toolbar__side-label--active': activeSide === 'enemy' }"
            >
              {{ t('theorycraft.panel.enemyCard') }}
            </span>
          </div>
          <label class="build-card-toolbar__level">
            <span class="build-card-toolbar__level-label">{{ t('theorycraft.spells.level') }}</span>
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
          v-model:flipped="enemyCardFlipped"
          :sheet-tooltips="true"
          :readonly="false"
          :build="activeSide !== 'enemy' ? sideBuilds.enemy : null"
          :calculated-stats="activeSide !== 'enemy' ? (sideCalculatedStats.enemy ?? null) : null"
          :stats-level="theorycraftLevel"
          selection-mode="theorycraft"
          :flip-back-face="sideBackFace.enemy"
          :active-selection-region="
            activeSide !== 'enemy' ? null : activePanel === 'theorycraft' ? null : activePanel
          "
          @select-region="onSelectRegion('enemy', $event)"
          @toggle-description-flip="toggleDescriptionFlip('enemy')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, toRef } from 'vue'
import BuildCard from '~/components/Build/BuildCard.vue'
import TheorycraftRuneStackPanel from '~/components/Build/TheorycraftRuneStackPanel.vue'
import TheorycraftWorkspacePanel from '~/components/Build/TheorycraftWorkspacePanel.vue'
import { useBuildDetailTheorycraft } from '~/composables/useBuildDetailTheorycraft'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import type { Build } from '~/types/build'

const props = defineProps<{
  build: Build | null
}>()

const { t } = useI18n()
const { isLayoutScaled } = useLayoutScaled()
const sourceBuild = toRef(props, 'build')
const theorycraftPanelTitle = computed(() => t('theorycraft.panel.theorycraftButton'))

const {
  activeSide,
  activePanel,
  showVersus,
  sideBuilds,
  sideCalculatedStats,
  sideFlipped,
  sideBackFace,
  theorycraftLevel,
  championData,
  championId,
  maxChampionLevel,
  theorycraftStats,
  opponentTheorycraftStats,
  opponentRawStats,
  attackerRawStats,
  enter,
  leave,
  activateSide,
  toggleVersus,
  statsFlipActive,
  statsFlipTitle,
  theorycraftPanelActive,
  toggleDescriptionFlip,
  toggleStatsFlip,
  activateTheorycraft,
  onSelectRegion,
  onLevelSelectChange,
} = useBuildDetailTheorycraft(sourceBuild)

const allyCardFlipped = computed({
  get: () => sideFlipped.value.ally,
  set: value => {
    sideFlipped.value = { ...sideFlipped.value, ally: value }
  },
})

const enemyCardFlipped = computed({
  get: () => sideFlipped.value.enemy,
  set: value => {
    sideFlipped.value = { ...sideFlipped.value, enemy: value }
  },
})

onMounted(() => {
  enter()
})

onUnmounted(() => {
  leave()
})
</script>

<style scoped>
.build-detail-theorycraft {
  overflow-x: clip;
}

.theorycraft-workspace-col {
  margin-right: 0;
  align-self: flex-start;
}

.build-layout {
  --build-card-width: 293.9px;
  flex-wrap: wrap;
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
  padding-top: 5px;
}

.theorycraft-vs-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 38px;
  padding: 0 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(200 155 60 / 0.5);
  background: var(--color-background, #0a1428);
  color: rgb(255 255 255 / 0.9);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.theorycraft-vs-toggle:hover {
  border-color: var(--color-accent, #c89b3c);
  color: var(--color-accent, #c89b3c);
}

.theorycraft-vs-toggle--active {
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

.build-card-toolbar__side-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 0.65);
  flex-shrink: 0;
}

.build-card-toolbar__side-label--active {
  color: #c89b3c;
  text-shadow: 0 0 12px rgb(200 155 60 / 0.6);
}

.build-card-toolbar__save {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.build-card-toolbar__actions {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.375rem;
}

.build-card-toolbar__theorycraft-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  display: block;
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
  flex-direction: column;
  align-items: center;
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
  white-space: nowrap;
}

.build-card-toolbar__level-select {
  height: 24px;
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
  .build-layout--streamer {
    --build-card-width: calc(100vw - 1.5rem);
  }

  .build-card-wrapper {
    width: 100%;
    max-width: 100%;
  }
}

@media (min-width: 768px) {
  .build-layout--versus {
    display: grid !important;
    grid-template-columns: var(--build-card-width) minmax(0, 1fr) var(--build-card-width);
    align-items: start;
  }
}
</style>
