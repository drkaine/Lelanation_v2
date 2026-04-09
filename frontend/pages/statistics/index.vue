<template>
  <div class="statistics flex min-h-screen flex-col text-text">
    <!-- Burger pour ouvrir les filtres (mobile) -->
    <button
      type="button"
      class="fixed left-4 top-4 z-40 flex w-10 items-center justify-center rounded-lg border border-primary/30 bg-surface/90 text-text shadow lg:hidden"
      :aria-label="t('statisticsPage.openFilters')"
      @click="openFilters"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>

    <!-- Overlay mobile (fermer les filtres au clic) -->
    <div
      v-show="filtersOpen"
      class="fixed inset-0 z-30 bg-black/50 lg:hidden"
      aria-hidden="true"
      @click="closeFilters"
    />

    <!-- Onglets : pleine largeur au-dessus des filtres et du contenu -->
    <div class="w-full flex-shrink-0 bg-surface/30 px-4 pb-2 pt-4">
      <div class="flex flex-nowrap gap-1 overflow-x-auto border-b border-primary/30 pb-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="[
            'rounded px-3 py-1.5 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'border border-accent/50 bg-accent/20 text-accent'
              : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text',
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Filtres + contenu : même hauteur -->
    <div class="flex min-h-0 flex-1">
      <button
        type="button"
        class="filters-collapse-floating hidden lg:sticky lg:top-4 lg:z-20 lg:mr-2 lg:flex lg:shrink-0 lg:self-start"
        :aria-label="
          filtersOpen ? t('statisticsPage.closeFilters') : t('statisticsPage.openFilters')
        "
        @click="toggleFiltersOpen"
      >
        <svg
          class="h-2 w-2 transition-transform duration-200"
          :class="filtersOpen ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <aside
        :class="[
          'fixed left-0 top-0 z-40 flex h-full w-64 shrink-0 flex-col rounded-r-lg bg-surface/30 shadow-lg transition-transform duration-200',
          'lg:static lg:sticky lg:top-4 lg:z-0 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-hidden lg:rounded-lg lg:shadow-none lg:transition-[width,opacity] lg:duration-200',
          filtersOpen
            ? 'translate-x-0 lg:w-64 lg:opacity-100'
            : '-translate-x-full lg:w-0 lg:translate-x-0 lg:opacity-0',
        ]"
      >
        <div class="flex items-center justify-between p-2">
          <h2 class="text-lg font-semibold text-text-accent">
            {{ t('statisticsPage.filtersTitle') }}
          </h2>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/15 hover:text-blue-200"
            @click="resetStatsFilters"
          >
            <span class="iconify i-mdi:refresh" aria-hidden="true" />
            Reset
          </button>
          <button
            type="button"
            class="rounded p-1 text-text/70 hover:bg-primary/20 hover:text-text lg:hidden"
            :aria-label="t('statisticsPage.closeFilters')"
            @click="closeFilters"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
          <div>
            <label for="stats-filter-version" class="mb-1 block text-sm font-medium text-text">
              {{ t('statisticsPage.overviewFilterByVersion') }}
            </label>
            <select
              id="stats-filter-version"
              v-model="statsVersionFilter"
              class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              @change="onStatsFilterChange"
            >
              <option value="">{{ t('statisticsPage.overviewVersionAll') }}</option>
              <option v-for="v in statsVersionOptions" :key="v.version" :value="v.version">
                {{ v.version }}
              </option>
            </select>
          </div>
          <div>
            <label
              for="stats-filter-progression-version"
              class="mb-1 block text-sm font-medium text-text"
            >
              {{ t('statisticsPage.progressionsReferenceVersion') }}
            </label>
            <select
              id="stats-filter-progression-version"
              v-model="progressionFromVersionModel"
              class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
            >
              <option
                v-for="v in progressionSelectableVersions"
                :key="'delta-from-' + v.version"
                :value="v.version"
              >
                {{ v.version }}
              </option>
            </select>
          </div>
          <div v-if="activeTab !== 'balance'">
            <div class="mb-1 text-sm font-medium text-text">
              {{ t('statisticsPage.overviewMatchesByDivision') }}
            </div>
            <div class="flex flex-wrap gap-1">
              <button
                type="button"
                class="stats-division-btn rounded px-2 py-0.5 text-xs font-semibold transition-colors"
                :class="
                  statsDivisionFilter.length === 0
                    ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
                    : 'bg-black/20 text-text/85 hover:bg-white/10'
                "
                @click="selectAllDivisions()"
              >
                All
              </button>
              <button
                v-for="tier in rankTiers"
                :key="tier"
                type="button"
                class="stats-division-btn rounded p-0.5 transition-colors"
                :class="
                  statsDivisionFilter.includes(tier)
                    ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                    : 'bg-black/20 hover:bg-white/10'
                "
                :title="formatDivisionLabel(tier)"
                @click="toggleDivisionFilter(tier)"
              >
                <img
                  v-if="getRankedEmblemUrl(tier)"
                  :src="getRankedEmblemUrl(tier)!"
                  :alt="tier"
                  class="h-3 w-3 object-contain"
                  :class="
                    statsDivisionFilter.includes(tier)
                      ? 'saturate-110 opacity-100'
                      : 'brightness-125 grayscale'
                  "
                  width="12"
                  height="12"
                />
              </button>
            </div>
          </div>
          <div v-else>
            <div class="mb-1 text-sm font-medium text-text">
              {{ t('statisticsPage.balanceGlobalStatus') }}
            </div>
            <div class="grid grid-cols-1 gap-1">
              <select
                v-model="balanceGlobalFilter"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              >
                <option value="ALL">{{ t('statisticsPage.overviewVersionAll') }}</option>
                <option value="OVERPOWERED">
                  {{ t('statisticsPage.balanceStatusOverpowered') }}
                </option>
                <option value="UNDERPOWERED">
                  {{ t('statisticsPage.balanceStatusUnderpowered') }}
                </option>
                <option value="BALANCED">{{ t('statisticsPage.balanceStatusBalanced') }}</option>
              </select>
              <select
                v-model="balanceAverageFilter"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              >
                <option value="ALL">Average · {{ t('statisticsPage.overviewVersionAll') }}</option>
                <option value="OVERPOWERED">
                  Average · {{ t('statisticsPage.balanceStatusOverpowered') }}
                </option>
                <option value="UNDERPOWERED">
                  Average · {{ t('statisticsPage.balanceStatusUnderpowered') }}
                </option>
                <option value="BALANCED">
                  Average · {{ t('statisticsPage.balanceStatusBalanced') }}
                </option>
              </select>
              <select
                v-model="balanceSkilledFilter"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              >
                <option value="ALL">Skilled · {{ t('statisticsPage.overviewVersionAll') }}</option>
                <option value="OVERPOWERED">
                  Skilled · {{ t('statisticsPage.balanceStatusOverpowered') }}
                </option>
                <option value="UNDERPOWERED">
                  Skilled · {{ t('statisticsPage.balanceStatusUnderpowered') }}
                </option>
                <option value="BALANCED">
                  Skilled · {{ t('statisticsPage.balanceStatusBalanced') }}
                </option>
              </select>
              <select
                v-model="balanceEliteFilter"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              >
                <option value="ALL">Elite · {{ t('statisticsPage.overviewVersionAll') }}</option>
                <option value="OVERPOWERED">
                  Elite · {{ t('statisticsPage.balanceStatusOverpowered') }}
                </option>
                <option value="UNDERPOWERED">
                  Elite · {{ t('statisticsPage.balanceStatusUnderpowered') }}
                </option>
                <option value="BALANCED">
                  Elite · {{ t('statisticsPage.balanceStatusBalanced') }}
                </option>
              </select>
            </div>
          </div>
          <div>
            <div class="mb-1 text-sm font-medium text-text">
              {{ t('statisticsPage.filterRole') }}
            </div>
            <div class="flex flex-wrap gap-1">
              <button
                type="button"
                class="stats-role-btn rounded px-2 py-0.5 text-xs font-semibold transition-colors"
                :class="
                  !statsRoleFilter
                    ? 'bg-blue-500/20 text-blue-200'
                    : 'bg-black/20 text-text/85 hover:bg-white/10'
                "
                @click="selectAllRoles()"
              >
                All
              </button>
              <button
                v-for="r in roles"
                :key="r.value"
                type="button"
                class="stats-role-btn rounded p-0.5 transition-colors"
                :class="
                  statsRoleFilter === r.value ? 'bg-blue-500/20' : 'bg-black/20 hover:bg-white/10'
                "
                :title="r.label"
                @click="toggleRoleFilter(r)"
              >
                <img
                  :src="r.icon"
                  :alt="r.label"
                  class="h-3 w-3 object-contain"
                  :class="
                    statsRoleFilter === r.value
                      ? 'saturate-110 opacity-100'
                      : 'brightness-125 grayscale'
                  "
                  width="12"
                  height="12"
                />
              </button>
            </div>
          </div>
          <div>
            <label for="otp-filter" class="mb-1 block text-sm font-medium text-text">
              {{ t('statisticsPage.filterOtp') }}
            </label>
            <select
              id="otp-filter"
              v-model="statsOtpFilter"
              class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              @change="onStatsFilterChange"
            >
              <option value="non">{{ t('statisticsPage.filterOtpNo') }}</option>
              <option value="oui">{{ t('statisticsPage.filterOtpYes') }}</option>
              <option value="solo">{{ t('statisticsPage.filterOtpSolo') }}</option>
            </select>
          </div>
          <div>
            <label for="champion-search" class="mb-1 block text-sm font-medium text-text">{{
              searchInputLabel
            }}</label>
            <input
              id="champion-search"
              v-model.trim="championSearchQuery"
              type="text"
              :placeholder="searchInputPlaceholder"
              class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text placeholder:text-text/50"
            />
          </div>
        </div>
      </aside>

      <!-- Contenu principal : à côté des filtres, même hauteur -->
      <div class="min-w-0 flex-1 p-4 pt-14 lg:px-3 lg:pb-4 lg:pt-0">
        <div class="w-full">
          <div v-if="!overviewData" class="mb-6 text-text/80">
            <p>{{ t('statisticsPage.description') }}</p>
          </div>

          <!-- Tab: Overview (default) -->
          <div v-show="activeTab === 'overview'" class="space-y-6">
            <StatisticsOverviewTab />
          </div>

          <!-- Tab: Runes, items, sorts (chargé à l'ouverture de l'onglet) -->
          <div v-show="activeTab === 'runes'" class="space-y-6">
            <StatisticsRunesTab />
          </div>

          <!-- Tab: Progressions (depuis la version la plus ancienne, type LeagueOfGraphs) -->
          <!-- <div v-show="activeTab === 'trends'" class="space-y-6">
            <StatisticsTrendsTab />
          </div> -->

          <!-- Tab: Par côté — fast-stats comme vue d'ensemble -->
          <div v-show="activeTab === 'team'" class="space-y-6">
            <StatisticsTeamTab />
          </div>

          <!-- Tab: Infos -->
          <div v-show="activeTab === 'infos'">
            <StatisticsInfosTab />
          </div>

          <!-- Tab: Bans -->
          <div v-show="activeTab === 'bans'">
            <StatisticsBansTab />
          </div>

          <!-- Tab: Tier list -->
          <div v-show="activeTab === 'tierlist'" class="space-y-4">
            <StatisticsTierListTab />
          </div>

          <!-- Tab: Champion (tableau global bleu/rouge + dégâts + KDA) -->
          <div v-show="activeTab === 'championTable'" class="space-y-4">
            <StatisticsChampionTableTab />
          </div>

          <!-- Tab: Balance framework -->
          <div v-show="activeTab === 'balance'" class="space-y-4">
            <StatisticsBalanceTab />
          </div>

          <!-- Tab: Durée de partie -->
          <div v-show="activeTab === 'duration'" class="space-y-4">
            <StatisticsDurationTab />
          </div>

          <!-- Tab: Objets (global) -->
          <div v-show="activeTab === 'items'" class="space-y-6">
            <StatisticsItemsTab />
          </div>

          <!-- Tab: Sorts d'invocateur (global) -->
          <div v-show="activeTab === 'spells'" class="space-y-4">
            <StatisticsSpellsTab />
          </div>

          <!-- Tab: Abandons -->
          <div v-show="activeTab === 'abandons'" class="space-y-4">
            <StatisticsAbandonsTab />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars -- setup bindings are used by tab SFCs via provide('statisticsPageCtx'), not this file's template */
import { ref, computed, watch, nextTick, getCurrentInstance, provide, unref } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '~/utils/apiUrl'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useStatisticsUiStore, type StatisticsMainTab } from '~/stores/StatisticsUiStore'
import { useStatisticsCustomStore } from '~/stores/StatisticsCustomStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { useStatisticsBansTab } from '~/composables/statistics/useStatisticsBansTab'
import { getChampionImageUrl, getItemImageUrl } from '~/utils/imageUrl'
import StatisticsOverviewTab from '~/components/statistics/tabs/StatisticsOverviewTab.vue'
import StatisticsRunesTab from '~/components/statistics/tabs/StatisticsRunesTab.vue'
import StatisticsTrendsTab from '~/components/statistics/tabs/StatisticsTrendsTab.vue'
import StatisticsTeamTab from '~/components/statistics/tabs/StatisticsTeamTab.vue'
import StatisticsInfosTab from '~/components/statistics/tabs/StatisticsInfosTab.vue'
import StatisticsBansTab from '~/components/statistics/tabs/StatisticsBansTab.vue'
import StatisticsTierListTab from '~/components/statistics/tabs/StatisticsTierListTab.vue'
import StatisticsChampionTableTab from '~/components/statistics/tabs/StatisticsChampionTableTab.vue'
import StatisticsBalanceTab from '~/components/statistics/tabs/StatisticsBalanceTab.vue'
import StatisticsDurationTab from '~/components/statistics/tabs/StatisticsDurationTab.vue'
import StatisticsItemsTab from '~/components/statistics/tabs/StatisticsItemsTab.vue'
import StatisticsSpellsTab from '~/components/statistics/tabs/StatisticsSpellsTab.vue'
import StatisticsAbandonsTab from '~/components/statistics/tabs/StatisticsAbandonsTab.vue'
import { formatItemStatsForDisplay, formatItemEconomicForDisplay } from '~/utils/formatItemStats'
import {
  scoreboardDrakeIconByKey,
  scoreboardDrakeIconCdByKey,
  scoreboardObjectiveIconByKey,
  scoreboardObjectiveIconCdByKey,
} from '~/utils/objectiveScoreboardIcons'
import type {
  ItemAggRow,
  ItemSliceCategory,
} from '~/components/statistics/ItemStatsFastSection.vue'

definePageMeta({
  layout: 'default',
})

const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead({
  title: () => t('statisticsPage.metaTitle'),
  meta: [{ name: 'description', content: () => t('statisticsPage.metaDescription') }],
})
useSeoMeta({
  ogTitle: () => t('statisticsPage.metaTitle'),
  ogDescription: () => t('statisticsPage.metaDescription'),
  ogType: 'website',
})

const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const summonerSpellsStore = useSummonerSpellsStore()
const versionStore = useVersionStore()
const statisticsUiStore = useStatisticsUiStore()
const statisticsCustomStore = useStatisticsCustomStore()
const { version: gameVersion } = useGameVersion()
const route = useRoute()
const router = useRouter()

