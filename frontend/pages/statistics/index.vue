<template>
  <div class="statistics flex min-h-screen flex-col text-text">
    <!-- Onglets : scroll horizontal + snap (mobile) -->
    <div
      class="statistics-tabs-bar flex w-full flex-shrink-0 items-start gap-2 bg-surface/30 px-4 pb-2 pt-4"
    >
      <div class="statistics-tabs-scroll-wrap relative min-w-0 flex-1">
        <div
          ref="tabsNavEl"
          role="tablist"
          :aria-label="t('statisticsPage.title')"
          class="statistics-tabs-nav flex flex-nowrap gap-1 overflow-x-auto border-b border-primary/30 pb-2"
        >
          <button
            v-for="tab in tabs"
            :id="`statistics-tab-${tab.id}`"
            :key="tab.id"
            type="button"
            role="tab"
            :data-tab-id="tab.id"
            :aria-selected="activeTab === tab.id"
            :tabindex="activeTab === tab.id ? 0 : -1"
            :class="[
              'statistics-tab-btn shrink-0 snap-start whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border border-accent/50 bg-accent/20 text-accent'
                : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text',
            ]"
            @click="activeTab = tab.id"
            @keydown="onStatisticsTabsKeydown($event, tab.id)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
      <button
        v-if="showFiltersPanel"
        type="button"
        class="filters-collapse-floating mt-0.5 inline-flex shrink-0 touch-manipulation lg:hidden"
        :aria-label="
          filtersOpen ? t('statisticsPage.closeFilters') : t('statisticsPage.openFilters')
        "
        :aria-expanded="filtersOpen"
        @click="toggleFiltersOpen"
      >
        <svg
          class="h-3 w-3 transition-transform duration-200"
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
    </div>

    <!-- Filtres + contenu -->
    <div class="flex min-h-0 flex-1">
      <button
        v-if="showFiltersPanel"
        type="button"
        class="filters-collapse-floating hidden shrink-0 touch-manipulation lg:sticky lg:top-4 lg:z-20 lg:mr-2 lg:inline-flex lg:self-start"
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
      <!-- Overlay mobile : uniquement quand le sheet est ouvert -->
      <div
        v-if="showFiltersPanel && filtersOpen && filtersSheetMode"
        class="fixed inset-0 z-[10050] bg-black/50 lg:hidden"
        aria-hidden="true"
        role="presentation"
        @click="closeFilters"
      />
      <aside
        v-if="showFiltersPanel && (!filtersSheetMode || filtersOpen)"
        :class="[
          'statistics-filters-panel flex shrink-0 flex-col overflow-hidden bg-surface',
          filtersSheetMode
            ? 'fixed inset-x-0 bottom-0 top-auto z-[10051] max-h-[85vh] w-full rounded-t-2xl shadow-lg lg:hidden'
            : [
                'hidden w-0 opacity-0 transition-[width,opacity] duration-200',
                'lg:sticky lg:top-4 lg:z-0 lg:flex lg:h-auto lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:rounded-lg lg:shadow-none',
                filtersOpen ? 'lg:w-64 lg:opacity-100' : 'lg:w-0 lg:opacity-0',
              ],
        ]"
        :role="filtersSheetMode ? 'dialog' : undefined"
        :aria-modal="filtersSheetMode ? true : undefined"
        :aria-label="t('statisticsPage.filtersTitle')"
      >
        <div
          class="relative z-[1] flex shrink-0 items-center gap-2 border-b border-primary/25 p-2 lg:border-transparent lg:pb-2"
        >
          <button
            type="button"
            class="mx-auto mb-1 flex h-6 w-14 shrink-0 touch-manipulation items-center justify-center rounded-full lg:hidden"
            :aria-label="t('statisticsPage.closeFilters')"
            @click="closeFilters"
          >
            <span class="h-1 w-10 rounded-full bg-primary/40" aria-hidden="true" />
          </button>
          <h2 class="min-w-0 flex-1 truncate text-lg font-semibold text-text-accent">
            {{ t('statisticsPage.filtersTitle') }}
          </h2>
          <button
            type="button"
            class="statistics-filters-reset inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/15 hover:text-blue-200"
            @click="resetStatsFilters"
          >
            <span class="iconify i-mdi:refresh" aria-hidden="true" />
            Reset
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 lg:flex-none">
          <div
            v-if="activeTab !== 'objectives' && activeTab !== 'surrender'"
            :class="[
              championSearchFocused
                ? 'statistics-search-sticky mb-2 max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:-mx-2 max-lg:border-b max-lg:border-primary/25 max-lg:bg-surface/95 max-lg:px-2 max-lg:pb-2 max-lg:pt-1 max-lg:backdrop-blur-sm'
                : 'mb-2',
            ]"
          >
            <label for="champion-search" class="mb-1 block text-sm font-medium text-text">{{
              searchInputLabel
            }}</label>
            <div class="relative">
              <input
                id="champion-search"
                ref="championSearchInputEl"
                v-model.trim="championSearchQuery"
                type="search"
                :placeholder="searchInputPlaceholder"
                class="w-full rounded border border-primary/40 bg-background py-0.5 pl-1.5 pr-7 text-[11px] font-medium text-text placeholder:text-text/50"
                @focus="onChampionSearchFocus"
                @blur="onChampionSearchBlur"
              />
              <button
                v-if="championSearchQuery"
                type="button"
                class="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-text/70 hover:bg-primary/20 hover:text-text"
                :aria-label="t('statisticsPage.searchClear')"
                @mousedown.prevent
                @click="clearChampionSearch"
              >
                ×
              </button>
            </div>
          </div>
          <div
            v-show="!championSearchFocused || !isMobileViewport"
            class="statistics-filters-fields flex flex-col gap-3"
          >
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
            <div v-if="activeTab !== 'balance' && activeTab !== 'surrender'">
              <div class="mb-1 text-sm font-medium text-text">
                {{ t('statisticsPage.overviewMatchesByDivision') }}
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="stats-division-btn rounded p-0.5 transition-colors"
                  :class="
                    statsDivisionFilter.length === 0
                      ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                      : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="t('statisticsPage.allRanks')"
                  @click="selectAllDivisions()"
                >
                  <img
                    src="/data/community-dragon/ranked-emblem/Unranked.png"
                    :alt="t('statisticsPage.allRanks')"
                    class="h-3 w-3 object-contain"
                    :class="
                      statsDivisionFilter.length === 0
                        ? 'saturate-110 opacity-100'
                        : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
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
            <div v-else-if="activeTab === 'balance'">
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
                  v-model="balanceNeedFilter"
                  class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                >
                  <option value="ALL">
                    {{ t('statisticsPage.balanceNeedColumn') }} ·
                    {{ t('statisticsPage.overviewVersionAll') }}
                  </option>
                  <option value="NERF">
                    {{ t('statisticsPage.balanceNeedColumn') }} ·
                    {{ t('statisticsPage.balanceNeedNerf') }}
                  </option>
                  <option value="BUFF">
                    {{ t('statisticsPage.balanceNeedColumn') }} ·
                    {{ t('statisticsPage.balanceNeedBuff') }}
                  </option>
                  <option value="NORMAL">
                    {{ t('statisticsPage.balanceNeedColumn') }} ·
                    {{ t('statisticsPage.balanceNeedNormal') }}
                  </option>
                </select>
                <select
                  v-model="balanceAverageFilter"
                  class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                >
                  <option value="ALL">
                    Average · {{ t('statisticsPage.overviewVersionAll') }}
                  </option>
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
                  <option value="ALL">
                    Skilled · {{ t('statisticsPage.overviewVersionAll') }}
                  </option>
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
            <div v-if="activeTab !== 'objectives' && activeTab !== 'surrender'">
              <div class="mb-1 text-sm font-medium text-text">
                {{ t('statisticsPage.filterRole') }}
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="stats-role-btn rounded p-0.5 transition-colors"
                  :class="!statsRoleFilter ? 'bg-blue-500/20' : 'bg-black/20 hover:bg-white/10'"
                  :title="t('statisticsPage.allRoles')"
                  @click="selectAllRoles()"
                >
                  <img
                    src="/icons/roles/all-role.png"
                    :alt="t('statisticsPage.allRoles')"
                    class="h-3 w-3 object-contain"
                    :class="
                      !statsRoleFilter ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
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
            <div v-show="activeTab === 'bans'">
              <div class="mb-1 text-sm font-medium text-text">Colonnes bans</div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="rounded border px-2 py-1 text-xs font-medium transition-colors"
                  :class="
                    showBansOutcomeColumns
                      ? 'border-blue-400/60 bg-blue-500/20 text-blue-200'
                      : 'border-primary/40 bg-black/20 text-text/80 hover:bg-white/10'
                  "
                  @click="toggleBansOutcomeColumns()"
                >
                  Équipe
                </button>
                <button
                  type="button"
                  class="rounded border px-2 py-1 text-xs font-medium transition-colors"
                  :class="
                    showBansSideColumns
                      ? 'border-blue-400/60 bg-blue-500/20 text-blue-200'
                      : 'border-primary/40 bg-black/20 text-text/80 hover:bg-white/10'
                  "
                  @click="toggleBansSideColumns()"
                >
                  Côté
                </button>
              </div>
            </div>
            <div v-show="activeTab === 'championTable'">
              <div class="mb-1 text-sm font-medium text-text">Colonnes champion</div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="rounded border px-2 py-1 text-xs font-medium transition-colors"
                  :class="
                    showChampionSideColumns
                      ? 'border-blue-400/60 bg-blue-500/20 text-blue-200'
                      : 'border-primary/40 bg-black/20 text-text/80 hover:bg-white/10'
                  "
                  @click="toggleChampionColumnGroup('side')"
                >
                  Côté
                </button>
                <button
                  type="button"
                  class="rounded border px-2 py-1 text-xs font-medium transition-colors"
                  :class="
                    showChampionDealtColumns
                      ? 'border-blue-400/60 bg-blue-500/20 text-blue-200'
                      : 'border-primary/40 bg-black/20 text-text/80 hover:bg-white/10'
                  "
                  @click="toggleChampionColumnGroup('dealt')"
                >
                  Dégâts infligés
                </button>
                <button
                  type="button"
                  class="rounded border px-2 py-1 text-xs font-medium transition-colors"
                  :class="
                    showChampionTakenColumns
                      ? 'border-blue-400/60 bg-blue-500/20 text-blue-200'
                      : 'border-primary/40 bg-black/20 text-text/80 hover:bg-white/10'
                  "
                  @click="toggleChampionColumnGroup('taken')"
                >
                  Dégâts subis
                </button>
              </div>
            </div>
            <div
              v-show="
                activeTab !== 'bans' && activeTab !== 'objectives' && activeTab !== 'surrender'
              "
            >
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
            <div v-if="activeTab === 'spells'">
              <label for="spells-mode-filter" class="mb-1 block text-sm font-medium text-text">
                {{ t('statisticsPage.overviewDetailSummonerSpells') }}
              </label>
              <div
                id="spells-mode-filter"
                class="inline-flex overflow-hidden rounded border border-primary/40 bg-background"
              >
                <button
                  type="button"
                  class="px-2 py-1 text-xs font-medium transition-colors"
                  :class="
                    spellsModeFilter === 'solo'
                      ? 'bg-blue-500/20 text-blue-200'
                      : 'text-text/75 hover:bg-white/10'
                  "
                  @click="spellsModeFilter = 'solo'"
                >
                  {{ t('statisticsPage.spellsModeSolo') }}
                </button>
                <button
                  type="button"
                  class="border-l border-primary/30 px-2 py-1 text-xs font-medium transition-colors"
                  :class="
                    spellsModeFilter === 'pair'
                      ? 'bg-blue-500/20 text-blue-200'
                      : 'text-text/75 hover:bg-white/10'
                  "
                  @click="spellsModeFilter = 'pair'"
                >
                  {{ t('statisticsPage.spellsModePair') }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="shrink-0 border-t border-primary/25 p-3 lg:hidden">
          <button
            type="button"
            class="w-full touch-manipulation rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-text hover:bg-primary/20"
            @click="closeFilters"
          >
            {{ t('statisticsPage.closeFilters') }}
          </button>
        </div>
      </aside>

      <!-- Contenu principal : à côté des filtres, même hauteur -->
      <div
        class="min-w-0 flex-1 p-4 lg:px-3 lg:pb-4 lg:pt-0"
        :class="[showFiltersPanel ? 'max-lg:pb-20' : 'pt-2']"
      >
        <div class="w-full">
          <div v-if="!overviewData" class="mb-6 text-text/80">
            <p>{{ t('statisticsPage.description') }}</p>
          </div>

          <Transition name="statistics-tab" mode="out-in">
            <div :key="activeTab" class="statistics-tab-panel min-h-[12rem]">
              <div v-if="activeTab === 'overview'" class="space-y-6">
                <StatisticsOverviewTab />
              </div>
              <div v-else-if="activeTab === 'runes'" class="space-y-6">
                <StatisticsRunesTab />
              </div>
              <div v-else-if="activeTab === 'team'" class="space-y-6">
                <StatisticsTeamTab />
              </div>
              <div v-else-if="activeTab === 'objectives'" class="space-y-6">
                <StatisticsObjectivesTab />
              </div>
              <div v-else-if="activeTab === 'surrender'" class="space-y-6">
                <StatisticsSurrenderTab />
              </div>
              <div v-else-if="activeTab === 'infos'">
                <StatisticsInfosTab />
              </div>
              <div v-else-if="activeTab === 'bans'">
                <StatisticsBansTab />
              </div>
              <div v-else-if="activeTab === 'championTable'" class="space-y-4">
                <StatisticsChampionTableTab />
              </div>
              <div v-else-if="activeTab === 'balance'" class="space-y-4">
                <StatisticsBalanceTab />
              </div>
              <div v-else-if="activeTab === 'duration'" class="space-y-4">
                <StatisticsDurationTab />
              </div>
              <div v-else-if="activeTab === 'items'" class="space-y-6">
                <StatisticsItemsTab />
              </div>
              <div v-else-if="activeTab === 'spells'" class="space-y-4">
                <StatisticsSpellsTab />
              </div>
              <div v-else-if="activeTab === 'abandons'" class="space-y-4">
                <StatisticsAbandonsTab />
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Toast vue mobile Cards (Top 5) -->
    <div
      v-if="showMobileViewToast && isMobileViewport"
      class="statistics-mobile-view-toast fixed bottom-20 left-1/2 z-[49] flex max-w-[min(100%,22rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-primary/40 bg-surface/95 px-3 py-2 text-xs text-text shadow-lg backdrop-blur-sm"
      role="status"
    >
      <span class="flex-1">{{ t('statisticsPage.mobileViewToast') }}</span>
      <button
        type="button"
        class="shrink-0 font-semibold text-accent underline-offset-2 hover:underline"
        @click="setOverviewFastStatView('table')"
      >
        {{ t('statisticsPage.mobileViewToastChange') }}
      </button>
      <button
        type="button"
        class="shrink-0 text-text/60 hover:text-text"
        :aria-label="t('statisticsPage.closeFilters')"
        @click="dismissMobileViewToast"
      >
        ×
      </button>
    </div>

    <!-- Bouton filtres sticky (mobile, panneau fermé) -->
    <button
      v-if="showFiltersPanel && !filtersOpen"
      type="button"
      class="statistics-filters-fab fixed bottom-4 left-1/2 z-[58] flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-surface/95 px-4 py-2.5 text-sm font-semibold text-text shadow-lg backdrop-blur-sm lg:hidden"
      :aria-label="t('statisticsPage.openFilters')"
      @click="openFilters"
    >
      {{ t('statisticsPage.filtersTitle') }}
      <span
        v-if="activeStatsFiltersCount > 0"
        class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
      >
        {{ activeStatsFiltersCount }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars -- setup bindings are used by tab SFCs via provide('statisticsPageCtx'), not this file's template */
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  getCurrentInstance,
  provide,
  unref,
  isRef,
  defineAsyncComponent,
} from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '~/utils/apiUrl'
import { RANK_TIERS } from '~/utils/rankTiers'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useStatisticsUiStore, type StatisticsMainTab } from '~/stores/StatisticsUiStore'
import { useStatisticsCustomStore } from '~/stores/StatisticsCustomStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { useStatisticsMobileViewport } from '~/composables/useStatisticsMobileViewport'
import { useStatisticsBansTab } from '~/composables/statistics/useStatisticsBansTab'
import { getChampionImageUrl, getItemImageUrl } from '~/utils/imageUrl'
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
const StatisticsOverviewTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsOverviewTab.vue')
)
const StatisticsRunesTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsRunesTab.vue')
)
// const StatisticsTrendsTab = defineAsyncComponent(
//   () => import('~/components/statistics/tabs/StatisticsTrendsTab.vue')
// )
const StatisticsTeamTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsTeamTab.vue')
)
const StatisticsObjectivesTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsObjectivesTab.vue')
)
const StatisticsSurrenderTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsSurrenderTab.vue')
)
const StatisticsInfosTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsInfosTab.vue')
)
const StatisticsBansTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsBansTab.vue')
)
const StatisticsChampionTableTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsChampionTableTab.vue')
)
const StatisticsBalanceTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsBalanceTab.vue')
)
const StatisticsDurationTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsDurationTab.vue')
)
const StatisticsItemsTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsItemsTab.vue')
)
const StatisticsSpellsTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsSpellsTab.vue')
)
const StatisticsAbandonsTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsAbandonsTab.vue')
)

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
const { filtersOpen } = storeToRefs(statisticsUiStore)
const filtersSheetMode = ref(false)
let filtersSheetMq: MediaQueryList | null = null
const onFiltersSheetMqChange = () => {
  filtersSheetMode.value = filtersSheetMq?.matches ?? false
}
const statisticsCustomStore = useStatisticsCustomStore()
const { version: gameVersion } = useGameVersion()
const route = useRoute()
const router = useRouter()

