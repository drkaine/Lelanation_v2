<template>
  <div class="statistics-settings min-h-screen w-full px-3 py-4 text-text sm:px-5 lg:px-6">
    <div class="w-full space-y-4">
      <nav
        class="flex flex-wrap gap-2"
        role="tablist"
        :aria-label="t('statisticsPage.settingsPageTabsAria')"
      >
        <button
          v-for="tab in settingsPageTabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="ui-build-card-button px-3 py-2 text-sm font-medium transition"
          :class="{ 'is-active': activeSettingsPageTab === tab.id }"
          :aria-selected="activeSettingsPageTab === tab.id"
          @click="activeSettingsPageTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div v-show="activeSettingsPageTab === 'tabs'" class="space-y-4" role="tabpanel">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p class="text-xs text-text/55">
            {{ t('statisticsPage.settingsDefaultTabHint') }}
          </p>
          <span class="text-xs text-text/55">
            {{
              t('statisticsPage.settingsVisibleCount', {
                count: visibleCount,
                total: tabRows.length,
              })
            }}
          </span>
          <button type="button" class="ui-build-card-button px-2.5 py-1 text-xs" @click="resetTabs">
            {{ t('statisticsPage.settingsReset') }}
          </button>
        </div>

        <ul class="settings-order-grid">
          <li
            v-for="(row, index) in tabRows"
            :key="row.id"
            class="settings-order-card ui-build-card-surface"
            :class="row.visible ? 'opacity-100' : 'opacity-55'"
            draggable="true"
            @dragstart="onTabDragStart(index)"
            @dragover.prevent
            @drop="onTabDrop(index)"
          >
            <div class="settings-order-card__label">
              {{ row.label }}
            </div>
            <div class="settings-order-card__row">
              <div class="settings-order-card__moves">
                <button
                  type="button"
                  class="settings-order-card__move ui-build-card-button"
                  :disabled="index === 0"
                  :aria-label="t('statisticsPage.settingsTabMoveUp', { tab: row.label })"
                  @click="moveTab(row.id, 'up')"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="settings-order-card__move ui-build-card-button"
                  :disabled="index === tabRows.length - 1"
                  :aria-label="t('statisticsPage.settingsTabMoveDown', { tab: row.label })"
                  @click="moveTab(row.id, 'down')"
                >
                  ↓
                </button>
              </div>
              <label
                class="settings-order-card__default"
                :class="{ 'is-disabled': !row.visible }"
                @mousedown.stop
                @click.stop
              >
                <input
                  type="radio"
                  name="statistics-default-tab"
                  class="settings-order-card__default-input"
                  :checked="row.isDefault"
                  :disabled="!row.visible"
                  :aria-label="t('statisticsPage.settingsDefaultTabAria', { tab: row.label })"
                  @change="setDefaultTab(row.id)"
                  @dragstart.stop
                />
                <span>{{ t('statisticsPage.settingsDefaultTab') }}</span>
              </label>
              <button
                type="button"
                class="command-toggle command-toggle-button settings-order-card__toggle"
                :aria-pressed="row.visible"
                :aria-label="row.label"
                @click="toggleTab(row.id)"
              >
                <span class="command-toggle-track" :class="{ active: row.visible }">
                  <span class="command-toggle-thumb" />
                </span>
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div v-show="activeSettingsPageTab === 'homeSections'" class="space-y-4" role="tabpanel">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p class="text-xs text-text/55">
            {{ t('statisticsPage.settingsHomeSectionsHint') }}
          </p>
          <span class="text-xs text-text/55">
            {{
              t('statisticsPage.settingsVisibleCount', {
                count: visibleHomeSectionCount,
                total: homeSectionRows.length,
              })
            }}
          </span>
          <button
            type="button"
            class="ui-build-card-button px-2.5 py-1 text-xs"
            @click="resetHomeSections"
          >
            {{ t('statisticsPage.settingsReset') }}
          </button>
        </div>

        <ul class="settings-order-grid">
          <li
            v-for="(row, index) in homeSectionRows"
            :key="row.id"
            class="settings-order-card ui-build-card-surface"
            :class="row.visible ? 'opacity-100' : 'opacity-55'"
            draggable="true"
            @dragstart="onHomeSectionDragStart(index)"
            @dragover.prevent
            @drop="onHomeSectionDrop(index)"
          >
            <div class="settings-order-card__label">
              {{ row.label }}
            </div>
            <div class="settings-order-card__row settings-order-card__row--home">
              <div class="settings-order-card__moves">
                <button
                  type="button"
                  class="settings-order-card__move ui-build-card-button"
                  :disabled="index === 0"
                  :aria-label="
                    t('statisticsPage.settingsHomeSectionMoveUp', { section: row.label })
                  "
                  @click="moveHomeSection(row.id, 'up')"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="settings-order-card__move ui-build-card-button"
                  :disabled="index === homeSectionRows.length - 1"
                  :aria-label="
                    t('statisticsPage.settingsHomeSectionMoveDown', { section: row.label })
                  "
                  @click="moveHomeSection(row.id, 'down')"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                class="command-toggle command-toggle-button settings-order-card__toggle"
                :aria-pressed="row.visible"
                :aria-label="row.label"
                @click="toggleHomeSection(row.id)"
              >
                <span class="command-toggle-track" :class="{ active: row.visible }">
                  <span class="command-toggle-thumb" />
                </span>
              </button>
            </div>
          </li>
        </ul>
      </div>

      <section v-show="activeSettingsPageTab === 'watchlist'" class="space-y-3" role="tabpanel">
        <p class="text-sm text-text/70">
          {{ t('statisticsPage.settingsWatchlistDescription') }}
        </p>

        <StatisticsWatchedChampionPicker
          :model-value="statisticsUiStore.watchedChampionIds"
          @update:model-value="setWatchedChampions"
        />
      </section>

      <div v-show="activeSettingsPageTab === 'alerts'" role="tabpanel">
        <StatisticsSurveillanceAlertSettings />
      </div>

      <div v-show="activeSettingsPageTab === 'howItWorks'" role="tabpanel">
        <SettingsHowItWorksPanel />
      </div>

      <div v-show="activeSettingsPageTab === 'dataTransfer'" role="tabpanel">
        <SettingsDataTransferPanel />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { STATISTICS_MAIN_TAB_LABEL_KEYS } from '~/constants/statisticsMainTabs'