function queryFirst(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function normalizeLegacyTab(tab: string): StatisticsMainTab {
  if (tab === 'champions') return 'infos'
  if (tab === 'progressions') return 'trends'
  if (tab === 'sides') return 'team'
  if (tab === 'detail') return 'runes'
  if (tab === 'duration') return 'team'
  if (tab === 'abandons') return 'team'
  if (tab === 'champion-table' || tab === 'championstable') return 'championTable'
  if (
    tab === 'overview' ||
    tab === 'tierlist' ||
    tab === 'championTable' ||
    tab === 'balance' ||
    tab === 'trends' ||
    tab === 'team' ||
    tab === 'bans' ||
    tab === 'runes' ||
    tab === 'items' ||
    tab === 'spells' ||
    tab === 'infos'
  ) {
    return tab
  }
  return 'overview'
}

/** Onglet initial aligné sur l’URL (SSR + client) pour éviter hydration mismatch et faux onglet « Vue d’ensemble ». */
function initialActiveTabFromRoute(): StatisticsMainTab {
  const tabRaw = queryFirst(route.query.tab as string | string[] | null | undefined)
  if (tabRaw) return normalizeLegacyTab(tabRaw)
  return 'overview'
}

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const activeTab = ref<
  | 'overview'
  | 'team'
  | 'tierlist'
  | 'championTable'
  | 'balance'
  | 'trends'
  | 'runes'
  | 'items'
  | 'spells'
  | 'infos'
  | 'champions'
  | 'progressions'
  | 'sides'
  | 'detail'
  | 'duration'
  | 'abandons'
  | 'bans'
>(initialActiveTabFromRoute())
const tabs = computed(() => [
  { id: 'overview' as const, label: t('statisticsPage.tabOverview'), widgetId: 'overview' },
  { id: 'team' as const, label: t('statisticsPage.tabTeam'), widgetId: 'team' },
  { id: 'bans' as const, label: t('statisticsPage.tabBans'), widgetId: 'bans' },
  { id: 'tierlist' as const, label: t('statisticsPage.tabTierList'), widgetId: 'tierlist' },
  {
    id: 'championTable' as const,
    label: t('statisticsPage.tabChampionTable'),
    widgetId: 'championTable',
  },
  { id: 'balance' as const, label: t('statisticsPage.tabBalance'), widgetId: 'balance' },
  { id: 'runes' as const, label: t('statisticsPage.tabRunes'), widgetId: 'runes' },
  { id: 'spells' as const, label: t('statisticsPage.tabSummonerSpells'), widgetId: 'spells' },
  { id: 'items' as const, label: t('statisticsPage.tabItems'), widgetId: 'items' },
  { id: 'infos' as const, label: t('statisticsPage.tabInfos'), widgetId: 'infos' },
])

function cardIsFavorite(cardId: string): boolean {
  return statisticsCustomStore.isFavorite(cardId)
}

function toggleFavoriteCard(cardId: string, title: string): void {
  statisticsCustomStore.toggleFavorite(cardId, title)
}

const championSearchQuery = ref('')
const searchInputLabel = computed(() =>
  activeTab.value === 'items'
    ? t('statisticsPage.searchItem')
    : activeTab.value === 'spells'
      ? t('statisticsPage.searchSummoner')
      : t('statisticsPage.searchChampion')
)
const searchInputPlaceholder = computed(() =>
  activeTab.value === 'items'
    ? t('statisticsPage.searchItemPlaceholder')
    : activeTab.value === 'spells'
      ? t('statisticsPage.searchSummonerPlaceholder')
      : t('statisticsPage.searchChampionPlaceholder')
)
/** Pagination: page size and current page (1-based). Shared for Champions and Tier list. */
const championsPageSize = ref(20)
const championsPage = ref(1)
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
/** Pagination Objets (onglet items). */
const itemsPageSize = ref(20)
const itemsPage = ref(1)
const itemsList = computed(() => overviewDetailData.value?.items ?? [])

/** Tranches objets (starters / core / bottes / finaux / solo) → 8 cartes chacune dans la même grille. */
const itemFastSliceConfigs = computed(() => {
  const d = overviewDetailData.value
  const b = overviewDetailBaselineData.value
  if (!d) {
    return [] as Array<{
      slice: ItemSliceCategory
      rows: ItemAggRow[]
      baselineRows: ItemAggRow[] | null
    }>
  }
  const slices: Array<{
    slice: ItemSliceCategory
    rows: ItemAggRow[] | undefined
    baseline: ItemAggRow[] | undefined
  }> = [
    { slice: 'starter', rows: d.itemsStarters, baseline: b?.itemsStarters },
    { slice: 'core', rows: d.itemsCores, baseline: b?.itemsCores },
    { slice: 'boots', rows: d.itemsBoots, baseline: b?.itemsBoots },
    { slice: 'final', rows: d.itemsFinals, baseline: b?.itemsFinals },
    { slice: 'solo', rows: d.items, baseline: b?.items },
  ]
  return slices
    .map(s => ({
      slice: s.slice,
      rows: s.rows ?? [],
      baselineRows: s.baseline != null && s.baseline.length > 0 ? s.baseline : null,
    }))
    .filter(s => s.rows.length > 0)
})

const totalItemsCount = computed(() => itemsList.value.length)
const totalItemsPages = computed(() =>
  Math.max(1, Math.ceil(totalItemsCount.value / itemsPageSize.value))
)
const paginatedItems = computed(() => {
  const list = itemsList.value
  const size = itemsPageSize.value
  const page = Math.min(itemsPage.value, totalItemsPages.value)
  const start = (page - 1) * size
  return list.slice(start, start + size)
})
/** Pagination Progressions (onglet progressions). */
const progressionsPageSize = ref(20)
const progressionsPage = ref(1)
const totalProgressionsCount = computed(() => progressionFullData.value?.champions?.length ?? 0)
const totalProgressionsPages = computed(() =>
  Math.max(1, Math.ceil(totalProgressionsCount.value / progressionsPageSize.value))
)
const paginatedProgressionsChampions = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  const size = progressionsPageSize.value
  const page = Math.min(progressionsPage.value, totalProgressionsPages.value)
  const start = (page - 1) * size
  return list.slice(start, start + size)
})
const paginatedProgressionsByPickrate = computed(() => {
  const list = progressionFullByPickrate.value
  const size = progressionsPageSize.value
  const page = Math.min(progressionsPage.value, totalProgressionsPages.value)
  const start = (page - 1) * size
  return list.slice(start, start + size)
})
/** Sort order for Champions tab (from Fast Stats "Voir plus" or selector). */
const championsSortOrder = ref<'winrate' | 'pickrate' | 'games' | 'wins'>('winrate')
/** Sort direction: desc = highest first (default), asc = lowest first. */
const championsSortDir = ref<'asc' | 'desc'>('desc')
// Quand on change de colonne (ex. via le menu "Trier par"), repasser en décroissant par défaut.
watch(championsSortOrder, () => {
  championsSortDir.value = 'desc'
})
const filteredChampions = computed(() => {
  const list = championsData.value?.champions ?? []
  const q = championSearchQuery.value.toLowerCase()
  const filtered = q
    ? list.filter(row => {
        const name = championName(row.championId)?.toLowerCase() ?? ''
        return name.includes(q) || String(row.championId).includes(q)
      })
    : [...list]
  const sort = championsSortOrder.value
  const dir = championsSortDir.value
  const mult = dir === 'desc' ? 1 : -1
  return filtered.sort((a, b) => {
    let diff = 0
    if (sort === 'winrate') diff = (b.winrate ?? 0) - (a.winrate ?? 0)
    else if (sort === 'pickrate') diff = (b.pickrate ?? 0) - (a.pickrate ?? 0)
    else if (sort === 'wins') diff = (b.wins ?? 0) - (a.wins ?? 0)
    else diff = (b.games ?? 0) - (a.games ?? 0)
    return mult * diff
  })
})
const totalChampionsCount = computed(() => filteredChampions.value.length)
const totalChampionsPages = computed(() =>
  Math.max(1, Math.ceil(totalChampionsCount.value / championsPageSize.value))
)
const paginatedChampions = computed(() => {
  const list = filteredChampions.value
  const size = championsPageSize.value
  const page = Math.min(championsPage.value, Math.max(1, Math.ceil(list.length / size) || 1))
  const start = (page - 1) * size
  return list.slice(start, start + size)
})
/** Reset to page 1 when filters or page size change. */
watch([championSearchQuery, championsSortOrder, championsSortDir, championsPageSize], () => {
  championsPage.value = 1
})

/** Click on sortable column header: same column toggles asc/desc, else set column and desc. */
function setChampionsSort(col: 'games' | 'wins' | 'winrate' | 'pickrate') {
  if (championsSortOrder.value === col) {
    championsSortDir.value = championsSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    championsSortOrder.value = col
    championsSortDir.value = 'desc'
  }
}

/** Tier list: types and sort (3-state: default, asc, desc). */
type TierListSortColumn =
  | 'rank'
  | 'champion'
  | 'tier'
  | 'mainRolePct'
  | 'patchMainRolePctPp'
  | 'winrate'
  | 'pickrate'
  | 'patchWinratePp'
  | 'patchPickratePp'
  | 'pbi'
  | 'patchPbiPp'
  | 'games'
  | 'patchGamesDelta'
  | 'highEloRank'
  | 'highEloWinrate'
  | 'patchHighEloWinratePp'
  | 'highEloGames'
  | 'patchHighEloGamesDelta'
  | 'delta'

const tierListViewModel = ref<'table' | 'chart'>('table')
const tierListSortColumn = ref<TierListSortColumn | null>('rank')
const tierListSortDir = ref<'asc' | 'desc'>('desc')
const tierListPage = ref(1)

/** Cartes « plus choisis / meilleurs WR / plus bannis » → tier list en mode tableau avec le bon tri. */
function goToTierListWithSort(sort: 'winrate' | 'pickrate') {
  tierListSortColumn.value = sort
  tierListSortDir.value = 'desc'
  tierListViewModel.value = 'table'
  activeTab.value = 'tierlist'
}

const TIER_ORDER: Record<string, number> = { 'S+': 6, S: 5, A: 4, B: 3, C: 2, D: 1, F: 1 }

/** High-elo row by champion id for Apex (Master+GM+Chall) columns and deltas. */
const highEloRowsByChampionId = computed(() => {
  const rows = tierListData.value?.highEloRows ?? []
  const map = new Map<number, (typeof rows)[0]>()
  for (const r of rows) map.set(r.championId, r)
  return map
})
const hasTierListHighElo = computed(() => (tierListData.value?.highEloRows?.length ?? 0) > 0)
/** Couleurs type LoLalytics pour WR % (sur 0–100). */
function tierListWinrateClass(pct: number): string {
  if (!Number.isFinite(pct)) return 'text-text/80'
  if (pct >= 52.5) return 'font-medium text-green-400'
  if (pct >= 51) return 'text-green-500/95'
  if (pct >= 50) return 'text-sky-200/85'
  return 'text-red-400/90'
}

/** Pickrate % (0–100) : vert / neutre / rouge pour lisibilité (tableau champion global). */
function championGlobalPickrateClass(pct: number): string {
  if (!Number.isFinite(pct)) return 'text-text/80'
  if (pct >= 15) return 'font-medium text-emerald-400/90'
  if (pct >= 6) return 'text-sky-200/85'
  if (pct >= 2) return 'text-text/85'
  return 'text-rose-400/90'
}

/** Tier list rows with optional delta (global winrate - highElo winrate). */
interface TierListRowWithDelta {
  rank: number
  championId: number
  tier: string
  mainRole: string
  mainRolePct: number
  winrate: number
  pickrate: number
  banrate: number
  pbi: number
  games: number
  highEloRank?: number
  highEloWinrate?: number
  highEloGames?: number
  delta?: number
  /** Points de % vs patch de référence (progressions). */
  patchRefWinratePp?: number
  patchRefPickratePp?: number
  patchRefBanratePp?: number
  /** Δ part des parties sur le rôle principal (0–100 vs ref., en points de %). */
  patchRefMainRolePctPp?: number
  patchRefGamesDelta?: number
  patchRefHighEloWinratePp?: number
  patchRefHighEloGamesDelta?: number
  /** Écart du score matchup (brut) en points ×100 vs patch de référence. */
  patchRefMatchupScorePp?: number
}

function formatTierListPatchDeltaPp(pp: number): string {
  const sign = pp > 0 ? '+' : ''
  return `${sign}${pp.toFixed(2)}`
}

function formatTierListPatchDeltaGames(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${Math.round(n).toLocaleString()}`
}

function tierListPatchDeltaClass(pp: number): string {
  if (pp > 0.05) return 'text-green-400/90'
  if (pp < -0.05) return 'text-red-400/90'
  return 'text-text/55'
}

function tierListPatchDeltaGamesClass(n: number): string {
  if (n > 0) return 'text-green-400/90'
  if (n < 0) return 'text-red-400/90'
  return 'text-text/55'
}

const tierListRows = computed((): TierListRowWithDelta[] => {
  const rows = tierListData.value?.rows ?? []
  const highElo = highEloRowsByChampionId.value
  const refS = tierListRefStatsById.value
  const refHeMap = tierListRefHighEloById.value
  return rows.map(r => {
    const he = highElo.get(r.championId)
    const winratePct = r.winrate * 100
    const highEloWinratePct = he ? he.winrate * 100 : undefined
    const delta = highEloWinratePct != null ? winratePct - highEloWinratePct : undefined
    const refRow = refS.get(r.championId)
    let patchRefWinratePp: number | undefined
    let patchRefPickratePp: number | undefined
    let patchRefBanratePp: number | undefined
    let patchRefMainRolePctPp: number | undefined
    let patchRefGamesDelta: number | undefined
    let patchRefMatchupScorePp: number | undefined
    if (refRow) {
      patchRefWinratePp = (r.winrate - refRow.winrate) * 100
      patchRefPickratePp = (r.pickrate - refRow.pickrate) * 100
      patchRefBanratePp = (r.banrate - refRow.banrate) * 100
      patchRefMainRolePctPp = r.mainRolePct - refRow.mainRolePct
      patchRefGamesDelta = r.games - refRow.games
      patchRefMatchupScorePp = (r.pbi - refRow.pbi) * 100
    }
    const refHe = refHeMap.get(r.championId)
    let patchRefHighEloWinratePp: number | undefined
    let patchRefHighEloGamesDelta: number | undefined
    if (he && refHe) {
      patchRefHighEloWinratePp = (he.winrate - refHe.winrate) * 100
      patchRefHighEloGamesDelta = he.games - refHe.games
    }
    return {
      ...r,
      highEloRank: he?.rank,
      highEloWinrate: he?.winrate,
      highEloGames: he?.games,
      delta,
      patchRefWinratePp,
      patchRefPickratePp,
      patchRefBanratePp,
      patchRefMainRolePctPp,
      patchRefGamesDelta,
      patchRefHighEloWinratePp,
      patchRefHighEloGamesDelta,
      patchRefMatchupScorePp,
    }
  })
})

/** Rôle appliqué côté API (stats du rôle choisi, y compris si ce n’est pas le rôle le plus joué). */
const tierListRoleFilteredRows = computed(() => tierListRows.value)

/** Tier list only: filtre par nom / id (champ de recherche). */
const tierListSearchFilteredRows = computed(() => {
  const list = tierListRoleFilteredRows.value
  const raw = championSearchQuery.value.trim().toLowerCase()
  if (!raw) return list
  return list.filter(row => {
    const name = championName(row.championId)?.toLowerCase() ?? ''
    const idStr = String(row.championId)
    return name.includes(raw) || idStr === raw || idStr.includes(raw)
  })
})

/** Rank displayed in table: recomputed on filtered cohort (role filter), independent from sort columns. */
const tierListFilteredRankByChampionId = computed(() => {
  const map = new Map<number, number>()
  const ordered = [...tierListRoleFilteredRows.value].sort((a, b) => a.rank - b.rank)
  ordered.forEach((row, idx) => map.set(row.championId, idx + 1))
  return map
})

/** Reference patch rank map, filtered with the same role filter as current table. */
const tierListRefFilteredRankByChampionId = computed(() => {
  const map = new Map<number, number>()
  const list = tierListRefRows.value.filter(row =>
    statsRoleFilter.value ? row.mainRole === statsRoleFilter.value : true
  )
  const ordered = [...list].sort((a, b) => a.rank - b.rank)
  ordered.forEach((row, idx) => map.set(row.championId, idx + 1))
  return map
})

const sortedTierListRows = computed(() => {
  const list = tierListSearchFilteredRows.value
  const col = tierListSortColumn.value
  const dir = tierListSortDir.value
  if (!col || col === 'champion') {
    return [...list].sort((a, b) => a.rank - b.rank)
  }
  const mult = dir === 'desc' ? 1 : -1
  return [...list].sort((a, b) => {
    let diff = 0
    if (col === 'rank') diff = a.rank - b.rank
    else if (col === 'tier') diff = (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0)
    else if (col === 'mainRolePct') diff = a.mainRolePct - b.mainRolePct
    else if (col === 'patchMainRolePctPp')
      diff = (a.patchRefMainRolePctPp ?? 0) - (b.patchRefMainRolePctPp ?? 0)
    else if (col === 'winrate') diff = a.winrate - b.winrate
    else if (col === 'pickrate') diff = a.pickrate - b.pickrate
    else if (col === 'patchWinratePp')
      diff = (a.patchRefWinratePp ?? 0) - (b.patchRefWinratePp ?? 0)
    else if (col === 'patchPickratePp')
      diff = (a.patchRefPickratePp ?? 0) - (b.patchRefPickratePp ?? 0)
    else if (col === 'pbi') diff = a.pbi - b.pbi
    else if (col === 'patchPbiPp')
      diff = (a.patchRefMatchupScorePp ?? 0) - (b.patchRefMatchupScorePp ?? 0)
    else if (col === 'games') diff = a.games - b.games
    else if (col === 'patchGamesDelta')
      diff = (a.patchRefGamesDelta ?? 0) - (b.patchRefGamesDelta ?? 0)
    else if (col === 'highEloRank') diff = (a.highEloRank ?? 0) - (b.highEloRank ?? 0)
    else if (col === 'highEloWinrate') diff = (a.highEloWinrate ?? 0) - (b.highEloWinrate ?? 0)
    else if (col === 'patchHighEloWinratePp')
      diff = (a.patchRefHighEloWinratePp ?? 0) - (b.patchRefHighEloWinratePp ?? 0)
    else if (col === 'highEloGames') diff = (a.highEloGames ?? 0) - (b.highEloGames ?? 0)
    else if (col === 'patchHighEloGamesDelta')
      diff = (a.patchRefHighEloGamesDelta ?? 0) - (b.patchRefHighEloGamesDelta ?? 0)
    else if (col === 'delta') diff = (a.delta ?? 0) - (b.delta ?? 0)
    return mult * diff
  })
})

const totalTierListCount = computed(() => sortedTierListRows.value.length)
const totalTierListPages = computed(() =>
  Math.max(1, Math.ceil(totalTierListCount.value / championsPageSize.value))
)
const paginatedTierList = computed(() => {
  const list = sortedTierListRows.value
  const size = championsPageSize.value
  const page = Math.min(tierListPage.value, Math.max(1, Math.ceil(list.length / size) || 1))
  const start = (page - 1) * size
  return list.slice(start, start + size)
})
const tierListDisplayRankByChampionId = computed(() => {
  return tierListFilteredRankByChampionId.value
})

function tierListPatchRankDelta(championId: number): number | null {
  const cur = tierListFilteredRankByChampionId.value.get(championId)
  const ref = tierListRefFilteredRankByChampionId.value.get(championId)
  if (cur == null || ref == null) return null
  // Positive => rank improved (e.g. 10 -> 7 => +3).
  return ref - cur
}

function formatTierListPatchDeltaRank(delta: number): string {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${Math.round(delta)}`
}

function tierListPatchDeltaRankClass(delta: number): string {
  if (delta > 0) return 'text-green-400/90'
  if (delta < 0) return 'text-red-400/90'
  return 'text-text/55'
}

/** Tier list chart: strictly ordered by matchup score (worst -> best). */
const tierListChartRows = computed(() =>
  [...tierListSearchFilteredRows.value].sort((a, b) => {
    const byScore = a.pbi - b.pbi
    if (byScore !== 0) return byScore
    return a.rank - b.rank
  })
)
const tierListChartActiveTiers = ref<Array<'S+' | 'S' | 'A' | 'B' | 'C' | 'D'>>([])
/** Tooltip graphique tier list : suit la souris, au-dessus du curseur. */
const tierListChartTooltip = ref<{ championId: number; x: number; y: number } | null>(null)
function onTierListChartBarEnter(c: TierListRowWithDelta, e: MouseEvent) {
  tierListChartTooltip.value = { championId: c.championId, x: e.clientX, y: e.clientY }
}
function onTierListChartBarMove(e: MouseEvent) {
  const t = tierListChartTooltip.value
  if (!t) return
  tierListChartTooltip.value = { ...t, x: e.clientX, y: e.clientY }
}
function onTierListChartBarLeave() {
  tierListChartTooltip.value = null
}
watch([activeTab, tierListViewModel], () => {
  tierListChartTooltip.value = null
})
/** API = tier « D » pour le plus bas ; l’ancienne légende utilisait « F » — on normalise pour le filtre. */
function tierListChartApiTier(tier: string): 'S+' | 'S' | 'A' | 'B' | 'C' | 'D' {
  const t = tier === 'F' ? 'D' : tier
  return t as 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'
}

const tierListChartVisibleRows = computed(() => {
  const active = tierListChartActiveTiers.value
  if (!active.length) return tierListChartRows.value
  const activeKeys = active.map(k => tierListChartApiTier(k))
  return tierListChartRows.value.filter(row => activeKeys.includes(tierListChartApiTier(row.tier)))
})
const tierListChartTooltipRow = computed((): TierListRowWithDelta | null => {
  const tip = tierListChartTooltip.value
  if (!tip) return null
  return tierListChartVisibleRows.value.find(r => r.championId === tip.championId) ?? null
})

/** Score matchup API (petit nombre) → échelle graphique (×100), plage théorique ±500. */
function scaleMatchupScore(value: number): number {
  const n = Number(value) * 100
  return Number.isFinite(n) ? n : 0
}

const TIER_LIST_MATCHUP_CHART_ABS_MAX = 500

function niceNumForTicks(range: number, round: boolean): number {
  if (!Number.isFinite(range) || range <= 0) return 1
  const exp = Math.floor(Math.log10(range))
  const frac = range / 10 ** exp
  let niceFrac: number
  if (round) {
    if (frac < 1.5) niceFrac = 1
    else if (frac < 3) niceFrac = 2
    else if (frac < 7) niceFrac = 5
    else niceFrac = 10
  } else if (frac <= 1) niceFrac = 1
  else if (frac <= 2) niceFrac = 2
  else if (frac <= 5) niceFrac = 5
  else niceFrac = 10
  return niceFrac * 10 ** exp
}