function queryFirst(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

type StatisticsTabSection =
  | 'infos-overview'
  | 'tierlist-champion'
  | 'items'
  | 'runes-summoner'
  | 'objectives'
  | 'team-bans'
  | 'balance-progression'
  | 'synergy-botlane'

const STATISTICS_SECTION_TABS: Record<StatisticsTabSection, StatisticsMainTab[]> = {
  'infos-overview': ['infos', 'overview'],
  'tierlist-champion': ['championTable'],
  items: ['items'],
  'runes-summoner': ['runes', 'spells'],
  objectives: ['objectives'],
  'team-bans': ['team', 'bans'],
  'balance-progression': ['balance', 'trends'],
  'synergy-botlane': ['championTable'],
}

function sectionFromQuery(): StatisticsTabSection | null {
  // Keep all tabs visible regardless of legacy `?section=` deep-links.
  return null
}

function normalizeTabForSection(
  section: StatisticsTabSection | null,
  tab: StatisticsMainTab
): StatisticsMainTab {
  if (!section) return tab
  const allowedTabs = STATISTICS_SECTION_TABS[section]
  if (allowedTabs.includes(tab)) return tab
  return allowedTabs[0] ?? tab
}

function normalizeLegacyTab(tab: string): StatisticsMainTab {
  if (tab === 'tierlist') return 'overview'
  if (tab === 'champions') return 'infos'
  // if (tab === 'progressions') return 'trends'
  if (tab === 'sides') return 'team'
  if (tab === 'detail') return 'runes'
  if (tab === 'duration') return 'team'
  if (tab === 'abandons') return 'team'
  if (tab === 'champion-table' || tab === 'championstable') return 'championTable'
  if (
    tab === 'overview' ||
    tab === 'championTable' ||
    tab === 'balance' ||
    // tab === 'trends' ||
    tab === 'team' ||
    tab === 'objectives' ||
    tab === 'surrender' ||
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
  | 'objectives'
  | 'surrender'
  | 'championTable'
  | 'balance'
  // | 'trends'
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

/** Ordre unique barre d’onglets + navigation clavier (←/→/↑/↓, Home, End). */
const STATISTICS_TAB_NAV_ORDER: readonly StatisticsMainTab[] = [
  'overview',
  'team',
  'objectives',
  'surrender',
  'bans',
  'championTable',
  'balance',
  'runes',
  'spells',
  'items',
  'infos',
]

const allTabs = computed(() => [
  { id: 'overview' as const, label: t('statisticsPage.tabOverview'), widgetId: 'overview' },
  { id: 'team' as const, label: t('statisticsPage.tabTeam'), widgetId: 'team' },
  {
    id: 'objectives' as const,
    label: t('statisticsPage.tabObjectives'),
    widgetId: 'objectives',
  },
  { id: 'surrender' as const, label: t('statisticsPage.tabSurrender'), widgetId: 'surrender' },
  { id: 'bans' as const, label: t('statisticsPage.tabBans'), widgetId: 'bans' },
  {
    id: 'championTable' as const,
    label: t('statisticsPage.tabChampionTable'),
    widgetId: 'championTable',
  },
  { id: 'balance' as const, label: t('statisticsPage.tabBalance'), widgetId: 'balance' },
  // { id: 'trends' as const, label: t('statisticsPage.tabTrends'), widgetId: 'trends' },
  { id: 'runes' as const, label: t('statisticsPage.tabRunes'), widgetId: 'runes' },
  { id: 'spells' as const, label: t('statisticsPage.tabSummonerSpells'), widgetId: 'spells' },
  { id: 'items' as const, label: t('statisticsPage.tabItems'), widgetId: 'items' },
  { id: 'infos' as const, label: t('statisticsPage.tabInfos'), widgetId: 'infos' },
])
const activeSection = computed<StatisticsTabSection | null>(() => sectionFromQuery())
const tabs = computed(() => {
  const section = activeSection.value
  const byId = new Map(allTabs.value.map(tab => [tab.id, tab]))
  const allowedIds = section
    ? new Set(STATISTICS_SECTION_TABS[section])
    : new Set(STATISTICS_TAB_NAV_ORDER)
  return STATISTICS_TAB_NAV_ORDER.map(id => byId.get(id)).filter(
    (tab): tab is (typeof allTabs.value)[number] => tab != null && allowedIds.has(tab.id)
  )
})
const tabsNavEl = ref<HTMLElement | null>(null)
type VisibleStatisticsTabId = (typeof allTabs.value)[number]['id']

function scrollActiveTabIntoView(behavior: ScrollBehavior = 'smooth'): void {
  if (!import.meta.client || !tabsNavEl.value) return
  const el = tabsNavEl.value.querySelector<HTMLButtonElement>(
    `button[data-tab-id="${activeTab.value}"]`
  )
  el?.scrollIntoView({ inline: 'start', block: 'nearest', behavior })
}

function focusStatisticsTabButton(nextId: VisibleStatisticsTabId): void {
  activeTab.value = nextId
  if (!import.meta.client) return
  requestAnimationFrame(() => {
    const el = tabsNavEl.value?.querySelector<HTMLButtonElement>(`button[data-tab-id="${nextId}"]`)
    el?.focus()
    scrollActiveTabIntoView()
  })
}

function orderedVisibleTabIds(): VisibleStatisticsTabId[] {
  return tabs.value.map(t => t.id) as VisibleStatisticsTabId[]
}

function focusPrevNextTab(currentTabId: VisibleStatisticsTabId, direction: -1 | 1): void {
  const ids = orderedVisibleTabIds()
  if (ids.length === 0) return
  let idx = ids.indexOf(currentTabId)
  if (idx < 0) idx = ids.indexOf(activeTab.value as VisibleStatisticsTabId)
  if (idx < 0) idx = 0
  const nextIdx = (idx + direction + ids.length) % ids.length
  const nextId = ids[nextIdx]
  if (!nextId) return
  focusStatisticsTabButton(nextId)
}

function focusStatisticsTabEdge(which: 'first' | 'last'): void {
  const ids = orderedVisibleTabIds()
  const nextId = which === 'first' ? ids[0] : ids[ids.length - 1]
  if (!nextId) return
  focusStatisticsTabButton(nextId)
}

function onStatisticsTabsKeydown(e: KeyboardEvent, tabId: VisibleStatisticsTabId): void {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    focusPrevNextTab(tabId, -1)
    return
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    focusPrevNextTab(tabId, 1)
    return
  }
  if (e.key === 'Home') {
    e.preventDefault()
    focusStatisticsTabEdge('first')
    return
  }
  if (e.key === 'End') {
    e.preventDefault()
    focusStatisticsTabEdge('last')
  }
}

function cardIsFavorite(cardId: string): boolean {
  return statisticsCustomStore.isFavorite(cardId)
}

function toggleFavoriteCard(cardId: string, title: string): void {
  statisticsCustomStore.toggleFavorite(cardId, title)
}

const {
  isMobileViewport,
  overviewFastStatView,
  showMobileViewToast,
  setOverviewFastStatView,
  dismissMobileViewToast,
} = useStatisticsMobileViewport()

const championSearchQuery = ref('')
const championSearchFocused = ref(false)
const championSearchInputEl = ref<HTMLInputElement | null>(null)
let championSearchBlurTimer: ReturnType<typeof setTimeout> | null = null

function onChampionSearchFocus(): void {
  if (championSearchBlurTimer) {
    clearTimeout(championSearchBlurTimer)
    championSearchBlurTimer = null
  }
  championSearchFocused.value = true
}

function onChampionSearchBlur(): void {
  championSearchBlurTimer = setTimeout(() => {
    championSearchFocused.value = false
  }, 150)
}

function clearChampionSearch(): void {
  championSearchQuery.value = ''
  championSearchInputEl.value?.focus()
}
const spellsModeFilter = ref<'solo' | 'pair'>('solo')
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
const championsPageSizeModel = computed({
  get: () => championsPageSize.value,
  set: (value: number) => {
    const n = Number(value)
    const next = Number.isFinite(n) && n > 0 ? Math.floor(n) : 20
    championsPageSize.value = PAGE_SIZE_OPTIONS.includes(next) ? next : 20
  },
})
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
const progressionsPageSizeModel = computed({
  get: () => progressionsPageSize.value,
  set: (value: number) => {
    const n = Number(value)
    const next = Number.isFinite(n) && n > 0 ? Math.floor(n) : 20
    progressionsPageSize.value = PAGE_SIZE_OPTIONS.includes(next) ? next : 20
  },
})
const filteredProgressionsChampions = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  const q = championSearchQuery.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(row => {
    const name = championName(row.championId)?.toLowerCase() ?? ''
    return name.includes(q) || String(row.championId).includes(q)
  })
})
const filteredProgressionsByPickrate = computed(() => {
  const list = progressionFullByPickrate.value
  const q = championSearchQuery.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(row => {
    const name = championName(row.championId)?.toLowerCase() ?? ''
    return name.includes(q) || String(row.championId).includes(q)
  })
})
const totalProgressionsCount = computed(() => filteredProgressionsChampions.value.length)
const totalProgressionsPages = computed(() =>
  Math.max(1, Math.ceil(totalProgressionsCount.value / progressionsPageSize.value))
)
const paginatedProgressionsChampions = computed(() => {
  const list = filteredProgressionsChampions.value
  const size = progressionsPageSize.value
  const page = Math.min(progressionsPage.value, totalProgressionsPages.value)
  const start = (page - 1) * size
  return list.slice(start, start + size)
})
const paginatedProgressionsByPickrate = computed(() => {
  const list = filteredProgressionsByPickrate.value
  const size = progressionsPageSize.value
  const page = Math.min(progressionsPage.value, totalProgressionsPages.value)
  const start = (page - 1) * size
  return list.slice(start, start + size)
})
watch([championSearchQuery, progressionsPageSize], () => {
  progressionsPage.value = 1
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

/** Pickrate % (0–100) : vert / neutre / rouge pour lisibilité (tableau champion global). */
function championGlobalPickrateClass(pct: number): string {
  if (!Number.isFinite(pct)) return 'text-text/80'
  if (pct >= 15) return 'font-medium text-emerald-400/90'
  if (pct >= 6) return 'text-sky-200/85'
  if (pct >= 2) return 'text-text/85'
  return 'text-rose-400/90'
}

function tierListWinrateClass(pct: number): string {
  if (!Number.isFinite(pct)) return 'text-text/80'
  if (pct >= 52.5) return 'font-medium text-green-400'
  if (pct >= 51) return 'text-green-500/95'
  if (pct >= 50) return 'text-sky-200/85'
  return 'text-red-400/90'
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

/** Depuis l’aperçu : page tier list avec tri initial. */
function goToTierListWithSort(sort: 'winrate' | 'pickrate') {
  navigateTo({
    path: localePath('/statistics/tier-list'),
    query: { ...route.query, sort },
  }).catch(() => undefined)
}

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
const balanceNeedFilter = ref<'ALL' | 'NERF' | 'BUFF' | 'NORMAL'>('ALL')
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
  const section = sectionFromQuery()
  const tabCandidate = tabRaw ? normalizeLegacyTab(tabRaw) : 'overview'
  activeTab.value = normalizeTabForSection(section, tabCandidate)
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

  if (activeTab.value !== 'bans') {
    if (statsOtpFilter.value !== 'non') nextQuery.otp = statsOtpFilter.value
    else delete nextQuery.otp
  } else {
    delete nextQuery.otp
  }

  if (statsDivisionFilter.value.length > 0) nextQuery.rankTier = [...statsDivisionFilter.value]
  else delete nextQuery.rankTier

  isSyncingQueryState.value = true
  router.replace({ query: nextQuery }).finally(() => {
    isSyncingQueryState.value = false
  })
}
const showFiltersPanel = computed(() => activeTab.value !== 'infos')

const activeStatsFiltersCount = computed(() => {
  let count = 0
  if (statsVersionFilter.value) count++
  if (statsDivisionFilter.value.length > 0) count++
  if (statsRoleFilter.value) count++
  if (statsOtpFilter.value !== 'non') count++
  if (progressionFromVersionOverride.value) count++
  if (championSearchQuery.value.trim()) count++
  if (activeTab.value === 'balance') {
    if (balanceGlobalFilter.value !== 'ALL') count++
    if (balanceNeedFilter.value !== 'ALL') count++
    if (balanceAverageFilter.value !== 'ALL') count++
    if (balanceSkilledFilter.value !== 'ALL') count++
    if (balanceEliteFilter.value !== 'ALL') count++
  }
  if (activeTab.value === 'spells' && spellsModeFilter.value !== 'solo') count++
  return count
})

function closeFilters() {
  statisticsUiStore.setFiltersOpen(false)
  if (championSearchBlurTimer) {
    clearTimeout(championSearchBlurTimer)
    championSearchBlurTimer = null
  }
  championSearchFocused.value = false
  championSearchInputEl.value?.blur()
}
function openFilters() {
  statisticsUiStore.setFiltersOpen(true)
}
function toggleFiltersOpen() {
  if (filtersOpen.value) closeFilters()
  else openFilters()
}

function onFiltersEscapeKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !filtersOpen.value || !showFiltersPanel.value) return
  if (!import.meta.client || !filtersSheetMode.value) return
  closeFilters()
}

