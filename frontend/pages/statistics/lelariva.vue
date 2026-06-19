<template>
  <div
    :class="[
      'lelariva-stats flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-background text-text',
      selectedChampionId ? 'champion-stats' : '',
    ]"
  >
    <div class="flex min-h-0 w-full min-w-0 flex-1">
      <button
        v-if="showDesktopFiltersTrigger"
        type="button"
        class="statistics-filters-desktop-trigger hidden shrink-0 touch-manipulation lg:sticky lg:top-4 lg:z-20 lg:mr-2 lg:flex lg:flex-col lg:items-center lg:gap-1 lg:self-start"
        :aria-label="
          filtersOpen ? t('statisticsPage.closeFilters') : t('statisticsPage.openFilters')
        "
        :aria-expanded="filtersOpen"
        @click="toggleFiltersOpen"
      >
        <span class="filters-collapse-floating inline-flex" aria-hidden="true">
          <svg
            class="h-2 w-2 transition-transform duration-200"
            :class="filtersOpen ? 'rotate-180' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </span>
        <span
          class="max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight text-text/85"
        >
          {{ t('statisticsPage.filtersTitle') }}
        </span>
        <span
          v-if="activeFiltersCount > 0"
          class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
        >
          {{ activeFiltersCount }}
        </span>
      </button>

      <div
        v-if="filtersOpen && effectiveFiltersSheetMode"
        class="fixed inset-0 z-[10050] bg-black/50"
        aria-hidden="true"
        role="presentation"
        @click="closeFilters"
      />

      <aside
        v-show="filtersOpen || !effectiveFiltersSheetMode"
        :class="[
          'statistics-filters-panel flex shrink-0 flex-col overflow-hidden bg-surface',
          effectiveFiltersSheetMode
            ? 'fixed inset-x-0 bottom-0 top-auto z-[10051] max-h-[85vh] w-full rounded-t-2xl shadow-lg'
            : [
                'hidden w-0 opacity-0 transition-[width,opacity] duration-200',
                'lg:sticky lg:top-4 lg:z-0 lg:flex lg:h-auto lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:rounded-lg lg:shadow-none',
                filtersOpen ? 'lg:w-64 lg:opacity-100' : 'lg:w-0 lg:opacity-0',
              ],
        ]"
        :role="effectiveFiltersSheetMode ? 'dialog' : undefined"
        :aria-modal="effectiveFiltersSheetMode ? true : undefined"
        :aria-label="t('statisticsPage.filtersTitle')"
        @click.stop
      >
        <div
          class="relative z-[1] flex shrink-0 items-center gap-2 border-b border-primary/25 p-2 lg:border-transparent lg:pb-2"
        >
          <button
            type="button"
            :class="[
              'mx-auto mb-1 flex h-6 w-14 shrink-0 touch-manipulation items-center justify-center rounded-full',
              effectiveFiltersSheetMode ? '' : 'lg:hidden',
            ]"
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
            @click="resetLelarivaFilters"
          >
            <span class="iconify i-mdi:refresh" aria-hidden="true" />
            Reset
          </button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 lg:flex-none">
          <div class="statistics-filters-fields flex flex-col gap-3">
            <div>
              <label for="lelariva-filter-version" class="mb-1 block text-sm font-medium text-text">
                {{ t('statisticsPage.overviewFilterByVersion') }}
              </label>
              <select
                id="lelariva-filter-version"
                v-model="activeVersion"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              >
                <option value="">{{ t('statisticsPage.overviewVersionAll') }}</option>
                <option v-for="v in availableVersions" :key="v.version" :value="v.version">
                  {{ versionOptionLabel(v.version, v.matchCount) }}
                </option>
              </select>
            </div>

            <div>
              <div class="mb-1 text-sm font-medium text-text">
                {{ t('statisticsPage.overviewMatchesByDivision') }}
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="stats-division-btn rounded p-0.5 transition-colors"
                  :class="
                    !activeDisplayRank
                      ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                      : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="t('statisticsPage.allRanks')"
                  :aria-pressed="!activeDisplayRank"
                  @mousedown.prevent
                  @click.stop="clearActiveDisplayRank()"
                >
                  <img
                    src="/data/community-dragon/ranked-emblem/Unranked.png"
                    :alt="t('statisticsPage.allRanks')"
                    class="h-3 w-3 object-contain"
                    :class="
                      !activeDisplayRank ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'
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
                    activeDisplayRank === tier
                      ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                      : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="formatDivisionLabel(tier)"
                  :aria-pressed="activeDisplayRank === tier"
                  @mousedown.prevent
                  @click.stop="toggleActiveDisplayRank(tier)"
                >
                  <img
                    v-if="getLelarivaRankEmblemUrl(tier)"
                    :src="getLelarivaRankEmblemUrl(tier)!"
                    :alt="tier"
                    class="h-3 w-3 object-contain"
                    :class="
                      activeDisplayRank === tier
                        ? 'saturate-110 opacity-100'
                        : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
              </div>
              <label
                class="mt-2 flex cursor-pointer items-start gap-2 rounded border border-primary/20 bg-background/40 px-2 py-1.5 text-xs text-text/85"
              >
                <input
                  v-model="exportDivisionsCombined"
                  type="checkbox"
                  class="mt-0.5 rounded border-primary/40"
                />
                <span>{{ t('statisticsPage.lelarivaExportDivisionsCombined') }}</span>
              </label>
            </div>

            <div>
              <div class="mb-1 text-sm font-medium text-text">
                {{ t('statisticsPage.filterRole') }}
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="stats-role-btn rounded p-0.5 transition-colors"
                  :class="!activeDisplayRole ? 'bg-blue-500/20' : 'bg-black/20 hover:bg-white/10'"
                  :title="t('statisticsPage.allRoles')"
                  @click="clearActiveDisplayRole()"
                >
                  <img
                    src="/icons/roles/all-role.png"
                    :alt="t('statisticsPage.allRoles')"
                    class="h-3 w-3 object-contain"
                    :class="
                      !activeDisplayRole ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
                <button
                  v-for="r in roleOptions"
                  :key="r.value"
                  type="button"
                  class="stats-role-btn rounded p-0.5 transition-colors"
                  :class="[
                    activeDisplayRole === r.value
                      ? 'bg-blue-500/20'
                      : 'bg-black/20 hover:bg-white/10',
                    selectedChampionId && !isRoleFilterEligible(r.value)
                      ? 'champion-role-disabled'
                      : '',
                  ]"
                  :title="r.label"
                  :disabled="selectedChampionId ? !isRoleFilterEligible(r.value) : false"
                  @click="toggleActiveDisplayRole(r.value)"
                >
                  <img
                    :src="r.icon"
                    :alt="r.label"
                    class="h-3 w-3 object-contain"
                    :class="
                      activeDisplayRole === r.value
                        ? 'saturate-110 opacity-100'
                        : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
              </div>
            </div>

            <div v-if="selectedChampionId" class="border-t border-primary/20 pt-3">
              <h3 class="mb-2 text-sm font-semibold text-text-accent">Export</h3>

              <label class="mb-2 block text-sm font-medium text-text">
                <span class="mb-1 block">{{ t('statisticsPage.exportMinPickrateLabel') }}</span>
                <input
                  v-model.number="activeExportMinPickrate"
                  type="number"
                  min="0"
                  step="0.1"
                  class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                />
              </label>
              <label class="mb-3 block text-sm font-medium text-text">
                <span class="mb-1 block">{{ t('statisticsPage.exportMinGamesLabel') }}</span>
                <input
                  v-model.number="activeExportMinGames"
                  type="number"
                  min="0"
                  step="1"
                  class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                />
              </label>

              <button
                type="button"
                class="w-full rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="exporting"
                @click="exportMatchupsExcel"
              >
                {{ exporting ? 'Export…' : 'Export Excel' }}
              </button>
            </div>

            <div v-else class="border-t border-primary/20 pt-3">
              <label class="mb-2 block text-sm font-medium text-text">
                <span class="mb-1 block">{{ t('statisticsPage.exportMinPickrateLabel') }}</span>
                <input
                  v-model.number="activeExportMinPickrate"
                  type="number"
                  min="0"
                  step="0.1"
                  class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                />
              </label>
              <label class="mb-3 block text-sm font-medium text-text">
                <span class="mb-1 block">{{ t('statisticsPage.exportMinGamesLabel') }}</span>
                <input
                  v-model.number="activeExportMinGames"
                  type="number"
                  min="0"
                  step="1"
                  class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                />
              </label>

              <button
                type="button"
                class="w-full rounded border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="exportingAll"
                @click="exportAllChampionsExcel"
              >
                {{ exportingAll ? 'Export all…' : 'Export all champions (Excel)' }}
              </button>
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

      <div
        :class="[
          'min-w-0 flex-1 p-4 max-lg:px-0 max-lg:py-2 max-lg:pb-20 lg:px-3 lg:pb-4 lg:pt-0',
          selectedChampionId ? 'champion-page-main' : 'lelariva-page-main',
        ]"
      >
        <div v-if="!selectedChampionId" class="w-full">
          <div
            class="lelariva-content-stack w-full min-w-0 overflow-hidden rounded-lg border border-primary/30 bg-surface/30 max-lg:rounded-none max-lg:border-x-0"
          >
            <div class="flex flex-wrap items-start gap-0 p-2">
              <button
                v-for="c in filteredChampions"
                :key="c.key"
                type="button"
                class="flex items-center justify-center p-0.5 leading-none transition"
                :class="
                  isChampionGridEligible(championGridId(c))
                    ? 'hover:opacity-85'
                    : 'lelariva-champion-disabled cursor-not-allowed'
                "
                :disabled="championEligibilityLoaded && !isChampionGridEligible(championGridId(c))"
                :title="championGridTitle(c)"
                @click="selectChampion(championGridId(c))"
              >
                <img
                  v-if="gameVersion && c.image?.full"
                  :src="getChampionImageUrl(gameVersion, c.image.full)"
                  :alt="c.name"
                  class="block h-8 w-8 rounded object-cover"
                  :class="
                    isChampionGridEligible(championGridId(c)) ? '' : 'brightness-125 grayscale'
                  "
                />
              </button>
            </div>
          </div>
        </div>

        <div v-else class="w-full">
          <div
            v-if="championHeaderPending && !championStats"
            class="rounded-lg border border-primary/30 bg-surface/30 p-8 text-center"
          >
            <p class="text-text/70">{{ t('statisticsPage.loading') }}</p>
          </div>
          <template v-else-if="selectedChampion">
            <div
              class="champion-content-stack w-full min-w-0 overflow-hidden rounded-lg border border-primary/30 bg-surface/30 max-lg:rounded-none max-lg:border-x-0"
            >
              <div class="champion-header-wrap border-b border-primary/25 max-lg:border-b">
                <button
                  v-if="!championHeaderBandOpen"
                  type="button"
                  class="champion-header-band-toggle flex w-full touch-manipulation items-center gap-2.5 px-3 py-2.5 text-left lg:hidden"
                  :aria-expanded="false"
                  aria-controls="lelariva-champion-header-band"
                  @click="championHeaderBandOpen = true"
                >
                  <img
                    v-if="gameVersion && selectedChampion.image?.full"
                    :src="getChampionImageUrl(gameVersion, selectedChampion.image.full)"
                    :alt="selectedChampion.name"
                    class="h-9 w-9 shrink-0 rounded-full object-cover"
                    width="36"
                    height="36"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-accent">
                      {{ selectedChampion.name }}
                    </span>
                    <span class="mt-0.5 block truncate text-[11px] tabular-nums text-text/70">
                      {{ championHeaderCollapsedSummary }}
                    </span>
                  </span>
                  <svg
                    class="h-4 w-4 shrink-0 text-text/60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div
                  id="lelariva-champion-header-band"
                  class="champion-header-band flex flex-wrap items-center gap-2 px-3 py-2 max-lg:flex-col max-lg:items-stretch lg:flex-nowrap lg:items-center lg:gap-3 lg:py-2.5"
                  :class="championHeaderBandOpen ? 'flex' : 'hidden lg:flex'"
                >
                  <button
                    type="button"
                    class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-background/40 px-2 py-1.5 text-xs transition hover:bg-primary/10 lg:mr-1"
                    @click="clearChampion"
                  >
                    <span class="iconify i-mdi:arrow-left text-base" aria-hidden="true" />
                    <span class="hidden sm:inline">Retour</span>
                  </button>
                  <div
                    class="champion-header-identity flex shrink-0 items-center gap-2 max-lg:w-full lg:flex-col lg:gap-0.5 lg:text-center"
                  >
                    <h1
                      class="order-2 min-w-0 truncate text-sm font-semibold leading-tight text-accent max-lg:flex-1 lg:order-1 lg:max-w-[5.5rem]"
                    >
                      {{ selectedChampion.name }}
                    </h1>
                    <img
                      v-if="gameVersion && selectedChampion.image?.full"
                      :src="getChampionImageUrl(gameVersion, selectedChampion.image.full)"
                      :alt="selectedChampion.name"
                      class="order-1 h-9 w-9 shrink-0 rounded-full object-cover lg:order-2 lg:h-10 lg:w-10"
                      width="40"
                      height="40"
                    />
                  </div>
                  <div
                    v-if="selectedChampionId && championRoleSummaryRows.length"
                    class="champion-header-roles text-[11px] text-text/80"
                  >
                    <span
                      v-for="role in championRoleSummaryRows"
                      :key="role.role"
                      class="champion-header-role-badge inline-flex min-w-0 flex-col gap-0.5 rounded border border-primary/30 bg-surface/40 px-1.5 py-0.5"
                      :class="
                        isRoleFilterEligible(role.role)
                          ? ''
                          : 'champion-header-role-badge-disabled opacity-45 grayscale'
                      "
                      :title="roleBadgeTitle(role)"
                    >
                      <span class="inline-flex items-center gap-1">
                        <img
                          :src="roleIconPath(role.role)"
                          :alt="roleLabel(role.role)"
                          class="h-3 w-3 shrink-0 object-contain"
                          width="12"
                          height="12"
                        />
                        <span class="truncate text-[10px] font-semibold leading-none text-text/90">
                          {{ roleLabel(role.role) }}
                        </span>
                      </span>
                      <span
                        class="flex flex-wrap gap-x-1 gap-y-0 text-[10px] tabular-nums leading-tight"
                      >
                        <span>{{ formatDonutPercent(role.pickrate) }}%</span>
                        <span class="text-text/40">·</span>
                        <span>{{ formatDonutPercent(role.winrate) }}%</span>
                        <span class="text-text/40">·</span>
                        <span>{{ formatDonutPercent(role.banrate) }}%</span>
                      </span>
                    </span>
                  </div>
                  <div
                    v-if="championDamageSplit && championDamageSplit.total > 0"
                    class="champion-header-damage-split flex min-w-0 shrink-0 flex-nowrap items-center gap-2 max-lg:w-full max-lg:flex-col max-lg:items-stretch"
                  >
                    <div
                      class="flex min-w-0 items-center gap-3 rounded bg-surface/40 px-2 py-1.5 max-lg:w-full"
                    >
                      <div
                        class="h-12 w-12 shrink-0 rounded-full"
                        :style="championDamageDonutStyle"
                        :title="t('statisticsPage.championStatsDamageSplitTitle')"
                        aria-hidden="true"
                      />
                      <div class="space-y-0.5 text-[10px] leading-tight text-text/85">
                        <div class="text-[11px] font-semibold text-text">
                          {{ t('statisticsPage.championStatsDamageSplitTitle') }}
                        </div>
                        <div
                          v-for="entry in championDamageShareLegend"
                          :key="entry.key"
                          class="flex items-center gap-1"
                        >
                          <span
                            class="inline-block h-2.5 w-2.5 rounded-sm"
                            :style="{ backgroundColor: entry.color }"
                          />
                          <span>{{ entry.label }}: {{ entry.pct.toFixed(1) }}%</span>
                        </div>
                      </div>
                    </div>
                    <div
                      v-if="championDamageTargetTotal > 0"
                      class="flex min-w-0 items-center gap-3 rounded bg-surface/40 px-2 py-1.5 max-lg:w-full"
                    >
                      <div
                        class="h-12 w-12 shrink-0 rounded-full"
                        :style="championDamageTargetDonutStyle"
                        :title="t('statisticsPage.championStatsDamageTargetSplitTitle')"
                        aria-hidden="true"
                      />
                      <div class="space-y-0.5 text-[10px] leading-tight text-text/85">
                        <div class="text-[11px] font-semibold text-text">
                          {{ t('statisticsPage.championStatsDamageTargetSplitTitle') }}
                        </div>
                        <div
                          v-for="entry in championDamageTargetLegend"
                          :key="entry.key"
                          class="flex items-center gap-1"
                        >
                          <span
                            class="inline-block h-2.5 w-2.5 rounded-sm"
                            :style="{ backgroundColor: entry.color }"
                          />
                          <span>{{ entry.label }}: {{ entry.pct.toFixed(1) }}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    class="champion-header-kpis-wrap ml-auto flex shrink-0 items-center gap-2 max-lg:ml-0 max-lg:w-full max-lg:justify-between"
                  >
                    <div
                      v-if="championStats"
                      class="champion-header-kpis flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text/85"
                    >
                      <span>
                        {{ t('statisticsPage.pickrate') }}:
                        <strong>{{ formatDonutPercent(championStats.pickrate ?? 0) }}%</strong>
                      </span>
                      <span>
                        {{ t('statisticsPage.winrate') }}:
                        <strong>{{ formatDonutPercent(championStats.winrate ?? 0) }}%</strong>
                      </span>
                      <span>
                        {{ t('statisticsPage.championStatsBanrateTitle') }}:
                        <strong>{{ formatDonutPercent(championStats.banrate ?? 0) }}%</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      class="champion-header-band-collapse shrink-0 rounded p-1 text-text/60 transition-colors hover:bg-white/5 hover:text-text lg:hidden"
                      :aria-expanded="true"
                      aria-controls="lelariva-champion-header-band"
                      :title="t('statisticsPage.championStatsHeaderHide')"
                      @click="championHeaderBandOpen = false"
                    >
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div class="champion-tab-panels mb-6 w-full min-w-0 space-y-3 max-lg:mb-4">
                <div
                  id="lelariva-tab-panel-matchups"
                  role="tabpanel"
                  class="champion-tab-panel champion-tab-panel-matchups champion-tab-panel-flush"
                >
                  <div v-if="pending" class="py-6 text-text/70">
                    {{ t('statisticsPage.loading') }}
                  </div>
                  <div v-else-if="error" class="py-2 text-sm text-red-400">{{ error }}</div>
                  <div v-else-if="!rows.length" class="py-4 text-text/70">
                    {{ t('statisticsPage.noData') }}
                  </div>
                  <div
                    v-else
                    class="champion-matchups-table-wrap champion-tab-data-surface overflow-x-auto"
                  >
                    <table class="tier-list-lolalytics w-full min-w-[1120px] text-sm">
                      <thead>
                        <tr class="border-b border-primary/30 text-left">
                          <th class="px-2 py-2 font-medium text-text">
                            <button
                              type="button"
                              class="hover:text-accent"
                              @click="setSort('rank')"
                            >
                              #{{ sortIcon('rank') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 font-medium text-text">
                            <button
                              type="button"
                              class="hover:text-accent"
                              @click="setSort('champion')"
                            >
                              {{ t('statisticsPage.champion') }}{{ sortIcon('champion') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="hover:text-accent"
                              @click="setSort('score')"
                            >
                              {{ t('statisticsPage.championMatchupColScore')
                              }}{{ sortIcon('score') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="hover:text-accent"
                              @click="setSort('winrate')"
                            >
                              {{ t('statisticsPage.winrate') }}{{ sortIcon('winrate') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="hover:text-accent"
                              @click="setSort('pickrate')"
                            >
                              {{ t('statisticsPage.championMatchupColPickrate')
                              }}{{ sortIcon('pickrate') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="hover:text-accent"
                              @click="setSort('delta1')"
                            >
                              {{ t('statisticsPage.championMatchupColDelta1')
                              }}{{ sortIcon('delta1') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="hover:text-accent"
                              @click="setSort('delta2')"
                            >
                              {{ t('statisticsPage.championMatchupColDelta2')
                              }}{{ sortIcon('delta2') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="hover:text-accent"
                              @click="setSort('laneScore')"
                            >
                              {{ t('statisticsPage.championMatchupColLaneScore')
                              }}{{ sortIcon('laneScore') }}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="(row, idx) in sortedRows"
                          :key="`${row.opponentChampionId}-${row.role}`"
                          class="border-b border-primary/15 odd:bg-white/[0.02]"
                        >
                          <td class="px-2 py-2">{{ idx + 1 }}</td>
                          <td class="px-2 py-2">
                            <div class="inline-flex items-center gap-2">
                              <img
                                v-if="
                                  gameVersion && championByKey(row.opponentChampionId)?.image?.full
                                "
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.opponentChampionId)!.image!.full
                                  )
                                "
                                :alt="championByKey(row.opponentChampionId)?.name ?? ''"
                                class="h-8 w-8 rounded border border-black/40 object-cover"
                              />
                              <span>{{
                                championByKey(row.opponentChampionId)?.name ??
                                row.opponentChampionId
                              }}</span>
                            </div>
                          </td>
                          <td class="px-2 py-2 text-right tabular-nums">
                            {{ row.matchupScore.toFixed(2) }}
                          </td>
                          <td class="px-2 py-2 text-right tabular-nums">
                            {{ row.winrate.toFixed(2) }}%
                          </td>
                          <td class="px-2 py-2 text-right tabular-nums">
                            {{ row.pickrate.toFixed(2) }}%
                          </td>
                          <td
                            class="px-2 py-2 text-right tabular-nums"
                            :class="deltaClass(row.delta1)"
                          >
                            {{ formatSigned(row.delta1) }}
                          </td>
                          <td
                            class="px-2 py-2 text-right tabular-nums"
                            :class="deltaClass(row.delta2)"
                          >
                            {{ formatSigned(row.delta2) }}
                          </td>
                          <td class="px-2 py-2 text-right tabular-nums">
                            {{ row.laneScore.toFixed(2) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <button
      v-if="!filtersOpen"
      type="button"
      :class="[
        'statistics-filters-fab fixed bottom-4 left-1/2 z-[58] -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-surface/95 px-4 py-2.5 text-sm font-semibold text-text shadow-lg backdrop-blur-sm',
        filtersFabClass,
      ]"
      :aria-label="t('statisticsPage.openFilters')"
      @click="openFilters"
    >
      {{ t('statisticsPage.filtersTitle') }}
      <span
        v-if="activeFiltersCount > 0"
        class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
      >
        {{ activeFiltersCount }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { apiUrl } from '~/utils/apiUrl'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'
import { statsRoleIconPath, statsRoleLabel } from '~/utils/statsRoleDisplay'
import {
  buildChampionRoleSummaryRows,
  canonicalChampionRoleKey,
  type ChampionRoleSummaryRow,
} from '~/utils/championRoleDistribution'

definePageMeta({ layout: 'default' })

type Row = {
  opponentChampionId: number
  role: string
  matchupScore: number
  winrate: number
  pickrate: number
  delta1?: number
  delta2?: number
  laneScore: number
}

const { locale, t } = useI18n()
const championsStore = useChampionsStore()
const versionStore = useVersionStore()
const statisticsUiStore = useStatisticsUiStore()
const { filtersOpen } = storeToRefs(statisticsUiStore)
const { effectiveFiltersSheetMode, showDesktopFiltersTrigger, filtersFabClass } =
  useStatisticsFiltersSheetMode()
const gameVersion = computed(() => versionStore.currentVersion ?? null)

const selectedChampionId = ref<number | null>(null)
const championSearch = ref('')
const filterVersion = ref('')
const filterRole = ref('')
const filterRank = ref('')
const pending = ref(false)
const exporting = ref(false)
const exportingAll = ref(false)
const error = ref<string | null>(null)
const rows = ref<Row[]>([])
const availableVersions = ref<Array<{ version: string; matchCount: number }>>([])
const globalExportVersion = ref('')
const globalExportRole = ref('')
const globalExportRank = ref('')
const exportDivisionsCombined = ref(true)
const exportMinPickrate = ref<number>(0)
const exportMinGames = ref<number>(0)
const globalExportMinPickrate = ref<number>(0)
const globalExportMinGames = ref<number>(0)
const championHeaderPending = ref(false)
const championHeaderBandOpen = ref(true)
const championStats = ref<{
  championId: number
  games: number
  wins: number
  winrate: number
  pickrate: number
  banrate?: number
  byRole?: Record<string, { games: number; wins: number; winrate: number }>
  totalGames: number
  generatedAt: string | null
} | null>(null)
const championRolesMeta = ref<{
  byRole?: Record<string, { games: number; wins: number; winrate: number; pickrate?: number }>
  banrate?: number
} | null>(null)
const championDamageSplit = ref<{
  phys: number
  magic: number
  trueDamage: number
  total: number
  champions: number
  objectives: number
  buildings: number
  neutralMonsters: number
  minions: number
} | null>(null)
const championEligibilityById = ref<Map<number, { games: number; pickrate: number }>>(new Map())
const championEligibilityLoaded = ref(false)
let championEligibilityRequestSeq = 0

type SortKey =
  | 'rank'
  | 'champion'
  | 'score'
  | 'winrate'
  | 'pickrate'
  | 'delta1'
  | 'delta2'
  | 'laneScore'
const sortKey = ref<SortKey>('score')
const sortDir = ref<'asc' | 'desc'>('desc')

const rankTiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER+']
const roleOptions = [
  { value: 'TOP', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'JUNGLE', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'MIDDLE', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'BOTTOM', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'SUPPORT', label: 'Support', icon: '/icons/roles/support.png' },
]

const activeVersion = computed({
  get: () => (selectedChampionId.value ? filterVersion.value : globalExportVersion.value),
  set: (v: string) => {
    if (selectedChampionId.value) filterVersion.value = v
    else globalExportVersion.value = v
  },
})

const activeDisplayRank = computed({
  get: () => (selectedChampionId.value ? filterRank.value : globalExportRank.value),
  set: (v: string) => {
    if (selectedChampionId.value) filterRank.value = v
    else globalExportRank.value = v
  },
})

const activeDisplayRole = computed({
  get: () => (selectedChampionId.value ? filterRole.value : globalExportRole.value),
  set: (v: string) => {
    if (selectedChampionId.value) filterRole.value = v
    else globalExportRole.value = v
  },
})

const activeExportMinPickrate = computed({
  get: () => (selectedChampionId.value ? exportMinPickrate.value : globalExportMinPickrate.value),
  set: (v: number) => {
    if (selectedChampionId.value) exportMinPickrate.value = v
    else globalExportMinPickrate.value = v
  },
})

const activeExportMinGames = computed({
  get: () => (selectedChampionId.value ? exportMinGames.value : globalExportMinGames.value),
  set: (v: number) => {
    if (selectedChampionId.value) exportMinGames.value = v
    else globalExportMinGames.value = v
  },
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (activeVersion.value) count++
  if (activeDisplayRank.value) count++
  if (activeDisplayRole.value) count++
  if (!exportDivisionsCombined.value) count++
  if (championSearch.value.trim()) count++
  if (activeExportMinPickrate.value > 0) count++
  if (activeExportMinGames.value > 0) count++
  return count
})

const filteredChampions = computed(() => {
  const q = championSearch.value.trim().toLowerCase()
  const all = championsStore.champions
  if (!q) return all
  return all.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
})

const selectedChampion = computed(
  () => championsStore.champions.find(c => Number(c.key) === selectedChampionId.value) ?? null
)

const championRoleSummaryRows = computed(() =>
  buildChampionRoleSummaryRows(
    championRolesMeta.value?.byRole ?? championStats.value?.byRole,
    championRolesMeta.value?.banrate ?? championStats.value?.banrate ?? 0
  )
)

function isRoleFilterEligible(role: string): boolean {
  if (!selectedChampionId.value) return true
  const row = championRoleSummaryRows.value.find(r => r.role === role)
  if (!row || row.games <= 0) return false
  const minPick = toSafeMinNumber(exportMinPickrate.value)
  const minGames = toSafeMinNumber(exportMinGames.value)
  return row.games >= minGames && row.pickrate >= minPick
}

const rolesWithData = computed(
  () =>
    new Set(
      championRoleSummaryRows.value.filter(r => isRoleFilterEligible(r.role)).map(r => r.role)
    )
)

const championHeaderCollapsedSummary = computed(() => {
  if (!championStats.value) return selectedChampion.value?.name ?? ''
  const pr = formatDonutPercent(championStats.value.pickrate ?? 0)
  const wr = formatDonutPercent(championStats.value.winrate ?? 0)
  const ban = formatDonutPercent(championStats.value.banrate ?? 0)
  return `${t('statisticsPage.pickrate')} ${pr}% · ${t('statisticsPage.winrate')} ${wr}% · ${t('statisticsPage.championStatsBanrateTitle')} ${ban}%`
})

const championDamageShareLegend = computed(() => {
  const d = championDamageSplit.value
  if (!d) return [] as Array<{ key: string; label: string; pct: number; color: string }>
  const toPct = (v: number) => (d.total > 0 ? (v / d.total) * 100 : 0)
  return [
    {
      key: 'phys',
      label: t('statisticsPage.championTableColPhys'),
      pct: toPct(d.phys),
      color: '#f59e0b',
    },
    {
      key: 'magic',
      label: t('statisticsPage.championTableColMagic'),
      pct: toPct(d.magic),
      color: '#3b82f6',
    },
    {
      key: 'true',
      label: t('statisticsPage.championTableColBrut'),
      pct: toPct(d.trueDamage),
      color: '#22c55e',
    },
  ]
})

const championDamageTargetTotal = computed(() => {
  const d = championDamageSplit.value
  if (!d) return 0
  return d.champions + d.objectives + d.buildings + d.neutralMonsters + d.minions
})

const championDamageTargetLegend = computed(() => {
  const d = championDamageSplit.value
  const total = championDamageTargetTotal.value
  if (!d || total <= 0)
    return [] as Array<{ key: string; label: string; pct: number; color: string }>
  const toPct = (v: number) => (v / total) * 100
  return [
    {
      key: 'champions',
      label: t('statisticsPage.championDamageTargetChampions'),
      pct: toPct(d.champions),
      color: '#ef4444',
    },
    {
      key: 'objectives',
      label: t('statisticsPage.championDamageTargetObjectives'),
      pct: toPct(d.objectives),
      color: '#8b5cf6',
    },
    {
      key: 'buildings',
      label: t('statisticsPage.championDamageTargetBuildings'),
      pct: toPct(d.buildings),
      color: '#f59e0b',
    },
    {
      key: 'neutralMonsters',
      label: t('statisticsPage.championDamageTargetNeutralMonsters'),
      pct: toPct(d.neutralMonsters),
      color: '#10b981',
    },
    {
      key: 'minions',
      label: t('statisticsPage.championDamageTargetMinions'),
      pct: toPct(d.minions),
      color: '#64748b',
    },
  ].filter(e => e.pct > 0)
})

const championDamageDonutStyle = computed(() =>
  conicDonutStyleFromLegend(championDamageShareLegend.value)
)

const championDamageTargetDonutStyle = computed(() =>
  conicDonutStyleFromLegend(championDamageTargetLegend.value)
)

const sortedRows = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...rows.value].sort((a, b) => {
    if (sortKey.value === 'rank') return dir * (a.matchupScore - b.matchupScore)
    if (sortKey.value === 'champion') {
      const an = (
        championByKey(a.opponentChampionId)?.name ?? String(a.opponentChampionId)
      ).toLowerCase()
      const bn = (
        championByKey(b.opponentChampionId)?.name ?? String(b.opponentChampionId)
      ).toLowerCase()
      return dir * an.localeCompare(bn)
    }
    if (sortKey.value === 'score') return dir * (a.matchupScore - b.matchupScore)
    if (sortKey.value === 'winrate') return dir * (a.winrate - b.winrate)
    if (sortKey.value === 'pickrate') return dir * (a.pickrate - b.pickrate)
    if (sortKey.value === 'delta1') return dir * ((a.delta1 ?? -999) - (b.delta1 ?? -999))
    if (sortKey.value === 'delta2') return dir * ((a.delta2 ?? -999) - (b.delta2 ?? -999))
    return dir * (a.laneScore - b.laneScore)
  })
})

function formatDivisionLabel(tier: string): string {
  if (tier === 'MASTER+') return 'Master+'
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}

function roleBadgeTitle(role: ChampionRoleSummaryRow): string {
  const parts = [
    roleLabel(role.role),
    `${t('statisticsPage.pickrate')} ${formatDonutPercent(role.pickrate)}%`,
    `${t('statisticsPage.winrate')} ${formatDonutPercent(role.winrate)}%`,
    `${t('statisticsPage.championStatsBanrateTitle')} ${formatDonutPercent(role.banrate)}%`,
    `${role.games} ${t('statisticsPage.games')}`,
  ]
  if (!isRoleFilterEligible(role.role)) {
    parts.push(t('statisticsPage.noData'))
  }
  return parts.join(' · ')
}

function formatDonutPercent(value: number): string {
  return Number.isFinite(value) ? Number(value).toFixed(2) : '0'
}

function roleLabel(role: string): string {
  return statsRoleLabel(role)
}

function roleIconPath(role: string): string {
  return statsRoleIconPath(role)
}

function conicDonutStyleFromLegend(
  entries: Array<{ pct: number; color: string }>
): Record<string, string> {
  if (!entries.length) {
    return {
      background:
        'radial-gradient(circle at center, rgb(var(--rgb-surface)) 58%, transparent 59%), rgb(var(--rgb-primary) / 0.25)',
    }
  }
  const parts: string[] = []
  let cursor = 0
  for (const e of entries) {
    const start = cursor
    const end = cursor + e.pct
    parts.push(`${e.color} ${start.toFixed(3)}% ${end.toFixed(3)}%`)
    cursor = end
  }
  return {
    background: `radial-gradient(circle at center, rgb(var(--rgb-surface)) 58%, transparent 59%), conic-gradient(${parts.join(',')})`,
  }
}

function buildStatsQueryParams(includeRole = true): string {
  const p = new URLSearchParams()
  if (filterVersion.value) p.set('version', filterVersion.value)
  if (filterRank.value) p.set('rankTier', filterRank.value)
  if (includeRole && filterRole.value) p.set('role', filterRole.value)
  const q = p.toString()
  return q ? `?${q}` : ''
}

function initChampionHeaderBandOpen(): void {
  if (!import.meta.client) return
  championHeaderBandOpen.value = window.matchMedia('(min-width: 1024px)').matches
}

function parseChampionDamageSplit(data: {
  games?: number
  avgPhysicalDamageToChampions?: number
  avgMagicDamageToChampions?: number
  avgTrueDamageToChampions?: number
  avgTotalDamageToChampions?: number
  avgDamageToChampions?: number
  avgDamageToObjectives?: number
  avgDamageToBuildings?: number
  avgDamageToNeutralMonsters?: number
  avgDamageToMinions?: number
}): typeof championDamageSplit.value {
  const phys = Number(data?.avgPhysicalDamageToChampions ?? 0)
  const magic = Number(data?.avgMagicDamageToChampions ?? 0)
  const trueDamage = Number(data?.avgTrueDamageToChampions ?? 0)
  const totalFromParts = phys + magic + trueDamage
  const total = totalFromParts > 0 ? totalFromParts : Number(data?.avgTotalDamageToChampions ?? 0)
  const champions = Number(data?.avgDamageToChampions ?? 0)
  const objectives = Number(data?.avgDamageToObjectives ?? 0)
  const buildings = Number(data?.avgDamageToBuildings ?? 0)
  const neutralMonsters = Number(data?.avgDamageToNeutralMonsters ?? 0)
  const minions = Number(data?.avgDamageToMinions ?? 0)
  const games = Number(data?.games ?? 0)
  if (
    games <= 0 ||
    (total <= 0 && champions + objectives + buildings + neutralMonsters + minions <= 0)
  ) {
    return null
  }
  return {
    phys: Number.isFinite(phys) ? phys : 0,
    magic: Number.isFinite(magic) ? magic : 0,
    trueDamage: Number.isFinite(trueDamage) ? trueDamage : 0,
    total: Number.isFinite(total) ? total : 0,
    champions: Number.isFinite(champions) ? champions : 0,
    objectives: Number.isFinite(objectives) ? objectives : 0,
    buildings: Number.isFinite(buildings) ? buildings : 0,
    neutralMonsters: Number.isFinite(neutralMonsters) ? neutralMonsters : 0,
    minions: Number.isFinite(minions) ? minions : 0,
  }
}

async function loadChampionRolesMeta(): Promise<void> {
  if (!selectedChampionId.value) {
    championRolesMeta.value = null
    return
  }
  try {
    const data = await $fetch<{
      byRole?: Record<string, { games: number; wins: number; winrate: number; pickrate?: number }>
      banrate?: number
    }>(apiUrl(`/api/stats/champions/${selectedChampionId.value}${buildStatsQueryParams(false)}`))
    championRolesMeta.value = data
  } catch {
    championRolesMeta.value = null
  }
}

async function loadChampionProfile(): Promise<void> {
  if (!selectedChampionId.value) {
    championStats.value = null
    championDamageSplit.value = null
    championHeaderPending.value = false
    return
  }
  const showPending = !championStats.value
  if (showPending) championHeaderPending.value = true
  try {
    const q = buildStatsQueryParams(true)
    const [stats, damage] = await Promise.all([
      $fetch(apiUrl(`/api/stats/champions/${selectedChampionId.value}${q}`)),
      $fetch(apiUrl(`/api/stats/champions/${selectedChampionId.value}/damage-split${q}`)),
    ])
    championStats.value = stats as typeof championStats.value
    championDamageSplit.value = parseChampionDamageSplit(
      damage as Parameters<typeof parseChampionDamageSplit>[0]
    )
  } catch {
    championStats.value = null
    championDamageSplit.value = null
  } finally {
    championHeaderPending.value = false
  }
}

function getLelarivaRankEmblemUrl(tier: string): string | null {
  if (tier === 'MASTER+') return getRankedEmblemUrl('MASTER')
  return getRankedEmblemUrl(tier)
}

function toggleActiveDisplayRank(tier: string): void {
  activeDisplayRank.value = activeDisplayRank.value === tier ? '' : tier
}

function clearActiveDisplayRank(): void {
  activeDisplayRank.value = ''
}

function toggleActiveDisplayRole(value: string): void {
  if (selectedChampionId.value && !isRoleFilterEligible(value)) return
  activeDisplayRole.value = activeDisplayRole.value === value ? '' : value
}

function clearActiveDisplayRole(): void {
  activeDisplayRole.value = ''
}

function ranksForExport(divisionFilter: string): string[] {
  if (exportDivisionsCombined.value) return [divisionFilter]
  return [...rankTiers]
}

function exportDivisionLabel(divisionFilter: string, split: boolean): string {
  if (split) return 'SPLIT'
  return divisionFilter || 'ALL'
}

function closeFilters(): void {
  statisticsUiStore.setFiltersOpen(false)
}

function openFilters(): void {
  statisticsUiStore.setFiltersOpen(true)
}

function toggleFiltersOpen(): void {
  if (filtersOpen.value) closeFilters()
  else openFilters()
}

function resetLelarivaFilters(): void {
  championSearch.value = ''
  const defaultVersion = defaultVersionFromStats()
  filterVersion.value = defaultVersion
  filterRole.value = ''
  filterRank.value = ''
  globalExportVersion.value = defaultVersion
  globalExportRole.value = ''
  globalExportRank.value = ''
  exportDivisionsCombined.value = true
  exportMinPickrate.value = 0
  exportMinGames.value = 0
  globalExportMinPickrate.value = 0
  globalExportMinGames.value = 0
}

function championByKey(id: number) {
  return championsStore.champions.find(c => Number(c.key) === id) ?? null
}

function selectChampion(id: number) {
  if (!Number.isFinite(id) || id <= 0) return
  if (championEligibilityLoaded.value && !isChampionGridEligible(id)) return
  if (!filterRole.value && globalExportRole.value) filterRole.value = globalExportRole.value
  selectedChampionId.value = id
  championStats.value = null
  championRolesMeta.value = null
  championDamageSplit.value = null
}

function clearChampion() {
  selectedChampionId.value = null
  rows.value = []
  error.value = null
  championStats.value = null
  championRolesMeta.value = null
  championDamageSplit.value = null
  loadChampionEligibility().catch(() => undefined)
}

function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDir.value = key === 'champion' ? 'asc' : 'desc'
}

function sortIcon(key: SortKey): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ↑' : ' ↓'
}

function formatSigned(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}

function deltaClass(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'text-text/60'
  if (v > 0.05) return 'text-emerald-300'
  if (v < -0.05) return 'text-rose-300'
  return 'text-text/70'
}

type ExportPayload = {
  columns: string[]
  rows: Array<Record<string, number | string | null>>
}

const TABLE_EXPORT_COLUMNS = [
  'rank',
  'matchup_score',
  'winrate',
  'pickrate',
  'delta_1',
  'delta_2',
  'lane_score',
] as const

function buildExportHeader(apiColumns: string[]): string[] {
  const rest = apiColumns.filter(
    c => !TABLE_EXPORT_COLUMNS.includes(c as (typeof TABLE_EXPORT_COLUMNS)[number])
  )
  return ['champion_name', 'opponent_name', ...TABLE_EXPORT_COLUMNS, ...rest]
}

function buildExportRowValues(
  champName: string,
  row: Record<string, number | string | null>,
  apiColumns: string[]
): Array<string | number | null> {
  const opponentName =
    championByKey(Number(row.opponent_champion_id ?? 0))?.name ??
    String(row.opponent_champion_id ?? '')
  const values: Array<string | number | null> = [champName, opponentName]
  for (const c of TABLE_EXPORT_COLUMNS) values.push((row[c] as string | number | null) ?? '')
  for (const c of apiColumns) {
    if (TABLE_EXPORT_COLUMNS.includes(c as (typeof TABLE_EXPORT_COLUMNS)[number])) continue
    values.push((row[c] as string | number | null) ?? '')
  }
  return values
}

function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(';')
}

function versionOptionLabel(version: string, matchCount: number): string {
  const count = Number(matchCount ?? 0)
  return `${version} - ${Number.isFinite(count) ? count : 0} games`
}

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

async function loadAvailableVersions(): Promise<void> {
  try {
    const data = await $fetch<Record<string, unknown>>(apiUrl('/api/stats/overview'))
    const list = (data?.matchesByVersion ?? data?.matches_by_version ?? []) as Array<{
      version?: string
      matchCount?: number
    }>
    availableVersions.value = Array.isArray(list)
      ? list
          .map(v => ({
            version: String(v.version ?? '').trim(),
            matchCount: Number(v.matchCount ?? 0),
          }))
          .filter(v => v.version && v.matchCount > 0)
          .sort((a, b) => compareVersionsDesc(a.version, b.version))
      : []
  } catch {
    availableVersions.value = []
  }
}

function defaultVersionFromStats(): string {
  return availableVersions.value[0]?.version ?? ''
}

function toSafeMinNumber(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function rankTierQueryParams(rank: string): Array<[string, string]> {
  const trimmed = rank.trim()
  if (!trimmed) return []
  if (trimmed === 'MASTER+') {
    return ['MASTER', 'GRANDMASTER', 'CHALLENGER'].map(t => ['rankTier', t] as [string, string])
  }
  return [['rankTier', trimmed]]
}

function tierListRoleQueryValue(role: string): string {
  return canonicalChampionRoleKey(role) ?? role.trim().toUpperCase()
}

function championGridId(c: { key: string | number }): number {
  const id = Number(c.key)
  return Number.isFinite(id) && id > 0 ? id : NaN
}

function hasActiveChampionGridFilters(): boolean {
  return Boolean(
    activeDisplayRole.value.trim() ||
    activeDisplayRank.value.trim() ||
    toSafeMinNumber(activeExportMinPickrate.value) > 0 ||
    toSafeMinNumber(activeExportMinGames.value) > 0
  )
}

async function loadChampionEligibility(): Promise<void> {
  if (selectedChampionId.value) return
  if (!hasActiveChampionGridFilters()) {
    championEligibilityById.value = new Map()
    championEligibilityLoaded.value = true
    return
  }
  const requestSeq = ++championEligibilityRequestSeq
  const roleFilter = activeDisplayRole.value.trim()
  championEligibilityById.value = new Map()
  championEligibilityLoaded.value = false
  try {
    const params = new URLSearchParams()
    const version = activeVersion.value.trim()
    if (version) params.set('version', version)
    for (const [key, value] of rankTierQueryParams(activeDisplayRank.value)) {
      params.append(key, value)
    }
    if (roleFilter) params.set('role', tierListRoleQueryValue(roleFilter))
    const query = params.toString()
    const data = await $fetch<{
      rows?: Array<{ championId: number; games: number; pickrate: number }>
    }>(apiUrl(`/api/stats/tier-list${query ? `?${query}` : ''}`))
    if (requestSeq !== championEligibilityRequestSeq) return
    const map = new Map<number, { games: number; pickrate: number }>()
    for (const row of data?.rows ?? []) {
      const id = Number(row.championId)
      if (!Number.isFinite(id) || id <= 0) continue
      map.set(id, {
        games: Number(row.games ?? 0),
        pickrate: Number(row.pickrate ?? 0) * 100,
      })
    }
    championEligibilityById.value = map
  } catch {
    if (requestSeq !== championEligibilityRequestSeq) return
    championEligibilityById.value = new Map()
  }
  if (requestSeq === championEligibilityRequestSeq) {
    championEligibilityLoaded.value = true
  }
}

function isChampionGridEligible(championId: number): boolean {
  if (!Number.isFinite(championId) || championId <= 0) return false
  if (!hasActiveChampionGridFilters()) return true
  const meta = championEligibilityById.value.get(championId)
  const minPick = toSafeMinNumber(activeExportMinPickrate.value)
  const minGames = toSafeMinNumber(activeExportMinGames.value)

  if (!championEligibilityLoaded.value) {
    if (championEligibilityById.value.size === 0) return true
    if (!meta) return false
    return meta.games >= minGames && meta.pickrate >= minPick
  }

  if (!meta) return false
  return meta.games >= minGames && meta.pickrate >= minPick
}

function championGridTitle(c: { name: string; key: string | number }): string {
  const id = championGridId(c)
  if (!hasActiveChampionGridFilters()) return c.name
  if (!championEligibilityLoaded.value) return c.name
  if (isChampionGridEligible(id)) return c.name
  const meta = championEligibilityById.value.get(id)
  if (!meta) return `${c.name} — ${t('statisticsPage.noData')}`
  return `${c.name} — ${meta.games} games · ${meta.pickrate.toFixed(2)}% pick`
}

async function fetchExportRowsForChampion(
  championId: number,
  version: string,
  role: string,
  rankTier: string
): Promise<ExportPayload> {
  const params = new URLSearchParams()
  if (version) params.set('version', version)
  if (role) params.set('role', role)
  if (rankTier) params.set('rankTier', rankTier)
  const q = params.toString()
  return await $fetch<ExportPayload>(
    apiUrl(`/api/stats/champions/${championId}/matchups-export-rows${q ? `?${q}` : ''}`)
  )
}

async function exportMatchupsExcel() {
  if (!selectedChampionId.value) return
  exporting.value = true
  try {
    const ranksToExport = ranksForExport(filterRank.value)
    let data: ExportPayload | null = null
    const exportRows: Array<Record<string, number | string | null>> = []
    for (const rank of ranksToExport) {
      const d = await fetchExportRowsForChampion(
        selectedChampionId.value,
        filterVersion.value,
        filterRole.value,
        rank
      )
      if (!data) data = d
      exportRows.push(...(d.rows ?? []))
    }
    const minPick = toSafeMinNumber(exportMinPickrate.value)
    const minGames = toSafeMinNumber(exportMinGames.value)
    const filteredRows = exportRows.filter(r => {
      const pick = Number(r.pickrate ?? 0)
      const games = Number(r.count_game ?? 0)
      return pick >= minPick && games >= minGames
    })
    const champName = selectedChampion.value?.name ?? String(selectedChampionId.value)
    const apiColumns = (data?.columns ?? []) as string[]
    const header = buildExportHeader(apiColumns)
    const lines: string[] = []
    lines.push('sep=;')
    lines.push(csvLine(header))
    for (const r of filteredRows) {
      lines.push(csvLine(buildExportRowValues(champName, r, apiColumns)))
    }
    const content = `\uFEFF${lines.join('\n')}`
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lelariva_matchups_${champName}_${filterRole.value || 'ALL'}_${exportDivisionLabel(filterRank.value, !exportDivisionsCombined.value)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

async function exportAllChampionsExcel() {
  exportingAll.value = true
  try {
    const allChampions = championsStore.champions
    const lines: string[] = []
    let header: string[] | null = null
    const minPick = toSafeMinNumber(globalExportMinPickrate.value)
    const minGames = toSafeMinNumber(globalExportMinGames.value)

    for (const champ of allChampions) {
      const cid = Number(champ.key)
      if (!Number.isFinite(cid) || cid <= 0) continue
      const ranksToExport = ranksForExport(globalExportRank.value)
      for (const rank of ranksToExport) {
        const data = await fetchExportRowsForChampion(
          cid,
          globalExportVersion.value,
          globalExportRole.value,
          rank
        )
        const champRows = data?.rows ?? []
        const apiColumns = data?.columns ?? []
        if (!header) {
          header = buildExportHeader(apiColumns)
          lines.push('sep=;')
          lines.push(csvLine(header))
        }
        for (const r of champRows) {
          const pick = Number(r.pickrate ?? 0)
          const games = Number(r.count_game ?? 0)
          if (pick < minPick || games < minGames) continue
          lines.push(csvLine(buildExportRowValues(champ.name, r, apiColumns)))
        }
      }
    }

    if (!header) {
      lines.push('sep=;')
      lines.push(csvLine(['champion_name', 'opponent_name']))
    }
    const content = `\uFEFF${lines.join('\n')}`
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lelariva_matchups_ALL_${globalExportRole.value || 'ALL'}_${exportDivisionLabel(globalExportRank.value, !exportDivisionsCombined.value)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } finally {
    exportingAll.value = false
  }
}

async function loadMatchups() {
  if (!selectedChampionId.value) return
  pending.value = true
  error.value = null
  try {
    const params = new URLSearchParams()
    if (filterVersion.value) params.set('version', filterVersion.value)
    if (filterRole.value) params.set('role', filterRole.value)
    if (filterRank.value) params.set('rankTier', filterRank.value)
    const q = params.toString()
    const data = await $fetch<{ rows: Row[] }>(
      apiUrl(
        `/api/stats/champions/${selectedChampionId.value}/matchups-extended${q ? `?${q}` : ''}`
      )
    )
    rows.value = data?.rows ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load matchups'
    rows.value = []
  } finally {
    pending.value = false
  }
}

watch([filtersOpen, effectiveFiltersSheetMode], () => {
  if (!import.meta.client) return
  const lock = effectiveFiltersSheetMode.value && filtersOpen.value
  document.body.style.overflow = lock ? 'hidden' : ''
})

onMounted(async () => {
  initChampionHeaderBandOpen()
  if (!versionStore.currentVersion) await versionStore.loadCurrentVersion()
  if (championsStore.champions.length === 0) {
    await championsStore.loadChampions(locale.value === 'fr' ? 'fr_FR' : 'en_US')
  }
  await loadAvailableVersions()
  const defaultVersion = defaultVersionFromStats()
  filterVersion.value = defaultVersion
  globalExportVersion.value = defaultVersion
  await loadChampionEligibility()
})

watch(
  [
    activeVersion,
    activeDisplayRank,
    activeDisplayRole,
    activeExportMinPickrate,
    activeExportMinGames,
    selectedChampionId,
  ],
  () => {
    if (selectedChampionId.value) return
    loadChampionEligibility().catch(() => undefined)
  }
)

watch([rolesWithData, exportMinPickrate, exportMinGames], () => {
  if (filterRole.value && !isRoleFilterEligible(filterRole.value)) filterRole.value = ''
})

watch([selectedChampionId, filterVersion, filterRank], () => {
  if (!selectedChampionId.value) return
  loadChampionRolesMeta().catch(() => undefined)
})

watch([selectedChampionId, filterVersion, filterRole, filterRank], () => {
  if (selectedChampionId.value) {
    loadChampionProfile().catch(() => undefined)
  }
  loadMatchups().catch(() => {
    // handled in loadMatchups via error state
  })
})

onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<style scoped>
.champion-role-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.champion-header-role-badge-disabled {
  pointer-events: none;
}

.lelariva-champion-disabled {
  opacity: 0.45;
  pointer-events: none;
}

.lelariva-stats.champion-stats .champion-header-roles {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
  gap: 0.25rem;
  align-items: stretch;
}

.lelariva-stats.champion-stats .champion-header-role-badge {
  width: 100%;
  min-height: 2.25rem;
  box-sizing: border-box;
}

@media (min-width: 1024px) {
  .lelariva-stats.champion-stats .champion-header-roles {
    display: flex;
    flex: 0 0 auto;
    flex-flow: row nowrap;
    align-items: stretch;
    width: auto;
    gap: 0.25rem;
  }

  .lelariva-stats.champion-stats .champion-header-role-badge {
    width: auto;
    min-width: 4.75rem;
  }

  .lelariva-stats .statistics-filters-panel .flex.min-h-0.flex-1 {
    overflow: visible;
  }
}
</style>