function computeTierListChartTicks(yMin: number, yMax: number, maxTicks = 7): number[] {
  const span = yMax - yMin
  if (!(span > 0) || !Number.isFinite(span)) {
    return [yMax, yMin].filter(Number.isFinite)
  }
  const step = niceNumForTicks(span / Math.max(maxTicks - 1, 2), true)
  const ticks: number[] = []
  const start = Math.ceil((yMin - 1e-9) / step) * step
  const end = Math.floor((yMax + 1e-9) / step) * step
  for (let t = start; t <= end + step * 0.01; t += step) {
    const x = Math.round(t * 1e4) / 1e4
    if (x >= yMin - 1e-6 && x <= yMax + 1e-6) ticks.push(x)
  }
  if (!ticks.length) return [(yMin + yMax) / 2]
  return [...new Set(ticks)].sort((a, b) => b - a)
}

/** Axe Y adapté aux scores visibles (×100), borné à ±500 ; inclut 0 pour la baseline divergente. */
const tierListChartYScale = computed(() => {
  const rows = tierListChartVisibleRows.value
  const scores =
    rows.length > 0 ? rows.map(r => scaleMatchupScore(r.pbi)).filter(Number.isFinite) : []

  if (scores.length === 0) {
    const yMin = -TIER_LIST_MATCHUP_CHART_ABS_MAX
    const yMax = TIER_LIST_MATCHUP_CHART_ABS_MAX
    return {
      range: yMax - yMin,
      yMin,
      yMax,
      ticks: [500, 250, 0, -250, -500],
    }
  }

  const rawMin = Math.min(...scores)
  const rawMax = Math.max(...scores)
  const dataSpan = Math.max(rawMax - rawMin, 1e-6)
  const pad = Math.max(dataSpan * 0.08, 6)
  let yMin = Math.min(0, rawMin - pad)
  let yMax = Math.max(0, rawMax + pad)
  yMin = Math.max(yMin, -TIER_LIST_MATCHUP_CHART_ABS_MAX)
  yMax = Math.min(yMax, TIER_LIST_MATCHUP_CHART_ABS_MAX)
  if (yMax <= yMin) {
    yMin -= 1
    yMax += 1
  }
  return {
    range: yMax - yMin,
    yMin,
    yMax,
    ticks: computeTierListChartTicks(yMin, yMax, 7),
  }
})

/** Valeurs hors domaine visuel : clamp (tooltip garde la valeur réelle). */
function matchupScoreClampedForChart(pbi: number): number {
  const s = tierListChartYScale.value
  const v = scaleMatchupScore(pbi)
  return Math.min(s.yMax, Math.max(s.yMin, v))
}

function tierListChartYTickBottomPct(tick: number): number {
  const s = tierListChartYScale.value
  const d = s.yMax - s.yMin
  if (!(d > 0) || !Number.isFinite(d)) return 50
  return ((tick - s.yMin) / d) * 100
}

/** Hauteur en % du tracé : distance entre la ligne 0 et le score (pas |score| / plage totale). */
function tierListChartBarHeightPct(pbi: number): number {
  const s = tierListChartYScale.value
  const range = s.yMax - s.yMin
  if (range <= 0) return 0
  const n = matchupScoreClampedForChart(pbi)
  const zeroPct = ((0 - s.yMin) / range) * 100
  const valPct = ((n - s.yMin) / range) * 100
  return Math.abs(valPct - zeroPct)
}

function tierListChartScoreBottomPct(pbi: number): number {
  return tierListChartYTickBottomPct(matchupScoreClampedForChart(pbi))
}

function formatMatchupScore(value: number, decimals = 2): string {
  const n = scaleMatchupScore(value)
  if (!Number.isFinite(n)) return (0).toFixed(decimals)
  return n.toFixed(decimals)
}

const tierListChartHeading = computed(() => {
  const role = statsRoleFilter.value
    ? mainRoleLabel(statsRoleFilter.value)
    : t('statisticsPage.tierListChartAllRoles')
  return t('statisticsPage.tierListChartHeading', { role: role.toUpperCase() })
})

const tierListChartZeroBottomPct = computed(() =>
  Math.min(100, Math.max(0, tierListChartYTickBottomPct(0)))
)

/** Couleurs barres / légende — style diverging tier (F rouge → S+ or). */
const TIER_CHART_COLORS: Record<'F' | 'D' | 'C' | 'B' | 'A' | 'S' | 'S+', string> = {
  F: '#dc2626',
  D: '#dc2626',
  C: '#a78bfa',
  B: '#7dd3fc',
  A: '#3b82f6',
  S: '#22c55e',
  'S+': '#e5c558',
}

const TIER_DIVERGING_LEGEND: Array<{
  key: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'
  color: string
}> = [
  /** Libellé i18n tierF (comme le tableau) — clé API = D */
  { key: 'D', color: TIER_CHART_COLORS.D },
  { key: 'C', color: TIER_CHART_COLORS.C },
  { key: 'B', color: TIER_CHART_COLORS.B },
  { key: 'A', color: TIER_CHART_COLORS.A },
  { key: 'S', color: TIER_CHART_COLORS.S },
  { key: 'S+', color: TIER_CHART_COLORS['S+'] },
]

function tierChartColor(tier: string): string {
  return TIER_CHART_COLORS[tier as keyof typeof TIER_CHART_COLORS] ?? TIER_CHART_COLORS.D
}

function toggleTierListChartTier(tier: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'): void {
  const current = tierListChartActiveTiers.value
  if (current.includes(tier)) {
    tierListChartActiveTiers.value = current.filter(t => t !== tier)
    return
  }
  tierListChartActiveTiers.value = [...current, tier]
}

function tierListChartTierEnabled(tier: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'): boolean {
  const active = tierListChartActiveTiers.value
  return active.length === 0 || active.includes(tier)
}

function tierListChartBarColor(tier: string): string {
  return tierListChartTierEnabled(tier as 'S+' | 'S' | 'A' | 'B' | 'C' | 'D')
    ? tierChartColor(tier)
    : 'rgb(71 85 105 / 0.45)'
}

function tierListChartChampionImage(championId: number): string | null {
  const champ = championByKey(championId)
  if (!champ?.image?.full) return null
  return getChampionImageUrl(gameVersion.value, champ.image.full)
}

function cycleTierListSort(col: TierListSortColumn) {
  if (tierListSortColumn.value === col) {
    if (tierListSortDir.value === 'desc') tierListSortDir.value = 'asc'
    else tierListSortColumn.value = null
  } else {
    tierListSortColumn.value = col
    tierListSortDir.value = 'desc'
  }
}
function tierListSortIcon(col: TierListSortColumn): string {
  if (tierListSortColumn.value !== col) return '—'
  return tierListSortDir.value === 'desc' ? '↓' : '↑'
}
watch([tierListSortColumn, tierListSortDir, championsPageSize, championSearchQuery], () => {
  tierListPage.value = 1
})

function _formatGeneratedAt(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    return d.toLocaleString(locale.value)
  } catch {
    return value
  }
}

// Overview (vue d'ensemble)
const overviewError = ref<string | null>(null)
const overviewData = ref<{
  totalMatches: number
  lastUpdate: string | null
  message?: string
  topWinrateChampions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  topPickrateChampions?: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  topBanrateChampions?: Array<{
    championId: number
    banCount: number
    banrate: number
  }>
  matchesByDivision: Array<{ rankTier: string; matchCount: number }>
  matchesByVersion?: Array<{ version: string; matchCount: number }>
  playerCount: number
  surrenderBySide?: {
    blue: { total: number; earlySurrenderCount: number; surrenderCount: number }
    red: { total: number; earlySurrenderCount: number; surrenderCount: number }
  }
} | null>(null)
const overviewPending = ref(true)
/** Selected version filter for overview (null = all versions). */
/** Filtres communs à tous les onglets (version, division, rôle). */
const statsVersionFilter = ref('')
const statsDivisionFilter = ref<string[]>([])
const statsRoleFilter = ref('')
const statsOtpFilter = ref<'oui' | 'non' | 'solo'>('non')
const balanceGlobalFilter = ref<'ALL' | 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'>('ALL')
const balanceAverageFilter = ref<'ALL' | 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'>('ALL')
const balanceSkilledFilter = ref<'ALL' | 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'>('ALL')
const balanceEliteFilter = ref<'ALL' | 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'>('ALL')
const progressionFromVersionOverride = ref('')
const isApplyingQueryState = ref(false)
const isSyncingQueryState = ref(false)

function queryAll(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

function applyStatisticsStateFromQuery(): void {
  const tabRaw = queryFirst(route.query.tab as string | string[] | null | undefined)
  const versionRaw = queryFirst(route.query.version as string | string[] | null | undefined)
  const roleRaw = queryFirst(route.query.role as string | string[] | null | undefined).toUpperCase()
  const otpRaw = queryFirst(route.query.otp as string | string[] | null | undefined)
  const divisionsRaw = queryAll(route.query.rankTier as string | string[] | null | undefined)
    .map(v => v.toUpperCase())
    .filter(Boolean)

  isApplyingQueryState.value = true
  if (tabRaw) activeTab.value = normalizeLegacyTab(tabRaw)
  else activeTab.value = 'overview'
  statsVersionFilter.value = versionRaw
  statsRoleFilter.value = roleRaw
  statsDivisionFilter.value = divisionsRaw
  statsOtpFilter.value = otpRaw === 'oui' || otpRaw === 'solo' || otpRaw === 'non' ? otpRaw : 'non'
  isApplyingQueryState.value = false
  if (import.meta.client) {
    syncProgressionDeltaToVersionBeforeFilter()
  }
}

function syncStatisticsStateToQuery(): void {
  if (!import.meta.client) return
  if (isApplyingQueryState.value) return
  const nextQuery = { ...route.query } as Record<string, string | string[]>

  if (activeTab.value !== 'overview') nextQuery.tab = activeTab.value
  else delete nextQuery.tab

  if (statsVersionFilter.value) nextQuery.version = statsVersionFilter.value
  else delete nextQuery.version

  if (statsRoleFilter.value) nextQuery.role = statsRoleFilter.value
  else delete nextQuery.role

  if (statsOtpFilter.value !== 'non') nextQuery.otp = statsOtpFilter.value
  else delete nextQuery.otp

  if (statsDivisionFilter.value.length > 0) nextQuery.rankTier = [...statsDivisionFilter.value]
  else delete nextQuery.rankTier

  isSyncingQueryState.value = true
  router.replace({ query: nextQuery }).finally(() => {
    isSyncingQueryState.value = false
  })
}
const filtersOpen = computed({
  get: () => statisticsUiStore.filtersOpen,
  set: value => statisticsUiStore.setFiltersOpen(value),
})
function openFilters() {
  filtersOpen.value = true
}
function closeFilters() {
  filtersOpen.value = false
}
function toggleFiltersOpen() {
  filtersOpen.value = !filtersOpen.value
}
const statsKnownVersions = ref<Array<{ version: string; matchCount: number }>>([])

watch(activeTab, value => {
  if (!import.meta.client) return
  statisticsUiStore.setActiveTab(normalizeLegacyTab(value))
})

watch(
  () => route.query,
  () => {
    if (!import.meta.client) return
    if (isSyncingQueryState.value) return
    applyStatisticsStateFromQuery()
  }
)

/** Alias pour compatibilité avec l’overview (requête utilise version/rankTier). */
const _overviewVersionFilter = computed(() => statsVersionFilter.value || null)
const overviewDivisionFilter = computed<string[] | null>(() =>
  statsDivisionFilter.value.length > 0 ? statsDivisionFilter.value : null
)
function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(x => Number(x))
  const pb = b.split('.').map(x => Number(x))
  const maxLen = Math.max(pa.length, pb.length)
  for (let i = 0; i < maxLen; i++) {
    const da = Number.isFinite(pa[i]) ? (pa[i] as number) : 0
    const db = Number.isFinite(pb[i]) ? (pb[i] as number) : 0
    if (da !== db) return db - da
  }
  return b.localeCompare(a)
}
function mergeKnownVersions(
  rows: Array<{ version: string; matchCount: number }> | null | undefined
): void {
  if (!rows?.length) return
  const byVersion = new Map<string, number>(
    statsKnownVersions.value.map(v => [v.version, v.matchCount])
  )
  for (const row of rows) {
    if (!row?.version) continue
    const prev = byVersion.get(row.version) ?? 0
    byVersion.set(row.version, Math.max(prev, Number(row.matchCount) || 0))
  }
  statsKnownVersions.value = Array.from(byVersion.entries())
    .map(([version, matchCount]) => ({ version, matchCount }))
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
}

async function loadKnownVersionsFromGameData(): Promise<void> {
  try {
    const data = await statsFetch<{
      versions?: Array<{ version?: string; patchLabel?: string }>
    }>(apiUrl('/api/game-data/versions'))
    const rows =
      data?.versions
        ?.map(v => {
          const version = String(v.patchLabel ?? v.version ?? '').trim()
          return version ? { version, matchCount: 0 } : null
        })
        .filter((v): v is { version: string; matchCount: number } => v != null) ?? []
    mergeKnownVersions(rows)
  } catch {
    // ignore versions catalog failures, overview data remains fallback
  }
}
const statsVersionOptions = computed(() => {
  if (statsKnownVersions.value.length > 0) return statsKnownVersions.value
  const fallback = overviewData.value?.matchesByVersion ?? []
  return [...fallback].sort((a, b) => compareVersionsDesc(a.version, b.version))
})

// Init client après statsVersionOptions (applyStatisticsStateFromQuery → syncProgressionDelta).
if (import.meta.client) {
  statisticsUiStore.init()
  statisticsCustomStore.init()
  applyStatisticsStateFromQuery()
}

const versionMatchCountByVersion = computed(() => {
  const map = new Map<string, number>()
  for (const row of statsVersionOptions.value) {
    if (!row?.version) continue
    map.set(row.version, Number(row.matchCount) || 0)
  }
  return map
})
function versionMatchCount(version: string | null | undefined): number {
  if (!version) return 0
  return versionMatchCountByVersion.value.get(version) ?? 0
}
const infosMatrixPending = ref(false)
const infosMatrixError = ref<string | null>(null)
const infosMatrixData = ref<{
  divisions: string[]
  rows: Array<{ version: string; all: number; byDivision: Record<string, number> }>
} | null>(null)
const infosMetaPending = ref(false)
const infosMetaError = ref<string | null>(null)
const infosMetaData = ref<{
  totalMatches: number
  totalPlayers: number
  playersWithoutLastSeen: number
} | null>(null)
const infosMatrixColumns = computed(() => {
  const rankOrder = rankTiers
  const present = new Set(
    (infosMatrixData.value?.divisions ?? []).map(v => String(v).toUpperCase())
  )
  const ordered = rankOrder.filter(t => present.has(t))
  return ['ALL', ...ordered]
})
const infosMatrixRows = computed(() => {
  const rows = infosMatrixData.value?.rows ?? []
  return [...rows].sort((a, b) => compareVersionsDesc(a.version, b.version))
})
function infosMatrixCell(
  row: { version: string; all: number; byDivision: Record<string, number> },
  division: string
): number {
  if (division === 'ALL') return Number(row.all ?? 0)
  return Number(row.byDivision?.[division] ?? 0)
}
/** Résumé versions (version + nb parties) pour la description en haut de page. */
const _overviewDescriptionVersionsSummary = computed(() => {
  const list = overviewData.value?.matchesByVersion ?? []
  if (!list.length) return ''
  return list.map(v => `${v.version} (${v.matchCount})`).join(', ')
})
/** Divisions à afficher dans la description (sans UNRANKED). */
const _overviewDivisionsForDescription = computed(() => {
  const list = overviewData.value?.matchesByDivision ?? []
  return list.filter(d => d.rankTier !== 'UNRANKED')
})
/** Pourcentage de parties pour une division (sur le total des divisions). */
function formatDivisionLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}
function _divisionPercent(d: { matchCount: number }): string {
  const divisions = overviewData.value?.matchesByDivision ?? []
  const total = divisions.reduce((s, x) => s + (x.matchCount ?? 0), 0)
  if (!total) return '0'
  return (Math.round((d.matchCount / total) * 10000) / 100).toFixed(2)
}
function toggleRoleFilter(r: (typeof roles)[number]) {
  statsRoleFilter.value = statsRoleFilter.value === r.value ? '' : r.value
  onStatsFilterChange()
}
function selectAllRoles() {
  statsRoleFilter.value = ''
  onStatsFilterChange()
}
function toggleDivisionFilter(tier: string) {
  const arr = statsDivisionFilter.value
  const idx = arr.indexOf(tier)
  if (idx >= 0) {
    statsDivisionFilter.value = arr.filter((_, i) => i !== idx)
  } else {
    statsDivisionFilter.value = [...arr, tier]
  }
  onStatsFilterChange()
}
function selectAllDivisions() {
  statsDivisionFilter.value = []
  onStatsFilterChange()
}
function onStatsFilterChange() {
  overviewDetailData.value = null
  overviewDetailBaselineData.value = null
  overviewDetailError.value = false
  balanceFrameworkData.value = null
  balanceFrameworkError.value = false
  if (activeTab.value === 'overview') loadOverview()
  if (activeTab.value === 'infos') loadOverview()
  if (activeTab.value === 'infos') loadInfosMeta()
  if (activeTab.value === 'infos') loadBalanceFramework()
  if (activeTab.value === 'bans') bansTab.loadBansTable()
  if (activeTab.value === 'balance') loadBalanceFramework()
  if (activeTab.value === 'sides') loadOverviewSides()
  if (activeTab.value === 'champions') loadChampions()
  if (['runes', 'items', 'spells'].includes(activeTab.value)) {
    loadOverviewDetail()
  }
  if (activeTab.value === 'runes' || activeTab.value === 'items' || activeTab.value === 'spells') {
    loadOverviewDetailBaseline()
  }
  if (activeTab.value === 'team') {
    loadOverviewSides()
    loadOverviewTeams()
  }
  if (activeTab.value === 'trends') loadProgressionsFull()
  if (activeTab.value === 'abandons') loadOverviewAbandons()
  if (statsVersionOptions.value.length <= 1) {
    loadOverviewVersionsCatalog()
  }
}

function resetStatsFilters() {
  statsVersionFilter.value = ''
  statsDivisionFilter.value = []
  statsRoleFilter.value = ''
  statsOtpFilter.value = 'non'
  balanceGlobalFilter.value = 'ALL'
  balanceAverageFilter.value = 'ALL'
  balanceSkilledFilter.value = 'ALL'
  balanceEliteFilter.value = 'ALL'
  progressionFromVersionOverride.value = ''
  championSearchQuery.value = ''
  onStatsFilterChange()
}