watch([filtersOpen, filtersSheetMode, showFiltersPanel], () => {
  if (!import.meta.client) return
  const lock = filtersSheetMode.value && filtersOpen.value && showFiltersPanel.value
  document.body.style.overflow = lock ? 'hidden' : ''
})

const statsKnownVersions = ref<Array<{ version: string; matchCount: number }>>([])

watch(activeTab, value => {
  if (!import.meta.client) return
  statisticsUiStore.setActiveTab(normalizeLegacyTab(value))
  nextTick(() => scrollActiveTabIntoView())
})

watch(tabs, () => {
  if (!import.meta.client) return
  nextTick(() => scrollActiveTabIntoView('auto'))
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
/** Uniquement les patchs avec des matchs en base (`match_outcome_stats`). */
function setVersionsWithMatches(
  rows: Array<{ version: string; matchCount: number }> | null | undefined
): void {
  if (!rows?.length) return
  statsKnownVersions.value = rows
    .filter(r => r?.version && Number(r.matchCount) > 0)
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
}

/** Met à jour les compteurs sans retirer les autres patchs (l’overview filtré ne renvoie qu’une version). */
function mergeKnownVersions(
  rows: Array<{ version: string; matchCount: number }> | null | undefined
): void {
  if (!rows?.length) return
  const byVersion = new Map(statsKnownVersions.value.map(v => [v.version, { ...v }] as const))
  for (const row of rows) {
    if (!row?.version || Number(row.matchCount) <= 0) continue
    byVersion.set(row.version, {
      version: row.version,
      matchCount: Number(row.matchCount),
    })
  }
  statsKnownVersions.value = [...byVersion.values()].sort((a, b) =>
    compareVersionsDesc(a.version, b.version)
  )
}

async function loadVersionsWithMatches(): Promise<void> {
  const params = new URLSearchParams()
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  const q = params.toString()
  try {
    const data = await statsFetch<{
      versions?: Array<{ version: string; matchCount: number }>
    }>(apiUrl('/api/stats/versions-with-matches' + (q ? `?${q}` : '')))
    if (data?.versions?.length) setVersionsWithMatches(data.versions)
    ensureStatsVersionFilterHasData()
  } catch {
    setVersionsWithMatches(overviewData.value?.matchesByVersion)
    ensureStatsVersionFilterHasData()
  }
}

const statsVersionOptions = computed(() => {
  const fromKnown = statsKnownVersions.value.filter(v => Number(v.matchCount) > 0)
  if (fromKnown.length > 0) return fromKnown
  const fallback = (overviewData.value?.matchesByVersion ?? []).filter(
    v => Number(v.matchCount) > 0
  )
  return [...fallback].sort((a, b) => compareVersionsDesc(a.version, b.version))
})

// Init client après statsVersionOptions (applyStatisticsStateFromQuery → syncProgressionDelta).
if (import.meta.client) {
  statisticsUiStore.init()
  statisticsCustomStore.init()
  applyStatisticsStateFromQuery()
}

watch(
  () => queryFirst(route.query.tab as string | string[] | null | undefined),
  tabQ => {
    if (!import.meta.client) return
    const qTab = String(tabQ || '').toLowerCase()
    if (['vs-botlane', 'vsbotlane', 'botlane-vs', 'vsbotlane'].includes(qTab)) {
      const q = { ...route.query } as Record<string, string | string[]>
      delete q.tab
      q.view = 'botlane-matchups'
      navigateTo({ path: localePath('/statistics/tier-list'), query: q }, { replace: true }).catch(
        () => undefined
      )
      return
    }
    if (tabQ !== 'tierlist') return
    const nextQ = { ...route.query } as Record<string, string | string[]>
    delete nextQ.tab
    navigateTo(
      { path: localePath('/statistics/tier-list'), query: nextQ },
      { replace: true }
    ).catch(() => undefined)
  },
  { immediate: true }
)

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
  playersWithIngestMatches: number
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
const showBansOutcomeColumns = ref(true)
const showBansSideColumns = ref(true)
const showChampionSideColumns = ref(true)
const showChampionDealtColumns = ref(true)
const showChampionTakenColumns = ref(true)
const roleToBansColumnKey = Object.freeze({
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'middle',
  BOTTOM: 'bottom',
  SUPPORT: 'support',
} as const)

function toggleBansOutcomeColumns() {
  showBansOutcomeColumns.value = !showBansOutcomeColumns.value
}

function toggleBansSideColumns() {
  showBansSideColumns.value = !showBansSideColumns.value
}

function toggleChampionColumnGroup(group: 'side' | 'dealt' | 'taken') {
  const activeCount =
    Number(showChampionSideColumns.value) +
    Number(showChampionDealtColumns.value) +
    Number(showChampionTakenColumns.value)
  if (group === 'side') {
    if (showChampionSideColumns.value && activeCount <= 1) return
    showChampionSideColumns.value = !showChampionSideColumns.value
    return
  }
  if (group === 'dealt') {
    if (showChampionDealtColumns.value && activeCount <= 1) return
    showChampionDealtColumns.value = !showChampionDealtColumns.value
    return
  }
  if (showChampionTakenColumns.value && activeCount <= 1) return
  showChampionTakenColumns.value = !showChampionTakenColumns.value
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
  if (activeTab.value === 'overview') {
    loadOverview()
    loadChampions()
    loadObjectivesBaseline()
  }
  if (activeTab.value === 'infos') loadOverview()
  if (activeTab.value === 'infos') loadInfosMeta()
  if (activeTab.value === 'infos') loadBalanceFramework()
  if (activeTab.value === 'bans') {
    bansTab.loadBansTable()
    loadOverviewTeams()
    loadObjectivesBaseline()
  }
  if (activeTab.value === 'balance') loadBalanceFramework()
  if (activeTab.value === 'sides') loadOverviewSides()
  if (activeTab.value === 'champions') loadChampions()
  if (activeTab.value === 'championTable') loadChampionGlobalTable()
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
  if (activeTab.value === 'objectives') {
    loadOverview()
    loadOverviewSides()
  }
  if (activeTab.value === 'surrender') loadSurrenderMatrix()
  // if (activeTab.value === 'trends') loadProgressionsFull()
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
  balanceNeedFilter.value = 'ALL'
  balanceAverageFilter.value = 'ALL'
  balanceSkilledFilter.value = 'ALL'
  balanceEliteFilter.value = 'ALL'
  progressionFromVersionOverride.value = ''
  championSearchQuery.value = ''
  showBansOutcomeColumns.value = true
  showBansSideColumns.value = true
  showChampionSideColumns.value = true
  showChampionDealtColumns.value = true
  showChampionTakenColumns.value = true
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
    ensureStatsVersionFilterHasData()
    const fetchOnce = () => {
      const params = new URLSearchParams()
      if (statsVersionFilter.value) params.set('version', statsVersionFilter.value)
      if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
      if (statsOtpFilter.value && statsOtpFilter.value !== 'non')
        params.set('otp', statsOtpFilter.value)
      const q = params.toString()
      return statsFetch<typeof balanceFrameworkData.value>(
        apiUrl('/api/stats/balance-framework' + (q ? `?${q}` : '')),
        { timeout: OVERVIEW_DETAIL_TIMEOUT_MS }
      )
    }

    let data = await fetchOnce()
    const fallbackVer = statsVersionOptions.value.find(v => Number(v.matchCount ?? 0) > 0)?.version
    if (
      (!data?.rows?.length || data.rows.length === 0) &&
      fallbackVer &&
      statsVersionFilter.value !== fallbackVer
    ) {
      statsVersionFilter.value = fallbackVer
      data = await fetchOnce()
    }
    balanceFrameworkData.value = data
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

/** Évite deux GET identiques si plusieurs watchers appellent la même charge en parallèle. */
const statsInflightByKey = new Map<string, Promise<unknown>>()
function dedupedStatsFetch<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = statsInflightByKey.get(key)
  if (hit) return hit as Promise<T>
  const p = run().finally(() => {
    if (statsInflightByKey.get(key) === p) statsInflightByKey.delete(key)
  }) as Promise<T>
  statsInflightByKey.set(key, p)
  return p
}

function appendProgressionSinceVersion(params: URLSearchParams): void {
  const since = statsVersionFilter.value.trim()
  const oldest = progressionFromVersion.value?.trim() ?? ''
  if (!oldest) return

  const sincePatch = patchFromVersion(since)
  const oldestPatch = patchFromVersion(oldest)

  if (since && sincePatch && oldestPatch && sincePatch !== oldestPatch) {
    params.set('sinceVersion', since)
    return
  }

  // Filtre patch = référence « depuis » : borner au patch le plus récent (strictement après la ref)
  if (since && sincePatch && oldestPatch && sincePatch === oldestPatch) {
    const newer = statsVersionOptions.value
      .find(v => {
        if (Number(v.matchCount ?? 0) <= 0) return false
        const p = patchFromVersion(v.version)
        return p != null && comparePatchMajorMinor(p, oldestPatch) > 0
      })
      ?.version?.trim()
    if (newer) params.set('sinceVersion', newer)
    return
  }

  // Sans filtre patch : borner « since » au patch le plus récent pour une comparaison ref vs patch suivant.
  if (!since) {
    const newest = statsVersionOptions.value
      .find(v => Number(v.matchCount ?? 0) > 0)
      ?.version?.trim()
    if (newest && oldestPatch) {
      const newestPatch = patchFromVersion(newest)
      if (newestPatch && comparePatchMajorMinor(newestPatch, oldestPatch) > 0) {
        params.set('sinceVersion', newest)
      }
    }
  }
}

function progressionRequestKey(prefix: string, oldest: string): string {
  const div = (overviewDivisionFilter.value ?? []).join(',')
  const role = statsRoleFilter.value || ''
  const since = statsVersionFilter.value.trim()
  return `${prefix}:${oldest}|${since}|${div}|${role}`
}

function runInBackground<T>(promise: Promise<T>): void {
  promise.catch(() => undefined)
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
    // Keep initial overview render fast: trigger secondary datasets in background.
    runInBackground(loadOverviewProgression())
    runInBackground(loadProgressionsFull())
    runInBackground(loadOverviewAbandons())
    runInBackground(loadOverviewTeams())
    runInBackground(loadObjectivesBaseline())
    runInBackground(loadOverviewDurationWinrate())
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
      apiUrl('/api/stats/infos/meta' + overviewQueryParams())
    )
  } catch (err) {
    infosMetaData.value = null
    infosMetaError.value = err instanceof Error ? err.message : String(err)
  } finally {
    infosMetaPending.value = false
  }
}

