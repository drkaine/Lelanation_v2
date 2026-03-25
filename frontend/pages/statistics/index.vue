<template>
  <div class="statistics flex min-h-screen flex-col text-text">
    <!-- Burger pour ouvrir les filtres (mobile) -->
    <button
      type="button"
      class="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-surface/90 text-text shadow lg:hidden"
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
    <div class="w-full flex-shrink-0 border-b border-primary/30 bg-surface/30 px-4 pb-2 pt-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="[
            'rounded px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-accent text-background'
              : 'bg-surface/50 text-text/80 hover:bg-primary/20 hover:text-text',
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Filtres + contenu : même hauteur -->
    <div class="flex min-h-0 flex-1 pt-4">
      <button
        type="button"
        class="filters-collapse-floating hidden lg:sticky lg:top-4 lg:z-20 lg:mr-2 lg:flex lg:shrink-0 lg:self-start"
        :aria-label="
          filtersOpen ? t('statisticsPage.closeFilters') : t('statisticsPage.openFilters')
        "
        @click="toggleFiltersOpen"
      >
        <svg
          class="h-4 w-4 transition-transform duration-200"
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
          <div>
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
              t('statisticsPage.searchChampion')
            }}</label>
            <input
              id="champion-search"
              v-model.trim="championSearchQuery"
              type="text"
              :placeholder="t('statisticsPage.searchChampionPlaceholder')"
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
            <div class="rounded-lg">
              <h2 class="mb-4 text-xl font-semibold text-text-accent">
                {{ t('statisticsPage.overviewTitle') }}
              </h2>
              <div v-if="overviewPending" class="text-text/70">
                {{ t('statisticsPage.loading') }}
              </div>
              <div
                v-else-if="overviewError"
                class="rounded border border-error/50 bg-error/10 p-4 text-error"
              >
                <p class="mb-2">{{ overviewError }}</p>
                <button
                  type="button"
                  class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
                  @click="loadOverview()"
                >
                  {{ t('statisticsPage.retry') }}
                </button>
              </div>
              <div v-else-if="overviewData" class="space-y-3">
                <!-- Fast Stats encarts (style LeagueOfGraphs avec nos couleurs) -->
                <div
                  class="flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[5px] pb-[5px]"
                >
                  <!-- Champions les plus choisis -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.mostPicked')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.mostPicked')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.mostPicked',
                            t('statisticsPage.fastStatsMostPicked')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.mostPicked') ? '★' : '☆' }}
                      </button>
                      <span class="flex-1">
                        {{ t('statisticsPage.fastStatsMostPicked') }}
                        <span
                          class="group/tooltip relative ml-1 inline-flex cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden min-w-[14rem] max-w-[26rem] -translate-x-1/2 rounded border border-primary/40 bg-surface/100 px-3 py-2 text-left text-xs font-normal leading-snug text-text shadow-lg group-hover/tooltip:block"
                          >
                            {{ t('statisticsPage.tooltipFastStatsMostPicked') }}
                          </span>
                        </span>
                      </span>
                    </h3>
                    <table
                      v-if="(overviewData.topPickrateChampions ?? []).length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(row, idx) in (overviewData.topPickrateChampions ?? []).slice(
                            0,
                            5
                          )"
                          :key="row.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5 align-middle">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(row.championId) || row.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-accent transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        (row.pickrate /
                                          Math.max(
                                            ...(overviewData.topPickrateChampions ?? []).map(
                                              (c: { pickrate: number }) => c.pickrate
                                            ),
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="w-9 shrink-0 text-right font-medium text-text"
                                >{{ Number(row.pickrate).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.fastStatsNoData') }}
                    </div>
                    <div
                      v-if="(overviewData.topPickrateChampions ?? []).length"
                      class="mt-1 text-center"
                    >
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToTierListWithSort('pickrate')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Meilleurs champions -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.bestWinrate')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.bestWinrate')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.bestWinrate',
                            t('statisticsPage.fastStatsBestWinrate')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.bestWinrate') ? '★' : '☆' }}
                      </button>
                      <span class="inline-flex flex-1 items-center">
                        {{ t('statisticsPage.fastStatsBestWinrate') }}
                        <span
                          class="group/tooltip relative ml-1 inline-flex cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden min-w-[14rem] max-w-[26rem] -translate-x-1/2 rounded border border-primary/40 bg-surface/100 px-3 py-2 text-left text-xs font-normal leading-snug text-text shadow-lg group-hover/tooltip:block"
                          >
                            {{ t('statisticsPage.tooltipFastStatsBestWinrate') }}
                          </span>
                        </span>
                      </span>
                    </h3>
                    <table
                      v-if="overviewEffectiveTopWinrateChampions.length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(row, idx) in overviewEffectiveTopWinrateChampions.slice(0, 5)"
                          :key="row.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5 align-middle">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(row.championId) || row.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-success transition-[width]"
                                  :style="{
                                    width: (() => {
                                      const list = overviewEffectiveTopWinrateChampions
                                      const minWr = Math.min(...list.map(c => c.winrate), 50)
                                      const maxWr = Math.max(...list.map(c => c.winrate), 52)
                                      const range = maxWr - minWr || 1
                                      return (
                                        Math.min(
                                          100,
                                          Math.max(0, ((row.winrate - minWr) / range) * 100)
                                        ) + '%'
                                      )
                                    })(),
                                  }"
                                />
                              </div>
                              <span class="w-9 shrink-0 text-right font-medium text-text"
                                >{{ Number(row.winrate).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.fastStatsNoData') }}
                    </div>
                    <div
                      v-if="overviewEffectiveTopWinrateChampions.length"
                      class="mt-1 text-center"
                    >
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToTierListWithSort('winrate')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Champions les plus bannis -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.mostBanned')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.mostBanned')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.mostBanned',
                            t('statisticsPage.fastStatsMostBanned')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.mostBanned') ? '★' : '☆' }}
                      </button>
                      <span class="inline-flex flex-1 items-center">
                        {{ t('statisticsPage.fastStatsMostBanned') }}
                        <span
                          class="group/tooltip relative ml-1 inline-flex cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden min-w-[14rem] max-w-[26rem] -translate-x-1/2 rounded border border-primary/40 bg-surface/100 px-3 py-2 text-left text-xs font-normal leading-snug text-text shadow-lg group-hover/tooltip:block"
                          >
                            {{ t('statisticsPage.tooltipFastStatsMostBanned') }}
                          </span>
                        </span>
                      </span>
                    </h3>
                    <table
                      v-if="overviewEffectiveTopBanrateChampions.length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(row, idx) in overviewEffectiveTopBanrateChampions.slice(0, 5)"
                          :key="row.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5 align-middle">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(row.championId) || row.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-error transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        (row.banrate /
                                          Math.max(
                                            ...overviewEffectiveTopBanrateChampions.map(
                                              (c: { banrate: number }) => c.banrate
                                            ),
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="w-9 shrink-0 text-right font-medium text-text"
                                >{{ Number(row.banrate).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.fastStatsNoData') }}
                    </div>
                    <div
                      v-if="overviewEffectiveTopBanrateChampions.length"
                      class="mt-1 text-center"
                    >
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToTierListWithSort('banrate')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Winrate depuis X -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.winrateSince')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.winrateSince')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.winrateSince',
                            t('statisticsPage.fastStatsWinrateProgression')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.winrateSince') ? '★' : '☆' }}
                      </button>
                      <span class="flex flex-1 items-center justify-between gap-2">
                        <span>
                          {{
                            progressionFromVersion
                              ? t('statisticsPage.fastStatsWinrateSince', {
                                  version: progressionFromVersion ?? undefined,
                                })
                              : t('statisticsPage.fastStatsWinrateProgression')
                          }}
                        </span>
                      </span>
                    </h3>
                    <table
                      v-if="overviewTopWinrateSince.length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(row, idx) in overviewTopWinrateSince.slice(0, 5)"
                          :key="'wr-' + row.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5 align-middle">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(row.championId) || row.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-success transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        (row.deltaWr /
                                          Math.max(
                                            ...overviewTopWinrateSince.map(x => x.deltaWr),
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="w-10 shrink-0 text-right font-medium text-success"
                                >+{{ Number(row.deltaWr).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.fastStatsNoProgression') }}
                    </div>
                  </div>

                  <!-- Pickrate depuis X -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.pickrateSince')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.pickrateSince')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.pickrateSince',
                            t('statisticsPage.fastStatsPickrateSinceTitle')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.pickrateSince') ? '★' : '☆' }}
                      </button>
                      <span class="flex-1">{{
                        t('statisticsPage.fastStatsPickrateSinceTitle', {
                          version: progressionFromVersion || '—',
                        })
                      }}</span>
                    </h3>
                    <table
                      v-if="overviewTopPickrateSince.length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(row, idx) in overviewTopPickrateSince.slice(0, 5)"
                          :key="'pr-' + row.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5 align-middle">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(row.championId) || row.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-accent transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        (row.deltaPick /
                                          Math.max(
                                            ...overviewTopPickrateSince.map(x => x.deltaPick),
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="w-10 shrink-0 text-right font-medium text-accent"
                                >+{{ Number(row.deltaPick).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.fastStatsNoProgression') }}
                    </div>
                  </div>

                  <!-- Banrate depuis X -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.banrateSince')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.banrateSince')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.banrateSince',
                            t('statisticsPage.fastStatsBanrateSinceTitle')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.banrateSince') ? '★' : '☆' }}
                      </button>
                      <span class="flex-1">{{
                        t('statisticsPage.fastStatsBanrateSinceTitle', {
                          version: progressionFromVersion || '—',
                        })
                      }}</span>
                    </h3>
                    <table
                      v-if="overviewTopBanrateSince.length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(row, idx) in overviewTopBanrateSince.slice(0, 5)"
                          :key="'br-' + row.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5 align-middle">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(row.championId) || row.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-error transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        (row.deltaBan /
                                          Math.max(
                                            ...overviewTopBanrateSince.map(x => x.deltaBan),
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="w-10 shrink-0 text-right font-medium text-error"
                                >+{{ Number(row.deltaBan).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.fastStatsNoProgression') }}
                    </div>
                  </div>

                  <!-- Winrate depuis X (baisse) -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.winrateSinceDown')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.winrateSinceDown')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.winrateSinceDown',
                            t('statisticsPage.fastStatsWinrateSinceDownTitle')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.winrateSinceDown') ? '★' : '☆' }}
                      </button>
                      <span class="flex-1">{{
                        t('statisticsPage.fastStatsWinrateSinceDownTitle', {
                          version: progressionFromVersion || '—',
                        })
                      }}</span>
                    </h3>
                    <table
                      v-if="overviewBottomWinrateSince.length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(row, idx) in overviewBottomWinrateSince.slice(0, 5)"
                          :key="'wr-down-' + row.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5 align-middle">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(row.championId) || row.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-error transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        (Math.abs(row.deltaWr) /
                                          Math.max(
                                            ...overviewBottomWinrateSince.map(x =>
                                              Math.abs(x.deltaWr)
                                            ),
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="w-10 shrink-0 text-right font-medium text-error"
                                >{{ Number(row.deltaWr).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.fastStatsNoProgression') }}
                    </div>
                  </div>

                  <!-- Pickrate depuis X (baisse) -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.pickrateSinceDown')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.pickrateSinceDown')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.pickrateSinceDown',
                            t('statisticsPage.fastStatsPickrateSinceDownTitle')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.pickrateSinceDown') ? '★' : '☆' }}
                      </button>
                      <span class="flex-1">{{
                        t('statisticsPage.fastStatsPickrateSinceDownTitle', {
                          version: progressionFromVersion || '—',
                        })
                      }}</span>
                    </h3>
                    <table
                      v-if="overviewBottomPickrateSince.length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(row, idx) in overviewBottomPickrateSince.slice(0, 5)"
                          :key="'pr-down-' + row.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5 align-middle">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(row.championId) || row.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-error transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        (Math.abs(row.deltaPick) /
                                          Math.max(
                                            ...overviewBottomPickrateSince.map(x =>
                                              Math.abs(x.deltaPick)
                                            ),
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="w-10 shrink-0 text-right font-medium text-error"
                                >{{ Number(row.deltaPick).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.fastStatsNoProgression') }}
                    </div>
                  </div>

                  <!-- Banrate depuis X (baisse) -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.banrateSinceDown')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.banrateSinceDown')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.banrateSinceDown',
                            t('statisticsPage.fastStatsBanrateSinceDownTitle')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.banrateSinceDown') ? '★' : '☆' }}
                      </button>
                      <span class="flex-1">{{
                        t('statisticsPage.fastStatsBanrateSinceDownTitle', {
                          version: progressionFromVersion || '—',
                        })
                      }}</span>
                    </h3>
                    <table
                      v-if="overviewBottomBanrateSince.length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(row, idx) in overviewBottomBanrateSince.slice(0, 5)"
                          :key="'br-down-' + row.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5 align-middle">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(row.championId) || row.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-error transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        (Math.abs(row.deltaBan) /
                                          Math.max(
                                            ...overviewBottomBanrateSince.map(x =>
                                              Math.abs(x.deltaBan)
                                            ),
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="w-10 shrink-0 text-right font-medium text-error"
                                >{{ Number(row.deltaBan).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.fastStatsNoProgression') }}
                    </div>
                  </div>

                  <!-- Répartition des parties (surrender early / surrender / reste) -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.matchOutcome')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.matchOutcome')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.matchOutcome',
                            t('statisticsPage.overviewMatchOutcomesTitle')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.matchOutcome') ? '★' : '☆' }}
                      </button>
                      <span class="flex-1">{{
                        t('statisticsPage.overviewMatchOutcomesTitle')
                      }}</span>
                    </h3>
                    <div v-if="overviewAbandonsPending" class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.loading') }}
                    </div>
                    <div v-else-if="overviewMatchOutcomeTotal > 0" class="flex items-center gap-2">
                      <div
                        class="overview-match-outcome-bagel h-16 w-16 shrink-0 rounded-full"
                        :style="{ background: overviewMatchOutcomeDonutBg }"
                        aria-hidden="true"
                      >
                        <div
                          class="flex h-full w-full items-center justify-center rounded-full text-[9px] font-semibold text-text/85"
                        >
                          {{ overviewPlayedPct.toFixed(0) }}%
                        </div>
                      </div>
                      <div class="space-y-1 text-xs">
                        <div class="font-medium text-text">
                          Total: {{ overviewMatchOutcomeTotal.toLocaleString() }}
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span class="inline-block h-2.5 w-2.5 rounded-full bg-amber-200" />
                          Early surrender: {{ overviewEarlySurrenderCount.toLocaleString() }} ({{
                            overviewEarlySurrenderPct.toFixed(2)
                          }}%)
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span class="inline-block h-2.5 w-2.5 rounded-full bg-amber-50" />
                          Surrender: {{ overviewSurrenderOnlyCount.toLocaleString() }} ({{
                            overviewSurrenderOnlyPct.toFixed(2)
                          }}%)
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span class="inline-block h-2.5 w-2.5 rounded-full bg-blue-300" />
                          Jouees: {{ overviewPlayedCount.toLocaleString() }} ({{
                            overviewPlayedPct.toFixed(2)
                          }}%)
                        </div>
                      </div>
                    </div>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.overviewNoData') }}
                    </div>
                  </div>

                  <!-- Bans par équipe gagnante -->
                  <div
                    v-if="overviewTeamsData && overviewTeamsData.matchCount > 0"
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.bansByWin')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.bansByWin')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.bansByWin',
                            t('statisticsPage.overviewTeamsBansByWin')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.bansByWin') ? '★' : '☆' }}
                      </button>
                      <span class="flex-1">{{ t('statisticsPage.overviewTeamsBansByWin') }}</span>
                    </h3>
                    <table
                      v-if="(overviewTeamsData.bans.byWin ?? []).length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(b, idx) in (overviewTeamsData.bans.byWin ?? []).slice(
                            0,
                            bansExpandByWin ? 20 : 5
                          )"
                          :key="'win-' + b.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(b.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(b.championId)!.image.full
                                  )
                                "
                                :alt="championName(b.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(b.championId) || b.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-success transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        ((parseFloat(String(b.banRatePercent).replace(',', '.')) ||
                                          0) /
                                          Math.max(
                                            ...(overviewTeamsData.bans.byWin ?? []).map(
                                              x =>
                                                parseFloat(
                                                  String(x.banRatePercent).replace(',', '.')
                                                ) || 0
                                            ),
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="w-9 shrink-0 text-right font-medium text-text">{{
                                b.banRatePercent
                              }}</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div
                      v-if="(overviewTeamsData.bans.byWin ?? []).length"
                      class="mt-1 text-center"
                    >
                      <button
                        v-if="(overviewTeamsData.bans.byWin ?? []).length > 5"
                        type="button"
                        class="fast-stat-button inline-flex items-center justify-center rounded bg-accent p-1 text-background transition-colors hover:opacity-90"
                        :aria-label="
                          bansExpandByWin
                            ? t('statisticsPage.showLess')
                            : t('statisticsPage.fastStatsSeeMore')
                        "
                        @click="bansExpandByWin = !bansExpandByWin"
                      >
                        <svg
                          class="h-3 w-3 transition-transform"
                          :class="{ 'rotate-180': bansExpandByWin }"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
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

                  <!-- Bans par équipe perdante -->
                  <div
                    v-if="overviewTeamsData && overviewTeamsData.matchCount > 0"
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-1 flex items-center justify-between gap-2 text-sm font-semibold text-text"
                    >
                      <button
                        type="button"
                        class="text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.bansByLoss')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.bansByLoss')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.bansByLoss',
                            t('statisticsPage.overviewTeamsBansByLoss')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.bansByLoss') ? '★' : '☆' }}
                      </button>
                      <span class="flex-1">{{ t('statisticsPage.overviewTeamsBansByLoss') }}</span>
                    </h3>
                    <table
                      v-if="(overviewTeamsData.bans.byLoss ?? []).length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(b, idx) in (overviewTeamsData.bans.byLoss ?? []).slice(
                            0,
                            bansExpandByLoss ? 20 : 5
                          )"
                          :key="'loss-' + b.championId"
                          class="fast-stat-row"
                        >
                          <td class="py-0.5">
                            <div class="flex items-center gap-0.5">
                              <span class="w-4 shrink-0 text-text/70">{{ idx + 1 }}.</span>
                              <img
                                v-if="gameVersion && championByKey(b.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(b.championId)!.image.full
                                  )
                                "
                                :alt="championName(b.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                              />
                              <span
                                class="min-w-[5.5rem] shrink-0 truncate font-medium text-text"
                                >{{ championName(b.championId) || b.championId }}</span
                              >
                              <div
                                class="fast-stat-bar-container h-1.5 min-w-[48px] max-w-[80px] flex-1 overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-error transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        ((parseFloat(String(b.banRatePercent).replace(',', '.')) ||
                                          0) /
                                          Math.max(
                                            ...(overviewTeamsData.bans.byLoss ?? []).map(
                                              x =>
                                                parseFloat(
                                                  String(x.banRatePercent).replace(',', '.')
                                                ) || 0
                                            ),
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="w-9 shrink-0 text-right font-medium text-text">{{
                                b.banRatePercent
                              }}</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div
                      v-if="(overviewTeamsData.bans.byLoss ?? []).length"
                      class="mt-1 text-center"
                    >
                      <button
                        v-if="(overviewTeamsData.bans.byLoss ?? []).length > 5"
                        type="button"
                        class="fast-stat-button inline-flex items-center justify-center rounded bg-accent p-1 text-background transition-colors hover:opacity-90"
                        :aria-label="
                          bansExpandByLoss
                            ? t('statisticsPage.showLess')
                            : t('statisticsPage.fastStatsSeeMore')
                        "
                        @click="bansExpandByLoss = !bansExpandByLoss"
                      >
                        <svg
                          class="h-3 w-3 transition-transform"
                          :class="{ 'rotate-180': bansExpandByLoss }"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
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
                  <div
                    v-if="overviewTeamsData && overviewTeamsData.matchCount > 0"
                    class="fast-stat-card fast-stat-card-objectives rounded-lg border border-primary/30 bg-surface/30 p-6"
                  >
                    <div class="mb-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        class="rounded px-2 py-1 text-xs font-semibold transition-colors"
                        :class="
                          objectivesPanelTab === 'objectives'
                            ? 'bg-accent text-background'
                            : 'bg-black/20 text-text/80 hover:bg-white/10'
                        "
                        @click="objectivesPanelTab = 'objectives'"
                      >
                        {{ t('statisticsPage.objectivesTabMain') }}
                      </button>
                      <button
                        type="button"
                        class="rounded px-2 py-1 text-xs font-semibold transition-colors"
                        :class="
                          objectivesPanelTab === 'drakeTypes'
                            ? 'bg-accent text-background'
                            : 'bg-black/20 text-text/80 hover:bg-white/10'
                        "
                        @click="objectivesPanelTab = 'drakeTypes'"
                      >
                        {{ t('statisticsPage.objectivesTabDrakeTypes') }}
                      </button>
                      <button
                        type="button"
                        class="rounded px-2 py-1 text-xs font-semibold transition-colors"
                        :class="
                          objectivesPanelTab === 'drakeSouls'
                            ? 'bg-accent text-background'
                            : 'bg-black/20 text-text/80 hover:bg-white/10'
                        "
                        @click="objectivesPanelTab = 'drakeSouls'"
                      >
                        {{ t('statisticsPage.objectivesTabSouls') }}
                      </button>
                      <span
                        class="relative inline-flex cursor-help text-text/50"
                        aria-hidden="true"
                      >
                        ⓘ
                        <span
                          role="tooltip"
                          class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden min-w-[14rem] max-w-[26rem] -translate-x-1/2 rounded border border-primary/40 bg-surface/100 px-3 py-2 text-left text-xs font-normal leading-snug text-text shadow-lg group-hover/tooltip:block"
                        >
                          {{ t('statisticsPage.tooltipOverviewObjectives') }}
                        </span>
                      </span>
                    </div>
                    <p class="mb-3 text-xs text-text/60">
                      {{ t('statisticsPage.overviewTeamsFirstByTeam') }}
                    </p>
                    <div v-if="objectivesPanelTab === 'objectives'" class="overflow-x-auto">
                      <table class="w-full min-w-[280px] text-left text-sm">
                        <thead>
                          <tr class="border-b border-primary/30 text-text/70">
                            <th class="py-1.5 pr-2 font-medium">
                              {{ t('statisticsPage.overviewTeamsObjective') }}
                            </th>
                            <th class="py-1.5 pr-2 text-center font-medium">
                              {{ t('statisticsPage.overviewTeamsFirstByWin') }}
                            </th>
                            <th class="py-1.5 text-center font-medium">
                              {{ t('statisticsPage.overviewTeamsFirstByLoss') }}
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-primary/20 text-text/80">
                          <tr>
                            <td class="py-1.5 pr-2">
                              {{ t('statisticsPage.overviewTeamsFirstBlood') }}
                            </td>
                            <td class="py-1.5 pr-2 text-center">
                              {{
                                firstPercentByTeam(
                                  overviewTeamsData.objectives.firstBlood.firstByWin,
                                  overviewTeamsData.objectives.firstBlood.firstByLoss,
                                  overviewTeamsData.matchCount
                                ).win
                              }}
                            </td>
                            <td class="py-1.5 text-center">
                              {{
                                firstPercentByTeam(
                                  overviewTeamsData.objectives.firstBlood.firstByWin,
                                  overviewTeamsData.objectives.firstBlood.firstByLoss,
                                  overviewTeamsData.matchCount
                                ).loss
                              }}
                            </td>
                          </tr>
                          <template v-for="key in objectiveKeysWithKills" :key="key">
                            <tr>
                              <td class="py-1.5 pr-2">
                                <button
                                  type="button"
                                  class="flex items-center gap-1 font-medium text-text/90 hover:text-text"
                                  @click="toggleObjective(key)"
                                >
                                  <span
                                    class="inline-block transition-transform duration-200"
                                    :class="openObjectiveKeys.has(key) ? 'rotate-180' : ''"
                                    aria-hidden
                                    >▼</span
                                  >
                                  <img
                                    v-if="objectiveIconSrc(key)"
                                    :src="objectiveIconSrc(key)"
                                    :alt="t('statisticsPage.overviewTeamsObjective_' + key)"
                                    class="h-4 w-4 object-contain"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                  {{ t('statisticsPage.overviewTeamsObjective_' + key) }}
                                </button>
                              </td>
                              <td class="py-1.5 pr-2 text-center">
                                {{
                                  firstPercentByTeam(
                                    objectiveRow(key).firstByWin,
                                    objectiveRow(key).firstByLoss,
                                    overviewTeamsData.matchCount
                                  ).win
                                }}
                              </td>
                              <td class="py-1.5 text-center">
                                {{
                                  firstPercentByTeam(
                                    objectiveRow(key).firstByWin,
                                    objectiveRow(key).firstByLoss,
                                    overviewTeamsData.matchCount
                                  ).loss
                                }}
                              </td>
                            </tr>
                            <template v-if="openObjectiveKeys.has(key)">
                              <tr
                                v-for="count in objectiveCounts(key)"
                                :key="key + '-' + count"
                                class="bg-surface/30"
                              >
                                <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                                <td class="py-1 pr-2 text-center text-text/80">
                                  {{ percentForCount(key, count, true) }}
                                </td>
                                <td class="py-1 text-center text-text/80">
                                  {{ percentForCount(key, count, false) }}
                                </td>
                              </tr>
                            </template>
                          </template>
                        </tbody>
                      </table>
                    </div>
                    <div v-else-if="objectivesPanelTab === 'drakeTypes'" class="overflow-x-auto">
                      <table class="w-full min-w-[280px] text-left text-sm">
                        <thead>
                          <tr class="border-b border-primary/30 text-text/70">
                            <th class="py-1.5 pr-2 font-medium">
                              {{ t('statisticsPage.overviewTeamsObjective') }}
                            </th>
                            <th class="py-1.5 pr-2 text-center font-medium">
                              {{ t('statisticsPage.overviewTeamsByWin') }}
                            </th>
                            <th class="py-1.5 text-center font-medium">
                              {{ t('statisticsPage.overviewTeamsByLoss') }}
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-primary/20 text-text/80">
                          <tr v-for="row in drakeTypeRows" :key="'drake-type-' + row.key">
                            <td class="py-1.5 pr-2 font-medium text-text/90">
                              <div class="flex items-center gap-2">
                                <img
                                  v-if="drakeIconSrc(row.key)"
                                  :src="drakeIconSrc(row.key)"
                                  :alt="row.label"
                                  class="h-4 w-4 object-contain"
                                  loading="lazy"
                                  decoding="async"
                                />
                                <span>{{ row.label }}</span>
                              </div>
                            </td>
                            <td class="py-1.5 pr-2 text-center">
                              {{ teamPercent(row.byWin, overviewTeamsData.matchCount) }}
                            </td>
                            <td class="py-1.5 text-center">
                              {{ teamPercent(row.byLoss, overviewTeamsData.matchCount) }}
                            </td>
                          </tr>
                          <tr v-if="drakeTypeRows.length === 0">
                            <td colspan="3" class="py-2 text-center text-text/60">
                              {{ t('statisticsPage.noData') }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div v-else class="overflow-x-auto">
                      <table class="w-full min-w-[280px] text-left text-sm">
                        <thead>
                          <tr class="border-b border-primary/30 text-text/70">
                            <th class="py-1.5 pr-2 font-medium">
                              {{ t('statisticsPage.overviewTeamsObjective') }}
                            </th>
                            <th class="py-1.5 pr-2 text-center font-medium">
                              {{ t('statisticsPage.overviewTeamsByWin') }}
                            </th>
                            <th class="py-1.5 text-center font-medium">
                              {{ t('statisticsPage.overviewTeamsByLoss') }}
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-primary/20 text-text/80">
                          <tr>
                            <td class="py-1.5 pr-2 font-medium text-text/90">
                              {{ t('statisticsPage.objectivesSoulGlobal') }}
                            </td>
                            <td class="py-1.5 pr-2 text-center">
                              {{ teamPercent(drakeSoulGlobal.byWin, overviewTeamsData.matchCount) }}
                            </td>
                            <td class="py-1.5 text-center">
                              {{
                                teamPercent(drakeSoulGlobal.byLoss, overviewTeamsData.matchCount)
                              }}
                            </td>
                          </tr>
                          <template v-for="row in drakeSoulRows" :key="'drake-soul-' + row.key">
                            <tr>
                              <td class="py-1.5 pr-2 font-medium text-text/90">
                                <div class="flex items-center gap-2">
                                  <img
                                    v-if="drakeIconSrc(row.key)"
                                    :src="drakeIconSrc(row.key)"
                                    :alt="row.label"
                                    class="h-4 w-4 object-contain"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                  <span>{{ row.label }}</span>
                                </div>
                              </td>
                              <td class="py-1.5 pr-2 text-center">
                                {{ teamPercent(row.byWin, overviewTeamsData.matchCount) }}
                              </td>
                              <td class="py-1.5 text-center">
                                {{ teamPercent(row.byLoss, overviewTeamsData.matchCount) }}
                              </td>
                            </tr>
                          </template>
                          <tr v-if="drakeSoulRows.length === 0">
                            <td colspan="3" class="py-2 text-center text-text/60">
                              {{ t('statisticsPage.noData') }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-text/70">{{ t('statisticsPage.overviewNoData') }}</div>
            </div>
          </div>

          <!-- Tab: Runes, items, sorts (chargé à l'ouverture de l'onglet) -->
          <div v-show="activeTab === 'runes'" class="space-y-6">
            <template v-if="overviewDetailPending">
              <div class="rounded-lg">
                <div class="py-4 text-text/70">{{ t('statisticsPage.loading') }}</div>
              </div>
            </template>
            <template v-else>
              <div
                v-if="overviewDetailError"
                class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
              >
                <p class="text-text/90">{{ t('statisticsPage.overviewDetailTimeout') }}</p>
                <button
                  type="button"
                  class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  @click="loadOverviewDetail(true)"
                >
                  {{ t('statisticsPage.retry') }}
                </button>
              </div>
              <template v-if="overviewDetailPending || overviewDetailData || overviewDetailError">
                <fieldset
                  class="overview-runes-fieldset rounded-lg border border-primary/30 bg-surface/30 p-6"
                >
                  <legend class="mb-3 text-lg font-medium text-text">
                    {{ t('statisticsPage.overviewDetailRunes') }}
                  </legend>
                  <div
                    v-if="overviewDetailPending && !overviewDetailData"
                    class="py-4 text-center text-text/70"
                  >
                    {{ t('statisticsPage.loading') }}
                  </div>
                  <!-- Tree layout when rune paths are loaded -->
                  <div
                    v-else-if="overviewRunesByPath.some(p => p.cells.length > 0)"
                    class="blocks flex flex-wrap gap-6"
                  >
                    <div
                      v-for="{ path, cells } in overviewRunesByPath"
                      :key="path.id"
                      class="runes overview-runes-grid"
                      :style="runePathPanelStyle(path.icon)"
                    >
                      <button
                        v-for="(cell, idx) in cells"
                        :key="path.id + '-' + cell.rune.id + '-' + idx"
                        type="button"
                        class="overview-rune-cell"
                        :class="{ 'rune main': cell.row === 0, rune: cell.row !== 0 }"
                        :style="{ gridArea: `${cell.row + 1} / ${cell.col + 1}` }"
                        :title="
                          cell.rune.name +
                          (cell.stats
                            ? ` — ${Number(cell.stats.pickrate).toFixed(2)}% pick, ${Number(cell.stats.winrate).toFixed(2)}% WR`
                            : '')
                        "
                      >
                        <img
                          v-if="gameVersion"
                          :src="getRuneImageUrl(gameVersion, cell.rune.icon)"
                          :alt="cell.rune.name"
                          class="overview-rune-img"
                          width="32"
                          height="32"
                        />
                        <div v-if="cell.stats" class="overview-rune-stat">
                          <div class="overview-rune-pick">
                            {{ Number(cell.stats.pickrate).toFixed(2) }}%
                            {{ t('statisticsPage.overviewDetailPickRate') }}
                          </div>
                          <div class="overview-rune-wr">
                            {{ Number(cell.stats.winrate).toFixed(2) }}%
                            {{ t('statisticsPage.overviewDetailWinRate') }}
                          </div>
                        </div>
                        <div v-else class="overview-rune-stat overview-rune-no-stat">—</div>
                      </button>
                    </div>
                  </div>
                  <!-- Fallback: flat list when rune paths not yet loaded -->
                  <div
                    v-else-if="(overviewDetailData?.runes ?? []).length"
                    class="blocks runes overview-runes-fallback grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8"
                  >
                    <button
                      v-for="r in overviewDetailData?.runes ?? []"
                      :key="r.runeId"
                      type="button"
                      class="overview-rune-cell flex flex-col items-center gap-1 rounded border border-primary/20 bg-surface/50 p-2 text-center transition-colors hover:bg-primary/20"
                      :title="
                        (getRuneById(r.runeId)?.name ?? r.runeId) +
                        ' — ' +
                        r.pickrate +
                        '% pick, ' +
                        r.winrate +
                        '% WR'
                      "
                    >
                      <img
                        v-if="gameVersion && getRuneById(r.runeId)"
                        :src="getRuneImageUrl(gameVersion, getRuneById(r.runeId)!.icon)"
                        :alt="getRuneById(r.runeId)?.name ?? ''"
                        class="overview-rune-img h-8 w-8 object-contain"
                        width="32"
                        height="32"
                      />
                      <div class="overview-rune-stat">
                        <div class="overview-rune-pick">
                          {{ Number(r.pickrate).toFixed(2) }}%
                          {{ t('statisticsPage.overviewDetailPickRate') }}
                        </div>
                        <div class="overview-rune-wr">
                          {{ Number(r.winrate).toFixed(2) }}%
                          {{ t('statisticsPage.overviewDetailWinRate') }}
                        </div>
                      </div>
                    </button>
                  </div>
                  <!-- Sorts d'invocateur : même section, horizontal -->
                  <div class="mt-6 border-t border-primary/30 pt-4">
                    <h3 class="mb-3 text-base font-medium text-text">
                      {{ t('statisticsPage.overviewDetailSummonerSpells') }}
                    </h3>
                    <div class="flex flex-wrap items-center gap-3">
                      <div
                        v-for="s in overviewDetailData?.summonerSpells ?? []"
                        :key="s.spellId"
                        class="flex items-center gap-2 rounded border border-primary/20 bg-surface/50 px-3 py-2"
                      >
                        <img
                          v-if="gameVersion && spellImageName(s.spellId)"
                          :src="getSpellImageUrl(gameVersion, spellImageName(s.spellId)!)"
                          :alt="spellName(s.spellId) ?? ''"
                          class="h-6 w-6 object-contain"
                          width="24"
                          height="24"
                        />
                        <span class="text-sm font-medium text-text/90">{{
                          spellName(s.spellId) ?? s.spellId
                        }}</span>
                        <span class="text-xs text-text/70"
                          >{{ Number(s.pickrate).toFixed(2) }}% pick —
                          {{ Number(s.winrate).toFixed(2) }}% WR</span
                        >
                      </div>
                    </div>
                  </div>
                </fieldset>

                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <!-- Rune sets -->
                  <div class="rounded-lg">
                    <h3 class="mb-3 text-lg font-medium text-text">
                      {{ t('statisticsPage.overviewDetailRuneSets') }}
                    </h3>
                    <div class="flex flex-wrap gap-3">
                      <div
                        v-for="(set, idx) in (overviewDetailData?.runeSets ?? []).slice(
                          0,
                          detailExpand.runeSets ? 20 : 5
                        )"
                        :key="idx"
                        class="rune-set"
                      >
                        <div class="rune-set-stat" :data-pct="set.pickrate + '%'">
                          <div class="rune-set-pr" :style="{ '--n': set.pickrate }" />
                          <div class="rune-set-wr" :style="{ '--n': set.winrate }">
                            {{ Number(set.winrate).toFixed(2) }}%
                          </div>
                        </div>
                        <div class="rune-set-runes">
                          <div
                            v-for="runeId in runeIdsFromSet(set.runes)"
                            :key="runeId"
                            class="rune-set-tooltip"
                            :title="getRuneById(runeId)?.name ?? ''"
                          >
                            <div class="rune-set-rune">
                              <div
                                v-if="gameVersion && getRuneById(runeId)"
                                class="rune-set-img"
                                :style="{
                                  '--img': `url(${getRuneImageUrl(gameVersion, getRuneById(runeId)!.icon)})`,
                                }"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      v-if="(overviewDetailData?.runeSets ?? []).length > 5"
                      type="button"
                      class="mt-2 text-sm font-medium text-accent hover:underline"
                      @click="detailExpand.runeSets = !detailExpand.runeSets"
                    >
                      {{
                        detailExpand.runeSets
                          ? t('statisticsPage.showLess')
                          : t('statisticsPage.fastStatsSeeMore')
                      }}
                    </button>
                  </div>

                  <!-- Items -->
                  <div class="rounded-lg">
                    <h3 class="mb-3 text-lg font-medium text-text">
                      {{ t('statisticsPage.overviewDetailItems') }}
                    </h3>
                    <div class="flex flex-wrap gap-2">
                      <div
                        v-for="it in (overviewDetailData?.items ?? []).slice(
                          0,
                          detailExpand.items ? 40 : 5
                        )"
                        :key="it.itemId"
                        class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                      >
                        <img
                          v-if="gameVersion && itemImageName(it.itemId)"
                          :src="getItemImageUrl(gameVersion, itemImageName(it.itemId)!)"
                          :alt="itemName(it.itemId) ?? ''"
                          class="h-5 w-5 object-contain"
                          width="20"
                          height="20"
                        />
                        <span class="max-w-[80px] truncate text-xs text-text/90">{{
                          itemName(it.itemId) ?? it.itemId
                        }}</span>
                        <span class="text-xs text-text/70"
                          >{{ it.pickrate }}% — {{ it.winrate }}%</span
                        >
                      </div>
                    </div>
                    <button
                      v-if="(overviewDetailData?.items ?? []).length > 5"
                      type="button"
                      class="mt-2 text-sm font-medium text-accent hover:underline"
                      @click="detailExpand.items = !detailExpand.items"
                    >
                      {{
                        detailExpand.items
                          ? t('statisticsPage.showLess')
                          : t('statisticsPage.fastStatsSeeMore')
                      }}
                    </button>
                  </div>

                  <!-- Item sets -->
                  <div class="rounded-lg">
                    <h3 class="mb-3 text-lg font-medium text-text">
                      {{ t('statisticsPage.overviewDetailItemSets') }}
                    </h3>
                    <div class="flex flex-wrap gap-2">
                      <div
                        v-for="(set, idx) in (overviewDetailData?.itemSets ?? []).slice(
                          0,
                          detailExpand.itemSets ? 20 : 5
                        )"
                        :key="idx"
                        class="flex flex-wrap items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1.5"
                      >
                        <template v-for="itemId in set.items" :key="itemId">
                          <img
                            v-if="gameVersion && itemImageName(itemId)"
                            :src="getItemImageUrl(gameVersion, itemImageName(itemId)!)"
                            :alt="itemName(itemId) ?? ''"
                            class="h-5 w-5 object-contain"
                            width="20"
                            height="20"
                          />
                        </template>
                        <span class="text-xs text-text/70"
                          >{{ Number(set.pickrate).toFixed(2) }}% —
                          {{ Number(set.winrate).toFixed(2) }}%</span
                        >
                      </div>
                    </div>
                    <button
                      v-if="(overviewDetailData?.itemSets ?? []).length > 5"
                      type="button"
                      class="mt-2 text-sm font-medium text-accent hover:underline"
                      @click="detailExpand.itemSets = !detailExpand.itemSets"
                    >
                      {{
                        detailExpand.itemSets
                          ? t('statisticsPage.showLess')
                          : t('statisticsPage.fastStatsSeeMore')
                      }}
                    </button>
                  </div>

                  <!-- Items by order -->
                  <div class="rounded-lg">
                    <h3 class="mb-3 text-lg font-medium text-text">
                      {{ t('statisticsPage.overviewDetailItemsByOrder') }}
                    </h3>
                    <div class="space-y-2">
                      <div
                        v-for="slotIdx in [0, 1, 2, 3, 4, 5]"
                        :key="slotIdx"
                        class="rounded border border-primary/20 bg-surface/30 p-2"
                      >
                        <div class="mb-1 text-xs font-medium text-text/70">
                          Slot {{ slotIdx + 1 }}
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                          <div
                            v-for="row in sortedItemsBySlot(slotIdx).slice(
                              0,
                              detailExpand.itemsByOrder ? 10 : 5
                            )"
                            :key="row.itemId"
                            class="flex items-center gap-1 rounded px-1 py-0.5"
                            :title="
                              (itemName(row.itemId) ?? row.itemId) +
                              ' — ' +
                              Number(row.winrate).toFixed(2) +
                              '%'
                            "
                          >
                            <img
                              v-if="gameVersion && itemImageName(row.itemId)"
                              :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                              :alt="itemName(row.itemId) ?? ''"
                              class="h-4 w-4 object-contain"
                              width="16"
                              height="16"
                            />
                            <span class="text-xs text-text/80"
                              >{{ Number(row.winrate).toFixed(2) }}%</span
                            >
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="mt-2 text-sm font-medium text-accent hover:underline"
                      @click="detailExpand.itemsByOrder = !detailExpand.itemsByOrder"
                    >
                      {{
                        detailExpand.itemsByOrder
                          ? t('statisticsPage.showLess')
                          : t('statisticsPage.fastStatsSeeMore')
                      }}
                    </button>
                  </div>
                </div>
              </template>
              <div v-else class="rounded-lg border border-primary/30 bg-surface/30 p-6">
                <div class="py-4 text-text/70">{{ t('statisticsPage.overviewDetailNoData') }}</div>
              </div>
            </template>
          </div>

          <!-- Tab: Progressions (depuis la version la plus ancienne, type LeagueOfGraphs) -->
          <div v-show="activeTab === 'trends'" class="space-y-6">
            <div class="rounded-lg">
              <h2 class="mb-4 text-xl font-semibold text-text-accent">
                {{ t('statisticsPage.progressionsTitle') }}
              </h2>
              <p class="mb-4 text-text/80">
                {{
                  t('statisticsPage.progressionsDescription', {
                    version: progressionFullData?.oldestVersion ?? '—',
                  })
                }}
              </p>
              <div v-if="progressionFullPending" class="text-text/70">
                {{ t('statisticsPage.loading') }}
              </div>
              <div v-else-if="!progressionFullData?.oldestVersion" class="text-text/70">
                {{ t('statisticsPage.progressionsNoVersion') }}
              </div>
              <div v-else-if="progressionFullData" class="space-y-8">
                <!-- Progression du winrate -->
                <div class="rounded-lg border border-primary/30 bg-surface/50 p-4">
                  <h3 class="mb-3 text-lg font-medium text-text">
                    {{ t('statisticsPage.progressionsWinrateTable') }}
                  </h3>
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b border-primary/30 text-left text-text/80">
                          <th class="pb-2 pr-2">{{ t('statisticsPage.champion') }}</th>
                          <th class="pb-2 pr-2 text-right">
                            {{ t('statisticsPage.progressionsWinrateCol') }}
                          </th>
                          <th class="pb-2 pl-2 text-right">
                            {{ t('statisticsPage.progressionsDelta') }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="row in paginatedProgressionsChampions"
                          :key="'wr-' + row.championId"
                          class="border-b border-primary/20"
                        >
                          <td class="py-1.5 pr-2">
                            <NuxtLink
                              :to="localePath('/statistics/champion/' + row.championId)"
                              class="flex items-center gap-2 hover:text-accent"
                            >
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) ?? ''"
                                class="h-6 w-6 shrink-0 rounded-full object-cover"
                                width="24"
                                height="24"
                              />
                              <span>{{ championName(row.championId) || row.championId }}</span>
                            </NuxtLink>
                          </td>
                          <td class="py-1.5 text-right">{{ Number(row.wrSince).toFixed(2) }}%</td>
                          <td
                            class="py-1.5 pl-2 text-right"
                            :class="row.deltaWr >= 0 ? 'text-success' : 'text-error'"
                          >
                            {{ row.deltaWr >= 0 ? '+' : '' }}{{ row.deltaWr.toFixed(2) }}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <!-- Progression de la popularité -->
                <div class="rounded-lg border border-primary/30 bg-surface/50 p-4">
                  <h3 class="mb-3 text-lg font-medium text-text">
                    {{ t('statisticsPage.progressionsPopularityTable') }}
                  </h3>
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b border-primary/30 text-left text-text/80">
                          <th class="pb-2 pr-2">{{ t('statisticsPage.champion') }}</th>
                          <th class="pb-2 pr-2 text-right">
                            {{ t('statisticsPage.progressionsPopularity') }}
                          </th>
                          <th class="pb-2 pl-2 text-right">
                            {{ t('statisticsPage.progressionsDelta') }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="row in paginatedProgressionsByPickrate"
                          :key="'pick-' + row.championId"
                          class="border-b border-primary/20"
                        >
                          <td class="py-1.5 pr-2">
                            <NuxtLink
                              :to="localePath('/statistics/champion/' + row.championId)"
                              class="flex items-center gap-2 hover:text-accent"
                            >
                              <img
                                v-if="gameVersion && championByKey(row.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(row.championId)!.image.full
                                  )
                                "
                                :alt="championName(row.championId) ?? ''"
                                class="h-6 w-6 shrink-0 rounded-full object-cover"
                                width="24"
                                height="24"
                              />
                              <span>{{ championName(row.championId) || row.championId }}</span>
                            </NuxtLink>
                          </td>
                          <td class="py-1.5 text-right">
                            {{ Number(row.pickrateSince).toFixed(2) }}%
                          </td>
                          <td
                            class="py-1.5 pl-2 text-right"
                            :class="row.deltaPick >= 0 ? 'text-success' : 'text-error'"
                          >
                            {{ row.deltaPick >= 0 ? '+' : '' }}{{ row.deltaPick.toFixed(2) }}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div
                  v-if="totalProgressionsCount > 0"
                  class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
                >
                  <span>{{ totalProgressionsCount }} {{ t('statisticsPage.champion') }}</span>
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-1.5">
                      <span class="text-text/70">{{ t('statisticsPage.perPage') }}</span>
                      <select
                        v-model.number="progressionsPageSize"
                        class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                      >
                        <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
                      </select>
                    </label>
                    <span class="text-text/70">
                      {{ (progressionsPage - 1) * progressionsPageSize + 1 }}-{{
                        Math.min(progressionsPage * progressionsPageSize, totalProgressionsCount)
                      }}
                      / {{ totalProgressionsCount }}
                    </span>
                    <div class="flex gap-1">
                      <button
                        type="button"
                        class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                        :disabled="progressionsPage <= 1"
                        @click="progressionsPage = Math.max(1, progressionsPage - 1)"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                        :disabled="progressionsPage >= totalProgressionsPages"
                        @click="
                          progressionsPage = Math.min(totalProgressionsPages, progressionsPage + 1)
                        "
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab: Par côté (Blue / Red) -->
          <div v-show="activeTab === 'team'" class="space-y-6">
            <div class="rounded-lg">
              <h2 class="mb-4 text-xl font-semibold text-text-accent">
                {{ t('statisticsPage.sidesTitle') }}
              </h2>
              <p class="mb-4 text-text/80">
                {{ t('statisticsPage.sidesDescription') }}
              </p>
              <div v-if="overviewSidesPending" class="text-text/70">
                {{ t('statisticsPage.loading') }}
              </div>
              <div v-else-if="overviewSidesData" class="space-y-6">
                <!-- Donut Blue / Red % victoire (cercle entier, Solo/duo) -->
                <div
                  class="flex flex-col items-center rounded-lg border border-primary/30 bg-surface/30 p-6"
                >
                  <div
                    class="pie-chart-2 relative inline-flex h-[150px] w-[150px] items-center justify-center"
                    style="padding: 0"
                  >
                    <svg class="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                      <!-- Fond du donut (cercle entier) -->
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="14"
                        stroke-linecap="butt"
                        class="text-surface/50 dark:text-surface/40"
                        :stroke-dasharray="sidesDonutCircumference + ' ' + sidesDonutCircumference"
                        stroke-dashoffset="0"
                      />
                      <!-- Part bleue -->
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="14"
                        stroke-linecap="butt"
                        class="text-blue-500 dark:text-blue-400"
                        :stroke-dasharray="sidesDonutBlueDash + ' ' + sidesDonutCircumference"
                        stroke-dashoffset="0"
                      />
                      <!-- Part rouge -->
                      <circle
                        cx="60"
                        cy="60"
                        r="48"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="14"
                        stroke-linecap="butt"
                        class="text-red-500 dark:text-red-400"
                        :stroke-dasharray="sidesDonutRedDash + ' ' + sidesDonutCircumference"
                        :stroke-dashoffset="-sidesDonutBlueDash"
                      />
                    </svg>
                    <div class="relative z-10 flex flex-col items-center text-center">
                      <span class="block text-xl font-bold text-blue-600 dark:text-blue-400">
                        {{ sidesDonutBluePct }}%
                      </span>
                      <span class="block text-lg font-medium text-red-600 dark:text-red-400">
                        {{ sidesDonutRedPct }}%
                      </span>
                    </div>
                  </div>
                  <p class="mt-3 text-sm text-text/70">
                    {{ t('statisticsPage.sidesDonutTitleSoloDuo') }}
                  </p>
                </div>
                <!-- Champions les plus joués par côté -->
                <div>
                  <h3 class="mb-3 text-lg font-medium text-text">
                    {{ t('statisticsPage.sidesMostPlayedBySide') }}
                  </h3>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div class="rounded-lg border border-blue-500/30 bg-surface/30 p-4">
                      <h4 class="mb-2 font-medium text-blue-600 dark:text-blue-400">
                        {{ t('statisticsPage.sidesBlue') }}
                      </h4>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="c in (overviewSidesData.championPickBySide?.blue ?? []).slice(
                            0,
                            sidesExpandPickBlue ? 20 : 5
                          )"
                          :key="'pick-blue-' + c.championId"
                          class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                          :title="
                            (championName(c.championId) ?? c.championId) +
                            ' — ' +
                            c.games +
                            ' parties'
                          "
                        >
                          <img
                            v-if="gameVersion && championByKey(c.championId)"
                            :src="
                              getChampionImageUrl(
                                gameVersion,
                                championByKey(c.championId)!.image.full
                              )
                            "
                            :alt="championName(c.championId) ?? ''"
                            class="h-6 w-6 rounded-full object-cover"
                            width="24"
                            height="24"
                          />
                          <span class="text-xs text-text/80"
                            >{{ c.games }} ({{ Number(c.winrate).toFixed(2) }}%)</span
                          >
                        </div>
                      </div>
                      <button
                        v-if="(overviewSidesData.championPickBySide?.blue ?? []).length > 5"
                        type="button"
                        class="mt-2 text-sm font-medium text-accent hover:underline"
                        @click="sidesExpandPickBlue = !sidesExpandPickBlue"
                      >
                        {{
                          sidesExpandPickBlue
                            ? t('statisticsPage.showLess')
                            : t('statisticsPage.fastStatsSeeMore')
                        }}
                      </button>
                    </div>
                    <div class="rounded-lg border border-red-500/30 bg-surface/30 p-4">
                      <h4 class="mb-2 font-medium text-red-600 dark:text-red-400">
                        {{ t('statisticsPage.sidesRed') }}
                      </h4>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="c in (overviewSidesData.championPickBySide?.red ?? []).slice(
                            0,
                            sidesExpandPickRed ? 20 : 5
                          )"
                          :key="'pick-red-' + c.championId"
                          class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                          :title="
                            (championName(c.championId) ?? c.championId) +
                            ' — ' +
                            c.games +
                            ' parties'
                          "
                        >
                          <img
                            v-if="gameVersion && championByKey(c.championId)"
                            :src="
                              getChampionImageUrl(
                                gameVersion,
                                championByKey(c.championId)!.image.full
                              )
                            "
                            :alt="championName(c.championId) ?? ''"
                            class="h-6 w-6 rounded-full object-cover"
                            width="24"
                            height="24"
                          />
                          <span class="text-xs text-text/80"
                            >{{ c.games }} ({{ Number(c.winrate).toFixed(2) }}%)</span
                          >
                        </div>
                      </div>
                      <button
                        v-if="(overviewSidesData.championPickBySide?.red ?? []).length > 5"
                        type="button"
                        class="mt-2 text-sm font-medium text-accent hover:underline"
                        @click="sidesExpandPickRed = !sidesExpandPickRed"
                      >
                        {{
                          sidesExpandPickRed
                            ? t('statisticsPage.showLess')
                            : t('statisticsPage.fastStatsSeeMore')
                        }}
                      </button>
                    </div>
                  </div>
                </div>
                <!-- Champions par côté (top winrate, min 10 games) -->
                <div>
                  <h3 class="mb-3 text-lg font-medium text-text">
                    {{ t('statisticsPage.sidesChampionsBySide') }}
                  </h3>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div class="rounded-lg border border-blue-500/30 bg-surface/30 p-4">
                      <h4 class="mb-2 font-medium text-blue-600 dark:text-blue-400">
                        {{ t('statisticsPage.sidesBlue') }}
                      </h4>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="c in overviewSidesChampionWinrateBySide.blue.slice(
                            0,
                            sidesExpandBlue ? 20 : 5
                          )"
                          :key="'blue-' + c.championId"
                          class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                          :title="
                            (championName(c.championId) ?? c.championId) +
                            ' — ' +
                            Number(c.winrate).toFixed(2) +
                            '%'
                          "
                        >
                          <img
                            v-if="gameVersion && championByKey(c.championId)"
                            :src="
                              getChampionImageUrl(
                                gameVersion,
                                championByKey(c.championId)!.image.full
                              )
                            "
                            :alt="championName(c.championId) ?? ''"
                            class="h-6 w-6 rounded-full object-cover"
                            width="24"
                            height="24"
                          />
                          <span class="text-xs text-text/80"
                            >{{ Number(c.winrate).toFixed(2) }}% ({{ c.games }})</span
                          >
                        </div>
                      </div>
                      <button
                        v-if="overviewSidesChampionWinrateBySide.blue.length > 5"
                        type="button"
                        class="mt-2 text-sm font-medium text-accent hover:underline"
                        @click="sidesExpandBlue = !sidesExpandBlue"
                      >
                        {{
                          sidesExpandBlue
                            ? t('statisticsPage.showLess')
                            : t('statisticsPage.fastStatsSeeMore')
                        }}
                      </button>
                    </div>
                    <div class="rounded-lg border border-red-500/30 bg-surface/30 p-4">
                      <h4 class="mb-2 font-medium text-red-600 dark:text-red-400">
                        {{ t('statisticsPage.sidesRed') }}
                      </h4>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="c in overviewSidesChampionWinrateBySide.red.slice(
                            0,
                            sidesExpandRed ? 20 : 5
                          )"
                          :key="'red-' + c.championId"
                          class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                          :title="
                            (championName(c.championId) ?? c.championId) +
                            ' — ' +
                            Number(c.winrate).toFixed(2) +
                            '%'
                          "
                        >
                          <img
                            v-if="gameVersion && championByKey(c.championId)"
                            :src="
                              getChampionImageUrl(
                                gameVersion,
                                championByKey(c.championId)!.image.full
                              )
                            "
                            :alt="championName(c.championId) ?? ''"
                            class="h-6 w-6 rounded-full object-cover"
                            width="24"
                            height="24"
                          />
                          <span class="text-xs text-text/80"
                            >{{ Number(c.winrate).toFixed(2) }}% ({{ c.games }})</span
                          >
                        </div>
                      </div>
                      <button
                        v-if="overviewSidesChampionWinrateBySide.red.length > 5"
                        type="button"
                        class="mt-2 text-sm font-medium text-accent hover:underline"
                        @click="sidesExpandRed = !sidesExpandRed"
                      >
                        {{
                          sidesExpandRed
                            ? t('statisticsPage.showLess')
                            : t('statisticsPage.fastStatsSeeMore')
                        }}
                      </button>
                    </div>
                  </div>
                </div>
                <!-- Objectifs par côté (table comme vue d'ensemble, colonnes Bleu / Rouge) -->
                <div>
                  <h3 class="mb-3 text-lg font-medium text-text">
                    {{ t('statisticsPage.sidesObjectivesBySide') }}
                  </h3>
                  <p class="mb-3 text-xs text-text/60">
                    {{ t('statisticsPage.overviewTeamsFirstByTeam') }}
                  </p>
                  <div class="overflow-x-auto">
                    <table class="w-full min-w-[280px] text-left text-sm">
                      <thead>
                        <tr class="border-b border-primary/30 text-text/70">
                          <th class="py-1.5 pr-2 font-medium">
                            {{ t('statisticsPage.overviewTeamsObjective') }}
                          </th>
                          <th
                            class="py-1.5 pr-2 text-center font-medium text-blue-600 dark:text-blue-400"
                          >
                            {{ t('statisticsPage.sidesBlue') }}
                          </th>
                          <th class="py-1.5 text-center font-medium text-red-600 dark:text-red-400">
                            {{ t('statisticsPage.sidesRed') }}
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-primary/20 text-text/80">
                        <tr>
                          <td class="py-1.5 pr-2">
                            {{ t('statisticsPage.overviewTeamsFirstBlood') }}
                          </td>
                          <td class="py-1.5 pr-2 text-center">
                            {{
                              firstPercentBySide(
                                overviewSidesData.objectivesBySideTable?.firstBlood?.firstByBlue ??
                                  0,
                                overviewSidesData.objectivesBySideTable?.firstBlood?.firstByRed ??
                                  0,
                                overviewSidesData.matchCount
                              ).blue
                            }}
                          </td>
                          <td class="py-1.5 text-center">
                            {{
                              firstPercentBySide(
                                overviewSidesData.objectivesBySideTable?.firstBlood?.firstByBlue ??
                                  0,
                                overviewSidesData.objectivesBySideTable?.firstBlood?.firstByRed ??
                                  0,
                                overviewSidesData.matchCount
                              ).red
                            }}
                          </td>
                        </tr>
                        <template v-for="key in sidesObjectiveKeysWithKills" :key="key">
                          <tr>
                            <td class="py-1.5 pr-2">
                              <button
                                type="button"
                                class="flex items-center gap-1 font-medium text-text/90 hover:text-text"
                                @click="toggleSidesObjective(key)"
                              >
                                <span
                                  class="inline-block transition-transform duration-200"
                                  :class="openSidesObjectiveKeys.has(key) ? 'rotate-180' : ''"
                                  aria-hidden
                                  >▼</span
                                >
                                <img
                                  v-if="objectiveIconSrc(key)"
                                  :src="objectiveIconSrc(key)"
                                  :alt="t('statisticsPage.overviewTeamsObjective_' + key)"
                                  class="h-4 w-4 object-contain"
                                  loading="lazy"
                                  decoding="async"
                                />
                                {{ t('statisticsPage.overviewTeamsObjective_' + key) }}
                              </button>
                            </td>
                            <td class="py-1.5 pr-2 text-center">
                              {{
                                firstPercentBySide(
                                  objectiveRowSides(key).firstByBlue,
                                  objectiveRowSides(key).firstByRed,
                                  overviewSidesData.matchCount
                                ).blue
                              }}
                            </td>
                            <td class="py-1.5 text-center">
                              {{
                                firstPercentBySide(
                                  objectiveRowSides(key).firstByBlue,
                                  objectiveRowSides(key).firstByRed,
                                  overviewSidesData.matchCount
                                ).red
                              }}
                            </td>
                          </tr>
                          <template v-if="openSidesObjectiveKeys.has(key)">
                            <tr
                              v-for="count in sidesObjectiveCounts(key)"
                              :key="key + '-' + count"
                              class="bg-surface/30"
                            >
                              <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                              <td class="py-1 pr-2 text-center text-text/80">
                                {{ percentForCountSides(key, count, true) }}
                              </td>
                              <td class="py-1 text-center text-text/80">
                                {{ percentForCountSides(key, count, false) }}
                              </td>
                            </tr>
                          </template>
                        </template>
                      </tbody>
                    </table>
                  </div>
                </div>
                <!-- Bans par côté -->
                <div>
                  <h3 class="mb-3 text-lg font-medium text-text">
                    {{ t('statisticsPage.sidesBansBySide') }}
                  </h3>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div class="rounded-lg border border-blue-500/30 bg-surface/30 p-4">
                      <h4 class="mb-2 font-medium text-blue-600 dark:text-blue-400">
                        {{ t('statisticsPage.sidesBlue') }}
                      </h4>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="b in overviewSidesBansBySide.blue.slice(
                            0,
                            sidesExpandBansBlue ? 20 : 5
                          )"
                          :key="'ban-blue-' + b.championId"
                          class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                        >
                          <img
                            v-if="gameVersion && championByKey(b.championId)"
                            :src="
                              getChampionImageUrl(
                                gameVersion,
                                championByKey(b.championId)!.image.full
                              )
                            "
                            :alt="championName(b.championId) ?? ''"
                            class="h-6 w-6 rounded-full object-cover"
                            width="24"
                            height="24"
                          />
                          <span class="text-xs text-text/80">{{ b.count }}</span>
                        </div>
                      </div>
                      <button
                        v-if="overviewSidesBansBySide.blue.length > 5"
                        type="button"
                        class="mt-2 text-sm font-medium text-accent hover:underline"
                        @click="sidesExpandBansBlue = !sidesExpandBansBlue"
                      >
                        {{
                          sidesExpandBansBlue
                            ? t('statisticsPage.showLess')
                            : t('statisticsPage.fastStatsSeeMore')
                        }}
                      </button>
                    </div>
                    <div class="rounded-lg border border-red-500/30 bg-surface/30 p-4">
                      <h4 class="mb-2 font-medium text-red-600 dark:text-red-400">
                        {{ t('statisticsPage.sidesRed') }}
                      </h4>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="b in overviewSidesBansBySide.red.slice(
                            0,
                            sidesExpandBansRed ? 20 : 5
                          )"
                          :key="'ban-red-' + b.championId"
                          class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                        >
                          <img
                            v-if="gameVersion && championByKey(b.championId)"
                            :src="
                              getChampionImageUrl(
                                gameVersion,
                                championByKey(b.championId)!.image.full
                              )
                            "
                            :alt="championName(b.championId) ?? ''"
                            class="h-6 w-6 rounded-full object-cover"
                            width="24"
                            height="24"
                          />
                          <span class="text-xs text-text/80">{{ b.count }}</span>
                        </div>
                      </div>
                      <button
                        v-if="overviewSidesBansBySide.red.length > 5"
                        type="button"
                        class="mt-2 text-sm font-medium text-accent hover:underline"
                        @click="sidesExpandBansRed = !sidesExpandBansRed"
                      >
                        {{
                          sidesExpandBansRed
                            ? t('statisticsPage.showLess')
                            : t('statisticsPage.fastStatsSeeMore')
                        }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="rounded border border-primary/30 bg-surface/50 p-4 text-text/70">
                {{ t('statisticsPage.overviewNoData') }}
              </div>
            </div>
          </div>

          <!-- Tab: Champions -->
          <div v-show="activeTab === 'infos'" class="space-y-2">
            <div v-if="championsPending" class="text-text/70">
              {{ t('statisticsPage.loading') }}
            </div>
            <div
              v-else-if="championsError"
              class="rounded border border-error bg-surface p-3 text-error"
            >
              {{ championsError }}
            </div>
            <div
              v-else-if="championsData?.message && !championsData?.champions?.length"
              class="text-text/70"
            >
              {{ championsData.message }}
            </div>
            <div v-else class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30">
              <table class="w-full min-w-[400px] text-left text-sm">
                <thead class="border-b border-primary/30 bg-surface/50">
                  <tr>
                    <th class="px-4 py-1.5 font-semibold text-text">
                      {{ t('statisticsPage.champion') }}
                    </th>
                    <th
                      class="cursor-pointer select-none px-4 py-1.5 font-semibold text-text transition-[box-shadow]"
                      :class="
                        championsSortOrder === 'games'
                          ? 'rounded ring-2 ring-amber-400/90 ring-offset-2 ring-offset-surface/50'
                          : 'hover:bg-surface/50'
                      "
                      @click="setChampionsSort('games')"
                    >
                      <span class="inline-flex items-center gap-1">
                        {{ t('statisticsPage.games') }}
                        <template v-if="championsSortOrder === 'games'">
                          <span class="text-amber-500" aria-hidden="true">{{
                            championsSortDir === 'desc' ? '↓' : '↑'
                          }}</span>
                        </template>
                      </span>
                    </th>
                    <th
                      class="cursor-pointer select-none px-4 py-1.5 font-semibold text-text transition-[box-shadow]"
                      :class="
                        championsSortOrder === 'wins'
                          ? 'rounded ring-2 ring-amber-400/90 ring-offset-2 ring-offset-surface/50'
                          : 'hover:bg-surface/50'
                      "
                      @click="setChampionsSort('wins')"
                    >
                      <span class="inline-flex items-center gap-1">
                        {{ t('statisticsPage.wins') }}
                        <template v-if="championsSortOrder === 'wins'">
                          <span class="text-amber-500" aria-hidden="true">{{
                            championsSortDir === 'desc' ? '↓' : '↑'
                          }}</span>
                        </template>
                      </span>
                    </th>
                    <th
                      class="cursor-pointer select-none px-4 py-1.5 font-semibold text-text transition-[box-shadow]"
                      :class="
                        championsSortOrder === 'winrate'
                          ? 'rounded ring-2 ring-amber-400/90 ring-offset-2 ring-offset-surface/50'
                          : 'hover:bg-surface/50'
                      "
                      @click="setChampionsSort('winrate')"
                    >
                      <span class="inline-flex items-center gap-1">
                        {{ t('statisticsPage.winrate') }}
                        <template v-if="championsSortOrder === 'winrate'">
                          <span class="text-amber-500" aria-hidden="true">{{
                            championsSortDir === 'desc' ? '↓' : '↑'
                          }}</span>
                        </template>
                      </span>
                    </th>
                    <th
                      class="cursor-pointer select-none px-4 py-1.5 font-semibold text-text transition-[box-shadow]"
                      :class="
                        championsSortOrder === 'pickrate'
                          ? 'rounded ring-2 ring-amber-400/90 ring-offset-2 ring-offset-surface/50'
                          : 'hover:bg-surface/50'
                      "
                      @click="setChampionsSort('pickrate')"
                    >
                      <span class="inline-flex items-center gap-1">
                        {{ t('statisticsPage.pickrate') }}
                        <template v-if="championsSortOrder === 'pickrate'">
                          <span class="text-amber-500" aria-hidden="true">{{
                            championsSortDir === 'desc' ? '↓' : '↑'
                          }}</span>
                        </template>
                      </span>
                    </th>
                    <th
                      class="cursor-pointer select-none px-4 py-1.5 font-semibold text-text transition-[box-shadow]"
                      :class="
                        championsSortOrder === 'banrate'
                          ? 'rounded ring-2 ring-amber-400/90 ring-offset-2 ring-offset-surface/50'
                          : 'hover:bg-surface/50'
                      "
                      @click="setChampionsSort('banrate')"
                    >
                      <span class="inline-flex items-center gap-1">
                        {{ t('statisticsPage.banrate') }}
                        <template v-if="championsSortOrder === 'banrate'">
                          <span class="text-amber-500" aria-hidden="true">{{
                            championsSortDir === 'desc' ? '↓' : '↑'
                          }}</span>
                        </template>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-primary/20">
                  <tr
                    v-for="row in paginatedChampions"
                    :key="row.championId"
                    class="cursor-pointer hover:bg-surface/50"
                    @click="navigateTo(localePath('/statistics/champion/' + row.championId))"
                  >
                    <td class="px-4 py-1 font-medium text-text">
                      <div class="flex items-center gap-2">
                        <img
                          v-if="gameVersion && championByKey(row.championId)"
                          :src="
                            getChampionImageUrl(
                              gameVersion,
                              championByKey(row.championId)!.image.full
                            )
                          "
                          :alt="championName(row.championId) || ''"
                          class="h-5 w-5 rounded-full object-cover"
                        />
                        <span class="text-accent underline-offset-2 hover:underline">{{
                          championName(row.championId) || row.championId
                        }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-1 text-text/90">{{ row.games }}</td>
                    <td class="px-4 py-1 text-text/90">{{ row.wins }}</td>
                    <td class="px-4 py-1 text-text/90">{{ Number(row.winrate).toFixed(2) }}%</td>
                    <td class="px-4 py-1 text-text/90">{{ Number(row.pickrate).toFixed(2) }}%</td>
                    <td class="px-4 py-1 text-text/90">
                      {{ row.banrate != null ? Number(row.banrate).toFixed(2) + '%' : '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div
                v-if="totalChampionsCount > 0"
                class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-1 text-sm text-text/80"
              >
                <span>
                  {{ t('statisticsPage.totalGames') }}:
                  {{ championsData?.totalMatches ?? championsData?.totalGames ?? 0 }}
                  <span v-if="championSearchQuery">
                    ({{ t('statisticsPage.showing') }} {{ totalChampionsCount }})</span
                  >
                </span>
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-1.5">
                    <span class="text-text/70">{{ t('statisticsPage.perPage') }}</span>
                    <select
                      v-model.number="championsPageSize"
                      class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                    >
                      <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
                    </select>
                  </label>
                  <span class="text-text/70">
                    {{ (championsPage - 1) * championsPageSize + 1 }}-{{
                      Math.min(championsPage * championsPageSize, totalChampionsCount)
                    }}
                    / {{ totalChampionsCount }}
                  </span>
                  <div class="flex gap-1">
                    <button
                      type="button"
                      class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                      :disabled="championsPage <= 1"
                      @click="championsPage = Math.max(1, championsPage - 1)"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                      :disabled="championsPage >= totalChampionsPages"
                      @click="championsPage = Math.min(totalChampionsPages, championsPage + 1)"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab: Tier list -->
          <div v-show="activeTab === 'tierlist'" class="space-y-4">
            <div class="flex flex-wrap items-center gap-4">
              <h2 class="text-xl font-semibold text-text-accent">
                {{ t('statisticsPage.tierListTitle') }}
              </h2>
              <div class="flex gap-2">
                <button
                  type="button"
                  :class="[
                    'rounded px-3 py-1.5 text-sm font-medium',
                    tierListViewModel === 'table'
                      ? 'bg-accent text-background'
                      : 'bg-surface/50 text-text/80 hover:bg-primary/20',
                  ]"
                  @click="tierListViewModel = 'table'"
                >
                  {{ t('statisticsPage.tierListViewTable') }}
                </button>
                <button
                  type="button"
                  :class="[
                    'rounded px-3 py-1.5 text-sm font-medium',
                    tierListViewModel === 'chart'
                      ? 'bg-accent text-background'
                      : 'bg-surface/50 text-text/80 hover:bg-primary/20',
                  ]"
                  @click="tierListViewModel = 'chart'"
                >
                  {{ t('statisticsPage.tierListViewChart') }}
                </button>
              </div>
            </div>
            <div v-if="tierListPending" class="text-text/70">
              {{ t('statisticsPage.loading') }}
            </div>
            <div
              v-else-if="tierListError"
              class="rounded border border-error bg-surface p-3 text-error"
            >
              {{ tierListError }}
            </div>
            <template v-else>
              <div
                v-if="totalTierListCount === 0"
                class="rounded-lg border border-primary/30 bg-surface/30 p-4 text-text/70"
              >
                {{ t('statisticsPage.tierListNoData') }}
              </div>
              <!-- Vue tableau -->
              <div
                v-show="tierListViewModel === 'table' && totalTierListCount > 0"
                class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30"
              >
                <table class="w-full min-w-[800px] text-left text-sm">
                  <thead class="border-b border-primary/30 bg-surface/50">
                    <tr>
                      <th
                        class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                        @click="cycleTierListSort('rank')"
                      >
                        {{ t('statisticsPage.tierListRank') }}
                        <span class="ml-1">{{ tierListSortIcon('rank') }}</span>
                      </th>
                      <th class="px-4 py-3 font-semibold text-text">
                        {{ t('statisticsPage.champion') }}
                      </th>
                      <th
                        class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                        @click="cycleTierListSort('tier')"
                      >
                        {{ t('statisticsPage.tierListTier') }}
                        <span class="ml-1">{{ tierListSortIcon('tier') }}</span>
                        <span
                          class="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-primary/30 text-[10px] text-text/80"
                          :title="t('statisticsPage.tierListTierTooltip')"
                          >?</span
                        >
                      </th>
                      <th
                        class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                        @click="cycleTierListSort('mainRolePct')"
                      >
                        {{ t('statisticsPage.tierListMainRole') }}
                        <span class="ml-1">{{ tierListSortIcon('mainRolePct') }}</span>
                        <span
                          class="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-primary/30 text-[10px] text-text/80"
                          :title="t('statisticsPage.tierListMainRoleTooltip')"
                          >?</span
                        >
                      </th>
                      <th
                        class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                        @click="cycleTierListSort('winrate')"
                      >
                        {{ t('statisticsPage.winrate') }}
                        <span class="ml-1">{{ tierListSortIcon('winrate') }}</span>
                        <span
                          class="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-primary/30 text-[10px] text-text/80"
                          :title="t('statisticsPage.tierListWinrateTooltip')"
                          >?</span
                        >
                      </th>
                      <th
                        class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                        @click="cycleTierListSort('pickrate')"
                      >
                        {{ t('statisticsPage.pickrate') }}
                        <span class="ml-1">{{ tierListSortIcon('pickrate') }}</span>
                        <span
                          class="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-primary/30 text-[10px] text-text/80"
                          :title="t('statisticsPage.tierListPickrateTooltip')"
                          >?</span
                        >
                      </th>
                      <th
                        class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                        @click="cycleTierListSort('banrate')"
                      >
                        {{ t('statisticsPage.banrate') }}
                        <span class="ml-1">{{ tierListSortIcon('banrate') }}</span>
                        <span
                          class="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-primary/30 text-[10px] text-text/80"
                          :title="t('statisticsPage.tierListBanrateTooltip')"
                          >?</span
                        >
                      </th>
                      <th
                        class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                        @click="cycleTierListSort('pbi')"
                      >
                        {{ t('statisticsPage.tierListPbi') }}
                        <span class="ml-1">{{ tierListSortIcon('pbi') }}</span>
                        <span
                          class="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-primary/30 text-[10px] text-text/80"
                          :title="t('statisticsPage.tierListPbiTooltip')"
                          >?</span
                        >
                      </th>
                      <th
                        class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                        @click="cycleTierListSort('games')"
                      >
                        {{ t('statisticsPage.tierListGames') }}
                        <span class="ml-1">{{ tierListSortIcon('games') }}</span>
                      </th>
                      <template v-if="(tierListData?.highEloRows?.length ?? 0) > 0">
                        <th
                          class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                          @click="cycleTierListSort('highEloRank')"
                        >
                          {{ t('statisticsPage.tierListHighEloRank') }}
                          <span class="ml-1">{{ tierListSortIcon('highEloRank') }}</span>
                        </th>
                        <th
                          class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                          @click="cycleTierListSort('highEloWinrate')"
                        >
                          {{ t('statisticsPage.tierListHighEloWin') }}
                          <span class="ml-1">{{ tierListSortIcon('highEloWinrate') }}</span>
                          <span
                            class="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-primary/30 text-[10px] text-text/80"
                            :title="t('statisticsPage.tierListHighEloWinTooltip')"
                            >?</span
                          >
                        </th>
                        <th
                          class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                          @click="cycleTierListSort('highEloGames')"
                        >
                          {{ t('statisticsPage.tierListHighEloGames') }}
                          <span class="ml-1">{{ tierListSortIcon('highEloGames') }}</span>
                        </th>
                        <th
                          class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                          @click="cycleTierListSort('delta')"
                        >
                          {{ t('statisticsPage.tierListDelta') }}
                          <span class="ml-1">{{ tierListSortIcon('delta') }}</span>
                          <span
                            class="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-primary/30 text-[10px] text-text/80"
                            :title="t('statisticsPage.tierListDeltaTooltip')"
                            >?</span
                          >
                        </th>
                      </template>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-primary/20">
                    <tr
                      v-for="row in paginatedTierList"
                      :key="row.championId"
                      class="cursor-pointer hover:bg-surface/50"
                      @click="navigateTo(localePath('/statistics/champion/' + row.championId))"
                    >
                      <td class="px-4 py-2 text-text/90">{{ row.rank }}</td>
                      <td class="px-4 py-2 font-medium text-text">
                        <div class="flex items-center gap-2">
                          <img
                            v-if="gameVersion && championByKey(row.championId)"
                            :src="
                              getChampionImageUrl(
                                gameVersion,
                                championByKey(row.championId)!.image.full
                              )
                            "
                            :alt="championName(row.championId) || ''"
                            class="h-8 w-8 rounded-full object-cover"
                            width="32"
                            height="32"
                          />
                          <span class="text-accent underline-offset-2 hover:underline">{{
                            championName(row.championId) || row.championId
                          }}</span>
                        </div>
                      </td>
                      <td class="px-4 py-2">
                        <span
                          :class="[
                            'inline-flex h-7 w-7 items-center justify-center rounded font-bold text-background',
                            row.tier === 'S+' && 'bg-violet-500',
                            row.tier === 'S' && 'bg-amber-500',
                            row.tier === 'A' && 'bg-sky-400',
                            row.tier === 'B' && 'bg-violet-400',
                            row.tier === 'C' && 'bg-orange-400',
                            row.tier === 'D' && 'bg-red-600',
                          ]"
                        >
                          {{ t('statisticsPage.tier' + row.tier) }}
                        </span>
                      </td>
                      <td class="px-4 py-2 text-text/90">
                        <div class="flex items-center gap-1.5">
                          <img
                            v-if="mainRoleIconSrc(row.mainRole)"
                            :src="mainRoleIconSrc(row.mainRole)!"
                            :alt="mainRoleLabel(row.mainRole)"
                            :title="mainRoleLabel(row.mainRole)"
                            class="h-5 w-5 shrink-0 object-contain"
                            width="20"
                            height="20"
                          />
                          <span v-else class="text-xs">{{ row.mainRole }}</span>
                          <span>{{ Number(row.mainRolePct).toFixed(0) }}%</span>
                        </div>
                      </td>
                      <td class="px-4 py-2 text-text/90">{{ (row.winrate * 100).toFixed(2) }}%</td>
                      <td class="px-4 py-2 text-text/90">{{ (row.pickrate * 100).toFixed(2) }}%</td>
                      <td class="px-4 py-2 text-text/90">{{ (row.banrate * 100).toFixed(2) }}%</td>
                      <td class="px-4 py-2 text-text/90">{{ Number(row.pbi).toFixed(2) }}</td>
                      <td class="px-4 py-2 text-text/90">{{ row.games.toLocaleString() }}</td>
                      <template v-if="(tierListData?.highEloRows?.length ?? 0) > 0">
                        <td class="px-4 py-2 text-text/90">
                          {{ row.highEloRank != null ? row.highEloRank : '—' }}
                        </td>
                        <td class="px-4 py-2 text-text/90">
                          {{
                            row.highEloWinrate != null
                              ? (row.highEloWinrate * 100).toFixed(2) + '%'
                              : '—'
                          }}
                        </td>
                        <td class="px-4 py-2 text-text/90">
                          {{ row.highEloGames != null ? row.highEloGames.toLocaleString() : '—' }}
                        </td>
                        <td class="px-4 py-2 text-text/90">
                          {{
                            row.delta != null
                              ? (row.delta > 0 ? '+' : '') + Number(row.delta).toFixed(2) + '%'
                              : '—'
                          }}
                        </td>
                      </template>
                    </tr>
                  </tbody>
                </table>
                <div
                  v-if="totalTierListCount > 0"
                  class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
                >
                  <span>{{ t('statisticsPage.showing') }} {{ totalTierListCount }}</span>
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-1.5">
                      <span class="text-text/70">{{ t('statisticsPage.perPage') }}</span>
                      <select
                        v-model.number="championsPageSize"
                        class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                      >
                        <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
                      </select>
                    </label>
                    <span class="text-text/70">
                      {{ (tierListPage - 1) * championsPageSize + 1 }}-{{
                        Math.min(tierListPage * championsPageSize, totalTierListCount)
                      }}
                      / {{ totalTierListCount }}
                    </span>
                    <div class="flex gap-1">
                      <button
                        type="button"
                        class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                        :disabled="tierListPage <= 1"
                        @click="tierListPage = Math.max(1, tierListPage - 1)"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                        :disabled="tierListPage >= totalTierListPages"
                        @click="tierListPage = Math.min(totalTierListPages, tierListPage + 1)"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Vue graphique : barres par champion (ordre worst → best, couleur = tier) -->
              <div
                v-show="tierListViewModel === 'chart' && totalTierListCount > 0"
                class="flex flex-col gap-4 rounded-lg border border-primary/30 bg-surface/30 p-4 lg:flex-row"
              >
                <div class="flex-1 overflow-x-auto">
                  <div
                    class="tier-list-bar-chart flex items-center justify-start gap-0.5"
                    style="min-height: 160px; min-width: min(100%, max-content)"
                  >
                    <NuxtLink
                      v-for="c in tierListBarChartData"
                      :key="c.championId"
                      :to="localePath('/statistics/champion/' + c.championId)"
                      class="tier-list-bar-item flex h-40 flex-col items-center justify-center gap-0"
                      :title="
                        (championName(c.championId) || c.championId) +
                        ' – PBI ' +
                        Number(c.pbi).toFixed(2)
                      "
                    >
                      <div class="flex min-h-[52px] flex-1 flex-col items-center justify-end">
                        <div
                          v-if="c.pbi >= 0"
                          class="tier-bar tier-bar-up w-6 shrink-0 rounded-t"
                          :style="{
                            height: c.barHeight * 0.52 + 'px',
                            minHeight: c.pbi > 0 ? '4px' : '0',
                            backgroundColor: TIER_CHART_COLORS[c.tier] || TIER_CHART_COLORS.D,
                          }"
                        />
                      </div>
                      <img
                        v-if="gameVersion && championByKey(c.championId)"
                        :src="
                          getChampionImageUrl(gameVersion, championByKey(c.championId)!.image.full)
                        "
                        :alt="championName(c.championId) || ''"
                        class="h-8 w-8 shrink-0 rounded-full border-2 border-primary/30 object-cover"
                        width="32"
                        height="32"
                      />
                      <div class="flex min-h-[52px] flex-1 flex-col items-center justify-start">
                        <div
                          v-if="c.pbi < 0"
                          class="tier-bar tier-bar-down w-6 shrink-0 rounded-b"
                          :style="{
                            height: c.barHeight * 0.52 + 'px',
                            minHeight: c.pbi < 0 ? '4px' : '0',
                            backgroundColor: TIER_CHART_COLORS[c.tier] || TIER_CHART_COLORS.D,
                          }"
                        />
                      </div>
                    </NuxtLink>
                  </div>
                  <div class="mt-1 flex justify-between text-[10px] text-text/50">
                    <span>{{ t('statisticsPage.tierListChartWorst') }}</span>
                    <span>{{ t('statisticsPage.tierListChartBest') }}</span>
                  </div>
                </div>
                <!-- Légende des tiers (style image) -->
                <div
                  class="tier-legend shrink-0 rounded-lg border-2 border-amber-500/60 bg-surface/80 px-4 py-3 lg:w-56"
                >
                  <div class="mb-2 text-sm font-semibold text-text">
                    {{ t('statisticsPage.tierListLegend') }}
                  </div>
                  <div class="space-y-1.5 text-xs">
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-block h-4 w-4 shrink-0 rounded"
                        style="background-color: #eab308"
                      />
                      <span class="font-medium text-amber-400">S</span>
                      <span class="text-text/80">{{ t('statisticsPage.tierLegendS') }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-block h-4 w-4 shrink-0 rounded"
                        style="background-color: #38bdf8"
                      />
                      <span class="font-medium text-sky-400">A</span>
                      <span class="text-text/80">{{ t('statisticsPage.tierLegendA') }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-block h-4 w-4 shrink-0 rounded"
                        style="background-color: #a78bfa"
                      />
                      <span class="font-medium text-violet-400">B</span>
                      <span class="text-text/80">{{ t('statisticsPage.tierLegendB') }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-block h-4 w-4 shrink-0 rounded"
                        style="background-color: #fb923c"
                      />
                      <span class="font-medium text-orange-400">C</span>
                      <span class="text-text/80">{{ t('statisticsPage.tierLegendC') }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-block h-4 w-4 shrink-0 rounded"
                        style="background-color: #dc2626"
                      />
                      <span class="font-medium text-red-500">F</span>
                      <span class="text-text/80">{{ t('statisticsPage.tierLegendF') }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Tab: Durée de partie -->
          <div v-show="activeTab === 'duration'" class="space-y-4">
            <h2 class="text-xl font-semibold text-text-accent">
              {{ t('statisticsPage.durationTitle') }}
            </h2>
            <p class="text-sm text-text/80">
              {{ t('statisticsPage.overviewDurationWinrateDescription') }}
            </p>
            <div
              v-if="overviewDurationWinratePending || !overviewDurationWinrateData?.buckets?.length"
              class="text-text/70"
            >
              {{ t('statisticsPage.loading') }}
            </div>
            <div
              v-else-if="durationWinrateChartBuckets.length"
              class="relative w-full rounded-lg border border-primary/30 bg-surface/30 p-4"
            >
              <div class="relative min-h-[280px] w-full">
                <svg
                  :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
                  class="h-auto min-h-[260px] w-full"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="duration-fill-global" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stop-color="rgb(var(--rgb-accent) / 0.4)" />
                      <stop offset="100%" stop-color="rgb(var(--rgb-accent) / 0.05)" />
                    </linearGradient>
                  </defs>
                  <path :d="durationWinrateChartClosedPath" fill="url(#duration-fill-global)" />
                  <path
                    :d="durationWinrateChartLinePath"
                    fill="none"
                    stroke="rgb(var(--rgb-accent))"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <g v-for="(pt, i) in durationWinrateChartPointsList" :key="'dpt-' + i">
                    <circle
                      :cx="pt.x"
                      :cy="pt.y"
                      r="12"
                      fill="transparent"
                      class="cursor-pointer"
                      @mouseenter="
                        durationChartTooltip = {
                          durationLabel: pt.durationLabel,
                          winrate: pt.winrate,
                          matchCount: pt.matchCount,
                          x: pt.x,
                          y: pt.y,
                        }
                      "
                      @mouseleave="durationChartTooltip = null"
                    />
                    <circle :cx="pt.x" :cy="pt.y" r="3" fill="rgb(var(--rgb-accent))" />
                  </g>
                  <g v-for="(tick, i) in durationWinrateAxisX.ticks" :key="'dx-' + i">
                    <line
                      :x1="tick.x"
                      :y1="CHART_PAD.top + PLOT_H"
                      :y2="CHART_PAD.top + PLOT_H + 4"
                      stroke="currentColor"
                      stroke-width="1"
                      class="text-text/50"
                    />
                    <text
                      :x="tick.x"
                      :y="CHART_H - 6"
                      text-anchor="middle"
                      class="fill-text/70 text-[10px]"
                    >
                      {{ tick.value }}
                    </text>
                  </g>
                  <g v-for="(tick, i) in durationWinrateAxisY.ticks" :key="'dy-' + i">
                    <line
                      :x1="CHART_PAD.left"
                      :y1="tick.y"
                      :x2="CHART_PAD.left - 4"
                      :y2="tick.y"
                      stroke="currentColor"
                      stroke-width="1"
                      class="text-text/50"
                    />
                    <text
                      :x="CHART_PAD.left - 8"
                      :y="tick.y + 4"
                      text-anchor="end"
                      class="fill-text/70 text-[10px]"
                    >
                      {{ tick.value }}
                    </text>
                  </g>
                  <!-- Légende abscisse (X) -->
                  <text
                    :x="CHART_W / 2"
                    :y="CHART_H - 4"
                    text-anchor="middle"
                    class="fill-text/60 text-[11px]"
                  >
                    {{ t('statisticsPage.overviewDurationWinrateAxisX') }}
                  </text>
                  <!-- Légende ordonnée (Y) -->
                  <text
                    :x="14"
                    :y="CHART_H / 2"
                    text-anchor="middle"
                    class="fill-text/60 text-[11px]"
                    :transform="`rotate(-90, 14, ${CHART_H / 2})`"
                  >
                    {{ t('statisticsPage.overviewDurationMatchesAxisY') }}
                  </text>
                </svg>
                <div
                  v-if="durationChartTooltip"
                  class="duration-chart-tooltip pointer-events-none absolute z-10 rounded border border-primary/40 bg-surface px-2 py-1.5 text-left text-xs shadow-lg"
                  :style="{
                    left: (durationChartTooltip.x / CHART_W) * 100 + '%',
                    top: (durationChartTooltip.y / CHART_H) * 100 + '%',
                    transform: 'translate(-50%, -100%) translateY(-8px)',
                  }"
                >
                  <div class="font-medium text-text">
                    {{ durationChartTooltip.durationLabel }}
                  </div>
                  <div class="text-text/80">
                    {{ durationChartTooltip.matchCount }}
                    {{ t('statisticsPage.overviewDurationWinrateTooltipMatches') }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab: Objets (global) -->
          <div v-show="activeTab === 'items'" class="space-y-4">
            <h2 class="text-xl font-semibold text-text-accent">
              {{ t('statisticsPage.itemsTitle') }}
            </h2>
            <p class="text-sm text-text/80">{{ t('statisticsPage.itemsDescription') }}</p>
            <div v-if="overviewDetailPending" class="text-text/70">
              {{ t('statisticsPage.loading') }}
            </div>
            <div
              v-else-if="overviewDetailError"
              class="rounded border border-error/50 p-3 text-error"
            >
              {{ t('statisticsPage.overviewDetailTimeout') }}
            </div>
            <div
              v-else-if="overviewDetailData?.items?.length"
              class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30"
            >
              <table class="w-full text-left text-sm">
                <thead class="border-b border-primary/30 bg-surface/50">
                  <tr>
                    <th class="px-4 py-3 font-semibold text-text">
                      {{ t('statisticsPage.overviewDetailItems') }}
                    </th>
                    <th class="px-4 py-3 font-semibold text-text">
                      {{ t('statisticsPage.overviewDetailPickRate') }} %
                    </th>
                    <th class="px-4 py-3 font-semibold text-text">
                      {{ t('statisticsPage.overviewDetailWinRate') }} %
                    </th>
                    <th class="px-4 py-3 font-semibold text-text">
                      {{ t('statisticsPage.itemStats') }}
                    </th>
                    <th class="px-4 py-3 font-semibold text-text">
                      {{ t('statisticsPage.itemEconomy') }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-primary/20">
                  <tr v-for="row in paginatedItems" :key="row.itemId" class="hover:bg-surface/50">
                    <td class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <img
                          v-if="itemImageName(row.itemId)"
                          :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                          :alt="itemName(row.itemId) || ''"
                          class="h-8 w-8 rounded object-cover"
                          width="32"
                          height="32"
                        />
                        <span class="text-text">{{ itemName(row.itemId) || row.itemId }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-2 text-text/90">{{ row.pickrate?.toFixed(2) ?? '—' }}</td>
                    <td class="px-4 py-2 text-text/90">
                      {{ row.winrate != null ? Number(row.winrate).toFixed(2) : '—' }}
                    </td>
                    <td class="max-w-[200px] px-4 py-2 text-text/80">
                      <span
                        v-if="itemStatsForItem(row.itemId).length"
                        :title="itemStatsForItem(row.itemId).join(', ')"
                        class="line-clamp-2 text-xs"
                      >
                        {{ itemStatsForItem(row.itemId).join(', ') }}
                      </span>
                      <span v-else class="text-text/50">—</span>
                    </td>
                    <td class="max-w-[160px] px-4 py-2 text-text/80">
                      <span
                        v-if="itemEconomicForItem(row.itemId).length"
                        :title="itemEconomicForItem(row.itemId).join(', ')"
                        class="line-clamp-2 text-xs"
                      >
                        {{ itemEconomicForItem(row.itemId).join(', ') }}
                      </span>
                      <span v-else class="text-text/50">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div
                v-if="totalItemsCount > 0"
                class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
              >
                <span>{{ totalItemsCount }} {{ t('statisticsPage.overviewDetailItems') }}</span>
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-1.5">
                    <span class="text-text/70">{{ t('statisticsPage.perPage') }}</span>
                    <select
                      v-model.number="itemsPageSize"
                      class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                    >
                      <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
                    </select>
                  </label>
                  <span class="text-text/70">
                    {{ (itemsPage - 1) * itemsPageSize + 1 }}-{{
                      Math.min(itemsPage * itemsPageSize, totalItemsCount)
                    }}
                    / {{ totalItemsCount }}
                  </span>
                  <div class="flex gap-1">
                    <button
                      type="button"
                      class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                      :disabled="itemsPage <= 1"
                      @click="itemsPage = Math.max(1, itemsPage - 1)"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                      :disabled="itemsPage >= totalItemsPages"
                      @click="itemsPage = Math.min(totalItemsPages, itemsPage + 1)"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-text/70">{{ t('statisticsPage.overviewDetailNoData') }}</div>
          </div>

          <!-- Tab: Sorts d'invocateur (global) -->
          <div v-show="activeTab === 'spells'" class="space-y-4">
            <h2 class="text-xl font-semibold text-text-accent">
              {{ t('statisticsPage.spellsTitle') }}
            </h2>
            <p class="text-sm text-text/80">{{ t('statisticsPage.spellsDescription') }}</p>
            <div v-if="overviewDetailPending" class="text-text/70">
              {{ t('statisticsPage.loading') }}
            </div>
            <div
              v-else-if="overviewDetailError"
              class="rounded border border-error/50 p-3 text-error"
            >
              {{ t('statisticsPage.overviewDetailTimeout') }}
            </div>
            <div
              v-else-if="overviewDetailData?.summonerSpells?.length"
              class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30"
            >
              <table class="w-full text-left text-sm">
                <thead class="border-b border-primary/30 bg-surface/50">
                  <tr>
                    <th class="px-4 py-3 font-semibold text-text">
                      {{ t('statisticsPage.overviewDetailSummonerSpells') }}
                    </th>
                    <th class="px-4 py-3 font-semibold text-text">
                      {{ t('statisticsPage.overviewDetailPickRate') }} %
                    </th>
                    <th class="px-4 py-3 font-semibold text-text">
                      {{ t('statisticsPage.overviewDetailWinRate') }} %
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-primary/20">
                  <tr
                    v-for="row in overviewDetailData?.summonerSpells ?? []"
                    :key="row.spellId"
                    class="hover:bg-surface/50"
                  >
                    <td class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <img
                          v-if="spellImageName(row.spellId)"
                          :src="getSpellImageUrl(gameVersion, spellImageName(row.spellId)!)"
                          :alt="spellName(row.spellId) || ''"
                          class="h-8 w-8 rounded object-cover"
                          width="32"
                          height="32"
                        />
                        <span class="text-text">{{ spellName(row.spellId) || row.spellId }}</span>
                      </div>
                    </td>
                    <td class="px-4 py-2 text-text/90">{{ row.pickrate?.toFixed(2) ?? '—' }}</td>
                    <td class="px-4 py-2 text-text/90">
                      {{ row.winrate != null ? Number(row.winrate).toFixed(2) : '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="text-text/70">{{ t('statisticsPage.overviewDetailNoData') }}</div>
          </div>

          <!-- Tab: Abandons -->
          <div v-show="activeTab === 'abandons'" class="space-y-4">
            <h2 class="text-xl font-semibold text-text-accent">
              {{ t('statisticsPage.abandonsTitle') }}
            </h2>
            <p class="text-sm text-text/80">{{ t('statisticsPage.abandonsDescription') }}</p>
            <div v-if="overviewAbandonsPending" class="text-text/70">
              {{ t('statisticsPage.loading') }}
            </div>
            <div v-else-if="overviewAbandonsData" class="grid gap-4 sm:grid-cols-3">
              <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
                <div class="text-sm text-text/70">{{ t('statisticsPage.abandonsRemakeRate') }}</div>
                <div class="text-2xl font-semibold text-text">
                  {{ overviewAbandonsData.remakeRate?.toFixed(2) ?? 0 }}%
                </div>
                <div class="text-xs text-text/50">
                  {{ overviewAbandonsData.remakeCount }} / {{ overviewAbandonsData.totalMatches }}
                </div>
              </div>
              <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
                <div class="text-sm text-text/70">
                  {{ t('statisticsPage.abandonsEarlySurrenderRate') }}
                </div>
                <div class="text-2xl font-semibold text-text">
                  {{ overviewAbandonsData.earlySurrenderRate?.toFixed(2) ?? 0 }}%
                </div>
                <div class="text-xs text-text/50">
                  {{ overviewAbandonsData.earlySurrenderCount }} /
                  {{ overviewAbandonsData.totalMatches }}
                </div>
              </div>
              <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
                <div class="text-sm text-text/70">
                  {{ t('statisticsPage.abandonsSurrenderRate') }}
                </div>
                <div class="text-2xl font-semibold text-text">
                  {{ overviewAbandonsData.surrenderRate?.toFixed(2) ?? 0 }}%
                </div>
                <div class="text-xs text-text/50">
                  {{ overviewAbandonsData.surrenderCount }} /
                  {{ overviewAbandonsData.totalMatches }}
                </div>
              </div>
            </div>
            <div v-else class="text-text/70">{{ t('statisticsPage.noData') }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import {
  getChampionImageUrl,
  getItemImageUrl,
  getRunePathColor,
  getRuneImageUrl,
  getSpellImageUrl,
} from '~/utils/imageUrl'
import { formatItemStatsForDisplay, formatItemEconomicForDisplay } from '~/utils/formatItemStats'

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

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const activeTab = ref<
  | 'overview'
  | 'tierlist'
  | 'trends'
  | 'team'
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
>('overview')
const tabs = computed(() => [
  { id: 'overview' as const, label: t('statisticsPage.tabOverview'), widgetId: 'overview' },
  { id: 'tierlist' as const, label: t('statisticsPage.tabTierList'), widgetId: 'tierlist' },
  { id: 'trends' as const, label: t('statisticsPage.tabTrends'), widgetId: 'trends' },
  { id: 'team' as const, label: t('statisticsPage.tabTeam'), widgetId: 'team' },
  { id: 'runes' as const, label: t('statisticsPage.tabRunes'), widgetId: 'runes' },
  { id: 'items' as const, label: t('statisticsPage.tabItems'), widgetId: 'items' },
  { id: 'spells' as const, label: t('statisticsPage.tabSummonerSpells'), widgetId: 'spells' },
  { id: 'infos' as const, label: t('statisticsPage.tabInfos'), widgetId: 'infos' },
])

function cardIsFavorite(cardId: string): boolean {
  return statisticsCustomStore.isFavorite(cardId)
}

function toggleFavoriteCard(cardId: string, title: string): void {
  statisticsCustomStore.toggleFavorite(cardId, title)
}

function normalizeLegacyTab(tab: string): StatisticsMainTab {
  if (tab === 'champions') return 'infos'
  if (tab === 'progressions') return 'trends'
  if (tab === 'sides') return 'team'
  if (tab === 'detail') return 'runes'
  if (tab === 'duration') return 'team'
  if (tab === 'abandons') return 'team'
  if (
    tab === 'overview' ||
    tab === 'tierlist' ||
    tab === 'trends' ||
    tab === 'team' ||
    tab === 'runes' ||
    tab === 'items' ||
    tab === 'spells' ||
    tab === 'infos'
  ) {
    return tab
  }
  return 'overview'
}

const championSearchQuery = ref('')
/** Pagination: page size and current page (1-based). Shared for Champions and Tier list. */
const championsPageSize = ref(20)
const championsPage = ref(1)
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
/** Pagination Objets (onglet items). */
const itemsPageSize = ref(20)
const itemsPage = ref(1)
const itemsList = computed(() => overviewDetailData.value?.items ?? [])
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
const championsSortOrder = ref<'winrate' | 'pickrate' | 'banrate' | 'games' | 'wins'>('winrate')
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
    else if (sort === 'banrate') diff = (b.banrate ?? 0) - (a.banrate ?? 0)
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
function setChampionsSort(col: 'games' | 'wins' | 'winrate' | 'pickrate' | 'banrate') {
  if (championsSortOrder.value === col) {
    championsSortDir.value = championsSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    championsSortOrder.value = col
    championsSortDir.value = 'desc'
  }
}
/** Vue d'ensemble → Tier list avec la même logique de tri que la colonne correspondante. */
function goToTierListWithSort(sort: 'winrate' | 'pickrate' | 'banrate') {
  tierListSortColumn.value = sort
  tierListSortDir.value = 'desc'
  tierListViewModel.value = 'table'
  activeTab.value = 'tierlist'
}

/** Tier list: types and sort (3-state: default, asc, desc). */
type TierListSortColumn =
  | 'rank'
  | 'champion'
  | 'tier'
  | 'mainRolePct'
  | 'winrate'
  | 'pickrate'
  | 'banrate'
  | 'pbi'
  | 'games'
  | 'highEloRank'
  | 'highEloWinrate'
  | 'highEloGames'
  | 'delta'

const tierListViewModel = ref<'table' | 'chart'>('table')
const tierListSortColumn = ref<TierListSortColumn | null>(null)
const tierListSortDir = ref<'asc' | 'desc'>('desc')
const tierListPage = ref(1)
const TIER_ORDER: Record<string, number> = { 'S+': 6, S: 5, A: 4, B: 3, C: 2, D: 1 }

/** High-elo row by champion id for delta and GM+Chall columns. */
const highEloRowsByChampionId = computed(() => {
  const rows = tierListData.value?.highEloRows ?? []
  const map = new Map<number, (typeof rows)[0]>()
  for (const r of rows) map.set(r.championId, r)
  return map
})

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
}
const tierListRows = computed((): TierListRowWithDelta[] => {
  const rows = tierListData.value?.rows ?? []
  const highElo = highEloRowsByChampionId.value
  return rows.map(r => {
    const he = highElo.get(r.championId)
    const winratePct = r.winrate * 100
    const highEloWinratePct = he ? he.winrate * 100 : undefined
    const delta = highEloWinratePct != null ? winratePct - highEloWinratePct : undefined
    return {
      ...r,
      highEloRank: he?.rank,
      highEloWinrate: he?.winrate,
      highEloGames: he?.games,
      delta,
    }
  })
})

const sortedTierListRows = computed(() => {
  const list = tierListRows.value
  const col = tierListSortColumn.value
  const dir = tierListSortDir.value
  if (!col || col === 'champion') return [...list]
  const mult = dir === 'desc' ? 1 : -1
  return [...list].sort((a, b) => {
    let diff = 0
    if (col === 'rank') diff = a.rank - b.rank
    else if (col === 'tier') diff = (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0)
    else if (col === 'mainRolePct') diff = a.mainRolePct - b.mainRolePct
    else if (col === 'winrate') diff = a.winrate - b.winrate
    else if (col === 'pickrate') diff = a.pickrate - b.pickrate
    else if (col === 'banrate') diff = a.banrate - b.banrate
    else if (col === 'pbi') diff = a.pbi - b.pbi
    else if (col === 'games') diff = a.games - b.games
    else if (col === 'highEloRank') diff = (a.highEloRank ?? 0) - (b.highEloRank ?? 0)
    else if (col === 'highEloWinrate') diff = (a.highEloWinrate ?? 0) - (b.highEloWinrate ?? 0)
    else if (col === 'highEloGames') diff = (a.highEloGames ?? 0) - (b.highEloGames ?? 0)
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

/** Tier list bar chart: ordered by PBI (worst to best). */
const tierListBarChartData = computed(() => {
  const list = [...tierListRows.value].sort((a, b) => a.pbi - b.pbi)
  const minPbi = Math.min(...list.map(c => c.pbi), -5)
  const maxPbi = Math.max(...list.map(c => c.pbi), 10)
  const range = Math.max(Math.abs(minPbi), Math.abs(maxPbi), 1)
  return list.map(c => ({
    ...c,
    barHeight: (Math.abs(c.pbi) / range) * 100,
  }))
})

const TIER_CHART_COLORS: Record<string, string> = {
  'S+': '#c084fc',
  S: '#eab308',
  A: '#38bdf8',
  B: '#a78bfa',
  C: '#fb923c',
  D: '#dc2626',
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
watch([tierListSortColumn, tierListSortDir, championsPageSize], () => {
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
} | null>(null)
const overviewPending = ref(true)
/** Selected version filter for overview (null = all versions). */
/** Filtres communs à tous les onglets (version, division, rôle). */
const statsVersionFilter = ref('')
const statsDivisionFilter = ref<string[]>([])
const statsRoleFilter = ref('')
const statsOtpFilter = ref<'oui' | 'non' | 'solo'>('non')
const progressionFromVersionOverride = ref('')
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

if (import.meta.client) {
  statisticsUiStore.init()
  statisticsCustomStore.init()
  activeTab.value = normalizeLegacyTab(statisticsUiStore.activeTab)
}

watch(activeTab, value => {
  if (!import.meta.client) return
  statisticsUiStore.setActiveTab(normalizeLegacyTab(value))
})

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
const statsVersionOptions = computed(() => {
  if (statsKnownVersions.value.length > 0) return statsKnownVersions.value
  const fallback = overviewData.value?.matchesByVersion ?? []
  return [...fallback].sort((a, b) => compareVersionsDesc(a.version, b.version))
})
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
  overviewDetailError.value = false
  if (activeTab.value === 'overview') loadOverview()
  if (activeTab.value === 'sides') loadOverviewSides()
  if (activeTab.value === 'champions') loadChampions()
  if (activeTab.value === 'detail') loadOverviewDetail()
  if (activeTab.value === 'team') {
    loadOverviewSides()
    loadOverviewTeams()
  }
  if (activeTab.value === 'trends') loadProgressionsFull()
  if (activeTab.value === 'abandons') loadOverviewAbandons()
}

function resetStatsFilters() {
  statsVersionFilter.value = ''
  statsDivisionFilter.value = []
  statsRoleFilter.value = ''
  statsOtpFilter.value = 'non'
  progressionFromVersionOverride.value = ''
  championSearchQuery.value = ''
  onStatsFilterChange()
}
/** Overview detail (runes, items, spells) from GET /api/stats/overview-detail */
const detailExpand = ref({
  runes: false,
  runeSets: false,
  items: false,
  itemSets: false,
  itemsByOrder: false,
  summonerSpells: false,
})
const overviewDetailData = ref<{
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  runeSets: Array<{
    runes: unknown
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  items: Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }>
  itemSets: Array<{
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
  }>
} | null>(null)
const overviewDetailPending = ref(false)
function overviewQueryParams(): string {
  const params = new URLSearchParams()
  if (statsVersionFilter.value) params.set('version', statsVersionFilter.value)
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  params.set('otp', statsOtpFilter.value)
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
const overviewMatchOutcomeDonutBg = computed(() => {
  const e = overviewEarlySurrenderPct.value
  const s = overviewSurrenderOnlyPct.value
  const p = Math.max(0, 100 - e - s)
  return `conic-gradient(
    rgb(253 230 138) 0% ${e}%,
    rgb(255 251 235) ${e}% ${e + s}%,
    rgb(147 197 253) ${e + s}% ${e + s + p}%,
    rgb(var(--rgb-primary) / 0.2) ${e + s + p}% 100%
  )`
})
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
  if (versions.length <= 1) return versions
  return versions.slice(1)
})
const progressionFromVersionModel = computed({
  get: () => progressionFromVersion.value ?? '',
  set: value => {
    progressionFromVersionOverride.value = value || ''
  },
})

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
const overviewTopWinrateSince = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  return [...list]
    .filter(r => r.deltaWr > 0)
    .sort((a, b) => b.deltaWr - a.deltaWr)
    .slice(0, 5)
})
const overviewTopPickrateSince = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  return [...list]
    .filter(r => r.deltaPick > 0)
    .sort((a, b) => b.deltaPick - a.deltaPick)
    .slice(0, 5)
})
const overviewTopBanrateSince = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  return [...list]
    .filter(r => r.deltaBan > 0)
    .sort((a, b) => b.deltaBan - a.deltaBan)
    .slice(0, 5)
})
const overviewBottomWinrateSince = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  return [...list]
    .filter(r => r.deltaWr < 0)
    .sort((a, b) => a.deltaWr - b.deltaWr)
    .slice(0, 5)
})
const overviewBottomPickrateSince = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  return [...list]
    .filter(r => r.deltaPick < 0)
    .sort((a, b) => a.deltaPick - b.deltaPick)
    .slice(0, 5)
})
const overviewBottomBanrateSince = computed(() => {
  const list = progressionFullData.value?.champions ?? []
  return [...list]
    .filter(r => r.deltaBan < 0)
    .sort((a, b) => a.deltaBan - b.deltaBan)
    .slice(0, 5)
})
const CHART_W = 560
const CHART_H = 260
const CHART_PAD = { left: 44, right: 20, top: 20, bottom: 30 }
const PLOT_W = CHART_W - CHART_PAD.left - CHART_PAD.right
const PLOT_H = CHART_H - CHART_PAD.top - CHART_PAD.bottom
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used when duration winrate chart is rendered
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
  try {
    overviewDetailData.value = await statsFetch(
      apiUrl('/api/stats/overview-detail' + overviewQueryParams()),
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
} | null>(null)
const overviewSidesPending = ref(false)
const overviewSidesChampionWinrateBySide = computed(() => ({
  blue: overviewSidesData.value?.championWinrateBySide?.blue ?? [],
  red: overviewSidesData.value?.championWinrateBySide?.red ?? [],
}))
const overviewSidesBansBySide = computed(() => ({
  blue: overviewSidesData.value?.bansBySide?.blue ?? [],
  red: overviewSidesData.value?.bansBySide?.red ?? [],
}))
const overviewSidesSideWinrate = computed(() => ({
  blue: overviewSidesData.value?.sideWinrate?.blue ?? { matches: 0, wins: 0, winrate: 0 },
  red: overviewSidesData.value?.sideWinrate?.red ?? { matches: 0, wins: 0, winrate: 0 },
}))
const sidesExpandBlue = ref(false)
const sidesExpandRed = ref(false)
const sidesExpandPickBlue = ref(false)
const sidesExpandPickRed = ref(false)
const sidesExpandBansBlue = ref(false)
const sidesExpandBansRed = ref(false)
const sidesObjectiveKeysWithKills = [
  'baron',
  'dragon',
  'elder',
  'tower',
  'inhibitor',
  'riftHerald',
  'horde',
] as const
const CDRAGON_SCOREBOARD_BASE_URL = '/data/community-dragon/scoreboard-objectives'
const OBJECTIVE_ICON_BY_KEY: Record<string, string> = {
  baron: `${CDRAGON_SCOREBOARD_BASE_URL}/_baronnashor.png`,
  dragon: `${CDRAGON_SCOREBOARD_BASE_URL}/_dragon.png`,
  elder: `${CDRAGON_SCOREBOARD_BASE_URL}/_elderdrake.png`,
  riftHerald: `${CDRAGON_SCOREBOARD_BASE_URL}/_riftherald.png`,
}
const DRAKE_ICON_BY_KEY: Record<string, string> = {
  earth: `${CDRAGON_SCOREBOARD_BASE_URL}/_mountaindrake.png`,
  water: `${CDRAGON_SCOREBOARD_BASE_URL}/_oceandrake.png`,
  wind: `${CDRAGON_SCOREBOARD_BASE_URL}/_clouddrake.png`,
  fire: `${CDRAGON_SCOREBOARD_BASE_URL}/_infernaldrake.png`,
  hextec: `${CDRAGON_SCOREBOARD_BASE_URL}/_hextechdrake.png`,
  chem: `${CDRAGON_SCOREBOARD_BASE_URL}/_chemtechdrake.png`,
}
function objectiveIconSrc(key: string): string | null {
  return OBJECTIVE_ICON_BY_KEY[key] ?? null
}
function drakeIconSrc(key: string): string | null {
  return DRAKE_ICON_BY_KEY[key] ?? null
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
async function loadOverviewSides() {
  const t = statsPerfStart('loadOverviewSides')
  overviewSidesPending.value = true
  try {
    overviewSidesData.value = await statsFetch(
      apiUrl('/api/stats/overview-sides' + sidesQueryParams())
    )
  } catch {
    overviewSidesData.value = null
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Fallback for empty state
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
const overviewEffectiveTopWinrateChampions = computed(() => {
  const fromOverview = overviewData.value?.topWinrateChampions
  if (fromOverview?.length) return fromOverview
  const fromPickrate = overviewData.value?.topPickrateChampions
  if (!fromPickrate?.length) return []
  return [...fromPickrate].sort((a, b) => (b.winrate ?? 0) - (a.winrate ?? 0)).slice(0, 5)
})
/** Top banrate champions: from overview when present, else from teams.bans.top20Total (first 5); banrate from API banRatePercent (share of all bans). */
const overviewEffectiveTopBanrateChampions = computed(() => {
  const fromOverview = overviewData.value?.topBanrateChampions
  if (fromOverview?.length) return fromOverview
  const teams = overviewTeamsData.value?.bans?.top20Total
  if (!teams?.length) return []
  return teams.slice(0, 5).map(b => {
    const pct = typeof b.banRatePercent === 'string' ? parseFloat(b.banRatePercent) : 0
    return {
      championId: b.championId,
      banCount: b.count,
      banrate: Number.isFinite(pct) ? pct : 0,
    }
  })
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
  'elder',
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
async function loadTierList() {
  tierListPending.value = true
  tierListError.value = null
  try {
    const params = new URLSearchParams()
    const patch = effectiveTierListPatch.value
    if (patch) params.set('patch', patch)
    params.set('rankTier', 'all')
    params.set('otp', statsOtpFilter.value)
    const data = await statsFetch<{
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
    }>(apiUrl(`/api/stats/tier-list?${params.toString()}`))
    tierListData.value = data
    if (data?.error || data?.message) {
      tierListError.value = [data.error, data.message].filter(Boolean).join(': ')
    } else {
      tierListError.value = null
    }
  } catch (err) {
    tierListError.value = err instanceof Error ? err.message : String(err)
    tierListData.value = null
  } finally {
    tierListPending.value = false
  }
}
watch([statsDivisionFilter, statsRoleFilter, statsOtpFilter], () => {
  if (activeTab.value === 'infos' || activeTab.value === 'tierlist') loadChampions()
  if (activeTab.value === 'tierlist') loadTierList()
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

/** Find rune by perk id across all paths/slots. */
function getRuneById(runeId: number): { id: number; name: string; icon: string } | null {
  for (const path of runesStore.runePaths) {
    for (const slot of path.slots) {
      const rune = slot.runes.find(r => r.id === runeId)
      if (rune) return rune
    }
  }
  return null
}

/** Map runeId -> stats for overview runes (pickrate, winrate, games). */
const runeStatsByRuneId = computed(() => {
  const runes = overviewDetailData.value?.runes ?? []
  const map: Record<number, { pickrate: number; winrate: number; games: number }> = {}
  for (const r of runes) {
    map[r.runeId] = { pickrate: r.pickrate, winrate: r.winrate, games: r.games }
  }
  return map
})

/** Per-path rune grid for shyv-style layout: each path has 4 rows (row 0 = 4 keystones, rows 1–3 = 3 runes each). */
const overviewRunesByPath = computed(() => {
  const stats = runeStatsByRuneId.value
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

function runePathPanelStyle(icon: string): Record<string, string> {
  const color = getRunePathColor(icon)
  return {
    borderColor: `${color}66`,
    boxShadow: `inset 0 0 0 1px ${color}22`,
  }
}

/** Extract perk ids from participant runes JSON (styles[].selections[].perk). */
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

/** Resolve spell name from game data (public/data/game/{version}/{lang}/summoner.json) by id from Participants.summonerSpells. */
function spellName(spellId: number): string | null {
  const spell = summonerSpellsStore.getSpellById(String(spellId))
  return spell?.name ?? null
}

/** Resolve spell image filename from game data summoner.json by id (key). */
function spellImageName(spellId: number): string | null {
  const spell = summonerSpellsStore.getSpellById(String(spellId))
  return spell?.image?.full ?? null
}

function sortedItemsBySlot(
  slotIdx: number
): Array<{ itemId: number; games: number; wins: number; winrate: number }> {
  const list = overviewDetailData.value?.itemsByOrder[String(slotIdx)] ?? []
  return [...list].sort((a, b) => b.games - a.games)
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
  if (tab === 'tierlist' || tab === 'infos') loadChampions()
  if (tab === 'tierlist') loadTierList()
  if (tab === 'items' || tab === 'spells' || tab === 'runes') {
    if (!overviewDetailData.value && !overviewDetailPending.value) loadOverviewDetail()
  }
  if (tab === 'abandons') loadOverviewAbandons()
})
watch([statsVersionFilter, statsDivisionFilter, statsRoleFilter, statsOtpFilter], () => {
  if (activeTab.value === 'team') {
    loadOverviewSides()
    loadOverviewTeams()
  }
  if (activeTab.value === 'trends') loadProgressionsFull()
})
watch(progressionFromVersion, () => {
  if (activeTab.value === 'overview') {
    loadOverviewProgression()
    loadProgressionsFull()
  }
  if (activeTab.value === 'trends') loadProgressionsFull()
})

onMounted(async () => {
  const versionPromise = versionStore.currentVersion
    ? Promise.resolve()
    : versionStore.loadCurrentVersion()
  const tPage = statsPerfStart('page mount')
  const tVersion = statsPerfStart('version')
  await versionPromise
  statsPerfEnd('version', tVersion)
  await loadOverview()
  statsPerfEnd('page mount', tPage)
  championsStore.loadChampions(riotLocale.value)
  itemsStore.loadItems(riotLocale.value)
  runesStore.loadRunes(riotLocale.value)
  summonerSpellsStore.loadSummonerSpells(riotLocale.value)
  loadOverviewSides()
  loadTierList()
})
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

/* Fast Stats cards - style LeagueOfGraphs */
.fast-stat-card {
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
  overflow: hidden;
}
.fast-stat-card-objectives {
  width: fit-content !important;
  min-width: 0;
  max-width: 100%;
  height: auto;
  min-height: 0;
  flex: 1 1 100%;
  overflow: visible;
}
.fast-stat-title {
  line-height: 1.4;
  color: rgb(252 211 77) !important;
}
.fast-stat-table {
  border-collapse: collapse;
}
.fast-stat-row {
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.1);
}
.fast-stat-row:last-child {
  border-bottom: none;
}
.fast-stat-bar-container {
  flex-shrink: 0;
  min-width: 32px !important;
  max-width: 54px !important;
  margin-right: 5px;
}
.fast-stat-button {
  font-weight: 500;
}

.overview-match-outcome-bagel {
  padding: 6px;
  box-shadow:
    inset 0 0 0 1px rgb(var(--rgb-primary) / 0.28),
    0 0 18px rgb(var(--rgb-primary) / 0.14);
}

.overview-match-outcome-bagel > div {
  background: rgb(var(--rgb-surface) / 0.95);
  box-shadow: inset 0 0 0 1px rgb(var(--rgb-primary) / 0.22);
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