const balanceFrameworkData = ref<{
  rules: Record<string, unknown> | null
  currentPatch: string
  previousPatch: string | null
  abrByLevel: { average: number; skilled: number; elite: number }
  rows: Array<{
    championId: number
    role: string
    average: { status: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'; delta: string | null }
    skilled: { status: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'; delta: string | null }
    elite: { status: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'; delta: string | null }
    globalStatus: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'
    globalDelta: string | null
  }>
} | null>(null)
const balanceFrameworkPending = ref(false)
const balanceFrameworkError = ref(false)

async function loadBalanceFramework() {
  balanceFrameworkPending.value = true
  balanceFrameworkError.value = false
  try {
    const params = new URLSearchParams()
    if (statsVersionFilter.value) params.set('version', statsVersionFilter.value)
    if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
    if (statsOtpFilter.value && statsOtpFilter.value !== 'non')
      params.set('otp', statsOtpFilter.value)
    const q = params.toString()
    balanceFrameworkData.value = await statsFetch(
      apiUrl('/api/stats/balance-framework' + (q ? `?${q}` : '')),
      { timeout: OVERVIEW_DETAIL_TIMEOUT_MS }
    )
  } catch {
    balanceFrameworkData.value = null
    balanceFrameworkError.value = true
  } finally {
    balanceFrameworkPending.value = false
  }
}
/** Overview detail (runes, items, spells) from GET /api/stats/overview-detail */
const overviewDetailData = ref<{
  totalParticipants: number
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  runeSets: Array<{
    runes: unknown
    shards?: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  shards?: Array<{
    shardId: number
    slot: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  items: Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }>
  itemsStarters?: Array<{
    itemId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemsCores?: Array<{
    itemId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemsFinals?: Array<{
    itemId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemsBoots?: Array<{
    itemId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemSets: Array<{
    items: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemStarterSets?: Array<{
    items: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemsByOrder: Record<
    string,
    Array<{ itemId: number; games: number; wins: number; winrate: number }>
  >
  summonerSpells: Array<{
    spellId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
    countSlot0?: number
    countSlot1?: number
    pctSlotD?: number
    pctSlotF?: number
    highEloGames?: number
    highEloWinrate?: number
    highEloRank?: number
  }>
  summonerSpellSets: Array<{
    spellIdD: number
    spellIdF: number
    games: number
    wins: number
    pickrate: number
    winrate: number
    highEloGames?: number
    highEloWinrate?: number
    highEloRank?: number
  }>
} | null>(null)
const overviewDetailBaselineData = ref<typeof overviewDetailData.value>(null)
const overviewDetailBaselinePending = ref(false)
const overviewDetailPending = ref(false)
function overviewQueryParams(opts?: { version?: string | null; includeSmite?: boolean }): string {
  const params = new URLSearchParams()
  const ver = opts?.version != null && opts.version !== '' ? opts.version : statsVersionFilter.value
  if (ver) params.set('version', ver)
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  params.set('otp', statsOtpFilter.value)
  if (opts?.includeSmite) params.set('includeSmite', '1')
  const q = params.toString()
  return q ? '?' + q : ''
}
const STATS_FETCH_TIMEOUT_MS = 90_000

/** Logs de perf (dev only) pour identifier ce qui ralentit l’affichage des stats. */
function isStatsPerfEnabled(): boolean {
  if (import.meta.dev) return true
  if (import.meta.client && typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('stats_perf') === '1'
  }
  return false
}
function statsPerfStart(_label: string): number {
  if (!isStatsPerfEnabled()) return 0
  return performance.now()
}
function statsPerfEnd(_label: string, start: number) {
  if (!isStatsPerfEnabled() || start === 0) return // eslint-disable-line no-useless-return
}

/** Fetch stats API and log backend timing from X-Backend-Time / X-Stats-Path (tout au même endroit que les logs front). */
function statsFetch<T = unknown>(url: string, options?: Parameters<typeof $fetch>[1]): Promise<T> {
  const existingOnResponse = (options as { onResponse?: (ctx: { response: Response }) => void })
    ?.onResponse
  return $fetch(url, {
    ...options,
    onResponse: ctx => {
      existingOnResponse?.(ctx)
    },
  }) as Promise<T>
}

async function loadOverview() {
  const t = statsPerfStart('loadOverview')
  overviewPending.value = true
  overviewError.value = null
  const baseUrl = apiUrl('/api/stats')
  const query = overviewQueryParams()
  try {
    const overviewRes = await statsFetch<typeof overviewData.value>(baseUrl + '/overview' + query, {
      timeout: STATS_FETCH_TIMEOUT_MS,
    })
    overviewData.value = overviewRes as typeof overviewData.value
    mergeKnownVersions(overviewData.value?.matchesByVersion)
    await loadOverviewProgression()
    loadProgressionsFull()
    loadOverviewAbandons()
    loadOverviewTeams()
    loadOverviewDurationWinrate()
  } catch (err) {
    overviewData.value = null
    const errData =
      err && typeof err === 'object' && 'data' in err ? (err as { data?: unknown }).data : null
    const backendMsg =
      errData && typeof errData === 'object' && errData !== null && 'message' in errData
        ? String((errData as { message: unknown }).message)
        : null
    overviewError.value =
      backendMsg ||
      (err instanceof Error ? err.message : null) ||
      'Impossible de charger les statistiques (vérifiez que le backend est démarré).'
  } finally {
    overviewPending.value = false
    statsPerfEnd('loadOverview', t)
    // Toujours tenter de charger runes/items/sorts même si l’overview a échoué
  }
}

async function loadInfosPatchDivisionMatrix() {
  if (infosMatrixPending.value) return
  infosMatrixPending.value = true
  infosMatrixError.value = null
  try {
    infosMatrixData.value = await statsFetch(apiUrl('/api/stats/infos/patch-division-matrix'))
  } catch (err) {
    infosMatrixData.value = null
    infosMatrixError.value = err instanceof Error ? err.message : String(err)
  } finally {
    infosMatrixPending.value = false
  }
}

async function loadInfosMeta() {
  if (infosMetaPending.value) return
  infosMetaPending.value = true
  infosMetaError.value = null
  try {
    infosMetaData.value = await statsFetch<typeof infosMetaData.value>(
      apiUrl('/api/stats/infos/meta')
    )
  } catch (err) {
    infosMetaData.value = null
    infosMetaError.value = err instanceof Error ? err.message : String(err)
  } finally {
    infosMetaPending.value = false
  }
}

async function loadOverviewVersionsCatalog() {
  mergeKnownVersions(overviewData.value?.matchesByVersion)
  await loadKnownVersionsFromGameData()
  const params = new URLSearchParams()
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  params.set('otp', statsOtpFilter.value)
  const q = params.toString() ? '?' + params.toString() : ''
  try {
    const data = await statsFetch<{
      matchesByVersion?: Array<{ version: string; matchCount: number }>
    }>(apiUrl('/api/stats/overview' + q))
    mergeKnownVersions(data?.matchesByVersion)
  } catch {
    // Keep current options if catalog request fails.
  }
}
/** Duration vs winrate (5-min buckets, uses version + rank filters). */
const overviewDurationWinrateData = ref<{
  buckets: Array<{ durationMin: number; matchCount: number; wins: number; winrate: number }>
} | null>(null)
const overviewDurationWinratePending = ref(false)
async function loadOverviewDurationWinrate() {
  const t = statsPerfStart('loadOverviewDurationWinrate')
  overviewDurationWinratePending.value = true
  try {
    overviewDurationWinrateData.value = await statsFetch(
      apiUrl('/api/stats/overview-duration-winrate' + overviewQueryParams())
    )
  } catch {
    overviewDurationWinrateData.value = null
  } finally {
    overviewDurationWinratePending.value = false
    statsPerfEnd('loadOverviewDurationWinrate', t)
  }
}

/** Stats abandons (remake, surrender). GET /api/stats/overview-abandons */
const overviewAbandonsData = ref<{
  totalMatches: number
  remakeCount: number
  remakeRate: number
  surrenderCount: number
  surrenderRate: number
  earlySurrenderCount: number
  earlySurrenderRate: number
} | null>(null)
const overviewAbandonsPending = ref(false)
async function loadOverviewAbandons() {
  const t = statsPerfStart('loadOverviewAbandons')
  overviewAbandonsPending.value = true
  try {
    overviewAbandonsData.value = await statsFetch(
      apiUrl('/api/stats/overview-abandons' + overviewQueryParams())
    )
  } catch {
    overviewAbandonsData.value = null
  } finally {
    overviewAbandonsPending.value = false
    statsPerfEnd('loadOverviewAbandons', t)
  }
}
const overviewMatchOutcomeTotal = computed(() =>
  Number(overviewAbandonsData.value?.totalMatches ?? 0)
)
const overviewEarlySurrenderCount = computed(() =>
  Math.max(0, Number(overviewAbandonsData.value?.earlySurrenderCount ?? 0))
)
const overviewSurrenderOnlyCount = computed(() => {
  const surrender = Math.max(0, Number(overviewAbandonsData.value?.surrenderCount ?? 0))
  return Math.max(0, surrender - overviewEarlySurrenderCount.value)
})
const overviewPlayedCount = computed(() => {
  return Math.max(
    0,
    overviewMatchOutcomeTotal.value -
      overviewEarlySurrenderCount.value -
      overviewSurrenderOnlyCount.value
  )
})
const overviewEarlySurrenderPct = computed(() =>
  overviewMatchOutcomeTotal.value > 0
    ? (overviewEarlySurrenderCount.value / overviewMatchOutcomeTotal.value) * 100
    : 0
)
const overviewSurrenderOnlyPct = computed(() =>
  overviewMatchOutcomeTotal.value > 0
    ? (overviewSurrenderOnlyCount.value / overviewMatchOutcomeTotal.value) * 100
    : 0
)
const overviewPlayedPct = computed(() =>
  overviewMatchOutcomeTotal.value > 0
    ? (overviewPlayedCount.value / overviewMatchOutcomeTotal.value) * 100
    : 0
)
function matchOutcomePct(part: number, total: number): string {
  if (!total) return '0.00'
  return ((part / total) * 100).toFixed(2)
}
/** Progression: WR delta from oldest version to all since. For "Winrate depuis X" encart. */
const overviewProgressionData = ref<{
  oldestVersion: string | null
  gainers: Array<{ championId: number; wrOldest: number; wrSince: number; delta: number }>
  losers: Array<{ championId: number; wrOldest: number; wrSince: number; delta: number }>
} | null>(null)
async function loadOverviewProgression() {
  const oldest = progressionFromVersion.value
  if (!oldest) {
    overviewProgressionData.value = null
    return
  }
  const t = statsPerfStart('loadOverviewProgression')
  const params = new URLSearchParams()
  params.set('version', oldest)
  if (overviewDivisionFilter.value) {
    for (const t of overviewDivisionFilter.value) params.append('rankTier', t)
  }
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  const q = params.toString() ? '?' + params.toString() : ''
  try {
    overviewProgressionData.value = await statsFetch(apiUrl('/api/stats/overview-progression' + q))
  } catch {
    overviewProgressionData.value = null
  } finally {
    statsPerfEnd('loadOverviewProgression', t)
  }
}
/** Normalise une version (ex. "16.3.123") en préfixe pour l’API (ex. "16.3"). */
function normalizeVersionToPrefix(v: string | null | undefined): string | null {
  if (!v || typeof v !== 'string') return null
  const parts = v.trim().split('.')
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return parts[0] || null
}
/**
 * Filtre version = patch analysé ; delta / référence progression = patch immédiatement plus ancien
 * (liste `statsVersionOptions` triée du plus récent au plus ancien).
 */
function syncProgressionDeltaToVersionBeforeFilter(): boolean {
  const filter = statsVersionFilter.value.trim()
  const list = statsVersionOptions.value
  const before = progressionFromVersionOverride.value
  if (!filter) {
    if (before !== '') {
      progressionFromVersionOverride.value = ''
      return true
    }
    return false
  }
  const idx = list.findIndex(v => v.version === filter)
  if (idx < 0) return false
  const prev = list[idx + 1]?.version ?? ''
  if (before === prev) return false
  progressionFromVersionOverride.value = prev
  return true
}

/** Version for "since" cards: user override, else latest-1, else latest/current. */
const progressionFromVersion = computed(() => {
  if (progressionFromVersionOverride.value) return progressionFromVersionOverride.value
  const versions = statsVersionOptions.value
  if (versions.length >= 2) return versions[1]?.version ?? null
  if (versions.length === 1) return versions[0]?.version ?? null
  return normalizeVersionToPrefix(versionStore.currentVersion)
})
const progressionSelectableVersions = computed(() => {
  const versions = statsVersionOptions.value
  if (!statsVersionFilter.value) return versions
  const filtered = versions.filter(v => v.version !== statsVersionFilter.value)
  return filtered.length > 0 ? filtered : versions
})
const progressionFromVersionModel = computed({
  get: () => progressionFromVersion.value ?? '',
  set: value => {
    progressionFromVersionOverride.value = value || ''
  },
})

if (import.meta.client) {
  watch(statsVersionFilter, () => {
    syncProgressionDeltaToVersionBeforeFilter()
  })
  watch(
    () => statsVersionOptions.value.map(v => v.version).join('\n'),
    () => {
      if (!statsVersionFilter.value) return
      if (progressionFromVersionOverride.value !== '') return
      syncProgressionDeltaToVersionBeforeFilter()
    }
  )
}

function applyDefaultVersionFiltersFromKnownVersions(): boolean {
  const versions = statsVersionOptions.value
  if (!versions.length) return false
  let changed = false
  if (!statsVersionFilter.value) {
    statsVersionFilter.value = versions[0]?.version ?? ''
    changed = true
  }
  const progChanged = syncProgressionDeltaToVersionBeforeFilter()
  return changed || progChanged
}

/** Progressions complètes (tous les champions, WR + pickrate) pour onglet Progressions. */
const progressionFullData = ref<{
  oldestVersion: string | null
  champions: Array<{
    championId: number
    wrOldest: number
    wrSince: number
    deltaWr: number
    pickrateOldest: number
    pickrateSince: number
    deltaPick: number
    banrateOldest: number
    banrateSince: number
    deltaBan: number
  }>
} | null>(null)
const progressionFullPending = ref(false)
async function loadProgressionsFull() {
  const oldest = progressionFromVersion.value
  if (!oldest) {
    progressionFullData.value = null
    return
  }
  const t = statsPerfStart('loadProgressionsFull')
  progressionFullPending.value = true
  const params = new URLSearchParams()
  params.set('version', oldest)
  if (overviewDivisionFilter.value) {
    for (const t of overviewDivisionFilter.value) params.append('rankTier', t)
  }
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  const q = params.toString() ? '?' + params.toString() : ''
  try {
    progressionFullData.value = await statsFetch(apiUrl('/api/stats/overview-progression-full' + q))
  } catch {
    progressionFullData.value = null
  } finally {
    progressionFullPending.value = false
    statsPerfEnd('loadProgressionsFull', t)
  }
}
/** Même liste que progressionFullData.champions mais triée par delta pickrate (pour table popularité). */
const progressionFullByPickrate = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  return [...list].sort((a, b) => b.deltaPick - a.deltaPick)
})
const progressionSinceSlices = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  const topWinrate = [...list]
    .filter(r => r.deltaWr > 0)
    .sort((a, b) => b.deltaWr - a.deltaWr)
    .slice(0, 5)
  const topPickrate = [...list]
    .filter(r => r.deltaPick > 0)
    .sort((a, b) => b.deltaPick - a.deltaPick)
    .slice(0, 5)
  const topBanrate = [...list]
    .filter(r => r.deltaBan > 0)
    .sort((a, b) => b.deltaBan - a.deltaBan)
    .slice(0, 5)
  const bottomWinrate = [...list]
    .filter(r => r.deltaWr < 0)
    .sort((a, b) => a.deltaWr - b.deltaWr)
    .slice(0, 5)
  const bottomPickrate = [...list]
    .filter(r => r.deltaPick < 0)
    .sort((a, b) => a.deltaPick - b.deltaPick)
    .slice(0, 5)
  const bottomBanrate = [...list]
    .filter(r => r.deltaBan < 0)
    .sort((a, b) => a.deltaBan - b.deltaBan)
    .slice(0, 5)
  return { topWinrate, topPickrate, topBanrate, bottomWinrate, bottomPickrate, bottomBanrate }
})
const overviewTopWinrateSince = computed(() => progressionSinceSlices.value.topWinrate)
const overviewTopPickrateSince = computed(() => progressionSinceSlices.value.topPickrate)
const overviewTopBanrateSince = computed(() => progressionSinceSlices.value.topBanrate)
const overviewBottomWinrateSince = computed(() => progressionSinceSlices.value.bottomWinrate)
const overviewBottomPickrateSince = computed(() => progressionSinceSlices.value.bottomPickrate)
const overviewBottomBanrateSince = computed(() => progressionSinceSlices.value.bottomBanrate)
const CHART_W = 560
const CHART_H = 260
const CHART_PAD = { left: 44, right: 20, top: 20, bottom: 30 }
const PLOT_W = CHART_W - CHART_PAD.left - CHART_PAD.right
const PLOT_H = CHART_H - CHART_PAD.top - CHART_PAD.bottom
const durationWinrateTooltip = ref<{
  durationLabel: string
  winrate: number
  matchCount: number
  index: number
} | null>(null)
/** Catmull-Rom to cubic Bezier: smooth curve through points. */
function catmullRomToBezier(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return ''
  const p0 = pts[0]
  const p1 = pts[1]
  if (!p0 || !p1) return ''
  if (pts.length === 2) return `M ${p0.x},${p0.y} L ${p1.x},${p1.y}`
  let d = `M ${p0.x},${p0.y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const pi = pts[Math.max(0, i - 1)]
    const pj = pts[i]
    const pk = pts[i + 1]
    const pl = pts[Math.min(pts.length - 1, i + 2)]
    if (!pi || !pj || !pk || !pl) continue
    const cp1x = pj.x + (pk.x - pi.x) / 6
    const cp1y = pj.y + (pk.y - pi.y) / 6
    const cp2x = pk.x - (pl.x - pj.x) / 6
    const cp2y = pk.y - (pl.y - pj.y) / 6
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${pk.x},${pk.y}`
  }
  return d
}

/** Points for line chart: X=duration (min), Y=nombre de parties. Courbe lissée (Catmull-Rom). */
function durationWinrateChartScaled(
  buckets: Array<{ durationMin: number; matchCount: number; wins: number; winrate: number }>
) {
  const empty = {
    linePath: '' as string,
    closedPath: '' as string,
    list: [] as {
      x: number
      y: number
      label: string
      durationLabel: string
      winrate: number
      matchCount: number
    }[],
    axisX: { ticks: [] as { value: number; x: number }[] },
    axisY: { ticks: [] as { value: number; y: number }[] },
    minDur: 0,
    maxDur: 0,
  }
  if (!buckets.length) return empty
  const sanitized = buckets
    .map(b => ({
      durationMin: Number.isFinite(Number(b.durationMin)) ? Number(b.durationMin) : 0,
      matchCount: Number.isFinite(Number(b.matchCount)) ? Math.max(0, Number(b.matchCount)) : 0,
      winrate: Number.isFinite(Number(b.winrate)) ? Number(b.winrate) : 0,
    }))
    .filter(b => Number.isFinite(b.durationMin))
  if (!sanitized.length) return empty
  const sorted = [...sanitized].sort((a, b) => a.durationMin - b.durationMin)
  const minDur = Math.min(...sorted.map(b => b.durationMin))
  const maxDur = Math.max(...sorted.map(b => b.durationMin + 5))
  const durRange = maxDur - minDur || 1
  const maxCount = Math.max(...sorted.map(b => b.matchCount), 1)
  const originY = CHART_PAD.top + PLOT_H
  const pts = sorted.map(b => {
    const midDur = b.durationMin + 2.5
    const x = CHART_PAD.left + ((midDur - minDur) / durRange) * PLOT_W
    const y = originY - (b.matchCount / maxCount) * PLOT_H
    return {
      x,
      y,
      label: `${b.durationMin}-${b.durationMin + 5} min: ${b.matchCount} parties`,
      durationLabel: `${b.durationMin}-${b.durationMin + 5} min`,
      winrate: b.winrate,
      matchCount: b.matchCount,
    }
  })
  if (!pts.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return empty
  const ptsForCurve = pts.map(p => ({ x: p.x, y: p.y }))
  const linePath = catmullRomToBezier(ptsForCurve)
  const firstX = pts[0]?.x ?? CHART_PAD.left
  const lastX = pts[pts.length - 1]?.x ?? CHART_PAD.left + PLOT_W
  const closedPath = `${linePath} L ${lastX},${originY} L ${firstX},${originY} Z`
  const axisXTicks: { value: number; x: number }[] = []
  const step = durRange <= 15 ? 5 : durRange <= 30 ? 10 : 15
  for (let v = Math.ceil(minDur / step) * step; v <= maxDur; v += step) {
    axisXTicks.push({
      value: v,
      x: CHART_PAD.left + ((v - minDur) / durRange) * PLOT_W,
    })
  }
  const axisYTicks: { value: number; y: number }[] = []
  const yStep = Math.max(1, Math.ceil(maxCount / 5))
  for (let v = 0; v <= maxCount; v += yStep) {
    axisYTicks.push({
      value: v,
      y: originY - (v / maxCount) * PLOT_H,
    })
  }
  const lastTick = axisYTicks[axisYTicks.length - 1]?.value ?? 0
  if (lastTick < maxCount) {
    axisYTicks.push({ value: maxCount, y: CHART_PAD.top })
  }
  return {
    linePath,
    closedPath,
    list: pts,
    axisX: { ticks: axisXTicks },
    axisY: { ticks: axisYTicks },
    minDur,
    maxDur,
  }
}
const durationWinrateChartBuckets = computed(() => overviewDurationWinrateData.value?.buckets ?? [])
const durationWinrateChartScaledData = computed(() =>
  durationWinrateChartScaled(durationWinrateChartBuckets.value)
)
/* Chart SVG paths/axes for duration winrate - reserved for chart UI */

const durationWinrateChartClosedPath = computed(
  () => durationWinrateChartScaledData.value.closedPath
)
const durationWinrateChartLinePath = computed(() => durationWinrateChartScaledData.value.linePath)
const durationWinrateChartPointsList = computed(() => durationWinrateChartScaledData.value.list)
const durationWinrateAxisX = computed(() => durationWinrateChartScaledData.value.axisX)
const durationWinrateAxisY = computed(() => durationWinrateChartScaledData.value.axisY)
const durationChartTooltip = ref<{
  durationLabel: string
  winrate: number
  matchCount: number
  x: number
  y: number
} | null>(null)

/** Timeout for overview-detail (runes, items, spells). Requête lourde sur 700k+ participants; retry plus long. */
const OVERVIEW_DETAIL_TIMEOUT_MS = 60_000
const OVERVIEW_DETAIL_RETRY_TIMEOUT_MS = 90_000
const overviewDetailError = ref(false)

async function loadOverviewDetail(isRetry = false) {
  const t = statsPerfStart('loadOverviewDetail' + (isRetry ? ' (retry)' : ''))
  overviewDetailPending.value = true
  overviewDetailError.value = false
  const timeoutMs = isRetry ? OVERVIEW_DETAIL_RETRY_TIMEOUT_MS : OVERVIEW_DETAIL_TIMEOUT_MS
  const includeSmite = activeTab.value === 'spells'
  try {
    overviewDetailData.value = await statsFetch(
      apiUrl('/api/stats/overview-detail' + overviewQueryParams({ includeSmite })),
      { timeout: timeoutMs }
    )
  } catch {
    overviewDetailData.value = null
    overviewDetailError.value = true
  } finally {
    overviewDetailPending.value = false
    statsPerfEnd('loadOverviewDetail', t)
  }
}

function retryOverviewDetail() {
  loadOverviewDetail(true).catch(() => {})
  loadOverviewDetailBaseline().catch(() => {})
}

/** Même filtres que overview-detail, version = patch de comparaison (progressions). */
async function loadOverviewDetailBaseline() {
  const cmp = progressionFromVersion.value
  const cur = statsVersionFilter.value
  if (!cmp || (cur && cmp === cur)) {
    overviewDetailBaselineData.value = null
    overviewDetailBaselinePending.value = false
    return
  }
  overviewDetailBaselinePending.value = true
  const includeSmite = activeTab.value === 'spells'
  try {
    overviewDetailBaselineData.value = await statsFetch(
      apiUrl('/api/stats/overview-detail' + overviewQueryParams({ version: cmp, includeSmite })),
      { timeout: OVERVIEW_DETAIL_TIMEOUT_MS }
    )
  } catch {
    overviewDetailBaselineData.value = null
  } finally {
    overviewDetailBaselinePending.value = false
  }
}

/** Overview teams: bans and objectives (first + distribution for %). */
const overviewTeamsData = ref<{
  matchCount: number
  bans: {
    byWin: Array<{ championId: number; count: number; banRatePercent: string }>
    byLoss: Array<{ championId: number; count: number; banRatePercent: string }>
    top20Total: Array<{ championId: number; count: number; banRatePercent: string }>
  }
  objectives: {
    firstBlood: { firstByWin: number; firstByLoss: number }
    baron: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    dragon: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    elder?: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    tower: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    inhibitor: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    riftHerald: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    horde: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
  }
  drakes?: {
    types: {
      elder: { byWin: number; byLoss: number }
      earth: { byWin: number; byLoss: number }
      water: { byWin: number; byLoss: number }
      wind: { byWin: number; byLoss: number }
      fire: { byWin: number; byLoss: number }
      hextec: { byWin: number; byLoss: number }
      chem: { byWin: number; byLoss: number }
    }
    souls: {
      earth: { byWin: number; byLoss: number }
      water: { byWin: number; byLoss: number }
      wind: { byWin: number; byLoss: number }
      fire: { byWin: number; byLoss: number }
      hextec: { byWin: number; byLoss: number }
      chem: { byWin: number; byLoss: number }
    }
  }
} | null>(null)
const overviewTeamsPending = ref(false)
const bansExpandByWin = ref(false)
const bansExpandByLoss = ref(false)
const objectivesPanelTab = ref<'objectives' | 'drakeTypes' | 'drakeSouls'>('objectives')
function teamPercent(value: number, matchCount: number): string {
  if (!matchCount) return '—'
  return Number((value / matchCount) * 100).toFixed(2) + '%'
}

// Overview by side (Blue / Red)
const overviewSidesData = ref<{
  matchCount: number
  sideWinrate: {
    blue: { matches: number; wins: number; winrate: number }
    red: { matches: number; wins: number; winrate: number }
  }
  championWinrateBySide: {
    blue: Array<{ championId: number; games: number; wins: number; winrate: number }>
    red: Array<{ championId: number; games: number; wins: number; winrate: number }>
  }
  championPickBySide?: {
    blue: Array<{ championId: number; games: number; wins: number; winrate: number }>
    red: Array<{ championId: number; games: number; wins: number; winrate: number }>
  }
  objectivesBySide: {
    blue: Record<string, number>
    red: Record<string, number>
  }
  objectivesBySideTable?: {
    firstBlood: { firstByBlue: number; firstByRed: number }
    [key: string]:
      | {
          firstByBlue?: number
          firstByRed?: number
          killsByBlue?: number
          killsByRed?: number
          distributionByBlue?: Record<string, number>
          distributionByRed?: Record<string, number>
        }
      | undefined
  }
  bansBySide: {
    blue: Array<{ championId: number; count: number }>
    red: Array<{ championId: number; count: number }>
  }
  drakesBySide?: {
    types: Record<string, { byBlue: number; byRed: number }>
    souls: Record<string, { byBlue: number; byRed: number }>
  }
  surrenderBySide?: {
    blue: {
      total: number
      earlySurrenderCount: number
      surrenderCount: number
    }
    red: {
      total: number
      earlySurrenderCount: number
      surrenderCount: number
    }
  }
} | null>(null)
const overviewSidesPending = ref(false)
type OverviewSidesProgRow = {
  championId: number
  wrOldest: number
  wrSince: number
  deltaWr: number
  pickrateOldest: number
  pickrateSince: number
  deltaPick: number
  banrateOldest: number
  banrateSince: number
  deltaBan: number
}
const overviewSidesProgressionData = ref<{
  oldestVersion: string | null
  blue: OverviewSidesProgRow[]
  red: OverviewSidesProgRow[]
} | null>(null)
const objectivesSidesPanelTab = ref<'objectives' | 'drakeTypes' | 'drakeSouls'>('objectives')
const overviewSidesSideWinrate = computed(() => ({
  blue: overviewSidesData.value?.sideWinrate?.blue ?? { matches: 0, wins: 0, winrate: 0 },
  red: overviewSidesData.value?.sideWinrate?.red ?? { matches: 0, wins: 0, winrate: 0 },
}))
const sidesBlueMostPickedRows = computed(() => {
  const rawAll = overviewSidesData.value?.championPickBySide?.blue ?? []
  const tot = rawAll.reduce((s, r) => s + r.games, 0) || 1
  const ranked = [...rawAll]
    .map(r => ({ championId: r.championId, pickrate: (r.games / tot) * 100 }))
    .sort((a, b) => b.pickrate - a.pickrate)
  return takeOverviewChampionTopN(ranked, FAST_STAT_ROW_COUNT)
})
const sidesRedMostPickedRows = computed(() => {
  const rawAll = overviewSidesData.value?.championPickBySide?.red ?? []
  const tot = rawAll.reduce((s, r) => s + r.games, 0) || 1
  const ranked = [...rawAll]
    .map(r => ({ championId: r.championId, pickrate: (r.games / tot) * 100 }))
    .sort((a, b) => b.pickrate - a.pickrate)
  return takeOverviewChampionTopN(ranked, FAST_STAT_ROW_COUNT)
})
const sidesBlueBestWinrateRows = computed(() => {
  const raw = overviewSidesData.value?.championWinrateBySide?.blue ?? []
  const ordered = [...raw].filter(r => r.games >= 5).sort((a, b) => b.winrate - a.winrate)
  return takeOverviewChampionTopN(ordered, FAST_STAT_ROW_COUNT)
})
const sidesRedBestWinrateRows = computed(() => {
  const raw = overviewSidesData.value?.championWinrateBySide?.red ?? []
  const ordered = [...raw].filter(r => r.games >= 5).sort((a, b) => b.winrate - a.winrate)
  return takeOverviewChampionTopN(ordered, FAST_STAT_ROW_COUNT)
})
const sidesBlueBanRows = computed(() => {
  const raw = overviewSidesData.value?.bansBySide?.blue ?? []
  const m = overviewSidesData.value?.matchCount ?? 0
  const ranked = [...raw]
    .map(r => ({
      championId: r.championId,
      count: r.count,
      banrate: m > 0 ? Math.round((r.count / m) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.banrate - a.banrate)
  return takeOverviewChampionTopN(ranked, FAST_STAT_ROW_COUNT)
})
const sidesRedBanRows = computed(() => {
  const raw = overviewSidesData.value?.bansBySide?.red ?? []
  const m = overviewSidesData.value?.matchCount ?? 0
  const ranked = [...raw]
    .map(r => ({
      championId: r.championId,
      count: r.count,
      banrate: m > 0 ? Math.round((r.count / m) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.banrate - a.banrate)
  return takeOverviewChampionTopN(ranked, FAST_STAT_ROW_COUNT)
})
const sidesBlueTopWinrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.blue ?? [])].sort(
    (a, b) => b.deltaWr - a.deltaWr
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesRedTopWinrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.red ?? [])].sort(
    (a, b) => b.deltaWr - a.deltaWr
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesBlueTopPickrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.blue ?? [])].sort(
    (a, b) => b.deltaPick - a.deltaPick
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesRedTopPickrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.red ?? [])].sort(
    (a, b) => b.deltaPick - a.deltaPick
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesBlueTopBanrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.blue ?? [])].sort(
    (a, b) => b.deltaBan - a.deltaBan
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesRedTopBanrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.red ?? [])].sort(
    (a, b) => b.deltaBan - a.deltaBan
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesDrakeTypeRows = computed(() => {
  const d = overviewSidesData.value?.drakesBySide?.types
  if (!d) return []
  return [
    {
      key: 'elder',
      label: t('statisticsPage.overviewTeamsObjective_elder'),
      byBlue: d.elder?.byBlue ?? 0,
      byRed: d.elder?.byRed ?? 0,
    },
    {
      key: 'earth',
      label: t('statisticsPage.drakeTypeEarth'),
      byBlue: d.earth?.byBlue ?? 0,
      byRed: d.earth?.byRed ?? 0,
    },
    {
      key: 'water',
      label: t('statisticsPage.drakeTypeWater'),
      byBlue: d.water?.byBlue ?? 0,
      byRed: d.water?.byRed ?? 0,
    },
    {
      key: 'wind',
      label: t('statisticsPage.drakeTypeWind'),
      byBlue: d.wind?.byBlue ?? 0,
      byRed: d.wind?.byRed ?? 0,
    },
    {
      key: 'fire',
      label: t('statisticsPage.drakeTypeFire'),
      byBlue: d.fire?.byBlue ?? 0,
      byRed: d.fire?.byRed ?? 0,
    },
    {
      key: 'hextec',
      label: t('statisticsPage.drakeTypeHextec'),
      byBlue: d.hextec?.byBlue ?? 0,
      byRed: d.hextec?.byRed ?? 0,
    },
    {
      key: 'chem',
      label: t('statisticsPage.drakeTypeChem'),
      byBlue: d.chem?.byBlue ?? 0,
      byRed: d.chem?.byRed ?? 0,
    },
  ]
})
const sidesDrakeSoulRows = computed(() => {
  const d = overviewSidesData.value?.drakesBySide?.souls
  if (!d) return []
  return [
    {
      key: 'earth',
      label: t('statisticsPage.drakeTypeEarth'),
      byBlue: d.earth?.byBlue ?? 0,
      byRed: d.earth?.byRed ?? 0,
    },
    {
      key: 'water',
      label: t('statisticsPage.drakeTypeWater'),
      byBlue: d.water?.byBlue ?? 0,
      byRed: d.water?.byRed ?? 0,
    },
    {
      key: 'wind',
      label: t('statisticsPage.drakeTypeWind'),
      byBlue: d.wind?.byBlue ?? 0,
      byRed: d.wind?.byRed ?? 0,
    },
    {
      key: 'fire',
      label: t('statisticsPage.drakeTypeFire'),
      byBlue: d.fire?.byBlue ?? 0,
      byRed: d.fire?.byRed ?? 0,
    },
    {
      key: 'hextec',
      label: t('statisticsPage.drakeTypeHextec'),
      byBlue: d.hextec?.byBlue ?? 0,
      byRed: d.hextec?.byRed ?? 0,
    },
    {
      key: 'chem',
      label: t('statisticsPage.drakeTypeChem'),
      byBlue: d.chem?.byBlue ?? 0,
      byRed: d.chem?.byRed ?? 0,
    },
  ]
})
const sidesDrakeSoulGlobal = computed(() => {
  const rows = sidesDrakeSoulRows.value
  return {
    byBlue: rows.reduce((s, r) => s + r.byBlue, 0),
    byRed: rows.reduce((s, r) => s + r.byRed, 0),
  }
})
const sidesObjectiveKeysWithKills = [
  'baron',
  'dragon',
  'elder',
  'tower',
  'inhibitor',
  'riftHerald',
  'horde',
] as const
function objectiveIconSrc(key: string): string | undefined {
  return scoreboardObjectiveIconByKey[key]
}
function drakeIconSrc(key: string): string | undefined {
  return scoreboardDrakeIconByKey[key]
}
function onObjectiveIconError(e: Event, key: string): void {
  const el = e.target as HTMLImageElement
  if (el.dataset.cdFallback === '1') return
  const url = scoreboardObjectiveIconCdByKey[key]
  if (url) {
    el.dataset.cdFallback = '1'
    el.src = url
  }
}
function onDrakeIconError(e: Event, key: string): void {
  const el = e.target as HTMLImageElement
  if (el.dataset.cdFallback === '1') return
  const url = scoreboardDrakeIconCdByKey[key]
  if (url) {
    el.dataset.cdFallback = '1'
    el.src = url
  }
}
const openSidesObjectiveKeys = ref<Set<string>>(new Set())
function toggleSidesObjective(key: string) {
  const next = new Set(openSidesObjectiveKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openSidesObjectiveKeys.value = next
}
/** % of matches where blue/red got first. */
function firstPercentBySide(
  firstByBlue: number,
  firstByRed: number,
  matchCount: number
): { blue: string; red: string } {
  if (!matchCount) return { blue: '—', red: '—' }
  const bluePct = (firstByBlue / matchCount) * 100
  const redPct = (firstByRed / matchCount) * 100
  return { blue: Number(bluePct).toFixed(2) + '%', red: Number(redPct).toFixed(2) + '%' }
}
function objectiveRowSides(key: string): {
  firstByBlue: number
  firstByRed: number
  killsByBlue: number
  killsByRed: number
} {
  const t = overviewSidesData.value?.objectivesBySideTable as
    | Record<
        string,
        { firstByBlue?: number; firstByRed?: number; killsByBlue?: number; killsByRed?: number }
      >
    | undefined
  if (!t?.[key]) return { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0 }
  const obj = t[key]
  return {
    firstByBlue: obj.firstByBlue ?? 0,
    firstByRed: obj.firstByRed ?? 0,
    killsByBlue: obj.killsByBlue ?? 0,
    killsByRed: obj.killsByRed ?? 0,
  }
}
function sidesObjectiveDistributionPercentages(
  key: string,
  byBlue: boolean
): Array<{ count: number; percent: number }> {
  const data = overviewSidesData.value
  if (!data?.matchCount) return []
  const obj = data.objectivesBySideTable?.[key as keyof typeof data.objectivesBySideTable] as
    | { distributionByBlue?: Record<string, number>; distributionByRed?: Record<string, number> }
    | undefined
  if (!obj) return []
  const dist = byBlue ? obj.distributionByBlue : obj.distributionByRed
  if (!dist) return []
  const total = data.matchCount
  const capHorde = key === 'horde'
  const capRiftHerald = key === 'riftHerald'
  const aggregated: Record<number, number> = {}
  for (const [k, n] of Object.entries(dist)) {
    const count = parseInt(k, 10) || 0
    let displayCount = count
    if (capHorde && count > HORDE_DISPLAY_MAX) displayCount = HORDE_DISPLAY_MAX
    else if (capRiftHerald && count > RIFT_HERALD_DISPLAY_MAX)
      displayCount = RIFT_HERALD_DISPLAY_MAX
    aggregated[displayCount] = (aggregated[displayCount] ?? 0) + Number(n)
  }
  return Object.entries(aggregated)
    .map(([countStr, n]) => ({
      count: parseInt(countStr, 10) || 0,
      percent: Math.round((Number(n) / total) * 10000) / 100,
    }))
    .filter(({ percent }) => percent > 0)
    .sort((a, b) => a.count - b.count)
}
function sidesObjectiveCounts(key: string): number[] {
  const blue = sidesObjectiveDistributionPercentages(key, true)
  const red = sidesObjectiveDistributionPercentages(key, false)
  const set = new Set<number>([...blue.map(r => r.count), ...red.map(r => r.count)])
  const sorted = [...set].sort((a, b) => a - b)
  if (key === 'horde') return sorted.filter(c => c <= HORDE_DISPLAY_MAX)
  if (key === 'riftHerald') return sorted.filter(c => c <= RIFT_HERALD_DISPLAY_MAX)
  return sorted
}
function percentForCountSides(key: string, count: number, byBlue: boolean): string {
  const rows = sidesObjectiveDistributionPercentages(key, byBlue)
  const row = rows.find(r => r.count === count)
  return row ? Number(row.percent).toFixed(2) + '%' : '—'
}
function sidesQueryParams(): string {
  const params = new URLSearchParams()
  if (statsVersionFilter.value) params.set('version', statsVersionFilter.value)
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  const s = params.toString()
  return s ? '?' + s : ''
}
function sidesProgressionQueryParams(): string {
  const params = new URLSearchParams()
  if (progressionFromVersion.value) params.set('version', progressionFromVersion.value)
  if (statsVersionFilter.value) params.set('sinceVersion', statsVersionFilter.value)
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  const s = params.toString()
  return s ? '?' + s : ''
}
/** Donut: circumference for r=48 */
const sidesDonutCircumference = 2 * Math.PI * 48
/** Nombre réel de matchs (1 victoire par match, donc blue.wins + red.wins). matchCount côté API = blue.matches + red.matches = 2× matchs. */
const sidesDonutTotalMatches = computed(() => {
  const side = overviewSidesSideWinrate.value
  return side.blue.wins + side.red.wins
})
/** % de matchs gagnés par le côté bleu (bleu + rouge = 100%). */
const sidesDonutBluePct = computed(() => {
  const total = sidesDonutTotalMatches.value
  if (!total) return '0.00'
  const pct = (overviewSidesSideWinrate.value.blue.wins / total) * 100
  return Number(pct).toFixed(2)
})
const sidesDonutRedPct = computed(() => {
  const total = sidesDonutTotalMatches.value
  if (!total) return '0.00'
  const pct = (overviewSidesSideWinrate.value.red.wins / total) * 100
  return Number(pct).toFixed(2)
})
const sidesDonutBlueDash = computed(() => {
  const total = sidesDonutTotalMatches.value
  if (!total) return 0
  const pct = overviewSidesSideWinrate.value.blue.wins / total
  return sidesDonutCircumference * pct
})
const sidesDonutRedDash = computed(() => {
  const total = sidesDonutTotalMatches.value
  if (!total) return 0
  const pct = overviewSidesSideWinrate.value.red.wins / total
  return sidesDonutCircumference * pct
})
const sidesSurrenderBySide = computed(() => ({
  blue: overviewSidesData.value?.surrenderBySide?.blue ?? {
    total: overviewSidesSideWinrate.value.blue.matches,
    earlySurrenderCount: 0,
    surrenderCount: 0,
  },
  red: overviewSidesData.value?.surrenderBySide?.red ?? {
    total: overviewSidesSideWinrate.value.red.matches,
    earlySurrenderCount: 0,
    surrenderCount: 0,
  },
}))
const sidesBlueSurrenderOnlyCount = computed(() =>
  Math.max(
    0,
    Number(sidesSurrenderBySide.value.blue.surrenderCount) -
      Number(sidesSurrenderBySide.value.blue.earlySurrenderCount)
  )
)
const sidesRedSurrenderOnlyCount = computed(() =>
  Math.max(
    0,
    Number(sidesSurrenderBySide.value.red.surrenderCount) -
      Number(sidesSurrenderBySide.value.red.earlySurrenderCount)
  )
)
const sidesBluePlayedCount = computed(() =>
  Math.max(
    0,
    Number(sidesSurrenderBySide.value.blue.total) -
      Number(sidesSurrenderBySide.value.blue.earlySurrenderCount) -
      sidesBlueSurrenderOnlyCount.value
  )
)
const sidesRedPlayedCount = computed(() =>
  Math.max(
    0,
    Number(sidesSurrenderBySide.value.red.total) -
      Number(sidesSurrenderBySide.value.red.earlySurrenderCount) -
      sidesRedSurrenderOnlyCount.value
  )
)
async function loadOverviewSides() {
  const t = statsPerfStart('loadOverviewSides')
  overviewSidesPending.value = true
  try {
    const base = apiUrl('/api/stats/overview-sides' + sidesQueryParams())
    const progUrl = apiUrl('/api/stats/overview-sides-progression' + sidesProgressionQueryParams())
    const [sidesRaw, prog] = await Promise.all([
      statsFetch<unknown>(base),
      statsFetch<NonNullable<typeof overviewSidesProgressionData.value>>(progUrl).catch(() => null),
    ])
    overviewSidesData.value = sidesRaw as NonNullable<(typeof overviewSidesData)['value']>
    overviewSidesProgressionData.value = prog ?? { oldestVersion: null, blue: [], red: [] }
  } catch {
    overviewSidesData.value = null
    overviewSidesProgressionData.value = null
  } finally {
    overviewSidesPending.value = false
    statsPerfEnd('loadOverviewSides', t)
  }
}

async function loadOverviewTeams() {
  const t = statsPerfStart('loadOverviewTeams')
  overviewTeamsPending.value = true
  try {
    overviewTeamsData.value = await statsFetch(
      apiUrl('/api/stats/overview-teams' + overviewQueryParams())
    )
  } catch {
    overviewTeamsData.value = null
  } finally {
    overviewTeamsPending.value = false
    statsPerfEnd('loadOverviewTeams', t)
  }
}

/** True when we have at least overview totalMatches > 0 or teams matchCount > 0 (so we don't show "No stats yet" when only teams data exists). */
const overviewHasAnyStats = computed(
  () =>
    (overviewData.value?.totalMatches ?? 0) > 0 || (overviewTeamsData.value?.matchCount ?? 0) > 0
)
/** Total parties: use overview when > 0, else teams matchCount (when overview fails but teams has data, 0 would be wrong). */
const _overviewEffectiveTotalMatches = computed(() => {
  const total = overviewData.value?.totalMatches ?? 0
  if (total > 0) return total
  return overviewTeamsData.value?.matchCount ?? 0
})
const overviewFilteredChampionIds = computed(() => {
  return new Set((championsData.value?.champions ?? []).map(c => c.championId))
})
const FAST_STAT_ROW_COUNT = 5
/**
 * Prend les n premières lignes en conservant l’ordre API ; priorité aux IDs présents dans /champions,
 * puis complète pour toujours remplir l’affichage fast-stat.
 */
function takeOverviewChampionTopN<T extends { championId: number }>(
  rows: readonly T[],
  n: number = FAST_STAT_ROW_COUNT
): T[] {
  if (!rows.length || n <= 0) return []
  if (statsOtpFilter.value === 'oui') return rows.slice(0, n)
  const allowed = overviewFilteredChampionIds.value
  if (allowed.size === 0) return rows.slice(0, n)
  const out: T[] = []
  const seen = new Set<number>()
  for (const row of rows) {
    if (!allowed.has(row.championId)) continue
    if (seen.has(row.championId)) continue
    seen.add(row.championId)
    out.push(row)
    if (out.length >= n) return out
  }
  for (const row of rows) {
    if (seen.has(row.championId)) continue
    seen.add(row.championId)
    out.push(row)
    if (out.length >= n) return out
  }
  return out
}

const overviewTopPickrateChampionsFiltered = computed(() =>
  takeOverviewChampionTopN(overviewData.value?.topPickrateChampions ?? [], FAST_STAT_ROW_COUNT)
)
const overviewEffectiveTopWinrateChampions = computed(() => {
  const fromOverview = overviewData.value?.topWinrateChampions
  if (fromOverview?.length) {
    return takeOverviewChampionTopN(fromOverview, FAST_STAT_ROW_COUNT)
  }
  const fromPickrate = overviewData.value?.topPickrateChampions
  if (!fromPickrate?.length) return []
  const sorted = [...fromPickrate].sort((a, b) => (b.winrate ?? 0) - (a.winrate ?? 0))
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
/** Top banrate champions: from overview when present, else from teams.bans.top20Total; banrate from API banRatePercent (share of all bans). */
const overviewEffectiveTopBanrateChampions = computed(() => {
  const fromOverview = overviewData.value?.topBanrateChampions
  if (fromOverview?.length) {
    return takeOverviewChampionTopN(fromOverview, FAST_STAT_ROW_COUNT)
  }
  const teams = overviewTeamsData.value?.bans?.top20Total
  if (!teams?.length) return []
  const mapped = teams.slice(0, 120).map(b => {
    const pct = typeof b.banRatePercent === 'string' ? parseFloat(b.banRatePercent) : 0
    return {
      championId: b.championId,
      banCount: b.count,
      banrate: Number.isFinite(pct) ? pct : 0,
    }
  })
  return takeOverviewChampionTopN(mapped, FAST_STAT_ROW_COUNT)
})

/** % of matches where winning team got first, and % where losing team got first. */
function firstPercentByTeam(
  firstByWin: number,
  firstByLoss: number,
  matchCount: number
): { win: string; loss: string } {
  if (!matchCount) return { win: '—', loss: '—' }
  const winPct = (firstByWin / matchCount) * 100
  const lossPct = (firstByLoss / matchCount) * 100
  return { win: Number(winPct).toFixed(2) + '%', loss: Number(lossPct).toFixed(2) + '%' }
}
/** Max count for horde (void grubs) in distribution: 3 (fold 4+ into 3). */
const HORDE_DISPLAY_MAX = 3
/** Max count for Rift Herald: 1 per team per game. */
const RIFT_HERALD_DISPLAY_MAX = 1

/** Distribution as % of matches, sorted by count. For horde cap 3, for riftHerald cap 1. */
function objectiveDistributionPercentages(
  key: string,
  byWin: boolean
): Array<{ count: number; percent: number }> {
  const data = overviewTeamsData.value
  if (!data?.matchCount) return []
  const obj = data.objectives[key as keyof typeof data.objectives]
  if (!obj || !('distributionByWin' in obj)) return []
  const dist = byWin
    ? (obj as { distributionByWin: Record<string, number> }).distributionByWin
    : (obj as { distributionByLoss: Record<string, number> }).distributionByLoss
  if (!dist || typeof dist !== 'object') return []
  const total = data.matchCount
  const capHorde = key === 'horde'
  const capRiftHerald = key === 'riftHerald'
  const aggregated: Record<number, number> = {}
  for (const [k, n] of Object.entries(dist)) {
    const count = parseInt(k, 10) || 0
    let displayCount = count
    if (capHorde && count > HORDE_DISPLAY_MAX) displayCount = HORDE_DISPLAY_MAX
    else if (capRiftHerald && count > RIFT_HERALD_DISPLAY_MAX)
      displayCount = RIFT_HERALD_DISPLAY_MAX
    aggregated[displayCount] = (aggregated[displayCount] ?? 0) + Number(n)
  }
  return Object.entries(aggregated)
    .map(([countStr, n]) => ({
      count: parseInt(countStr, 10) || 0,
      percent: Math.round((Number(n) / total) * 10000) / 100,
    }))
    .filter(({ percent }) => percent > 0)
    .sort((a, b) => a.count - b.count)
}
/** All counts for an objective. For horde 0–3, for riftHerald 0–1. */
function objectiveCounts(key: string): number[] {
  const win = objectiveDistributionPercentages(key, true)
  const loss = objectiveDistributionPercentages(key, false)
  const set = new Set<number>([...win.map(r => r.count), ...loss.map(r => r.count)])
  const sorted = [...set].sort((a, b) => a - b)
  if (key === 'horde') return sorted.filter(c => c <= HORDE_DISPLAY_MAX)
  if (key === 'riftHerald') return sorted.filter(c => c <= RIFT_HERALD_DISPLAY_MAX)
  return sorted
}
/** Percent for a given count and team (for dropdown content). */
function percentForCount(key: string, count: number, byWin: boolean): string {
  const rows = objectiveDistributionPercentages(key, byWin)
  const row = rows.find(r => r.count === count)
  return row ? Number(row.percent).toFixed(2) + '%' : '—'
}
const objectiveKeysWithKills = [
  'baron',
  'dragon',
  'tower',
  'inhibitor',
  'riftHerald',
  'horde',
] as const
const openObjectiveKeys = ref<Set<string>>(new Set())
function toggleObjective(key: string) {
  const next = new Set(openObjectiveKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openObjectiveKeys.value = next
}
function objectiveRow(key: string): {
  firstByWin: number
  firstByLoss: number
  killsByWin: number
  killsByLoss: number
} {
  const o = overviewTeamsData.value?.objectives as
    | Record<
        string,
        { firstByWin?: number; firstByLoss?: number; killsByWin?: number; killsByLoss?: number }
      >
    | undefined
  if (!o?.[key]) return { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 }
  const obj = o[key]
  return {
    firstByWin: obj.firstByWin ?? 0,
    firstByLoss: obj.firstByLoss ?? 0,
    killsByWin: obj.killsByWin ?? 0,
    killsByLoss: obj.killsByLoss ?? 0,
  }
}
const drakeTypeRows = computed(() => {
  const d = overviewTeamsData.value?.drakes?.types
  if (!d) return []
  return [
    {
      key: 'elder',
      label: t('statisticsPage.overviewTeamsObjective_elder'),
      byWin: d.elder?.byWin ?? 0,
      byLoss: d.elder?.byLoss ?? 0,
    },
    {
      key: 'earth',
      label: t('statisticsPage.drakeTypeEarth'),
      byWin: d.earth.byWin,
      byLoss: d.earth.byLoss,
    },
    {
      key: 'water',
      label: t('statisticsPage.drakeTypeWater'),
      byWin: d.water.byWin,
      byLoss: d.water.byLoss,
    },
    {
      key: 'wind',
      label: t('statisticsPage.drakeTypeWind'),
      byWin: d.wind.byWin,
      byLoss: d.wind.byLoss,
    },
    {
      key: 'fire',
      label: t('statisticsPage.drakeTypeFire'),
      byWin: d.fire.byWin,
      byLoss: d.fire.byLoss,
    },
    {
      key: 'hextec',
      label: t('statisticsPage.drakeTypeHextec'),
      byWin: d.hextec.byWin,
      byLoss: d.hextec.byLoss,
    },
    {
      key: 'chem',
      label: t('statisticsPage.drakeTypeChem'),
      byWin: d.chem.byWin,
      byLoss: d.chem.byLoss,
    },
  ]
})
const drakeSoulRows = computed(() => {
  const d = overviewTeamsData.value?.drakes?.souls
  if (!d) return []
  return [
    {
      key: 'earth',
      label: t('statisticsPage.drakeTypeEarth'),
      byWin: d.earth.byWin,
      byLoss: d.earth.byLoss,
    },
    {
      key: 'water',
      label: t('statisticsPage.drakeTypeWater'),
      byWin: d.water.byWin,
      byLoss: d.water.byLoss,
    },
    {
      key: 'wind',
      label: t('statisticsPage.drakeTypeWind'),
      byWin: d.wind.byWin,
      byLoss: d.wind.byLoss,
    },
    {
      key: 'fire',
      label: t('statisticsPage.drakeTypeFire'),
      byWin: d.fire.byWin,
      byLoss: d.fire.byLoss,
    },
    {
      key: 'hextec',
      label: t('statisticsPage.drakeTypeHextec'),
      byWin: d.hextec.byWin,
      byLoss: d.hextec.byLoss,
    },
    {
      key: 'chem',
      label: t('statisticsPage.drakeTypeChem'),
      byWin: d.chem.byWin,
      byLoss: d.chem.byLoss,
    },
  ]
})
const drakeSoulGlobal = computed(() => {
  const rows = drakeSoulRows.value
  return {
    byWin: rows.reduce((s, r) => s + r.byWin, 0),
    byLoss: rows.reduce((s, r) => s + r.byLoss, 0),
  }
})
const rankTiers = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
]
const roles = [
  { value: 'TOP', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'JUNGLE', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'MIDDLE', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'BOTTOM', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'SUPPORT', label: 'Support', icon: '/icons/roles/support.png' },
]
const ROLE_OPTIONS = roles

function mainRoleIconSrc(mainRole: string | null | undefined): string | null {
  const raw = (mainRole ?? '').trim().toUpperCase()
  if (!raw) return null
  const key = raw === 'UTILITY' ? 'SUPPORT' : raw
  return ROLE_OPTIONS.find(r => r.value === key)?.icon ?? null
}

function mainRoleLabel(mainRole: string | null | undefined): string {
  const raw = (mainRole ?? '').trim().toUpperCase()
  if (!raw) return String(mainRole ?? '—')
  const key = raw === 'UTILITY' ? 'SUPPORT' : raw
  return ROLE_OPTIONS.find(r => r.value === key)?.label ?? String(mainRole)
}

// Champions
const championsData = ref<{
  totalGames: number
  totalMatches?: number
  champions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
    banrate?: number
  }>
  message?: string
} | null>(null)
const championsPending = ref(true)
const championsError = ref<string | null>(null)

const tierListPending = ref(false)
const tierListError = ref<string | null>(null)
const tierListData = ref<{
  patch: string
  rankTier: string
  rows: Array<{
    rank: number
    championId: number
    tier: string
    mainRole: string
    mainRolePct: number
    winrate: number
    pickrate: number
    banrate: number
    pbi: number
    games: number
  }>
  highEloRows?: Array<{
    rank: number
    championId: number
    tier: string
    mainRole: string
    mainRolePct: number
    winrate: number
    pickrate: number
    banrate: number
    pbi: number
    games: number
  }>
} | null>(null)
/** Stats ref. patch (progressions) pour Δ WR / pick / ban / Apex. */
const tierListRefStatsById = ref(
  new Map<
    number,
    {
      winrate: number
      pickrate: number
      banrate: number
      games: number
      mainRolePct: number
      pbi: number
    }
  >()
)
const tierListRefHighEloById = ref(new Map<number, { winrate: number; games: number }>())
const tierListRefRows = ref<
  Array<{
    rank: number
    championId: number
    mainRole: string
  }>
>([])

type ChampionGlobalTableRow = {
  championId: number
  blue: {
    games: number
    wins: number
    winrate: number
    pickrate: number
    banrate: number
  }
  red: {
    games: number
    wins: number
    winrate: number
    pickrate: number
    banrate: number
  }
  totalGames: number
  avgDamageToChamps: number
  avgDamageToChampsPhys: number
  avgDamageToChampsMagic: number
  avgDamageToChampsTrue: number
  avgDamageTakenPhys: number
  avgDamageTakenMagic: number
  avgDamageTakenTrue: number
  avgDamageTakenTotal: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
}

type ChampionGlobalNumericDeltaKey =
  | 'avgDamageToChamps'
  | 'avgDamageToChampsPhys'
  | 'avgDamageToChampsMagic'
  | 'avgDamageToChampsTrue'
  | 'avgDamageTakenTotal'
  | 'avgDamageTakenPhys'
  | 'avgDamageTakenMagic'
  | 'avgDamageTakenTrue'
  | 'avgKills'
  | 'avgDeaths'
  | 'avgAssists'

type ChampionGlobalSortColumn =
  | 'champion'
  | 'blueWinrate'
  | 'bluePickrate'
  | 'blueWinrateDelta'
  | 'bluePickrateDelta'
  | 'redWinrate'
  | 'redPickrate'
  | 'redWinrateDelta'
  | 'redPickrateDelta'
  | 'dmgTotal'
  | 'dmgTotalDelta'
  | 'dmgPhys'
  | 'dmgPhysDelta'
  | 'dmgMagic'
  | 'dmgMagicDelta'
  | 'dmgTrue'
  | 'dmgTrueDelta'
  | 'takenTotal'
  | 'takenTotalDelta'
  | 'takenPhys'
  | 'takenPhysDelta'
  | 'takenMagic'
  | 'takenMagicDelta'
  | 'takenTrue'
  | 'takenTrueDelta'
  | 'kills'
  | 'killsDelta'
  | 'deaths'
  | 'deathsDelta'
  | 'assists'
  | 'assistsDelta'
  | 'totalGames'

const championGlobalTablePending = ref(false)
const championGlobalTableError = ref<string | null>(null)
const championGlobalTableData = ref<{
  matchCount: number
  rows: ChampionGlobalTableRow[]
  error?: string
  message?: string
} | null>(null)
/** Lignes du même endpoint pour la version de référence (progressions), pour Δ sous WR/PR/BR et stats. */
const championGlobalTableRefById = ref(new Map<number, ChampionGlobalTableRow>())

/** Tableau champion : toutes les colonnes visibles (plus de groupes repliables). */
const championGlobalTableMinWidthPx = computed(() => {
  const wChamp = 110
  const wDual = 48
  return wChamp + 4 * wDual + 8 * wDual + 3 * wDual
})

const championGlobalPage = ref(1)

const championGlobalFilteredRows = computed(() => {
  const list = championGlobalTableData.value?.rows ?? []
  const raw = championSearchQuery.value.trim().toLowerCase()
  if (!raw) return list
  return list.filter(row => {
    const name = championName(row.championId)?.toLowerCase() ?? ''
    const idStr = String(row.championId)
    return name.includes(raw) || idStr === raw || idStr.includes(raw)
  })
})

const championGlobalSortColumn = ref<ChampionGlobalSortColumn>('totalGames')
const championGlobalSortDir = ref<'asc' | 'desc'>('desc')

function setChampionGlobalSort(col: ChampionGlobalSortColumn) {
  if (championGlobalSortColumn.value === col) {
    championGlobalSortDir.value = championGlobalSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    championGlobalSortColumn.value = col
    championGlobalSortDir.value = 'desc'
  }
}

/** Vue d'ensemble (cartes) → onglet Champion avec le tri demandé. */
function goToChampionTableWithSort(col: ChampionGlobalSortColumn, dir: 'asc' | 'desc' = 'desc') {
  championGlobalSortColumn.value = col
  championGlobalSortDir.value = dir
  activeTab.value = 'championTable'
  if (import.meta.client) {
    nextTick(() => {
      document
        .querySelector('.champion-global-table')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
}

function goToBansTab() {
  activeTab.value = 'bans'
}

function championGlobalSortIcon(col: ChampionGlobalSortColumn): string {
  if (championGlobalSortColumn.value !== col) return '—'
  return championGlobalSortDir.value === 'desc' ? '↓' : '↑'
}

function formatChampionGlobalNum(n: number): string {
  return Number(n).toLocaleString(locale.value, { maximumFractionDigits: 1 })
}

function championGlobalSideStatDeltaSortValue(
  row: ChampionGlobalTableRow,
  side: 'blue' | 'red',
  stat: 'winrate' | 'pickrate'
): number {
  const refRow = championGlobalTableRefById.value.get(row.championId)
  if (!refRow) return 0
  const cur = side === 'blue' ? row.blue : row.red
  const rf = side === 'blue' ? refRow.blue : refRow.red
  return cur[stat] - rf[stat]
}

function championGlobalNumericDeltaSortValue(
  row: ChampionGlobalTableRow,
  key: ChampionGlobalNumericDeltaKey
): number {
  const refRow = championGlobalTableRefById.value.get(row.championId)
  if (!refRow) return 0
  return row[key] - refRow[key]
}

function championGlobalCompare(
  a: ChampionGlobalTableRow,
  b: ChampionGlobalTableRow,
  col: ChampionGlobalSortColumn,
  dir: 'asc' | 'desc'
): number {
  const m = dir === 'desc' ? -1 : 1
  switch (col) {
    case 'totalGames':
      return (a.totalGames - b.totalGames) * m
    case 'champion': {
      const na = championName(a.championId) || String(a.championId)
      const nb = championName(b.championId) || String(b.championId)
      return na.localeCompare(nb, locale.value, { sensitivity: 'base' }) * m
    }
    case 'blueWinrate':
      return (a.blue.winrate - b.blue.winrate) * m
    case 'bluePickrate':
      return (a.blue.pickrate - b.blue.pickrate) * m
    case 'blueWinrateDelta':
      return (
        (championGlobalSideStatDeltaSortValue(a, 'blue', 'winrate') -
          championGlobalSideStatDeltaSortValue(b, 'blue', 'winrate')) *
        m
      )
    case 'bluePickrateDelta':
      return (
        (championGlobalSideStatDeltaSortValue(a, 'blue', 'pickrate') -
          championGlobalSideStatDeltaSortValue(b, 'blue', 'pickrate')) *
        m
      )
    case 'redWinrate':
      return (a.red.winrate - b.red.winrate) * m
    case 'redPickrate':
      return (a.red.pickrate - b.red.pickrate) * m
    case 'redWinrateDelta':
      return (
        (championGlobalSideStatDeltaSortValue(a, 'red', 'winrate') -
          championGlobalSideStatDeltaSortValue(b, 'red', 'winrate')) *
        m
      )
    case 'redPickrateDelta':
      return (
        (championGlobalSideStatDeltaSortValue(a, 'red', 'pickrate') -
          championGlobalSideStatDeltaSortValue(b, 'red', 'pickrate')) *
        m
      )
    case 'dmgTotal':
      return (a.avgDamageToChamps - b.avgDamageToChamps) * m
    case 'dmgTotalDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgDamageToChamps') -
          championGlobalNumericDeltaSortValue(b, 'avgDamageToChamps')) *
        m
      )
    case 'dmgPhys':
      return (a.avgDamageToChampsPhys - b.avgDamageToChampsPhys) * m
    case 'dmgPhysDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgDamageToChampsPhys') -
          championGlobalNumericDeltaSortValue(b, 'avgDamageToChampsPhys')) *
        m
      )
    case 'dmgMagic':
      return (a.avgDamageToChampsMagic - b.avgDamageToChampsMagic) * m
    case 'dmgMagicDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgDamageToChampsMagic') -
          championGlobalNumericDeltaSortValue(b, 'avgDamageToChampsMagic')) *
        m
      )
    case 'dmgTrue':
      return (a.avgDamageToChampsTrue - b.avgDamageToChampsTrue) * m
    case 'dmgTrueDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgDamageToChampsTrue') -
          championGlobalNumericDeltaSortValue(b, 'avgDamageToChampsTrue')) *
        m
      )
    case 'takenTotal':
      return (a.avgDamageTakenTotal - b.avgDamageTakenTotal) * m
    case 'takenTotalDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgDamageTakenTotal') -
          championGlobalNumericDeltaSortValue(b, 'avgDamageTakenTotal')) *
        m
      )
    case 'takenPhys':
      return (a.avgDamageTakenPhys - b.avgDamageTakenPhys) * m
    case 'takenPhysDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgDamageTakenPhys') -
          championGlobalNumericDeltaSortValue(b, 'avgDamageTakenPhys')) *
        m
      )
    case 'takenMagic':
      return (a.avgDamageTakenMagic - b.avgDamageTakenMagic) * m
    case 'takenMagicDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgDamageTakenMagic') -
          championGlobalNumericDeltaSortValue(b, 'avgDamageTakenMagic')) *
        m
      )
    case 'takenTrue':
      return (a.avgDamageTakenTrue - b.avgDamageTakenTrue) * m
    case 'takenTrueDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgDamageTakenTrue') -
          championGlobalNumericDeltaSortValue(b, 'avgDamageTakenTrue')) *
        m
      )
    case 'kills':
      return (a.avgKills - b.avgKills) * m
    case 'killsDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgKills') -
          championGlobalNumericDeltaSortValue(b, 'avgKills')) *
        m
      )
    case 'deaths':
      return (a.avgDeaths - b.avgDeaths) * m
    case 'deathsDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgDeaths') -
          championGlobalNumericDeltaSortValue(b, 'avgDeaths')) *
        m
      )
    case 'assists':
      return (a.avgAssists - b.avgAssists) * m
    case 'assistsDelta':
      return (
        (championGlobalNumericDeltaSortValue(a, 'avgAssists') -
          championGlobalNumericDeltaSortValue(b, 'avgAssists')) *
        m
      )
    default:
      return 0
  }
}

