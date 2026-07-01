<template>
  <div
    class="champion-stats flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-background text-text"
  >
    <div class="w-full flex-shrink-0 px-4 pb-2 pt-4 max-lg:px-3">
      <div
        class="statistics-tabs-bar champion-tabs-bar flex w-full min-w-0 items-start gap-2 overflow-x-hidden"
      >
        <div
          class="statistics-tabs-scroll-wrap champion-tabs-scroll-wrap relative min-w-0 flex-1 overflow-hidden"
        >
          <nav
            ref="championTabsNavEl"
            role="tablist"
            :aria-label="t('statisticsPage.championStatsTitle')"
            class="statistics-tabs-nav champion-tabs-nav flex flex-nowrap gap-1 overflow-x-auto border-b border-primary/30 pb-2"
          >
            <button
              v-for="tab in championTabs"
              :id="`champion-tab-${tab.id}`"
              :key="tab.id"
              type="button"
              role="tab"
              :data-tab-id="tab.id"
              :aria-selected="activeChampionTab === tab.id"
              :tabindex="activeChampionTab === tab.id ? 0 : -1"
              :class="[
                'statistics-tab-btn champion-tab-btn',
                activeChampionTab === tab.id ? 'is-active' : '',
              ]"
              @click="activeChampionTab = tab.id"
              @keydown="onChampionTabsKeydown($event, tab.id)"
            >
              {{ t(tab.label) }}
            </button>
          </nav>
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
        v-if="filtersOpen && effectiveFiltersSheetMode"
        class="fixed inset-0 z-[10050] bg-black/50"
        aria-hidden="true"
        role="presentation"
        @click="closeFilters"
      />

      <aside
        v-show="filtersOpen || !effectiveFiltersSheetMode"
        :class="[
          'statistics-filters-panel flex shrink-0 flex-col overflow-hidden',
          effectiveFiltersSheetMode
            ? 'fixed inset-x-0 bottom-0 top-auto z-[10051] max-h-[85vh] w-full rounded-t-2xl bg-surface shadow-lg'
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
            class="statistics-filters-reset ui-build-card-button inline-flex shrink-0 touch-manipulation items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold"
            @click="resetChampionFilters"
          >
            <span class="iconify i-mdi:refresh" aria-hidden="true" />
            Reset
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
              <div
                class="mt-2 space-y-2 rounded-md border border-primary/20 bg-background/40 p-2 text-[10px] text-text/70"
                :title="
                  activeChampionTab === 'synergy'
                    ? t('statisticsPage.championSynergyTooltipLaneProfile')
                    : t('statisticsPage.championMatchupTooltipLaneProfile')
                "
              >
                <p class="leading-snug text-text/60">
                  {{ t('statisticsPage.championMatchupLaneProfileLegendHint') }}
                </p>
                <p v-if="activeChampionTab === 'synergy'" class="leading-snug text-text/55">
                  {{ t('statisticsPage.championSynergyProfileWarningsHint') }}
                </p>
                <div class="font-semibold text-text/80">
                  {{ t('statisticsPage.championMatchupLaneProfileLegendTitle') }}
                </div>
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
          <button
            type="button"
            class="statistics-filters-mobile-close lg:hidden"
            @click="closeFilters"
          >
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
              <!-- Header: image + nom + KPI principaux (repliable sur mobile) -->
              <div
                class="champion-header-wrap border-b border-primary/25 max-lg:border-b max-lg:border-primary/25"
              >
                <button
                  v-if="!championHeaderBandOpen"
                  type="button"
                  class="champion-header-band-toggle flex w-full touch-manipulation items-center gap-2.5 px-3 py-2.5 text-left lg:hidden"
                  :aria-expanded="false"
                  :aria-controls="'champion-header-band'"
                  @click="championHeaderBandOpen = true"
                >
                  <img
                    v-if="gameVersion && championByKey(championId)"
                    :src="getChampionImageUrl(gameVersion, championByKey(championId)!.image.full)"
                    :alt="championName(championId) ?? ''"
                    class="h-9 w-9 shrink-0 rounded-full object-cover"
                    width="36"
                    height="36"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-accent">
                      {{ championName(championId) || championId }}
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
                  id="champion-header-band"
                  class="champion-header-band flex flex-wrap items-center gap-2 px-3 py-2 max-lg:flex-col max-lg:items-stretch lg:flex-nowrap lg:items-center lg:gap-3 lg:py-2.5"
                  :class="championHeaderBandOpen ? 'flex' : 'hidden lg:flex'"
                >
                  <div
                    class="champion-header-identity flex shrink-0 items-center gap-2 max-lg:w-full lg:flex-col lg:gap-0.5 lg:text-center"
                  >
                    <h1
                      class="order-2 min-w-0 truncate text-sm font-semibold leading-tight text-accent max-lg:flex-1 lg:order-1 lg:max-w-[5.5rem]"
                    >
                      {{ championName(championId) || championId }}
                    </h1>
                    <img
                      v-if="gameVersion && championByKey(championId)"
                      :src="getChampionImageUrl(gameVersion, championByKey(championId)!.image.full)"
                      :alt="championName(championId) ?? ''"
                      class="order-1 h-9 w-9 shrink-0 rounded-full object-cover lg:order-2 lg:h-10 lg:w-10"
                      width="40"
                      height="40"
                    />
                  </div>
                  <div class="champion-header-roles text-[11px] text-text/80">
                    <span
                      v-for="role in roleDistribution"
                      :key="role.role"
                      class="champion-header-role-badge inline-flex items-center justify-between gap-1.5"
                      :title="roleLabel(role.role)"
                    >
                      <img
                        :src="roleIconPath(role.role)"
                        :alt="roleLabel(role.role)"
                        class="h-3 w-3 shrink-0 object-contain"
                        width="12"
                        height="12"
                      />
                      <span class="shrink-0 font-medium tabular-nums">
                        {{ formatDonutPercent(role.pickrate) }}%
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
                      class="champion-header-kpis flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text/85"
                    >
                      <span
                        >{{ t('statisticsPage.pickrate') }}:
                        <strong
                          >{{ formatDonutPercent(championStats.pickrate ?? 0) }}%</strong
                        ></span
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
                    <button
                      type="button"
                      class="champion-header-band-collapse shrink-0 rounded p-1 text-text/60 transition-colors hover:bg-white/5 hover:text-text lg:hidden"
                      :aria-expanded="true"
                      :aria-controls="'champion-header-band'"
                      :title="t('statisticsPage.championStatsHeaderHide')"
                      @click="championHeaderBandOpen = false"
                    >
                      <svg
                        class="h-4 w-4 rotate-180"
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
                  </div>
                </div>
              </div>
              <section
                v-if="activeChampionTab === 'overview'"
                id="champion-tab-panel-overview"
                role="tabpanel"
                class="champion-tab-panel p-1 max-lg:px-3 max-lg:py-3"
              >
                <div
                  class="champion-overview-filters mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs"
                >
                  <h2 class="shrink-0 text-base font-semibold text-text">
                    {{ t('statisticsPage.championStatsTrendsTitle') }}
                  </h2>
                  <label class="inline-flex shrink-0 items-center gap-2 text-text/80">
                    <span>{{ t('statisticsPage.championStatsTrendsGranularity') }}</span>
                    <select
                      v-model="trendGranularity"
                      class="rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                    >
                      <option value="day">
                        {{ t('statisticsPage.championStatsTrendsDay') }}
                      </option>
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
                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="rounded px-2 py-1 font-medium transition-colors"
                      :class="
                        trendRangeMode === '7d'
                          ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
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
                          ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
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
                          ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
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
                        v-model.number="trendMonthsWindowModel"
                        type="number"
                        min="1"
                        max="24"
                        class="w-16 rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                      />
                    </label>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="rounded px-2 py-1 font-medium transition-colors"
                      :class="
                        trendDivisionPreset === 'selected'
                          ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
                          : 'bg-black/20 text-text/85 hover:bg-white/10'
                      "
                      @click="setTrendDivisionPreset('selected')"
                    >
                      {{ t('statisticsPage.championStatsTrendsPresetSelected') }}
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-1 font-medium transition-colors"
                      :class="
                        trendDivisionPreset === 'average'
                          ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
                          : 'bg-black/20 text-text/85 hover:bg-white/10'
                      "
                      @click="setTrendDivisionPreset('average')"
                    >
                      Average
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-1 font-medium transition-colors"
                      :class="
                        trendDivisionPreset === 'skilled'
                          ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
                          : 'bg-black/20 text-text/85 hover:bg-white/10'
                      "
                      @click="setTrendDivisionPreset('skilled')"
                    >
                      Skilled
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-1 font-medium transition-colors"
                      :class="
                        trendDivisionPreset === 'elite'
                          ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
                          : 'bg-black/20 text-text/85 hover:bg-white/10'
                      "
                      @click="setTrendDivisionPreset('elite')"
                    >
                      Elite
                    </button>
                    <label class="inline-flex items-center gap-1 text-text/80">
                      <input
                        v-model="trendShowGlobalLine"
                        type="checkbox"
                        class="rounded border-primary/50"
                      />
                      <span>{{ t('statisticsPage.championStatsTrendsGlobalLine') }}</span>
                    </label>
                  </div>
                </div>
                <div v-if="trendPending" class="py-4 text-text/70">
                  {{ t('statisticsPage.loading') }}
                </div>
                <template v-else>
                  <p v-if="trendError" class="py-2 text-sm text-error">{{ trendError }}</p>
                  <div
                    v-if="
                      trendChartCards.length ||
                      durationByTierPending ||
                      durationTrendExtraCards.length
                    "
                    class="champion-trend-charts-grid grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2"
                  >
                    <article
                      v-for="card in trendChartCards"
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
                        class="statistics-chart-tooltip pointer-events-none fixed z-[90]"
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
                      class="champion-trend-chart-card w-full min-w-0 max-w-full rounded border border-primary/20 bg-background/30 p-3"
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
                          class="statistics-chart-tooltip pointer-events-none fixed z-[90]"
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
                        <div
                          class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text/80"
                        >
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
            </div>
            <div class="champion-tab-panels mb-6 w-full min-w-0 space-y-3 max-lg:mb-4">
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
                  {{ t('statisticsPage.noData') }}
                </div>
                <div v-else class="space-y-1.5">
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
                class="champion-tab-panel-runes"
              >
                <StatisticsRunesTab />
              </div>
              <div
                v-if="isChampionTab('spells')"
                id="champion-tab-panel-spells"
                role="tabpanel"
                class="champion-tab-panel-spells"
              >
                <StatisticsSpellsTab />
              </div>
              <div
                v-if="isChampionTab('skills')"
                id="champion-tab-panel-skills"
                role="tabpanel"
                class="champion-tab-panel-skills"
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
                v-if="activeChampionTab === 'pings'"
                id="champion-tab-panel-pings"
                role="tabpanel"
                class="champion-tab-panel p-4 max-lg:px-3 max-lg:py-3"
              >
                <ChampionPingsTab
                  :data="championPingsData"
                  :baseline="championPingsBaselineData"
                  :pending="championPingsPending"
                />
              </div>
              <div
                v-if="activeChampionTab === 'vision'"
                id="champion-tab-panel-vision"
                role="tabpanel"
                class="champion-tab-panel p-4 max-lg:px-3 max-lg:py-3"
              >
                <ChampionVisionTab
                  :data="championVisionData"
                  :baseline="championVisionBaselineData"
                  :pending="championVisionPending"
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
import { ref, computed, watch, onMounted, onUnmounted, provide, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
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
import ChampionMatchupDetailPanel, {
  type MatchupDetailTabId,
} from '~/components/statistics/ChampionMatchupDetailPanel.vue'
import ChampionSynergyTab, {
  type SynergyExtRow,
} from '~/components/statistics/ChampionSynergyTab.vue'
import ChampionObjectivesTab, {
  type ChampionObjectivesSummary,
} from '~/components/statistics/ChampionObjectivesTab.vue'
import ChampionMiscTab, {
  type ChampionMiscSummary,
} from '~/components/statistics/ChampionMiscTab.vue'
import ChampionPingsTab, {
  type ChampionPingsSummary,
} from '~/components/statistics/ChampionPingsTab.vue'
import ChampionVisionTab, {
  type ChampionVisionSummary,
} from '~/components/statistics/ChampionVisionTab.vue'
import ChampionSpellOrderCard from '~/components/statistics/ChampionSpellOrderCard.vue'
import { mergeChampionSpellOrderRows } from '~/utils/championSpellOrderMerge'
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
const StatisticsRunesTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsRunesTab.vue')
)
const StatisticsSpellsTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsSpellsTab.vue')
)

