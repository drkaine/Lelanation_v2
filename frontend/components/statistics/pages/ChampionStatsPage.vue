<template>
  <div
    class="champion-stats flex min-h-screen min-w-0 flex-col overflow-x-clip bg-background text-text"
  >
    <div class="w-full flex-shrink-0 px-4 pb-2 pt-4 max-lg:px-3">
      <nav class="champion-crumbs" :aria-label="t('statisticsPage.championHeroBreadcrumb')">
        <NuxtLink :to="localePath('/statistics')">{{
          t('statisticsPage.championHeroCrumbStats')
        }}</NuxtLink>
        <span aria-hidden="true">›</span>
        <NuxtLink :to="localePath('/statistics/tier-list')">{{
          t('statisticsPage.navTierList')
        }}</NuxtLink>
        <span aria-hidden="true">›</span>
        <span class="is-current">{{ championName(championId) || championId }}</span>
      </nav>
      <header v-if="championStats" class="champion-hero">
        <img
          v-if="gameVersion && championByKey(championId)"
          :src="getChampionImageUrl(gameVersion, championByKey(championId)!.image.full)"
          :alt="championName(championId) ?? ''"
          class="champion-hero-portrait"
          width="100"
          height="100"
        />
        <div class="champion-hero-id">
          <h1 class="champion-hero-name">{{ championName(championId) || championId }}</h1>
          <p v-if="championByKey(championId)?.title" class="champion-hero-sub">
            {{ championByKey(championId)?.title
            }}<template v-if="championByKey(championId)?.tags?.length">
              · {{ championByKey(championId)?.tags?.join(', ') }}</template
            >
          </p>
          <div class="champion-hero-pills">
            <span
              v-for="(role, i) in roleDistribution.slice(0, 2)"
              :key="role.role"
              class="champion-hero-pill"
              :class="i === 0 ? 'is-main' : ''"
            >
              <img :src="roleIconPath(role.role)" alt="" width="14" height="14" />
              {{
                t('statisticsPage.championHeroRoleShare', {
                  role: roleLabel(role.role),
                  pct: formatDonutPercent(role.pickrate),
                })
              }}
            </span>
          </div>
        </div>
        <dl class="champion-hero-kpis">
          <div class="champion-hero-kpi">
            <dt>{{ t('statisticsPage.championHeroWinrate') }}</dt>
            <dd :class="(championStats.winrate ?? 0) >= 50 ? 'is-up' : 'is-down'">
              {{ formatDonutPercent(championStats.winrate ?? 0) }} %
            </dd>
          </div>
          <div class="champion-hero-kpi">
            <dt>{{ t('statisticsPage.championHeroPickrate') }}</dt>
            <dd>{{ formatDonutPercent(championStats.pickrate ?? 0) }} %</dd>
          </div>
          <div class="champion-hero-kpi">
            <dt>{{ t('statisticsPage.championHeroBanrate') }}</dt>
            <dd>{{ formatDonutPercent(championStats.banrate ?? 0) }} %</dd>
          </div>
          <div class="champion-hero-kpi">
            <dt>{{ t('statisticsPage.championDashboardGamesShort') }}</dt>
            <dd>{{ Number(championStats.games ?? 0).toLocaleString(locale) }}</dd>
          </div>
        </dl>
      </header>
      <div
        class="statistics-tabs-bar champion-tabs-bar flex w-full min-w-0 items-start gap-2 overflow-x-hidden"
      >
        <div class="champion-mobile-tabs flex w-full min-w-0 flex-col gap-2">
          <nav
            ref="championTabsNavEl"
            role="tablist"
            :aria-label="t('statisticsPage.championStatsTitle')"
            class="champion-group-nav flex gap-1 overflow-x-auto"
          >
            <button
              v-for="group in CHAMPION_TAB_GROUPS"
              :key="group.id"
              type="button"
              role="tab"
              :aria-selected="activeChampionGroup === group.id"
              :class="[
                'champion-group-btn shrink-0',
                activeChampionGroup === group.id ? 'is-active' : '',
              ]"
              @click="selectChampionGroup(group.id)"
            >
              {{ t(group.label) }}
            </button>
          </nav>
          <div
            v-if="championTabsInGroup(activeChampionGroup).length > 1"
            class="flex gap-2 overflow-x-auto pb-1"
            role="group"
            :aria-label="t(activeChampionGroupLabel)"
          >
            <button
              v-for="tabId in championTabsInGroup(activeChampionGroup)"
              :key="tabId"
              type="button"
              :class="['champion-subtab shrink-0', activeChampionTab === tabId ? 'is-active' : '']"
              :aria-pressed="activeChampionTab === tabId"
              @click="activeChampionTab = tabId"
            >
              {{ t(championTabLabel(tabId)) }}
            </button>
          </div>
        </div>
      </div>
    </div>

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
          v-if="activeChampionFiltersCount > 0"
          class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
          :aria-label="`${activeChampionFiltersCount} ${t('statisticsPage.filtersTitle')}`"
        >
          {{ activeChampionFiltersCount }}
        </span>
      </button>

      <div
        v-if="filtersOpen && showFiltersBackdrop"
        class="statistics-filters-backdrop bg-black/50"
        aria-hidden="true"
        role="presentation"
        @click="closeFilters"
      />

      <aside
        v-show="filtersOpen || !effectiveFiltersSheetMode"
        :class="[
          'statistics-filters-panel flex shrink-0 flex-col overflow-hidden',
          effectiveFiltersSheetMode
            ? statisticsFiltersSheetPanelClass()
            : [
                'hidden w-0 opacity-0 transition-[width,opacity] duration-200',
                'lg:sticky lg:top-4 lg:z-0 lg:flex lg:h-auto lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overflow-x-hidden',
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
              'mx-auto mb-1 flex h-6 w-14 shrink-0 touch-manipulation items-center justify-center rounded-full lg:hidden',
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
            class="statistics-filters-reset ui-build-card-button inline-flex shrink-0 touch-manipulation items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold"
            @click="resetChampionFilters"
          >
            <span class="iconify i-mdi:refresh" aria-hidden="true" />
            Reset
          </button>
          <button
            v-if="showFiltersHeaderClose"
            type="button"
            class="statistics-filters-close ui-build-card-button hidden shrink-0 touch-manipulation items-center justify-center px-2 py-1.5 lg:inline-flex"
            :aria-label="t('statisticsPage.closeFilters')"
            @click="closeFilters"
          >
            <svg
              class="h-2 w-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 lg:flex-none">
          <div class="statistics-filters-fields flex flex-col gap-3">
            <div>
              <label
                for="champion-stats-filter-version"
                class="mb-1 block text-sm font-medium text-text"
              >
                {{ t('statisticsPage.overviewFilterByVersion') }}
              </label>
              <select
                id="champion-stats-filter-version"
                v-model="filterVersion"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              >
                <option value="">{{ t('statisticsPage.overviewVersionAll') }}</option>
                <option v-for="v in versionsFromOverview" :key="v.version" :value="v.version">
                  {{ v.version }}
                </option>
              </select>
            </div>
            <div v-if="championProgressionSelectableVersions.length">
              <label
                for="champion-stats-progression-version"
                class="mb-1 block text-sm font-medium text-text"
              >
                {{ t('statisticsPage.progressionsReferenceVersion') }}
              </label>
              <select
                id="champion-stats-progression-version"
                v-model="championProgressionFromVersionModel"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              >
                <option
                  v-for="v in championProgressionSelectableVersions"
                  :key="'champion-delta-from-' + v.version"
                  :value="v.version"
                >
                  {{ v.version }}
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
                    filterRank.length === 0
                      ? 'bg-info/20 ring-1 ring-info/60'
                      : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="t('statisticsPage.allRanks')"
                  :aria-pressed="filterRank.length === 0"
                  @mousedown.prevent
                  @click.stop="selectAllChampionDivisions()"
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    src="/data/community-dragon/ranked-emblem/Unranked.png"
                    :alt="t('statisticsPage.allRanks')"
                    class="h-3 w-3 object-contain"
                    :class="
                      filterRank.length === 0
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
                    filterRank.includes(tier)
                      ? 'bg-info/20 ring-1 ring-info/60'
                      : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="formatDivisionLabel(tier)"
                  :aria-pressed="filterRank.includes(tier)"
                  @mousedown.prevent
                  @click.stop="toggleRankFilter(tier)"
                >
                  <img
                    v-if="getRankedEmblemUrl(tier)"
                    loading="lazy"
                    decoding="async"
                    :src="getRankedEmblemUrl(tier)!"
                    :alt="tier"
                    class="h-3 w-3 object-contain"
                    :class="
                      filterRank.includes(tier)
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
              <div class="mb-1 text-sm font-medium text-text">
                {{ t('statisticsPage.filterRole') }}
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="stats-role-btn rounded p-0.5 transition-colors"
                  :class="!filterRole ? 'bg-info/20' : 'bg-black/20 hover:bg-white/10'"
                  :title="t('statisticsPage.allRoles')"
                  @click="selectAllChampionRoles()"
                >
                  <img
                    src="/icons/roles/all-role.png"
                    :alt="t('statisticsPage.allRoles')"
                    class="h-3 w-3 object-contain"
                    :class="!filterRole ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'"
                    width="12"
                    height="12"
                  />
                </button>
                <button
                  v-for="r in roles"
                  :key="r.value"
                  type="button"
                  class="stats-role-btn rounded p-0.5 transition-colors"
                  :class="[
                    filterRole === r.value ? 'bg-info/20' : 'bg-black/20 hover:bg-white/10',
                    !rolesWithData.has(r.value) ? 'champion-role-disabled' : '',
                  ]"
                  :title="r.label"
                  :disabled="!rolesWithData.has(r.value)"
                  @click="toggleChampionRoleFilter(r)"
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    :src="r.icon"
                    :alt="r.label"
                    class="h-3 w-3 object-contain"
                    :class="
                      filterRole === r.value
                        ? 'saturate-110 opacity-100'
                        : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
              </div>
            </div>
            <div v-if="activeChampionTab === 'overview'">
              <label
                for="champion-stats-chart-from-date"
                class="mb-1 block text-sm font-medium text-text"
              >
                {{ t('statisticsPage.championStatsTrendFromDate') }}
              </label>
              <input
                id="champion-stats-chart-from-date"
                v-model="trendChartFromDate"
                type="date"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              />
              <p class="mt-0.5 text-[10px] leading-snug text-text/55">
                {{ t('statisticsPage.championStatsTrendFromDateHint') }}
              </p>
            </div>
            <div v-if="activeChampionTab === 'matchups' || activeChampionTab === 'synergy'">
              <label
                for="champion-search-matchups"
                class="mb-1 block text-sm font-medium text-text"
                >{{
                  activeChampionTab === 'synergy'
                    ? t('statisticsPage.championStatsSynergySearchLabel')
                    : t('statisticsPage.championStatsMatchupSearchLabel')
                }}</label
              >
              <input
                id="champion-search-matchups"
                v-model.trim="championSearchQueryPlaceholder"
                type="text"
                :placeholder="
                  activeChampionTab === 'synergy'
                    ? t('statisticsPage.championStatsSynergySearchPlaceholder')
                    : t('statisticsPage.championStatsMatchupSearchPlaceholder')
                "
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text placeholder:text-text/50"
              />
            </div>
            <div v-if="activeChampionTab === 'matchups' || activeChampionTab === 'synergy'">
              <label
                for="champion-matchup-profile-filter"
                class="mb-1 block text-sm font-medium text-text"
                >{{
                  activeChampionTab === 'synergy'
                    ? t('statisticsPage.championSynergyFilterLaneProfile')
                    : t('statisticsPage.championMatchupFilterLaneProfile')
                }}</label
              >
              <select
                id="champion-matchup-profile-filter"
                v-model="matchupLaneProfileFilter"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              >
                <option value="ALL">{{ t('statisticsPage.overviewDivisionAll') }}</option>
                <option value="balanced">
                  {{ t('statisticsPage.championMatchupDominanceBalanced') }}
                </option>
                <option
                  v-for="opt in matchupLaneProfileOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div v-if="activeChampionTab === 'matchups' || activeChampionTab === 'synergy'">
              <label
                for="champion-matchup-otp-filter"
                class="mb-1 block text-sm font-medium text-text"
                >{{
                  activeChampionTab === 'synergy'
                    ? t('statisticsPage.championSynergyFilterOtpMode')
                    : t('statisticsPage.championMatchupFilterOtpMode')
                }}</label
              >
              <select
                id="champion-matchup-otp-filter"
                v-model="matchupOtpMode"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              >
                <option value="non">
                  {{
                    activeChampionTab === 'synergy'
                      ? t('statisticsPage.championSynergyFilterOtpOff')
                      : t('statisticsPage.championMatchupFilterOtpOff')
                  }}
                </option>
                <option value="oui">
                  {{
                    activeChampionTab === 'synergy'
                      ? t('statisticsPage.championSynergyFilterOtpOn')
                      : t('statisticsPage.championMatchupFilterOtpOn')
                  }}
                </option>
                <option value="solo">
                  {{
                    activeChampionTab === 'synergy'
                      ? t('statisticsPage.championSynergyFilterOtpOnly')
                      : t('statisticsPage.championMatchupFilterOtpOnly')
                  }}
                </option>
              </select>
            </div>
            <div v-if="activeChampionTab === 'spells'">
              <label
                for="champion-summoner-mode-filter"
                class="mb-1 block text-sm font-medium text-text"
                >{{ t('statisticsPage.overviewDetailSummonerSpells') }}</label
              >
              <div
                id="champion-summoner-mode-filter"
                class="inline-flex w-full overflow-hidden rounded border border-primary/40 bg-background"
              >
                <button
                  type="button"
                  class="flex-1 px-2 py-1 text-xs font-medium transition-colors"
                  :class="
                    championSpellsModeFilter === 'solo'
                      ? 'bg-info/20 text-primary-light'
                      : 'text-text/75 hover:bg-white/10'
                  "
                  @click="championSpellsModeFilter = 'solo'"
                >
                  {{ t('statisticsPage.spellsModeSolo') }}
                </button>
                <button
                  type="button"
                  class="flex-1 border-l border-primary/30 px-2 py-1 text-xs font-medium transition-colors"
                  :class="
                    championSpellsModeFilter === 'pair'
                      ? 'bg-info/20 text-primary-light'
                      : 'text-text/75 hover:bg-white/10'
                  "
                  @click="championSpellsModeFilter = 'pair'"
                >
                  {{ t('statisticsPage.spellsModePair') }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="shrink-0 border-t border-primary/25 p-3 lg:hidden">
          <button type="button" class="statistics-filters-mobile-close" @click="closeFilters">
            {{ t('statisticsPage.closeFilters') }}
          </button>
        </div>
      </aside>

      <div
        class="champion-page-main min-w-0 flex-1 p-4 max-lg:px-0 max-lg:py-2 max-lg:pb-20 lg:px-3 lg:pb-4 lg:pt-0"
      >
        <div class="w-full">
          <ChampionStatsSeoSummary
            v-if="championStats && resolvedChampionName"
            :champion-name="resolvedChampionName"
            :season="lolSeasonLabel"
            :patch="resolvedGamePatch"
            :stats="championStats"
          />
          <!-- Loading / error -->
          <div
            v-if="pending && !championStats"
            class="ui-build-card-surface rounded-xl p-8 text-center"
          >
            <p class="text-text/70">{{ t('statisticsPage.loading') }}</p>
          </div>
          <div v-else-if="error" class="rounded-lg border border-red-500/30 bg-surface/30 p-6">
            <p class="text-error">{{ error }}</p>
          </div>
          <template v-else-if="championStats">
            <div
              class="champion-content-stack ui-build-card-surface w-full min-w-0 overflow-hidden rounded-xl max-lg:rounded-none max-lg:border-x-0"
            >
              <ChampionOverviewCards
                v-if="activeChampionTab === 'overview'"
                :main-role="ovMainRoleLabel"
                :skill="ovSkill"
                :spells="ovSpells"
                :items="ovItems"
                :roles="ovRoles"
                :damage="championDamageSplit"
                :profile="ovProfile"
                :matchups-best="ovMatchups.best"
                :matchups-worst="ovMatchups.worst"
                :pending="ovPending"
                class="p-1 max-lg:px-3 max-lg:py-3"
                @go-tab="onOverviewGoTab"
              >
                <template #evolution>
                  <section
                    v-if="activeChampionTab === 'overview'"
                    id="champion-tab-panel-overview"
                    role="tabpanel"
                    class="champion-tab-panel p-1 max-lg:px-3 max-lg:py-3"
                  >
                    <div class="ov-evo-head">
                      <h2>{{ t('statisticsPage.ovEvolutionTitle') }}</h2>
                      <div class="ov-evo-controls">
                        <div class="ov-seg" role="group">
                          <button
                            type="button"
                            :class="{ 'is-on': trendFocusMetric === 'all' }"
                            @click="trendFocusMetric = 'all'"
                          >
                            {{ t('statisticsPage.ovEvoMetric_all') }}
                          </button>
                          <button
                            v-for="m in trendMetricDefs"
                            :key="m.id"
                            type="button"
                            :class="{ 'is-on': trendFocusMetric === m.id }"
                            @click="trendFocusMetric = m.id"
                          >
                            {{ t(`statisticsPage.ovEvoMetric_${m.id}`) }}
                          </button>
                        </div>
                        <div class="ov-seg" role="group">
                          <button
                            type="button"
                            :class="{
                              'is-on': trendRangeMode === '7d' && trendGranularity !== 'patch',
                            }"
                            @click="setTrendPeriod('7d')"
                          >
                            {{ t('statisticsPage.ovEvo7d') }}
                          </button>
                          <button
                            type="button"
                            :class="{
                              'is-on': trendRangeMode === '14d' && trendGranularity !== 'patch',
                            }"
                            @click="setTrendPeriod('14d')"
                          >
                            {{ t('statisticsPage.ovEvo14d') }}
                          </button>
                          <button
                            type="button"
                            :class="{ 'is-on': trendGranularity === 'patch' }"
                            @click="setTrendPeriod('patch')"
                          >
                            {{ t('statisticsPage.ovEvoByPatch') }}
                          </button>
                        </div>
                        <div
                          class="ov-seg"
                          role="group"
                          :aria-label="t('statisticsPage.balanceLevelsGroup')"
                        >
                          <button
                            v-for="lv in trendLevelOptions"
                            :key="lv.id"
                            type="button"
                            :class="{ 'is-on': trendLevel === lv.id }"
                            :aria-pressed="trendLevel === lv.id"
                            @click="trendLevel = lv.id"
                          >
                            {{ lv.label }}
                          </button>
                        </div>
                        <label class="ov-evo-div">
                          <input v-model="trendShowDivisions" type="checkbox" />
                          {{ t('statisticsPage.ovEvoByDivision') }}
                        </label>
                      </div>
                    </div>
                    <div v-if="trendPending" class="py-4 text-text/70">
                      {{ t('statisticsPage.loading') }}
                    </div>
                    <template v-else>
                      <p v-if="trendError" class="py-2 text-sm text-error">{{ trendError }}</p>
                      <div
                        v-if="trendFocusCards.length"
                        class="champion-trend-charts-grid grid w-full min-w-0 grid-cols-1 gap-4"
                        :class="{ 'lg:grid-cols-2': trendFocusCards.length > 1 }"
                      >
                        <article
                          v-for="card in trendFocusCards"
                          :key="card.metricId"
                          class="champion-trend-chart-card w-full min-w-0 max-w-full rounded border border-primary/20 bg-background/30 p-3"
                        >
                          <h3 class="mb-2 text-sm font-medium text-text">{{ card.title }}</h3>
                          <div class="champion-trend-chart-wrap max-w-full overflow-hidden">
                            <svg
                              :viewBox="`0 0 ${TREND_CHART_W} ${TREND_CHART_H}`"
                              class="champion-trend-chart-svg block h-auto w-full max-w-full"
                              preserveAspectRatio="xMidYMid meet"
                              aria-hidden="true"
                            >
                              <defs>
                                <linearGradient
                                  :id="`trend-bg-${card.metricId}`"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop offset="0%" stop-color="rgb(71 85 105 / 0.28)" />
                                  <stop offset="100%" stop-color="rgb(15 23 42 / 0.08)" />
                                </linearGradient>
                              </defs>
                              <rect
                                :x="TREND_CHART_PAD.left"
                                :y="TREND_CHART_PAD.top"
                                :width="TREND_PLOT_W"
                                :height="TREND_PLOT_H"
                                :fill="`url(#trend-bg-${card.metricId})`"
                              />
                              <g
                                v-for="tick in card.yTicks"
                                :key="`${card.metricId}-y-${tick.value}`"
                              >
                                <line
                                  :x1="TREND_CHART_PAD.left"
                                  :y1="tick.y"
                                  :x2="TREND_CHART_PAD.left + TREND_PLOT_W"
                                  :y2="tick.y"
                                  class="text-text/25"
                                  stroke="currentColor"
                                  stroke-width="1"
                                />
                                <text
                                  :x="TREND_CHART_PAD.left - 6"
                                  :y="tick.y + 4"
                                  text-anchor="end"
                                  class="fill-text/70 text-[10px]"
                                >
                                  {{ tick.label }}
                                </text>
                              </g>
                              <line
                                :x1="TREND_CHART_PAD.left"
                                :y1="TREND_CHART_PAD.top + TREND_PLOT_H"
                                :x2="TREND_CHART_PAD.left + TREND_PLOT_W"
                                :y2="TREND_CHART_PAD.top + TREND_PLOT_H"
                                class="text-text/35"
                                stroke="currentColor"
                                stroke-width="1"
                              />
                              <line
                                :x1="TREND_CHART_PAD.left"
                                :y1="TREND_CHART_PAD.top"
                                :x2="TREND_CHART_PAD.left"
                                :y2="TREND_CHART_PAD.top + TREND_PLOT_H"
                                class="text-text/35"
                                stroke="currentColor"
                                stroke-width="1"
                              />
                              <path
                                v-for="serie in card.series"
                                v-show="isLegendTierVisible(serie.tier)"
                                :key="`${card.metricId}-${serie.tier}`"
                                :d="serie.path"
                                fill="none"
                                :stroke="serie.color"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                              <g
                                v-for="serie in card.series"
                                v-show="isLegendTierVisible(serie.tier)"
                                :key="`${card.metricId}-${serie.tier}-points`"
                              >
                                <circle
                                  v-for="pt in serie.points"
                                  :key="`${card.metricId}-${serie.tier}-${pt.idx}`"
                                  :cx="pt.x"
                                  :cy="pt.y"
                                  r="3"
                                  :fill="serie.color"
                                  class="cursor-pointer"
                                  @mouseenter="
                                    onTrendPointHover($event, card.metricId, serie.tier, pt)
                                  "
                                  @mousemove="
                                    onTrendPointHover($event, card.metricId, serie.tier, pt)
                                  "
                                  @mouseleave="trendTooltip = null"
                                />
                              </g>
                              <g
                                v-for="tick in card.xTicks"
                                :key="`${card.metricId}-x-${tick.index}`"
                              >
                                <line
                                  :x1="tick.x"
                                  :y1="TREND_CHART_PAD.top + TREND_PLOT_H"
                                  :x2="tick.x"
                                  :y2="TREND_CHART_PAD.top + TREND_PLOT_H + 4"
                                  class="text-text/40"
                                  stroke="currentColor"
                                  stroke-width="1"
                                />
                                <text
                                  :x="tick.x"
                                  :y="TREND_CHART_H - 6"
                                  text-anchor="middle"
                                  class="fill-text/70 text-[10px]"
                                >
                                  {{ tick.label }}
                                </text>
                              </g>
                            </svg>
                          </div>
                          <div
                            v-if="trendTooltip && trendTooltip.metricId === card.metricId"
                            class="statistics-chart-tooltip pointer-events-none fixed z-[90]"
                            :style="{
                              left: `${trendTooltip.mouseX}px`,
                              top: `${trendTooltip.mouseY}px`,
                              transform: 'translate(-50%, -110%)',
                            }"
                          >
                            <strong>{{ trendTooltip.tier }}</strong> ·
                            {{ trendTooltip.bucketLabel }} ·
                            {{ formatTrendValue(card.metricId, trendTooltip.value) }}
                          </div>
                          <div
                            class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text/80"
                          >
                            <button
                              v-for="serie in card.series"
                              :key="`${card.metricId}-legend-${serie.tier}`"
                              type="button"
                              class="inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-primary/20"
                              :class="
                                isLegendTierVisible(serie.tier)
                                  ? 'text-text/85'
                                  : 'text-text/45 line-through opacity-70'
                              "
                              :title="t('statisticsPage.championStatsLegendToggleDivision')"
                              @click="toggleLegendTierVisibility(serie.tier)"
                            >
                              <span
                                class="inline-block h-2.5 w-2.5 rounded-full"
                                :style="{ backgroundColor: serie.color }"
                              />
                              {{ serie.tier }}
                            </button>
                          </div>
                        </article>
                      </div>
                      <p v-else class="py-2 text-text/70">{{ t('statisticsPage.noData') }}</p>
                    </template>
                  </section>
                </template>
              </ChampionOverviewCards>
              <ChampionJunglePaths
                v-if="activeChampionTab === 'overview' && showJunglePaths"
                :champion-id="championId"
                :version="filterVersion || gameVersion || ''"
              />
            </div>
            <div class="champion-tab-panels mb-6 w-full min-w-0 space-y-3 max-lg:mb-4">
              <details
                v-if="activeChampionTab === 'matchups' || activeChampionTab === 'synergy'"
                class="mu-legend"
                :title="
                  activeChampionTab === 'synergy'
                    ? t('statisticsPage.championSynergyTooltipLaneProfile')
                    : t('statisticsPage.championMatchupTooltipLaneProfile')
                "
              >
                <summary>{{ t('statisticsPage.championMatchupLaneProfileLegendTitle') }}</summary>
                <div class="mu-legend-body space-y-2">
                  <p class="leading-snug text-text/60">
                    {{ t('statisticsPage.championMatchupLaneProfileLegendHint') }}
                  </p>
                  <p v-if="activeChampionTab === 'synergy'" class="leading-snug text-text/55">
                    {{ t('statisticsPage.championSynergyProfileWarningsHint') }}
                  </p>
                  <div class="space-y-1">
                    <div class="inline-flex items-center gap-1 font-semibold text-info">
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-info" aria-hidden="true" />
                      {{
                        activeChampionTab === 'synergy'
                          ? t('statisticsPage.championSynergyProfileStrengths')
                          : t('statisticsPage.championMatchupProfileChampion')
                      }}
                    </div>
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="lvl in laneProfileStrengthLegendLevels"
                        :key="'leg-s-' + lvl"
                        :class="laneProfileSignalChipClass(lvl, 'strength')"
                        class="pointer-events-none"
                      >
                        {{ t(`statisticsPage.championMatchupSignalLevelShort.${lvl}`) }}
                      </span>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="inline-flex items-center gap-1 font-semibold text-error">
                      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-error" aria-hidden="true" />
                      {{
                        activeChampionTab === 'synergy'
                          ? t('statisticsPage.championSynergyProfileWarnings')
                          : t('statisticsPage.championMatchupProfileOpponent')
                      }}
                    </div>
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="lvl in laneProfileWeaknessLegendLevels"
                        :key="'leg-w-' + lvl"
                        :class="laneProfileSignalChipClass(lvl, 'weakness')"
                        class="pointer-events-none"
                      >
                        {{ t(`statisticsPage.championMatchupSignalLevelShort.${lvl}`) }}
                      </span>
                    </div>
                  </div>
                  <div class="space-y-1 border-t border-primary/15 pt-2">
                    <div class="font-semibold text-text/80">
                      {{ t('statisticsPage.championMatchupLaneProfileDimensionsTitle') }}
                    </div>
                    <ul class="space-y-1 leading-snug">
                      <li
                        v-for="key in MATCHUP_LANE_PROFILE_DIMENSION_KEYS"
                        :key="'dim-leg-' + key"
                        class="text-text/65"
                      >
                        <span class="font-semibold text-text/85">{{
                          t(`statisticsPage.championMatchupDominanceShort.${key}`)
                        }}</span>
                        <span class="text-text/55"> — </span>
                        <span>{{ t(`statisticsPage.championMatchupDominance.${key}`) }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </details>
              <div
                v-if="activeChampionTab === 'matchups'"
                id="champion-tab-panel-matchups"
                role="tabpanel"
                class="champion-tab-panel champion-tab-panel-matchups champion-tab-panel-flush"
              >
                <div v-if="matchupsExtPending" class="py-6 text-text/70">
                  {{ t('statisticsPage.loading') }}
                </div>
                <div v-else-if="matchupsExtError" class="py-2 text-sm text-error">
                  {{ matchupsExtError }}
                </div>
                <div v-else-if="!filteredMatchupsExt.length" class="py-4 text-text/70">
                  <p>{{ t('statisticsPage.matchupsEmpty') }}</p>
                  <button
                    v-if="matchupsFallback"
                    type="button"
                    class="mt-2 rounded border border-accent/50 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/10"
                    @click="filterVersion = matchupsFallback"
                  >
                    {{ t('statisticsPage.matchupsEmptySeeVersion', { version: matchupsFallback }) }}
                  </button>
                </div>
                <div v-else class="space-y-1.5">
                  <ChampionMatchupHighlights
                    mode="matchups"
                    :rows="matchupHlRows"
                    :min-games="LOW_SAMPLE_MIN_GAMES"
                  />
                  <StatisticsMobileSortBar
                    id="champion-matchups-mobile-sort"
                    v-model:column="matchupMobileSortColumn"
                    v-model:direction="matchupSortDir"
                    :options="matchupMobileSortOptions"
                    :asc-default-columns="['champion', 'role']"
                  />
                  <StatisticsTabPagination
                    v-model:page="matchupPage"
                    v-model:page-size="matchupPageSize"
                    :total-pages="totalMatchupPages"
                    :total-count="filteredMatchupsExt.length"
                    :page-size-options="matchupPageSizeOptions"
                  />
                  <div
                    class="statistics-champion-matchup-mobile-list statistics-tier-list-mobile-list w-full space-y-1 md:hidden"
                  >
                    <template v-for="(row, idx) in paginatedMatchupsExt" :key="matchupCardKey(row)">
                      <ChampionMatchupMobileCard
                        :row="row"
                        :display-rank="(matchupPage - 1) * matchupPageSize + idx + 1"
                        :expanded="expandedMatchupKeys.has(matchupCardKey(row))"
                        :selected="isMatchupDetailActive(row)"
                        :show-role="!filterRole"
                        :portrait-src="
                          gameVersion && championByKey(row.opponentChampionId)?.image?.full
                            ? getChampionImageUrl(
                                gameVersion,
                                championByKey(row.opponentChampionId)!.image!.full
                              )
                            : null
                        "
                        :champion-name="
                          championName(row.opponentChampionId) ?? String(row.opponentChampionId)
                        "
                        :role-label="roleLabel(row.role)"
                        :role-icon-src="roleIconPath(row.role)"
                        :reference-version="matchupsExtData?.referenceVersion ?? null"
                        @toggle="toggleMatchupCard(row)"
                      />
                      <ChampionMatchupDetailPanel
                        v-if="isMatchupDetailActive(row)"
                        :id="'matchup-detail-' + matchupCardKey(row)"
                        v-model:tab="matchupDetailTab"
                        :row="row"
                        :champion-label="
                          championName(row.opponentChampionId) ?? String(row.opponentChampionId)
                        "
                        :role-label="roleLabel(row.role)"
                        class="mb-1"
                      />
                    </template>
                  </div>
                  <div
                    class="champion-matchups-table-wrap champion-tab-data-surface hidden overflow-x-auto md:block"
                  >
                    <table class="tier-list-lolalytics w-full min-w-[1120px] text-sm">
                      <thead>
                        <tr class="border-b border-primary/30 text-left">
                          <th class="px-2 py-2 font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              @click.stop="setMatchupSort('rank')"
                            >
                              {{ t('statisticsPage.tierListRank') }}{{ matchupSortIcon('rank') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              @click.stop="setMatchupSort('champion')"
                            >
                              {{ t('statisticsPage.champion') }}{{ matchupSortIcon('champion') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              :title="t('statisticsPage.championMatchupTooltipScore')"
                              @click.stop="setMatchupSort('score')"
                            >
                              {{ t('statisticsPage.championMatchupColScore')
                              }}{{ matchupSortIcon('score') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              :title="
                                t('statisticsPage.tierListPatchDeltaTitle', {
                                  ref:
                                    matchupsExtData?.referenceVersion ??
                                    t('statisticsPage.overviewVersionAll'),
                                })
                              "
                              @click.stop="setMatchupSort('scoreDelta')"
                            >
                              {{ t('statisticsPage.championMatchupColScoreDelta')
                              }}{{ matchupSortIcon('scoreDelta') }}
                            </button>
                          </th>
                          <th v-if="!filterRole" class="px-2 py-2 text-left font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              @click.stop="setMatchupSort('role')"
                            >
                              {{ t('statisticsPage.filterRole') }}{{ matchupSortIcon('role') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              :title="t('statisticsPage.championMatchupTooltipWinrate')"
                              @click.stop="setMatchupSort('winrate')"
                            >
                              {{ t('statisticsPage.winrate') }}{{ matchupSortIcon('winrate') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              :title="t('statisticsPage.championMatchupTooltipPickrate')"
                              @click.stop="setMatchupSort('pickrate')"
                            >
                              {{ t('statisticsPage.championMatchupColPickrate')
                              }}{{ matchupSortIcon('pickrate') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              :title="t('statisticsPage.championMatchupDelta1Formula')"
                              @click.stop="setMatchupSort('delta1')"
                            >
                              {{ t('statisticsPage.championMatchupColDelta1')
                              }}{{ matchupSortIcon('delta1') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              :title="t('statisticsPage.championMatchupDelta2Formula')"
                              @click.stop="setMatchupSort('delta2')"
                            >
                              {{ t('statisticsPage.championMatchupColDelta2')
                              }}{{ matchupSortIcon('delta2') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-right font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              :title="t('statisticsPage.championMatchupTooltipLaneScore')"
                              @click.stop="setMatchupSort('laneScore')"
                            >
                              {{ t('statisticsPage.championMatchupColLaneScore')
                              }}{{ matchupSortIcon('laneScore') }}
                            </button>
                          </th>
                          <th class="px-2 py-2 text-left font-medium text-text">
                            <button
                              type="button"
                              class="inline-flex items-center gap-1 hover:text-accent"
                              :title="t('statisticsPage.championMatchupTooltipLaneProfile')"
                              @click.stop="setMatchupSort('dominance')"
                            >
                              {{ t('statisticsPage.championMatchupColDominance')
                              }}{{ matchupSortIcon('dominance') }}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <template
                          v-for="(row, idx) in paginatedMatchupsExt"
                          :key="matchupCardKey(row)"
                        >
                          <tr
                            class="cursor-pointer border-b border-primary/15 odd:bg-white/[0.02] hover:bg-white/[0.04]"
                            :class="
                              isMatchupDetailActive(row)
                                ? 'bg-primary/10 ring-1 ring-inset ring-primary/35'
                                : ''
                            "
                            @click="openMatchupDetail(row)"
                          >
                            <td class="px-2 py-2 tabular-nums text-text/90">
                              {{ (matchupPage - 1) * matchupPageSize + idx + 1 }}
                            </td>
                            <td class="px-2 py-2">
                              <span class="inline-flex min-w-0 items-center gap-2">
                                <img
                                  v-if="
                                    gameVersion &&
                                    championByKey(row.opponentChampionId)?.image?.full
                                  "
                                  loading="lazy"
                                  decoding="async"
                                  :src="
                                    getChampionImageUrl(
                                      gameVersion,
                                      championByKey(row.opponentChampionId)!.image!.full
                                    )
                                  "
                                  :alt="championName(row.opponentChampionId) ?? ''"
                                  class="h-9 w-9 shrink-0 rounded border border-black/40 object-cover"
                                  width="36"
                                  height="36"
                                />
                                <span class="min-w-0 truncate font-medium text-text/90">{{
                                  championName(row.opponentChampionId) ?? row.opponentChampionId
                                }}</span>
                              </span>
                            </td>
                            <td class="px-2 py-2 text-right tabular-nums text-text/90">
                              {{ row.matchupScore.toFixed(2) }}
                            </td>
                            <td class="px-2 py-2 text-right tabular-nums">
                              <span :class="matchupDeltaClass(row.matchupScoreDeltaVsReference)">
                                {{ formatSignedDelta(row.matchupScoreDeltaVsReference) }}
                              </span>
                            </td>
                            <td v-if="!filterRole" class="px-2 py-2 text-text/85">
                              <span class="inline-flex items-center gap-1">
                                <img
                                  v-if="roleIconPath(row.role)"
                                  :src="roleIconPath(row.role)"
                                  :alt="roleLabel(row.role)"
                                  class="h-4 w-4 object-contain"
                                  width="16"
                                  height="16"
                                />
                                {{ roleLabel(row.role) }}
                              </span>
                            </td>
                            <td class="px-2 py-2 text-right tabular-nums">
                              <div>{{ row.winrate.toFixed(2) }}%</div>
                              <div
                                class="text-[11px]"
                                :class="matchupDeltaClass(row.winrateDeltaVsReference)"
                              >
                                {{ formatSignedDelta(row.winrateDeltaVsReference) }}
                              </div>
                            </td>
                            <td class="px-2 py-2 text-right tabular-nums text-text/85">
                              <div>{{ row.pickrate.toFixed(2) }}%</div>
                              <div
                                class="text-[11px]"
                                :class="matchupDeltaClass(row.pickrateDeltaVsReference)"
                              >
                                {{ formatSignedDelta(row.pickrateDeltaVsReference) }}
                              </div>
                            </td>
                            <td
                              class="px-2 py-2 text-right tabular-nums text-text/85"
                              :title="t('statisticsPage.championMatchupDelta1Formula')"
                            >
                              <span :class="matchupDeltaClass(row.delta1)">
                                {{ formatSignedDelta(row.delta1) }}
                              </span>
                            </td>
                            <td
                              class="px-2 py-2 text-right tabular-nums text-text/85"
                              :title="t('statisticsPage.championMatchupDelta2Formula')"
                            >
                              <span :class="matchupDeltaClass(row.delta2)">
                                {{ formatSignedDelta(row.delta2) }}
                              </span>
                            </td>
                            <td class="px-2 py-2 text-right tabular-nums text-text/85">
                              <div>{{ row.laneScore.toFixed(2) }}</div>
                              <div
                                class="text-[11px]"
                                :class="matchupDeltaClass(row.laneScoreDeltaVsReference)"
                              >
                                {{ formatSignedDelta(row.laneScoreDeltaVsReference) }}
                              </div>
                            </td>
                            <td
                              class="max-w-md px-2 py-2 align-top"
                              :title="
                                dominanceTooltip(
                                  row.dominanceKeys,
                                  row.weaknessKeys,
                                  row.laneProfileByKey
                                )
                              "
                            >
                              <div v-if="row.dominanceKeys?.length" class="mb-1.5">
                                <div
                                  class="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-info"
                                >
                                  <span
                                    class="h-1.5 w-1.5 shrink-0 rounded-full bg-info"
                                    aria-hidden="true"
                                  />
                                  {{ t('statisticsPage.championMatchupProfileChampion') }}
                                </div>
                                <div class="flex flex-wrap gap-1">
                                  <span
                                    v-for="k in row.dominanceKeys"
                                    :key="'dom-' + k"
                                    :class="
                                      laneProfileSignalChipClass(
                                        row.laneProfileByKey?.[k] ?? 'smallAdvantage',
                                        'strength'
                                      )
                                    "
                                    :title="
                                      laneProfileChipTitle(k, row.laneProfileByKey?.[k], 'strength')
                                    "
                                  >
                                    <span class="font-semibold">{{
                                      t(`statisticsPage.championMatchupDominanceShort.${k}`)
                                    }}</span>
                                    <span class="opacity-70" aria-hidden="true">·</span>
                                    <span class="opacity-90">{{
                                      t(
                                        `statisticsPage.championMatchupSignalLevelShort.${row.laneProfileByKey?.[k] ?? 'smallAdvantage'}`
                                      )
                                    }}</span>
                                  </span>
                                </div>
                              </div>
                              <div v-if="row.weaknessKeys?.length">
                                <div
                                  class="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-error"
                                >
                                  <span
                                    class="h-1.5 w-1.5 shrink-0 rounded-full bg-error"
                                    aria-hidden="true"
                                  />
                                  {{ t('statisticsPage.championMatchupProfileOpponent') }}
                                </div>
                                <div class="flex flex-wrap gap-1">
                                  <span
                                    v-for="k in row.weaknessKeys"
                                    :key="'weak-' + k"
                                    :class="
                                      laneProfileSignalChipClass(
                                        row.laneProfileByKey?.[k] ?? 'smallDisadvantage',
                                        'weakness'
                                      )
                                    "
                                    :title="
                                      laneProfileChipTitle(k, row.laneProfileByKey?.[k], 'weakness')
                                    "
                                  >
                                    <span class="font-semibold">{{
                                      t(`statisticsPage.championMatchupDominanceShort.${k}`)
                                    }}</span>
                                    <span class="opacity-70" aria-hidden="true">·</span>
                                    <span class="opacity-90">{{
                                      t(
                                        `statisticsPage.championMatchupSignalLevelShort.${row.laneProfileByKey?.[k] ?? 'smallDisadvantage'}`
                                      )
                                    }}</span>
                                  </span>
                                </div>
                              </div>
                              <div
                                v-if="!row.dominanceKeys?.length && !row.weaknessKeys?.length"
                                class="inline-flex items-center gap-1 rounded border border-primary/25 bg-white/[0.03] px-2 py-1 text-[11px] text-text/65"
                              >
                                {{ t('statisticsPage.championMatchupDominanceBalancedShort') }}
                              </div>
                            </td>
                          </tr>
                          <tr v-if="isMatchupDetailActive(row)" class="border-b border-primary/15">
                            <td :colspan="matchupTableColspan" class="bg-black/15 px-2 py-3">
                              <ChampionMatchupDetailPanel
                                :id="'matchup-detail-' + matchupCardKey(row)"
                                v-model:tab="matchupDetailTab"
                                :row="row"
                                :champion-label="
                                  championName(row.opponentChampionId) ??
                                  String(row.opponentChampionId)
                                "
                                :role-label="roleLabel(row.role)"
                              />
                            </td>
                          </tr>
                        </template>
                      </tbody>
                    </table>
                  </div>
                  <StatisticsTabPagination
                    v-model:page="matchupPage"
                    v-model:page-size="matchupPageSize"
                    :total-pages="totalMatchupPages"
                    :total-count="filteredMatchupsExt.length"
                    :page-size-options="matchupPageSizeOptions"
                  />
                </div>
              </div>
              <div
                v-if="activeChampionTab === 'synergy'"
                id="champion-tab-panel-synergy"
                role="tabpanel"
                class="champion-tab-panel champion-tab-panel-synergy champion-tab-panel-flush"
              >
                <ChampionMatchupHighlights
                  v-if="!synergyExtPending && !synergyExtError"
                  mode="synergy"
                  :rows="synergyHlRows"
                  :min-games="LOW_SAMPLE_MIN_GAMES"
                />
                <ChampionSynergyTab
                  :pending="synergyExtPending"
                  :error="synergyExtError"
                  :rows="synergyExtData?.rows ?? []"
                  :reference-version="synergyExtData?.referenceVersion ?? null"
                  :game-version="gameVersion || ''"
                  :filter-role="filterRole"
                  :search-query="championSearchQueryPlaceholder"
                  :lane-profile-filter="matchupLaneProfileFilter"
                  :otp-mode="matchupOtpMode"
                />
              </div>
              <div
                v-if="isChampionTab('runes')"
                id="champion-tab-panel-runes"
                role="tabpanel"
                class="champion-tab-panel champion-tab-panel-runes p-4 max-lg:px-3 max-lg:py-3"
              >
                <StatisticsRunesTab build-summary />
              </div>
              <div
                v-if="isChampionTab('spells')"
                id="champion-tab-panel-spells"
                role="tabpanel"
                class="champion-tab-panel champion-tab-panel-spells p-4 max-lg:px-3 max-lg:py-3"
              >
                <StatisticsSpellsTab card-summary />
              </div>
              <div
                v-if="isChampionTab('skills')"
                id="champion-tab-panel-skills"
                role="tabpanel"
                class="champion-tab-panel champion-tab-panel-skills p-4 max-lg:px-3 max-lg:py-3"
              >
                <div
                  v-if="championSpellsPending && !championSpellOrdersRows.length"
                  class="py-6 text-text/70"
                >
                  {{ t('statisticsPage.loading') }}
                </div>
                <div
                  v-else-if="!championSpellOrderSectionsVisible.length"
                  class="py-4 text-text/70"
                >
                  {{ t('statisticsPage.noData') }}
                </div>
                <div v-else class="champion-skills-sections space-y-[5px]">
                  <section v-if="championMainSkillOrder" class="sk-grid-section">
                    <header class="sk-grid-head">
                      <h2 class="sk-grid-title">{{ t('statisticsPage.skillOrderGridTitle') }}</h2>
                      <p class="sk-grid-sub">
                        <b>{{ fmtLocNum(championMainSkillOrder.winrate, 1, locale) }} %</b>
                        {{ t('statisticsPage.runesWr') }} ·
                        {{ fmtLocNum(championMainSkillOrder.pickrate, 1, locale) }} %
                        {{ t('statisticsPage.skillOrderGridOfGames') }} ·
                        {{ championMainSkillOrder.games.toLocaleString(locale) }}
                        {{ t('statisticsPage.skillOrderGridGames') }}
                      </p>
                    </header>
                    <div class="sk-grid-card">
                      <div class="sk-grid">
                        <span />
                        <span v-for="lvl in 18" :key="'skl-' + lvl" class="sk-grid-lvl">{{
                          lvl
                        }}</span>
                        <template v-for="gr in championMainSkillGrid" :key="'skr-' + gr.key">
                          <span class="sk-grid-key" :class="'is-' + gr.key">{{
                            t(`skills.key.${gr.key}`)
                          }}</span>
                          <span
                            v-for="(on, i) in gr.levels"
                            :key="'skc-' + gr.key + i"
                            class="sk-grid-cell"
                          >
                            <span v-if="on" class="sk-grid-chip" :class="'is-' + gr.key">{{
                              t(`skills.key.${gr.key}`)
                            }}</span>
                          </span>
                        </template>
                      </div>
                    </div>
                  </section>
                  <section
                    v-for="section in championSpellOrderSectionsVisible"
                    :key="section.key"
                    class="rounded-lg border bg-black/20 p-4"
                    :class="section.borderClass"
                  >
                    <h3 class="mb-3 text-xs font-semibold" :class="section.titleClass">
                      {{ section.title }}
                    </h3>
                    <div class="champion-skills-cards-grid">
                      <ChampionSpellOrderCard
                        v-for="row in section.rows"
                        :key="section.key + '-' + row.key"
                        :row="row"
                        :champion-id="championId"
                        :champion-slug="championSkillChampion?.id ?? ''"
                        :game-version="(filterVersion || gameVersion || '').trim()"
                        :spells="championSkillChampion?.spells"
                        :accent="championSpellOrderSectionAccent(section.key)"
                      />
                    </div>
                  </section>
                  <button
                    v-if="championSpellOrdersReliable.hidden > 0"
                    type="button"
                    class="text-xs font-semibold text-accent underline-offset-2 hover:underline"
                    :aria-pressed="showRareSpellOrders"
                    @click="showRareSpellOrders = !showRareSpellOrders"
                  >
                    {{
                      showRareSpellOrders
                        ? t('statisticsPage.spellOrdersHideRare')
                        : t('statisticsPage.spellOrdersShowRare', {
                            n: championSpellOrdersReliable.hidden,
                          })
                    }}
                  </button>
                </div>
              </div>
              <div
                v-if="activeChampionTab === 'objectives'"
                id="champion-tab-panel-objectives"
                role="tabpanel"
                class="champion-tab-panel champion-tab-panel-objectives champion-tab-panel-flush"
              >
                <ChampionObjectivesTab
                  :data="championObjectivesData"
                  :pending="championObjectivesPending"
                />
              </div>
              <div
                v-if="activeChampionTab === 'vision' || activeChampionTab === 'pings'"
                id="champion-tab-panel-vision"
                role="tabpanel"
                class="champion-tab-panel p-4 max-lg:px-3 max-lg:py-3"
              >
                <h2 class="champion-section-title">{{ t('statisticsPage.visionPingsTitle') }}</h2>
                <div class="champion-vision-pings-grid">
                  <ChampionVisionTab
                    :data="championVisionData"
                    :baseline="championVisionBaselineData"
                    :pending="championVisionPending"
                  />
                  <ChampionPingsTab
                    :data="championPingsData"
                    :baseline="championPingsBaselineData"
                    :pending="championPingsPending"
                  />
                </div>
              </div>
              <div
                v-if="activeChampionTab === 'dashboard'"
                id="champion-tab-panel-dashboard"
                role="tabpanel"
                class="champion-tab-panel p-4 max-lg:px-3 max-lg:py-3"
              >
                <ChampionCombatRolesPanel
                  :metrics="championDashboardData?.metrics"
                  :roles="championDashboardData?.roles"
                  :pending="championDashboardPending"
                />
              </div>
              <div
                v-if="activeChampionTab === 'misc'"
                id="champion-tab-panel-misc"
                role="tabpanel"
                class="champion-tab-panel p-4 max-lg:px-3 max-lg:py-3"
              >
                <ChampionMiscTab :data="championMiscData" :pending="championMiscPending" />
              </div>
              <div
                v-if="activeChampionTab === 'builds'"
                id="champion-tab-panel-builds"
                role="tabpanel"
                class="champion-tab-panel p-4 max-lg:px-3 max-lg:py-3"
              >
                <ChampionBuildsTab
                  :champion-id="championByKey(championId)?.id ?? ''"
                  :champion-name="championName(championId) ?? ''"
                />
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
        'statistics-filters-fab fixed bottom-4 left-1/2 z-[58] flex -translate-x-1/2 items-center gap-2',
        filtersFabClass,
      ]"
      :aria-label="t('statisticsPage.openFilters')"
      @click="openFilters"
    >
      {{ t('statisticsPage.filtersTitle') }}
      <span
        v-if="activeChampionFiltersCount > 0"
        class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
      >
        {{ activeChampionFiltersCount }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, provide, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { queryFirst } from '~/utils/statistics/statisticsTabRouting'
import { progressionReferenceVersion } from '~/utils/statistics/progressionReference'
import { trendChartDomain } from '~/utils/statistics/trendDomain'
import { matchupsFallbackVersion } from '~/utils/statistics/matchupsFallbackVersion'
import { splitRareRows, LOW_SAMPLE_MIN_GAMES } from '~/utils/statistics/lowSample'
import type { HighlightRow } from '~/components/statistics/ChampionMatchupHighlights.vue'
import { displayedPatch, withVersionQuery } from '~/utils/statistics/championVersionQuery'
import { statisticsFiltersSheetPanelClass } from '~/composables/useStatisticsFiltersSheetMode'
import { PAGE_SIZE_OPTIONS } from '~/utils/statistics/statisticsTableFormat'
import type { RunesSpellsTabCtx } from '~/composables/statistics/statisticsPageCtx'
import { statsFetch } from '~/utils/statsFetch'
import { trendTiersForLevel, type TrendLevel } from '~/utils/statistics/trendLevel'
import { apiUrl } from '~/utils/apiUrl'
import { matchesChampionSearch } from '~/utils/multilingualEntitySearch'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { useStatisticsCustomStore } from '~/stores/StatisticsCustomStore'
import ChampionMatchupMobileCard, {
  type MatchupsExtDominanceKey,
  type MatchupsExtRow,
  type MatchupsExtSignalLevel,
} from '~/components/statistics/ChampionMatchupMobileCard.vue'
import type { MatchupDetailTabId } from '~/components/statistics/ChampionMatchupDetailPanel.vue'
import type { SynergyExtRow } from '~/components/statistics/ChampionSynergyTab.vue'
import type { ChampionObjectivesSummary } from '~/components/statistics/ChampionObjectivesTab.vue'
import type { ChampionMiscSummary } from '~/components/statistics/ChampionMiscTab.vue'
import { trendCardsForFocus, type TrendFocus } from '~/utils/statistics/trendFocus'
import type { ChampionDashboardSummary } from '~/components/statistics/ChampionDashboardTab.vue'
import type { ChampionPingsSummary } from '~/components/statistics/ChampionPingsTab.vue'
import type { ChampionVisionSummary } from '~/components/statistics/ChampionVisionTab.vue'
import ChampionSpellOrderCard from '~/components/statistics/ChampionSpellOrderCard.vue'
import ChampionOverviewCards, {
  type OverviewIconRow,
} from '~/components/statistics/ChampionOverviewCards.vue'
import {
  matchupExtremes,
  overviewRoleRows,
  profileColumns,
  skillPriority,
} from '~/utils/statistics/overviewBuildSummary'
import { topItemsFromBuilds } from '~/utils/championDashboard'
import { mergeChampionSpellOrderRows } from '~/utils/championSpellOrderMerge'
import { fmtLocNum } from '~/utils/statistics/localeNum'
import { mainSkillOrder, skillOrderGrid } from '~/utils/statistics/skillOrderGrid'
import {
  getChampionImageUrl,
  getItemImageUrl as _getItemImageUrl,
  getRunePathColor,
  getRuneImageUrl as _getRuneImageUrl,
  getSpellImageUrl as _getSpellImageUrl,
} from '~/utils/imageUrl'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'
import { rankTierSelectionsEqual } from '~/utils/statisticsRankTierQuery'
import { useGameVersion } from '~/composables/useGameVersion'
import { statsRoleIconPath, statsRoleLabel } from '~/utils/statsRoleDisplay'
import { buildChampionRoleDistribution } from '~/utils/championRoleDistribution'
import { championKeyFromRouteParam, championStatsSegment } from '~/utils/championSlug'
import { useChampionPageSsr } from '~/composables/statistics/useChampionStatsSsr'
import {
  resolveTrendSnapshotsQueryFrom,
  trendDaysBackFromRangeMode,
} from '~/composables/statistics/useStatisticsDailyTrendCharts'
import ChampionStatsSeoSummary from '~/components/statistics/ChampionStatsSeoSummary.vue'
import { useChampionNames, championNameFromMap } from '~/composables/useChampionNames'
import { breadcrumbJsonLd } from '~/utils/jsonLd'
import { useJsonLdHead } from '~/composables/useJsonLdHead'
import { useSiteUrl } from '~/composables/useSiteUrl'
import { absoluteSitePath, pageOgImageUrl } from '~/utils/siteUrl'
import { useOgMetaTags } from '~/composables/useOgMetaTags'
import { lolSeasonFromGameVersion } from '~/utils/lolSeason'
import { getFallbackGameVersion } from '~/config/version'
import { compareVersionsDesc, normalizeVersionToPrefix } from '~/utils/statistics/statsVersion'
import { riotLanguage } from '~/utils/riotLanguage'
import { RANK_TIERS } from '~/utils/rankTiers'
import {
  compareRankTiers,
  RANK_TIER_COLORS,
  normalizeRankTier,
  smoothSeries,
  svgLinePath,
} from '~/utils/statistics/trendChart'
import {
  CHAMPION_TAB_GROUPS,
  championTabGroupOf,
  championTabsInGroup,
  type ChampionTabGroupId,
} from '~/utils/statistics/championTabGroups'
const StatisticsRunesTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsRunesTab.vue')
)
const StatisticsSpellsTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsSpellsTab.vue')
)
// Onglets lourds rendus derrière v-if : chargés à la demande (chunk par onglet).
const ChampionMatchupDetailPanel = defineAsyncComponent(
  () => import('~/components/statistics/ChampionMatchupDetailPanel.vue')
)
const ChampionSynergyTab = defineAsyncComponent(
  () => import('~/components/statistics/ChampionSynergyTab.vue')
)
const ChampionObjectivesTab = defineAsyncComponent(
  () => import('~/components/statistics/ChampionObjectivesTab.vue')
)
const ChampionCombatRolesPanel = defineAsyncComponent(
  () => import('~/components/statistics/ChampionCombatRolesPanel.vue')
)
const ChampionMiscTab = defineAsyncComponent(
  () => import('~/components/statistics/ChampionMiscTab.vue')
)
const ChampionMatchupHighlights = defineAsyncComponent(
  () => import('~/components/statistics/ChampionMatchupHighlights.vue')
)
const ChampionJunglePaths = defineAsyncComponent(
  () => import('~/components/statistics/ChampionJunglePaths.vue')
)
const ChampionBuildsTab = defineAsyncComponent(
  () => import('~/components/statistics/ChampionBuildsTab.vue')
)
const ChampionPingsTab = defineAsyncComponent(
  () => import('~/components/statistics/ChampionPingsTab.vue')
)
const ChampionVisionTab = defineAsyncComponent(
  () => import('~/components/statistics/ChampionVisionTab.vue')
)

const route = useRoute()
const router = useRouter()
const filterVersion = ref(queryFirst(route.query.version as string | string[] | null | undefined))
const { t, locale } = useI18n()
const localePath = useLocalePath()
const versionStore = useVersionStore()
const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const summonerSpellsStore = useSummonerSpellsStore()
const { version: gameVersion } = useGameVersion()
const riotLocale = computed(() => riotLanguage(locale.value))
const championRouteParam = computed(() => {
  const raw = route.params.slug
  return Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '')
})
const championId = computed(() => {
  const key = championKeyFromRouteParam(championRouteParam.value, championsStore.champions)
  return key ?? 0
})

function championByKey(id: number) {
  return championsStore.champions.find(c => c.key === String(id)) ?? null
}
function championName(id: number) {
  return (
    championByKey(id)?.name ??
    championPageSsr.value?.championName ??
    championNameFromMap(championNamesMap.value, id) ??
    null
  )
}

const resolvedChampionName = computed(
  () => championPageSsr.value?.championName ?? championName(championId.value) ?? null
)

const resolvedGamePatch = computed(
  () => gameVersion.value || versionStore.currentVersion || getFallbackGameVersion()
)

await versionStore.loadCurrentVersion().catch(() => undefined)
await championsStore.loadChampions(riotLocale.value).catch(() => undefined)

const { data: championNamesMap } = await useChampionNames()

const { data: championPageSsr, pending: championPageSsrPending } = await useChampionPageSsr(
  championRouteParam,
  riotLocale,
  filterVersion
)

const lolSeasonLabel = computed(() => lolSeasonFromGameVersion(gameVersion.value))
function _itemName(itemId: number) {
  return itemsStore.items.find(i => i.id === String(itemId))?.name ?? null
}
function _itemImageName(itemId: number) {
  return itemsStore.items.find(i => i.id === String(itemId))?.image?.full ?? null
}
function _getRuneById(runeId: number) {
  for (const path of runesStore.runePaths) {
    for (const slot of path.slots) {
      const rune = slot.runes.find(r => r.id === runeId)
      if (rune) return rune
    }
  }
  return null
}
function runeIdsFromSet(runesUnknown: unknown): number[] {
  if (runesUnknown == null || typeof runesUnknown !== 'object') return []
  const perks = runesUnknown as { styles?: Array<{ selections?: Array<{ perk?: number }> }> }
  const styles = perks?.styles
  if (!Array.isArray(styles)) return []
  const ids: number[] = []
  for (const style of styles) {
    const selections = style?.selections
    if (!Array.isArray(selections)) continue
    for (const sel of selections) {
      if (typeof sel?.perk === 'number') ids.push(sel.perk)
    }
  }
  return ids
}

/** Stats par runeId : priorité API runes-per-rune (comme onglet stats), sinon dérivées des sets. */
const championRuneStatsByRuneId = computed(() => {
  const perRune = runesPerRuneData.value?.runes
  if (Array.isArray(perRune) && perRune.length > 0) {
    const result: Record<number, { pickrate: number; winrate: number; games: number }> = {}
    for (const r of perRune) {
      result[r.runeId] = { pickrate: r.pickrate, winrate: r.winrate, games: r.games }
    }
    return result
  }
  const data = runesData.value
  if (!data?.runes?.length || !data.totalGames)
    return {} as Record<number, { pickrate: number; winrate: number; games: number }>
  const totalGames = data.totalGames
  const acc: Record<number, { games: number; wins: number }> = {}
  for (const set of data.runes) {
    const ids = runeIdsFromSet(set.runes)
    for (const runeId of ids) {
      if (!acc[runeId]) acc[runeId] = { games: 0, wins: 0 }
      acc[runeId].games += set.games
      acc[runeId].wins += set.wins
    }
  }
  const result: Record<number, { pickrate: number; winrate: number; games: number }> = {}
  for (const [runeIdStr, { games, wins }] of Object.entries(acc)) {
    const runeId = Number(runeIdStr)
    result[runeId] = {
      pickrate: totalGames > 0 ? (100 * games) / totalGames : 0,
      winrate: games > 0 ? (100 * wins) / games : 0,
      games,
    }
  }
  return result
})

/** Grille runes par chemin (comme onglet runes) pour ce champion. */
const _championRunesByPath = computed(() => {
  const stats = championRuneStatsByRuneId.value
  return runesStore.runePaths.map(path => {
    const cells: Array<{
      row: number
      col: number
      rune: { id: number; name: string; icon: string }
      stats: { pickrate: number; winrate: number; games: number } | null
    }> = []
    path.slots.forEach((slot, slotIndex) => {
      const numCols = slotIndex === 0 ? 4 : 3
      slot.runes.slice(0, numCols).forEach((rune, runeIndex) => {
        const st = stats[rune.id] ?? null
        cells.push({
          row: slotIndex,
          col: runeIndex,
          rune: { id: rune.id, name: rune.name, icon: rune.icon },
          stats: st,
        })
      })
    })
    return { path, cells }
  })
})

function _runePathPanelStyle(icon: string): Record<string, string> {
  const color = getRunePathColor(icon)
  return {
    borderColor: `${color}66`,
    boxShadow: `inset 0 0 0 1px ${color}22`,
  }
}

const matchupOtpMode = ref<'oui' | 'non' | 'solo'>('non')
const MATCHUP_LANE_PROFILE_DIMENSION_KEYS = [
  'early',
  'laneEconomy',
  'kills',
  'level',
  'cs',
  'vision',
  'items',
  'gank',
  'dive',
  'roam',
  'objectives',
  'pressure',
] as const satisfies readonly MatchupsExtDominanceKey[]

const matchupLaneProfileFilter = ref<'ALL' | 'balanced' | MatchupsExtDominanceKey>('ALL')
const matchupLaneProfileOptions = computed(() =>
  MATCHUP_LANE_PROFILE_DIMENSION_KEYS.map(key => ({
    value: key,
    label: t(`statisticsPage.championMatchupDominance.${key}`),
  }))
)
type MatchupSortKey =
  | 'rank'
  | 'champion'
  | 'score'
  | 'scoreDelta'
  | 'role'
  | 'winrate'
  | 'pickrate'
  | 'delta1'
  | 'delta2'
  | 'laneScore'
  | 'dominance'
const matchupSortKey = ref<MatchupSortKey>('score')
const matchupSortDir = ref<'asc' | 'desc'>('desc')
const expandedMatchupKeys = ref<Set<string>>(new Set())

const matchupDetailTab = ref<MatchupDetailTabId>('profile')
const activeMatchupDetailKey = ref<string | null>(null)

const matchupTableColspan = computed(() => (filterRole.value ? 10 : 11))

function isMatchupDetailActive(row: MatchupsExtRow): boolean {
  return activeMatchupDetailKey.value === matchupCardKey(row)
}

function matchupCardKey(row: MatchupsExtRow): string {
  return `${row.opponentChampionId}-${row.role}`
}

function scrollToMatchupDetail(key: string): void {
  nextTick(() => {
    document
      .getElementById(`matchup-detail-${key}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function toggleMatchupCard(row: MatchupsExtRow): void {
  const key = matchupCardKey(row)
  const next = new Set(expandedMatchupKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedMatchupKeys.value = next
  if (next.has(key)) {
    activeMatchupDetailKey.value = key
    matchupDetailTab.value = 'profile'
    scrollToMatchupDetail(key)
  } else if (activeMatchupDetailKey.value === key) {
    activeMatchupDetailKey.value = null
  }
}

function openMatchupDetail(row: MatchupsExtRow): void {
  const key = matchupCardKey(row)
  if (activeMatchupDetailKey.value === key) {
    activeMatchupDetailKey.value = null
    return
  }
  activeMatchupDetailKey.value = key
  matchupDetailTab.value = 'profile'
  const next = new Set(expandedMatchupKeys.value)
  next.add(key)
  expandedMatchupKeys.value = next
  scrollToMatchupDetail(key)
}

function setMatchupSort(key: MatchupSortKey): void {
  if (matchupSortKey.value === key) {
    matchupSortDir.value = matchupSortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  matchupSortKey.value = key
  matchupSortDir.value = key === 'champion' || key === 'role' ? 'asc' : 'desc'
}

function matchupSortIcon(key: MatchupSortKey): string {
  if (matchupSortKey.value !== key) return ''
  return matchupSortDir.value === 'asc' ? ' ↑' : ' ↓'
}

const matchupMobileSortColumn = computed({
  get: () => matchupSortKey.value,
  set: (v: string) => {
    const key = v as MatchupSortKey
    if (matchupSortKey.value === key) return
    matchupSortKey.value = key
    matchupSortDir.value = key === 'champion' || key === 'role' ? 'asc' : 'desc'
  },
})

const matchupMobileSortOptions = computed(() => {
  const opts = [
    { value: 'rank', label: t('statisticsPage.tierListRank') },
    { value: 'champion', label: t('statisticsPage.champion') },
    { value: 'score', label: t('statisticsPage.championMatchupColScore') },
    {
      value: 'scoreDelta',
      label: t('statisticsPage.championMatchupColScoreDelta'),
    },
    { value: 'winrate', label: t('statisticsPage.winrate') },
    { value: 'pickrate', label: t('statisticsPage.championMatchupColPickrate') },
    { value: 'delta1', label: t('statisticsPage.championMatchupColDelta1') },
    { value: 'delta2', label: t('statisticsPage.championMatchupColDelta2') },
    { value: 'laneScore', label: t('statisticsPage.championMatchupColLaneScore') },
    { value: 'dominance', label: t('statisticsPage.championMatchupColDominance') },
  ]
  if (!filterRole.value) {
    opts.splice(4, 0, { value: 'role', label: t('statisticsPage.filterRole') })
  }
  return opts
})

function matchupMatchesSearch(opponentChampionId: number): boolean {
  const q = championSearchQueryPlaceholder.value.trim()
  if (!q) return true
  return matchesChampionSearch(q, {
    championId: opponentChampionId,
    name: championName(opponentChampionId),
  })
}

/** Matchups filtrés par recherche champion (nom ou id). */
type LaneProfileRow = Pick<MatchupsExtRow, 'dominanceKeys' | 'weaknessKeys'>
function matchupMatchesLaneProfileFilter(row: LaneProfileRow): boolean {
  const f = matchupLaneProfileFilter.value
  if (f === 'ALL') return true
  if (f === 'balanced') return !row.dominanceKeys?.length && !row.weaknessKeys?.length
  return (row.dominanceKeys?.includes(f) ?? false) || (row.weaknessKeys?.includes(f) ?? false)
}

function matchupMatchesOtpFilter(row: { pickrate?: number | null }): boolean {
  if (matchupOtpMode.value === 'oui') {
    return true
  }
  if (matchupOtpMode.value === 'solo') {
    return Number(row.pickrate ?? 0) <= 1
  }
  return Number(row.pickrate ?? 0) > 1
}

const filteredMatchupsExt = computed(() => {
  const rows = (matchupsExtData.value?.rows ?? []).filter(
    m =>
      matchupMatchesSearch(m.opponentChampionId) &&
      matchupMatchesLaneProfileFilter(m) &&
      matchupMatchesOtpFilter(m)
  )
  const dir = matchupSortDir.value === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (matchupSortKey.value === 'rank') return dir * (a.rank - b.rank)
    if (matchupSortKey.value === 'champion') {
      const an = championName(a.opponentChampionId) ?? String(a.opponentChampionId)
      const bn = championName(b.opponentChampionId) ?? String(b.opponentChampionId)
      return dir * an.localeCompare(bn)
    }
    if (matchupSortKey.value === 'score') return dir * (a.matchupScore - b.matchupScore)
    if (matchupSortKey.value === 'scoreDelta') {
      const ad = a.matchupScoreDeltaVsReference ?? Number.NEGATIVE_INFINITY
      const bd = b.matchupScoreDeltaVsReference ?? Number.NEGATIVE_INFINITY
      return dir * (ad - bd)
    }
    if (matchupSortKey.value === 'role') return dir * a.role.localeCompare(b.role)
    if (matchupSortKey.value === 'winrate') return dir * (a.winrate - b.winrate)
    if (matchupSortKey.value === 'pickrate') return dir * (a.pickrate - b.pickrate)
    if (matchupSortKey.value === 'delta1') return dir * ((a.delta1 ?? 0) - (b.delta1 ?? 0))
    if (matchupSortKey.value === 'delta2') return dir * ((a.delta2 ?? 0) - (b.delta2 ?? 0))
    if (matchupSortKey.value === 'laneScore') return dir * (a.laneScore - b.laneScore)
    const ad = (a.dominanceKeys?.length ?? 0) + (a.weaknessKeys?.length ?? 0)
    const bd = (b.dominanceKeys?.length ?? 0) + (b.weaknessKeys?.length ?? 0)
    return dir * (ad - bd)
  })
})
const matchupPageSizeOptions = [10, 20, 50, 100]
const matchupPageSize = ref(20)
const matchupPage = ref(1)
const totalMatchupPages = computed(() =>
  Math.max(1, Math.ceil(filteredMatchupsExt.value.length / matchupPageSize.value))
)
const paginatedMatchupsExt = computed(() => {
  const page = Math.min(matchupPage.value, totalMatchupPages.value)
  const start = (page - 1) * matchupPageSize.value
  return filteredMatchupsExt.value.slice(start, start + matchupPageSize.value)
})

const laneProfileStrengthLegendLevels: MatchupsExtSignalLevel[] = [
  'bigAdvantage',
  'mediumAdvantage',
  'smallAdvantage',
]
const laneProfileWeaknessLegendLevels: MatchupsExtSignalLevel[] = [
  'bigDisadvantage',
  'mediumDisadvantage',
  'smallDisadvantage',
]

const laneProfileChipBase =
  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] leading-tight tabular-nums'

function laneProfileSignalChipClass(
  level: MatchupsExtSignalLevel,
  side: 'strength' | 'weakness'
): string {
  if (side === 'strength') {
    if (level === 'bigAdvantage') {
      return `${laneProfileChipBase} border-info/75 bg-info/35 font-semibold text-primary-light shadow-sm shadow-info/20`
    }
    if (level === 'mediumAdvantage') {
      return `${laneProfileChipBase} border-info/55 bg-info/22 text-primary-light`
    }
    if (level === 'smallAdvantage') {
      return `${laneProfileChipBase} border-info/40 bg-info/12 text-info`
    }
    return `${laneProfileChipBase} border-primary/30 bg-white/[0.04] text-text/65`
  }
  if (level === 'bigDisadvantage') {
    return `${laneProfileChipBase} border-error/75 bg-error/35 font-semibold text-error/90 shadow-sm shadow-error/20`
  }
  if (level === 'mediumDisadvantage') {
    return `${laneProfileChipBase} border-error/55 bg-error/22 text-error/80`
  }
  if (level === 'smallDisadvantage') {
    return `${laneProfileChipBase} border-orange-500/45 bg-orange-600/14 text-orange-100`
  }
  return `${laneProfileChipBase} border-primary/30 bg-white/[0.04] text-text/65`
}

function laneProfileChipTitle(
  key: MatchupsExtDominanceKey,
  level: MatchupsExtSignalLevel | undefined,
  side: 'strength' | 'weakness'
): string {
  const lvl =
    level ??
    (side === 'strength' ? ('smallAdvantage' as MatchupsExtSignalLevel) : 'smallDisadvantage')
  const who =
    side === 'strength'
      ? t('statisticsPage.championMatchupProfileChampion')
      : t('statisticsPage.championMatchupProfileOpponent')
  return `${who} — ${t(`statisticsPage.championMatchupDominance.${key}`)} (${t(`statisticsPage.championMatchupSignalLevel.${lvl}`)}): ${t(`statisticsPage.championMatchupDominanceDetail.${key}`)}`
}

function dominanceTooltip(
  strengths: MatchupsExtDominanceKey[],
  weaknesses?: MatchupsExtDominanceKey[],
  profileByKey?: Partial<Record<MatchupsExtDominanceKey, MatchupsExtSignalLevel>>
): string {
  const lines: string[] = []
  if (strengths?.length) {
    lines.push(t('statisticsPage.championMatchupProfileStrengths'))
    lines.push(
      ...strengths.map(
        k =>
          `+ ${t(`statisticsPage.championMatchupDominance.${k}`)} (${t(`statisticsPage.championMatchupSignalLevel.${profileByKey?.[k] ?? 'smallAdvantage'}`)}): ${t(`statisticsPage.championMatchupDominanceDetail.${k}`)}`
      )
    )
  }
  if (weaknesses?.length) {
    if (lines.length) lines.push('')
    lines.push(t('statisticsPage.championMatchupProfileWarnings'))
    lines.push(
      ...weaknesses.map(
        k =>
          `- ${t(`statisticsPage.championMatchupDominance.${k}`)} (${t(`statisticsPage.championMatchupSignalLevel.${profileByKey?.[k] ?? 'smallDisadvantage'}`)}): ${t(`statisticsPage.championMatchupDominanceDetail.${k}`)}`
      )
    )
  }
  if (!lines.length) return t('statisticsPage.championMatchupDominanceBalanced')
  return lines.join('\n')
}

function formatSignedDelta(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}

function matchupDeltaClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'text-text/55'
  if (v > 0) return 'text-info'
  if (v < 0) return 'text-error/70'
  return 'text-text/70'
}

function _spellName(spellId: number) {
  return summonerSpellsStore.getSpellById(String(spellId))?.name ?? null
}
function _spellImageName(spellId: number) {
  return summonerSpellsStore.getSpellById(String(spellId))?.image?.full ?? null
}

const statisticsUiStore = useStatisticsUiStore()
const statisticsCustomStore = useStatisticsCustomStore()
const { filtersOpen } = storeToRefs(statisticsUiStore)

const {
  effectiveFiltersSheetMode,
  showFiltersBackdrop,
  lockPageScrollForFilters,
  showDesktopFiltersTrigger,
  showFiltersHeaderClose,
  filtersFabClass,
} = useStatisticsFiltersSheetMode()

const trendChartFromDate = ref('')
const filterRank = ref<string[]>([])
const filterRole = ref('')
/** Versions chargées depuis l’overview pour le filtre (version + matchCount). */
const versionsFromOverview = ref<Array<{ version: string; matchCount: number }>>([])
const matchupsFallback = computed(() =>
  matchupsFallbackVersion(
    versionsFromOverview.value,
    filterVersion.value || gameVersion.value || ''
  )
)
const championSearchQueryPlaceholder = ref('')
const rankTiers = RANK_TIERS

function formatDivisionLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}

const activeChampionFiltersCount = computed(() => {
  let count = 0
  if (filterVersion.value) count++
  if (filterRank.value.length > 0) count++
  if (filterRole.value) count++
  if (championProgressionFromVersionOverride.value) count++
  if (activeChampionTab.value === 'overview' && trendChartFromDate.value.trim()) count++
  if (activeChampionTab.value === 'spells' && championSpellsModeFilter.value !== 'solo') count++
  return count
})

function closeFilters() {
  statisticsUiStore.setFiltersOpen(false)
}
function openFilters() {
  statisticsUiStore.setFiltersOpen(true)
}
function toggleFiltersOpen() {
  if (filtersOpen.value) closeFilters()
  else openFilters()
}

function onFiltersEscapeKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !filtersOpen.value) return
  if (!import.meta.client || !effectiveFiltersSheetMode.value) return
  closeFilters()
}

watch([filtersOpen, lockPageScrollForFilters], () => {
  if (!import.meta.client) return
  const lock = lockPageScrollForFilters.value && filtersOpen.value
  document.body.style.overflow = lock ? 'hidden' : ''
})

function normalizeTrendChartFromDate(raw: string): string | null {
  const s = raw.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

/** Référence patch pour fenêtre temporelle des graphes tendances (aligné page stats). */
const championProgressionFromVersionOverride = ref('')
function syncChampionProgressionDeltaToVersionBeforeFilter(): boolean {
  const filter = filterVersion.value.trim()
  const before = championProgressionFromVersionOverride.value
  const prev = filter ? (progressionReferenceVersion(versionsFromOverview.value, filter) ?? '') : ''
  if (before === prev) return false
  championProgressionFromVersionOverride.value = prev
  return true
}
const championProgressionFromVersion = computed(() => {
  if (championProgressionFromVersionOverride.value)
    return championProgressionFromVersionOverride.value
  return (
    progressionReferenceVersion(versionsFromOverview.value, filterVersion.value) ??
    normalizeVersionToPrefix(versionStore.currentVersion)
  )
})
const championProgressionSelectableVersions = computed(() => {
  const versions = versionsFromOverview.value
  if (!filterVersion.value) return versions
  const filtered = versions.filter(v => v.version !== filterVersion.value)
  return filtered.length > 0 ? filtered : versions
})
const championProgressionFromVersionModel = computed({
  get: () => championProgressionFromVersion.value ?? '',
  set: (value: string) => {
    championProgressionFromVersionOverride.value = value || ''
  },
})

const pending = ref(true)
const error = ref<string | null>(null)
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
} | null>(championPageSsr.value?.stats ?? null)

pending.value = Boolean(championPageSsrPending.value && !championPageSsr.value?.stats)

watch(championPageSsr, value => {
  if (value?.stats) {
    championStats.value = value.stats
    pending.value = false
  }
})

// Au premier montage, les stats de base viennent de l'amorce SSR (mêmes
// paramètres que le premier fetch client : filtres au défaut, `?otp=oui`).
// Ce flag one-shot évite un `loadChampion()` initial strictement redondant.
let championBaseStatsFromSsr = Boolean(championPageSsr.value?.stats)
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
const championMiscData = ref<ChampionMiscSummary | null>(null)
const championDashboardData = ref<ChampionDashboardSummary | null>(null)
const championDashboardPending = ref(false)
const championMiscPending = ref(false)
const championPingsData = ref<ChampionPingsSummary | null>(null)
const championPingsBaselineData = ref<ChampionPingsSummary | null>(null)
const championPingsPending = ref(false)
const championVisionData = ref<ChampionVisionSummary | null>(null)
const championVisionBaselineData = ref<ChampionVisionSummary | null>(null)
const championVisionPending = ref(false)

type ByRoleRow = { role: string; games: number; winrate: number; pickrate: number }

/** Toutes les positions (TOP…SUPPORT) : parts sur le total champion toutes positions (même avec filtre rôle sur le reste de la page). */
const byRoleList = computed((): ByRoleRow[] => {
  if (!championStats.value) return []
  return buildChampionRoleDistribution(championStats.value.byRole)
})

/** Rôles avec au moins une partie dans la répartition (hors filtre rôle courant). */
const rolesWithData = computed(
  () => new Set(byRoleList.value.filter(r => r.games > 0).map(r => r.role))
)

const roleDistribution = computed(() =>
  [...byRoleList.value].filter(r => r.games > 0).sort((a, b) => b.games - a.games)
)

const roleOptions = [
  { value: 'TOP', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'JUNGLE', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'MIDDLE', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'BOTTOM', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'SUPPORT', label: 'Support', icon: '/icons/roles/support.png' },
]
const roles = roleOptions

function selectAllChampionRoles() {
  filterRole.value = ''
}
function toggleChampionRoleFilter(r: (typeof roleOptions)[number]) {
  if (!rolesWithData.value.has(r.value)) return
  filterRole.value = filterRole.value === r.value ? '' : r.value
}

function roleLabel(role: string) {
  return statsRoleLabel(role)
}
function roleIconPath(role: string) {
  return statsRoleIconPath(role)
}
function formatDonutPercent(value: number) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : '0'
}

const buildsPending = ref(false)
const buildsData = ref<{
  totalGames: number
  builds: Array<{ items: number[]; games: number; wins: number; winrate: number; pickrate: number }>
} | null>(null)
const _buildsExpand = ref(false)

const runesPending = ref(false)
const runesData = ref<{
  totalGames: number
  runes: Array<{
    runes: unknown
    shards?: number[]
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
} | null>(null)
const runesPerRuneData = ref<{
  totalGames: number
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
} | null>(null)
const runesShardsData = ref<{
  totalGames: number
  shards: Array<{
    shardId: number
    slot: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
} | null>(null)
const runesBaselineSets = ref<typeof runesData.value>(null)
const runesBaselinePerRune = ref<typeof runesPerRuneData.value>(null)
const runesBaselineShards = ref<typeof runesShardsData.value>(null)
const championRunesBaselinePending = ref(false)
const _runesExpand = ref(false)

const detailPending = ref(false)
const detailData = ref<{
  runeSets?: Array<{
    runes: unknown
    shards?: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  runes?: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  summonerSpells?: Array<{ spellId: number; pickrate: number; winrate: number }>
} | null>(null)
const _globalRunesExpand = ref(false)

type ChampionSpellSoloApiRow = {
  spellId: number
  games: number
  wins: number
  casts?: number
  pickrate: number
  winrate: number
  countSlot0?: number
  countSlot1?: number
}
type ChampionSpellDuoApiRow = {
  spellId1: number
  spellId2: number
  games: number
  wins: number
  pickrate: number
  winrate: number
  spell1Casts?: number
  spell2Casts?: number
}
const championSpellsPending = ref(false)
const championSpellsBaselinePending = ref(false)
const championSpellsBaselineSolo = ref<ChampionSpellSoloApiRow[]>([])
const championSpellsBaselineDuos = ref<ChampionSpellDuoApiRow[]>([])
const championSpellsData = ref<{
  totalGames: number
  spells: ChampionSpellSoloApiRow[]
} | null>(null)
const championSpellsDuosData = ref<{
  totalGames: number
  duos: ChampionSpellDuoApiRow[]
} | null>(null)
const championSpellOrdersData = ref<{
  totalGames: number
  rows: Array<{
    key: string
    order: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
} | null>(null)
const championObjectivesData = ref<ChampionObjectivesSummary | null>(null)
const championObjectivesPending = ref(false)

const championSpellsModeFilter = ref<'solo' | 'pair'>('solo')
const championRunesPanelData = computed(() =>
  assembleChampionRunesPanel(runesPerRuneData.value, runesData.value, runesShardsData.value)
)
const championRunesBaselinePanelData = computed(() =>
  assembleChampionRunesPanel(
    runesBaselinePerRune.value,
    runesBaselineSets.value,
    runesBaselineShards.value
  )
)
function mapChampionSpellsTableSolo(spells: ChampionSpellSoloApiRow[]) {
  return spells.map(s => {
    const games = Number(s.games ?? 0)
    const slot0 = Number(s.countSlot0 ?? 0)
    const slot1 = Number(s.countSlot1 ?? 0)
    return {
      spellId: s.spellId,
      games,
      wins: Number(s.wins ?? 0),
      pickrate: Number(s.pickrate ?? 0),
      winrate: Number(s.winrate ?? 0),
      casts: Number(s.casts ?? 0),
      pctSlotD: games > 0 ? Math.round((slot0 / games) * 10000) / 100 : undefined,
      pctSlotF: games > 0 ? Math.round((slot1 / games) * 10000) / 100 : undefined,
    }
  })
}

function mapChampionSpellsTablePairs(duos: ChampionSpellDuoApiRow[]) {
  return duos.map(d => ({
    spellIdD: d.spellId1,
    spellIdF: d.spellId2,
    games: Number(d.games ?? 0),
    wins: Number(d.wins ?? 0),
    pickrate: Number(d.pickrate ?? 0),
    winrate: Number(d.winrate ?? 0),
    spell1Casts: Number(d.spell1Casts ?? 0),
    spell2Casts: Number(d.spell2Casts ?? 0),
  }))
}

const championSpellsTableSolo = computed(() =>
  mapChampionSpellsTableSolo(championSpellsData.value?.spells ?? [])
)
const championSpellsTablePairs = computed(() =>
  mapChampionSpellsTablePairs(championSpellsDuosData.value?.duos ?? [])
)
const championSpellsComparisonVersion = computed(() => {
  const refV = (championProgressionFromVersion.value ?? '').trim()
  const cur = (filterVersion.value || gameVersion.value || '').trim()
  if (!refV || refV === cur) return null
  return refV
})

const championSpellOrdersTotalGames = computed(() =>
  Number(championSpellOrdersData.value?.totalGames ?? 0)
)

const championSpellOrdersRows = computed(() => {
  const raw = (championSpellOrdersData.value?.rows ?? []).filter(
    row => Array.isArray(row.order) && row.order.length > 0
  )
  return mergeChampionSpellOrderRows(raw, championSpellOrdersTotalGames.value)
})

function championSpellOrderSectionAccent(sectionKey: string): 'emerald' | 'rose' | 'sky' | 'amber' {
  if (sectionKey === 'top-wr') return 'emerald'
  if (sectionKey === 'low-wr') return 'rose'
  if (sectionKey === 'top-pr') return 'sky'
  return 'amber'
}
const championSpellOrderSections = computed(() => [
  {
    key: 'top-wr',
    title: t('statisticsPage.championSpellOrdersTopWinrate'),
    rows: championSpellOrdersTopWinrate.value,
    borderClass: 'border-info/50 bg-background/40',
    titleClass: 'text-info',
  },
  {
    key: 'low-wr',
    title: t('statisticsPage.championSpellOrdersLowWinrate'),
    rows: championSpellOrdersLowWinrate.value,
    borderClass: 'border-error/50 bg-background/40',
    titleClass: 'text-error/80',
  },
  {
    key: 'top-pr',
    title: t('statisticsPage.championSpellOrdersTopPickrate'),
    rows: championSpellOrdersTopPickrate.value,
    borderClass: 'border-info/50 bg-panel/40',
    titleClass: 'text-primary-light',
  },
  {
    key: 'low-pr',
    title: t('statisticsPage.championSpellOrdersLowPickrate'),
    rows: championSpellOrdersLowPickrate.value,
    borderClass: 'border-accent/50 bg-background/40',
    titleClass: 'text-accent-light',
  },
])
const championSpellOrderSectionsVisible = computed(() =>
  championSpellOrderSections.value.filter(section => section.rows.length > 0)
)
const championSkillChampion = computed(() => championByKey(championId.value))
const showRareSpellOrders = ref(false)
const championMainSkillOrder = computed(() =>
  mainSkillOrder(championSpellOrdersReliable.value.rows)
)
const championMainSkillGrid = computed(() =>
  skillOrderGrid(championMainSkillOrder.value?.displayOrder ?? [])
)
const championSpellOrdersReliable = computed(() =>
  splitRareRows(championSpellOrdersRows.value, showRareSpellOrders.value)
)
const championSpellOrdersTopWinrate = computed(() =>
  [...championSpellOrdersReliable.value.rows]
    .sort((a, b) => b.winrate - a.winrate || b.games - a.games)
    .slice(0, 3)
)
const championSpellOrdersLowWinrate = computed(() =>
  [...championSpellOrdersReliable.value.rows]
    .sort((a, b) => a.winrate - b.winrate || b.games - a.games)
    .slice(0, 3)
)
const championSpellOrdersTopPickrate = computed(() =>
  [...championSpellOrdersReliable.value.rows]
    .sort((a, b) => b.pickrate - a.pickrate || b.games - a.games)
    .slice(0, 3)
)
const championSpellOrdersLowPickrate = computed(() =>
  [...championSpellOrdersReliable.value.rows]
    .sort((a, b) => a.pickrate - b.pickrate || b.games - a.games)
    .slice(0, 3)
)

const matchupsExtPending = ref(false)
const matchupsExtError = ref<string | null>(null)
const matchupsExtData = ref<{
  championId: number
  totalGames: number
  referenceVersion?: string | null
  rows: MatchupsExtRow[]
} | null>(null)

const synergyExtPending = ref(false)
const synergyExtError = ref<string | null>(null)
const synergyExtData = ref<{
  championId: number
  totalGames: number
  referenceVersion?: string | null
  rows: SynergyExtRow[]
} | null>(null)
watch([filteredMatchupsExt, matchupPageSize], () => {
  matchupPage.value = 1
})

type TrendSnapshotPoint = {
  dateOfGame: string
  rankTier: string
  role: string
  championId: number
  games: number
  wins: number
  banCount?: number
  cohortPicks?: number
  banRatePct: number
  pickRatePct: number
}
type TrendGranularity = 'day' | 'week' | 'month' | 'patch'
type TrendDivisionPreset = 'selected' | 'average' | 'skilled' | 'elite'

const TREND_PRESET_TIERS: Record<Exclude<TrendDivisionPreset, 'selected'>, string[]> = {
  average: ['IRON', 'BRONZE', 'SILVER', 'GOLD'],
  skilled: ['PLATINUM', 'EMERALD', 'DIAMOND'],
  elite: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
}

const trendGranularity = ref<TrendGranularity>('day')
const trendRangeMode = ref<'7d' | '14d' | 'months'>('7d')
const trendMonthsWindow = ref(1)
const trendDivisionPreset = ref<TrendDivisionPreset>('selected')
const trendShowGlobalLine = ref(true)
const trendFocusMetric = ref<TrendFocus>('all')
const trendShowDivisions = ref(false)
function setTrendPeriod(p: '7d' | '14d' | 'patch'): void {
  if (p === 'patch') {
    trendGranularity.value = 'patch'
    trendRangeMode.value = 'months'
    trendMonthsWindow.value = 3
    return
  }
  trendGranularity.value = 'day'
  trendRangeMode.value = p
}
const trendPending = ref(false)
const trendError = ref<string | null>(null)
const trendPoints = ref<TrendSnapshotPoint[]>([])
const trendVersionsCatalog = ref<Array<{ patchLabel: string; releaseDate: string }>>([])

const activeChampionTab = ref<
  | 'overview'
  | 'dashboard'
  | 'matchups'
  | 'synergy'
  | 'runes'
  | 'spells'
  | 'skills'
  | 'objectives'
  | 'pings'
  | 'vision'
  | 'misc'
  | 'builds'
>('overview')
type ChampionTabId =
  | 'overview'
  | 'dashboard'
  | 'matchups'
  | 'synergy'
  | 'runes'
  | 'spells'
  | 'skills'
  | 'objectives'
  | 'pings'
  | 'vision'
  | 'misc'
  | 'builds'
const championPageBootstrapped = ref(false)
const championTabLoaded = ref<Record<ChampionTabId, boolean>>({
  overview: false,
  dashboard: false,
  matchups: false,
  synergy: false,
  runes: false,
  spells: false,
  skills: false,
  objectives: false,
  pings: false,
  vision: false,
  misc: false,
  builds: false,
})
const championTabs = [
  { id: 'overview' as const, label: 'statisticsPage.championStatsTabOverview' },
  { id: 'dashboard' as const, label: 'statisticsPage.championStatsTabCombatRoles' },
  { id: 'matchups' as const, label: 'statisticsPage.championStatsTabMatchups' },
  { id: 'synergy' as const, label: 'statisticsPage.championStatsTabSynergy' },
  { id: 'runes' as const, label: 'statisticsPage.championStatsTabRunes' },
  { id: 'spells' as const, label: 'statisticsPage.championStatsTabSpells' },
  { id: 'skills' as const, label: 'statisticsPage.championStatsTabSkills' },
  { id: 'objectives' as const, label: 'statisticsPage.objectivesTabMain' },
  { id: 'pings' as const, label: 'statisticsPage.tabPings' },
  { id: 'vision' as const, label: 'statisticsPage.championStatsTabVisionPings' },
  { id: 'misc' as const, label: 'statisticsPage.championStatsTabHealDamage' },
  { id: 'builds' as const, label: 'statisticsPage.championStatsTabBuilds' },
]
const activeChampionGroup = computed(() => championTabGroupOf(activeChampionTab.value))
const activeChampionGroupLabel = computed(
  () => CHAMPION_TAB_GROUPS.find(g => g.id === activeChampionGroup.value)?.label ?? ''
)
function championTabLabel(id: ChampionTabId): string {
  return championTabs.find(tab => tab.id === id)?.label ?? id
}
function selectChampionGroup(group: ChampionTabGroupId): void {
  if (activeChampionGroup.value === group) return
  activeChampionTab.value = championTabsInGroup(group)[0] ?? 'overview'
}
const championTabsNavEl = ref<HTMLElement | null>(null)
useHorizontalScrollContainer(championTabsNavEl)

function scrollActiveChampionTabIntoView(behavior: ScrollBehavior = 'smooth'): void {
  if (!import.meta.client || !championTabsNavEl.value) return
  const el = championTabsNavEl.value.querySelector<HTMLButtonElement>(
    `button[data-tab-id="${activeChampionTab.value}"]`
  )
  el?.scrollIntoView({ inline: 'start', block: 'nearest', behavior })
}

const championTabIds = new Set<ChampionTabId>(championTabs.map(t => t.id))
function normalizeChampionTab(input: unknown): ChampionTabId {
  const raw = Array.isArray(input) ? input[0] : input
  const val = String(raw ?? '').trim() as ChampionTabId
  return championTabIds.has(val) ? val : 'overview'
}
// Onglet lu dès le setup (SSR) : sinon la nav de groupe hydrate sur « Aperçu ».
activeChampionTab.value = normalizeChampionTab(route.query.tab)

function isChampionTab(tab: ChampionTabId): boolean {
  return activeChampionTab.value === tab
}

function resetChampionTabLoadState(): void {
  championTabLoaded.value = {
    overview: false,
    dashboard: false,
    matchups: false,
    synergy: false,
    runes: false,
    spells: false,
    skills: false,
    objectives: false,
    pings: false,
    vision: false,
    misc: false,
    builds: false,
  }
}

function markChampionTabLoaded(tab: ChampionTabId): void {
  if (tab === 'spells' || tab === 'skills') {
    championTabLoaded.value = {
      ...championTabLoaded.value,
      spells: true,
      skills: true,
    }
    return
  }
  championTabLoaded.value = {
    ...championTabLoaded.value,
    [tab]: true,
  }
}

function queryParams(versionOverride?: string | null) {
  const p = new URLSearchParams()
  const version = versionOverride ?? filterVersion.value
  if (version) {
    p.set('version', version)
    p.set('patch', version) // builds/runes API attendent "patch"
  }
  for (const t of filterRank.value) p.append('rankTier', t)
  if (filterRole.value) p.set('role', filterRole.value)
  // Fiche champion : pas de filtre OTP côté UI ; API sans exclusion pickrate niche.
  p.set('otp', 'oui')
  return p.toString() ? '?' + p.toString() : ''
}

const championRunesComparisonVersion = computed(() => {
  const ref = (championProgressionFromVersion.value ?? '').trim()
  const cur = (filterVersion.value || gameVersion.value || '').trim()
  if (!ref || ref === cur) return null
  return ref
})

type ChampionRunesPanelPayload = {
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
  shards: Array<{
    shardId: number
    slot: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
}

function assembleChampionRunesPanel(
  perRune: typeof runesPerRuneData.value,
  sets: typeof runesData.value,
  shardsApi: typeof runesShardsData.value
): ChampionRunesPanelPayload | null {
  const totalParticipants = Number(
    perRune?.totalGames ?? sets?.totalGames ?? shardsApi?.totalGames ?? 0
  )
  const runes = perRune?.runes ?? []
  const runeSets = sets?.runes ?? []
  const shardsFromApi = shardsApi?.shards ?? []
  let shards = shardsFromApi
  if (!shards.length && runeSets.length) {
    const shardAgg = new Map<
      string,
      { shardId: number; slot: number; games: number; wins: number }
    >()
    for (const set of runeSets) {
      const setShards = Array.isArray(set.shards) ? set.shards : []
      if (!setShards.length) continue
      const setGames = Number(set.games ?? 0)
      const setWins = Number(set.wins ?? 0)
      setShards.forEach((shardId, slot) => {
        if (!Number.isFinite(shardId) || shardId <= 0) return
        const key = `${slot}:${shardId}`
        const prev = shardAgg.get(key) ?? { shardId, slot, games: 0, wins: 0 }
        prev.games += setGames
        prev.wins += setWins
        shardAgg.set(key, prev)
      })
    }
    shards = Array.from(shardAgg.values()).map(s => ({
      shardId: s.shardId,
      slot: s.slot,
      games: s.games,
      wins: s.wins,
      pickrate: totalParticipants > 0 ? Math.round((10000 * s.games) / totalParticipants) / 100 : 0,
      winrate: s.games > 0 ? Math.round((10000 * s.wins) / s.games) / 100 : 0,
    }))
  }
  if (!runes.length && !runeSets.length && !shards.length) return null
  return { totalParticipants, runes, runeSets, shards }
}
function detectTrendDivisionPresetFromFilter(): TrendDivisionPreset {
  const rank = filterRank.value
  if (rank.length === 0) return 'selected'
  for (const key of ['average', 'skilled', 'elite'] as const) {
    if (rankTierSelectionsEqual(rank, TREND_PRESET_TIERS[key])) return key
  }
  return 'selected'
}

function syncTrendDivisionPresetFromFilter(): void {
  const detected = detectTrendDivisionPresetFromFilter()
  if (trendDivisionPreset.value !== detected) trendDivisionPreset.value = detected
}

function toggleRankFilter(tier: string) {
  const arr = filterRank.value
  const idx = arr.indexOf(tier)
  if (idx >= 0) {
    filterRank.value = arr.filter((_, i) => i !== idx)
  } else {
    filterRank.value = [...arr, tier]
  }
  syncTrendDivisionPresetFromFilter()
}

function selectAllChampionDivisions() {
  filterRank.value = []
  trendDivisionPreset.value = 'selected'
}

function resetChampionFilters() {
  filterVersion.value = ''
  filterRank.value = []
  trendDivisionPreset.value = 'selected'
  filterRole.value = ''
  championProgressionFromVersionOverride.value = ''
  trendChartFromDate.value = ''
  championSearchQueryPlaceholder.value = ''
  championSpellsModeFilter.value = 'solo'
}

function overviewQueryParams() {
  const p = new URLSearchParams()
  if (filterVersion.value) p.set('version', filterVersion.value)
  for (const t of filterRank.value) p.append('rankTier', t)
  if (filterRole.value) p.set('role', filterRole.value)
  return p.toString() ? '?' + p.toString() : ''
}

function championBaselineQueryParams() {
  const refV = (championProgressionFromVersion.value ?? '').trim()
  if (!refV) return null
  const p = new URLSearchParams()
  p.set('version', refV)
  for (const t of filterRank.value) p.append('rankTier', t)
  if (filterRole.value) p.set('role', filterRole.value)
  return '?' + p.toString()
}

/** Logs de perf (dev ou ?stats_perf=1) pour la page champion. */
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
// Runes / spells tabs context: same contract as the index page (RunesSpellsTabCtx), values per active tab.
const championStatisticsPageCtx: RunesSpellsTabCtx = reactive({
  t,
  gameVersion: computed(() => gameVersion.value || versionStore.currentVersion || ''),
  versionStore,
  spellsModeFilter: championSpellsModeFilter,
  championSearchQuery: '',
  PAGE_SIZE_OPTIONS,
  overviewDetailData: computed(() =>
    activeChampionTab.value === 'runes'
      ? championRunesPanelData.value
      : {
          summonerSpells: championSpellsTableSolo.value,
          summonerSpellSets: championSpellsTablePairs.value,
        }
  ),
  overviewDetailBaselineData: computed(() =>
    activeChampionTab.value === 'runes'
      ? championRunesBaselinePanelData.value
      : {
          summonerSpells: mapChampionSpellsTableSolo(championSpellsBaselineSolo.value),
          summonerSpellSets: mapChampionSpellsTablePairs(championSpellsBaselineDuos.value),
        }
  ),
  overviewDetailComparisonVersion: championRunesComparisonVersion,
  overviewDetailBaselinePending: computed(() =>
    activeChampionTab.value === 'runes'
      ? championRunesBaselinePending.value
      : championSpellsBaselinePending.value
  ),
  overviewDetailPending: computed(() =>
    activeChampionTab.value === 'runes' ? runesPending.value : championSpellsPending.value
  ),
  overviewDetailError: false,
  retryOverviewDetail: () => {
    if (activeChampionTab.value === 'runes') {
      _loadRunes().catch(() => undefined)
    } else if (activeChampionTab.value === 'spells') {
      _loadChampionSpells().catch(() => undefined)
    }
  },
})

provide('statisticsPageCtx', championStatisticsPageCtx)

async function loadChampion() {
  if (!championId.value || Number.isNaN(championId.value)) {
    error.value = 'Invalid champion'
    pending.value = false
    return
  }
  const t = statsPerfStart('loadChampion')
  const showPending = !championStats.value
  if (showPending) pending.value = true
  error.value = null
  try {
    const url = apiUrl(`/api/stats/champions/${championId.value}${queryParams()}`)
    const data = await statsFetch(url)
    championStats.value = data as typeof championStats.value
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    championStats.value = null
  } finally {
    pending.value = false
    statsPerfEnd('loadChampion', t)
  }
}

async function loadChampionDamageSplit() {
  if (!championId.value || Number.isNaN(championId.value)) {
    championDamageSplit.value = null
    return
  }
  try {
    const q = queryParams()
    const data = await statsFetch<{
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
    }>(apiUrl(`/api/stats/champions/${championId.value}/damage-split${q}`))
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
      championDamageSplit.value = null
      return
    }
    championDamageSplit.value = {
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
  } catch {
    championDamageSplit.value = null
  }
}

async function _loadBuilds() {
  if (!championId.value) return
  const t = statsPerfStart('loadBuilds')
  buildsPending.value = true
  try {
    const q = queryParams()
    buildsData.value = await statsFetch(
      apiUrl(`/api/stats/champions/${championId.value}/builds${q ? q + '&' : '?'}minGames=10`)
    )
  } catch {
    buildsData.value = null
  } finally {
    buildsPending.value = false
    statsPerfEnd('loadBuilds', t)
  }
}

async function _loadRunes() {
  if (!championId.value) return
  const t = statsPerfStart('loadRunes')
  runesPending.value = true
  const cmp = championRunesComparisonVersion.value
  championRunesBaselinePending.value = Boolean(cmp)
  const q = queryParams()
  const qSuffix = q ? `${q}&` : '?'
  const bq = cmp ? queryParams(cmp) : null
  const bSuffix = bq ? `${bq}&` : null
  try {
    const fetches: Promise<unknown>[] = [
      statsFetch(
        apiUrl(`/api/stats/champions/${championId.value}/runes${qSuffix}minGames=10`)
      ).catch(() => null),
      statsFetch(
        apiUrl(`/api/stats/champions/${championId.value}/runes-per-rune${qSuffix}minGames=10`)
      ).catch(() => null),
      statsFetch(
        apiUrl(`/api/stats/champions/${championId.value}/shards${qSuffix}minGames=10`)
      ).catch(() => null),
    ]
    if (cmp && bSuffix) {
      fetches.push(
        statsFetch(
          apiUrl(`/api/stats/champions/${championId.value}/runes${bSuffix}minGames=10`)
        ).catch(() => null),
        statsFetch(
          apiUrl(`/api/stats/champions/${championId.value}/runes-per-rune${bSuffix}minGames=10`)
        ).catch(() => null),
        statsFetch(
          apiUrl(`/api/stats/champions/${championId.value}/shards${bSuffix}minGames=10`)
        ).catch(() => null)
      )
    }
    const results = await Promise.all(fetches)
    runesData.value = results[0] as typeof runesData.value
    runesPerRuneData.value = results[1] as typeof runesPerRuneData.value
    runesShardsData.value = results[2] as typeof runesShardsData.value
    if (cmp && bSuffix) {
      runesBaselineSets.value = results[3] as typeof runesBaselineSets.value
      runesBaselinePerRune.value = results[4] as typeof runesBaselinePerRune.value
      runesBaselineShards.value = results[5] as typeof runesBaselineShards.value
    } else {
      runesBaselineSets.value = null
      runesBaselinePerRune.value = null
      runesBaselineShards.value = null
    }
  } catch {
    runesData.value = null
    runesPerRuneData.value = null
    runesShardsData.value = null
    runesBaselineSets.value = null
    runesBaselinePerRune.value = null
    runesBaselineShards.value = null
  } finally {
    runesPending.value = false
    championRunesBaselinePending.value = false
    statsPerfEnd('loadRunes', t)
  }
}

async function loadMatchupsExtended() {
  if (!championId.value) return
  const t0 = statsPerfStart('loadMatchupsExtended')
  matchupsExtPending.value = true
  matchupsExtError.value = null
  try {
    const params = new URLSearchParams()
    const effectiveVersion = filterVersion.value || gameVersion.value || ''
    if (effectiveVersion) params.set('version', effectiveVersion)
    const referenceVersion = championProgressionFromVersion.value
    if (referenceVersion && referenceVersion !== effectiveVersion) {
      params.set('fromVersion', referenceVersion)
    }
    for (const tier of filterRank.value) params.append('rankTier', tier)
    if (filterRole.value) params.set('role', filterRole.value)
    params.set('minGames', '10')
    params.set('limit', '100')
    matchupsExtData.value = await statsFetch(
      apiUrl(`/api/stats/champions/${championId.value}/matchups-extended?${params.toString()}`)
    )
  } catch (e) {
    matchupsExtData.value = null
    matchupsExtError.value = e instanceof Error ? e.message : String(e)
  } finally {
    matchupsExtPending.value = false
    statsPerfEnd('loadMatchupsExtended', t0)
  }
}

async function loadSynergyExtended() {
  if (!championId.value) return
  const t0 = statsPerfStart('loadSynergyExtended')
  synergyExtPending.value = true
  synergyExtError.value = null
  try {
    const params = new URLSearchParams()
    const effectiveVersion = filterVersion.value || gameVersion.value || ''
    if (effectiveVersion) params.set('version', effectiveVersion)
    const referenceVersion = championProgressionFromVersion.value
    if (referenceVersion && referenceVersion !== effectiveVersion) {
      params.set('fromVersion', referenceVersion)
    }
    for (const tier of filterRank.value) params.append('rankTier', tier)
    if (filterRole.value) params.set('role', filterRole.value)
    params.set('minGames', '10')
    params.set('limit', '100')
    synergyExtData.value = await statsFetch(
      apiUrl(`/api/stats/champions/${championId.value}/synergy-extended?${params.toString()}`)
    )
  } catch (e) {
    synergyExtData.value = null
    synergyExtError.value = e instanceof Error ? e.message : String(e)
  } finally {
    synergyExtPending.value = false
    statsPerfEnd('loadSynergyExtended', t0)
  }
}

async function _loadDetail() {
  const t = statsPerfStart('loadDetail')
  detailPending.value = true
  try {
    const q = overviewQueryParams() ? overviewQueryParams() + '&' : '?'
    detailData.value = await statsFetch(apiUrl('/api/stats/overview-detail' + q + 'includeSmite=1'))
  } catch {
    detailData.value = null
  } finally {
    detailPending.value = false
    statsPerfEnd('loadDetail', t)
  }
}

async function _loadChampionSpells() {
  if (!championId.value) return
  const t = statsPerfStart('loadChampionSpells')
  const skillChampion = championByKey(championId.value)
  if (skillChampion?.id) {
    await championsStore.loadChampionDetails(skillChampion.id, riotLocale.value).catch(() => null)
  }
  championSpellsPending.value = true
  championSpellsData.value = null
  championSpellsDuosData.value = null
  championSpellOrdersData.value = null
  const cmp = championSpellsComparisonVersion.value
  championSpellsBaselinePending.value = Boolean(cmp)
  const q = queryParams()
  const bq = cmp ? queryParams(cmp) : null
  try {
    type SpellsSolo = { totalGames: number; spells: ChampionSpellSoloApiRow[] }
    type SpellsDuos = { totalGames: number; duos: ChampionSpellDuoApiRow[] }
    const base = `/api/stats/champions/${championId.value}`
    const baselineFetch =
      cmp && bq
        ? Promise.allSettled([
            statsFetch<SpellsSolo>(apiUrl(`${base}/summoner-spells${bq}`)),
            statsFetch<SpellsDuos>(apiUrl(`${base}/summoner-spells-duos${bq}`)),
          ])
        : null
    const [solo, duos, orders] = await Promise.allSettled([
      statsFetch<SpellsSolo>(apiUrl(`${base}/summoner-spells${q || ''}`)),
      statsFetch<SpellsDuos>(apiUrl(`${base}/summoner-spells-duos${q || ''}`)),
      statsFetch<NonNullable<typeof championSpellOrdersData.value>>(
        apiUrl(`${base}/spell-orders${q || ''}`)
      ),
    ])
    championSpellsData.value = solo.status === 'fulfilled' ? solo.value : null
    championSpellsDuosData.value = duos.status === 'fulfilled' ? duos.value : null
    championSpellOrdersData.value = orders.status === 'fulfilled' ? orders.value : null
    if (baselineFetch) {
      const [baseSolo, baseDuos] = await baselineFetch
      championSpellsBaselineSolo.value =
        baseSolo.status === 'fulfilled' ? baseSolo.value.spells : []
      championSpellsBaselineDuos.value = baseDuos.status === 'fulfilled' ? baseDuos.value.duos : []
    } else {
      championSpellsBaselineSolo.value = []
      championSpellsBaselineDuos.value = []
    }
  } catch {
    championSpellsData.value = null
    championSpellsDuosData.value = null
    championSpellOrdersData.value = null
    championSpellsBaselineSolo.value = []
    championSpellsBaselineDuos.value = []
  } finally {
    championSpellsPending.value = false
    championSpellsBaselinePending.value = false
    statsPerfEnd('loadChampionSpells', t)
  }
}

async function loadChampionObjectives() {
  if (!championId.value) return
  const t0 = statsPerfStart('loadChampionObjectives')
  championObjectivesPending.value = true
  try {
    championObjectivesData.value = await statsFetch<ChampionObjectivesSummary>(
      apiUrl(`/api/stats/champions/${championId.value}/objectives${overviewQueryParams()}`)
    )
  } catch {
    championObjectivesData.value = null
  } finally {
    championObjectivesPending.value = false
    statsPerfEnd('loadChampionObjectives', t0)
  }
}

async function loadChampionDashboard() {
  if (!championId.value) return
  championDashboardPending.value = true
  try {
    championDashboardData.value = await statsFetch<ChampionDashboardSummary>(
      apiUrl(`/api/stats/champions/${championId.value}/dashboard${overviewQueryParams()}`)
    )
  } catch {
    championDashboardData.value = null
  } finally {
    championDashboardPending.value = false
  }
}

async function loadChampionMisc() {
  if (!championId.value) return
  championMiscPending.value = true
  try {
    championMiscData.value = await statsFetch<ChampionMiscSummary>(
      apiUrl(`/api/stats/champions/${championId.value}/misc${overviewQueryParams()}`)
    )
  } catch {
    championMiscData.value = null
  } finally {
    championMiscPending.value = false
  }
}

async function loadChampionPings() {
  if (!championId.value) return
  championPingsPending.value = true
  championPingsBaselineData.value = null
  try {
    const baselineQ = championBaselineQueryParams()
    const [current, baseline] = await Promise.all([
      statsFetch<ChampionPingsSummary>(
        apiUrl(`/api/stats/champions/${championId.value}/pings${overviewQueryParams()}`)
      ),
      baselineQ
        ? statsFetch<ChampionPingsSummary>(
            apiUrl(`/api/stats/champions/${championId.value}/pings${baselineQ}`)
          ).catch(() => null)
        : Promise.resolve(null),
    ])
    championPingsData.value = current
    championPingsBaselineData.value = baseline && Number(baseline.games ?? 0) > 0 ? baseline : null
  } catch {
    championPingsData.value = null
    championPingsBaselineData.value = null
  } finally {
    championPingsPending.value = false
  }
}

async function loadChampionVision() {
  if (!championId.value) return
  championVisionPending.value = true
  championVisionBaselineData.value = null
  try {
    const baselineQ = championBaselineQueryParams()
    const [current, baseline] = await Promise.all([
      statsFetch<ChampionVisionSummary>(
        apiUrl(`/api/stats/champions/${championId.value}/vision${overviewQueryParams()}`)
      ),
      baselineQ
        ? statsFetch<ChampionVisionSummary>(
            apiUrl(`/api/stats/champions/${championId.value}/vision${baselineQ}`)
          ).catch(() => null)
        : Promise.resolve(null),
    ])
    championVisionData.value = current
    championVisionBaselineData.value = baseline && Number(baseline.games ?? 0) > 0 ? baseline : null
  } catch {
    championVisionData.value = null
    championVisionBaselineData.value = null
  } finally {
    championVisionPending.value = false
  }
}

/** Query durée par tier : version + rôle seulement (rankTier non envoyé ; ligues = presets des graphes). */
async function loadTrendSnapshots() {
  if (!championId.value) return
  const t = statsPerfStart('loadTrendSnapshots')
  trendPending.value = true
  trendError.value = null
  try {
    const params = new URLSearchParams()
    if (filterRole.value) params.set('role', filterRole.value)
    for (const tier of filterRank.value) {
      const normalized = String(tier || '')
        .trim()
        .toUpperCase()
        .split('_')[0]
      if (normalized) params.append('rankTier', normalized)
    }
    const userFrom = normalizeTrendChartFromDate(trendChartFromDate.value)
    params.set(
      'from',
      resolveTrendSnapshotsQueryFrom({
        userFrom,
        rangeMode: trendRangeMode.value,
        monthsWindow: trendMonthsWindow.value,
      })
    )
    params.set('limit', '1200')
    const query = params.toString()
    const data = await statsFetch<{ points?: TrendSnapshotPoint[] }>(
      apiUrl(
        `/api/stats/champions/${championId.value}/tier-trend-snapshots${query ? `?${query}` : ''}`
      )
    )
    trendPoints.value = Array.isArray(data?.points) ? data.points : []
  } catch (e) {
    trendPoints.value = []
    trendError.value = e instanceof Error ? e.message : String(e)
  } finally {
    trendPending.value = false
    statsPerfEnd('loadTrendSnapshots', t)
  }
}

async function loadChampionDataForTab(tab: ChampionTabId, force = false): Promise<void> {
  if (!championPageBootstrapped.value) return
  if (!championId.value || Number.isNaN(championId.value)) return
  if (!force && championTabLoaded.value[tab]) return
  if (tab === 'overview') {
    await Promise.all([
      loadTrendSnapshots(),
      _loadChampionSpells(),
      _loadBuilds(),
      loadChampionDashboard(),
      loadMatchupsExtended(),
    ])
    markChampionTabLoaded('overview')
    return
  }
  if (tab === 'dashboard') {
    await loadChampionDashboard()
    markChampionTabLoaded('dashboard')
    return
  }
  if (tab === 'matchups') {
    await loadMatchupsExtended()
    markChampionTabLoaded('matchups')
    return
  }
  if (tab === 'synergy') {
    await loadSynergyExtended()
    markChampionTabLoaded('synergy')
    return
  }
  if (tab === 'runes') {
    await _loadRunes()
    markChampionTabLoaded('runes')
    return
  }
  if (tab === 'spells' || tab === 'skills') {
    await _loadChampionSpells()
    markChampionTabLoaded(tab)
    return
  }
  if (tab === 'objectives') {
    await loadChampionObjectives()
    markChampionTabLoaded('objectives')
    return
  }
  if (tab === 'pings' || tab === 'vision') {
    await Promise.all([loadChampionPings(), loadChampionVision()])
    markChampionTabLoaded('pings')
    markChampionTabLoaded('vision')
    return
  }
  if (tab === 'misc') {
    await loadChampionMisc()
    markChampionTabLoaded('misc')
    return
  }
  if (tab === 'builds') markChampionTabLoaded('builds')
}

async function reloadChampionBaseAndActiveTabData(): Promise<void> {
  if (!championPageBootstrapped.value) return
  if (!championId.value || Number.isNaN(championId.value)) return
  if (championBaseStatsFromSsr && championStats.value) {
    // Stats de base déjà fournies par le SSR pour ces paramètres : on saute le
    // refetch identique une seule fois, puis on charge le reste (damage split, onglet).
    championBaseStatsFromSsr = false
  } else {
    await loadChampion()
  }
  loadChampionDamageSplit().catch(() => undefined)
  resetChampionTabLoadState()
  await loadChampionDataForTab(activeChampionTab.value, true)
}

const TREND_CHART_W = 620
const TREND_CHART_H = 220
const TREND_CHART_PAD = { left: 40, right: 16, top: 12, bottom: 30 }
const TREND_PLOT_W = TREND_CHART_W - TREND_CHART_PAD.left - TREND_CHART_PAD.right
const TREND_PLOT_H = TREND_CHART_H - TREND_CHART_PAD.top - TREND_CHART_PAD.bottom

type TrendMetricId = 'games' | 'winrate' | 'pickrate' | 'banrate'
type TrendMetricDef = { id: TrendMetricId; title: string }
type TrendTooltipState = {
  metricId: TrendMetricId
  tier: string
  bucketLabel: string
  value: number
  mouseX: number
  mouseY: number
}

const trendMetricDefs = computed<TrendMetricDef[]>(() => [
  { id: 'games', title: t('statisticsPage.championStatsTrendGames') },
  { id: 'winrate', title: t('statisticsPage.championStatsTrendWinrate') },
  { id: 'pickrate', title: t('statisticsPage.championStatsTrendPickrate') },
  { id: 'banrate', title: t('statisticsPage.championStatsTrendBanrate') },
])
const trendTooltip = ref<TrendTooltipState | null>(null)
const hiddenLegendTiers = ref<string[]>([])
function isLegendTierVisible(tier: string): boolean {
  return !hiddenLegendTiers.value.includes(String(tier))
}
function toggleLegendTierVisibility(tier: string): void {
  const key = String(tier)
  if (!key) return
  if (hiddenLegendTiers.value.includes(key)) {
    hiddenLegendTiers.value = hiddenLegendTiers.value.filter(t => t !== key)
    return
  }
  hiddenLegendTiers.value = [...hiddenLegendTiers.value, key]
}
function isoWeekBucket(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return dateIso
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

function resolvePatchLabelForDate(dateIso: string): string {
  const catalog = trendVersionsCatalog.value
  if (!catalog.length) return dateIso.slice(0, 7)
  const ts = new Date(`${dateIso}T00:00:00.000Z`).getTime()
  if (!Number.isFinite(ts)) return dateIso.slice(0, 7)
  let match: string | null = null
  for (const entry of catalog) {
    const ets = new Date(`${entry.releaseDate}T00:00:00.000Z`).getTime()
    if (!Number.isFinite(ets)) continue
    if (ets <= ts) match = entry.patchLabel
    else break
  }
  return match ?? catalog[0]?.patchLabel ?? dateIso.slice(0, 7)
}

const trendTiersFromFilterOrData = computed(() => {
  const selected = Array.from(new Set(filterRank.value.map(normalizeRankTier))).filter(Boolean)
  if (selected.length) return selected
  const fromData = Array.from(
    new Set(trendPoints.value.map(p => normalizeRankTier(p.rankTier)))
  ).filter(Boolean)
  return fromData.sort((a, b) => compareRankTiers(a, b))
})

const trendSelectedTiers = computed(() => trendTiersFromFilterOrData.value)

/** Tiers affichés sur le graphe durée (fallback API si pas de snapshots tendance). */
type TrendBucket = {
  key: string
  label: string
  ts: number
  byTier: Map<
    string,
    { games: number; wins: number; pickNum: number; banNum: number; weight: number }
  >
}

const trendBuckets = computed(() => {
  const map = new Map<string, TrendBucket>()
  for (const p of trendPoints.value) {
    const tier = normalizeRankTier(p.rankTier)
    if (!tier) continue
    const dateIso = p.dateOfGame
    let key = dateIso
    let label = dateIso.slice(5)
    if (trendGranularity.value === 'week') {
      key = isoWeekBucket(dateIso)
      label = key
    } else if (trendGranularity.value === 'month') {
      key = `${dateIso.slice(0, 7)}-01`
      label = dateIso.slice(0, 7)
    } else if (trendGranularity.value === 'patch') {
      key = resolvePatchLabelForDate(dateIso)
      label = key
    }
    const ts =
      trendGranularity.value === 'patch'
        ? new Date(`${dateIso}T00:00:00.000Z`).getTime()
        : new Date(`${key}T00:00:00.000Z`).getTime()
    if (!map.has(key)) map.set(key, { key, label, ts, byTier: new Map() })
    const bucket = map.get(key)
    if (!bucket) continue
    bucket.ts = Number.isFinite(bucket.ts) ? Math.min(bucket.ts, ts) : ts
    const prev = bucket.byTier.get(tier) ?? { games: 0, wins: 0, pickNum: 0, banNum: 0, weight: 0 }
    const games = Number(p.games) || 0
    const cohort =
      Number(p.cohortPicks) > 0
        ? Number(p.cohortPicks)
        : games > 0 && Number(p.pickRatePct) > 0
          ? Math.round((games * 100) / Number(p.pickRatePct))
          : 0
    const banCount =
      p.banCount != null && Number.isFinite(Number(p.banCount))
        ? Number(p.banCount)
        : cohort > 0
          ? Math.round((Number(p.banRatePct) || 0) * cohort) / 100
          : 0
    prev.games += games
    prev.wins += Number(p.wins) || 0
    prev.pickNum += games
    prev.banNum += banCount
    prev.weight += cohort > 0 ? cohort : games
    bucket.byTier.set(tier, prev)
  }
  const sorted = Array.from(map.values()).sort((a, b) => a.ts - b.ts)
  if (!sorted.length) return sorted
  const latestTs = sorted[sorted.length - 1]?.ts ?? 0
  if (!Number.isFinite(latestTs) || latestTs <= 0) return sorted
  const daysBack = trendDaysBackFromRangeMode(trendRangeMode.value, trendMonthsWindow.value)
  const minTs = latestTs - (daysBack - 1) * 24 * 60 * 60 * 1000
  return sorted.filter(b => b.ts >= minTs)
})

type TrendSeriesPoint = {
  idx: number
  x: number
  y: number
  value: number
  bucketLabel: string
  games?: number
}
type TrendSeries = { tier: string; color: string; path: string; points: TrendSeriesPoint[] }
type TrendChartCard = {
  metricId: TrendMetricId
  title: string
  series: TrendSeries[]
  xTicks: Array<{ index: number; x: number; label: string }>
  yTicks: Array<{ value: number; y: number; label: string }>
}

function metricValue(
  metric: TrendMetricId,
  raw: { games: number; wins: number; pickNum: number; banNum: number; weight: number }
): number {
  if (metric === 'games') return raw.games
  if (metric === 'winrate') return raw.games > 0 ? (100 * raw.wins) / raw.games : 0
  if (metric === 'pickrate') return raw.weight > 0 ? (100 * raw.pickNum) / raw.weight : 0
  return raw.weight > 0 ? (100 * raw.banNum) / raw.weight : 0
}

function formatTrendValue(metric: TrendMetricId, value: number): string {
  if (metric === 'games') return `${Math.round(value)}`
  return `${Number(value).toFixed(2)}%`
}

function onTrendPointHover(
  event: MouseEvent,
  metricId: TrendMetricId,
  tier: string,
  pt: { bucketLabel: string; value: number }
) {
  trendTooltip.value = {
    metricId,
    tier,
    bucketLabel: pt.bucketLabel,
    value: pt.value,
    mouseX: event.clientX,
    mouseY: event.clientY,
  }
}

const trendLevel = ref<TrendLevel>('all')
const trendLevelOptions = computed(() => [
  { id: 'all' as const, label: t('statisticsPage.ovEvoLevelAll') },
  { id: 'average' as const, label: t('statisticsPage.balanceLevelAverage') },
  { id: 'skilled' as const, label: t('statisticsPage.balanceLevelSkilled') },
  { id: 'elite' as const, label: t('statisticsPage.balanceLevelElite') },
])

const trendChartCards = computed<TrendChartCard[]>(() => {
  const buckets = trendBuckets.value
  const tiers = trendTiersForLevel(trendSelectedTiers.value, trendLevel.value)
  const tierSet = new Set(tiers)
  if (!buckets.length || !tiers.length) return []
  const n = buckets.length
  const xAt = (index: number) =>
    TREND_CHART_PAD.left + (n <= 1 ? 0 : index / (n - 1)) * TREND_PLOT_W
  return trendMetricDefs.value.map(metric => {
    const globalRawByIndex: Array<{
      games: number
      wins: number
      pickNum: number
      banNum: number
      weight: number
    }> = buckets.map(() => ({ games: 0, wins: 0, pickNum: 0, banNum: 0, weight: 0 }))

    buckets.forEach((bucket, index) => {
      const global = globalRawByIndex[index]
      if (!global) return
      for (const [tierKey, raw] of bucket.byTier) {
        const tierNorm = normalizeRankTier(tierKey)
        if (!tierNorm || !tierSet.has(tierNorm)) continue
        global.games += raw.games
        global.wins += raw.wins
        global.pickNum += raw.pickNum
        global.banNum += raw.banNum
        global.weight += raw.weight
      }
    })

    type PendingSerie = {
      tier: string
      color: string
      rawValues: Array<{ idx: number; value: number; bucketLabel: string }>
    }
    const pendingSeries: PendingSerie[] = (trendShowDivisions.value ? tiers : []).map(tier => {
      const rawValues: Array<{ idx: number; value: number; bucketLabel: string }> = []
      buckets.forEach((bucket, index) => {
        const raw = bucket.byTier.get(tier)
        if (!raw) return
        rawValues.push({
          idx: index,
          value: metricValue(metric.id, raw),
          bucketLabel: bucket.label,
        })
      })
      return {
        tier,
        color: RANK_TIER_COLORS[tier] ?? '#64748b',
        rawValues,
      }
    })

    if (trendShowGlobalLine.value || !trendShowDivisions.value) {
      const rawValues: Array<{ idx: number; value: number; bucketLabel: string }> = []
      globalRawByIndex.forEach((raw, idx) => {
        if (raw.weight <= 0 && raw.games <= 0) return
        rawValues.push({
          idx,
          value: metricValue(metric.id, raw),
          bucketLabel: buckets[idx]?.label ?? '',
        })
      })
      if (rawValues.length) {
        pendingSeries.push({
          tier: 'GLOBAL',
          color: trendShowDivisions.value ? (RANK_TIER_COLORS.GLOBAL ?? '#c084fc') : '#c89b3c',
          rawValues,
        })
      }
    }

    const smoothedByTier = pendingSeries.map(serie => {
      const smoothed = smoothSeries(
        serie.rawValues.map(v => v.value),
        3
      )
      return {
        ...serie,
        smoothValues: smoothed,
      }
    })

    const allValues = smoothedByTier.flatMap(s => s.smoothValues).filter(v => Number.isFinite(v))
    const domain = trendChartDomain(
      allValues.length ? Math.min(...allValues) : 0,
      allValues.length ? Math.max(...allValues) : 1,
      metric.id
    )
    const domainMin = domain.min
    const domainMax = domain.max
    const domainSpan = Math.max(1e-6, domainMax - domainMin)

    const series: TrendSeries[] = smoothedByTier.map(serie => {
      const points: TrendSeriesPoint[] = serie.rawValues.map((v, i) => {
        const value = serie.smoothValues[i] ?? v.value
        return {
          idx: v.idx,
          x: xAt(v.idx),
          y: TREND_CHART_PAD.top + (1 - (value - domainMin) / domainSpan) * TREND_PLOT_H,
          value,
          bucketLabel: v.bucketLabel,
        }
      })
      return {
        tier: serie.tier,
        color: serie.color,
        path: svgLinePath(points.map(p => ({ x: p.x, y: p.y }))),
        points,
      }
    })

    const yTicks: Array<{ value: number; y: number; label: string }> = []
    for (let i = 0; i <= 4; i += 1) {
      const value = domainMin + (domainSpan * i) / 4
      const y = TREND_CHART_PAD.top + (1 - i / 4) * TREND_PLOT_H
      yTicks.push({
        value,
        y,
        label: metric.id === 'games' ? `${Math.round(value)}` : `${value.toFixed(1)}%`,
      })
    }
    const tickCount = Math.min(6, Math.max(2, buckets.length))
    const step =
      buckets.length <= 1 ? 1 : Math.max(1, Math.floor((buckets.length - 1) / (tickCount - 1)))
    const xTicks: Array<{ index: number; x: number; label: string }> = []
    for (let i = 0; i < buckets.length; i += step) {
      const b = buckets[i]
      if (!b) continue
      xTicks.push({ index: i, x: xAt(i), label: b.label })
    }
    const lastIdx = buckets.length - 1
    if (!xTicks.some(t => t.index === lastIdx)) {
      const b = buckets[lastIdx]
      if (b) xTicks.push({ index: lastIdx, x: xAt(lastIdx), label: b.label })
    }
    return {
      metricId: metric.id,
      title: metric.title,
      series: series.filter(s => s.path.length > 0),
      xTicks,
      yTicks,
    }
  })
})

const trendFocusCards = computed(() =>
  trendCardsForFocus(trendChartCards.value, trendFocusMetric.value)
)

const ovSkill = computed(() => {
  const row = mainSkillOrder(championSpellOrdersRows.value)
  if (!row) return null
  return {
    ...skillPriority(row.order),
    winrate: row.winrate,
    pickrate: row.pickrate,
    games: row.games,
  }
})
const ovSpells = computed<OverviewIconRow[]>(() =>
  championSpellsTableSolo.value.slice(0, 4).map(r => {
    const img = _spellImageName(r.spellId)
    return {
      id: r.spellId,
      name: _spellName(r.spellId) ?? String(r.spellId),
      img: img ? _getSpellImageUrl(gameVersion.value, img) : '',
      pct: r.pickrate,
    }
  })
)
const ovItems = computed<OverviewIconRow[]>(() =>
  topItemsFromBuilds(buildsData.value?.builds ?? [], 8)
    .filter(r => _itemImageName(r.itemId))
    .slice(0, 5)
    .map(r => {
      const img = _itemImageName(r.itemId)
      return {
        id: r.itemId,
        name: _itemName(r.itemId) ?? String(r.itemId),
        img: img ? _getItemImageUrl(gameVersion.value, img) : '',
        games: r.games,
      }
    })
)
const ovRoles = computed(() =>
  overviewRoleRows(roleDistribution.value, LOW_SAMPLE_MIN_GAMES).map(r => ({
    ...r,
    label: roleLabel(r.role),
  }))
)
const ovProfile = computed(() => {
  const m = championDashboardData.value?.metrics
  return m ? profileColumns(m) : null
})
function ovMatchupRow(r: {
  opponentChampionId: number
  games: number
  winrate: number
}): OverviewIconRow {
  const c = championByKey(r.opponentChampionId)
  return {
    id: r.opponentChampionId,
    name: championName(r.opponentChampionId) ?? String(r.opponentChampionId),
    img: c?.image?.full ? getChampionImageUrl(gameVersion.value, c.image.full) : '',
    winrate: r.winrate,
    games: r.games,
  }
}
function hlRow(id: number, role: string, games: number, winrate: number): HighlightRow {
  const c = championByKey(id)
  return {
    id,
    name: championName(id) ?? String(id),
    img: c?.image?.full ? getChampionImageUrl(gameVersion.value, c.image.full) : '',
    sub: filterRole.value ? undefined : roleLabel(role),
    games,
    winrate,
  }
}
const matchupHlRows = computed(() =>
  filteredMatchupsExt.value.map(r => hlRow(r.opponentChampionId, r.role, r.games, r.winrate))
)
/** Mêmes filtres (recherche, profil de lane, OTP) que le tableau de ChampionSynergyTab. */
const synergyHlRows = computed(() =>
  (synergyExtData.value?.rows ?? [])
    .filter(
      r =>
        matchupMatchesSearch(r.allyChampionId) &&
        matchupMatchesLaneProfileFilter(r) &&
        matchupMatchesOtpFilter(r)
    )
    .map(r => hlRow(r.allyChampionId, r.allyRole, r.games, r.winrate))
)
const ovMatchups = computed(() => {
  const ex = matchupExtremes(matchupsExtData.value?.rows ?? [], LOW_SAMPLE_MIN_GAMES, 3)
  return { best: ex.best.map(ovMatchupRow), worst: ex.worst.map(ovMatchupRow) }
})
const ovMainRoleLabel = computed(() => {
  const r = roleDistribution.value[0]
  return r ? roleLabel(r.role) : ''
})
/** Section chemins de jungle : rôle filtré Jungle, ou Jungle = rôle principal. */
const showJunglePaths = computed(() =>
  filterRole.value ? filterRole.value === 'JUNGLE' : roleDistribution.value[0]?.role === 'JUNGLE'
)
const ovPending = computed(
  () => championSpellsPending.value || buildsPending.value || matchupsExtPending.value
)
function onOverviewGoTab(tab: 'spells' | 'items' | 'matchups'): void {
  activeChampionTab.value = tab === 'items' ? 'dashboard' : tab
}

watch(
  [
    championId,
    filterVersion,
    filterRank,
    filterRole,
    championProgressionFromVersion,
    trendChartFromDate,
  ],
  () => {
    if (!championPageBootstrapped.value) return
    if (!championId.value || Number.isNaN(championId.value)) return
    reloadChampionBaseAndActiveTabData().catch(() => undefined)
  }
)

if (import.meta.client) {
  watch(
    () => route.query.tab,
    tabRaw => {
      const tab = normalizeChampionTab(tabRaw)
      if (activeChampionTab.value !== tab) {
        activeChampionTab.value = tab
      }
    },
    { immediate: true }
  )
  watch(activeChampionTab, async tab => {
    scrollActiveChampionTabIntoView()
    loadChampionDataForTab(tab).catch(() => undefined)
    const current = normalizeChampionTab(route.query.tab)
    if (current === tab) return
    await router.replace({
      query: {
        ...route.query,
        tab,
      },
    })
  })
  watch(filterVersion, v => {
    syncChampionProgressionDeltaToVersionBeforeFilter()
    if (queryFirst(route.query.version as string | string[] | null | undefined) !== v.trim()) {
      router.replace({ query: withVersionQuery(route.query, v) }).catch(() => undefined)
    }
  })
  watch(
    () => versionsFromOverview.value.map(v => v.version).join('\n'),
    () => {
      if (!filterVersion.value) return
      if (championProgressionFromVersionOverride.value !== '') return
      syncChampionProgressionDeltaToVersionBeforeFilter()
    }
  )
  watch([trendRangeMode, trendMonthsWindow], () => {
    if (!championPageBootstrapped.value) return
    if (!championId.value || Number.isNaN(championId.value)) return
    if (activeChampionTab.value !== 'overview') return
    loadTrendSnapshots().catch(() => undefined)
  })
}

async function loadVersionsForFilter() {
  const t = statsPerfStart('loadVersionsForFilter')
  try {
    const data = await statsFetch<Record<string, unknown>>(apiUrl('/api/stats/overview'))
    const list = (data?.matchesByVersion ?? data?.matches_by_version ?? []) as Array<{
      version?: string
      matchCount?: number
    }>
    versionsFromOverview.value = Array.isArray(list)
      ? list
          .map(v => ({
            version: String(v.version ?? '').trim(),
            matchCount: Number(v.matchCount ?? 0),
          }))
          .filter(v => v.version)
          .sort((a, b) => compareVersionsDesc(a.version, b.version))
      : []
  } catch {
    versionsFromOverview.value = []
  } finally {
    statsPerfEnd('loadVersionsForFilter', t)
  }
  try {
    const versionsData = await statsFetch<{
      versions?: Array<{ version?: string; patchLabel?: string; releaseDate?: string }>
    }>('/data/game/versions.json')
    const rows =
      versionsData?.versions
        ?.map(v => ({
          patchLabel: String(v.patchLabel ?? v.version ?? '').trim(),
          releaseDate: String(v.releaseDate ?? '').trim(),
        }))
        .filter(v => v.patchLabel && /^\d{4}-\d{2}-\d{2}$/.test(v.releaseDate)) ?? []
    trendVersionsCatalog.value = rows.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
  } catch {
    trendVersionsCatalog.value = []
  }
}

if (import.meta.client) {
  statisticsUiStore.init()
  statisticsCustomStore.init()
}

onMounted(async () => {
  if (import.meta.client) {
    document.addEventListener('keydown', onFiltersEscapeKey)
  }
  const versionPromise = versionStore.currentVersion
    ? Promise.resolve()
    : versionStore.loadCurrentVersion()
  await Promise.all([
    versionPromise,
    loadVersionsForFilter(),
    championsStore.loadChampions(riotLocale.value),
    itemsStore.loadItems(riotLocale.value),
    runesStore.loadRunes(riotLocale.value),
    summonerSpellsStore.loadSummonerSpells(riotLocale.value),
  ])
  championPageBootstrapped.value = true
  if (championId.value && !Number.isNaN(championId.value)) {
    await reloadChampionBaseAndActiveTabData()
  }
  scrollActiveChampionTabIntoView('auto')
})

onUnmounted(() => {
  document.removeEventListener('keydown', onFiltersEscapeKey)
  if (import.meta.client) document.body.style.overflow = ''
})

useHead({
  title: () => {
    const name = resolvedChampionName.value
    if (!name) return t('statisticsPage.championStatsMetaTitleFallback')
    return t('statisticsPage.championStatsMetaTitle', {
      champion: name,
      season: lolSeasonFromGameVersion(
        displayedPatch(filterVersion.value, resolvedGamePatch.value)
      ),
      patch: displayedPatch(filterVersion.value, resolvedGamePatch.value),
    })
  },
})
useSeoMeta({
  description: () => {
    const name = resolvedChampionName.value
    const stats = championStats.value ?? championPageSsr.value?.stats
    if (name && stats) {
      return t('statisticsPage.championStatsMetaDescriptionWithStats', {
        champion: name,
        winrate: Number(stats.winrate).toFixed(1),
        pickrate: Number(stats.pickrate).toFixed(1),
        patch: resolvedGamePatch.value,
      })
    }
    if (name) {
      return t('statisticsPage.championStatsMetaDescription', {
        champion: name,
        season: lolSeasonFromGameVersion(resolvedGamePatch.value),
        patch: resolvedGamePatch.value,
      })
    }
    return t('statisticsPage.championStatsMetaDescriptionFallback')
  },
  ogTitle: () => {
    const name = resolvedChampionName.value
    if (!name) return t('statisticsPage.championStatsMetaTitleFallback')
    return t('statisticsPage.championStatsMetaTitle', {
      champion: name,
      season: lolSeasonFromGameVersion(resolvedGamePatch.value),
      patch: resolvedGamePatch.value,
    })
  },
})

const championStatsSiteUrl = useSiteUrl()
const championStatsOgImage = computed(() => {
  const slug = championRouteParam.value.toLowerCase()
  if (/^\d+$/.test(slug)) {
    const segment = championStatsSegment(championId.value, championsStore.champions)
    return pageOgImageUrl(championStatsSiteUrl, segment || 'default')
  }
  return pageOgImageUrl(championStatsSiteUrl, slug || 'default')
})
useSeoMeta({
  ogImage: championStatsOgImage,
  twitterImage: championStatsOgImage,
  twitterCard: 'summary_large_image',
})

const championStatsCanonicalUrl = computed(() =>
  absoluteSitePath(
    championStatsSiteUrl,
    `/statistics/champion/${championRouteParam.value.toLowerCase()}`
  )
)
const championStatsOgTitle = computed(() => {
  const name = resolvedChampionName.value
  if (!name) return t('statisticsPage.championStatsMetaTitleFallback')
  return t('statisticsPage.championStatsMetaTitle', {
    champion: name,
    season: lolSeasonFromGameVersion(resolvedGamePatch.value),
    patch: resolvedGamePatch.value,
  })
})
const championStatsOgDescription = computed(() => {
  const name = resolvedChampionName.value
  const stats = championStats.value ?? championPageSsr.value?.stats
  if (name && stats) {
    return t('statisticsPage.championStatsMetaDescriptionWithStats', {
      champion: name,
      winrate: Number(stats.winrate).toFixed(1),
      pickrate: Number(stats.pickrate).toFixed(1),
      patch: resolvedGamePatch.value,
    })
  }
  if (name) {
    return t('statisticsPage.championStatsMetaDescription', {
      champion: name,
      season: lolSeasonFromGameVersion(resolvedGamePatch.value),
      patch: resolvedGamePatch.value,
    })
  }
  return t('statisticsPage.championStatsMetaDescriptionFallback')
})
useOgMetaTags({
  title: championStatsOgTitle,
  description: championStatsOgDescription,
  image: championStatsOgImage,
  url: championStatsCanonicalUrl,
})

useJsonLdHead(
  'champion-stats-page',
  computed(() => {
    const name = championName(championId.value)
    const stats = championStats.value ?? championPageSsr.value?.stats
    if (!name || !stats) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: t('statisticsPage.championStatsMetaTitle', {
        champion: name,
        season: lolSeasonFromGameVersion(gameVersion.value),
        patch: gameVersion.value,
      }),
      description: t('statisticsPage.championStatsMetaDescriptionWithStats', {
        champion: name,
        winrate: Number(stats.winrate).toFixed(1),
        pickrate: Number(stats.pickrate).toFixed(1),
        patch: gameVersion.value || versionStore.currentVersion || '',
      }),
      url: absoluteSitePath(
        championStatsSiteUrl,
        `/statistics/champion/${championRouteParam.value}`
      ),
    }
  })
)

useJsonLdHead(
  'champion-stats-breadcrumb',
  computed(() => {
    const name = championName(championId.value)
    if (!name) return null
    return breadcrumbJsonLd(championStatsSiteUrl, [
      { name: 'Lelanation', path: '/' },
      { name: t('nav.statistics'), path: '/statistics' },
      { name, path: `/statistics/champion/${championRouteParam.value}` },
    ])
  })
)
</script>

<style scoped>
.champion-subtab {
  height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #463714;
  background: none;
  color: #f0e6d2;
  font-size: 14px;
  white-space: nowrap;
}
.champion-subtab:hover {
  border-color: #c8aa6e;
}
.champion-subtab.is-active {
  background: #0a323c;
  border-color: #0a323c;
  font-weight: 600;
}
.champion-ov-card {
  margin: 12px;
  padding: 20px 24px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.champion-ov-title {
  margin: 0 0 14px;
  font-size: 18px;
  font-weight: 600;
  color: #f0e6d2;
}
.champion-ov-sub {
  margin: 18px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #a09b8c;
}
.champion-ov-roles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.champion-ov-roles li {
  display: grid;
  grid-template-columns: 16px 90px minmax(0, 1fr) 64px 64px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.champion-ov-bar {
  height: 8px;
  border-radius: 4px;
  background: #1e2328;
  overflow: hidden;
}
.champion-ov-bar span {
  display: block;
  height: 100%;
  background: #c8aa6e;
}
.champion-ov-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.champion-ov-num.is-up {
  color: #0ac8b9;
}
.champion-ov-num.is-down {
  color: #e2665a;
}
.champion-ov-stack {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: #1e2328;
}
.champion-ov-stack .is-phys,
.champion-ov-legend .is-phys {
  background: #e2665a;
}
.champion-ov-stack .is-magic,
.champion-ov-legend .is-magic {
  background: #0ac8b9;
}
.champion-ov-stack .is-true,
.champion-ov-legend .is-true {
  background: #f0e6d2;
}
.champion-ov-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin: 8px 0 0;
  font-size: 12px;
  color: #a09b8c;
}
.champion-ov-legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 6px;
  vertical-align: -1px;
}
.champion-tabs-bar {
  background: none !important;
  border: 0 !important;
  box-shadow: none !important;
}
@media (max-width: 767px) {
  .champion-ov-card {
    margin: 0 0 12px;
    padding: 14px;
  }
  .champion-ov-roles li {
    grid-template-columns: 16px 70px minmax(0, 1fr) 52px 52px;
    gap: 8px;
    font-size: 12px;
  }
}
.champion-crumbs {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: #a09b8c;
  margin: 4px 0 20px;
}
.champion-crumbs a {
  color: #a09b8c;
  text-decoration: none;
}
.champion-crumbs a:hover {
  color: #f0e6d2;
}
.champion-crumbs .is-current {
  color: #f0e6d2;
}
.champion-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
}
.champion-hero-portrait {
  width: 96px;
  height: 96px;
  border-radius: 16px;
  border: 2px solid #c89b3c;
  object-fit: cover;
  flex-shrink: 0;
}
.champion-hero-id {
  flex: 1 1 260px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.champion-hero-name {
  margin: 0;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 48px;
  line-height: 1;
  text-transform: uppercase;
  color: #c8aa6e;
}
.champion-hero-sub {
  margin: 0;
  color: #cbc3b0;
}
.champion-hero-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.champion-hero-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 13px;
  background: #1e2328;
  font-size: 13px;
  font-weight: 600;
  color: #f0e6d2;
}
.champion-hero-pill.is-main {
  background: #0a323c;
}
.champion-hero-pill img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}
.champion-hero-kpis {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  flex: 2 1 520px;
}
.champion-hero-kpi {
  padding: 14px 16px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.champion-hero-kpi dt {
  font-size: 12px;
  color: #a09b8c;
}
.champion-hero-kpi dd {
  margin: 0;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: #f0e6d2;
}
.champion-hero-kpi dd.is-up {
  color: #0ac8b9;
}
.champion-hero-kpi dd.is-down {
  color: #e2665a;
}
.champion-group-nav {
  border-bottom: 1px solid #463714;
  margin-bottom: 8px;
}
.champion-group-btn {
  padding: 12px 16px;
  color: #a09b8c;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  font-size: 14px;
  background: none;
}
.champion-group-btn:hover {
  color: #f0e6d2;
}
.champion-group-btn.is-active {
  color: #f0e6d2;
  font-weight: 600;
  border-bottom-color: #c8aa6e;
}
@media (max-width: 767px) {
  .champion-crumbs {
    margin-bottom: 12px;
    font-size: 12px;
  }
  .champion-hero {
    gap: 14px;
    margin-bottom: 14px;
  }
  .champion-hero-portrait {
    width: 64px;
    height: 64px;
    border-radius: 12px;
  }
  .champion-hero-id {
    flex: 1 1 0;
  }
  .champion-hero-name {
    font-size: 32px;
  }
  .champion-hero-sub {
    font-size: 13px;
  }
  .champion-hero-kpis {
    flex: 1 1 100%;
    gap: 8px;
  }
  .champion-hero-kpi {
    padding: 10px;
  }
  .champion-hero-kpi dt {
    font-size: 11px;
  }
  .champion-hero-kpi dd {
    font-size: 18px;
    white-space: nowrap;
  }
  .champion-group-btn {
    padding: 10px 12px;
    font-size: 13px;
  }
}
@media (max-width: 1023px) {
  .champion-header-kpi {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .champion-header-kpi strong {
    font-size: 15px;
    letter-spacing: 0;
    text-transform: none;
    font-variant-numeric: tabular-nums;
  }
}

.filters-collapse-floating {
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.28);
  border-radius: 4px;
  background: rgb(var(--rgb-chrome) / 1);
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
.champion-stats aside {
  background: rgb(var(--rgb-chrome) / 1) !important;
}

.champion-donut-svg {
  width: 100px;
  height: 100px;
  display: block;
}
.champion-donut-bg {
  stroke: rgb(var(--rgb-primary) / 0.2);
}
.champion-donut-fill {
  transition: stroke-dashoffset 0.3s ease;
}
.champion-donut-pickrate {
  stroke: rgb(var(--rgb-accent));
}
.champion-donut-winrate {
  stroke: #22c55e;
}
.champion-donut-banrate {
  stroke: #ef4444;
}
.champion-donut-value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--rgb-text));
}
.champion-donut-title {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(var(--rgb-text) / 0.8);
}
.champion-role-filter-btn:focus {
  outline: 2px solid rgb(var(--rgb-accent));
  outline-offset: 1px;
}
.champion-role-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
</style>

<style>
/* Onglets : scroll snap + fade bords (aligné /statistics) */
/* width/overflow scroll rules in app.vue */
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
  .champion-stats .statistics-tab-btn {
    font-size: 13px;
    padding-left: 12px;
    padding-right: 12px;
  }
}
@media (max-width: 1023px) {
  .champion-stats .statistics-filters-panel .flex.min-h-0.flex-1 {
    overflow-y: auto;
  }
}

.champion-stats .statistics-champion-detail-link {
  touch-action: manipulation;
  -webkit-tap-highlight-color: rgb(var(--rgb-accent) / 0.2);
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  position: relative;
  z-index: 2;
}
.champion-stats
  .statistics-champion-detail-link
  :is(img, .champion-portrait, .champion-portrait *) {
  pointer-events: none;
}

.champion-stats .statistics-overview-surface {
  background-color: rgb(var(--rgb-chrome) / 1) !important;
}

.champion-stats .champion-overview-filters {
  row-gap: 0.5rem;
}

.champion-stats .champion-tab-panels {
  margin-top: 0;
}

.champion-stats .mu-legend {
  margin-bottom: 12px;
  padding: 12px 18px;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
  font-size: 12px;
  color: #a09b8c;
}
.champion-stats .mu-legend summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #c89b3c;
}
.champion-stats .mu-legend[open] summary {
  margin-bottom: 10px;
}
.champion-stats .mu-legend-body {
  max-width: 72rem;
}

.champion-stats .champion-tab-panel-flush {
  width: 100%;
  max-width: 100%;
  padding: 0;
  box-sizing: border-box;
}

.champion-stats .champion-tab-panel-flush .champion-tab-data-surface,
.champion-stats .champion-tab-panel-flush .champion-matchups-table-wrap,
.champion-stats .champion-tab-panel-flush .champion-synergy-table-wrap {
  width: 100%;
  max-width: 100%;
  margin-left: 0;
  margin-right: 0;
  border-radius: 0;
  border-left: none;
  border-right: none;
  background-color: rgb(8 16 31 / 0.45);
  border-top: 1px solid rgb(var(--rgb-primary) / 0.3);
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.3);
}

.champion-stats .champion-tab-panel-flush .statistics-champion-matchup-mobile-list,
.champion-stats .champion-tab-panel-flush .statistics-champion-synergy-mobile-list {
  width: 100%;
  max-width: 100%;
}

.champion-stats .champion-tab-panel-flush .statistics-tab-pagination {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.champion-stats .champion-tab-panel-flush .statistics-champion-matchup-mobile-card,
.champion-stats .champion-tab-panel-flush .statistics-champion-stats-mobile-card {
  width: 100%;
  max-width: 100%;
  border-radius: 0;
  border-left: none;
  border-right: none;
}

.champion-stats
  .champion-tab-panel-flush
  .statistics-champion-matchup-mobile-card
  + .statistics-champion-matchup-mobile-card,
.champion-stats
  .champion-tab-panel-flush
  .statistics-champion-stats-mobile-card
  + .statistics-champion-stats-mobile-card {
  border-top-width: 0;
}

.champion-stats .champion-tab-panel-objectives .champion-objectives-tab {
  width: 100%;
  max-width: 100%;
}

.champion-stats .champion-tab-panel-objectives .fast-stat-card-objectives {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: 1px solid rgb(var(--rgb-primary) / 0.3);
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.3);
}

.champion-stats .champion-tab-panel-runes,
.champion-stats .champion-tab-panel-skills {
  margin-top: 5px;
  padding-top: 0;
}

.champion-stats .champion-tab-panel-spells {
  margin-top: 0;
  padding-top: 0;
}

.champion-stats .champion-tab-panel-runes > div > * + * {
  margin-top: 0 !important;
}

.champion-stats .champion-tab-panel-spells > div > * + * {
  margin-top: 0.5rem !important;
}

.champion-stats .champion-matchups-table-wrap,
.champion-stats .champion-synergy-table-wrap {
  overflow-x: auto;
}

.champion-stats .champion-header-roles {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(4.75rem, 1fr));
  gap: 0.25rem;
  align-items: stretch;
}

.champion-stats .champion-header-role-badge {
  width: 100%;
  min-height: 1.375rem;
  box-sizing: border-box;
}

@media (min-width: 1024px) {
  .champion-stats .champion-header-band {
    gap: 0.75rem;
  }

  .champion-stats .champion-header-identity {
    flex: 0 0 auto;
  }

  .champion-stats .champion-header-roles {
    display: flex;
    flex: 0 0 auto;
    flex-flow: row nowrap;
    align-items: center;
    width: auto;
    gap: 0.25rem;
  }

  .champion-stats .champion-header-role-badge {
    width: auto;
    min-width: 3.5rem;
  }

  .champion-stats .champion-header-damage-split {
    flex: 0 1 auto;
  }

  .champion-stats .champion-header-damage-split > div {
    flex: 0 0 auto;
  }

  .champion-stats .champion-header-kpis {
    flex: 0 0 auto;
  }
}

.champion-stats .fast-stat-card.fast-stat-card-objectives {
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
  background: rgb(var(--rgb-chrome) / 1) !important;
}

.champion-stats .fast-stat-card.fast-stat-card-misc,
.champion-stats .champion-misc-tab .fast-stat-card-misc {
  width: min(100%, 313px) !important;
  min-width: 0 !important;
  max-width: 313px !important;
  height: auto !important;
  min-height: 0 !important;
  flex: 0 1 313px;
  overflow: hidden;
  background: rgb(var(--rgb-chrome) / 1) !important;
}

.champion-stats .fast-stat-card.fast-stat-card-distribution {
  width: min(100%, 420px) !important;
  min-width: 0 !important;
  max-width: 420px !important;
  height: auto !important;
  min-height: 0 !important;
  flex: 0 1 auto;
  overflow: hidden;
  background: rgb(var(--rgb-chrome) / 1) !important;
}

@media (max-width: 1023px) {
  .champion-stats .champion-page-main {
    width: 100%;
    max-width: 100%;
  }

  .champion-stats .champion-content-stack {
    width: 100%;
    max-width: 100%;
    padding-bottom: 5px;
  }

  .champion-stats .champion-tab-panel {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .champion-stats .champion-trend-charts-grid {
    width: 100%;
    max-width: 100%;
  }

  .champion-stats .champion-trend-chart-card {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box;
    overflow: hidden;
  }

  .champion-stats .champion-trend-chart-wrap {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }

  .champion-stats .champion-trend-chart-svg {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    height: auto !important;
    aspect-ratio: 620 / 220;
  }

  .champion-stats .champion-misc-tab,
  .champion-stats .champion-misc-tab .champion-misc-grid,
  .champion-stats .statistics-champion-matchup-mobile-list,
  .champion-stats .statistics-champion-synergy-mobile-list {
    width: 100%;
    max-width: 100%;
  }

  .champion-stats .statistics-champion-matchup-mobile-card {
    width: 100%;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
  }

  .champion-stats .fast-stat-card.fast-stat-card-misc,
  .champion-stats .champion-misc-tab .fast-stat-card-misc,
  .champion-stats .fast-stat-card.fast-stat-card-distribution,
  .champion-stats .fast-stat-card.fast-stat-card-objectives {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    flex: 1 1 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    align-self: stretch;
  }

  .champion-stats .fast-stat-card.fast-stat-card-distribution {
    max-width: 100% !important;
  }
}

.champion-stats .fast-stat-tooltip-popover {
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

.champion-stats .fast-stat-tooltip-popover--end {
  left: auto;
  right: 0;
  transform: none;
}

.champion-stats .fast-stat-tooltip-popover--objectives {
  min-width: min(16rem, calc(100vw - 1.5rem));
  max-width: min(22rem, calc(100vw - 1.5rem));
}

@media (min-width: 1024px) {
  .champion-stats .fast-stat-tooltip-popover--objectives {
    min-width: 18rem;
    max-width: min(28rem, calc(100vw - 1.5rem));
  }

  .champion-stats .fast-stat-tooltip-popover--start {
    left: 0;
    transform: none;
  }
}

@media (max-width: 1023px) {
  .champion-stats .fast-stat-tooltip-popover--start {
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>

<style scoped>
.sk-grid-section {
  margin-bottom: 1.25rem;
}
.sk-grid-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  margin-bottom: 0.75rem;
}
.sk-grid-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #f0e6d2;
}
.sk-grid-sub {
  font-size: 0.8125rem;
  color: #a09b8c;
}
.sk-grid-sub b {
  color: #f0e6d2;
}
.sk-grid-card {
  overflow-x: auto;
  border: 1px solid #463714;
  border-radius: 0.5rem;
  background: #0a1428;
  padding: 1rem 1.25rem;
}
.sk-grid {
  display: grid;
  grid-template-columns: 2.5rem repeat(18, minmax(2rem, 1fr));
  gap: 0.4rem 0.25rem;
  align-items: center;
  min-width: 40rem;
}
.sk-grid-lvl {
  text-align: center;
  font-size: 0.75rem;
  color: #a09b8c;
}
.sk-grid-key {
  font-weight: 700;
}
.sk-grid-cell {
  height: 1.9rem;
}
.sk-grid-chip {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #010a13;
}
.sk-grid-key.is-Q {
  color: #c8aa6e;
}
.sk-grid-chip.is-Q {
  background: #c8aa6e;
}
.sk-grid-key.is-W {
  color: #0397ab;
}
.sk-grid-chip.is-W {
  background: #0397ab;
}
.sk-grid-key.is-E {
  color: #0ac8b9;
}
.sk-grid-chip.is-E {
  background: #0ac8b9;
}
.sk-grid-key.is-R {
  color: #e2665a;
}
.sk-grid-chip.is-R {
  background: #e2665a;
}

/* legacy rune-set styles (overview builds) */
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

/* Grille runes champion (même rendu que onglet runes : pickrate + winrate par rune) */
.champion-runes-grid-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}
.champion-overview-runes-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, auto);
  gap: 0.25rem;
  min-width: 0;
}
.champion-overview-rune-cell {
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
.champion-overview-rune-cell:hover {
  background: rgb(var(--rgb-primary) / 0.15);
}
.champion-overview-rune-cell.rune.main {
  border-color: rgb(var(--rgb-accent) / 0.4);
}
.champion-overview-rune-img {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
  flex-shrink: 0;
}
.champion-overview-rune-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  width: 100%;
  font-size: 0.65rem;
  line-height: 1.2;
}
.champion-overview-rune-pick {
  color: rgb(var(--rgb-text) / 0.75);
}
.champion-overview-rune-wr {
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.9);
}
.champion-overview-rune-no-stat {
  color: rgb(var(--rgb-text) / 0.5);
  font-size: 0.7rem;
}
.champion-skills-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16.5rem), 1fr));
  gap: 0.5rem;
  width: 100%;
}

.champion-skills-orders-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.75rem;
  border-radius: 0.375rem;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgb(var(--rgb-primary) / 0.35);
}
.champion-skills-orders-table th,
.champion-skills-orders-table td {
  border: 1px solid rgb(255 255 255 / 0.08);
  text-align: center;
  padding: 0.3rem 0.22rem;
}
.champion-skills-orders-table thead th {
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.02em;
  color: rgb(248 250 252);
  background: rgb(15 23 42 / 0.92);
}
.champion-skill-row--q {
  --champion-skill-accent: 59 130 246;
}
.champion-skill-row--w {
  --champion-skill-accent: 244 63 94;
}
.champion-skill-row--e {
  --champion-skill-accent: 234 179 8;
}
.champion-skill-row--r {
  --champion-skill-accent: 168 85 247;
}
.champion-skill-icon-cell {
  background: rgb(var(--champion-skill-accent) / 0.14);
  border-left: 3px solid rgb(var(--champion-skill-accent) / 0.85);
}
.champion-skill-icon-cell img {
  box-shadow: 0 0 0 1px rgb(var(--champion-skill-accent) / 0.5);
}
.champion-skill-cell {
  font-weight: 800;
  font-size: 0.8rem;
  background: rgb(2 6 23 / 0.55);
}
.champion-skill-cell-empty {
  background: rgb(2 6 23 / 0.35);
  color: transparent;
}
.champion-skill-cell-active {
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
}
.champion-skill-cell-active--q {
  color: #eff6ff;
  background: rgb(37 99 235 / 0.72);
  box-shadow: inset 0 0 0 1px rgb(147 197 253 / 0.55);
}
.champion-skill-cell-active--w {
  color: #fff1f2;
  background: rgb(225 29 72 / 0.68);
  box-shadow: inset 0 0 0 1px rgb(251 113 133 / 0.55);
}
.champion-skill-cell-active--e {
  color: #422006;
  background: rgb(250 204 21 / 0.88);
  box-shadow: inset 0 0 0 1px rgb(253 224 71 / 0.75);
}
.champion-skill-cell-active--r {
  color: #faf5ff;
  background: rgb(147 51 234 / 0.72);
  box-shadow: inset 0 0 0 1px rgb(216 180 254 / 0.55);
}
.champion-skill-cell-label {
  display: inline-block;
  min-width: 1.1em;
  line-height: 1;
}
.champion-skill-metric-cell {
  font-weight: 700;
  font-size: 0.8rem;
  color: rgb(248 250 252);
  background: rgb(30 41 59 / 0.88);
  border-left: 2px solid rgb(var(--rgb-accent) / 0.45);
}
@media (max-width: 1023px) {
  .statistics-filters-panel .flex.min-h-0.flex-1 {
    overflow-y: auto;
  }
}
.champion-section-title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.champion-vision-pings-grid {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 16px;
  align-items: start;
}
@media (max-width: 1023px) {
  .champion-vision-pings-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.ov-evo-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.ov-evo-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #f0e6d2;
}
.ov-evo-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.ov-seg {
  display: inline-flex;
  border: 1px solid #463714;
  border-radius: 6px;
  overflow: hidden;
}
.ov-seg button {
  padding: 5px 11px;
  font-size: 12px;
  color: #a09b8c;
  background: transparent;
  border-right: 1px solid #463714;
}
.ov-seg button:last-child {
  border-right: 0;
}
.ov-seg button.is-on {
  color: #0ac8b9;
  background: #0d2a33;
  font-weight: 700;
}
.ov-evo-head ~ * .champion-trend-chart-svg {
  max-height: 300px;
}
.ov-evo-div {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #a09b8c;
}
</style>