const championGlobalSortedRows = computed(() => {
  const rows = [...championGlobalFilteredRows.value]
  const col = championGlobalSortColumn.value
  const dir = championGlobalSortDir.value
  rows.sort((a, b) => championGlobalCompare(a, b, col, dir))
  return rows
})

const totalChampionGlobalCount = computed(() => championGlobalSortedRows.value.length)
const totalChampionGlobalPages = computed(() =>
  Math.max(1, Math.ceil(totalChampionGlobalCount.value / championsPageSize.value))
)
const paginatedChampionGlobalRows = computed(() => {
  const list = championGlobalSortedRows.value
  const size = championsPageSize.value
  const page = Math.min(championGlobalPage.value, Math.max(1, Math.ceil(list.length / size) || 1))
  const start = (page - 1) * size
  return list.slice(start, start + size)
})

watch(
  [championGlobalSortColumn, championGlobalSortDir, championsPageSize, championSearchQuery],
  () => {
    championGlobalPage.value = 1
  }
)

const queryString = computed(() => {
  const params = new URLSearchParams()
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  params.set('otp', statsOtpFilter.value)
  return params.toString() ? `?${params.toString()}` : ''
})
async function loadChampions() {
  const t = statsPerfStart('loadChampions')
  championsPending.value = true
  championsError.value = null
  try {
    championsData.value = await statsFetch(apiUrl(`/api/stats/champions${queryString.value}`))
  } catch (e) {
    championsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    championsPending.value = false
    statsPerfEnd('loadChampions', t)
  }
}
function patchFromVersion(version: string | null | undefined): string | null {
  const raw = (version ?? '').trim()
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length < 2) return null
  const major = Number(parts[0])
  const minor = Number(parts[1])
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null
  return `${major}.${minor}`
}
const effectiveTierListPatch = computed(() => {
  const fromFilter = patchFromVersion(statsVersionFilter.value)
  if (fromFilter) return fromFilter
  return patchFromVersion(gameVersion.value)
})

