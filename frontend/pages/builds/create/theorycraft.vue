<template>
  <div class="theorycraft-page min-h-screen text-text">
    <div class="theorycraft-page__shell">
      <div class="mb-3">
        <BuildMenuSteps current-step="theorycraft" :has-champion="hasChampion" />
      </div>

      <div class="theorycraft-page-header mb-4 pr-4">
        <TheorycraftRuneStackPanel variant="header" />
      </div>

      <div
        class="build-layout build-layout--versus mb-6 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'build-layout--streamer': isLayoutScaled }"
      >
        <div
          class="build-card-wrapper w-full flex-shrink-0 md:order-1"
          @click="activateSide('ally')"
        >
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
            v-model:flipped="allyCardFlipped"
            :sheet-tooltips="true"
            :highlight-missing-fields="highlightMissingFields"
            :readonly="false"
            :build="activeSide !== 'ally' ? sideBuilds.ally : null"
            :calculated-stats="activeSide !== 'ally' ? (sideCalculatedStats.ally ?? null) : null"
            :stats-level="theorycraftLevel"
            selection-mode="theorycraft"
            :flip-back-face="allyCardBackFace"
            :active-selection-region="
              activeSide !== 'ally' ? null : activePanel === 'theorycraft' ? null : activePanel
            "
            @select-region="onSelectRegion('ally', $event)"
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
            @set-panel="activePanel = $event"
          />
        </div>

        <div
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
            v-model:flipped="enemyCardFlipped"
            :sheet-tooltips="true"
            :highlight-missing-fields="highlightMissingFields"
            :readonly="false"
            :build="activeSide !== 'enemy' ? sideBuilds.enemy : null"
            :calculated-stats="activeSide !== 'enemy' ? (sideCalculatedStats.enemy ?? null) : null"
            :stats-level="theorycraftLevel"
            selection-mode="theorycraft"
            :flip-back-face="enemyCardBackFace"
            :active-selection-region="
              activeSide !== 'enemy' ? null : activePanel === 'theorycraft' ? null : activePanel
            "
            @select-region="onSelectRegion('enemy', $event)"
            @toggle-description-flip="toggleDescriptionFlip('enemy')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import TheorycraftRuneStackPanel from '~/components/Build/TheorycraftRuneStackPanel.vue'
import TheorycraftWorkspacePanel from '~/components/Build/TheorycraftWorkspacePanel.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import {
  cloneBuild,
  theorycraftVsStorageKey,
  useTheorycraftVs,
} from '~/composables/useTheorycraftVs'
import { useBuildStore } from '~/stores/BuildStore'
import { theorycraftVsScope } from '~/utils/theorycraftStorageScope'
import { isBuilderCreateRoutePath, isTheorycraftRoutePath } from '~/utils/theorycraftRoute'

definePageMeta({
  layout: false,
})

useHead({
  title: 'Créer un build - Theorycraft',
  meta: [
    {
      name: 'description',
      content: 'Affinez les stats de votre build avec le mode theorycraft',
    },
  ],
})

const { t } = useI18n()
const buildStore = useBuildStore()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()

const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

const { isLayoutScaled } = useLayoutScaled()

const highlightMissingFields = ref(false)
const vsSessionId = ref('')

const vs = useTheorycraftVs({
  storageKey: () => (vsSessionId.value ? theorycraftVsStorageKey(vsSessionId.value) : null),
  scope: side => (vsSessionId.value ? theorycraftVsScope(vsSessionId.value, side) : null),
  isActive: () => true,
  t,
})
vs.isHydratingVsState.value = true