async function loadOverviewVersionsCatalog() {
  await loadVersionsWithMatches()
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

const surrenderMatrixData = ref<{
  version: string | null
  baselineVersion: string | null
  rows: Array<{
    rankTier: string
    team: 'ALL' | 100 | 200
    matchCount: number
    surrenderCount: number
    earlySurrenderCount: number
    surrenderRate: number
    earlySurrenderRate: number
    surrenderDelta: number | null
    earlySurrenderDelta: number | null
  }>
} | null>(null)
const surrenderMatrixPending = ref(false)
const surrenderMatrixBaselineLabel = computed(
  () => surrenderMatrixData.value?.baselineVersion ?? t('statisticsPage.overviewVersionAll')
)
const surrenderMatrixRows = computed(() => surrenderMatrixData.value?.rows ?? [])
function surrenderMatrixQueryParams(): string {
  const params = new URLSearchParams()
  const cur = statsVersionFilter.value?.trim() ?? ''
  const baseline = progressionFromVersion.value?.trim() ?? ''
  if (cur) params.set('version', cur)
  if (
    baseline &&
    normalizeVersionToPrefix(baseline) !== normalizeVersionToPrefix(cur || baseline)
  ) {
    params.set('fromVersion', baseline)
  }
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  const s = params.toString()
  return s ? `?${s}` : ''
}
async function loadSurrenderMatrix() {
  const tStart = statsPerfStart('loadSurrenderMatrix')
  surrenderMatrixPending.value = true
  try {
    surrenderMatrixData.value = await statsFetch(
      apiUrl('/api/stats/surrender-matrix' + surrenderMatrixQueryParams())
    )
  } catch {
    surrenderMatrixData.value = null
  } finally {
    surrenderMatrixPending.value = false
    statsPerfEnd('loadSurrenderMatrix', tStart)
  }
}
/** Total pour le donut : abandons si dispo, sinon repli sur l’overview (évite donut vide si /overview-abandons échoue ou renvoie 0 alors qu’il y a des matchs). */
const overviewMatchOutcomeTotal = computed(() => {
  const ab = overviewAbandonsData.value
  if (ab != null) {
    const t = Number(ab.totalMatches ?? 0)
    if (t > 0) return t
  }
  return Number(overviewData.value?.totalMatches ?? 0)
})
const overviewEarlySurrenderCount = computed(() => {
  const ab = overviewAbandonsData.value
  if (!ab) return 0
  const t = Number(ab.totalMatches ?? 0)
  if (t <= 0) return 0
  return Math.max(0, Number(ab.earlySurrenderCount ?? 0))
})
const overviewSurrenderOnlyCount = computed(() => {
  const ab = overviewAbandonsData.value
  if (!ab) return 0
  const t = Number(ab.totalMatches ?? 0)
  if (t <= 0) return 0
  const surrender = Math.max(0, Number(ab.surrenderCount ?? 0))
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
  const key = progressionRequestKey('overview-progression', oldest)
  await dedupedStatsFetch(key, async () => {
    const t = statsPerfStart('loadOverviewProgression')
    const params = new URLSearchParams()
    params.set('version', oldest)
    appendProgressionSinceVersion(params)
    if (overviewDivisionFilter.value) {
      for (const tier of overviewDivisionFilter.value) params.append('rankTier', tier)
    }
    if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
    const q = params.toString() ? '?' + params.toString() : ''
    try {
      overviewProgressionData.value = await statsFetch(
        apiUrl('/api/stats/overview-progression' + q)
      )
    } catch {
      overviewProgressionData.value = null
    } finally {
      statsPerfEnd('loadOverviewProgression', t)
    }
  })
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
  const prevWithData = list.slice(idx + 1).find(v => Number(v.matchCount ?? 0) > 0)?.version
  const prev = prevWithData ?? list[idx + 1]?.version ?? ''
  if (before === prev) return false
  progressionFromVersionOverride.value = prev
  return true
}

/** Version for "since" cards: user override, else latest-1, else latest/current. */
const progressionFromVersion = computed(() => {
  if (progressionFromVersionOverride.value) return progressionFromVersionOverride.value
  const versions = statsVersionOptions.value
  if (statsVersionFilter.value) {
    const idx = versions.findIndex(v => v.version === statsVersionFilter.value)
    if (idx >= 0) {
      const prevWithData = versions.slice(idx + 1).find(v => Number(v.matchCount ?? 0) > 0)?.version
      if (prevWithData) return prevWithData
      const nextVersion = versions[idx + 1]?.version
      if (nextVersion) return nextVersion
    }
  }
  const fallbackWithData = versions.find(v => Number(v.matchCount ?? 0) > 0)?.version
  if (fallbackWithData) return fallbackWithData
  if (versions.length >= 2) return versions[1]?.version ?? null
  if (versions.length === 1) return versions[0]?.version ?? null
  return normalizeVersionToPrefix(versionStore.currentVersion)
})
const progressionSelectableVersions = computed(() => {
  const versions = statsVersionOptions.value.filter(v => Number(v.matchCount) > 0)
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

/** Garde un patch présent dans `statsVersionOptions` avec des matchs (évite balance/tierlist vides sur ?version= obsolète). */
function ensureStatsVersionFilterHasData(): boolean {
  const versions = statsVersionOptions.value
  if (!versions.length) return false
  const current = statsVersionFilter.value.trim()
  if (current && versions.some(v => v.version === current && Number(v.matchCount ?? 0) > 0)) {
    return false
  }
  const withData = versions.find(v => Number(v.matchCount ?? 0) > 0)
  statsVersionFilter.value = withData?.version ?? versions[0]?.version ?? ''
  return true
}

function applyDefaultVersionFiltersFromKnownVersions(): boolean {
  const versions = statsVersionOptions.value
  if (!versions.length) return false
  let changed = false
  if (!statsVersionFilter.value) {
    const withData = versions.find(v => Number(v.matchCount ?? 0) > 0)
    statsVersionFilter.value = withData?.version ?? versions[0]?.version ?? ''
    changed = true
  } else {
    changed = ensureStatsVersionFilterHasData() || changed
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
  const key = progressionRequestKey('overview-progression-full', oldest)
  await dedupedStatsFetch(key, async () => {
    const t = statsPerfStart('loadProgressionsFull')
    progressionFullPending.value = true
    const params = new URLSearchParams()
    params.set('version', oldest)
    appendProgressionSinceVersion(params)
    if (overviewDivisionFilter.value) {
      for (const tier of overviewDivisionFilter.value) params.append('rankTier', tier)
    }
    if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
    const q = params.toString() ? '?' + params.toString() : ''
    try {
      progressionFullData.value = await statsFetch(
        apiUrl('/api/stats/overview-progression-full' + q)
      )
    } catch {
      progressionFullData.value = null
    } finally {
      progressionFullPending.value = false
      statsPerfEnd('loadProgressionsFull', t)
    }
  })
}
/** Même liste que progressionFullData.champions mais triée par delta pickrate (pour table popularité). */
const progressionFullByPickrate = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  return [...list].sort((a, b) => b.deltaPick - a.deltaPick)
})
const PROGRESSION_DELTA_EPS = 0.01

function hasMeaningfulProgressionDelta(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) >= PROGRESSION_DELTA_EPS
}

const progressionSinceSlices = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  const topWinrate = [...list]
    .filter(c => hasMeaningfulProgressionDelta(c.deltaWr))
    .sort((a, b) => b.deltaWr - a.deltaWr)
    .slice(0, 5)
  const topPickrate = [...list]
    .filter(c => hasMeaningfulProgressionDelta(c.deltaPick))
    .sort((a, b) => b.deltaPick - a.deltaPick)
    .slice(0, 5)
  const topBanrate = [...list]
    .filter(c => hasMeaningfulProgressionDelta(c.deltaBan))
    .sort((a, b) => b.deltaBan - a.deltaBan)
    .slice(0, 5)
  const bottomWinrate = [...list]
    .filter(c => hasMeaningfulProgressionDelta(c.deltaWr))
    .sort((a, b) => a.deltaWr - b.deltaWr)
    .slice(0, 5)
  const bottomPickrate = [...list]
    .filter(c => hasMeaningfulProgressionDelta(c.deltaPick))
    .sort((a, b) => a.deltaPick - b.deltaPick)
    .slice(0, 5)
  const bottomBanrate = [...list]
    .filter(c => hasMeaningfulProgressionDelta(c.deltaBan))
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
  const cmp = overviewDetailComparisonVersion.value?.trim() ?? ''
  if (!cmp) {
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
  objectiveFirstWinrateGlobal?: {
    firstBlood: number | null
    baron: number | null
    dragon: number | null
    tower: number | null
    inhibitor: number | null
    riftHerald: number | null
    horde: number | null
  }
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
      elder: {
        byWin: number
        byLoss: number
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      earth: {
        byWin: number
        byLoss: number
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      water: {
        byWin: number
        byLoss: number
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      wind: {
        byWin: number
        byLoss: number
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      fire: {
        byWin: number
        byLoss: number
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      hextec: {
        byWin: number
        byLoss: number
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      chem: {
        byWin: number
        byLoss: number
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
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
const overviewTeamsBaselineData = ref<typeof overviewTeamsData.value>(null)
const overviewTeamsPending = ref(false)
const bansExpandByWin = ref(false)
const bansExpandByLoss = ref(false)
const objectivesPanelTab = ref<'objectives' | 'drakeTypes' | 'drakeSouls'>('objectives')
function setObjectivesPanelTab(value: 'objectives' | 'drakeTypes' | 'drakeSouls') {
  objectivesPanelTab.value = value
}
function teamPercent(value: number, matchCount: number): string {
  if (!matchCount) return '—'
  return Number((value / matchCount) * 100).toFixed(2) + '%'
}

// Overview by side (Blue / Red)
const overviewSidesData = ref<{
  matchCount: number
  objectiveFirstWinrateBySide?: {
    firstBlood: { blue: number | null; red: number | null }
    baron: { blue: number | null; red: number | null }
    dragon: { blue: number | null; red: number | null }
    tower: { blue: number | null; red: number | null }
    inhibitor: { blue: number | null; red: number | null }
    riftHerald: { blue: number | null; red: number | null }
    horde: { blue: number | null; red: number | null }
  }
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
    firstBlood: {
      firstByBlue: number
      firstByRed: number
      distributionByBlue?: Record<string, number>
      distributionByRed?: Record<string, number>
    }
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
    types: Record<
      string,
      {
        byBlue: number
        byRed: number
        winrateBlue?: number | null
        winrateRed?: number | null
        distributionByBlue?: Record<string, number>
        distributionByRed?: Record<string, number>
      }
    >
    souls: Record<
      string,
      { byBlue: number; byRed: number; winrateBlue?: number | null; winrateRed?: number | null }
    >
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
const overviewSidesBaselineData = ref<typeof overviewSidesData.value>(null)
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
const sidesBlueBottomWinrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.blue ?? [])].sort(
    (a, b) => a.deltaWr - b.deltaWr
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesRedBottomWinrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.red ?? [])].sort(
    (a, b) => a.deltaWr - b.deltaWr
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesBlueBottomPickrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.blue ?? [])].sort(
    (a, b) => a.deltaPick - b.deltaPick
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesRedBottomPickrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.red ?? [])].sort(
    (a, b) => a.deltaPick - b.deltaPick
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesBlueBottomBanrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.blue ?? [])].sort(
    (a, b) => a.deltaBan - b.deltaBan
  )
  return takeOverviewChampionTopN(sorted, FAST_STAT_ROW_COUNT)
})
const sidesRedBottomBanrateSince = computed(() => {
  const sorted = [...(overviewSidesProgressionData.value?.red ?? [])].sort(
    (a, b) => a.deltaBan - b.deltaBan
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
      winrateBlue: d.elder?.winrateBlue ?? null,
      winrateRed: d.elder?.winrateRed ?? null,
      distributionByBlue: d.elder?.distributionByBlue ?? {},
      distributionByRed: d.elder?.distributionByRed ?? {},
    },
    {
      key: 'earth',
      label: t('statisticsPage.drakeTypeEarth'),
      byBlue: d.earth?.byBlue ?? 0,
      byRed: d.earth?.byRed ?? 0,
      winrateBlue: d.earth?.winrateBlue ?? null,
      winrateRed: d.earth?.winrateRed ?? null,
      distributionByBlue: d.earth?.distributionByBlue ?? {},
      distributionByRed: d.earth?.distributionByRed ?? {},
    },
    {
      key: 'water',
      label: t('statisticsPage.drakeTypeWater'),
      byBlue: d.water?.byBlue ?? 0,
      byRed: d.water?.byRed ?? 0,
      winrateBlue: d.water?.winrateBlue ?? null,
      winrateRed: d.water?.winrateRed ?? null,
      distributionByBlue: d.water?.distributionByBlue ?? {},
      distributionByRed: d.water?.distributionByRed ?? {},
    },
    {
      key: 'wind',
      label: t('statisticsPage.drakeTypeWind'),
      byBlue: d.wind?.byBlue ?? 0,
      byRed: d.wind?.byRed ?? 0,
      winrateBlue: d.wind?.winrateBlue ?? null,
      winrateRed: d.wind?.winrateRed ?? null,
      distributionByBlue: d.wind?.distributionByBlue ?? {},
      distributionByRed: d.wind?.distributionByRed ?? {},
    },
    {
      key: 'fire',
      label: t('statisticsPage.drakeTypeFire'),
      byBlue: d.fire?.byBlue ?? 0,
      byRed: d.fire?.byRed ?? 0,
      winrateBlue: d.fire?.winrateBlue ?? null,
      winrateRed: d.fire?.winrateRed ?? null,
      distributionByBlue: d.fire?.distributionByBlue ?? {},
      distributionByRed: d.fire?.distributionByRed ?? {},
    },
    {
      key: 'hextec',
      label: t('statisticsPage.drakeTypeHextec'),
      byBlue: d.hextec?.byBlue ?? 0,
      byRed: d.hextec?.byRed ?? 0,
      winrateBlue: d.hextec?.winrateBlue ?? null,
      winrateRed: d.hextec?.winrateRed ?? null,
      distributionByBlue: d.hextec?.distributionByBlue ?? {},
      distributionByRed: d.hextec?.distributionByRed ?? {},
    },
    {
      key: 'chem',
      label: t('statisticsPage.drakeTypeChem'),
      byBlue: d.chem?.byBlue ?? 0,
      byRed: d.chem?.byRed ?? 0,
      winrateBlue: d.chem?.winrateBlue ?? null,
      winrateRed: d.chem?.winrateRed ?? null,
      distributionByBlue: d.chem?.distributionByBlue ?? {},
      distributionByRed: d.chem?.distributionByRed ?? {},
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
      winrateBlue: d.earth?.winrateBlue ?? null,
      winrateRed: d.earth?.winrateRed ?? null,
    },
    {
      key: 'water',
      label: t('statisticsPage.drakeTypeWater'),
      byBlue: d.water?.byBlue ?? 0,
      byRed: d.water?.byRed ?? 0,
      winrateBlue: d.water?.winrateBlue ?? null,
      winrateRed: d.water?.winrateRed ?? null,
    },
    {
      key: 'wind',
      label: t('statisticsPage.drakeTypeWind'),
      byBlue: d.wind?.byBlue ?? 0,
      byRed: d.wind?.byRed ?? 0,
      winrateBlue: d.wind?.winrateBlue ?? null,
      winrateRed: d.wind?.winrateRed ?? null,
    },
    {
      key: 'fire',
      label: t('statisticsPage.drakeTypeFire'),
      byBlue: d.fire?.byBlue ?? 0,
      byRed: d.fire?.byRed ?? 0,
      winrateBlue: d.fire?.winrateBlue ?? null,
      winrateRed: d.fire?.winrateRed ?? null,
    },
    {
      key: 'hextec',
      label: t('statisticsPage.drakeTypeHextec'),
      byBlue: d.hextec?.byBlue ?? 0,
      byRed: d.hextec?.byRed ?? 0,
      winrateBlue: d.hextec?.winrateBlue ?? null,
      winrateRed: d.hextec?.winrateRed ?? null,
    },
    {
      key: 'chem',
      label: t('statisticsPage.drakeTypeChem'),
      byBlue: d.chem?.byBlue ?? 0,
      byRed: d.chem?.byRed ?? 0,
      winrateBlue: d.chem?.winrateBlue ?? null,
      winrateRed: d.chem?.winrateRed ?? null,
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
  const total = data.matchCount
  const aggregated = aggregateObjectiveHistogramDist(key, dist)
  return Object.entries(aggregated)
    .map(([countStr, n]) => ({
      count: parseInt(countStr, 10) || 0,
      percent: Math.round((Number(n) / total) * 10000) / 100,
    }))
    .filter(({ count, percent }) => count > 0 && percent > 0)
    .sort((a, b) => a.count - b.count)
}
function sidesObjectiveCounts(key: string): number[] {
  return collectObjectiveDisplayCounts(key)
}
function percentForCountSides(key: string, count: number, byBlue: boolean): string {
  const data = overviewSidesData.value
  if (!data?.matchCount) return '—'
  const obj = data.objectivesBySideTable?.[key as keyof typeof data.objectivesBySideTable] as
    | { distributionByBlue?: Record<string, number>; distributionByRed?: Record<string, number> }
    | undefined
  if (!obj) return '—'
  const dist = byBlue ? obj.distributionByBlue : obj.distributionByRed
  const games = aggregateObjectiveHistogramDist(key, dist)[count] ?? 0
  return formatObjectiveObtentionPercent(games, data.matchCount)
}
function distributionPercentRows(
  dist: Record<string, number> | undefined,
  total: number,
  objectiveKey?: string
): Array<{ count: number; percent: number }> {
  if (!total) return []
  const aggregated = objectiveKey
    ? aggregateObjectiveHistogramDist(objectiveKey, dist)
    : Object.fromEntries(
        Object.entries(dist ?? {}).map(([k, n]) => [parseInt(k, 10) || 0, Number(n)])
      )
  return Object.entries(aggregated)
    .map(([countStr, n]) => ({
      count: parseInt(countStr, 10) || 0,
      percent: Math.round((Number(n) / total) * 10000) / 100,
    }))
    .filter(({ count, percent }) => count > 0 && percent > 0)
    .sort((a, b) => a.count - b.count)
}
function drakeTypeDistributionPercentages(
  key: string,
  byWin: boolean
): Array<{ count: number; percent: number }> {
  const data = overviewTeamsData.value
  if (!data?.matchCount) return []
  const row = drakeTypeRows.value.find(r => r.key === key)
  if (!row) return []
  const dist = byWin ? row.distributionByWin : row.distributionByLoss
  return distributionPercentRows(dist, data.matchCount, key)
}
function drakeTypeDistributionPercentagesSides(
  key: string,
  byBlue: boolean
): Array<{ count: number; percent: number }> {
  const data = overviewSidesData.value
  if (!data?.matchCount) return []
  const row = sidesDrakeTypeRows.value.find(r => r.key === key)
  if (!row) return []
  const dist = byBlue ? row.distributionByBlue : row.distributionByRed
  return distributionPercentRows(dist, data.matchCount, key)
}
function drakeTypeCounts(key: string): number[] {
  const byWin = drakeTypeDistributionPercentages(key, true)
  const byLoss = drakeTypeDistributionPercentages(key, false)
  const byBlue = drakeTypeDistributionPercentagesSides(key, true)
  const byRed = drakeTypeDistributionPercentagesSides(key, false)
  const set = new Set<number>([
    ...byWin.map(r => r.count),
    ...byLoss.map(r => r.count),
    ...byBlue.map(r => r.count),
    ...byRed.map(r => r.count),
  ])
  return [...set].sort((a, b) => a - b)
}
function drakeTypePercentForCount(key: string, count: number, byWin: boolean): string {
  const data = overviewTeamsData.value
  if (!data?.matchCount) return '—'
  const row = drakeTypeRows.value.find(r => r.key === key)
  if (!row) return '—'
  const dist = byWin ? row.distributionByWin : row.distributionByLoss
  const games = aggregateObjectiveHistogramDist(key, dist)[count] ?? 0
  return formatObjectiveObtentionPercent(games, data.matchCount)
}
function drakeTypePercentForCountSides(key: string, count: number, byBlue: boolean): string {
  const data = overviewSidesData.value
  if (!data?.matchCount) return '—'
  const row = sidesDrakeTypeRows.value.find(r => r.key === key)
  if (!row) return '—'
  const dist = byBlue ? row.distributionByBlue : row.distributionByRed
  const games = aggregateObjectiveHistogramDist(key, dist)[count] ?? 0
  return formatObjectiveObtentionPercent(games, data.matchCount)
}
function sidesQueryParams(opts?: { version?: string | null }): string {
  const params = new URLSearchParams()
  const ver = opts?.version != null && opts.version !== '' ? opts.version : statsVersionFilter.value
  if (ver) params.set('version', ver)
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

async function loadObjectivesBaseline() {
  const cmp = resolveStatsBaselineVersion()
  if (!cmp) {
    overviewTeamsBaselineData.value = null
    overviewSidesBaselineData.value = null
    return
  }
  try {
    const [teamsBase, sidesBase] = await Promise.all([
      statsFetch<typeof overviewTeamsData.value>(
        apiUrl('/api/stats/overview-teams' + overviewQueryParams({ version: cmp }))
      ).catch(() => null),
      statsFetch<typeof overviewSidesData.value>(
        apiUrl('/api/stats/overview-sides' + sidesQueryParams({ version: cmp }))
      ).catch(() => null),
    ])
    overviewTeamsBaselineData.value = teamsBase
    overviewSidesBaselineData.value = sidesBase
  } catch {
    overviewTeamsBaselineData.value = null
    overviewSidesBaselineData.value = null
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
/** Aligné sur STATS_OTP_PICKRATE_THRESHOLD backend (défaut 1 %). */
const STATS_OTP_PICKRATE_THRESHOLD_PCT = 1

function overviewRowMatchesOtpFilter(row: { pickrate?: number }): boolean {
  const pr = Number(row.pickrate ?? 0)
  if (statsOtpFilter.value === 'solo') return pr < STATS_OTP_PICKRATE_THRESHOLD_PCT
  if (statsOtpFilter.value === 'non') return pr >= STATS_OTP_PICKRATE_THRESHOLD_PCT
  return true
}

/**
 * Prend les n premières lignes en conservant l’ordre API ; filtre OTP (pickrate) puis priorité
 * aux IDs de GET /api/stats/champions quand disponibles.
 */
function takeOverviewChampionTopN<T extends { championId: number; pickrate?: number }>(
  rows: readonly T[],
  n: number = FAST_STAT_ROW_COUNT
): T[] {
  if (!rows.length || n <= 0) return []
  if (statsOtpFilter.value === 'oui') return rows.slice(0, n)

  let pool = rows.filter(r => overviewRowMatchesOtpFilter(r))
  if (pool.length === 0) pool = [...rows]

  const allowed = overviewFilteredChampionIds.value
  if (allowed.size > 0) {
    const intersected = pool.filter(r => allowed.has(r.championId))
    if (intersected.length > 0) pool = intersected
  }

  const out: T[] = []
  const seen = new Set<number>()
  for (const row of pool) {
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

/** Regroupe les buckets histogramme (4+ voidgrubs → 3, etc.). */
function aggregateObjectiveHistogramDist(
  key: string,
  dist: Record<string, number> | undefined
): Record<number, number> {
  const aggregated: Record<number, number> = {}
  if (!dist || typeof dist !== 'object') return aggregated
  const capHorde = key === 'horde'
  const capRiftHerald = key === 'riftHerald'
  for (const [k, n] of Object.entries(dist)) {
    const raw = parseInt(k, 10) || 0
    let displayCount = raw
    if (capHorde && raw > HORDE_DISPLAY_MAX) displayCount = HORDE_DISPLAY_MAX
    else if (capRiftHerald && raw > RIFT_HERALD_DISPLAY_MAX) displayCount = RIFT_HERALD_DISPLAY_MAX
    aggregated[displayCount] = (aggregated[displayCount] ?? 0) + Number(n)
  }
  return aggregated
}

function formatObjectiveObtentionPercent(games: number, matchCount: number): string {
  if (!matchCount) return '—'
  const pct = games <= 0 ? 0 : Math.round((games / matchCount) * 10000) / 100
  return `${pct.toFixed(2)}%`
}

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
  const total = data.matchCount
  const aggregated = aggregateObjectiveHistogramDist(key, dist)
  return Object.entries(aggregated)
    .map(([countStr, n]) => ({
      count: parseInt(countStr, 10) || 0,
      percent: Math.round((Number(n) / total) * 10000) / 100,
    }))
    .filter(({ count, percent }) => count > 0 && percent > 0)
    .sort((a, b) => a.count - b.count)
}

function collectObjectiveDisplayCounts(key: string): number[] {
  const set = new Set<number>()
  const addBuckets = (dist: Record<string, number> | undefined) => {
    const agg = aggregateObjectiveHistogramDist(key, dist)
    for (const [countStr, games] of Object.entries(agg)) {
      const count = parseInt(countStr, 10) || 0
      if (count > 0 && Number(games) > 0) set.add(count)
    }
  }
  const teams = overviewTeamsData.value
  const sides = overviewSidesData.value
  const obj = teams?.objectives?.[key as keyof typeof teams.objectives]
  if (obj && 'distributionByWin' in obj) {
    addBuckets((obj as { distributionByWin: Record<string, number> }).distributionByWin)
    addBuckets((obj as { distributionByLoss: Record<string, number> }).distributionByLoss)
  }
  const sideObj = sides?.objectivesBySideTable?.[
    key as keyof typeof sides.objectivesBySideTable
  ] as { distributionByBlue?: Record<string, number>; distributionByRed?: Record<string, number> }
  if (sideObj) {
    addBuckets(sideObj.distributionByBlue)
    addBuckets(sideObj.distributionByRed)
  }
  const sorted = [...set].sort((a, b) => a - b)
  if (key === 'horde') return sorted.filter(c => c <= HORDE_DISPLAY_MAX)
  if (key === 'riftHerald') return sorted.filter(c => c <= RIFT_HERALD_DISPLAY_MAX)
  return sorted
}

/** Tous les N présents dans au moins une colonne (win / loss / blue / red). */
function objectiveCounts(key: string): number[] {
  return collectObjectiveDisplayCounts(key)
}

/** % de matchs avec exactement N prises sur ce segment (0 % si aucune partie, pas « — »). */
function percentForCount(key: string, count: number, byWin: boolean): string {
  const data = overviewTeamsData.value
  if (!data?.matchCount) return '—'
  const obj = data.objectives[key as keyof typeof data.objectives]
  if (!obj || !('distributionByWin' in obj)) return '—'
  const dist = byWin
    ? (obj as { distributionByWin: Record<string, number> }).distributionByWin
    : (obj as { distributionByLoss: Record<string, number> }).distributionByLoss
  const games = aggregateObjectiveHistogramDist(key, dist)[count] ?? 0
  return formatObjectiveObtentionPercent(games, data.matchCount)
}
/** Ordre d’affichage dans le tableau objectifs (obtention / winrate). */
const objectiveKeysOrdered = [
  'baron',
  'dragon',
  'tower',
  'inhibitor',
  'riftHerald',
  'horde',
] as const
/** Objectifs avec répartition par nombre de prises (dropdown). Héraut exclu : max 1 / partie. */
const objectiveKeysWithKillDropdown = new Set<string>([
  'baron',
  'dragon',
  'tower',
  'inhibitor',
  'horde',
])
function objectiveHasKillDropdown(key: string): boolean {
  return objectiveKeysWithKillDropdown.has(key)
}
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
      securedWinrateGlobal: d.elder?.securedWinrateGlobal ?? null,
      distributionByWin: d.elder?.distributionByWin ?? {},
      distributionByLoss: d.elder?.distributionByLoss ?? {},
    },
    {
      key: 'earth',
      label: t('statisticsPage.drakeTypeEarth'),
      byWin: d.earth.byWin,
      byLoss: d.earth.byLoss,
      securedWinrateGlobal: d.earth.securedWinrateGlobal ?? null,
      distributionByWin: d.earth.distributionByWin ?? {},
      distributionByLoss: d.earth.distributionByLoss ?? {},
    },
    {
      key: 'water',
      label: t('statisticsPage.drakeTypeWater'),
      byWin: d.water.byWin,
      byLoss: d.water.byLoss,
      securedWinrateGlobal: d.water.securedWinrateGlobal ?? null,
      distributionByWin: d.water.distributionByWin ?? {},
      distributionByLoss: d.water.distributionByLoss ?? {},
    },
    {
      key: 'wind',
      label: t('statisticsPage.drakeTypeWind'),
      byWin: d.wind.byWin,
      byLoss: d.wind.byLoss,
      securedWinrateGlobal: d.wind.securedWinrateGlobal ?? null,
      distributionByWin: d.wind.distributionByWin ?? {},
      distributionByLoss: d.wind.distributionByLoss ?? {},
    },
    {
      key: 'fire',
      label: t('statisticsPage.drakeTypeFire'),
      byWin: d.fire.byWin,
      byLoss: d.fire.byLoss,
      securedWinrateGlobal: d.fire.securedWinrateGlobal ?? null,
      distributionByWin: d.fire.distributionByWin ?? {},
      distributionByLoss: d.fire.distributionByLoss ?? {},
    },
    {
      key: 'hextec',
      label: t('statisticsPage.drakeTypeHextec'),
      byWin: d.hextec.byWin,
      byLoss: d.hextec.byLoss,
      securedWinrateGlobal: d.hextec.securedWinrateGlobal ?? null,
      distributionByWin: d.hextec.distributionByWin ?? {},
      distributionByLoss: d.hextec.distributionByLoss ?? {},
    },
    {
      key: 'chem',
      label: t('statisticsPage.drakeTypeChem'),
      byWin: d.chem.byWin,
      byLoss: d.chem.byLoss,
      securedWinrateGlobal: d.chem.securedWinrateGlobal ?? null,
      distributionByWin: d.chem.distributionByWin ?? {},
      distributionByLoss: d.chem.distributionByLoss ?? {},
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
const rankTiers = [...RANK_TIERS]
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
const championGlobalTableRefMatchCount = ref(0)

/** Largeur minimale du tableau champion (scroll) selon les groupes de colonnes affichés. */
const championGlobalTableMinWidthPx = computed(() => {
  const wChamp = 220
  const wStat = 48
  const wKda = 160
  let statCols = 0
  if (showChampionSideColumns.value) statCols += 4
  if (showChampionDealtColumns.value) statCols += 4
  if (showChampionTakenColumns.value) statCols += 4
  return wChamp + statCols * wStat + wKda
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
  return championGlobalSideStatDeltaPp(row.championId, side, stat) ?? 0
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

function comparePatchMajorMinor(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  const [aM, aMi] = a.split('.').map(Number)
  const [bM, bMi] = b.split('.').map(Number)
  if (aM !== bM) return aM - bM
  return aMi - bMi
}

/** Version de référence pour les Δ (progression ou patch précédent avec des matchs). */
function resolveStatsBaselineVersion(): string | null {
  const mainVer = (statsVersionFilter.value || gameVersion.value || '').trim()
  const refVer = (progressionFromVersion.value ?? '').trim()
  const mainPatch = patchFromVersion(mainVer)
  const refPatch = patchFromVersion(refVer)
  if (refVer && refPatch && mainPatch && refPatch !== mainPatch) return refVer
  if (!mainVer || !mainPatch) return null
  const list = statsVersionOptions.value
  const idx = list.findIndex(v => v.version === mainVer)
  if (idx < 0) return null
  const prev = list
    .slice(idx + 1)
    .find(v => Number(v.matchCount ?? 0) > 0)
    ?.version?.trim()
  if (!prev) return null
  const prevPatch = patchFromVersion(prev)
  if (prevPatch && prevPatch !== mainPatch) return prev
  return null
}

const championGlobalPatchDeltaRefLabel = computed(() => {
  const baseline = resolveStatsBaselineVersion()
  if (!baseline) return null
  return patchFromVersion(baseline)
})

/** Patch de référence pour deltas runes / items / sorts (overview-detail baseline). */
const overviewDetailComparisonVersion = computed(() => resolveStatsBaselineVersion())

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

/** Requête bans : patch / ligue + rôle (quand choisi). */
function bansTableQueryForVersion(versionFull: string | null | undefined): string {
  const params = new URLSearchParams()
  const v = (versionFull ?? '').trim()
  if (v) params.set('version', v)
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  const s = params.toString()
  return s ? `?${s}` : ''
}

const activeBansRoleColumn = computed(() => {
  const role = (statsRoleFilter.value || '')
    .trim()
    .toUpperCase() as keyof typeof roleToBansColumnKey
  return roleToBansColumnKey[role] ?? null
})
const showBansRoleColumns = computed(() => true)
function showBansRoleColumn(key: string): boolean {
  if (!showBansRoleColumns.value) return false
  if (!activeBansRoleColumn.value) return true
  return key === activeBansRoleColumn.value
}

// Keep the composable return as one object — bundlers drop destructured bindings that are only used via
// provide/inject in child SFCs, which breaks SSR (e.g. bansSortHint).
const bansTab = useStatisticsBansTab({
  championSearchQuery,
  championsPageSize,
  statsVersionFilter,
  progressionFromVersion,
  resolveBaselineVersion: resolveStatsBaselineVersion,
  gameVersion,
  statsFetch,
  apiUrl,
  patchFromVersion,
  championGlobalTableQueryForVersion: bansTableQueryForVersion,
  statsPerfStart,
  statsPerfEnd,
  championName,
  overviewTeamsData,
  overviewTeamsBaselineData,
})

async function loadChampionGlobalTable() {
  championGlobalTablePending.value = true
  championGlobalTableError.value = null
  championGlobalTableRefById.value = new Map()
  championGlobalTableRefMatchCount.value = 0
  try {
    const mainVer = (statsVersionFilter.value || gameVersion.value || '').trim()
    const refVer = resolveStatsBaselineVersion()

    const [data, refData] = await Promise.all([
      statsFetch<{
        matchCount: number
        rows: ChampionGlobalTableRow[]
        error?: string
        message?: string
      }>(apiUrl('/api/stats/champions/global-table' + championGlobalTableQueryForVersion(mainVer))),
      refVer
        ? statsFetch<{ matchCount: number; rows: ChampionGlobalTableRow[] }>(
            apiUrl('/api/stats/champions/global-table' + championGlobalTableQueryForVersion(refVer))
          )
        : Promise.resolve(null),
    ])

    championGlobalTableData.value = data
    if (data?.error || data?.message) {
      championGlobalTableError.value = [data.error, data.message].filter(Boolean).join(': ')
    } else {
      championGlobalTableError.value = null
    }

    if (refData) {
      championGlobalTableRefMatchCount.value = Math.max(0, Number(refData.matchCount ?? 0))
      const m = new Map<number, ChampionGlobalTableRow>()
      for (const r of refData.rows ?? []) m.set(r.championId, r)
      championGlobalTableRefById.value = m
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

  if (stat === 'winrate') {
    if (cur.games <= 0 || rf.games <= 0) return undefined
    return (cur.wins / cur.games) * 100 - (rf.wins / rf.games) * 100
  }

  const mcCur = championGlobalTableData.value?.matchCount ?? 0
  const mcRef = championGlobalTableRefMatchCount.value
  if (mcCur <= 0 || mcRef <= 0) return undefined
  const pickCur = (cur.games / (5 * mcCur)) * 100
  const pickRef = (rf.games / (5 * mcRef)) * 100
  return pickCur - pickRef
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

watch([statsDivisionFilter, statsRoleFilter, statsOtpFilter], () => {
  loadVersionsWithMatches()
  const tab = activeTab.value
  if (tab === 'overview') loadChampions()
  if (tab === 'championTable') loadChampionGlobalTable()
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
  if (tab === 'overview') {
    loadOverview()
    loadChampions()
    loadObjectivesBaseline()
  }
  if (tab === 'objectives') {
    if (!overviewData.value?.matchesByVersion?.length) await loadOverview()
    loadOverviewSides()
    loadObjectivesBaseline()
  }
  // if (tab === 'trends') {
  //   if (!overviewData.value?.matchesByVersion?.length) await loadOverview()
  //   if (!progressionFromVersion.value && !versionStore.currentVersion)
  //     await versionStore.loadCurrentVersion()
  //   loadProgressionsFull()
  // }
  if (tab === 'team') loadOverviewSides()
  if (tab === 'infos') loadInfosPatchDivisionMatrix()
  if (tab === 'infos') loadInfosMeta()
  if (tab === 'infos') loadBalanceFramework()
  if (tab === 'championTable') loadChampionGlobalTable()
  if (tab === 'balance') loadBalanceFramework()
  if (tab === 'bans') {
    bansTab.loadBansTable()
    loadObjectivesBaseline()
  }
  if (tab === 'spells' || tab === 'items') {
    loadOverviewDetail()
    loadOverviewDetailBaseline()
  } else if (tab === 'runes') {
    if (!overviewDetailData.value && !overviewDetailPending.value) loadOverviewDetail()
    loadOverviewDetailBaseline()
  }
  if (tab === 'abandons') loadOverviewAbandons()
  if (tab === 'surrender') loadSurrenderMatrix()
})
watch([statsVersionFilter, statsDivisionFilter, statsRoleFilter, statsOtpFilter], () => {
  if (activeTab.value === 'overview') {
    loadVersionsWithMatches()
    loadOverview()
    loadChampions()
    loadObjectivesBaseline()
  }
  if (activeTab.value === 'team') {
    loadOverviewSides()
    loadOverviewTeams()
  }
  if (activeTab.value === 'objectives') {
    loadOverviewSides()
    loadOverviewTeams()
    loadObjectivesBaseline()
  }
  // if (activeTab.value === 'trends') loadProgressionsFull()
  if (activeTab.value === 'championTable') loadChampionGlobalTable()
  if (activeTab.value === 'balance') loadBalanceFramework()
  if (activeTab.value === 'infos') {
    loadInfosPatchDivisionMatrix().catch(() => undefined)
    loadBalanceFramework()
  }
  if (activeTab.value === 'bans') {
    bansTab.loadBansTable()
    loadOverviewTeams()
    loadObjectivesBaseline()
  }
  if (activeTab.value === 'surrender') loadSurrenderMatrix()
  if (activeTab.value === 'runes' || activeTab.value === 'items' || activeTab.value === 'spells') {
    loadOverviewDetail()
    loadOverviewDetailBaseline()
  }
})

watch([activeTab, statsVersionFilter, statsDivisionFilter, statsRoleFilter, statsOtpFilter], () => {
  syncStatisticsStateToQuery()
})
watch(progressionFromVersion, () => {
  if (activeTab.value === 'overview') {
    loadOverviewProgression()
    loadProgressionsFull()
    loadObjectivesBaseline()
  }
  // if (activeTab.value === 'trends') loadProgressionsFull()
  if (activeTab.value === 'championTable') loadChampionGlobalTable()
  if (activeTab.value === 'balance') loadBalanceFramework()
  if (activeTab.value === 'infos') loadBalanceFramework()
  if (activeTab.value === 'team') loadOverviewSides()
  if (activeTab.value === 'objectives') loadOverviewSides()
  if (activeTab.value === 'objectives') loadObjectivesBaseline()
  if (activeTab.value === 'bans') {
    bansTab.loadBansTable()
    loadObjectivesBaseline()
  }
  if (activeTab.value === 'surrender') loadSurrenderMatrix()
  if (activeTab.value === 'runes' || activeTab.value === 'items' || activeTab.value === 'spells') {
    loadOverviewDetail()
    loadOverviewDetailBaseline()
  }
})

onMounted(async () => {
  document.addEventListener('keydown', onFiltersEscapeKey)
  filtersSheetMq = window.matchMedia('(max-width: 1023px)')
  onFiltersSheetMqChange()
  filtersSheetMq.addEventListener('change', onFiltersSheetMqChange)
  const versionPromise = versionStore.currentVersion
    ? Promise.resolve()
    : versionStore.loadCurrentVersion()
  const tPage = statsPerfStart('page mount')
  const tVersion = statsPerfStart('version')
  await versionPromise
  statsPerfEnd('version', tVersion)
  await loadVersionsWithMatches()
  await loadOverview()
  if (activeTab.value === 'overview') {
    loadChampions()
    loadObjectivesBaseline()
  }
  // Apply default version only after first overview call, so we can prefer patches
  // that actually have matches (matchesByVersion), not only catalog versions.
  const defaultVersionApplied = applyDefaultVersionFiltersFromKnownVersions()
  if (defaultVersionApplied) {
    await loadOverview()
  }
  runInBackground(Promise.allSettled([loadInfosMeta(), loadInfosPatchDivisionMatrix()]))
  statsPerfEnd('page mount', tPage)
  championsStore.loadChampions(riotLocale.value)
  itemsStore.loadItems(riotLocale.value)
  runesStore.loadRunes(riotLocale.value)
  summonerSpellsStore.loadSummonerSpells(riotLocale.value)
  if (activeTab.value === 'team') loadOverviewSides()
  if (activeTab.value === 'objectives') loadOverviewSides()
  if (activeTab.value === 'objectives') loadObjectivesBaseline()
  if (activeTab.value === 'surrender') loadSurrenderMatrix()
  if (activeTab.value === 'championTable') loadChampionGlobalTable()
  if (activeTab.value === 'balance') loadBalanceFramework()
  if (activeTab.value === 'infos') loadBalanceFramework()
  if (activeTab.value === 'bans') {
    runInBackground(bansTab.loadBansTable())
    runInBackground(loadOverviewTeams())
    runInBackground(loadObjectivesBaseline())
  }
  nextTick(() => scrollActiveTabIntoView('auto'))
})

onUnmounted(() => {
  document.removeEventListener('keydown', onFiltersEscapeKey)
  filtersSheetMq?.removeEventListener('change', onFiltersSheetMqChange)
  if (import.meta.client) document.body.style.overflow = ''
})

// Références explicites pour le build prod : bindings uniquement consommés via inject (onglets).
const statisticsPageInjectFallback: Record<string, unknown> = {
  CHART_H,
  CHART_PAD,
  CHART_W,
  PAGE_SIZE_OPTIONS,
  PLOT_H,
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
  championsPageSizeModel,
  championName,
  championSearchQuery,
  championSearchFocused,
  isMobileViewport,
  overviewFastStatView,
  setOverviewFastStatView,
  showMobileViewToast,
  dismissMobileViewToast,
  balanceAverageFilter,
  balanceEliteFilter,
  balanceGlobalFilter,
  balanceNeedFilter,
  balanceSkilledFilter,
  balanceFrameworkData,
  balanceFrameworkError,
  balanceFrameworkPending,
  championsPageSize,
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
  formatTierListPatchDeltaGames,
  formatTierListPatchDeltaPp,
  gameVersion,
  getChampionImageUrl,
  getItemImageUrl,
  getRankedEmblemUrl,
  goToBansTab,
  goToChampionTableWithSort,
  goToTierListWithSort,
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
  drakeTypeCounts,
  drakeTypePercentForCount,
  drakeTypePercentForCountSides,
  objectiveCounts,
  objectiveIconSrc,
  objectiveKeysOrdered,
  objectiveHasKillDropdown,
  objectiveRow,
  objectiveRowSides,
  objectivesPanelTab,
  objectivesSidesPanelTab,
  onDrakeIconError,
  onObjectiveIconError,
  openObjectiveKeys,
  openSidesObjectiveKeys,
  overviewAbandonsData,
  overviewAbandonsPending,
  surrenderMatrixBaselineLabel,
  surrenderMatrixPending,
  surrenderMatrixRows,
  overviewBottomBanrateSince,
  overviewBottomPickrateSince,
  overviewBottomWinrateSince,
  overviewData,
  overviewDetailBaselineData,
  overviewDetailBaselinePending,
  overviewDetailComparisonVersion,
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
  overviewSidesBaselineData,
  overviewSidesPending,
  overviewSurrenderOnlyCount,
  overviewSurrenderOnlyPct,
  overviewTeamsData,
  overviewTeamsBaselineData,
  overviewTopBanrateSince,
  overviewTopPickrateChampionsFiltered,
  overviewTopPickrateSince,
  overviewTopWinrateSince,
  paginatedItems,
  paginatedProgressionsByPickrate,
  paginatedProgressionsChampions,
  percentForCount,
  percentForCountSides,
  progressionFromVersion,
  progressionFullData,
  progressionFullPending,
  progressionsPage,
  progressionsPageSizeModel,
  progressionsPageSize,
  retryOverviewDetail,
  setChampionGlobalSort,
  setObjectivesPanelTab,
  showBansOutcomeColumns,
  showBansSideColumns,
  showChampionDealtColumns,
  showChampionSideColumns,
  showChampionTakenColumns,
  showBansRoleColumn,
  showBansRoleColumns,
  sidesBlueBanRows,
  sidesBlueBestWinrateRows,
  sidesBlueBottomBanrateSince,
  sidesBlueBottomPickrateSince,
  sidesBlueBottomWinrateSince,
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
  sidesRedBottomBanrateSince,
  sidesRedBottomPickrateSince,
  sidesRedBottomWinrateSince,
  sidesRedMostPickedRows,
  sidesRedPlayedCount,
  sidesRedSurrenderOnlyCount,
  sidesRedTopBanrateSince,
  sidesRedTopPickrateSince,
  sidesRedTopWinrateSince,
  sidesSurrenderBySide,
  spellsModeFilter,
  teamPercent,
  tierListPatchDeltaClass,
  tierListPatchDeltaGamesClass,
  tierListWinrateClass,
  toggleFavoriteCard,
  toggleObjective,
  toggleSidesObjective,
  totalItemsCount,
  totalItemsPages,
  totalProgressionsCount,
  totalProgressionsPages,
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
        if (key === 'onChampionGlobalPageUpdated') {
          return (v: number) => {
            championGlobalPage.value = v
          }
        }
        if (key === 'onChampionGlobalPageSizeUpdated') {
          return (v: number) => {
            championsPageSizeModel.value = v
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
        if (typeof key === 'string') {
          const inst = __statisticsVm as { setupState?: Record<string, unknown> }
          const binding = inst.setupState?.[key]
          if (isRef(binding)) {
            ;(binding as { value: unknown }).value = value
            return true
          }
        }
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
/* Onglets : scroll snap + fade bords */
.statistics-tabs-nav {
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.statistics-tabs-nav::-webkit-scrollbar {
  display: none;
}
.statistics-tabs-scroll-wrap::before,
.statistics-tabs-scroll-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 8px;
  width: 28px;
  z-index: 2;
  pointer-events: none;
}
.statistics-tabs-scroll-wrap::before {
  left: 0;
  background: linear-gradient(to right, rgb(8 16 31 / 0.95), transparent);
}
.statistics-tabs-scroll-wrap::after {
  right: 0;
  background: linear-gradient(to left, rgb(8 16 31 / 0.95), transparent);
}
@media (max-width: 767px) {
  .statistics-tab-btn {
    font-size: 13px;
    padding-left: 12px;
    padding-right: 12px;
  }
}
@media (max-width: 1023px) {
  .statistics-filters-panel .flex.min-h-0.flex-1 {
    overflow-y: auto;
  }
}

.statistics-tab-enter-active {
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out;
}
.statistics-tab-leave-active {
  transition:
    opacity 100ms ease-in,
    transform 100ms ease-in;
}
.statistics-tab-enter-from,
.statistics-tab-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.statistics-tab-leave-from,
.statistics-tab-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.statistics aside {
  background: #08101f !important;
}
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
  overflow-x: hidden;
  overflow-y: visible;
}
.statistics .fast-stat-card .fast-stat-table,
.statistics .team-side-fast-stat .fast-stat-table {
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  overflow-x: hidden;
}
.statistics .team-side-fast-stat .fast-stat-table td {
  overflow: hidden;
}
.statistics .team-side-fast-stat .fast-stat-row {
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.1);
}
.statistics .team-side-fast-stat .fast-stat-row:last-child {
  border-bottom: none;
}
.statistics .team-side-fast-stat {
  margin-bottom: 10px;
  width: 313px !important;
  min-width: 313px;
  max-width: 313px;
  min-height: 325px;
  height: auto;
  margin-left: auto;
  margin-right: auto;
  flex: 0 0 313px;
  background: #08101f !important;
  justify-self: center;
  overflow: visible;
}
@media (max-width: 640px) {
  .statistics .team-side-fast-stat {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    min-height: 0;
    flex: 1 1 auto;
  }
}
@media (max-width: 640px) {
  .statistics .fast-stat-card {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    height: auto;
    min-height: 0;
    flex: 1 1 auto;
  }
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

/* Donuts drake/soul : hauteur libre, pas de scroll interne. */
.statistics .fast-stat-card.fast-stat-card-distribution {
  width: min(100%, 420px) !important;
  min-width: 0 !important;
  max-width: 420px !important;
  height: auto !important;
  min-height: 0 !important;
  flex: 0 1 auto;
  overflow: visible;
}

/* Onglet Objets : pas de hauteur fixe (cartes items). */
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
.statistics .fast-stat-tooltip-popover--objectives {
  min-width: 24rem;
  max-width: min(36rem, calc(100vw - 1.5rem));
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