const tierListPatchDeltaRefLabel = computed(() => {
  const ref = patchFromVersion(progressionFromVersion.value)
  const main = effectiveTierListPatch.value
  if (!ref || !main || ref === main) return null
  return ref
})

const championGlobalPatchDeltaRefLabel = computed(() => {
  const ref = patchFromVersion(progressionFromVersion.value)
  const main = patchFromVersion(statsVersionFilter.value || gameVersion.value)
  if (!ref || !main || ref === main) return null
  return ref
})

function championGlobalTableQueryForVersion(versionFull: string | null | undefined): string {
  const params = new URLSearchParams()
  const v = (versionFull ?? '').trim()
  if (v) params.set('version', v)
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  params.set('otp', statsOtpFilter.value)
  const s = params.toString()
  return s ? `?${s}` : ''
}

/** Bans : le backend filtre les lignes (champions joués dans le rôle) mais garde les stats ban par rôle banneur — toujours afficher les colonnes. */
const showBansRoleColumns = computed(() => true)

// Keep the composable return as one object — bundlers drop destructured bindings that are only used via
// provide/inject in child SFCs, which breaks SSR (e.g. bansSortHint).
const bansTab = useStatisticsBansTab({
  championSearchQuery,
  championsPageSize,
  statsVersionFilter,
  progressionFromVersion,
  gameVersion,
  statsFetch,
  apiUrl,
  patchFromVersion,
  championGlobalTableQueryForVersion,
  statsPerfStart,
  statsPerfEnd,
  championName,
})