import { HOME_SECTION_LABEL_KEYS } from '~/constants/homeSections'
import StatisticsSurveillanceAlertSettings from '~/components/statistics/StatisticsSurveillanceAlertSettings.vue'
import SettingsHowItWorksPanel from '~/components/settings/SettingsHowItWorksPanel.vue'
import SettingsDataTransferPanel from '~/components/settings/SettingsDataTransferPanel.vue'
import { useStatisticsUiStore, type StatisticsMainTab } from '~/stores/StatisticsUiStore'
import { useHomeUiStore, type HomeSectionId } from '~/stores/HomeUiStore'

const VALID_SETTINGS_PAGE_TABS = [
  'tabs',
  'homeSections',
  'watchlist',
  'alerts',
  'howItWorks',
  'dataTransfer',
] as const
type SettingsPageTab = (typeof VALID_SETTINGS_PAGE_TABS)[number]

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const statisticsUiStore = useStatisticsUiStore()
const homeUiStore = useHomeUiStore()

const activeSettingsPageTab = ref<SettingsPageTab>('tabs')
const tabDragIndex = ref<number | null>(null)
const homeSectionDragIndex = ref<number | null>(null)

function readTabFromRoute(): SettingsPageTab | null {
  const tabFromQuery = route.query.tab
  const tabParam = (Array.isArray(tabFromQuery) ? tabFromQuery[0] : tabFromQuery) ?? ''
  if (
    typeof tabParam === 'string' &&
    (VALID_SETTINGS_PAGE_TABS as readonly string[]).includes(tabParam)
  ) {
    return tabParam as SettingsPageTab
  }
  return null
}

const tabFromRoute = readTabFromRoute()
if (tabFromRoute) {
  activeSettingsPageTab.value = tabFromRoute
}

onMounted(() => {
  statisticsUiStore.init()
  homeUiStore.init()

  const tab = readTabFromRoute()
  if (tab) {
    activeSettingsPageTab.value = tab
  }

  if (Object.keys(route.query).length > 0) {
    router.replace(localePath('/settings')).catch(() => undefined)
  }
})
const settingsPageTabs = computed(() => [
  { id: 'tabs' as const, label: t('statisticsPage.settingsPageTabTabs') },
  { id: 'homeSections' as const, label: t('statisticsPage.settingsPageTabHomeSections') },
  { id: 'watchlist' as const, label: t('statisticsPage.settingsPageTabWatchlist') },
  { id: 'alerts' as const, label: t('statisticsPage.settingsPageTabAlerts') },
  { id: 'howItWorks' as const, label: t('statisticsPage.settingsPageTabHowItWorks') },
  { id: 'dataTransfer' as const, label: t('statisticsPage.settingsPageTabDataTransfer') },
])