const {
  activePanel,
  theorycraftLevel,
  activeSide,
  sideBuilds,
  sideCalculatedStats,
  sideFlipped,
  sideBackFace,
  championData,
  allyDisplayedVariant,
  championId,
  maxChampionLevel,
  theorycraftStats,
  opponentTheorycraftStats,
  opponentRawStats,
  attackerRawStats,
  activateSide,
  statsFlipActive,
  statsFlipTitle,
  theorycraftPanelActive,
  toggleDescriptionFlip,
  toggleStatsFlip,
  activateTheorycraft,
  onSelectRegion,
  onLevelSelectChange,
} = vs

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

const allyCardBackFace = computed(() => sideBackFace.value.ally)
const enemyCardBackFace = computed(() => sideBackFace.value.enemy)

const theorycraftPanelTitle = computed(() => t('theorycraft.panel.theorycraftButton'))

function restoreBuilderBuildBeforeLeave(): void {
  vs.persistActiveSideBuild()
  vs.persistActiveSideStats()
  activeSide.value = 'ally'
  const ally = cloneBuild(sideBuilds.value.ally)
  if (ally) vs.setAllyInStore(ally)
  vs.persistVsState()
}

onMounted(async () => {
  const editId = typeof route.query.editId === 'string' ? route.query.editId : null
  if (editId && buildStore.editSourceBuildId !== editId) {
    const loaded = buildStore.startEditingBuild(editId)
    if (!loaded) buildStore.ensureCurrentBuild()
  } else {
    buildStore.ensureCurrentBuild()
  }

  if (!buildStore.currentBuild?.champion) {
    const query: Record<string, string> = {}
    const id = buildStore.editSourceBuildId
    if (id) query.editId = id
    if (route.query.app === 'on') query.app = 'on'
    await router.replace(localePath({ path: '/builds/create/champion', query }))
    return
  }

  vsSessionId.value = buildStore.currentBuild.id ?? crypto.randomUUID()
  buildStore.setTheorycraftStorageScope(theorycraftVsScope(vsSessionId.value, 'ally'))
  buildStore.activateTheorycraftMode()
  buildStore.setLastBuilderStep('theorycraft')
  theorycraftLevel.value = buildStore.statsLevel
  allyDisplayedVariant.value = buildStore.displayedVariant

  const storedVs = vs.loadVsState()
  const currentChampionId = buildStore.currentBuild.champion?.id

  if (storedVs?.ally && storedVs.ally.champion?.id === currentChampionId) {
    sideBuilds.value.ally = storedVs.ally
    if (storedVs.allyDisplayedVariant !== undefined) {
      allyDisplayedVariant.value = storedVs.allyDisplayedVariant
    }
    vs.setAllyInStore(cloneBuild(storedVs.ally)!)
    buildStore.reloadTheorycraftModifiers()
  } else {
    sideBuilds.value.ally = cloneBuild(buildStore.currentBuild)
  }
  sideCalculatedStats.value.ally = vs.storeStatsSnapshot()

  const canRestoreEnemy =
    Boolean(storedVs?.enemy) && sideBuilds.value.ally?.champion?.id === currentChampionId
  sideBuilds.value.enemy = canRestoreEnemy && storedVs ? storedVs.enemy : vs.emptyEnemyBuild()

  vs.restoreActiveSide(storedVs)

  vs.isHydratingVsState.value = false
  vs.persistVsState()

  await vs.loadChampionDataForPanel()
})

onBeforeRouteLeave(to => {
  restoreBuilderBuildBeforeLeave()

  if (isTheorycraftRoutePath(to.path)) return
  if (isBuilderCreateRoutePath(to.path)) {
    buildStore.deactivateTheorycraftMode()
    return
  }
  buildStore.leaveTheorycraftSession()
})
</script>

<style scoped>
.theorycraft-page__shell {
  width: 100%;
  max-width: 100%;
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

.build-card-toolbar__save :deep(.save-build-wrapper) {
  margin-bottom: 0;
  width: 100%;
}

.build-card-toolbar__save :deep(.save-build-button) {
  width: 100%;
  max-width: none;
  min-height: 38px;
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
    gap: 1rem;
  }
}
</style>
