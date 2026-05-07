<template>
  <div class="champion-stats flex min-h-screen flex-col bg-background text-text">
    <!-- Burger (mobile) -->
    <button
      type="button"
      class="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-surface/90 text-text shadow lg:hidden"
      :aria-label="t('statisticsPage.openFilters')"
      @click="championFiltersOpen = true"
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

    <div
      v-show="championFiltersOpen"
      class="fixed inset-0 z-30 bg-black/50 lg:hidden"
      aria-hidden="true"
      @click="closeChampionFilters"
    />

    <div class="w-full flex-shrink-0 px-4 pb-2 pt-4">
      <div class="flex w-full items-end gap-3">
        <NuxtLink
          :to="localePath('/statistics')"
          class="inline-flex shrink-0 items-center gap-2 whitespace-nowrap pb-2 text-sm font-medium text-accent hover:underline"
        >
          ← {{ t('statisticsPage.championStatsBack') }}
        </NuxtLink>
        <nav v-if="championStats" class="champion-tabs block min-w-0 flex-1" role="tablist">
          <div class="flex flex-nowrap gap-1 overflow-x-auto border-b border-primary/30 pb-2">
            <button
              v-for="tab in championTabs"
              :key="tab.id"
              type="button"
              role="tab"
              :aria-selected="activeChampionTab === tab.id"
              :class="[
                'champion-tab-btn rounded px-3 py-1.5 text-sm font-medium transition-colors',
                activeChampionTab === tab.id
                  ? 'border border-accent/50 bg-accent/20 text-accent'
                  : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text',
              ]"
              @click="activeChampionTab = tab.id"
            >
              {{ t(tab.label) }}
            </button>
          </div>
        </nav>
      </div>
    </div>

    <div class="flex min-h-0 w-full min-w-0 flex-1">
      <button
        type="button"
        class="filters-collapse-floating hidden lg:sticky lg:top-4 lg:z-20 lg:mr-2 lg:flex lg:shrink-0 lg:self-start"
        :aria-label="
          championFiltersOpen ? t('statisticsPage.closeFilters') : t('statisticsPage.openFilters')
        "
        @click="toggleChampionFiltersOpen"
      >
        <svg
          class="h-2 w-2 transition-transform duration-200"
          :class="championFiltersOpen ? 'rotate-180' : ''"
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
          championFiltersOpen
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
            @click="resetChampionFilters"
          >
            <span class="iconify i-mdi:refresh" aria-hidden="true" />
            Reset
          </button>
          <button
            type="button"
            class="rounded p-1 text-text/70 hover:bg-primary/20 hover:text-text lg:hidden"
            :aria-label="t('statisticsPage.closeFilters')"
            @click="closeChampionFilters"
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
                    ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                    : 'bg-black/20 hover:bg-white/10'
                "
                :title="t('statisticsPage.allRanks')"
                @click="selectAllChampionDivisions()"
              >
                <img
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
                    ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                    : 'bg-black/20 hover:bg-white/10'
                "
                :title="formatDivisionLabel(tier)"
                @click="toggleRankFilter(tier)"
              >
                <img
                  v-if="getRankedEmblemUrl(tier)"
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
                :class="!filterRole ? 'bg-blue-500/20' : 'bg-black/20 hover:bg-white/10'"
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
                  filterRole === r.value ? 'bg-blue-500/20' : 'bg-black/20 hover:bg-white/10',
                  !rolesWithData.has(r.value) ? 'champion-role-disabled' : '',
                ]"
                :title="r.label"
                :disabled="!rolesWithData.has(r.value)"
                @click="toggleChampionRoleFilter(r)"
              >
                <img
                  :src="r.icon"
                  :alt="r.label"
                  class="h-3 w-3 object-contain"
                  :class="
                    filterRole === r.value ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'
                  "
                  width="12"
                  height="12"
                />
              </button>
            </div>
          </div>
          <div>
            <label class="flex cursor-pointer items-center gap-2 text-sm font-medium text-text">
              <input
                v-model="filterPlayersMasterPlus"
                type="checkbox"
                class="rounded border-primary/50"
              />
              {{ t('statisticsPage.championStatsPlayersMasterPlus') }}
            </label>
          </div>
          <div v-if="activeChampionTab === 'matchups'">
            <label
              for="champion-search-matchups"
              class="mb-1 block text-sm font-medium text-text"
              >{{ t('statisticsPage.championStatsMatchupSearchLabel') }}</label
            >
            <input
              id="champion-search-matchups"
              v-model.trim="championSearchQueryPlaceholder"
              type="text"
              :placeholder="t('statisticsPage.championStatsMatchupSearchPlaceholder')"
              class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text placeholder:text-text/50"
            />
          </div>
          <div v-if="activeChampionTab === 'matchups'">
            <label
              for="champion-matchup-profile-filter"
              class="mb-1 block text-sm font-medium text-text"
              >{{ t('statisticsPage.championMatchupFilterLaneProfile') }}</label
            >
            <select
              id="champion-matchup-profile-filter"
              v-model="matchupLaneProfileFilter"
              class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
            >
              <option value="ALL">{{ t('statisticsPage.overviewDivisionAll') }}</option>
              <option value="balanced">
                {{ t('statisticsPage.championMatchupDominanceBalancedShort') }}
              </option>
              <option v-for="opt in matchupLaneProfileOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div v-if="activeChampionTab === 'matchups'">
            <label
              for="champion-matchup-otp-filter"
              class="mb-1 block text-sm font-medium text-text"
              >{{ t('statisticsPage.championMatchupFilterOtpMode') }}</label
            >
            <select
              id="champion-matchup-otp-filter"
              v-model="matchupOtpMode"
              class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
            >
              <option value="non">{{ t('statisticsPage.championMatchupFilterOtpOff') }}</option>
              <option value="oui">{{ t('statisticsPage.championMatchupFilterOtpOn') }}</option>
              <option value="solo">{{ t('statisticsPage.championMatchupFilterOtpOnly') }}</option>
            </select>
          </div>
          <div v-if="activeChampionTab === 'spells'">
            <label
              for="champion-summoner-mode-filter"
              class="mb-1 block text-sm font-medium text-text"
              >{{ t('statisticsPage.summonerSpells') }}</label
            >
            <select
              id="champion-summoner-mode-filter"
              v-model="championSpellsModeFilter"
              class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
            >
              <option value="solo">{{ t('statisticsPage.spellsModeSolo') }}</option>
              <option value="pair">{{ t('statisticsPage.spellsModePair') }}</option>
            </select>
          </div>
        </div>
      </aside>

      <div class="min-w-0 flex-1 p-4 pt-14 lg:px-3 lg:pb-4 lg:pt-2">
        <div class="w-full">
          <!-- Loading / error -->
          <div
            v-if="pending"
            class="rounded-lg border border-primary/30 bg-surface/30 p-8 text-center"
          >
            <p class="text-text/70">{{ t('statisticsPage.loading') }}</p>
          </div>
          <div v-else-if="error" class="rounded-lg border border-red-500/30 bg-surface/30 p-6">
            <p class="text-red-500">{{ error }}</p>
          </div>
          <template v-else-if="championStats">
            <!-- Header: image + nom + KPI principaux -->
            <div
              class="champion-header-band mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-surface/30 px-3 py-2"
            >
              <img
                v-if="gameVersion && championByKey(championId)"
                :src="getChampionImageUrl(gameVersion, championByKey(championId)!.image.full)"
                :alt="championName(championId) ?? ''"
                class="h-10 w-10 shrink-0 rounded-full object-cover"
                width="40"
                height="40"
              />
              <div class="min-w-[140px] flex-1">
                <h1 class="truncate text-base font-semibold text-accent">
                  {{ championName(championId) || championId }}
                </h1>
                <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text/80">
                  <span
                    v-for="role in roleDistribution"
                    :key="role.role"
                    class="inline-flex items-center gap-1 rounded border border-primary/30 bg-surface/40 px-1.5 py-0.5"
                  >
                    <img
                      :src="roleIconPath(role.role)"
                      :alt="roleLabel(role.role)"
                      class="h-3 w-3 object-contain"
                      width="12"
                      height="12"
                    />
                    <span>{{ formatDonutPercent(role.pickrate) }}%</span>
                  </span>
                </div>
              </div>
              <div
                v-if="championDamageSplit"
                class="mx-1 flex items-center gap-3 self-center rounded bg-surface/40 px-2 py-1.5"
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
              <div class="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text/85">
                <span
                  >{{ t('statisticsPage.pickrate') }}:
                  <strong>{{ formatDonutPercent(championStats.pickrate ?? 0) }}%</strong></span
                >
                <span
                  >{{ t('statisticsPage.winrate') }}:
                  <strong>{{ formatDonutPercent(championStats.winrate ?? 0) }}%</strong></span
                >
                <span
                  >{{ t('statisticsPage.championStatsBanrateTitle') }}:
                  <strong>{{ formatDonutPercent(championStats.banrate ?? 0) }}%</strong></span
                >
              </div>
            </div>
            <section
              v-show="activeChampionTab === 'overview'"
              id="champion-tab-panel-overview"
              role="tabpanel"
              class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-4"
            >
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-base font-semibold text-text">
                  {{ t('statisticsPage.championStatsTrendsTitle') }}
                </h2>
                <div class="flex flex-wrap items-center gap-2">
                  <label class="inline-flex items-center gap-2 text-xs text-text/80">
                    <span>{{ t('statisticsPage.championStatsTrendsGranularity') }}</span>
                    <select
                      v-model="trendGranularity"
                      class="rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                    >
                      <option value="day">{{ t('statisticsPage.championStatsTrendsDay') }}</option>
                      <option value="week">
                        {{ t('statisticsPage.championStatsTrendsWeek') }}
                      </option>
                      <option value="month">
                        {{ t('statisticsPage.championStatsTrendsMonth') }}
                      </option>
                      <option value="patch">
                        {{ t('statisticsPage.championStatsTrendsPatch') }}
                      </option>
                    </select>
                  </label>
                </div>
              </div>
              <div class="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  class="rounded px-2 py-1 font-medium transition-colors"
                  :class="
                    trendRangeMode === '7d'
                      ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
                      : 'bg-black/20 text-text/85 hover:bg-white/10'
                  "
                  @click="trendRangeMode = '7d'"
                >
                  {{ t('statisticsPage.championStatsTrendsRange7d') }}
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1 font-medium transition-colors"
                  :class="
                    trendRangeMode === '14d'
                      ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
                      : 'bg-black/20 text-text/85 hover:bg-white/10'
                  "
                  @click="trendRangeMode = '14d'"
                >
                  {{ t('statisticsPage.championStatsTrendsRange14d') }}
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1 font-medium transition-colors"
                  :class="
                    trendRangeMode === 'months'
                      ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
                      : 'bg-black/20 text-text/85 hover:bg-white/10'
                  "
                  @click="trendRangeMode = 'months'"
                >
                  {{ t('statisticsPage.championStatsTrendsRangeMonths') }}
                </button>
                <label
                  v-if="trendRangeMode === 'months'"
                  class="inline-flex items-center gap-1 text-text/80"
                >
                  <span>{{ t('statisticsPage.championStatsTrendsMonthsLabel') }}</span>
                  <input
                    v-model.number="trendMonthsWindow"
                    type="number"
                    min="1"
                    max="24"
                    class="w-16 rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                  />
                </label>
              </div>
              <div class="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  class="rounded px-2 py-1 font-medium transition-colors"
                  :class="
                    trendDivisionPreset === 'selected'
                      ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
                      : 'bg-black/20 text-text/85 hover:bg-white/10'
                  "
                  @click="trendDivisionPreset = 'selected'"
                >
                  {{ t('statisticsPage.championStatsTrendsPresetSelected') }}
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1 font-medium transition-colors"
                  :class="
                    trendDivisionPreset === 'average'
                      ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
                      : 'bg-black/20 text-text/85 hover:bg-white/10'
                  "
                  @click="trendDivisionPreset = 'average'"
                >
                  Average
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1 font-medium transition-colors"
                  :class="
                    trendDivisionPreset === 'skilled'
                      ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
                      : 'bg-black/20 text-text/85 hover:bg-white/10'
                  "
                  @click="trendDivisionPreset = 'skilled'"
                >
                  Skilled
                </button>
                <button
                  type="button"
                  class="rounded px-2 py-1 font-medium transition-colors"
                  :class="
                    trendDivisionPreset === 'elite'
                      ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
                      : 'bg-black/20 text-text/85 hover:bg-white/10'
                  "
                  @click="trendDivisionPreset = 'elite'"
                >
                  Elite
                </button>
                <label class="ml-2 inline-flex items-center gap-1 text-text/80">
                  <input
                    v-model="trendShowGlobalLine"
                    type="checkbox"
                    class="rounded border-primary/50"
                  />
                  <span>{{ t('statisticsPage.championStatsTrendsGlobalLine') }}</span>
                </label>
              </div>
              <div v-if="trendPending" class="py-4 text-text/70">
                {{ t('statisticsPage.loading') }}
              </div>
              <template v-else>
                <p v-if="trendError" class="py-2 text-sm text-red-400">{{ trendError }}</p>
                <div
                  v-if="
                    trendChartCards.length ||
                    durationByTierPending ||
                    durationTrendExtraCards.length
                  "
                  class="grid gap-4 lg:grid-cols-2"
                >
                  <article
                    v-for="card in trendChartCards"
                    :key="card.metricId"
                    class="rounded border border-primary/20 bg-background/30 p-3"
                  >
                    <h3 class="mb-2 text-sm font-medium text-text">{{ card.title }}</h3>
                    <div class="overflow-x-auto">
                      <svg
                        :viewBox="`0 0 ${TREND_CHART_W} ${TREND_CHART_H}`"
                        :width="TREND_CHART_W"
                        :height="TREND_CHART_H"
                        class="h-auto w-full min-w-[480px]"
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
                        <g v-for="tick in card.yTicks" :key="`${card.metricId}-y-${tick.value}`">
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
                            @mouseenter="onTrendPointHover($event, card.metricId, serie.tier, pt)"
                            @mousemove="onTrendPointHover($event, card.metricId, serie.tier, pt)"
                            @mouseleave="trendTooltip = null"
                          />
                        </g>
                        <g v-for="tick in card.xTicks" :key="`${card.metricId}-x-${tick.index}`">
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
                      class="pointer-events-none fixed z-[90] rounded border border-primary/30 bg-surface/90 px-2 py-1 text-[11px] text-text/85 shadow-lg"
                      :style="{
                        left: `${trendTooltip.mouseX}px`,
                        top: `${trendTooltip.mouseY}px`,
                        transform: 'translate(-50%, -110%)',
                      }"
                    >
                      <strong>{{ trendTooltip.tier }}</strong> · {{ trendTooltip.bucketLabel }} ·
                      {{ formatTrendValue(card.metricId, trendTooltip.value) }}
                    </div>
                    <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text/80">
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

                  <article
                    v-if="durationByTierPending"
                    class="rounded border border-primary/20 bg-background/30 p-3"
                  >
                    <h3 class="mb-2 text-sm font-medium text-text">
                      {{ t('statisticsPage.championStatsDurationChartsLoading') }}
                    </h3>
                    <div class="py-10 text-center text-xs text-text/60">
                      {{ t('statisticsPage.loading') }}
                    </div>
                  </article>
                  <template v-else>
                    <article
                      v-for="card in durationTrendExtraCards"
                      :key="`duration-extra-${card.metricId}`"
                      class="rounded border border-primary/20 bg-background/30 p-3"
                    >
                      <h3 class="mb-2 text-sm font-medium text-text">{{ card.title }}</h3>
                      <div class="overflow-x-auto">
                        <svg
                          :viewBox="`0 0 ${TREND_CHART_W} ${TREND_CHART_H}`"
                          :width="TREND_CHART_W"
                          :height="TREND_CHART_H"
                          class="h-auto w-full min-w-[480px]"
                          preserveAspectRatio="xMidYMid meet"
                          aria-hidden="true"
                        >
                          <defs>
                            <linearGradient
                              :id="`trend-bg-duration-${card.metricId}`"
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
                            :fill="`url(#trend-bg-duration-${card.metricId})`"
                          />
                          <g
                            v-for="tick in card.yTicks"
                            :key="`duration-${card.metricId}-y-${tick.value}`"
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
                            :key="`duration-${card.metricId}-${serie.tier}`"
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
                            :key="`duration-${card.metricId}-${serie.tier}-points`"
                          >
                            <circle
                              v-for="pt in serie.points"
                              v-show="(pt.games ?? 0) > 0"
                              :key="`duration-${card.metricId}-${serie.tier}-${pt.idx}`"
                              :cx="pt.x"
                              :cy="pt.y"
                              r="3"
                              :fill="serie.color"
                              class="cursor-pointer"
                              @mouseenter="
                                onDurationExtraChartHover(
                                  $event,
                                  card.metricId === 'games' ? 'games' : 'winrate',
                                  serie.tier,
                                  pt
                                )
                              "
                              @mousemove="
                                onDurationExtraChartHover(
                                  $event,
                                  card.metricId === 'games' ? 'games' : 'winrate',
                                  serie.tier,
                                  pt
                                )
                              "
                              @mouseleave="durationExtraTooltip = null"
                            />
                          </g>
                          <g
                            v-for="tick in card.xTicks"
                            :key="`duration-${card.metricId}-x-${tick.index}`"
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
                        v-if="
                          durationExtraTooltip &&
                          durationExtraTooltip.metricId ===
                            (card.metricId === 'games' ? 'games' : 'winrate')
                        "
                        class="pointer-events-none fixed z-[90] rounded border border-primary/30 bg-surface/90 px-2 py-1 text-[11px] text-text/85 shadow-lg"
                        :style="{
                          left: `${durationExtraTooltip.mouseX}px`,
                          top: `${durationExtraTooltip.mouseY}px`,
                          transform: 'translate(-50%, -110%)',
                        }"
                      >
                        <template v-if="durationExtraTooltip.metricId === 'winrate'">
                          <strong>{{ durationExtraTooltip.tier }}</strong> ·
                          {{ durationExtraTooltip.bucketLabel }} ·
                          {{ Number(durationExtraTooltip.value).toFixed(2) }}% ·
                          {{ durationExtraTooltip.games }}
                          {{ t('statisticsPage.championStatsDurationWinrateTooltipMatches') }}
                        </template>
                        <template v-else>
                          <strong>{{ durationExtraTooltip.tier }}</strong> ·
                          {{ durationExtraTooltip.bucketLabel }} ·
                          {{ Math.round(durationExtraTooltip.games) }}
                          {{ t('statisticsPage.championStatsDurationWinrateTooltipMatches') }}
                        </template>
                      </div>
                      <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text/80">
                        <button
                          v-for="serie in card.series"
                          :key="`duration-${card.metricId}-legend-${serie.tier}`"
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
                  </template>
                </div>
                <p v-else class="py-2 text-text/70">{{ t('statisticsPage.noData') }}</p>
              </template>
            </section>
            <div class="champion-tab-panels">
              <div
                v-show="activeChampionTab === 'matchups'"
                id="champion-tab-panel-matchups"
                role="tabpanel"
                class="space-y-4"
              >
                <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
                  <div v-if="matchupsExtPending" class="py-6 text-text/70">
                    {{ t('statisticsPage.loading') }}
                  </div>
                  <div v-else-if="matchupsExtError" class="py-2 text-sm text-red-400">
                    {{ matchupsExtError }}
                  </div>
                  <div v-else-if="!filteredMatchupsExt.length" class="py-4 text-text/70">
                    {{ t('statisticsPage.noData') }}
                  </div>
                  <div v-else class="space-y-3">
                    <div
                      class="rounded border border-primary/20 bg-black/20 px-3 py-2 text-xs text-text/80"
                    >
                      <div>{{ t('statisticsPage.championMatchupDelta1Formula') }}</div>
                      <div class="mt-1">{{ t('statisticsPage.championMatchupDelta2Formula') }}</div>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="tier-list-lolalytics w-full min-w-[1120px] text-sm">
                        <thead>
                          <tr class="border-b border-primary/30 text-left">
                            <th class="px-2 py-2 font-medium text-text">
                              <button
                                type="button"
                                class="inline-flex items-center gap-1 hover:text-accent"
                                @click="setMatchupSort('rank')"
                              >
                                {{ t('statisticsPage.tierListRank') }}{{ matchupSortIcon('rank') }}
                              </button>
                            </th>
                            <th class="px-2 py-2 font-medium text-text">
                              <button
                                type="button"
                                class="inline-flex items-center gap-1 hover:text-accent"
                                @click="setMatchupSort('champion')"
                              >
                                {{ t('statisticsPage.champion') }}{{ matchupSortIcon('champion') }}
                              </button>
                            </th>
                            <th class="px-2 py-2 text-right font-medium text-text">
                              <button
                                type="button"
                                class="inline-flex items-center gap-1 hover:text-accent"
                                :title="t('statisticsPage.championMatchupTooltipScore')"
                                @click="setMatchupSort('score')"
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
                                @click="setMatchupSort('scoreDelta')"
                              >
                                {{ t('statisticsPage.championTableDeltaSymbol')
                                }}{{ matchupSortIcon('scoreDelta') }}
                              </button>
                            </th>
                            <th
                              v-if="!filterRole"
                              class="px-2 py-2 text-left font-medium text-text"
                            >
                              <button
                                type="button"
                                class="inline-flex items-center gap-1 hover:text-accent"
                                @click="setMatchupSort('role')"
                              >
                                {{ t('statisticsPage.filterRole') }}{{ matchupSortIcon('role') }}
                              </button>
                            </th>
                            <th class="px-2 py-2 text-right font-medium text-text">
                              <button
                                type="button"
                                class="inline-flex items-center gap-1 hover:text-accent"
                                :title="t('statisticsPage.championMatchupTooltipWinrate')"
                                @click="setMatchupSort('winrate')"
                              >
                                {{ t('statisticsPage.winrate') }}{{ matchupSortIcon('winrate') }}
                              </button>
                            </th>
                            <th class="px-2 py-2 text-right font-medium text-text">
                              <button
                                type="button"
                                class="inline-flex items-center gap-1 hover:text-accent"
                                :title="t('statisticsPage.championMatchupTooltipPickrate')"
                                @click="setMatchupSort('pickrate')"
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
                                @click="setMatchupSort('delta1')"
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
                                @click="setMatchupSort('delta2')"
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
                                @click="setMatchupSort('laneScore')"
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
                                @click="setMatchupSort('dominance')"
                              >
                                {{ t('statisticsPage.championMatchupColDominance')
                                }}{{ matchupSortIcon('dominance') }}
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="(row, idx) in paginatedMatchupsExt"
                            :key="row.opponentChampionId + '-' + row.role"
                            class="border-b border-primary/15 odd:bg-white/[0.02]"
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
                              class="max-w-xs px-2 py-2 text-xs leading-snug text-text/80"
                              :title="
                                dominanceTooltip(
                                  row.dominanceKeys,
                                  row.weaknessKeys,
                                  row.laneProfileByKey
                                )
                              "
                            >
                              <div>
                                {{
                                  dominanceStrengthLabel(row.dominanceKeys, row.laneProfileByKey)
                                }}
                              </div>
                              <div
                                v-if="row.weaknessKeys?.length"
                                class="mt-0.5 text-[11px] text-rose-300"
                              >
                                {{ dominanceWeaknessLabel(row.weaknessKeys, row.laneProfileByKey) }}
                              </div>
                              <div
                                v-else-if="!row.dominanceKeys?.length"
                                class="mt-0.5 text-[11px] text-text/65"
                              >
                                {{ t('statisticsPage.championMatchupSignalLevel.even') }}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div
                        class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text/80"
                      >
                        <div class="inline-flex items-center gap-2">
                          <span>{{ t('statisticsPage.perPage') }}</span>
                          <select
                            v-model.number="matchupPageSize"
                            class="rounded border border-primary/40 bg-background px-1.5 py-0.5 text-xs text-text"
                          >
                            <option v-for="s in matchupPageSizeOptions" :key="s" :value="s">
                              {{ s }}
                            </option>
                          </select>
                        </div>
                        <div class="inline-flex items-center gap-2">
                          <button
                            type="button"
                            class="rounded border border-primary/30 px-2 py-0.5 disabled:opacity-40"
                            :disabled="matchupPage <= 1"
                            @click="matchupPage = Math.max(1, matchupPage - 1)"
                          >
                            {{ t('admin.pagination.prev') }}
                          </button>
                          <span>{{
                            t('statisticsPage.pageXOfY', {
                              current: matchupPage,
                              total: totalMatchupPages,
                            })
                          }}</span>
                          <button
                            type="button"
                            class="rounded border border-primary/30 px-2 py-0.5 disabled:opacity-40"
                            :disabled="matchupPage >= totalMatchupPages"
                            @click="matchupPage = Math.min(totalMatchupPages, matchupPage + 1)"
                          >
                            {{ t('admin.pagination.next') }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-show="activeChampionTab === 'runes'"
                  id="champion-tab-panel-runes"
                  role="tabpanel"
                  class="space-y-4"
                >
                  <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
                    <div v-if="runesPending" class="py-6 text-text/70">
                      {{ t('statisticsPage.loading') }}
                    </div>
                    <div v-else-if="!championRunesPanelData" class="py-4 text-text/70">
                      {{ t('statisticsPage.noData') }}
                    </div>
                    <StatisticsRunesOverviewPanel
                      v-else
                      :game-version="gameVersion || versionStore.currentVersion || ''"
                      :data="championRunesPanelData"
                      :baseline="null"
                      :baseline-pending="false"
                      :comparison-version="null"
                    />
                  </div>
                </div>
                <div
                  v-show="activeChampionTab === 'spells'"
                  id="champion-tab-panel-spells"
                  role="tabpanel"
                  class="space-y-4"
                >
                  <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
                    <div v-if="championSpellsPending" class="py-6 text-text/70">
                      {{ t('statisticsPage.loading') }}
                    </div>
                    <div
                      v-else-if="
                        !championSpellSoloRowsFiltered.length &&
                        !championSpellSetRowsFiltered.length
                      "
                      class="py-4 text-text/70"
                    >
                      {{ t('statisticsPage.noData') }}
                    </div>
                    <SummonerSpellTierTables
                      v-else
                      :solo-rows="championSpellSoloRowsFiltered"
                      :set-rows="championSpellSetRowsFiltered"
                      :baseline-solo="null"
                      :baseline-sets="null"
                      :ref-version-label="null"
                      :baseline-pending="false"
                      :game-version="gameVersion || versionStore.currentVersion || null"
                      :hide-games-column="true"
                      :hide-slot-columns="true"
                    />
                  </div>
                </div>
                <div
                  v-show="activeChampionTab === 'skills'"
                  id="champion-tab-panel-skills"
                  role="tabpanel"
                  class="space-y-4"
                >
                  <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
                    <div v-if="championSpellsPending" class="py-6 text-text/70">
                      {{ t('statisticsPage.loading') }}
                    </div>
                    <div v-else-if="!championSpellOrdersRows.length" class="py-4 text-text/70">
                      {{ t('statisticsPage.noData') }}
                    </div>
                    <div v-else class="grid grid-cols-1 gap-3">
                      <div
                        v-for="section in championSpellOrderSections"
                        :key="section.key"
                        class="rounded border bg-black/20 p-3"
                        :class="section.borderClass"
                      >
                        <div class="mb-2 text-xs font-semibold" :class="section.titleClass">
                          {{ section.title }}
                        </div>
                        <div class="space-y-3">
                          <div
                            v-for="row in section.rows"
                            :key="section.key + '-' + row.key"
                            class="overflow-x-auto"
                          >
                            <table class="champion-skills-orders-table min-w-[940px]">
                              <thead>
                                <tr>
                                  <th class="w-14"></th>
                                  <th
                                    v-for="level in championSkillLevels"
                                    :key="section.key + '-' + row.key + '-h-' + level"
                                    class="w-9"
                                  >
                                    {{ level }}
                                  </th>
                                  <th class="min-w-[90px] text-center">
                                    {{ t('statisticsPage.pickrate') }}
                                  </th>
                                  <th class="min-w-[90px] text-center">
                                    {{ t('statisticsPage.winrate') }}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr
                                  v-for="skillKey in championSkillKeys"
                                  :key="section.key + '-' + row.key + '-' + skillKey"
                                >
                                  <td class="champion-skill-icon-cell">
                                    <img
                                      v-if="championSkillIconUrl(skillKey)"
                                      :src="championSkillIconUrl(skillKey)!"
                                      :alt="championSkillName(skillKey)"
                                      :title="championSkillName(skillKey)"
                                      class="h-8 w-8 rounded border border-white/15"
                                    />
                                    <span v-else class="text-xs font-semibold text-text/80">{{
                                      skillKey
                                    }}</span>
                                  </td>
                                  <td
                                    v-for="level in championSkillLevels"
                                    :key="
                                      section.key + '-' + row.key + '-' + skillKey + '-' + level
                                    "
                                    class="champion-skill-cell"
                                    :class="
                                      championSkillAtLevel(row.order, level) === skillKey
                                        ? 'champion-skill-cell-active'
                                        : ''
                                    "
                                  >
                                    {{
                                      championSkillAtLevel(row.order, level) === skillKey
                                        ? skillKey
                                        : ''
                                    }}
                                  </td>
                                  <td
                                    v-if="skillKey === 'Q'"
                                    rowspan="4"
                                    class="champion-skill-metric-cell"
                                  >
                                    {{ row.pickrate.toFixed(1) }}%
                                  </td>
                                  <td
                                    v-if="skillKey === 'Q'"
                                    rowspan="4"
                                    class="champion-skill-metric-cell"
                                  >
                                    {{ row.winrate.toFixed(1) }}%
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-show="activeChampionTab === 'objectives'"
                id="champion-tab-panel-objectives"
                role="tabpanel"
                class="space-y-4"
              >
                <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
                  <div
                    class="mb-3 flex flex-wrap items-center gap-1 border-b border-primary/20 pb-2"
                  >
                    <button
                      type="button"
                      class="rounded px-2 py-1 text-xs font-semibold transition-colors"
                      :class="
                        championObjectivesView === 'main'
                          ? 'bg-accent text-background'
                          : 'bg-black/20 text-text/80 hover:bg-white/10'
                      "
                      @click="championObjectivesView = 'main'"
                    >
                      {{ t('statisticsPage.objectivesTabMain') }}
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-1 text-xs font-semibold transition-colors"
                      :class="
                        championObjectivesView === 'drakeTypes'
                          ? 'bg-accent text-background'
                          : 'bg-black/20 text-text/80 hover:bg-white/10'
                      "
                      @click="championObjectivesView = 'drakeTypes'"
                    >
                      {{ t('statisticsPage.objectivesTabDrakeTypes') }}
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-1 text-xs font-semibold transition-colors"
                      :class="
                        championObjectivesView === 'souls'
                          ? 'bg-accent text-background'
                          : 'bg-black/20 text-text/80 hover:bg-white/10'
                      "
                      @click="championObjectivesView = 'souls'"
                    >
                      {{ t('statisticsPage.objectivesTabSouls') }}
                    </button>
                  </div>
                  <div v-if="championObjectivesPending" class="py-6 text-text/70">
                    {{ t('statisticsPage.loading') }}
                  </div>
                  <div v-else-if="championObjectivesError" class="py-2 text-sm text-red-400">
                    {{ championObjectivesError }}
                  </div>
                  <div
                    v-else-if="
                      championObjectivesView === 'main'
                        ? !championObjectivesOutcomeRows.length
                        : !championObjectivesTableRows.length
                    "
                    class="py-4 text-text/70"
                  >
                    {{ t('statisticsPage.noData') }}
                  </div>
                  <div v-else class="space-y-4">
                    <div class="overflow-x-auto">
                      <table
                        v-if="championObjectivesView === 'main'"
                        class="tier-list-lolalytics w-full min-w-[860px] text-sm"
                      >
                        <thead>
                          <tr class="border-b border-primary/30 text-left">
                            <th class="px-2 py-2 font-medium text-text">
                              {{ t('statisticsPage.overviewTeamsObjective') }}
                            </th>
                            <th
                              class="px-2 py-2 text-center font-medium text-green-500"
                              colspan="2"
                            >
                              Secure
                            </th>
                            <th class="px-2 py-2 text-center font-medium text-rose-400" colspan="2">
                              Yield
                            </th>
                          </tr>
                          <tr class="border-b border-primary/30 text-left">
                            <th class="px-2 py-2 font-medium text-text"></th>
                            <th class="px-2 py-2 text-right font-medium text-blue-300">%</th>
                            <th class="px-2 py-2 text-right font-medium text-green-500">
                              {{ t('statisticsPage.winrate') }}
                            </th>
                            <th class="px-2 py-2 text-right font-medium text-violet-300">%</th>
                            <th class="px-2 py-2 text-right font-medium text-rose-400">
                              {{ t('statisticsPage.winrate') }}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="m in championObjectivesOutcomeRows"
                            :key="'outcome-' + m.key"
                            class="border-b border-primary/15 odd:bg-white/[0.02]"
                          >
                            <td class="px-2 py-2 text-text/90">{{ m.label }}</td>
                            <td class="px-2 py-2 text-right tabular-nums text-blue-300">
                              {{
                                Number.isFinite(Number(m.securePct))
                                  ? `${Number(m.securePct).toFixed(2)}%`
                                  : '—'
                              }}
                            </td>
                            <td class="px-2 py-2 text-right tabular-nums text-green-500">
                              {{
                                Number.isFinite(Number(m.secureWinPct))
                                  ? `${Number(m.secureWinPct).toFixed(2)}%`
                                  : '—'
                              }}
                            </td>
                            <td class="px-2 py-2 text-right tabular-nums text-violet-300">
                              {{
                                Number.isFinite(Number(m.yieldPct))
                                  ? `${Number(m.yieldPct).toFixed(2)}%`
                                  : '—'
                              }}
                            </td>
                            <td class="px-2 py-2 text-right tabular-nums text-rose-400">
                              {{
                                Number.isFinite(Number(m.yieldWinPct))
                                  ? `${Number(m.yieldWinPct).toFixed(2)}%`
                                  : '—'
                              }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <table v-else class="tier-list-lolalytics w-full min-w-[720px] text-sm">
                        <thead>
                          <tr class="border-b border-primary/30 text-left">
                            <th class="px-2 py-2 font-medium text-text">
                              {{ t('statisticsPage.overviewTeamsObjective') }}
                            </th>
                            <th class="px-2 py-2 text-right font-medium text-text">
                              {{ t('statisticsPage.objectiveWinrateWhenTaken') }}
                            </th>
                            <th class="px-2 py-2 text-right font-medium text-text">
                              {{ t('statisticsPage.objectiveKillRate') }}
                            </th>
                            <th class="px-2 py-2 text-right font-medium text-text">
                              {{ t('statisticsPage.objectiveAssistRate') }}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="m in championObjectivesTableRows"
                            :key="m.key"
                            class="border-b border-primary/15 odd:bg-white/[0.02]"
                          >
                            <td class="px-2 py-2 text-text/90">{{ m.label }}</td>
                            <td class="px-2 py-2 text-right tabular-nums text-text/85">
                              {{
                                Number.isFinite(Number(m.objectiveWinrate))
                                  ? `${Number(m.objectiveWinrate).toFixed(2)}%`
                                  : '—'
                              }}
                            </td>
                            <td class="px-2 py-2 text-right tabular-nums text-text/85">
                              {{
                                Number.isFinite(Number(m.killRate))
                                  ? `${Number(m.killRate).toFixed(2)}%`
                                  : '—'
                              }}
                            </td>
                            <td class="px-2 py-2 text-right tabular-nums text-text/85">
                              {{
                                Number.isFinite(Number(m.assistRate))
                                  ? `${Number(m.assistRate).toFixed(2)}%`
                                  : '—'
                              }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div
                      v-if="objectiveDrakeDistRows.length > 0 || objectiveSoulDistRows.length > 0"
                      class="grid grid-cols-1 gap-4 lg:grid-cols-3"
                    >
                      <div class="rounded border border-primary/20 bg-black/20 p-3">
                        <div class="mb-2 text-sm font-semibold text-text/90">
                          {{ t('statisticsPage.objectivesDrakeDistributionCardTitle') }}
                        </div>
                        <div
                          v-if="objectiveDrakeDistRows.length > 0"
                          class="flex flex-col items-center gap-3"
                        >
                          <div
                            class="relative inline-flex h-[132px] w-[132px] items-center justify-center"
                          >
                            <svg
                              viewBox="0 0 120 120"
                              class="absolute inset-0 h-full w-full -rotate-90"
                            >
                              <circle
                                cx="60"
                                cy="60"
                                :r="OBJECTIVE_DONUT_RADIUS"
                                fill="none"
                                stroke="rgba(148, 163, 184, 0.18)"
                                :stroke-width="OBJECTIVE_DONUT_STROKE"
                              />
                              <circle
                                v-for="(row, idx) in objectiveDrakeDistRows"
                                :key="'drake-donut-' + row.key"
                                cx="60"
                                cy="60"
                                :r="OBJECTIVE_DONUT_RADIUS"
                                fill="none"
                                :stroke="objectiveDrakeDonutSegments[idx]?.color"
                                :stroke-width="OBJECTIVE_DONUT_STROKE"
                                :stroke-dasharray="`${objectiveDrakeDonutSegments[idx]?.arc ?? 0} ${OBJECTIVE_DONUT_CIRCLE - (objectiveDrakeDonutSegments[idx]?.arc ?? 0)}`"
                                :stroke-dashoffset="`-${objectiveDrakeDonutSegments[idx]?.offset ?? 0}`"
                              />
                            </svg>
                            <span
                              class="relative z-10 text-lg font-bold text-blue-600 dark:text-blue-300"
                              >100%</span
                            >
                          </div>
                          <ul
                            class="grid w-full max-w-[360px] grid-cols-2 gap-x-3 gap-y-1 text-xs text-text/85"
                          >
                            <li
                              v-for="row in objectiveDrakeDistRows"
                              :key="'drake-dist-legend-' + row.key"
                              class="flex items-center justify-between gap-2"
                            >
                              <span class="inline-flex min-w-0 items-center gap-2">
                                <span
                                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                                  :style="{ backgroundColor: row.color }"
                                />
                                <span class="truncate">{{ row.label }}</span>
                              </span>
                              <span class="shrink-0 font-semibold">{{
                                objectiveDistPct(row.value, objectiveDrakeDistTotal)
                              }}</span>
                            </li>
                          </ul>
                        </div>
                        <div v-else class="text-sm text-text/60">
                          {{ t('statisticsPage.noData') }}
                        </div>
                      </div>
                      <div class="rounded border border-primary/20 bg-black/20 p-3">
                        <div class="mb-2 text-sm font-semibold text-text/90">
                          {{ t('statisticsPage.objectivesSoulDistributionCardTitle') }}
                        </div>
                        <div
                          v-if="objectiveSoulDistRows.length > 0"
                          class="flex flex-col items-center gap-3"
                        >
                          <div
                            class="relative inline-flex h-[132px] w-[132px] items-center justify-center"
                          >
                            <svg
                              viewBox="0 0 120 120"
                              class="absolute inset-0 h-full w-full -rotate-90"
                            >
                              <circle
                                cx="60"
                                cy="60"
                                :r="OBJECTIVE_DONUT_RADIUS"
                                fill="none"
                                stroke="rgba(148, 163, 184, 0.18)"
                                :stroke-width="OBJECTIVE_DONUT_STROKE"
                              />
                              <circle
                                v-for="(row, idx) in objectiveSoulDistRows"
                                :key="'soul-donut-' + row.key"
                                cx="60"
                                cy="60"
                                :r="OBJECTIVE_DONUT_RADIUS"
                                fill="none"
                                :stroke="objectiveSoulDonutSegments[idx]?.color"
                                :stroke-width="OBJECTIVE_DONUT_STROKE"
                                :stroke-dasharray="`${objectiveSoulDonutSegments[idx]?.arc ?? 0} ${OBJECTIVE_DONUT_CIRCLE - (objectiveSoulDonutSegments[idx]?.arc ?? 0)}`"
                                :stroke-dashoffset="`-${objectiveSoulDonutSegments[idx]?.offset ?? 0}`"
                              />
                            </svg>
                            <span
                              class="relative z-10 text-lg font-bold text-blue-600 dark:text-blue-300"
                              >100%</span
                            >
                          </div>
                          <ul
                            class="grid w-full max-w-[360px] grid-cols-2 gap-x-3 gap-y-1 text-xs text-text/85"
                          >
                            <li
                              v-for="row in objectiveSoulDistRows"
                              :key="'soul-dist-legend-' + row.key"
                              class="flex items-center justify-between gap-2"
                            >
                              <span class="inline-flex min-w-0 items-center gap-2">
                                <span
                                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                                  :style="{ backgroundColor: row.color }"
                                />
                                <span class="truncate">{{ row.label }}</span>
                              </span>
                              <span class="shrink-0 font-semibold">{{
                                objectiveDistPct(row.value, objectiveSoulDistTotal)
                              }}</span>
                            </li>
                          </ul>
                        </div>
                        <div v-else class="text-sm text-text/60">
                          {{ t('statisticsPage.noData') }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '~/utils/apiUrl'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useVersionStore } from '~/stores/VersionStore'
import StatisticsRunesOverviewPanel from '~/components/statistics/StatisticsRunesOverviewPanel.vue'
import SummonerSpellTierTables from '~/components/statistics/SummonerSpellTierTables.vue'
import {
  getChampionImageUrl,
  getChampionSpellImageUrl,
  getItemImageUrl as _getItemImageUrl,
  getRunePathColor,
  getRuneImageUrl as _getRuneImageUrl,
  getSpellImageUrl as _getSpellImageUrl,
} from '~/utils/imageUrl'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const { t } = useI18n()
const championId = computed(() => {
  const id = route.params.championId
  if (Array.isArray(id)) return parseInt(id[0] ?? '0', 10)
  return parseInt(id ?? '0', 10)
})

const versionStore = useVersionStore()
const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const summonerSpellsStore = useSummonerSpellsStore()

const gameVersion = computed(() => versionStore.currentVersion ?? null)
const riotLocale = computed(() => (useI18n().locale.value === 'fr' ? 'fr_FR' : 'en_US'))

function championByKey(id: number) {
  return championsStore.champions.find(c => c.key === String(id)) ?? null
}
function championName(id: number) {
  return championByKey(id)?.name ?? null
}
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

type MatchupsExtDominanceKey = 'early' | 'laneEconomy' | 'kills' | 'level' | 'cs' | 'vision'

type MatchupsExtSignalLevel =
  | 'bigAdvantage'
  | 'mediumAdvantage'
  | 'smallAdvantage'
  | 'even'
  | 'smallDisadvantage'
  | 'mediumDisadvantage'
  | 'bigDisadvantage'

type MatchupsExtRow = {
  rank: number
  opponentChampionId: number
  role: string
  games: number
  wins: number
  winrate: number
  winrateDeltaVsReference?: number | null
  matchupScore: number
  matchupScoreDeltaVsReference?: number | null
  pickrate: number
  pickrateDeltaVsReference?: number | null
  delta1?: number
  delta2?: number
  laneScore: number
  laneScoreDeltaVsReference?: number | null
  dominanceKeys: MatchupsExtDominanceKey[]
  weaknessKeys?: MatchupsExtDominanceKey[]
  laneProfileByKey?: Partial<Record<MatchupsExtDominanceKey, MatchupsExtSignalLevel>>
}

const normalizedChampionSearchQuery = computed(() =>
  championSearchQueryPlaceholder.value.trim().toLowerCase()
)
const matchupOtpMode = ref<'oui' | 'non' | 'solo'>('non')
const matchupLaneProfileFilter = ref<'ALL' | 'balanced' | MatchupsExtDominanceKey>('ALL')
const matchupLaneProfileOptions = computed(() =>
  (['cs', 'level', 'laneEconomy', 'early', 'kills', 'vision'] as MatchupsExtDominanceKey[]).map(
    key => ({
      value: key,
      label: t(`statisticsPage.championMatchupDominance.${key}`),
    })
  )
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

function matchupMatchesSearch(opponentChampionId: number): boolean {
  const q = normalizedChampionSearchQuery.value
  if (!q) return true
  const name = (championName(opponentChampionId) ?? '').toLowerCase()
  return name.includes(q) || String(opponentChampionId).toLowerCase().includes(q)
}

/** Matchups filtrés par recherche champion (nom ou id). */
function matchupMatchesLaneProfileFilter(row: MatchupsExtRow): boolean {
  const f = matchupLaneProfileFilter.value
  if (f === 'ALL') return true
  if (f === 'balanced') return !row.dominanceKeys?.length && !row.weaknessKeys?.length
  return (row.dominanceKeys?.includes(f) ?? false) || (row.weaknessKeys?.includes(f) ?? false)
}

function matchupMatchesOtpFilter(row: MatchupsExtRow): boolean {
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

function dominanceStrengthLabel(
  keys: MatchupsExtDominanceKey[],
  profileByKey?: Partial<Record<MatchupsExtDominanceKey, MatchupsExtSignalLevel>>
): string {
  if (!keys?.length) return t('statisticsPage.championMatchupDominanceBalanced')
  return `${t('statisticsPage.championMatchupProfileStrengths')}: ${keys
    .map(k => {
      const lvl = profileByKey?.[k] ?? 'smallAdvantage'
      return `${t(`statisticsPage.championMatchupDominance.${k}`)} (${t(`statisticsPage.championMatchupSignalLevel.${lvl}`)})`
    })
    .filter(Boolean)
    .join(' · ')}`
}

function dominanceWeaknessLabel(
  keys: MatchupsExtDominanceKey[],
  profileByKey?: Partial<Record<MatchupsExtDominanceKey, MatchupsExtSignalLevel>>
): string {
  if (!keys?.length) return ''
  return `${t('statisticsPage.championMatchupProfileWarnings')}: ${keys
    .map(k => {
      const lvl = profileByKey?.[k] ?? 'smallDisadvantage'
      return `${t(`statisticsPage.championMatchupDominance.${k}`)} (${t(`statisticsPage.championMatchupSignalLevel.${lvl}`)})`
    })
    .filter(Boolean)
    .join(' · ')}`
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
  if (v > 0) return 'text-emerald-300'
  if (v < 0) return 'text-rose-300'
  return 'text-text/70'
}

function _spellName(spellId: number) {
  return summonerSpellsStore.getSpellById(String(spellId))?.name ?? null
}
function _spellImageName(spellId: number) {
  return summonerSpellsStore.getSpellById(String(spellId))?.image?.full ?? null
}

const championFiltersOpen = ref(true)
const filterVersion = ref('')
const filterRank = ref<string[]>([])
const filterRole = ref('')
const filterPlayersMasterPlus = ref(false)
/** Versions chargées depuis l’overview pour le filtre (version + matchCount). */
const versionsFromOverview = ref<Array<{ version: string; matchCount: number }>>([])
const championSearchQueryPlaceholder = ref('')
const RANK_TIERS = [
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
const rankTiers = RANK_TIERS

function formatDivisionLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}

function toggleChampionFiltersOpen() {
  championFiltersOpen.value = !championFiltersOpen.value
}
function closeChampionFilters() {
  championFiltersOpen.value = false
}

/** Référence patch pour fenêtre temporelle des graphes tendances (aligné page stats). */
const championProgressionFromVersionOverride = ref('')
function normalizeVersionToPrefix(v: string | null | undefined): string | null {
  if (!v || typeof v !== 'string') return null
  const parts = v.trim().split('.')
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return parts[0] || null
}
function syncChampionProgressionDeltaToVersionBeforeFilter(): boolean {
  const filter = filterVersion.value.trim()
  const list = versionsFromOverview.value
  const before = championProgressionFromVersionOverride.value
  if (!filter) {
    if (before !== '') {
      championProgressionFromVersionOverride.value = ''
      return true
    }
    return false
  }
  const idx = list.findIndex(v => v.version === filter)
  if (idx < 0) return false
  const prev = list[idx + 1]?.version ?? ''
  if (before === prev) return false
  championProgressionFromVersionOverride.value = prev
  return true
}
const championProgressionFromVersion = computed(() => {
  if (championProgressionFromVersionOverride.value)
    return championProgressionFromVersionOverride.value
  const versions = versionsFromOverview.value
  if (versions.length >= 2) return versions[1]?.version ?? null
  if (versions.length === 1) return versions[0]?.version ?? null
  return normalizeVersionToPrefix(versionStore.currentVersion)
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
} | null>(null)
const championDamageSplit = ref<{
  phys: number
  magic: number
  trueDamage: number
  total: number
} | null>(null)

const CHAMPION_ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'] as const

type ByRoleRow = { role: string; games: number; winrate: number; pickrate: number }

/** Toutes les positions (TOP…SUPPORT) : parts sur le total champion toutes positions (même avec filtre rôle sur le reste de la page). */
const byRoleList = computed((): ByRoleRow[] => {
  if (!championStats.value) return []
  const br = championStats.value.byRole
  const safe = br && typeof br === 'object' ? br : {}
  const totalAll = CHAMPION_ROLE_ORDER.reduce((sum, role) => sum + (safe[role]?.games ?? 0), 0)
  return CHAMPION_ROLE_ORDER.map(role => {
    const data = safe[role]
    const games = data?.games ?? 0
    return {
      role,
      games,
      winrate: data?.winrate ?? 0,
      pickrate: totalAll > 0 ? (100 * games) / totalAll : 0,
    }
  })
})

/** Rôles avec au moins une partie dans la répartition (hors filtre rôle courant). */
const rolesWithData = computed(
  () => new Set(byRoleList.value.filter(r => r.games > 0).map(r => r.role))
)

const roleDistribution = computed(() => [...byRoleList.value].sort((a, b) => b.games - a.games))

const ROLE_LABELS: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'ADC',
  SUPPORT: 'Support',
}
const ROLE_ICON_MAP: Record<string, string> = {
  TOP: '/icons/roles/top.png',
  JUNGLE: '/icons/roles/jungle.png',
  MIDDLE: '/icons/roles/mid.png',
  BOTTOM: '/icons/roles/bot.png',
  SUPPORT: '/icons/roles/support.png',
}
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
  return ROLE_LABELS[role] ?? role
}
function roleIconPath(role: string) {
  return ROLE_ICON_MAP[role] ?? '/icons/roles/mid.png'
}
function formatDonutPercent(value: number) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : '0'
}

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

const championDamageDonutStyle = computed(() => {
  const entries = championDamageShareLegend.value
  if (!entries.length) {
    return {
      background:
        'radial-gradient(circle at center, rgb(var(--rgb-surface)) 58%, transparent 59%), rgb(var(--rgb-primary) / 0.25)',
    } as Record<string, string>
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
  } as Record<string, string>
})

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

const championSpellsPending = ref(false)
const championSpellsData = ref<{
  totalGames: number
  spells: Array<{ spellId: number; games: number; wins: number; pickrate: number; winrate: number }>
} | null>(null)
const championSpellsDuosData = ref<{
  totalGames: number
  duos: Array<{ spellId1: number; spellId2: number; games: number; wins: number; winrate: number }>
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
const championObjectivesPending = ref(false)
const championObjectivesError = ref<string | null>(null)
const championObjectivesData = ref<{
  championId: number
  games: number
  wins: number
  winrate: number
  drakeTypeDistribution: Array<{ key: string; label: string; total: number; pct: number }>
  soulDistribution: Array<{ key: string; label: string; total: number; pct: number }>
  rows: Array<{
    key: string
    label: string
    objectiveWinrate: number
    killRate: number
    assistRate: number
  }>
  outcomeRows: Array<{
    key: string
    label: string
    securePct: number
    secureWinPct: number
    yieldPct: number
    yieldWinPct: number
  }>
} | null>(null)
const championSpellsModeFilter = ref<'solo' | 'pair'>('solo')
const championObjectivesView = ref<'main' | 'drakeTypes' | 'souls'>('main')
const championRunesPanelData = computed(() => {
  const perRune = runesPerRuneData.value
  const sets = runesData.value
  const totalParticipants = Number(perRune?.totalGames ?? sets?.totalGames ?? 0)
  const runes = perRune?.runes ?? []
  const runeSets = sets?.runes ?? []
  const shardAgg = new Map<string, { shardId: number; slot: number; games: number; wins: number }>()
  for (const set of runeSets) {
    const shards = Array.isArray(set.shards) ? set.shards : []
    if (!shards.length) continue
    const setGames = Number(set.games ?? 0)
    const setWins = Number(set.wins ?? 0)
    shards.forEach((shardId, slot) => {
      if (!Number.isFinite(shardId) || shardId <= 0) return
      const key = `${slot}:${shardId}`
      const prev = shardAgg.get(key) ?? { shardId, slot, games: 0, wins: 0 }
      prev.games += setGames
      prev.wins += setWins
      shardAgg.set(key, prev)
    })
  }
  const shards = Array.from(shardAgg.values()).map(s => ({
    shardId: s.shardId,
    slot: s.slot,
    games: s.games,
    wins: s.wins,
    pickrate: totalParticipants > 0 ? Math.round((10000 * s.games) / totalParticipants) / 100 : 0,
    winrate: s.games > 0 ? Math.round((10000 * s.wins) / s.games) / 100 : 0,
  }))
  if (!runes.length && !runeSets.length) return null
  return {
    totalParticipants,
    runes,
    runeSets,
    shards,
  }
})
const championSpellSoloRows = computed(() => championSpellsData.value?.spells ?? [])
const championSpellSetRows = computed(() => {
  const totalGames = Number(championSpellsDuosData.value?.totalGames ?? 0)
  const duos = championSpellsDuosData.value?.duos ?? []
  return duos.map(d => ({
    spellIdD: d.spellId1,
    spellIdF: d.spellId2,
    games: Number(d.games ?? 0),
    wins: Number(d.wins ?? 0),
    pickrate: totalGames > 0 ? (100 * Number(d.games ?? 0)) / totalGames : 0,
    winrate: Number(d.winrate ?? 0),
  }))
})
const championSpellSoloRowsFiltered = computed(() =>
  championSpellsModeFilter.value === 'solo' ? championSpellSoloRows.value : []
)
const championSpellSetRowsFiltered = computed(() =>
  championSpellsModeFilter.value === 'pair' ? championSpellSetRows.value : []
)
const championSpellOrdersRows = computed(() => championSpellOrdersData.value?.rows ?? [])
const championSkillKeys = ['Q', 'W', 'E', 'R'] as const
type ChampionSkillKey = (typeof championSkillKeys)[number]
const championSkillLevels = Array.from({ length: 18 }, (_, i) => i + 1)
const championSpellOrderSections = computed(() => [
  {
    key: 'top-wr',
    title: t('statisticsPage.championSpellOrdersTopWinrate'),
    rows: championSpellOrdersTopWinrate.value,
    borderClass: 'border-emerald-500/30',
    titleClass: 'text-emerald-300',
  },
  {
    key: 'low-wr',
    title: t('statisticsPage.championSpellOrdersLowWinrate'),
    rows: championSpellOrdersLowWinrate.value,
    borderClass: 'border-rose-500/30',
    titleClass: 'text-rose-300',
  },
  {
    key: 'top-pr',
    title: t('statisticsPage.championSpellOrdersTopPickrate'),
    rows: championSpellOrdersTopPickrate.value,
    borderClass: 'border-blue-500/30',
    titleClass: 'text-blue-300',
  },
  {
    key: 'low-pr',
    title: t('statisticsPage.championSpellOrdersLowPickrate'),
    rows: championSpellOrdersLowPickrate.value,
    borderClass: 'border-orange-500/30',
    titleClass: 'text-orange-300',
  },
])
const championSkillChampion = computed(() => championByKey(championId.value))
function championSkillIndex(key: ChampionSkillKey): number {
  if (key === 'Q') return 0
  if (key === 'W') return 1
  if (key === 'E') return 2
  return 3
}
function championSkillLabelFromOrderValue(v: number): ChampionSkillKey | null {
  if (v === 1) return 'Q'
  if (v === 2) return 'W'
  if (v === 3) return 'E'
  if (v === 4) return 'R'
  return null
}
function championSkillAtLevel(order: number[], level: number): ChampionSkillKey | null {
  const raw = Number(Array.isArray(order) ? order[level - 1] : Number.NaN)
  if (!Number.isFinite(raw)) return null
  return championSkillLabelFromOrderValue(raw)
}
function championSkillName(key: ChampionSkillKey): string {
  const spell = championSkillChampion.value?.spells?.[championSkillIndex(key)]
  return spell?.name ?? key
}
function championSkillIconUrl(key: ChampionSkillKey): string | null {
  const spell = championSkillChampion.value?.spells?.[championSkillIndex(key)]
  const file = spell?.image?.full
  const version = gameVersion.value ?? versionStore.currentVersion
  if (!file || championId.value <= 0 || !version) return null
  return getChampionSpellImageUrl(version, String(championId.value), file)
}
const championSpellOrdersTopWinrate = computed(() =>
  [...championSpellOrdersRows.value]
    .sort((a, b) => b.winrate - a.winrate || b.games - a.games)
    .slice(0, 3)
)
const championSpellOrdersLowWinrate = computed(() =>
  [...championSpellOrdersRows.value]
    .sort((a, b) => a.winrate - b.winrate || b.games - a.games)
    .slice(0, 3)
)
const championSpellOrdersTopPickrate = computed(() =>
  [...championSpellOrdersRows.value]
    .sort((a, b) => b.pickrate - a.pickrate || b.games - a.games)
    .slice(0, 3)
)
const championSpellOrdersLowPickrate = computed(() =>
  [...championSpellOrdersRows.value]
    .sort((a, b) => a.pickrate - b.pickrate || b.games - a.games)
    .slice(0, 3)
)
const objectiveDrakeDonutLegend = computed(
  () => championObjectivesData.value?.drakeTypeDistribution ?? []
)
const objectiveSoulDonutLegend = computed(
  () => championObjectivesData.value?.soulDistribution ?? []
)
const OBJECTIVE_DONUT_RADIUS = 44
const OBJECTIVE_DONUT_STROKE = 16
const OBJECTIVE_DONUT_CIRCLE = 2 * Math.PI * OBJECTIVE_DONUT_RADIUS
type ObjectiveDistRow = { key: string; label: string; value: number; color: string }
function objectiveDistributionColor(key: string): string {
  const colorByKey: Record<string, string> = {
    earth: '#a3e635',
    water: '#38bdf8',
    wind: '#22d3ee',
    fire: '#fb7185',
    hextec: '#a78bfa',
    chem: '#34d399',
  }
  return colorByKey[key] ?? '#94a3b8'
}
function objectiveBuildDistRows(
  rows: Array<{ key: string; label: string; total: number; pct: number }>
): ObjectiveDistRow[] {
  return rows
    .map(row => ({
      key: row.key,
      label: row.label,
      value: Number(row.total ?? 0),
      color: objectiveDistributionColor(row.key),
    }))
    .filter(row => row.value > 0)
}
function objectiveDistTotal(rows: ObjectiveDistRow[]): number {
  return rows.reduce((sum, row) => sum + row.value, 0)
}
function objectiveDistPct(value: number, total: number): string {
  if (!total) return '—'
  return `${((value / total) * 100).toFixed(2)}%`
}
function objectiveDonutSegments(
  rows: ObjectiveDistRow[]
): Array<{ arc: number; offset: number; color: string }> {
  const total = objectiveDistTotal(rows)
  if (!total) return []
  let offset = 0
  return rows.map(row => {
    const arc = OBJECTIVE_DONUT_CIRCLE * (row.value / total)
    const segment = { arc, offset, color: row.color }
    offset += arc
    return segment
  })
}
const objectiveDrakeDistRows = computed<ObjectiveDistRow[]>(() =>
  objectiveBuildDistRows(objectiveDrakeDonutLegend.value)
)
const objectiveSoulDistRows = computed<ObjectiveDistRow[]>(() =>
  objectiveBuildDistRows(objectiveSoulDonutLegend.value)
)
const objectiveDrakeDonutSegments = computed(() =>
  objectiveDonutSegments(objectiveDrakeDistRows.value)
)
const objectiveSoulDonutSegments = computed(() =>
  objectiveDonutSegments(objectiveSoulDistRows.value)
)
const objectiveDrakeDistTotal = computed(() => objectiveDistTotal(objectiveDrakeDistRows.value))
const objectiveSoulDistTotal = computed(() => objectiveDistTotal(objectiveSoulDistRows.value))
const championObjectivesTableRows = computed(() => {
  if (championObjectivesView.value === 'main') {
    return championObjectivesData.value?.rows ?? []
  }
  if (championObjectivesView.value === 'drakeTypes') {
    return (championObjectivesData.value?.drakeTypeDistribution ?? []).map(r => ({
      key: `drake-${r.key}`,
      label: r.label,
      objectiveWinrate: Number.NaN,
      killRate: Number(r.pct ?? 0),
      assistRate: Number.NaN,
    }))
  }
  return (championObjectivesData.value?.soulDistribution ?? []).map(r => ({
    key: `soul-${r.key}`,
    label: r.label,
    objectiveWinrate: Number.NaN,
    killRate: Number(r.pct ?? 0),
    assistRate: Number.NaN,
  }))
})
const championObjectivesOutcomeRows = computed(() =>
  championObjectivesView.value === 'main' ? (championObjectivesData.value?.outcomeRows ?? []) : []
)

const durationByTierPending = ref(false)
const durationByTierData = ref<{
  series: Array<{
    rankTier: string
    buckets: Array<{ durationMin: number; matchCount: number; wins: number; winrate: number }>
  }>
} | null>(null)

const playersPending = ref(false)
const playersData = ref<{
  players: Array<{
    puuid: string
    summonerName: string | null
    totalGames: number
    winrate: number
    rankTier: string | null
  }>
} | null>(null)

const matchupsExtPending = ref(false)
const matchupsExtError = ref<string | null>(null)
const matchupsExtData = ref<{
  championId: number
  totalGames: number
  referenceVersion?: string | null
  rows: MatchupsExtRow[]
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
  banRatePct: number
  pickRatePct: number
}
type TrendGranularity = 'day' | 'week' | 'month' | 'patch'
type TrendDivisionPreset = 'selected' | 'average' | 'skilled' | 'elite'
const trendGranularity = ref<TrendGranularity>('day')
const trendRangeMode = ref<'7d' | '14d' | 'months'>('7d')
const trendMonthsWindow = ref(1)
const trendDivisionPreset = ref<TrendDivisionPreset>('selected')
const trendShowGlobalLine = ref(true)
const trendPending = ref(false)
const trendError = ref<string | null>(null)
const trendPoints = ref<TrendSnapshotPoint[]>([])
const trendVersionsCatalog = ref<Array<{ patchLabel: string; releaseDate: string }>>([])

const activeChampionTab = ref<
  'overview' | 'matchups' | 'runes' | 'spells' | 'skills' | 'objectives'
>('overview')
type ChampionTabId = 'overview' | 'matchups' | 'runes' | 'spells' | 'skills' | 'objectives'
const championTabs = [
  { id: 'overview' as const, label: 'statisticsPage.championStatsTabOverview' },
  { id: 'matchups' as const, label: 'statisticsPage.championStatsTabMatchups' },
  { id: 'runes' as const, label: 'statisticsPage.championStatsTabRunes' },
  { id: 'spells' as const, label: 'statisticsPage.championStatsTabSpells' },
  { id: 'skills' as const, label: 'statisticsPage.championStatsTabSkills' },
  { id: 'objectives' as const, label: 'statisticsPage.objectivesTabMain' },
]
const championTabIds = new Set<ChampionTabId>(championTabs.map(t => t.id))
function normalizeChampionTab(input: unknown): ChampionTabId {
  const raw = Array.isArray(input) ? input[0] : input
  const val = String(raw ?? '').trim() as ChampionTabId
  return championTabIds.has(val) ? val : 'overview'
}

function queryParams() {
  const p = new URLSearchParams()
  if (filterVersion.value) {
    p.set('version', filterVersion.value)
    p.set('patch', filterVersion.value) // builds/runes API attendent "patch"
  }
  for (const t of filterRank.value) p.append('rankTier', t)
  if (filterRole.value) p.set('role', filterRole.value)
  // Fiche champion : pas de filtre OTP côté UI ; API sans exclusion pickrate niche.
  p.set('otp', 'oui')
  return p.toString() ? '?' + p.toString() : ''
}
function toggleRankFilter(tier: string) {
  const arr = filterRank.value
  const idx = arr.indexOf(tier)
  if (idx >= 0) {
    filterRank.value = arr.filter((_, i) => i !== idx)
  } else {
    filterRank.value = [...arr, tier]
  }
}

function selectAllChampionDivisions() {
  filterRank.value = []
}

function resetChampionFilters() {
  filterVersion.value = ''
  filterRank.value = []
  filterRole.value = ''
  filterPlayersMasterPlus.value = false
  championProgressionFromVersionOverride.value = ''
  championSearchQueryPlaceholder.value = ''
  championSpellsModeFilter.value = 'solo'
}

function patchFromVersion(version: string): string | null {
  const raw = (version ?? '').trim()
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length < 2) return null
  const major = Number(parts[0])
  const minor = Number(parts[1])
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null
  return `${major}.${minor}`
}

function dateToIso(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function patchWindowFromFilterVersion(version: string): { from: string; to?: string } | null {
  const patch = patchFromVersion(version) ?? version.trim()
  if (!patch) return null
  const catalog = trendVersionsCatalog.value
  const idx = catalog.findIndex(v => v.patchLabel === patch)
  if (idx < 0) return null
  const current = catalog[idx]
  if (!current) return null
  const next = idx + 1 < catalog.length ? catalog[idx + 1] : null
  const from = current.releaseDate
  if (!from) return null
  if (!next?.releaseDate) return { from }
  const nextStart = new Date(`${next.releaseDate}T00:00:00.000Z`)
  if (Number.isNaN(nextStart.getTime())) return { from }
  const end = new Date(nextStart.getTime() - 24 * 60 * 60 * 1000)
  return { from, to: dateToIso(end) }
}

function overviewQueryParams() {
  const p = new URLSearchParams()
  if (filterVersion.value) p.set('version', filterVersion.value)
  for (const t of filterRank.value) p.append('rankTier', t)
  if (filterRole.value) p.set('role', filterRole.value)
  return p.toString() ? '?' + p.toString() : ''
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

async function loadChampion() {
  if (!championId.value || Number.isNaN(championId.value)) {
    error.value = 'Invalid champion'
    pending.value = false
    return
  }
  const t = statsPerfStart('loadChampion')
  pending.value = true
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
      avgPhysicalDamageToChampions?: number
      avgMagicDamageToChampions?: number
      avgTrueDamageToChampions?: number
      avgTotalDamageToChampions?: number
    }>(apiUrl(`/api/stats/champions/${championId.value}/damage-split${q}`))
    const phys = Number(data?.avgPhysicalDamageToChampions ?? 0)
    const magic = Number(data?.avgMagicDamageToChampions ?? 0)
    const trueDamage = Number(data?.avgTrueDamageToChampions ?? 0)
    const totalFromParts = phys + magic + trueDamage
    const total = totalFromParts > 0 ? totalFromParts : Number(data?.avgTotalDamageToChampions ?? 0)
    championDamageSplit.value = {
      phys: Number.isFinite(phys) ? phys : 0,
      magic: Number.isFinite(magic) ? magic : 0,
      trueDamage: Number.isFinite(trueDamage) ? trueDamage : 0,
      total: Number.isFinite(total) ? total : 0,
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
  try {
    const q = queryParams()
    const [setsRes, perRuneRes] = await Promise.all([
      statsFetch(
        apiUrl(`/api/stats/champions/${championId.value}/runes${q ? q + '&' : '?'}minGames=10`)
      ).catch(() => null),
      statsFetch(
        apiUrl(
          `/api/stats/champions/${championId.value}/runes-per-rune${q ? q + '&' : '?'}minGames=10`
        )
      ).catch(() => null),
    ])
    runesData.value = setsRes as typeof runesData.value
    runesPerRuneData.value = perRuneRes as typeof runesPerRuneData.value
  } catch {
    runesData.value = null
    runesPerRuneData.value = null
  } finally {
    runesPending.value = false
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
  championSpellsPending.value = true
  championSpellsData.value = null
  championSpellsDuosData.value = null
  championSpellOrdersData.value = null
  try {
    const q = overviewQueryParams()
    const [spellsRes, duosRes, ordersRes] = await Promise.allSettled([
      statsFetch<{
        totalGames: number
        spells: Array<{
          spellId: number
          games: number
          wins: number
          pickrate: number
          winrate: number
        }>
      }>(apiUrl(`/api/stats/champions/${championId.value}/summoner-spells${q || ''}`)),
      statsFetch<{
        totalGames: number
        duos: Array<{
          spellId1: number
          spellId2: number
          games: number
          wins: number
          winrate: number
        }>
      }>(apiUrl(`/api/stats/champions/${championId.value}/summoner-spells-duos${q || ''}`)),
      statsFetch<{
        totalGames: number
        rows: Array<{
          key: string
          order: number[]
          games: number
          wins: number
          pickrate: number
          winrate: number
        }>
      }>(apiUrl(`/api/stats/champions/${championId.value}/spell-orders${q || ''}`)),
    ])
    championSpellsData.value = spellsRes.status === 'fulfilled' ? spellsRes.value : null
    championSpellsDuosData.value = duosRes.status === 'fulfilled' ? duosRes.value : null
    championSpellOrdersData.value = ordersRes.status === 'fulfilled' ? ordersRes.value : null
  } catch {
    championSpellsData.value = null
    championSpellsDuosData.value = null
    championSpellOrdersData.value = null
  } finally {
    championSpellsPending.value = false
    statsPerfEnd('loadChampionSpells', t)
  }
}

async function loadChampionObjectives() {
  if (!championId.value) return
  championObjectivesPending.value = true
  championObjectivesError.value = null
  try {
    const q = queryParams()
    championObjectivesData.value = await statsFetch(
      apiUrl(`/api/stats/champions/${championId.value}/objectives${q || ''}`)
    )
  } catch (e) {
    championObjectivesData.value = null
    championObjectivesError.value = e instanceof Error ? e.message : String(e)
  } finally {
    championObjectivesPending.value = false
  }
}

/** Query durée par tier : version + rôle seulement (rankTier non envoyé ; ligues = presets des graphes). */
function durationByTierQueryParams() {
  const p = new URLSearchParams()
  if (filterVersion.value) p.set('version', filterVersion.value)
  if (filterRole.value) p.set('role', filterRole.value)
  return p.toString() ? '?' + p.toString() : ''
}

async function loadDurationByTier() {
  if (!championId.value) return
  const t = statsPerfStart('loadDurationByTier')
  durationByTierPending.value = true
  try {
    const q = durationByTierQueryParams()
    durationByTierData.value = await statsFetch(
      apiUrl(`/api/stats/champions/${championId.value}/duration-winrate-by-tier${q || ''}`)
    )
  } catch {
    durationByTierData.value = null
  } finally {
    durationByTierPending.value = false
    statsPerfEnd('loadDurationByTier', t)
  }
}

async function loadTrendSnapshots() {
  if (!championId.value) return
  const t = statsPerfStart('loadTrendSnapshots')
  trendPending.value = true
  trendError.value = null
  try {
    const params = new URLSearchParams()
    if (filterRole.value) params.set('role', filterRole.value)
    const trendPatch = (championProgressionFromVersion.value ?? '').trim()
    const patchWindow = trendPatch ? patchWindowFromFilterVersion(trendPatch) : null
    if (patchWindow?.from) params.set('from', patchWindow.from)
    if (patchWindow?.to) params.set('to', patchWindow.to)
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

async function _loadPlayers() {
  if (!championId.value) return
  const t = statsPerfStart('loadPlayers')
  playersPending.value = true
  try {
    const q = queryParams()
    const highRank = filterPlayersMasterPlus.value ? '&highRankOnly=1' : ''
    playersData.value = await statsFetch(
      apiUrl(
        `/api/stats/champions/${championId.value}/players${q ? q + '&' : '?'}minGames=20${highRank}`
      )
    )
  } catch {
    playersData.value = null
  } finally {
    playersPending.value = false
    statsPerfEnd('loadPlayers', t)
  }
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
const durationExtraTooltip = ref<{
  metricId: 'winrate' | 'games'
  tier: string
  bucketLabel: string
  value: number
  games: number
  mouseX: number
  mouseY: number
} | null>(null)

const RANK_COLOR_MAP: Record<string, string> = {
  IRON: '#6b7280',
  BRONZE: '#92400e',
  SILVER: '#94a3b8',
  GOLD: '#a16207',
  PLATINUM: '#0f766e',
  EMERALD: '#166534',
  DIAMOND: '#1d4ed8',
  MASTER: '#6d28d9',
  GRANDMASTER: '#991b1b',
  CHALLENGER: '#9a3412',
  GLOBAL: '#c084fc',
}

function normalizeRankTier(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .split('_')[0]!
  if (!normalized || normalized === 'UNRANKED') return ''
  return normalized
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

const TREND_PRESET_TIERS: Record<Exclude<TrendDivisionPreset, 'selected'>, string[]> = {
  average: ['IRON', 'BRONZE', 'SILVER', 'GOLD'],
  skilled: ['PLATINUM', 'EMERALD', 'DIAMOND'],
  elite: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
}

const trendTiersFromFilterOrData = computed(() => {
  const selected = Array.from(new Set(filterRank.value.map(normalizeRankTier))).filter(Boolean)
  if (selected.length) return selected
  const fromData = Array.from(
    new Set(trendPoints.value.map(p => normalizeRankTier(p.rankTier)))
  ).filter(Boolean)
  return fromData.sort(
    (a, b) =>
      (!RANK_TIERS.includes(a) ? 999 : RANK_TIERS.indexOf(a)) -
      (!RANK_TIERS.includes(b) ? 999 : RANK_TIERS.indexOf(b))
  )
})

const trendSelectedTiers = computed(() => {
  if (trendDivisionPreset.value === 'selected') return trendTiersFromFilterOrData.value
  const preset = TREND_PRESET_TIERS[trendDivisionPreset.value]
  return preset.filter(t => t !== 'UNRANKED')
})

/** Tiers affichés sur le graphe durée (fallback API si pas de snapshots tendance). */
const durationDisplayTiers = computed(() => {
  const sel = trendSelectedTiers.value
  if (sel.length) return sel
  const fromApi =
    durationByTierData.value?.series?.map(s => normalizeRankTier(s.rankTier)).filter(Boolean) ?? []
  const uniq = [...new Set(fromApi)]
  return uniq.sort(
    (a, b) =>
      (!RANK_TIERS.includes(a) ? 999 : RANK_TIERS.indexOf(a)) -
      (!RANK_TIERS.includes(b) ? 999 : RANK_TIERS.indexOf(b))
  )
})

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
    prev.games += games
    prev.wins += Number(p.wins) || 0
    prev.pickNum += (Number(p.pickRatePct) || 0) * games
    prev.banNum += (Number(p.banRatePct) || 0) * games
    prev.weight += games
    bucket.byTier.set(tier, prev)
  }
  const sorted = Array.from(map.values()).sort((a, b) => a.ts - b.ts)
  if (!sorted.length) return sorted
  const latestTs = sorted[sorted.length - 1]?.ts ?? 0
  if (!Number.isFinite(latestTs) || latestTs <= 0) return sorted
  const daysBack =
    trendRangeMode.value === '7d'
      ? 7
      : trendRangeMode.value === '14d'
        ? 14
        : Math.max(1, Math.min(24, Number(trendMonthsWindow.value) || 1)) * 30
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

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1)
    return `M ${points[0]!.x},${points[0]!.y} L ${points[0]!.x + 0.1},${points[0]!.y}`
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
}

function smoothSeries(values: number[], window = 3): number[] {
  if (values.length <= 2) return values
  const w = Math.max(1, window | 0)
  return values.map((_, idx) => {
    const from = Math.max(0, idx - (w - 1))
    const slice = values.slice(from, idx + 1)
    const sum = slice.reduce((acc, v) => acc + v, 0)
    return slice.length ? sum / slice.length : values[idx]!
  })
}

function metricValue(
  metric: TrendMetricId,
  raw: { games: number; wins: number; pickNum: number; banNum: number; weight: number }
): number {
  if (metric === 'games') return raw.games
  if (metric === 'winrate') return raw.games > 0 ? (100 * raw.wins) / raw.games : 0
  if (metric === 'pickrate') return raw.weight > 0 ? raw.pickNum / raw.weight : 0
  return raw.weight > 0 ? raw.banNum / raw.weight : 0
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

function onDurationExtraChartHover(
  event: MouseEvent,
  metricId: 'winrate' | 'games',
  tier: string,
  pt: TrendSeriesPoint
) {
  durationExtraTooltip.value = {
    metricId,
    tier,
    bucketLabel: pt.bucketLabel,
    value: pt.value,
    games: pt.games ?? (metricId === 'games' ? Math.round(pt.value) : 0),
    mouseX: event.clientX,
    mouseY: event.clientY,
  }
}

const trendChartCards = computed<TrendChartCard[]>(() => {
  const buckets = trendBuckets.value
  const tiers = trendSelectedTiers.value
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
        if (!normalizeRankTier(tierKey)) continue
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
    const pendingSeries: PendingSerie[] = tiers.map(tier => {
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
        color: RANK_COLOR_MAP[tier] ?? '#64748b',
        rawValues,
      }
    })

    if (trendShowGlobalLine.value) {
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
          color: RANK_COLOR_MAP.GLOBAL ?? '#c084fc',
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
    let minVal = allValues.length ? Math.min(...allValues) : 0
    let maxVal = allValues.length ? Math.max(...allValues) : 1
    if (!Number.isFinite(minVal)) minVal = 0
    if (!Number.isFinite(maxVal) || maxVal <= 0) maxVal = 1
    if (metric.id === 'games') minVal = 0
    const spread = Math.max(1e-6, maxVal - minVal)
    const domainMin = metric.id === 'games' ? 0 : Math.max(0, minVal - spread * 0.12)
    const domainMax = maxVal + spread * 0.08
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
        path: buildPath(points.map(p => ({ x: p.x, y: p.y }))),
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

type DurationByTierChartMode = 'winrate' | 'games'

function buildDurationByTierChart(mode: DurationByTierChartMode): TrendChartCard | null {
  const seriesRaw = durationByTierData.value?.series ?? []
  const tiers = durationDisplayTiers.value
  if (!tiers.length) return null

  const tierBucketMap = new Map<
    string,
    Map<number, { winrate: number; games: number; wins: number }>
  >()
  for (const s of seriesRaw) {
    const tier = normalizeRankTier(s.rankTier)
    if (!tier) continue
    let m = tierBucketMap.get(tier)
    if (!m) {
      m = new Map()
      tierBucketMap.set(tier, m)
    }
    for (const b of s.buckets) {
      const prev = m.get(b.durationMin) ?? { winrate: 0, games: 0, wins: 0 }
      const games = prev.games + b.matchCount
      const wins = prev.wins + b.wins
      m.set(b.durationMin, {
        games,
        wins,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
      })
    }
  }

  const durSet = new Set<number>()
  for (const m of tierBucketMap.values()) {
    for (const d of m.keys()) durSet.add(d)
  }
  if (!durSet.size) return null

  /** Axe X : toujours partir de 0 min, puis pas de 5 min (aligné backend) + toute clé présente dans les données. */
  const maxDur = Math.max(...durSet)
  const durationAxisMinutes = new Set<number>([0])
  for (let d = 5; d <= maxDur; d += 5) {
    durationAxisMinutes.add(d)
  }
  for (const d of durSet) {
    durationAxisMinutes.add(d)
  }
  const fullDurations = [...durationAxisMinutes].sort((a, b) => a - b)

  const n = fullDurations.length
  const xAt = (index: number) =>
    TREND_CHART_PAD.left + (n <= 1 ? 0 : index / (n - 1)) * TREND_PLOT_W

  const tiersOrdered = [...tiers].sort(
    (a, b) =>
      (!RANK_TIERS.includes(a) ? 999 : RANK_TIERS.indexOf(a)) -
      (!RANK_TIERS.includes(b) ? 999 : RANK_TIERS.indexOf(b))
  )

  type DurPendingSerie = {
    tier: string
    color: string
    rawValues: Array<{ idx: number; value: number; bucketLabel: string; games: number }>
  }

  function buildDenseRowForTier(tier: string): {
    rawValues: DurPendingSerie['rawValues']
    hasData: boolean
  } {
    const m = tierBucketMap.get(tier)
    const rawValues: DurPendingSerie['rawValues'] = []
    let hasData = false
    fullDurations.forEach((durMin, index) => {
      const defaultLabel = `${durMin}–${durMin + 5} min`
      /** Toujours 0 à l’origine (0 min) : ancrage pour l’axe Y et le lissage. */
      if (index === 0) {
        rawValues.push({ idx: index, value: 0, bucketLabel: defaultLabel, games: 0 })
        return
      }
      let cell = m?.get(durMin)
      let bucketLabel = defaultLabel
      /** Bucket [0,5) côté API (durationMin=0) : si pas de ligne à 5 min, on l’affiche au tick 5 min. */
      if ((!cell || cell.games <= 0) && durMin === 5) {
        const b0 = m?.get(0)
        if (b0 && b0.games > 0) {
          cell = b0
          bucketLabel = `0–5 min`
        }
      }
      if (!cell || cell.games <= 0) {
        rawValues.push({ idx: index, value: 0, bucketLabel: defaultLabel, games: 0 })
        return
      }
      hasData = true
      const value = mode === 'winrate' ? cell.winrate : cell.games
      rawValues.push({
        idx: index,
        value,
        bucketLabel,
        games: cell.games,
      })
    })
    return { rawValues, hasData }
  }

  const pendingSeries: DurPendingSerie[] = tiersOrdered
    .map(tier => {
      const { rawValues, hasData } = buildDenseRowForTier(tier)
      if (!hasData) return null
      return {
        tier,
        color: RANK_COLOR_MAP[tier] ?? '#64748b',
        rawValues,
      }
    })
    .filter((s): s is DurPendingSerie => s !== null)

  if (trendShowGlobalLine.value) {
    const rawValues: DurPendingSerie['rawValues'] = []
    let hasData = false
    fullDurations.forEach((durMin, idx) => {
      const bucketLabel = `${durMin}–${durMin + 5} min`
      if (idx === 0) {
        rawValues.push({ idx, value: 0, bucketLabel, games: 0 })
        return
      }
      if (mode === 'winrate') {
        let tw = 0
        let tg = 0
        for (const map of tierBucketMap.values()) {
          const c = map.get(durMin)
          if (c && c.games > 0) {
            tw += c.wins
            tg += c.games
          }
        }
        let label = bucketLabel
        if (tg === 0 && durMin === 5) {
          let tw0 = 0
          let tg0 = 0
          for (const map of tierBucketMap.values()) {
            const c = map.get(0)
            if (c && c.games > 0) {
              tw0 += c.wins
              tg0 += c.games
            }
          }
          if (tg0 > 0) {
            tw = tw0
            tg = tg0
            label = `0–5 min`
          }
        }
        if (tg > 0) hasData = true
        const value = tg > 0 ? (100 * tw) / tg : 0
        rawValues.push({ idx, value, bucketLabel: label, games: tg })
      } else {
        let tg = 0
        for (const map of tierBucketMap.values()) {
          const c = map.get(durMin)
          if (c && c.games > 0) tg += c.games
        }
        let label = bucketLabel
        if (tg === 0 && durMin === 5) {
          let tg0 = 0
          for (const map of tierBucketMap.values()) {
            const c = map.get(0)
            if (c && c.games > 0) tg0 += c.games
          }
          if (tg0 > 0) {
            tg = tg0
            label = `0–5 min`
          }
        }
        if (tg > 0) hasData = true
        rawValues.push({ idx, value: tg, bucketLabel: label, games: tg })
      }
    })
    if (hasData && rawValues.length) {
      pendingSeries.push({
        tier: 'GLOBAL',
        color: RANK_COLOR_MAP.GLOBAL ?? '#c084fc',
        rawValues,
      })
    }
  }

  if (!pendingSeries.length) return null

  const smoothedByTier = pendingSeries.map(serie => {
    const smoothValues = smoothSeries(
      serie.rawValues.map(v => v.value),
      3
    )
    /** Après lissage, l’origine reste exactement à 0. */
    if (smoothValues.length) smoothValues[0] = 0
    return { ...serie, smoothValues }
  })

  const allSmoothed = smoothedByTier.flatMap(s => s.smoothValues).filter(v => Number.isFinite(v))
  const maxVal = allSmoothed.length ? Math.max(0, ...allSmoothed) : 0
  const domainMin = 0
  const domainMax =
    mode === 'games' ? Math.max(1, maxVal * 1.08) : Math.min(100, Math.max(maxVal * 1.12, 1))
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
        games: v.games,
      }
    })
    return {
      tier: serie.tier,
      color: serie.color,
      path: buildPath(points.map(p => ({ x: p.x, y: p.y }))),
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
      label: mode === 'games' ? `${Math.round(value)}` : `${value.toFixed(1)}%`,
    })
  }

  const tickCount = Math.min(6, Math.max(2, n))
  const step = n <= 1 ? 1 : Math.max(1, Math.floor((n - 1) / (tickCount - 1)))
  const xTicks: Array<{ index: number; x: number; label: string }> = []
  for (let i = 0; i < n; i += step) {
    const durMin = fullDurations[i]
    if (durMin === undefined) continue
    xTicks.push({
      index: i,
      x: xAt(i),
      label: `${durMin}`,
    })
  }
  const lastIdx = n - 1
  if (!xTicks.some(t => t.index === lastIdx)) {
    const durMin = fullDurations[lastIdx]
    if (durMin !== undefined) {
      xTicks.push({ index: lastIdx, x: xAt(lastIdx), label: `${durMin}` })
    }
  }

  const metricId: TrendMetricId = mode === 'games' ? 'games' : 'winrate'
  return {
    metricId,
    title:
      mode === 'games'
        ? t('statisticsPage.championStatsDurationGamesDistribution')
        : t('statisticsPage.championStatsDurationWinrate'),
    series: series.filter(s => s.path.length > 0),
    xTicks,
    yTicks,
  }
}

const durationWinrateChartCard = computed(() => buildDurationByTierChart('winrate'))
const durationGamesChartCard = computed(() => buildDurationByTierChart('games'))

const durationTrendExtraCards = computed((): TrendChartCard[] => {
  const out: TrendChartCard[] = []
  const wr = durationWinrateChartCard.value
  const g = durationGamesChartCard.value
  if (wr) out.push(wr)
  if (g) out.push(g)
  return out
})

watch(
  [
    championId,
    filterVersion,
    filterRank,
    filterRole,
    filterPlayersMasterPlus,
    championProgressionFromVersion,
  ],
  () => {
    if (!championId.value || Number.isNaN(championId.value)) return
    loadChampion()
    loadChampionDamageSplit()
    loadDurationByTier()
    loadTrendSnapshots()
    loadMatchupsExtended()
    _loadRunes()
    _loadChampionSpells()
    loadChampionObjectives()
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
    const current = normalizeChampionTab(route.query.tab)
    if (current === tab) return
    await router.replace({
      query: {
        ...route.query,
        tab,
      },
    })
  })
  watch(filterVersion, () => {
    syncChampionProgressionDeltaToVersionBeforeFilter()
  })
  watch(
    () => versionsFromOverview.value.map(v => v.version).join('\n'),
    () => {
      if (!filterVersion.value) return
      if (championProgressionFromVersionOverride.value !== '') return
      syncChampionProgressionDeltaToVersionBeforeFilter()
    }
  )
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
      : []
  } catch {
    versionsFromOverview.value = []
  } finally {
    statsPerfEnd('loadVersionsForFilter', t)
  }
  try {
    const versionsData = await statsFetch<{
      versions?: Array<{ version?: string; patchLabel?: string; releaseDate?: string }>
    }>(apiUrl('/api/game-data/versions'))
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

onMounted(async () => {
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
  if (championId.value && !Number.isNaN(championId.value)) {
    await loadChampion()
    loadChampionDamageSplit()
    loadDurationByTier()
    loadTrendSnapshots()
    loadMatchupsExtended()
    _loadRunes()
    _loadChampionSpells()
    loadChampionObjectives()
  }
})

useHead({
  title: () =>
    championStats.value && championName(championId.value)
      ? `${championName(championId.value)} – ${t('statisticsPage.championStatsTitle')}`
      : t('statisticsPage.championStatsTitle'),
})
</script>

<style scoped>
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
.champion-stats aside {
  background: #08101f !important;
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
.champion-skills-orders-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.72rem;
}
.champion-skills-orders-table th,
.champion-skills-orders-table td {
  border: 1px solid rgb(var(--rgb-primary) / 0.25);
  text-align: center;
  padding: 0.25rem 0.2rem;
}
.champion-skills-orders-table thead th {
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.85);
  background: rgb(var(--rgb-surface) / 0.6);
}
.champion-skill-icon-cell {
  background: rgb(var(--rgb-surface) / 0.45);
}
.champion-skill-cell {
  font-weight: 700;
  color: rgb(var(--rgb-text) / 0.35);
  background: rgb(var(--rgb-surface) / 0.25);
}
.champion-skill-cell-active {
  color: rgb(var(--rgb-text));
  background: rgb(var(--rgb-accent) / 0.2);
}
.champion-skill-metric-cell {
  font-weight: 700;
  color: rgb(var(--rgb-text) / 0.95);
  background: rgb(var(--rgb-surface) / 0.65);
}
</style>
