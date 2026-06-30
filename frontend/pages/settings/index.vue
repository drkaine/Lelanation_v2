<template>
  <div class="statistics-settings min-h-screen w-full px-3 py-4 text-text sm:px-5 lg:px-6">
    <div class="w-full space-y-4">
      <nav
        class="flex flex-wrap gap-1 border-b border-primary/20 pb-0.5"
        role="tablist"
        :aria-label="t('statisticsPage.settingsPageTabsAria')"
      >
        <button
          v-for="tab in settingsPageTabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="rounded-t border px-3 py-2 text-sm font-medium transition"
          :class="
            activeSettingsPageTab === tab.id
              ? 'border-primary/40 border-b-transparent bg-surface/40 text-text'
              : 'border-transparent text-text/60 hover:bg-surface/20 hover:text-text'
          "
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
          <button
            type="button"
            class="rounded border border-primary/35 bg-surface/50 px-2.5 py-1 text-xs hover:bg-primary/10"
            @click="resetTabs"
          >
            {{ t('statisticsPage.settingsReset') }}
          </button>
        </div>

        <ul class="grid w-full gap-2 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
          <li
            v-for="row in tabRows"
            :key="row.id"
            class="flex min-w-0 flex-col gap-2 rounded-lg border border-primary/25 bg-surface/30 px-2.5 py-2"
            :class="row.visible ? 'opacity-100' : 'opacity-55'"
          >
            <div class="min-h-[2.25rem] text-xs font-medium leading-snug text-text/90">
              {{ row.label }}
            </div>
            <div class="flex items-center justify-between gap-1">
              <label
                class="inline-flex cursor-pointer items-center gap-1.5 text-[10px] text-text/60"
                :class="{ 'cursor-not-allowed opacity-40': !row.visible }"
              >
                <input
                  type="radio"
                  name="statistics-default-tab"
                  class="h-3.5 w-3.5 shrink-0 accent-accent"
                  :checked="row.isDefault"
                  :disabled="!row.visible"
                  :aria-label="t('statisticsPage.settingsDefaultTabAria', { tab: row.label })"
                  @change="setDefaultTab(row.id)"
                />
                <span>{{ t('statisticsPage.settingsDefaultTab') }}</span>
              </label>
              <button
                type="button"
                class="command-toggle command-toggle-button shrink-0 scale-90"
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
            class="rounded border border-primary/35 bg-surface/50 px-2.5 py-1 text-xs hover:bg-primary/10"
            @click="resetHomeSections"
          >
            {{ t('statisticsPage.settingsReset') }}
          </button>
        </div>

        <ul class="grid w-full gap-2">
          <li
            v-for="(row, index) in homeSectionRows"
            :key="row.id"
            class="flex min-w-0 items-center gap-2 rounded-lg border border-primary/25 bg-surface/30 px-2.5 py-2"
            :class="row.visible ? 'opacity-100' : 'opacity-55'"
          >
            <div class="flex shrink-0 flex-col gap-0.5">
              <button
                type="button"
                class="rounded border border-primary/30 px-1.5 py-0.5 text-[10px] text-text/70 hover:bg-primary/10 disabled:opacity-30"
                :disabled="index === 0"
                :aria-label="t('statisticsPage.settingsHomeSectionMoveUp', { section: row.label })"
                @click="moveHomeSection(row.id, 'up')"
              >
                ↑
              </button>
              <button
                type="button"
                class="rounded border border-primary/30 px-1.5 py-0.5 text-[10px] text-text/70 hover:bg-primary/10 disabled:opacity-30"
                :disabled="index === homeSectionRows.length - 1"
                :aria-label="
                  t('statisticsPage.settingsHomeSectionMoveDown', { section: row.label })
                "
                @click="moveHomeSection(row.id, 'down')"
              >
                ↓
              </button>
            </div>
            <div class="min-w-0 flex-1 text-xs font-medium leading-snug text-text/90">
              {{ row.label }}
            </div>
            <button
              type="button"
              class="command-toggle command-toggle-button shrink-0 scale-90"
              :aria-pressed="row.visible"
              :aria-label="row.label"
              @click="toggleHomeSection(row.id)"
            >
              <span class="command-toggle-track" :class="{ active: row.visible }">
                <span class="command-toggle-thumb" />
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  STATISTICS_MAIN_TAB_LABEL_KEYS,
  STATISTICS_MAIN_TAB_ORDER,
} from '~/constants/statisticsMainTabs'
import { HOME_SECTION_LABEL_KEYS } from '~/constants/homeSections'
import StatisticsSurveillanceAlertSettings from '~/components/statistics/StatisticsSurveillanceAlertSettings.vue'
import SettingsHowItWorksPanel from '~/components/settings/SettingsHowItWorksPanel.vue'
import SettingsDataTransferPanel from '~/components/settings/SettingsDataTransferPanel.vue'
import { useStatisticsUiStore, type StatisticsMainTab } from '~/stores/StatisticsUiStore'
import { useHomeUiStore, type HomeSectionId } from '~/stores/HomeUiStore'

const VALID_SETTINGS_PAGE_TABS = [
  'tabs',
  'watchlist',
  'alerts',
  'howItWorks',
  'dataTransfer',
  'homeSections',
] as const
type SettingsPageTab = (typeof VALID_SETTINGS_PAGE_TABS)[number]

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const statisticsUiStore = useStatisticsUiStore()
const homeUiStore = useHomeUiStore()

const activeSettingsPageTab = ref<SettingsPageTab>('tabs')

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
  { id: 'watchlist' as const, label: t('statisticsPage.settingsPageTabWatchlist') },
  { id: 'alerts' as const, label: t('statisticsPage.settingsPageTabAlerts') },
  { id: 'howItWorks' as const, label: t('statisticsPage.settingsPageTabHowItWorks') },
  { id: 'dataTransfer' as const, label: t('statisticsPage.settingsPageTabDataTransfer') },
  { id: 'homeSections' as const, label: t('statisticsPage.settingsPageTabHomeSections') },
])

const tabRows = computed(() =>
  STATISTICS_MAIN_TAB_ORDER.map(id => ({
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

function resetHomeSections(): void {
  homeUiStore.resetSections()
}

useHead({
  title: () => t('statisticsPage.settingsTitle'),
})
</script>