definePageMeta({
  layout: 'default',
  validate(route) {
    const raw = route.params.slug
    const slug = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '')
    return slug.length > 0 && !slug.startsWith('_')
  },
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const versionStore = useVersionStore()
const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const summonerSpellsStore = useSummonerSpellsStore()
const { version: gameVersion } = useGameVersion()
const riotLocale = computed(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US'))
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
  riotLocale
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

const CHAMPION_HEADER_BAND_STORAGE_KEY = 'champion-header-band-open'
const championHeaderBandOpen = ref(true)

const championHeaderCollapsedSummary = computed(() => {
  if (!championStats.value) return ''
  const pr = formatDonutPercent(championStats.value.pickrate ?? 0)
  const wr = formatDonutPercent(championStats.value.winrate ?? 0)
  const ban = formatDonutPercent(championStats.value.banrate ?? 0)
  return `${t('statisticsPage.pickrate')} ${pr}% · ${t('statisticsPage.winrate')} ${wr}% · ${t('statisticsPage.championStatsBanrateTitle')} ${ban}%`
})

function initChampionHeaderBandOpen(): void {
  if (!import.meta.client) return
  const stored = sessionStorage.getItem(CHAMPION_HEADER_BAND_STORAGE_KEY)
  if (stored === '0' || stored === '1') {
    championHeaderBandOpen.value = stored === '1'
    return
  }
  championHeaderBandOpen.value = window.matchMedia('(min-width: 1024px)').matches
}

watch(championHeaderBandOpen, open => {
  if (!import.meta.client) return
  sessionStorage.setItem(CHAMPION_HEADER_BAND_STORAGE_KEY, open ? '1' : '0')
})

function cardIsFavorite(cardId: string): boolean {
  return statisticsCustomStore.isFavorite(cardId)
}

function toggleFavoriteCard(cardId: string, title: string): void {
  statisticsCustomStore.toggleFavorite(cardId, title)
}
const { effectiveFiltersSheetMode, showDesktopFiltersTrigger, filtersFabClass } =
  useStatisticsFiltersSheetMode()

const filterVersion = ref('')
const trendChartFromDate = ref('')
const filterRank = ref<string[]>([])
const filterRole = ref('')
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

watch([filtersOpen, effectiveFiltersSheetMode], () => {
  if (!import.meta.client) return
  const lock = effectiveFiltersSheetMode.value && filtersOpen.value
  document.body.style.overflow = lock ? 'hidden' : ''
})

function normalizeTrendChartFromDate(raw: string): string | null {
  const s = raw.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

/** Référence patch pour fenêtre temporelle des graphes tendances (aligné page stats). */
const championProgressionFromVersionOverride = ref('')
function normalizeVersionToPrefix(v: string | null | undefined): string | null {
  if (!v || typeof v !== 'string') return null
  const parts = v.trim().split('.')
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return parts[0] || null
}

/** Même tri que /statistics et tier-list : patch le plus récent en premier. */
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
} | null>(championPageSsr.value?.stats ?? null)

pending.value = Boolean(championPageSsrPending.value && !championPageSsr.value?.stats)

watch(championPageSsr, value => {
  if (value?.stats) {
    championStats.value = value.stats
    pending.value = false
  }
})
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

const championDamageDonutStyle = computed(() =>
  conicDonutStyleFromLegend(championDamageShareLegend.value)
)

const championDamageTargetDonutStyle = computed(() =>
  conicDonutStyleFromLegend(championDamageTargetLegend.value)
)

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

const durationByTierPending = ref(false)
const durationByTierData = ref<{
  series: Array<{
    rankTier: string
    buckets: Array<{ durationMin: number; matchCount: number; wins: number; winrate: number }>
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
const trendMonthsWindowModel = computed({
  get: () => trendMonthsWindow.value,
  set: (value: number) => {
    trendMonthsWindow.value = Math.max(1, Math.min(24, Number(value) || 1))
  },
})
const trendDivisionPreset = ref<TrendDivisionPreset>('selected')
const trendShowGlobalLine = ref(true)
const trendPending = ref(false)
const trendError = ref<string | null>(null)
const trendPoints = ref<TrendSnapshotPoint[]>([])
const trendVersionsCatalog = ref<Array<{ patchLabel: string; releaseDate: string }>>([])

const activeChampionTab = ref<
  | 'overview'
  | 'matchups'
  | 'synergy'
  | 'runes'
  | 'spells'
  | 'skills'
  | 'objectives'
  | 'pings'
  | 'vision'
  | 'misc'
>('overview')
type ChampionTabId =
  | 'overview'
  | 'matchups'
  | 'synergy'
  | 'runes'
  | 'spells'
  | 'skills'
  | 'objectives'
  | 'pings'
  | 'vision'
  | 'misc'
const championPageBootstrapped = ref(false)
const championTabLoaded = ref<Record<ChampionTabId, boolean>>({
  overview: false,
  matchups: false,
  synergy: false,
  runes: false,
  spells: false,
  skills: false,
  objectives: false,
  pings: false,
  vision: false,
  misc: false,
})
const championTabs = [
  { id: 'overview' as const, label: 'statisticsPage.championStatsTabOverview' },
  { id: 'matchups' as const, label: 'statisticsPage.championStatsTabMatchups' },
  { id: 'synergy' as const, label: 'statisticsPage.championStatsTabSynergy' },
  { id: 'runes' as const, label: 'statisticsPage.championStatsTabRunes' },
  { id: 'spells' as const, label: 'statisticsPage.championStatsTabSpells' },
  { id: 'skills' as const, label: 'statisticsPage.championStatsTabSkills' },
  { id: 'objectives' as const, label: 'statisticsPage.objectivesTabMain' },
  { id: 'pings' as const, label: 'statisticsPage.tabPings' },
  { id: 'vision' as const, label: 'statisticsPage.tabVision' },
  { id: 'misc' as const, label: 'statisticsPage.championStatsTabMisc' },
]
const championTabsNavEl = ref<HTMLElement | null>(null)
useHorizontalScrollContainer(championTabsNavEl)

function scrollActiveChampionTabIntoView(behavior: ScrollBehavior = 'smooth'): void {
  if (!import.meta.client || !championTabsNavEl.value) return
  const el = championTabsNavEl.value.querySelector<HTMLButtonElement>(
    `button[data-tab-id="${activeChampionTab.value}"]`
  )
  el?.scrollIntoView({ inline: 'start', block: 'nearest', behavior })
}

function focusChampionTabButton(nextId: ChampionTabId): void {
  activeChampionTab.value = nextId
  if (!import.meta.client) return
  requestAnimationFrame(() => {
    const el = championTabsNavEl.value?.querySelector<HTMLButtonElement>(
      `button[data-tab-id="${nextId}"]`
    )
    el?.focus()
    scrollActiveChampionTabIntoView()
  })
}

function focusPrevNextChampionTab(currentTabId: ChampionTabId, direction: -1 | 1): void {
  const ids = championTabs.map(t => t.id)
  let idx = ids.indexOf(currentTabId)
  if (idx < 0) idx = ids.indexOf(activeChampionTab.value)
  if (idx < 0) idx = 0
  const nextIdx = (idx + direction + ids.length) % ids.length
  const nextId = ids[nextIdx]
  if (nextId) focusChampionTabButton(nextId)
}

function focusChampionTabEdge(which: 'first' | 'last'): void {
  const ids = championTabs.map(t => t.id)
  const nextId = which === 'first' ? ids[0] : ids[ids.length - 1]
  if (nextId) focusChampionTabButton(nextId)
}

function onChampionTabsKeydown(e: KeyboardEvent, tabId: ChampionTabId): void {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    focusPrevNextChampionTab(tabId, -1)
    return
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    focusPrevNextChampionTab(tabId, 1)
    return
  }
  if (e.key === 'Home') {
    e.preventDefault()
    focusChampionTabEdge('first')
    return
  }
  if (e.key === 'End') {
    e.preventDefault()
    focusChampionTabEdge('last')
  }
}
const championTabIds = new Set<ChampionTabId>(championTabs.map(t => t.id))
function normalizeChampionTab(input: unknown): ChampionTabId {
  const raw = Array.isArray(input) ? input[0] : input
  const val = String(raw ?? '').trim() as ChampionTabId
  return championTabIds.has(val) ? val : 'overview'
}

function isChampionTab(tab: ChampionTabId): boolean {
  return activeChampionTab.value === tab
}

function resetChampionTabLoadState(): void {
  championTabLoaded.value = {
    overview: false,
    matchups: false,
    synergy: false,
    runes: false,
    spells: false,
    skills: false,
    objectives: false,
    pings: false,
    vision: false,
    misc: false,
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

function setTrendDivisionPreset(preset: TrendDivisionPreset): void {
  trendDivisionPreset.value = preset
  if (preset === 'selected') return
  filterRank.value = [...TREND_PRESET_TIERS[preset]]
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

const championStatisticsPageCtx = new Proxy({} as Record<string, unknown>, {
  get(_target, key: string | symbol) {
    if (key === 't') return t
    switch (key) {
      case 'gameVersion':
        return gameVersion.value || versionStore.currentVersion || ''
      case 'versionStore':
        return versionStore
      case 'spellsModeFilter':
        return championSpellsModeFilter.value
      case 'overviewDetailData':
        if (activeChampionTab.value === 'runes') return championRunesPanelData.value
        return {
          summonerSpells: championSpellsTableSolo.value,
          summonerSpellSets: championSpellsTablePairs.value,
        }
      case 'overviewDetailBaselineData':
        if (activeChampionTab.value === 'runes') return championRunesBaselinePanelData.value
        return {
          summonerSpells: mapChampionSpellsTableSolo(championSpellsBaselineSolo.value),
          summonerSpellSets: mapChampionSpellsTablePairs(championSpellsBaselineDuos.value),
        }
      case 'overviewDetailComparisonVersion':
        return championRunesComparisonVersion.value
      case 'overviewDetailBaselinePending':
        if (activeChampionTab.value === 'runes') return championRunesBaselinePending.value
        return championSpellsBaselinePending.value
      case 'overviewDetailPending':
        if (activeChampionTab.value === 'runes') return runesPending.value
        return championSpellsPending.value
      case 'overviewDetailError':
        return false
      case 'retryOverviewDetail':
        return () => {
          if (activeChampionTab.value === 'runes') {
            _loadRunes().catch(() => undefined)
          } else if (activeChampionTab.value === 'spells') {
            _loadChampionSpells().catch(() => undefined)
          }
        }
      case 'cardIsFavorite':
        return cardIsFavorite
      case 'toggleFavoriteCard':
        return toggleFavoriteCard
      case 'championSearchQuery':
        return ''
      case 'PAGE_SIZE_OPTIONS':
        return [10, 20, 50, 100]
    }
    return undefined
  },
  set(_target, key, value) {
    if (key === 'spellsModeFilter') {
      championSpellsModeFilter.value = value as 'solo' | 'pair'
      return true
    }
    return false
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
    const fetches: Promise<unknown>[] = [
      statsFetch<{ totalGames: number; spells: ChampionSpellSoloApiRow[] }>(
        apiUrl(`/api/stats/champions/${championId.value}/summoner-spells${q || ''}`)
      ),
      statsFetch<{ totalGames: number; duos: ChampionSpellDuoApiRow[] }>(
        apiUrl(`/api/stats/champions/${championId.value}/summoner-spells-duos${q || ''}`)
      ),
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
    ]
    if (cmp && bq) {
      fetches.push(
        statsFetch<{ totalGames: number; spells: ChampionSpellSoloApiRow[] }>(
          apiUrl(`/api/stats/champions/${championId.value}/summoner-spells${bq}`)
        ),
        statsFetch<{ totalGames: number; duos: ChampionSpellDuoApiRow[] }>(
          apiUrl(`/api/stats/champions/${championId.value}/summoner-spells-duos${bq}`)
        )
      )
    }
    const results = await Promise.allSettled(fetches)
    championSpellsData.value =
      results[0].status === 'fulfilled'
        ? (results[0].value as typeof championSpellsData.value)
        : null
    championSpellsDuosData.value =
      results[1].status === 'fulfilled'
        ? (results[1].value as typeof championSpellsDuosData.value)
        : null
    championSpellOrdersData.value =
      results[2].status === 'fulfilled'
        ? (results[2].value as typeof championSpellOrdersData.value)
        : null
    if (cmp && bq) {
      const baseSolo = results[3]?.status === 'fulfilled' ? results[3].value : null
      const baseDuos = results[4]?.status === 'fulfilled' ? results[4].value : null
      championSpellsBaselineSolo.value =
        baseSolo && typeof baseSolo === 'object' && 'spells' in baseSolo
          ? (baseSolo as { spells: ChampionSpellSoloApiRow[] }).spells
          : []
      championSpellsBaselineDuos.value =
        baseDuos && typeof baseDuos === 'object' && 'duos' in baseDuos
          ? (baseDuos as { duos: ChampionSpellDuoApiRow[] }).duos
          : []
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
    await Promise.all([loadDurationByTier(), loadTrendSnapshots()])
    markChampionTabLoaded('overview')
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
  if (tab === 'pings') {
    await loadChampionPings()
    markChampionTabLoaded('pings')
    return
  }
  if (tab === 'vision') {
    await loadChampionVision()
    markChampionTabLoaded('vision')
    return
  }
  if (tab === 'misc') {
    await loadChampionMisc()
    markChampionTabLoaded('misc')
  }
}

async function reloadChampionBaseAndActiveTabData(): Promise<void> {
  if (!championPageBootstrapped.value) return
  if (!championId.value || Number.isNaN(championId.value)) return
  await loadChampion()
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

const trendSelectedTiers = computed(() => trendTiersFromFilterOrData.value)

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
    if (!Number.isFinite(maxVal)) maxVal = 1
    if (metric.id === 'games') {
      minVal = 0
      if (maxVal <= 0) maxVal = 1
    } else if (maxVal <= minVal) {
      maxVal = minVal + (metric.id === 'pickrate' || metric.id === 'banrate' ? 0.5 : 1)
    }
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
    initChampionHeaderBandOpen()
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
      season: lolSeasonFromGameVersion(resolvedGamePatch.value),
      patch: resolvedGamePatch.value,
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
</style>
