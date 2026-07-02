<template>
  <div class="theorycraft-page min-h-screen text-text">
    <div class="theorycraft-page__shell">
      <div class="mb-3">
        <BuildMenuSteps current-step="theorycraft" :has-champion="hasChampion" />
      </div>

      <div class="theorycraft-page-header mb-4 pr-4">
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
        class="build-layout mb-6 flex flex-col items-start gap-4 md:flex-row"
        :class="{
          'build-layout--streamer': isLayoutScaled,
          'build-layout--versus': showVersus,
        }"
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
            :build="showVersus && activeSide !== 'ally' ? sideBuilds.ally : null"
            :calculated-stats="
              showVersus && activeSide !== 'ally' ? (sideCalculatedStats.ally ?? null) : null
            "
            :stats-level="theorycraftLevel"
            selection-mode="theorycraft"
            :flip-back-face="allyCardBackFace"
            :active-selection-region="
              showVersus && activeSide !== 'ally'
                ? null
                : activePanel === 'theorycraft'
                  ? null
                  : activePanel
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
import { computed, onMounted, ref, toRaw, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { Build, CalculatedStats } from '@lelanation/shared-types'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import TheorycraftRuneStackPanel from '~/components/Build/TheorycraftRuneStackPanel.vue'
import TheorycraftWorkspacePanel, {
  type TheorycraftPanel,
} from '~/components/Build/TheorycraftWorkspacePanel.vue'
import { useChampionData } from '~/composables/useChampionData'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useBuildStore } from '~/stores/BuildStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { isBuilderCreateRoutePath, isTheorycraftRoutePath } from '~/utils/theorycraftRoute'
import { toTheorycraftBuildStats } from '~/utils/theorycraftStats'

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

const itemsStore = useItemsStore()
const { loadChampion } = useChampionData()
const { isLayoutScaled } = useLayoutScaled()

type TheorycraftSide = 'ally' | 'enemy'
const THEORYCRAFT_VS_STATE_STORAGE_PREFIX = 'lelanation_theorycraft_vs_state_v1_'

interface TheorycraftVsStoredState {
  ally: Build | null
  enemy: Build | null
  showVersus: boolean
  activeSide: TheorycraftSide
}

const activePanel = ref<TheorycraftPanel>('theorycraft')
const theorycraftLevel = ref(18)
const activeSide = ref<TheorycraftSide>('ally')
const showVersus = ref(false)
const sideBuilds = ref<Record<TheorycraftSide, Build | null>>({
  ally: null,
  enemy: null,
})
const sideCalculatedStats = ref<Record<TheorycraftSide, CalculatedStats | null>>({
  ally: null,
  enemy: null,
})
const sidePanels = ref<Record<TheorycraftSide, TheorycraftPanel>>({
  ally: 'theorycraft',
  enemy: 'theorycraft',
})
const sideFlipped = ref<Record<TheorycraftSide, boolean>>({
  ally: false,
  enemy: false,
})
const sideBackFace = ref<Record<TheorycraftSide, 'stats' | 'description'>>({
  ally: 'stats',
  enemy: 'stats',
})
const highlightMissingFields = ref(false)
const championData = ref<Record<string, unknown> | null>(null)
const isHydratingVsState = ref(true)

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

function cloneBuild(build: Build | null): Build | null {
  if (!build) return null
  try {
    const cloned = JSON.parse(JSON.stringify(toRaw(build))) as Build
    return {
      ...cloned,
      subBuilds: [],
      descriptionMode: 'single',
    } as Build
  } catch {
    return null
  }
}

function createEmptyTheorycraftBuild(name: string): Build {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    author: '',
    description: '',
    visibility: 'public',
    champion: null,
    items: [],
    runes: null,
    shards: {
      slot1: 5008,
      slot2: 5008,
      slot3: 5011,
    },
    summonerSpells: [null, null],
    skillOrder: {
      firstThreeUps: [null as any, null as any, null as any],
      skillUpOrder: [null as any, null as any, null as any],
    },
    roles: [],
    tags: [],
    upvote: 0,
    downvote: 0,
    gameVersion: '',
    createdAt: now,
    updatedAt: now,
    subBuilds: [],
    descriptionMode: 'single',
  } as Build
}