const tabRows = computed(() =>
  statisticsUiStore.tabOrder.map(id => ({
    id,
    label: t(STATISTICS_MAIN_TAB_LABEL_KEYS[id]),
    visible: statisticsUiStore.isTabVisible(id),
    isDefault: statisticsUiStore.defaultTab === id,
  }))
)

const visibleCount = computed(() => tabRows.value.filter(row => row.visible).length)

function toggleTab(tab: StatisticsMainTab): void {
  statisticsUiStore.setTabVisible(tab, !statisticsUiStore.isTabVisible(tab))
}

function setDefaultTab(tab: StatisticsMainTab): void {
  statisticsUiStore.setDefaultTab(tab)
}

function moveTab(tab: StatisticsMainTab, direction: 'up' | 'down'): void {
  statisticsUiStore.moveTab(tab, direction)
}

function onTabDragStart(index: number): void {
  tabDragIndex.value = index
}

function onTabDrop(targetIndex: number): void {
  if (tabDragIndex.value === null) return
  statisticsUiStore.reorderTab(tabDragIndex.value, targetIndex)
  tabDragIndex.value = null
}

function resetTabs(): void {
  statisticsUiStore.resetTabVisibility()
}

function setWatchedChampions(ids: string[]): void {
  statisticsUiStore.setWatchedChampionIds(ids)
}

const homeSectionRows = computed(() =>
  homeUiStore.sectionOrder.map(id => ({
    id,
    label: t(HOME_SECTION_LABEL_KEYS[id]),
    visible: homeUiStore.isSectionVisible(id),
  }))
)

const visibleHomeSectionCount = computed(
  () => homeSectionRows.value.filter(row => row.visible).length
)

function toggleHomeSection(section: HomeSectionId): void {
  homeUiStore.setSectionVisible(section, !homeUiStore.isSectionVisible(section))
}

function moveHomeSection(section: HomeSectionId, direction: 'up' | 'down'): void {
  homeUiStore.moveSection(section, direction)
}

function onHomeSectionDragStart(index: number): void {
  homeSectionDragIndex.value = index
}

function onHomeSectionDrop(targetIndex: number): void {
  if (homeSectionDragIndex.value === null) return
  homeUiStore.reorderSection(homeSectionDragIndex.value, targetIndex)
  homeSectionDragIndex.value = null
}

function resetHomeSections(): void {
  homeUiStore.resetSections()
}

useHead({
  title: () => t('statisticsPage.settingsTitle'),
})
</script>

<style scoped>
.settings-order-grid {
  display: grid;
  width: 100%;
  gap: 0.375rem;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
}

.settings-order-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.5rem;
  cursor: grab;
}

.settings-order-card:active {
  cursor: grabbing;
}

.settings-order-card__label {
  min-height: 2.25rem;
  overflow: hidden;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.25;
  color: rgb(var(--rgb-text) / 0.9);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.settings-order-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
}

.settings-order-card__row--home {
  justify-content: flex-start;
}

.settings-order-card__row--home .settings-order-card__toggle {
  margin-left: auto;
}

.settings-order-card__moves {
  display: flex;
  flex-shrink: 0;
  gap: 0.125rem;
}

.settings-order-card__move {
  padding: 0.125rem 0.375rem;
  font-size: 0.5625rem;
  line-height: 1;
}

.settings-order-card__move:disabled {
  opacity: 0.3;
}

.settings-order-card__default {
  display: inline-flex;
  min-width: 0;
  flex: 1;
  cursor: pointer;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.5625rem;
  color: rgb(var(--rgb-text) / 0.6);
}

.settings-order-card__default.is-disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.settings-order-card__default-input {
  height: 0.75rem;
  width: 0.75rem;
  flex-shrink: 0;
  accent-color: rgb(var(--rgb-accent) / 1);
}

.settings-order-card__toggle {
  flex-shrink: 0;
  transform: scale(0.78);
  transform-origin: center right;
}
</style>