async function loadChampionGlobalTable() {
  championGlobalTablePending.value = true
  championGlobalTableError.value = null
  championGlobalTableRefById.value = new Map()
  try {
    const data = await statsFetch<{
      matchCount: number
      rows: ChampionGlobalTableRow[]
      error?: string
      message?: string
    }>(apiUrl('/api/stats/champions/global-table' + sidesQueryParams()))
    championGlobalTableData.value = data
    if (data?.error || data?.message) {
      championGlobalTableError.value = [data.error, data.message].filter(Boolean).join(': ')
    } else {
      championGlobalTableError.value = null
    }

    const refPatch = patchFromVersion(progressionFromVersion.value)
    const mainPatch = patchFromVersion(statsVersionFilter.value || gameVersion.value)
    const refVer = progressionFromVersion.value?.trim()
    if (
      refPatch &&
      mainPatch &&
      refPatch !== mainPatch &&
      refVer &&
      !data?.error &&
      data.rows &&
      data.rows.length > 0
    ) {
      try {
        const refData = await statsFetch<{
          matchCount: number
          rows: ChampionGlobalTableRow[]
        }>(apiUrl('/api/stats/champions/global-table' + championGlobalTableQueryForVersion(refVer)))
        if (refData?.rows?.length) {
          const m = new Map<number, ChampionGlobalTableRow>()
          for (const r of refData.rows) m.set(r.championId, r)
          championGlobalTableRefById.value = m
        }
      } catch {
        /* patch de réf. optionnel */
      }
    }
  } catch (e) {
    championGlobalTableError.value = e instanceof Error ? e.message : String(e)
    championGlobalTableData.value = null
  } finally {
    championGlobalTablePending.value = false
  }
}

function championGlobalSideStatDeltaPp(
  championId: number,
  side: 'blue' | 'red',
  stat: 'winrate' | 'pickrate'
): number | undefined {
  if (!championGlobalPatchDeltaRefLabel.value) return undefined
  const refRow = championGlobalTableRefById.value.get(championId)
  const curRow = championGlobalTableData.value?.rows.find(r => r.championId === championId)
  if (!refRow || !curRow) return undefined
  const cur = side === 'blue' ? curRow.blue : curRow.red
  const rf = side === 'blue' ? refRow.blue : refRow.red
  return cur[stat] - rf[stat]
}

function championGlobalNumericDelta(
  championId: number,
  key: ChampionGlobalNumericDeltaKey
): number | undefined {
  if (!championGlobalPatchDeltaRefLabel.value) return undefined
  const refRow = championGlobalTableRefById.value.get(championId)
  const curRow = championGlobalTableData.value?.rows.find(r => r.championId === championId)
  if (!refRow || !curRow) return undefined
  return curRow[key] - refRow[key]
}

function championGlobalNumericDeltaClass(delta: number, invert = false): string {
  const hi = invert ? delta < -0.05 : delta > 0.05
  const lo = invert ? delta > 0.05 : delta < -0.05
  if (hi) return 'text-green-400/90'
  if (lo) return 'text-red-400/90'
  return 'text-text/55'
}

function formatChampionGlobalNumericDelta(d: number): string {
  const sign = d > 0 ? '+' : ''
  return `${sign}${Number(d).toFixed(1)}`
}

function tierListQueryString(patch: string | null): string {
  const params = new URLSearchParams()
  if (patch) params.set('patch', patch)
  if (statsDivisionFilter.value.length === 1) {
    params.set('rankTier', statsDivisionFilter.value[0]!)
  } else {
    params.set('rankTier', 'all')
  }
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  params.set('otp', statsOtpFilter.value)
  const q = params.toString()
  return q ? `?${q}` : ''
}

type TierListFetchPayload = {
  patch: string
  rankTier: string
  rows: Array<{
    rank: number
    championId: number
    tier: string
    mainRole: string
    mainRolePct: number
    winrate: number
    pickrate: number
    banrate: number
    pbi: number
    games: number
  }>
  highEloRows?: Array<{
    rank: number
    championId: number
    tier: string
    mainRole: string
    mainRolePct: number
    winrate: number
    pickrate: number
    banrate: number
    pbi: number
    games: number
  }>
  error?: string
  message?: string
}

async function loadTierList() {
  tierListPending.value = true
  tierListError.value = null
  tierListRefStatsById.value = new Map()
  tierListRefHighEloById.value = new Map()
  tierListRefRows.value = []
  try {
    const patch = effectiveTierListPatch.value
    const data = await statsFetch<TierListFetchPayload>(
      apiUrl(`/api/stats/tier-list${tierListQueryString(patch)}`)
    )
    tierListData.value = data
    if (data?.error || data?.message) {
      tierListError.value = [data.error, data.message].filter(Boolean).join(': ')
    } else {
      tierListError.value = null
    }

    const refPatch = patchFromVersion(progressionFromVersion.value)
    if (
      refPatch &&
      patch &&
      refPatch !== patch &&
      !data?.error &&
      data?.rows &&
      data.rows.length > 0
    ) {
      try {
        const refData = await statsFetch<TierListFetchPayload>(
          apiUrl(`/api/stats/tier-list${tierListQueryString(refPatch)}`)
        )
        if (refData && !refData.error && refData.rows?.length) {
          tierListRefRows.value = refData.rows.map(row => ({
            rank: row.rank,
            championId: row.championId,
            mainRole: row.mainRole,
          }))
          const m = new Map<
            number,
            {
              winrate: number
              pickrate: number
              banrate: number
              games: number
              mainRolePct: number
              pbi: number
            }
          >()
          for (const row of refData.rows) {
            m.set(row.championId, {
              winrate: row.winrate,
              pickrate: row.pickrate,
              banrate: row.banrate,
              games: row.games,
              mainRolePct: row.mainRolePct,
              pbi: row.pbi,
            })
          }
          tierListRefStatsById.value = m
          const hm = new Map<number, { winrate: number; games: number }>()
          if (refData.highEloRows?.length) {
            for (const row of refData.highEloRows) {
              hm.set(row.championId, { winrate: row.winrate, games: row.games })
            }
          }
          tierListRefHighEloById.value = hm
        }
      } catch {
        /* réf. patch optionnelle */
      }
    }
  } catch (err) {
    tierListError.value = err instanceof Error ? err.message : String(err)
    tierListData.value = null
  } finally {
    tierListPending.value = false
  }
}
watch([statsDivisionFilter, statsRoleFilter, statsOtpFilter], () => {
  const tab = activeTab.value
  if (tab === 'tierlist' || tab === 'overview') loadChampions()
  if (tab === 'tierlist') loadTierList()
  if (tab === 'championTable') loadChampionGlobalTable()
})
watch(effectiveTierListPatch, (patch, oldPatch) => {
  if (activeTab.value === 'tierlist' && (patch || oldPatch)) loadTierList()
})

