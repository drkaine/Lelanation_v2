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
        <p class="text-xs text-text/55">
          {{ t('statisticsPage.settingsDefaultTabHint') }}
        </p>
        <div class="flex flex-wrap items-center justify-between gap-2">
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
            class="rounded border border-primary/35 bg-surface/50 px-3 py-1.5 text-xs hover:bg-primary/10"
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
        <header class="space-y-1">
          <p class="text-sm text-text/70">
            {{ t('statisticsPage.settingsWatchlistDescription') }}
          </p>
          <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span class="text-xs text-text/55">
              {{
                t('statisticsPage.settingsWatchlistCount', {
                  count: watchedChampionCount,
                })
              }}
            </span>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded border border-primary/35 bg-surface/50 px-3 py-1.5 text-xs hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="allWatchedSelected || championsStore.status !== 'success'"
                @click="selectAllWatchedChampions"
              >
                {{ t('statisticsPage.settingsWatchlistSelectAll') }}
              </button>
              <button
                v-if="watchedChampionCount > 0"
                type="button"
                class="rounded border border-primary/35 bg-surface/50 px-3 py-1.5 text-xs hover:bg-primary/10"
                @click="clearWatchlist"
              >
                {{ t('statisticsPage.settingsWatchlistClear') }}
              </button>
            </div>
          </div>
        </header>

        <StatisticsWatchedChampionPicker
          :model-value="statisticsUiStore.watchedChampionIds"
          @update:model-value="setWatchedChampions"
        />

        <NuxtLink
          v-if="watchedChampionCount > 0"
          :to="localePath('/statistics/surveillance')"
          class="inline-flex rounded border border-primary/35 bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25"
        >
          {{ t('statisticsPage.surveillanceOpen') }}
        </NuxtLink>
      </section>

      <div v-show="activeSettingsPageTab === 'alerts'" role="tabpanel">
        <StatisticsSurveillanceAlertSettings />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  STATISTICS_MAIN_TAB_LABEL_KEYS,
  STATISTICS_MAIN_TAB_ORDER,
} from '~/constants/statisticsMainTabs'
import StatisticsSurveillanceAlertSettings from '~/components/statistics/StatisticsSurveillanceAlertSettings.vue'
import { useSurveillanceAlertEvaluation } from '~/composables/useSurveillanceAlertEvaluation'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useStatisticsUiStore, type StatisticsMainTab } from '~/stores/StatisticsUiStore'

type SettingsPageTab = 'tabs' | 'watchlist' | 'alerts'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const statisticsUiStore = useStatisticsUiStore()
const championsStore = useChampionsStore()
const { runSurveillanceAlertCheck } = useSurveillanceAlertEvaluation()

const activeSettingsPageTab = ref<SettingsPageTab>('tabs')

const settingsPageTabs = computed(() => [
  { id: 'tabs' as const, label: t('statisticsPage.settingsPageTabTabs') },
  { id: 'watchlist' as const, label: t('statisticsPage.settingsPageTabWatchlist') },
  { id: 'alerts' as const, label: t('statisticsPage.settingsPageTabAlerts') },
])

if (import.meta.client) {
  statisticsUiStore.init()
}

onMounted(() => {
  runSurveillanceAlertCheck().catch(() => undefined)
})

if (Object.keys(route.query).length > 0) {
  await navigateTo(localePath('/statistics/settings'), { replace: true })
}

const tabRows = computed(() =>
  STATISTICS_MAIN_TAB_ORDER.map(id => ({
    id,
    label: t(STATISTICS_MAIN_TAB_LABEL_KEYS[id]),
    visible: statisticsUiStore.isTabVisible(id),
    isDefault: statisticsUiStore.defaultTab === id,
  }))
)

const visibleCount = computed(() => tabRows.value.filter(row => row.visible).length)
const watchedChampionCount = computed(() => statisticsUiStore.watchedChampionIds.length)
const allWatchedSelected = computed(() => {
  const total = championsStore.champions.length
  return total > 0 && watchedChampionCount.value >= total
})

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

function clearWatchlist(): void {
  statisticsUiStore.clearWatchedChampions()
}

function selectAllWatchedChampions(): void {
  if (championsStore.champions.length === 0) return
  statisticsUiStore.setWatchedChampionIds(championsStore.champions.map(champion => champion.id))
}

useHead({
  title: () => t('statisticsPage.settingsTitle'),
})
</script>