function persistActiveSideBuild() {
  sideBuilds.value[activeSide.value] = cloneBuild(buildStore.currentBuild)
}

function persistActiveSideStats() {
  sideCalculatedStats.value[activeSide.value] = buildStore.calculatedStats
    ? ({ ...buildStore.calculatedStats } as CalculatedStats)
    : null
}

function loadSideBuild(side: TheorycraftSide) {
  const target = cloneBuild(sideBuilds.value[side])
  if (!target) return
  buildStore.setCurrentBuild(target)
}

function vsStateStorageKey(): string | null {
  const buildId = buildStore.currentBuild?.id
  return buildId ? `${THEORYCRAFT_VS_STATE_STORAGE_PREFIX}${buildId}` : null
}

function restoreBuilderBuildBeforeLeave(): void {
  persistActiveSideBuild()
  persistActiveSideStats()
  activeSide.value = 'ally'
  if (sideBuilds.value.ally) {
    const ally = cloneBuild(sideBuilds.value.ally)
    if (ally) buildStore.setCurrentBuild(ally)
  }
  persistVsState()
}

function persistVsState() {
  const key = vsStateStorageKey()
  if (import.meta.server || !key) return
  try {
    const payload: TheorycraftVsStoredState = {
      ally: cloneBuild(sideBuilds.value.ally),
      enemy: cloneBuild(sideBuilds.value.enemy),
      showVersus: showVersus.value,
      activeSide: activeSide.value,
    }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // ignore persistence errors
  }
}

function loadVsState(): TheorycraftVsStoredState | null {
  const key = vsStateStorageKey()
  if (import.meta.server || !key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TheorycraftVsStoredState>
    const active = parsed.activeSide === 'enemy' ? 'enemy' : 'ally'
    return {
      ally: cloneBuild((parsed.ally as Build | null) ?? null),
      enemy: cloneBuild((parsed.enemy as Build | null) ?? null),
      showVersus: Boolean(parsed.showVersus),
      activeSide: active,
    }
  } catch {
    return null
  }
}

function activateSide(side: TheorycraftSide) {
  if (activeSide.value === side) return
  persistActiveSideBuild()
  persistActiveSideStats()
  sidePanels.value[activeSide.value] = activePanel.value
  activeSide.value = side
  activePanel.value = sidePanels.value[side] ?? 'theorycraft'
  if (!sideBuilds.value[side]) {
    sideBuilds.value[side] = createEmptyTheorycraftBuild(
      side === 'enemy' ? t('theorycraft.panel.enemyCard') : 'Build'
    )
  }
  loadSideBuild(side)
}

function toggleVersus() {
  if (showVersus.value) {
    if (activeSide.value === 'enemy') activateSide('ally')
    showVersus.value = false
    return
  }
  persistActiveSideBuild()
  if (!sideBuilds.value.enemy) {
    sideBuilds.value.enemy = createEmptyTheorycraftBuild(t('theorycraft.panel.enemyCard'))
  }
  showVersus.value = true
}

function statsFlipActive(side: TheorycraftSide): boolean {
  return sideFlipped.value[side] && sideBackFace.value[side] === 'stats'
}

function statsFlipTitle(side: TheorycraftSide): string {
  return statsFlipActive(side) ? t('theorycraft.stats.showBuild') : t('theorycraft.stats.showStats')
}

function theorycraftPanelActive(side: TheorycraftSide): boolean {
  return activeSide.value === side && activePanel.value === 'theorycraft'
}

function toggleDescriptionFlip(side: TheorycraftSide) {
  if (activeSide.value !== side) activateSide(side)
  if (sideFlipped.value[side] && sideBackFace.value[side] === 'description') {
    sideFlipped.value = { ...sideFlipped.value, [side]: false }
    return
  }
  sideBackFace.value = { ...sideBackFace.value, [side]: 'description' }
  sideFlipped.value = { ...sideFlipped.value, [side]: true }
}