/** Resolve champion by numeric id (API uses Riot champion key). */
function championByKey(championId: number): (typeof championsStore.champions)[0] | null {
  const champ = championsStore.champions.find(c => c.key === String(championId))
  return champ ?? null
}

function championName(championId: number): string | null {
  return championByKey(championId)?.name ?? null
}

function itemName(itemId: number): string | null {
  const item = itemsStore.items.find(i => i.id === String(itemId))
  return item?.name ?? null
}

function itemStatsForItem(itemId: number): string[] {
  const item = itemsStore.items.find(i => i.id === String(itemId))
  return formatItemStatsForDisplay(item?.stats, item)
}

function itemImageName(itemId: number): string | null {
  const item = itemsStore.items.find(i => i.id === String(itemId))
  return item?.image?.full ?? null
}

function itemEconomicForItem(itemId: number): string[] {
  const item = itemsStore.items.find(i => i.id === String(itemId))
  return formatItemEconomicForDisplay(item)
}

watch(activeTab, async tab => {
  if (tab === 'overview') loadOverview()
  if (tab === 'trends') {
    if (!overviewData.value?.matchesByVersion?.length) await loadOverview()
    if (!progressionFromVersion.value && !versionStore.currentVersion)
      await versionStore.loadCurrentVersion()
    loadProgressionsFull()
  }
  if (tab === 'team') loadOverviewSides()
  if (tab === 'tierlist') loadChampions()
  if (tab === 'tierlist') loadTierList()
  if (tab === 'infos') loadInfosPatchDivisionMatrix()
  if (tab === 'infos') loadInfosMeta()
  if (tab === 'infos') loadBalanceFramework()
  if (tab === 'championTable') loadChampionGlobalTable()
  if (tab === 'balance') loadBalanceFramework()
  if (tab === 'bans') bansTab.loadBansTable()
  if (tab === 'items' || tab === 'spells' || tab === 'runes') {
    if (!overviewDetailData.value && !overviewDetailPending.value) loadOverviewDetail()
    if (tab === 'runes' || tab === 'items' || tab === 'spells') loadOverviewDetailBaseline()
  }
  if (tab === 'abandons') loadOverviewAbandons()
})
watch([statsVersionFilter, statsDivisionFilter, statsRoleFilter, statsOtpFilter], () => {
  if (activeTab.value === 'team') {
    loadOverviewSides()
    loadOverviewTeams()
  }
  if (activeTab.value === 'trends') loadProgressionsFull()
  if (activeTab.value === 'championTable') loadChampionGlobalTable()
  if (activeTab.value === 'balance') loadBalanceFramework()
  if (activeTab.value === 'infos') loadBalanceFramework()
  if (activeTab.value === 'bans') bansTab.loadBansTable()
})

watch([activeTab, statsVersionFilter, statsDivisionFilter, statsRoleFilter, statsOtpFilter], () => {
  syncStatisticsStateToQuery()
})
watch(progressionFromVersion, () => {
  if (activeTab.value === 'overview') {
    loadOverviewProgression()
    loadProgressionsFull()
  }
  if (activeTab.value === 'trends') loadProgressionsFull()
  if (activeTab.value === 'tierlist') loadTierList()
  if (activeTab.value === 'championTable') loadChampionGlobalTable()
  if (activeTab.value === 'balance') loadBalanceFramework()
  if (activeTab.value === 'infos') loadBalanceFramework()
  if (activeTab.value === 'team') loadOverviewSides()
  if (activeTab.value === 'runes' || activeTab.value === 'items' || activeTab.value === 'spells') {
    loadOverviewDetailBaseline()
  }
})

onMounted(async () => {
  const versionPromise = versionStore.currentVersion
    ? Promise.resolve()
    : versionStore.loadCurrentVersion()
  const tPage = statsPerfStart('page mount')
  const tVersion = statsPerfStart('version')
  await versionPromise
  statsPerfEnd('version', tVersion)
  await loadKnownVersionsFromGameData()
  await loadOverview()
  await loadInfosMeta()
  await loadInfosPatchDivisionMatrix()
  const defaultsApplied = applyDefaultVersionFiltersFromKnownVersions()
  if (defaultsApplied) onStatsFilterChange()
  statsPerfEnd('page mount', tPage)
  championsStore.loadChampions(riotLocale.value)
  itemsStore.loadItems(riotLocale.value)
  runesStore.loadRunes(riotLocale.value)
  summonerSpellsStore.loadSummonerSpells(riotLocale.value)
  if (activeTab.value === 'team') loadOverviewSides()
  if (activeTab.value === 'tierlist') loadTierList()
  if (activeTab.value === 'championTable') loadChampionGlobalTable()
  if (activeTab.value === 'balance') loadBalanceFramework()
  if (activeTab.value === 'infos') loadBalanceFramework()
  if (activeTab.value === 'bans') await bansTab.loadBansTable()
})

// Références explicites pour le build prod : bindings uniquement consommés via inject (onglets).
const statisticsPageInjectFallback: Record<string, unknown> = {
  CHART_H,
  CHART_PAD,
  CHART_W,
  PAGE_SIZE_OPTIONS,
  PLOT_H,
  TIER_DIVERGING_LEGEND,
  bansExpandByLoss,
  bansExpandByWin,
  cardIsFavorite,
  championByKey,
  championGlobalNumericDelta,
  championGlobalNumericDeltaClass,
  championGlobalPatchDeltaRefLabel,
  championGlobalPickrateClass,
  championGlobalSideStatDeltaPp,
  championGlobalPage,
  championGlobalSortIcon,
  championGlobalSortedRows,
  championGlobalTableError,
  championGlobalTableMinWidthPx,
  championGlobalTablePending,
  paginatedChampionGlobalRows,
  totalChampionGlobalCount,
  totalChampionGlobalPages,
  championName,
  championSearchQuery,
  balanceAverageFilter,
  balanceEliteFilter,
  balanceGlobalFilter,
  balanceSkilledFilter,
  balanceFrameworkData,
  balanceFrameworkError,
  balanceFrameworkPending,
  championsPageSize,
  cycleTierListSort,
  drakeIconSrc,
  drakeSoulGlobal,
  drakeSoulRows,
  drakeTypeRows,
  durationChartTooltip,
  durationWinrateAxisX,
  durationWinrateAxisY,
  durationWinrateChartBuckets,
  durationWinrateChartClosedPath,
  durationWinrateChartLinePath,
  durationWinrateChartPointsList,
  firstPercentBySide,
  firstPercentByTeam,
  formatChampionGlobalNum,
  formatChampionGlobalNumericDelta,
  formatDivisionLabel,
  formatMatchupScore,
  formatTierListPatchDeltaGames,
  formatTierListPatchDeltaPp,
  formatTierListPatchDeltaRank,
  gameVersion,
  getChampionImageUrl,
  getItemImageUrl,
  getRankedEmblemUrl,
  goToBansTab,
  goToChampionTableWithSort,
  goToTierListWithSort,
  hasTierListHighElo,
  infosMatrixCell,
  infosMatrixColumns,
  infosMatrixError,
  infosMetaData,
  infosMetaError,
  infosMetaPending,
  infosMatrixPending,
  infosMatrixRows,
  itemEconomicForItem,
  itemFastSliceConfigs,
  itemImageName,
  itemName,
  itemStatsForItem,
  itemsPage,
  itemsPageSize,
  loadOverview,
  localePath,
  mainRoleIconSrc,
  mainRoleLabel,
  matchOutcomePct,
  objectiveCounts,
  objectiveIconSrc,
  objectiveKeysWithKills,
  objectiveRow,
  objectiveRowSides,
  objectivesPanelTab,
  objectivesSidesPanelTab,
  onDrakeIconError,
  onObjectiveIconError,
  onTierListChartBarEnter,
  onTierListChartBarLeave,
  onTierListChartBarMove,
  openObjectiveKeys,
  openSidesObjectiveKeys,
  overviewAbandonsData,
  overviewAbandonsPending,
  overviewBottomBanrateSince,
  overviewBottomPickrateSince,
  overviewBottomWinrateSince,
  overviewData,
  overviewDetailBaselineData,
  overviewDetailBaselinePending,
  overviewDetailData,
  overviewDetailError,
  overviewDetailPending,
  overviewDurationWinrateData,
  overviewDurationWinratePending,
  overviewEarlySurrenderCount,
  overviewEarlySurrenderPct,
  overviewEffectiveTopBanrateChampions,
  overviewEffectiveTopWinrateChampions,
  overviewError,
  overviewMatchOutcomeTotal,
  overviewPending,
  overviewPlayedCount,
  overviewPlayedPct,
  overviewSidesData,
  overviewSidesPending,
  overviewSurrenderOnlyCount,
  overviewSurrenderOnlyPct,
  overviewTeamsData,
  overviewTopBanrateSince,
  overviewTopPickrateChampionsFiltered,
  overviewTopPickrateSince,
  overviewTopWinrateSince,
  paginatedItems,
  paginatedProgressionsByPickrate,
  paginatedProgressionsChampions,
  paginatedTierList,
  percentForCount,
  percentForCountSides,
  progressionFromVersion,
  progressionFullData,
  progressionFullPending,
  progressionsPage,
  progressionsPageSize,
  retryOverviewDetail,
  scaleMatchupScore,
  setChampionGlobalSort,
  showBansRoleColumns,
  sidesBlueBanRows,
  sidesBlueBestWinrateRows,
  sidesBlueMostPickedRows,
  sidesBluePlayedCount,
  sidesBlueSurrenderOnlyCount,
  sidesBlueTopBanrateSince,
  sidesBlueTopPickrateSince,
  sidesBlueTopWinrateSince,
  sidesDonutBlueDash,
  sidesDonutBluePct,
  sidesDonutCircumference,
  sidesDonutRedDash,
  sidesDonutRedPct,
  sidesDrakeSoulGlobal,
  sidesDrakeSoulRows,
  sidesDrakeTypeRows,
  sidesObjectiveCounts,
  sidesObjectiveKeysWithKills,
  sidesRedBanRows,
  sidesRedBestWinrateRows,
  sidesRedMostPickedRows,
  sidesRedPlayedCount,
  sidesRedSurrenderOnlyCount,
  sidesRedTopBanrateSince,
  sidesRedTopPickrateSince,
  sidesRedTopWinrateSince,
  sidesSurrenderBySide,
  teamPercent,
  tierListChartBarColor,
  tierListChartBarHeightPct,
  tierListChartChampionImage,
  tierListChartHeading,
  tierListChartScoreBottomPct,
  tierListChartTierEnabled,
  tierListChartTooltip,
  tierListChartTooltipRow,
  tierListChartVisibleRows,
  tierListChartYScale,
  tierListChartYTickBottomPct,
  tierListChartZeroBottomPct,
  tierListDisplayRankByChampionId,
  tierListError,
  tierListPage,
  tierListPatchDeltaClass,
  tierListPatchDeltaGamesClass,
  tierListPatchDeltaRankClass,
  tierListPatchDeltaRefLabel,
  tierListPatchRankDelta,
  tierListPending,
  tierListSortColumn,
  tierListSortIcon,
  tierListViewModel,
  tierListWinrateClass,
  toggleFavoriteCard,
  toggleObjective,
  toggleSidesObjective,
  toggleTierListChartTier,
  totalItemsCount,
  totalItemsPages,
  totalProgressionsCount,
  totalProgressionsPages,
  totalTierListCount,
  totalTierListPages,
  versionStore,
}

const __statisticsVm = getCurrentInstance()
if (__statisticsVm?.proxy) {
  const __statisticsPageCtx = new Proxy(
    {},
    {
      get(_target, key: string | symbol) {
        if (key === 't') return t
        if (typeof key !== 'string') {
          return unref((__statisticsVm.proxy as any)[key])
        }
        if (key === 'onBansPageUpdated') {
          return (v: number) => {
            bansTab.bansPage.value = v
          }
        }
        if (key === 'onBansPageSizeUpdated') {
          return (v: number) => {
            championsPageSize.value = v
          }
        }
        if (Object.prototype.hasOwnProperty.call(bansTab, key)) {
          return unref((bansTab as any)[key])
        }
        const inst = __statisticsVm as any
        // <script setup> bindings live on setupState; in SSR, some keys are missing from `proxy`
        // while tab SFCs compile to `unref(p).foo` (single unref — nested refs must be values here).
        const setupState = inst.setupState as Record<string, unknown> | undefined
        if (setupState && key in setupState) {
          return unref(setupState[key] as never)
        }
        if (Object.prototype.hasOwnProperty.call(statisticsPageInjectFallback, key)) {
          return unref((statisticsPageInjectFallback as any)[key])
        }
        return unref((__statisticsVm.proxy as any)[key])
      },
      set(_target, key: string | symbol, value: unknown) {
        ;(__statisticsVm.proxy as any)[key] = value
        return true
      },
    }
  )
  provide('statisticsPageCtx', __statisticsPageCtx)
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.stats-mode-btn {
  border-radius: 0.375rem;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  color: rgb(var(--rgb-text) / 0.8);
}
.stats-mode-btn-active {
  background: rgb(var(--rgb-accent) / 0.2);
  color: var(--color-accent);
}

/* Overview runes (shyv.net style): grid per path, pickrate bar + winrate % */
.overview-runes-fieldset .blocks {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}
.overview-runes-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, auto);
  gap: 0.25rem;
  min-width: 0;
}
.overview-rune-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.25rem;
  padding: 0.35rem;
  border-radius: 0.375rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.2);
  background: rgb(var(--rgb-surface) / 0.5);
  transition: background-color 0.15s;
  cursor: pointer;
  min-width: 0;
}
.overview-rune-cell:hover {
  background: rgb(var(--rgb-primary) / 0.15);
}
.overview-rune-cell.rune.main {
  border-color: rgb(var(--rgb-accent) / 0.4);
}
.overview-rune-img {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
  flex-shrink: 0;
}
.overview-rune-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  width: 100%;
  font-size: 0.65rem;
  line-height: 1.2;
}
.overview-rune-pick {
  color: rgb(var(--rgb-text) / 0.75);
}
.overview-rune-wr {
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.9);
}

.filters-collapse-floating {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.28);
  border-radius: 4px;
  background: #08101f;
  color: var(--color-blue-50);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}
.filters-collapse-floating:hover {
  background: rgb(var(--rgb-background) / 0.3);
  border-color: rgb(var(--rgb-accent) / 0.45);
}
.statistics aside {
  background: #08101f !important;
}
.overview-rune-no-stat {
  color: rgb(var(--rgb-text) / 0.5);
  font-size: 0.7rem;
}

/* Rune set display (shyv-style: stat bar + rune row) */
.rune-set {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.2);
  background: rgb(var(--rgb-surface) / 0.5);
}
.rune-set-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  min-width: 3rem;
  flex-shrink: 0;
}
.rune-set-pr {
  width: 100%;
  max-width: 2.5rem;
  height: 4px;
  border-radius: 2px;
  background: rgb(var(--rgb-primary) / 0.25);
  overflow: hidden;
}
.rune-set-pr::after {
  content: '';
  display: block;
  width: calc(var(--n, 0) * 1%);
  max-width: 100%;
  height: 100%;
  border-radius: 2px;
  background: rgb(var(--rgb-accent));
}
.rune-set-wr {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--rgb-text));
}
.rune-set-runes {
  display: flex;
  align-items: center;
  gap: 2px;
}
.rune-set-tooltip {
  cursor: help;
}
.rune-set-rune {
  display: flex;
  align-items: center;
  justify-content: center;
}
.rune-set-img {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: rgb(var(--rgb-primary) / 0.15);
  background-image: var(--img);
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
}
</style>

<style>
/**
 * Surfaces & fast-stat : hors scoped pour que les composants enfants (objets, tooltips)
 * héritent le même fond #08101f que les cartes « Vue d’ensemble ».
 */
.statistics .statistics-overview-surface {
  background-color: #08101f !important;
}

.statistics .fast-stat-card {
  margin-bottom: 10px;
  width: 313px !important;
  min-width: 313px;
  max-width: 313px;
  height: 325px;
  min-height: 325px;
  margin-left: auto;
  margin-right: auto;
  flex: 0 0 313px;
  background: #08101f !important;
  justify-self: center;
  overflow: visible;
}
.statistics .fast-stat-card.fast-stat-card-objectives {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  height: auto;
  min-height: 0;
  flex: 1 1 100%;
  flex-basis: 100%;
  overflow: visible;
  margin-left: 0 !important;
  margin-right: 0 !important;
  align-self: stretch;
}

/* Onglet Objets : pas de hauteur fixe ; barres comme la vue d’ensemble (48–80px), pas 32–54px. */
.statistics .fast-stat-card.fast-stat-card-items {
  width: min(100%, 340px) !important;
  min-width: 260px !important;
  max-width: 340px !important;
  height: auto !important;
  min-height: 0 !important;
  flex: 0 1 340px !important;
  margin-left: auto;
  margin-right: auto;
  align-self: flex-start;
}
.statistics .fast-stat-card.fast-stat-card-items .fast-stat-bar-container {
  flex-shrink: 1 !important;
  min-width: 48px !important;
  max-width: 80px !important;
}
.statistics .fast-stat-title {
  line-height: 1.4;
  color: rgb(252 211 77) !important;
}
.statistics .fast-stat-table {
  border-collapse: collapse;
}
.statistics .fast-stat-row {
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.1);
}
.statistics .fast-stat-row:last-child {
  border-bottom: none;
}
.statistics .fast-stat-bar-container {
  flex-shrink: 0;
  min-width: 32px !important;
  max-width: 54px !important;
  margin-right: 5px;
}
.statistics .fast-stat-button {
  font-weight: 500;
}

.statistics .fast-stat-tooltip-popover {
  pointer-events: none;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  margin-bottom: 0.35rem;
  min-width: 16rem;
  max-width: min(28rem, calc(100vw - 1.5rem));
  padding: 0.55rem 0.85rem;
  border-radius: 0.375rem;
  border: 1px solid rgb(148 163 184 / 0.45);
  background: rgb(15 23 42);
  color: rgb(241 245 249);
  font-size: 0.75rem;
  line-height: 1.5;
  font-weight: 400;
  text-align: left;
  white-space: normal;
  word-break: break-word;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
}
@media (min-width: 1024px) {
  .statistics .fast-stat-tooltip-popover--start {
    left: 0;
    transform: none;
  }
}
@media (max-width: 1023px) {
  .statistics .fast-stat-tooltip-popover--start {
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>