function toggleStatsFlip(side: TheorycraftSide) {
  if (activeSide.value !== side) activateSide(side)
  if (statsFlipActive(side)) {
    sideFlipped.value = { ...sideFlipped.value, [side]: false }
    return
  }
  sideBackFace.value = { ...sideBackFace.value, [side]: 'stats' }
  sideFlipped.value = { ...sideFlipped.value, [side]: true }
}

function activateTheorycraft(side: TheorycraftSide) {
  if (activeSide.value !== side) activateSide(side)
  activePanel.value = 'theorycraft'
  sidePanels.value[side] = 'theorycraft'
}

const championId = computed(() => buildStore.currentBuild?.champion?.id ?? null)

const maxChampionLevel = computed(() => buildStore.maxStatsLevel)

const theorycraftStats = computed(() => {
  const build = buildStore.displayedBuild ?? buildStore.currentBuild
  const stats = buildStore.calculatedStats
  if (!build?.champion || !stats) return null
  return toTheorycraftBuildStats(stats, build.champion, theorycraftLevel.value)
})

const opponentTheorycraftStats = computed(() => {
  if (!showVersus.value) return null
  const opponentSide: TheorycraftSide = activeSide.value === 'ally' ? 'enemy' : 'ally'
  const opponentBuild = sideBuilds.value[opponentSide]
  const opponentRaw = sideCalculatedStats.value[opponentSide]
  if (!opponentBuild?.champion || !opponentRaw) return null
  return toTheorycraftBuildStats(
    opponentRaw as any,
    opponentBuild.champion as any,
    theorycraftLevel.value
  )
})

const opponentRawStats = computed(() => {
  if (!showVersus.value) return null
  const opponentSide: TheorycraftSide = activeSide.value === 'ally' ? 'enemy' : 'ally'
  return sideCalculatedStats.value[opponentSide]
})

const attackerRawStats = computed(() => sideCalculatedStats.value[activeSide.value] ?? null)

function onSelectRegion(side: TheorycraftSide, region: 'champion' | 'items' | 'runes') {
  if (activeSide.value !== side) activateSide(side)
  activePanel.value = region
  sidePanels.value[side] = region
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
  () => buildStore.currentBuild,
  build => {
    sideBuilds.value[activeSide.value] = cloneBuild(build)
  },
  { deep: true }
)

watch(
  () => buildStore.calculatedStats,
  stats => {
    sideCalculatedStats.value[activeSide.value] = stats ? ({ ...stats } as CalculatedStats) : null
  },
  { deep: true }
)

watch(
  [sideBuilds, showVersus, activeSide],
  () => {
    if (isHydratingVsState.value) return
    persistVsState()
  },
  { deep: true }
)

watch(activePanel, panel => {
  sidePanels.value[activeSide.value] = panel
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

  buildStore.activateTheorycraftMode()
  buildStore.setLastBuilderStep('theorycraft')
  theorycraftLevel.value = buildStore.statsLevel

  const currentBuildSnapshot = cloneBuild(buildStore.currentBuild)
  sideBuilds.value.ally = currentBuildSnapshot
  sideCalculatedStats.value.ally = buildStore.calculatedStats
    ? ({ ...buildStore.calculatedStats } as CalculatedStats)
    : null

  const storedVs = loadVsState()
  const currentChampionId = buildStore.currentBuild.champion?.id
  const storedAllyChampionId = storedVs?.ally?.champion?.id
  const canRestoreVersus =
    Boolean(storedVs?.showVersus) &&
    Boolean(storedVs?.enemy) &&
    storedAllyChampionId === currentChampionId

  if (canRestoreVersus && storedVs) {
    sideBuilds.value.enemy = storedVs.enemy
    showVersus.value = true
    if (storedVs.activeSide === 'enemy') {
      activeSide.value = 'enemy'
      activePanel.value = sidePanels.value.enemy ?? 'theorycraft'
      loadSideBuild('enemy')
    } else {
      activeSide.value = 'ally'
      activePanel.value = sidePanels.value.ally ?? 'theorycraft'
    }
  } else {
    sideBuilds.value.enemy = null
    showVersus.value = false
    activeSide.value = 'ally'
    activePanel.value = sidePanels.value.ally ?? 'theorycraft'
  }

  isHydratingVsState.value = false
  persistVsState()

  await loadChampionDataForPanel()
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
