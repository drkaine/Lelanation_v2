<template>
  <div class="statistics flex min-h-screen flex-col text-text">
    <!-- Burger pour ouvrir les filtres (mobile) -->
    <button
      v-show="!isTierListTab"
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
      v-show="effectiveFiltersOpen && !isTierListTab"
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
        v-show="!isTierListTab"
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
          effectiveFiltersOpen
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
            v-show="!isTierListTab"
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
              <div v-else-if="overviewData" class="space-y-[10px]">
                <!-- Fast Stats encarts (style LeagueOfGraphs avec nos couleurs) -->
                <div
                  class="flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[10px] pb-[10px]"
                >
                  <!-- Champions les plus choisis -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                          >
                            {{ t('statisticsPage.tooltipFastStatsMostPicked') }}
                          </span>
                        </span>
                      </span>
                    </h3>
                    <table
                      v-if="overviewTopPickrateChampionsFiltered.length"
                      class="fast-stat-table w-full text-xs"
                    >
                      <tbody>
                        <tr
                          v-for="(row, idx) in overviewTopPickrateChampionsFiltered"
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
                                            ...overviewTopPickrateChampionsFiltered.map(
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
                      v-if="overviewTopPickrateChampionsFiltered.length"
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
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
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
                          v-for="(row, idx) in overviewEffectiveTopWinrateChampions"
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
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
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
                          v-for="(row, idx) in overviewEffectiveTopBanrateChampions"
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
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                      <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                        <span>
                          {{
                            progressionFromVersion
                              ? t('statisticsPage.fastStatsWinrateSince', {
                                  version: progressionFromVersion ?? undefined,
                                })
                              : t('statisticsPage.fastStatsWinrateProgression')
                          }}
                        </span>
                        <span
                          class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                          >
                            {{ t('statisticsPage.tooltipFastStatsWinrateSince') }}
                          </span>
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
                              <div class="min-w-0 max-w-[6.5rem] shrink-0">
                                <div class="truncate font-medium leading-tight text-text">
                                  {{ championName(row.championId) || row.championId }}
                                </div>
                                <div
                                  class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                                >
                                  {{ Number(row.wrOldest).toFixed(1) }}% →
                                  {{ Number(row.wrSince).toFixed(1) }}%
                                </div>
                              </div>
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
                    <div v-if="overviewTopWinrateSince.length" class="mt-1 text-center">
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('blueWinrate')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Pickrate depuis X -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                      <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                        <span>{{
                          t('statisticsPage.fastStatsPickrateSinceTitle', {
                            version: progressionFromVersion || '—',
                          })
                        }}</span>
                        <span
                          class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                          >
                            {{ t('statisticsPage.tooltipFastStatsPickrateSince') }}
                          </span>
                        </span>
                      </span>
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
                              <div class="min-w-0 max-w-[6.5rem] shrink-0">
                                <div class="truncate font-medium leading-tight text-text">
                                  {{ championName(row.championId) || row.championId }}
                                </div>
                                <div
                                  class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                                >
                                  {{ Number(row.pickrateOldest).toFixed(1) }}% →
                                  {{ Number(row.pickrateSince).toFixed(1) }}%
                                </div>
                              </div>
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
                    <div v-if="overviewTopPickrateSince.length" class="mt-1 text-center">
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('bluePickrate')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Banrate depuis X -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                      <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                        <span>{{
                          t('statisticsPage.fastStatsBanrateSinceTitle', {
                            version: progressionFromVersion || '—',
                          })
                        }}</span>
                        <span
                          class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                          >
                            {{ t('statisticsPage.tooltipFastStatsBanrateSince') }}
                          </span>
                        </span>
                      </span>
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
                              <div class="min-w-0 max-w-[6.5rem] shrink-0">
                                <div class="truncate font-medium leading-tight text-text">
                                  {{ championName(row.championId) || row.championId }}
                                </div>
                                <div
                                  class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                                >
                                  {{ Number(row.banrateOldest).toFixed(1) }}% →
                                  {{ Number(row.banrateSince).toFixed(1) }}%
                                </div>
                              </div>
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
                    <div v-if="overviewTopBanrateSince.length" class="mt-1 text-center">
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('blueBanrate')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Winrate depuis X (baisse) -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                      <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                        <span>{{
                          t('statisticsPage.fastStatsWinrateSinceDownTitle', {
                            version: progressionFromVersion || '—',
                          })
                        }}</span>
                        <span
                          class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                          >
                            {{ t('statisticsPage.tooltipFastStatsWinrateSinceDown') }}
                          </span>
                        </span>
                      </span>
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
                              <div class="min-w-0 max-w-[6.5rem] shrink-0">
                                <div class="truncate font-medium leading-tight text-text">
                                  {{ championName(row.championId) || row.championId }}
                                </div>
                                <div
                                  class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                                >
                                  {{ Number(row.wrOldest).toFixed(1) }}% →
                                  {{ Number(row.wrSince).toFixed(1) }}%
                                </div>
                              </div>
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
                    <div v-if="overviewBottomWinrateSince.length" class="mt-1 text-center">
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('blueWinrate', 'asc')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Pickrate depuis X (baisse) -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                      <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                        <span>{{
                          t('statisticsPage.fastStatsPickrateSinceDownTitle', {
                            version: progressionFromVersion || '—',
                          })
                        }}</span>
                        <span
                          class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                          >
                            {{ t('statisticsPage.tooltipFastStatsPickrateSinceDown') }}
                          </span>
                        </span>
                      </span>
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
                              <div class="min-w-0 max-w-[6.5rem] shrink-0">
                                <div class="truncate font-medium leading-tight text-text">
                                  {{ championName(row.championId) || row.championId }}
                                </div>
                                <div
                                  class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                                >
                                  {{ Number(row.pickrateOldest).toFixed(1) }}% →
                                  {{ Number(row.pickrateSince).toFixed(1) }}%
                                </div>
                              </div>
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
                    <div v-if="overviewBottomPickrateSince.length" class="mt-1 text-center">
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('bluePickrate', 'asc')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Banrate depuis X (baisse) -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                      <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                        <span>{{
                          t('statisticsPage.fastStatsBanrateSinceDownTitle', {
                            version: progressionFromVersion || '—',
                          })
                        }}</span>
                        <span
                          class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                          >
                            {{ t('statisticsPage.tooltipFastStatsBanrateSinceDown') }}
                          </span>
                        </span>
                      </span>
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
                              <div class="min-w-0 max-w-[6.5rem] shrink-0">
                                <div class="truncate font-medium leading-tight text-text">
                                  {{ championName(row.championId) || row.championId }}
                                </div>
                                <div
                                  class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                                >
                                  {{ Number(row.banrateOldest).toFixed(1) }}% →
                                  {{ Number(row.banrateSince).toFixed(1) }}%
                                </div>
                              </div>
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
                    <div v-if="overviewBottomBanrateSince.length" class="mt-1 text-center">
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('blueBanrate', 'asc')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Répartition des parties (global uniquement) — donut SVG comme Solo/Duo -->
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-2 flex items-center justify-between gap-2 text-sm font-semibold"
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
                    <div
                      v-if="overviewAbandonsPending || overviewPending"
                      class="py-3 text-center text-text/60"
                    >
                      {{ t('statisticsPage.loading') }}
                    </div>
                    <div
                      v-else-if="overviewMatchOutcomeTotal > 0"
                      class="flex flex-col items-center gap-3 sm:flex-row sm:items-center"
                    >
                      <StatisticsMatchOutcomeDonut
                        :total="overviewMatchOutcomeTotal"
                        :early="overviewEarlySurrenderCount"
                        :surrender-only="overviewSurrenderOnlyCount"
                        :played="overviewPlayedCount"
                      />
                      <div class="min-w-0 space-y-1 text-xs">
                        <div class="font-medium text-text">
                          Total: {{ overviewMatchOutcomeTotal.toLocaleString() }}
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span
                            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300"
                          />
                          Early surrender: {{ overviewEarlySurrenderCount.toLocaleString() }} ({{
                            overviewEarlySurrenderPct.toFixed(2)
                          }}%)
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span
                            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-100"
                          />
                          Surrender: {{ overviewSurrenderOnlyCount.toLocaleString() }} ({{
                            overviewSurrenderOnlyPct.toFixed(2)
                          }}%)
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span
                            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400"
                          />
                          Jouees: {{ overviewPlayedCount.toLocaleString() }} ({{
                            overviewPlayedPct.toFixed(2)
                          }}%)
                        </div>
                      </div>
                    </div>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.overviewNoData') }}
                    </div>
                    <div v-if="overviewMatchOutcomeTotal > 0" class="mt-2 text-center">
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('totalGames')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Bans par équipe gagnante -->
                  <div
                    v-if="overviewTeamsData && overviewTeamsData.matchCount > 0"
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('blueBanrate')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>

                  <!-- Bans par équipe perdante -->
                  <div
                    v-if="overviewTeamsData && overviewTeamsData.matchCount > 0"
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
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
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('redBanrate')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>
                  <div
                    v-if="overviewTeamsData && overviewTeamsData.matchCount > 0"
                    class="fast-stat-card fast-stat-card-objectives w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
                  >
                    <div class="mb-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        class="shrink-0 text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('overview.objectives')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('overview.objectives')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'overview.objectives',
                            t('statisticsPage.overviewTeamsObjectives')
                          )
                        "
                      >
                        {{ cardIsFavorite('overview.objectives') ? '★' : '☆' }}
                      </button>
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
                        class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                        :aria-label="t('statisticsPage.tooltipOverviewObjectives')"
                      >
                        ⓘ
                        <span
                          role="tooltip"
                          class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                        >
                          {{ t('statisticsPage.tooltipOverviewObjectives') }}
                        </span>
                      </span>
                    </div>
                    <p class="mb-3 text-xs text-text/60">
                      {{ t('statisticsPage.overviewTeamsFirstByTeam') }}
                    </p>
                    <div
                      v-if="objectivesPanelTab === 'objectives'"
                      class="w-full min-w-0 overflow-x-auto"
                    >
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
                                    @error="onObjectiveIconError($event, key)"
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
                    <div
                      v-else-if="objectivesPanelTab === 'drakeTypes'"
                      class="w-full min-w-0 overflow-x-auto"
                    >
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
                                  @error="onDrakeIconError($event, row.key)"
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
                    <div v-else class="w-full min-w-0 overflow-x-auto">
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
                                    @error="onDrakeIconError($event, row.key)"
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
                  @click="retryOverviewDetail()"
                >
                  {{ t('statisticsPage.retry') }}
                </button>
              </div>
              <template v-if="!overviewDetailError">
                <div
                  v-if="overviewDetailPending && !overviewDetailData"
                  class="rounded-lg py-8 text-center text-text/70"
                >
                  {{ t('statisticsPage.loading') }}
                </div>
                <StatisticsRunesOverviewPanel
                  v-else-if="overviewDetailData"
                  :game-version="gameVersion || versionStore.currentVersion || ''"
                  :data="overviewDetailData"
                  :baseline="overviewDetailBaselineData"
                  :baseline-pending="overviewDetailBaselinePending"
                  :comparison-version="progressionFromVersion"
                />
                <div
                  v-else
                  class="statistics-overview-surface rounded-lg border border-primary/30 p-6"
                >
                  <div class="py-4 text-text/70">
                    {{ t('statisticsPage.overviewDetailNoData') }}
                  </div>
                </div>
              </template>
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
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
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
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
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

          <!-- Tab: Par côté — fast-stats comme vue d’ensemble -->
          <div v-show="activeTab === 'team'" class="space-y-6">
            <div class="rounded-lg">
              <div v-if="overviewSidesPending" class="text-text/70">
                {{ t('statisticsPage.loading') }}
              </div>
              <div v-else-if="overviewSidesData" class="space-y-[10px]">
                <div
                  class="flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[10px] pb-[10px]"
                >
                  <div
                    class="fast-stat-card flex w-full max-w-full flex-col items-center rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3
                      class="fast-stat-title mb-2 flex w-full items-center gap-2 text-sm font-semibold lg:text-left"
                    >
                      <button
                        type="button"
                        class="shrink-0 text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('team.sideWinrateDonut')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('team.sideWinrateDonut')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'team.sideWinrateDonut',
                            t('statisticsPage.sidesDonutTitleSoloDuo')
                          )
                        "
                      >
                        {{ cardIsFavorite('team.sideWinrateDonut') ? '★' : '☆' }}
                      </button>
                      <span class="inline-flex flex-1 flex-wrap items-center">
                        {{ t('statisticsPage.sidesDonutTitleSoloDuo') }}
                        <span
                          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover fast-stat-tooltip-popover--start hidden group-hover/stat-tip:block"
                          >
                            {{ t('statisticsPage.sidesWinrateShareNote') }}
                          </span>
                        </span>
                      </span>
                    </h3>
                    <div
                      class="pie-chart-2 relative inline-flex h-[150px] w-[150px] shrink-0 items-center justify-center"
                    >
                      <svg class="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                        <circle
                          cx="60"
                          cy="60"
                          r="48"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="14"
                          stroke-linecap="butt"
                          class="text-surface/50 dark:text-surface/40"
                          :stroke-dasharray="
                            sidesDonutCircumference + ' ' + sidesDonutCircumference
                          "
                          stroke-dashoffset="0"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="48"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="14"
                          stroke-linecap="butt"
                          class="text-sky-500 dark:text-sky-400"
                          :stroke-dasharray="sidesDonutBlueDash + ' ' + sidesDonutCircumference"
                          stroke-dashoffset="0"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="48"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="14"
                          stroke-linecap="butt"
                          class="text-rose-500 dark:text-rose-400"
                          :stroke-dasharray="sidesDonutRedDash + ' ' + sidesDonutCircumference"
                          :stroke-dashoffset="-sidesDonutBlueDash"
                        />
                      </svg>
                      <div class="relative z-10 flex flex-col items-center text-center">
                        <span class="block text-xl font-bold text-sky-600 dark:text-sky-300">
                          {{ sidesDonutBluePct }}%
                        </span>
                        <span class="block text-lg font-medium text-rose-600 dark:text-rose-300">
                          {{ sidesDonutRedPct }}%
                        </span>
                      </div>
                    </div>
                    <div class="mt-2 w-full text-center">
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('totalGames')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
                      <button
                        type="button"
                        class="shrink-0 text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('team.blueMatchOutcome')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('team.blueMatchOutcome')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'team.blueMatchOutcome',
                            `${t('statisticsPage.sidesBlue')} — ${t('statisticsPage.overviewMatchOutcomesTitle')}`
                          )
                        "
                      >
                        {{ cardIsFavorite('team.blueMatchOutcome') ? '★' : '☆' }}
                      </button>
                      <span class="inline-flex flex-1 flex-wrap items-center">
                        {{ t('statisticsPage.sidesBlue') }} —
                        {{ t('statisticsPage.overviewMatchOutcomesTitle') }}
                        <span
                          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                          >
                            {{ t('statisticsPage.tooltipSidesMatchOutcomeCard') }}
                          </span>
                        </span>
                      </span>
                    </h3>
                    <div
                      v-if="Number(sidesSurrenderBySide.blue.total) > 0"
                      class="flex flex-col items-center gap-3 sm:flex-row sm:items-center"
                    >
                      <StatisticsMatchOutcomeDonut
                        side-accent="blue"
                        :total="Number(sidesSurrenderBySide.blue.total)"
                        :early="Number(sidesSurrenderBySide.blue.earlySurrenderCount)"
                        :surrender-only="sidesBlueSurrenderOnlyCount"
                        :played="sidesBluePlayedCount"
                      />
                      <div class="min-w-0 space-y-1 text-xs">
                        <div class="font-medium text-text">
                          Total: {{ Number(sidesSurrenderBySide.blue.total).toLocaleString() }}
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span
                            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300"
                          />
                          Early surrender:
                          {{
                            Number(sidesSurrenderBySide.blue.earlySurrenderCount).toLocaleString()
                          }}
                          ({{
                            matchOutcomePct(
                              Number(sidesSurrenderBySide.blue.earlySurrenderCount),
                              Number(sidesSurrenderBySide.blue.total)
                            )
                          }}%)
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span
                            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-100"
                          />
                          Surrender: {{ sidesBlueSurrenderOnlyCount.toLocaleString() }} ({{
                            matchOutcomePct(
                              sidesBlueSurrenderOnlyCount,
                              Number(sidesSurrenderBySide.blue.total)
                            )
                          }}%)
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span
                            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400 dark:bg-sky-500"
                          />
                          Jouees: {{ sidesBluePlayedCount.toLocaleString() }} ({{
                            matchOutcomePct(
                              sidesBluePlayedCount,
                              Number(sidesSurrenderBySide.blue.total)
                            )
                          }}%)
                        </div>
                      </div>
                    </div>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.overviewNoData') }}
                    </div>
                    <div
                      v-if="Number(sidesSurrenderBySide.blue.total) > 0"
                      class="mt-2 text-center"
                    >
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('blueWinrate')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>
                  <div
                    class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
                  >
                    <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
                      <button
                        type="button"
                        class="shrink-0 text-base leading-none transition-colors"
                        :class="
                          cardIsFavorite('team.redMatchOutcome')
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'text-text/45 grayscale hover:text-text/75'
                        "
                        :title="
                          cardIsFavorite('team.redMatchOutcome')
                            ? 'Retirer des favoris'
                            : 'Ajouter aux favoris'
                        "
                        @click="
                          toggleFavoriteCard(
                            'team.redMatchOutcome',
                            `${t('statisticsPage.sidesRed')} — ${t('statisticsPage.overviewMatchOutcomesTitle')}`
                          )
                        "
                      >
                        {{ cardIsFavorite('team.redMatchOutcome') ? '★' : '☆' }}
                      </button>
                      <span class="inline-flex flex-1 flex-wrap items-center">
                        {{ t('statisticsPage.sidesRed') }} —
                        {{ t('statisticsPage.overviewMatchOutcomesTitle') }}
                        <span
                          class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                          aria-hidden="true"
                        >
                          ⓘ
                          <span
                            role="tooltip"
                            class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                          >
                            {{ t('statisticsPage.tooltipSidesMatchOutcomeCard') }}
                          </span>
                        </span>
                      </span>
                    </h3>
                    <div
                      v-if="Number(sidesSurrenderBySide.red.total) > 0"
                      class="flex flex-col items-center gap-3 sm:flex-row sm:items-center"
                    >
                      <StatisticsMatchOutcomeDonut
                        side-accent="red"
                        :total="Number(sidesSurrenderBySide.red.total)"
                        :early="Number(sidesSurrenderBySide.red.earlySurrenderCount)"
                        :surrender-only="sidesRedSurrenderOnlyCount"
                        :played="sidesRedPlayedCount"
                      />
                      <div class="min-w-0 space-y-1 text-xs">
                        <div class="font-medium text-text">
                          Total: {{ Number(sidesSurrenderBySide.red.total).toLocaleString() }}
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span
                            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300"
                          />
                          Early surrender:
                          {{
                            Number(sidesSurrenderBySide.red.earlySurrenderCount).toLocaleString()
                          }}
                          ({{
                            matchOutcomePct(
                              Number(sidesSurrenderBySide.red.earlySurrenderCount),
                              Number(sidesSurrenderBySide.red.total)
                            )
                          }}%)
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span
                            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-100"
                          />
                          Surrender: {{ sidesRedSurrenderOnlyCount.toLocaleString() }} ({{
                            matchOutcomePct(
                              sidesRedSurrenderOnlyCount,
                              Number(sidesSurrenderBySide.red.total)
                            )
                          }}%)
                        </div>
                        <div class="flex items-center gap-2 text-text/85">
                          <span
                            class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400 dark:bg-rose-500"
                          />
                          Jouees: {{ sidesRedPlayedCount.toLocaleString() }} ({{
                            matchOutcomePct(
                              sidesRedPlayedCount,
                              Number(sidesSurrenderBySide.red.total)
                            )
                          }}%)
                        </div>
                      </div>
                    </div>
                    <div v-else class="py-3 text-center text-text/60">
                      {{ t('statisticsPage.overviewNoData') }}
                    </div>
                    <div v-if="Number(sidesSurrenderBySide.red.total) > 0" class="mt-2 text-center">
                      <button
                        type="button"
                        class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                        @click="goToChampionTableWithSort('redWinrate')"
                      >
                        {{ t('statisticsPage.fastStatsSeeMore') }}
                      </button>
                    </div>
                  </div>
                  <StatisticsTeamSideFastStatTable
                    side="blue"
                    favorite-card-id="team.blueMostPicked"
                    :title="`${t('statisticsPage.sidesBlue')} — ${t('statisticsPage.fastStatsMostPicked')}`"
                    :tooltip="t('statisticsPage.tooltipFastStatsMostPicked')"
                    variant="pick"
                    :rows="sidesBlueMostPickedRows"
                    @see-more="() => goToChampionTableWithSort('bluePickrate')"
                  />
                  <StatisticsTeamSideFastStatTable
                    side="red"
                    favorite-card-id="team.redMostPicked"
                    :title="`${t('statisticsPage.sidesRed')} — ${t('statisticsPage.fastStatsMostPicked')}`"
                    :tooltip="t('statisticsPage.tooltipFastStatsMostPicked')"
                    variant="pick"
                    :rows="sidesRedMostPickedRows"
                    @see-more="() => goToChampionTableWithSort('redPickrate')"
                  />
                  <StatisticsTeamSideFastStatTable
                    side="blue"
                    favorite-card-id="team.blueBestWinrate"
                    :title="`${t('statisticsPage.sidesBlue')} — ${t('statisticsPage.fastStatsBestWinrate')}`"
                    :tooltip="t('statisticsPage.tooltipFastStatsBestWinrate')"
                    variant="wr"
                    :rows="sidesBlueBestWinrateRows"
                    @see-more="() => goToChampionTableWithSort('blueWinrate')"
                  />
                  <StatisticsTeamSideFastStatTable
                    side="red"
                    favorite-card-id="team.redBestWinrate"
                    :title="`${t('statisticsPage.sidesRed')} — ${t('statisticsPage.fastStatsBestWinrate')}`"
                    :tooltip="t('statisticsPage.tooltipFastStatsBestWinrate')"
                    variant="wr"
                    :rows="sidesRedBestWinrateRows"
                    @see-more="() => goToChampionTableWithSort('redWinrate')"
                  />
                  <StatisticsTeamSideFastStatTable
                    side="blue"
                    favorite-card-id="team.blueBansBySide"
                    :title="`${t('statisticsPage.sidesBlue')} — ${t('statisticsPage.sidesBansBySide')}`"
                    :tooltip="t('statisticsPage.tooltipSidesBansBySide')"
                    variant="ban"
                    :rows="sidesBlueBanRows"
                    @see-more="() => goToChampionTableWithSort('blueBanrate')"
                  />
                  <StatisticsTeamSideFastStatTable
                    side="red"
                    favorite-card-id="team.redBansBySide"
                    :title="`${t('statisticsPage.sidesRed')} — ${t('statisticsPage.sidesBansBySide')}`"
                    :tooltip="t('statisticsPage.tooltipSidesBansBySide')"
                    variant="ban"
                    :rows="sidesRedBanRows"
                    @see-more="() => goToChampionTableWithSort('redBanrate')"
                  />
                  <template v-if="progressionFromVersion">
                    <StatisticsTeamSideFastStatTable
                      side="blue"
                      favorite-card-id="team.blueWinrateSince"
                      :title="`${t('statisticsPage.sidesBlue')} — ${t('statisticsPage.fastStatsWinrateSince', { version: progressionFromVersion })}`"
                      :tooltip="t('statisticsPage.tooltipFastStatsWinrateSince')"
                      variant="dWr"
                      :rows="sidesBlueTopWinrateSince"
                      @see-more="() => goToChampionTableWithSort('blueWinrate')"
                    />
                    <StatisticsTeamSideFastStatTable
                      side="red"
                      favorite-card-id="team.redWinrateSince"
                      :title="`${t('statisticsPage.sidesRed')} — ${t('statisticsPage.fastStatsWinrateSince', { version: progressionFromVersion })}`"
                      :tooltip="t('statisticsPage.tooltipFastStatsWinrateSince')"
                      variant="dWr"
                      :rows="sidesRedTopWinrateSince"
                      @see-more="() => goToChampionTableWithSort('redWinrate')"
                    />
                    <StatisticsTeamSideFastStatTable
                      side="blue"
                      favorite-card-id="team.bluePickrateSince"
                      :title="`${t('statisticsPage.sidesBlue')} — ${t('statisticsPage.fastStatsPickrateSinceTitle', { version: progressionFromVersion })}`"
                      :tooltip="t('statisticsPage.tooltipFastStatsPickrateSince')"
                      variant="dPick"
                      :rows="sidesBlueTopPickrateSince"
                      @see-more="() => goToChampionTableWithSort('bluePickrate')"
                    />
                    <StatisticsTeamSideFastStatTable
                      side="red"
                      favorite-card-id="team.redPickrateSince"
                      :title="`${t('statisticsPage.sidesRed')} — ${t('statisticsPage.fastStatsPickrateSinceTitle', { version: progressionFromVersion })}`"
                      :tooltip="t('statisticsPage.tooltipFastStatsPickrateSince')"
                      variant="dPick"
                      :rows="sidesRedTopPickrateSince"
                      @see-more="() => goToChampionTableWithSort('redPickrate')"
                    />
                    <StatisticsTeamSideFastStatTable
                      side="blue"
                      favorite-card-id="team.blueBanrateSince"
                      :title="`${t('statisticsPage.sidesBlue')} — ${t('statisticsPage.fastStatsBanrateSinceTitle', { version: progressionFromVersion })}`"
                      :tooltip="t('statisticsPage.tooltipFastStatsBanrateSince')"
                      variant="dBan"
                      :rows="sidesBlueTopBanrateSince"
                      @see-more="() => goToChampionTableWithSort('blueBanrate')"
                    />
                    <StatisticsTeamSideFastStatTable
                      side="red"
                      favorite-card-id="team.redBanrateSince"
                      :title="`${t('statisticsPage.sidesRed')} — ${t('statisticsPage.fastStatsBanrateSinceTitle', { version: progressionFromVersion })}`"
                      :tooltip="t('statisticsPage.tooltipFastStatsBanrateSince')"
                      variant="dBan"
                      :rows="sidesRedTopBanrateSince"
                      @see-more="() => goToChampionTableWithSort('redBanrate')"
                    />
                  </template>
                </div>

                <div
                  v-if="overviewSidesData && overviewSidesData.matchCount > 0"
                  class="fast-stat-card fast-stat-card-objectives w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
                >
                  <div class="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="shrink-0 text-base leading-none transition-colors"
                      :class="
                        cardIsFavorite('team.objectives')
                          ? 'text-amber-300 hover:text-amber-200'
                          : 'text-text/45 grayscale hover:text-text/75'
                      "
                      :title="
                        cardIsFavorite('team.objectives')
                          ? 'Retirer des favoris'
                          : 'Ajouter aux favoris'
                      "
                      @click="
                        toggleFavoriteCard(
                          'team.objectives',
                          `${t('statisticsPage.tabTeam')} — ${t('statisticsPage.sidesObjectivesBySide')}`
                        )
                      "
                    >
                      {{ cardIsFavorite('team.objectives') ? '★' : '☆' }}
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-1 text-xs font-semibold transition-colors"
                      :class="
                        objectivesSidesPanelTab === 'objectives'
                          ? 'bg-accent text-background'
                          : 'bg-black/20 text-text/80 hover:bg-white/10'
                      "
                      @click="objectivesSidesPanelTab = 'objectives'"
                    >
                      {{ t('statisticsPage.objectivesTabMain') }}
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-1 text-xs font-semibold transition-colors"
                      :class="
                        objectivesSidesPanelTab === 'drakeTypes'
                          ? 'bg-accent text-background'
                          : 'bg-black/20 text-text/80 hover:bg-white/10'
                      "
                      @click="objectivesSidesPanelTab = 'drakeTypes'"
                    >
                      {{ t('statisticsPage.objectivesTabDrakeTypes') }}
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-1 text-xs font-semibold transition-colors"
                      :class="
                        objectivesSidesPanelTab === 'drakeSouls'
                          ? 'bg-accent text-background'
                          : 'bg-black/20 text-text/80 hover:bg-white/10'
                      "
                      @click="objectivesSidesPanelTab = 'drakeSouls'"
                    >
                      {{ t('statisticsPage.objectivesTabSouls') }}
                    </button>
                    <span
                      class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
                      :aria-label="t('statisticsPage.tooltipSidesObjectives')"
                    >
                      ⓘ
                      <span
                        role="tooltip"
                        class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                      >
                        {{ t('statisticsPage.tooltipSidesObjectives') }}
                      </span>
                    </span>
                  </div>
                  <div
                    v-if="objectivesSidesPanelTab === 'objectives'"
                    class="w-full min-w-0 overflow-x-auto"
                  >
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
                                  @error="onObjectiveIconError($event, key)"
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
                  <div
                    v-else-if="objectivesSidesPanelTab === 'drakeTypes'"
                    class="w-full min-w-0 overflow-x-auto"
                  >
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
                        <tr v-for="row in sidesDrakeTypeRows" :key="'sdt-' + row.key">
                          <td class="py-1.5 pr-2 font-medium text-text/90">
                            <div class="flex items-center gap-2">
                              <img
                                v-if="drakeIconSrc(row.key)"
                                :src="drakeIconSrc(row.key)"
                                :alt="row.label"
                                class="h-4 w-4 object-contain"
                                loading="lazy"
                                decoding="async"
                                @error="onDrakeIconError($event, row.key)"
                              />
                              <span>{{ row.label }}</span>
                            </div>
                          </td>
                          <td class="py-1.5 pr-2 text-center">
                            {{ teamPercent(row.byBlue, overviewSidesData.matchCount) }}
                          </td>
                          <td class="py-1.5 text-center">
                            {{ teamPercent(row.byRed, overviewSidesData.matchCount) }}
                          </td>
                        </tr>
                        <tr v-if="sidesDrakeTypeRows.length === 0">
                          <td colspan="3" class="py-2 text-center text-text/60">
                            {{ t('statisticsPage.noData') }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="w-full min-w-0 overflow-x-auto">
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
                          <td class="py-1.5 pr-2 font-medium text-text/90">
                            {{ t('statisticsPage.objectivesSoulGlobal') }}
                          </td>
                          <td class="py-1.5 pr-2 text-center">
                            {{
                              teamPercent(sidesDrakeSoulGlobal.byBlue, overviewSidesData.matchCount)
                            }}
                          </td>
                          <td class="py-1.5 text-center">
                            {{
                              teamPercent(sidesDrakeSoulGlobal.byRed, overviewSidesData.matchCount)
                            }}
                          </td>
                        </tr>
                        <template v-for="row in sidesDrakeSoulRows" :key="'sds-' + row.key">
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
                                  @error="onDrakeIconError($event, row.key)"
                                />
                                <span>{{ row.label }}</span>
                              </div>
                            </td>
                            <td class="py-1.5 pr-2 text-center">
                              {{ teamPercent(row.byBlue, overviewSidesData.matchCount) }}
                            </td>
                            <td class="py-1.5 text-center">
                              {{ teamPercent(row.byRed, overviewSidesData.matchCount) }}
                            </td>
                          </tr>
                        </template>
                        <tr v-if="sidesDrakeSoulRows.length === 0">
                          <td colspan="3" class="py-2 text-center text-text/60">
                            {{ t('statisticsPage.noData') }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
            <div v-else class="space-y-3">
              <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div class="rounded-lg border border-primary/30 bg-surface/30 p-3">
                  <div class="text-xs text-text/70">
                    {{ t('statisticsPage.overviewTotalMatches') }}
                  </div>
                  <div class="text-lg font-semibold text-text">
                    {{ overviewData?.totalMatches?.toLocaleString() ?? '—' }}
                  </div>
                </div>
                <div class="rounded-lg border border-primary/30 bg-surface/30 p-3">
                  <div class="text-xs text-text/70">
                    {{ t('statisticsPage.overviewPlayerCountDistinct') }}
                  </div>
                  <div class="text-lg font-semibold text-text">
                    {{ overviewData?.playerCount?.toLocaleString() ?? '—' }}
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div class="rounded-lg border border-primary/30 bg-surface/30 p-3">
                  <div class="mb-2 text-sm font-semibold text-text">
                    {{ t('statisticsPage.overviewFilterByVersion') }}
                  </div>
                  <div class="mb-2 text-xs text-text/70">
                    {{
                      statsVersionFilter
                        ? `${statsVersionFilter} (${versionMatchCount(statsVersionFilter).toLocaleString()} ${t('statisticsPage.games')})`
                        : t('statisticsPage.overviewVersionAll')
                    }}
                  </div>
                  <div class="max-h-40 overflow-y-auto text-xs text-text/85">
                    <div
                      v-for="v in statsVersionOptions"
                      :key="'infos-version-' + v.version"
                      class="flex items-center justify-between border-b border-primary/10 py-1 last:border-b-0"
                    >
                      <span>{{ v.version }}</span>
                      <span>{{ Number(v.matchCount || 0).toLocaleString() }}</span>
                    </div>
                  </div>
                </div>

                <div class="rounded-lg border border-primary/30 bg-surface/30 p-3">
                  <div class="mb-2 text-sm font-semibold text-text">
                    {{ t('statisticsPage.progressionsReferenceVersion') }}
                  </div>
                  <div class="mb-2 text-xs text-text/70">
                    {{
                      progressionFromVersion
                        ? `${progressionFromVersion} (${versionMatchCount(progressionFromVersion).toLocaleString()} ${t('statisticsPage.games')})`
                        : '—'
                    }}
                  </div>
                  <div class="max-h-40 overflow-y-auto text-xs text-text/85">
                    <div
                      v-for="v in progressionSelectableVersions"
                      :key="'infos-delta-version-' + v.version"
                      class="flex items-center justify-between border-b border-primary/10 py-1 last:border-b-0"
                    >
                      <span>{{ v.version }}</span>
                      <span>{{ Number(v.matchCount || 0).toLocaleString() }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="rounded-lg border border-primary/30 bg-surface/30 p-3">
                <div class="mb-2 text-sm font-semibold text-text">
                  {{ t('statisticsPage.overviewNumberByDivision') }}
                </div>
                <div class="mb-2 text-xs text-text/70">
                  {{ t('statisticsPage.overviewFilterByVersion') }}:
                  {{ statsVersionFilter || t('statisticsPage.overviewVersionAll') }}
                </div>
                <div class="grid grid-cols-2 gap-1 text-xs md:grid-cols-3 lg:grid-cols-5">
                  <div
                    v-for="d in infosMatchesByDivision"
                    :key="'infos-division-' + d.rankTier"
                    class="rounded border border-primary/20 bg-background/30 px-2 py-1"
                  >
                    <div class="font-medium text-text">{{ formatDivisionLabel(d.rankTier) }}</div>
                    <div class="text-text/80">{{ Number(d.matchCount || 0).toLocaleString() }}</div>
                  </div>
                </div>
              </div>

              <div class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30">
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
          </div>

          <!-- Tab: Bans -->
          <div v-show="activeTab === 'bans'" class="space-y-2">
            <p class="text-sm text-text/75">
              {{ t('statisticsPage.bansTableIntro') }}
            </p>
            <div v-if="bansPending" class="text-text/70">
              {{ t('statisticsPage.loading') }}
            </div>
            <div
              v-else-if="bansError"
              class="rounded border border-error bg-surface p-3 text-error"
            >
              {{ bansError }}
            </div>
            <div
              v-else-if="bansTableData?.message && !bansTableData?.rows?.length"
              class="text-text/70"
            >
              {{ bansTableData.message }}
            </div>
            <div v-else class="space-y-3">
              <div
                class="rounded-lg border border-primary/30 bg-surface/30 p-3 text-sm text-text/85"
              >
                {{
                  t('statisticsPage.bansMatchCount', {
                    count: (bansTableData?.matchCount ?? 0).toLocaleString(),
                  })
                }}
                <span v-if="statsVersionFilter" class="ml-2 text-text/70">
                  · {{ statsVersionFilter }}
                </span>
              </div>
              <div class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30">
                <table class="w-full min-w-[520px] text-left text-sm">
                  <thead class="border-b border-primary/30 bg-surface/50">
                    <tr>
                      <th class="px-3 py-1.5 font-semibold text-text">
                        {{ t('statisticsPage.champion') }}
                      </th>
                      <th
                        class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                        @click="setBansSort('total')"
                      >
                        {{ t('statisticsPage.bansColTotal') }}{{ bansSortHint('total') }}
                      </th>
                      <th
                        class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                        @click="setBansSort('rate')"
                      >
                        {{ t('statisticsPage.bansColRate') }}{{ bansSortHint('rate') }}
                      </th>
                      <th
                        class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                        @click="setBansSort('blue')"
                      >
                        {{ t('statisticsPage.bansColBlue') }}{{ bansSortHint('blue') }}
                      </th>
                      <th
                        class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                        @click="setBansSort('red')"
                      >
                        {{ t('statisticsPage.bansColRed') }}{{ bansSortHint('red') }}
                      </th>
                      <th
                        v-if="showBansRoleColumns"
                        class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                        @click="setBansSort('top')"
                      >
                        {{ t('statisticsPage.bansColTop') }}{{ bansSortHint('top') }}
                      </th>
                      <th
                        v-if="showBansRoleColumns"
                        class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                        @click="setBansSort('jungle')"
                      >
                        {{ t('statisticsPage.bansColJungle') }}{{ bansSortHint('jungle') }}
                      </th>
                      <th
                        v-if="showBansRoleColumns"
                        class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                        @click="setBansSort('middle')"
                      >
                        {{ t('statisticsPage.bansColMiddle') }}{{ bansSortHint('middle') }}
                      </th>
                      <th
                        v-if="showBansRoleColumns"
                        class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                        @click="setBansSort('bottom')"
                      >
                        {{ t('statisticsPage.bansColBottom') }}{{ bansSortHint('bottom') }}
                      </th>
                      <th
                        v-if="showBansRoleColumns"
                        class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                        @click="setBansSort('support')"
                      >
                        {{ t('statisticsPage.bansColSupport') }}{{ bansSortHint('support') }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-primary/20">
                    <tr
                      v-for="row in paginatedBans"
                      :key="'ban-' + row.championId"
                      class="cursor-pointer hover:bg-surface/50"
                      @click="navigateTo(localePath('/statistics/champion/' + row.championId))"
                    >
                      <td class="px-3 py-1 font-medium text-text">
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
                      <td class="px-3 py-1 tabular-nums text-text/90">{{ row.bansTotal }}</td>
                      <td class="px-3 py-1 tabular-nums text-text/90">
                        {{ banRateForBansRow(row, bansTableData?.matchCount ?? 0).toFixed(2) }}%
                      </td>
                      <td class="px-3 py-1 tabular-nums text-text/90">{{ row.bansBlue }}</td>
                      <td class="px-3 py-1 tabular-nums text-text/90">{{ row.bansRed }}</td>
                      <td v-if="showBansRoleColumns" class="px-3 py-1 tabular-nums text-text/90">
                        {{ row.bansTop }}
                      </td>
                      <td v-if="showBansRoleColumns" class="px-3 py-1 tabular-nums text-text/90">
                        {{ row.bansJungle }}
                      </td>
                      <td v-if="showBansRoleColumns" class="px-3 py-1 tabular-nums text-text/90">
                        {{ row.bansMiddle }}
                      </td>
                      <td v-if="showBansRoleColumns" class="px-3 py-1 tabular-nums text-text/90">
                        {{ row.bansBottom }}
                      </td>
                      <td v-if="showBansRoleColumns" class="px-3 py-1 tabular-nums text-text/90">
                        {{ row.bansSupport }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div
                  v-if="totalBansCount > 0"
                  class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-3 py-1 text-sm text-text/80"
                >
                  <span v-if="championSearchQuery">
                    {{ t('statisticsPage.showing') }} {{ totalBansCount }}
                  </span>
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-1.5">
                      <span class="text-text/70">{{ t('statisticsPage.perPage') }}</span>
                      <select
                        v-model.number="championsPageSize"
                        class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                      >
                        <option v-for="n in PAGE_SIZE_OPTIONS" :key="'bans-ps-' + n" :value="n">
                          {{ n }}
                        </option>
                      </select>
                    </label>
                    <span class="text-text/70">
                      {{ (bansPage - 1) * championsPageSize + 1 }}-{{
                        Math.min(bansPage * championsPageSize, totalBansCount)
                      }}
                      / {{ totalBansCount }}
                    </span>
                    <div class="flex gap-1">
                      <button
                        type="button"
                        class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                        :disabled="bansPage <= 1"
                        @click="bansPage = Math.max(1, bansPage - 1)"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                        :disabled="bansPage >= totalBansPages"
                        @click="bansPage = Math.min(totalBansPages, bansPage + 1)"
                      >
                        ›
                      </button>
                    </div>
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
                class="statistics-overview-surface rounded-lg border border-primary/30 p-4 text-text/70"
              >
                {{ t('statisticsPage.tierListNoData') }}
              </div>
              <!-- Vue tableau (grille type LoLalytics, couleurs Lelanation) -->
              <div
                v-show="tierListViewModel === 'table' && totalTierListCount > 0"
                class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
              >
                <div class="tier-list-lolalytics w-full min-w-0 text-[13px]">
                  <div
                    class="tier-list-lolalytics-head sticky top-0 z-10 flex h-auto min-h-8 w-full items-stretch justify-between border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
                  >
                    <button
                      type="button"
                      class="tier-list-lolalytics-th tier-list-lolalytics-th-all hidden w-10 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap border-b border-t border-black text-center hover:bg-primary/25 md:flex"
                      :class="
                        tierListSortColumn === 'rank'
                          ? 'border-t-accent'
                          : 'border-t-[var(--color-grey-300)]'
                      "
                      @click="cycleTierListSort('rank')"
                    >
                      {{ t('statisticsPage.tierListRank') }}{{ tierListSortIcon('rank') }}
                    </button>
                    <div
                      class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-[220px] shrink-0 items-center justify-start border-b border-t border-black border-t-[var(--color-grey-300)] px-2"
                    >
                      {{ t('statisticsPage.tierListColChampion') }}
                    </div>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-10 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] hover:bg-primary/25"
                      :title="t('statisticsPage.tierListTierTooltip')"
                      @click="cycleTierListSort('tier')"
                    >
                      {{ t('statisticsPage.tierListTier') }}{{ tierListSortIcon('tier') }}
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-10 shrink-0 cursor-pointer flex-col items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[11px] leading-tight hover:bg-primary/25"
                      :title="t('statisticsPage.tierListMainRoleTooltip')"
                      @click="cycleTierListSort('mainRolePct')"
                    >
                      {{ t('statisticsPage.tierListColLane') }}{{ tierListSortIcon('mainRolePct') }}
                    </button>
                    <div
                      class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-12 shrink-0 flex-col justify-stretch border-b border-t border-black border-t-[var(--color-grey-300)] py-0.5"
                    >
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                        :title="t('statisticsPage.tierListWinrateTooltip')"
                        @click="cycleTierListSort('winrate')"
                      >
                        {{ t('statisticsPage.winrate') }}{{ tierListSortIcon('winrate') }}
                      </button>
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center border-t border-black/20 px-0.5 pt-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                        :title="t('statisticsPage.tierListPatchDeltaSortTooltip')"
                        @click="cycleTierListSort('patchWinratePp')"
                      >
                        {{ t('statisticsPage.championTableDeltaSymbol')
                        }}{{ tierListSortIcon('patchWinratePp') }}
                      </button>
                    </div>
                    <div
                      class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-12 shrink-0 flex-col justify-stretch border-b border-t border-black border-t-[var(--color-grey-300)] py-0.5"
                    >
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                        :title="t('statisticsPage.tierListPickrateTooltip')"
                        @click="cycleTierListSort('pickrate')"
                      >
                        {{ t('statisticsPage.pickrate') }}{{ tierListSortIcon('pickrate') }}
                      </button>
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center border-t border-black/20 px-0.5 pt-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                        :title="t('statisticsPage.tierListPatchDeltaSortTooltip')"
                        @click="cycleTierListSort('patchPickratePp')"
                      >
                        {{ t('statisticsPage.championTableDeltaSymbol')
                        }}{{ tierListSortIcon('patchPickratePp') }}
                      </button>
                    </div>
                    <div
                      class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-12 shrink-0 flex-col justify-stretch border-b border-t border-black border-t-[var(--color-grey-300)] py-0.5"
                    >
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                        :title="t('statisticsPage.tierListBanrateTooltip')"
                        @click="cycleTierListSort('banrate')"
                      >
                        {{ t('statisticsPage.banrate') }}{{ tierListSortIcon('banrate') }}
                      </button>
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center border-t border-black/20 px-0.5 pt-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                        :title="t('statisticsPage.tierListPatchDeltaSortTooltip')"
                        @click="cycleTierListSort('patchBanratePp')"
                      >
                        {{ t('statisticsPage.championTableDeltaSymbol')
                        }}{{ tierListSortIcon('patchBanratePp') }}
                      </button>
                    </div>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th tier-list-lolalytics-th-all hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] hover:bg-primary/25 md:flex"
                      :title="t('statisticsPage.tierListPbiTooltip')"
                      @click="cycleTierListSort('pbi')"
                    >
                      {{ t('statisticsPage.tierListPbi') }}{{ tierListSortIcon('pbi') }}
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th tier-list-lolalytics-th-all hidden w-[72px] shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] hover:bg-primary/25 sm:flex"
                      @click="cycleTierListSort('games')"
                    >
                      {{ t('statisticsPage.tierListGames') }}{{ tierListSortIcon('games') }}
                    </button>
                    <template v-if="hasTierListHighElo">
                      <button
                        type="button"
                        class="tier-list-lolalytics-th tier-list-lolalytics-th-apex hidden w-10 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                        :title="t('statisticsPage.tierListApexRankTooltip')"
                        @click="cycleTierListSort('highEloRank')"
                      >
                        {{ t('statisticsPage.tierListApexRank')
                        }}{{ tierListSortIcon('highEloRank') }}
                      </button>
                      <button
                        type="button"
                        class="tier-list-lolalytics-th tier-list-lolalytics-th-apex hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                        :title="t('statisticsPage.tierListHighEloWinTooltip')"
                        @click="cycleTierListSort('highEloWinrate')"
                      >
                        {{ t('statisticsPage.winrate') }}{{ tierListSortIcon('highEloWinrate') }}
                      </button>
                      <button
                        type="button"
                        class="tier-list-lolalytics-th tier-list-lolalytics-th-apex hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                        @click="cycleTierListSort('highEloGames')"
                      >
                        {{ t('statisticsPage.tierListGames')
                        }}{{ tierListSortIcon('highEloGames') }}
                      </button>
                      <button
                        type="button"
                        class="tier-list-lolalytics-th tier-list-lolalytics-th-apex hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                        :title="t('statisticsPage.tierListDeltaTooltip')"
                        @click="cycleTierListSort('delta')"
                      >
                        {{ t('statisticsPage.tierListDelta') }}{{ tierListSortIcon('delta') }}
                      </button>
                    </template>
                  </div>

                  <div
                    v-for="row in paginatedTierList"
                    :key="row.championId"
                    class="tier-list-lolalytics-row flex min-h-[60px] w-full cursor-pointer items-center justify-between py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
                    role="button"
                    tabindex="0"
                    @click="navigateTo(localePath('/statistics/champion/' + row.championId))"
                    @keydown.enter="
                      navigateTo(localePath('/statistics/champion/' + row.championId))
                    "
                  >
                    <div
                      class="tier-list-lolalytics-td hidden w-10 shrink-0 flex-col items-center justify-center gap-0 leading-tight md:flex"
                    >
                      <span>{{ tierListDisplayRankByChampionId.get(row.championId) ?? '—' }}</span>
                      <span
                        v-if="
                          tierListPatchDeltaRefLabel &&
                          tierListPatchRankDelta(row.championId) != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          tierListPatchDeltaRankClass(tierListPatchRankDelta(row.championId) || 0)
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaRankTitle', {
                            ref: tierListPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatTierListPatchDeltaRank(tierListPatchRankDelta(row.championId) || 0)
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-[220px] shrink-0 items-center gap-2 px-2"
                    >
                      <img
                        v-if="gameVersion && championByKey(row.championId)"
                        :src="
                          getChampionImageUrl(
                            gameVersion,
                            championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="championName(row.championId) || ''"
                        class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover"
                        width="50"
                        height="50"
                      />
                      <span class="min-w-0 truncate text-left font-medium text-accent">{{
                        championName(row.championId) || row.championId
                      }}</span>
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-10 shrink-0 items-center justify-center"
                    >
                      <span
                        :class="[
                          'inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded px-0.5 text-[11px] font-bold leading-none text-background',
                          row.tier === 'S+' && 'bg-[#f5c542]',
                          row.tier === 'S' && 'bg-[#22c55e]',
                          row.tier === 'A' && 'bg-[#2563eb]',
                          row.tier === 'B' && 'bg-[#60a5fa]',
                          row.tier === 'C' && 'bg-[#a855f7]',
                          (row.tier === 'D' || row.tier === 'F') && 'bg-[#dc2626]',
                        ]"
                      >
                        {{
                          row.tier === 'D'
                            ? t('statisticsPage.tierF')
                            : t('statisticsPage.tier' + row.tier)
                        }}
                      </span>
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 text-center text-[11px] leading-tight"
                    >
                      <img
                        v-if="mainRoleIconSrc(row.mainRole)"
                        :src="mainRoleIconSrc(row.mainRole)!"
                        :alt="mainRoleLabel(row.mainRole)"
                        :title="mainRoleLabel(row.mainRole)"
                        class="mb-0.5 h-[27px] w-[27px] object-contain"
                        width="27"
                        height="27"
                      />
                      <span v-else class="max-w-[2.5rem] truncate text-[10px]">{{
                        row.mainRole
                      }}</span>
                      <span>{{ Number(row.mainRolePct).toFixed(0) }}%</span>
                      <span
                        v-if="tierListPatchDeltaRefLabel && row.patchRefMainRolePctPp != null"
                        class="text-[10px] leading-none"
                        :class="tierListPatchDeltaClass(row.patchRefMainRolePctPp)"
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: tierListPatchDeltaRefLabel,
                          })
                        "
                        >{{ formatTierListPatchDeltaPp(row.patchRefMainRolePctPp) }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
                    >
                      <span :class="tierListWinrateClass(row.winrate * 100)">{{
                        (row.winrate * 100).toFixed(2)
                      }}</span>
                      <span
                        v-if="tierListPatchDeltaRefLabel && row.patchRefWinratePp != null"
                        class="text-[10px] leading-none"
                        :class="tierListPatchDeltaClass(row.patchRefWinratePp)"
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: tierListPatchDeltaRefLabel,
                          })
                        "
                        >{{ formatTierListPatchDeltaPp(row.patchRefWinratePp) }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
                    >
                      <span>{{ (row.pickrate * 100).toFixed(2) }}</span>
                      <span
                        v-if="tierListPatchDeltaRefLabel && row.patchRefPickratePp != null"
                        class="text-[10px] leading-none"
                        :class="tierListPatchDeltaClass(row.patchRefPickratePp)"
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: tierListPatchDeltaRefLabel,
                          })
                        "
                        >{{ formatTierListPatchDeltaPp(row.patchRefPickratePp) }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
                    >
                      <span>{{ (row.banrate * 100).toFixed(2) }}</span>
                      <span
                        v-if="tierListPatchDeltaRefLabel && row.patchRefBanratePp != null"
                        class="text-[10px] leading-none"
                        :class="tierListPatchDeltaClass(row.patchRefBanratePp)"
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: tierListPatchDeltaRefLabel,
                          })
                        "
                        >{{ formatTierListPatchDeltaPp(row.patchRefBanratePp) }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td hidden w-12 shrink-0 items-center justify-center text-center md:flex"
                    >
                      {{ formatMatchupScore(row.pbi, 2) }}
                    </div>
                    <div
                      class="tier-list-lolalytics-td hidden w-[72px] shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight sm:flex"
                    >
                      <span>{{ row.games.toLocaleString() }}</span>
                      <span
                        v-if="tierListPatchDeltaRefLabel && row.patchRefGamesDelta != null"
                        class="text-[10px] leading-none"
                        :class="tierListPatchDeltaGamesClass(row.patchRefGamesDelta)"
                        :title="
                          t('statisticsPage.tierListPatchDeltaGamesTitle', {
                            ref: tierListPatchDeltaRefLabel,
                          })
                        "
                        >{{ formatTierListPatchDeltaGames(row.patchRefGamesDelta) }}</span
                      >
                    </div>
                    <template v-if="hasTierListHighElo">
                      <div
                        class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-10 shrink-0 items-center justify-center sm:flex"
                      >
                        {{ row.highEloRank != null ? row.highEloRank : '—' }}
                      </div>
                      <div
                        class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-12 shrink-0 flex-col items-center justify-center gap-0 leading-tight sm:flex"
                      >
                        <template v-if="row.highEloWinrate != null">
                          <span :class="tierListWinrateClass(row.highEloWinrate * 100)">{{
                            (row.highEloWinrate * 100).toFixed(2)
                          }}</span>
                          <span
                            v-if="
                              tierListPatchDeltaRefLabel && row.patchRefHighEloWinratePp != null
                            "
                            class="text-[10px] leading-none"
                            :class="tierListPatchDeltaClass(row.patchRefHighEloWinratePp)"
                            :title="
                              t('statisticsPage.tierListPatchDeltaTitle', {
                                ref: tierListPatchDeltaRefLabel,
                              })
                            "
                            >{{ formatTierListPatchDeltaPp(row.patchRefHighEloWinratePp) }}</span
                          >
                        </template>
                        <span v-else>—</span>
                      </div>
                      <div
                        class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight sm:flex"
                      >
                        <span>{{
                          row.highEloGames != null ? row.highEloGames.toLocaleString() : '—'
                        }}</span>
                        <span
                          v-if="tierListPatchDeltaRefLabel && row.patchRefHighEloGamesDelta != null"
                          class="text-[10px] leading-none"
                          :class="tierListPatchDeltaGamesClass(row.patchRefHighEloGamesDelta)"
                          :title="
                            t('statisticsPage.tierListPatchDeltaGamesTitle', {
                              ref: tierListPatchDeltaRefLabel,
                            })
                          "
                          >{{ formatTierListPatchDeltaGames(row.patchRefHighEloGamesDelta) }}</span
                        >
                      </div>
                      <div
                        class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-12 shrink-0 items-center justify-center sm:flex"
                      >
                        {{
                          row.delta != null
                            ? (row.delta > 0 ? '+' : '') + Number(row.delta).toFixed(2)
                            : '—'
                        }}
                      </div>
                    </template>
                  </div>
                </div>
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
              <!-- Vue graphique : barres divergentes (PBI), style analytics sombre -->
              <div
                v-show="tierListViewModel === 'chart' && totalTierListCount > 0"
                class="tier-list-diverging-wrap statistics-overview-surface overflow-x-auto rounded-xl border border-primary/30 p-4 shadow-inner"
              >
                <div class="flex min-w-[640px] flex-col gap-3 lg:min-w-0">
                  <div class="min-w-0 flex-1">
                    <h3
                      class="mb-2 font-sans text-sm font-bold uppercase tracking-tight text-white md:text-base"
                    >
                      {{ tierListChartHeading }}
                    </h3>
                    <div class="mb-2 flex flex-wrap items-center gap-2">
                      <button
                        v-for="entry in TIER_DIVERGING_LEGEND"
                        :key="'tier-filter-' + entry.key"
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold transition-colors"
                        :class="
                          tierListChartTierEnabled(entry.key)
                            ? 'border-white/40 bg-white/10 text-white'
                            : 'border-white/20 bg-black/20 text-white/60'
                        "
                        @click="toggleTierListChartTier(entry.key)"
                      >
                        <span
                          class="inline-block h-3 w-3 rounded-sm"
                          :style="{ backgroundColor: entry.color }"
                        />
                        <span>{{
                          entry.key === 'S+'
                            ? t('statisticsPage.tierS+')
                            : entry.key === 'D'
                              ? t('statisticsPage.tierF')
                              : t('statisticsPage.tier' + entry.key)
                        }}</span>
                      </button>
                    </div>
                    <p class="mb-3 text-[11px] text-amber-200/60">
                      {{ t('statisticsPage.tierListChartPbiAxis') }}
                    </p>
                    <div class="flex gap-1">
                      <div
                        class="relative w-9 shrink-0 text-[10px] leading-none text-amber-100/80 md:w-10"
                      >
                        <div class="relative h-[320px]">
                          <div class="absolute inset-0">
                            <span
                              v-for="tick in tierListChartYScale.ticks"
                              :key="'ytick-' + tick"
                              class="absolute right-0.5 -translate-y-1/2 tabular-nums"
                              :style="{ bottom: tierListChartYTickBottomPct(tick) + '%' }"
                            >
                              {{
                                Math.abs(tick - Math.round(tick)) < 1e-6
                                  ? Math.round(tick)
                                  : Number(tick.toFixed(1))
                              }}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div class="relative min-w-0 flex-1">
                        <div class="relative h-[320px] w-full overflow-visible">
                          <div class="absolute inset-0">
                            <div
                              v-for="tick in tierListChartYScale.ticks"
                              :key="'grid-' + tick"
                              class="pointer-events-none absolute left-0 right-0 z-0 border-t border-amber-400/20"
                              :style="{ bottom: tierListChartYTickBottomPct(tick) + '%' }"
                            />
                            <div
                              class="pointer-events-none absolute bottom-0 right-0 top-0 z-[1] w-[12%] bg-slate-950/35"
                              aria-hidden="true"
                            />
                            <div
                              class="absolute bottom-0 left-0 right-0 top-0 z-[2] flex items-stretch gap-px px-0.5"
                            >
                              <NuxtLink
                                v-for="c in tierListChartVisibleRows"
                                :key="c.championId"
                                :to="localePath('/statistics/champion/' + c.championId)"
                                class="group relative min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                                :title="
                                  (championName(c.championId) || c.championId) +
                                  ' — Score ' +
                                  formatMatchupScore(c.pbi, 2)
                                "
                                @mouseenter="onTierListChartBarEnter(c, $event)"
                                @mousemove="onTierListChartBarMove"
                                @mouseleave="onTierListChartBarLeave"
                              >
                                <div class="relative h-full w-full">
                                  <div class="flex h-full w-full justify-center">
                                    <div class="relative h-full w-[85%] max-w-[12px]">
                                      <div
                                        class="absolute left-0 right-0 z-[1] h-px bg-amber-400/55"
                                        :style="{ bottom: tierListChartZeroBottomPct + '%' }"
                                      />
                                      <div
                                        v-if="scaleMatchupScore(c.pbi) >= 0"
                                        class="absolute left-0 right-0 rounded-t-[2px] transition-all group-hover:brightness-110"
                                        :style="{
                                          bottom: tierListChartZeroBottomPct + '%',
                                          height: tierListChartBarHeightPct(c.pbi) + '%',
                                          backgroundColor: tierListChartBarColor(c.tier),
                                        }"
                                      />
                                      <div
                                        v-else
                                        class="absolute left-0 right-0 rounded-b-[2px] transition-all group-hover:brightness-110"
                                        :style="{
                                          bottom: tierListChartScoreBottomPct(c.pbi) + '%',
                                          height: tierListChartBarHeightPct(c.pbi) + '%',
                                          backgroundColor: tierListChartBarColor(c.tier),
                                        }"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </NuxtLink>
                            </div>
                          </div>
                        </div>
                        <Teleport to="body">
                          <div
                            v-if="tierListChartTooltip && tierListChartTooltipRow"
                            class="pointer-events-none fixed z-[300] w-max max-w-[17rem] rounded border border-amber-500/45 bg-[#0c1222] p-2 text-left text-xs text-amber-50 shadow-xl"
                            :style="{
                              left: tierListChartTooltip.x + 'px',
                              top: tierListChartTooltip.y + 'px',
                              transform: 'translate(-50%, calc(-100% - 12px))',
                            }"
                          >
                            <div class="flex items-center gap-2">
                              <img
                                v-if="
                                  tierListChartChampionImage(tierListChartTooltipRow.championId)
                                "
                                :src="
                                  tierListChartChampionImage(tierListChartTooltipRow.championId) ||
                                  ''
                                "
                                :alt="
                                  championName(tierListChartTooltipRow.championId) ||
                                  String(tierListChartTooltipRow.championId)
                                "
                                class="h-8 w-8 shrink-0 rounded object-cover"
                              />
                              <div class="min-w-0">
                                <div class="truncate font-semibold text-amber-100">
                                  {{
                                    championName(tierListChartTooltipRow.championId) ||
                                    tierListChartTooltipRow.championId
                                  }}
                                </div>
                                <div class="text-[11px] text-amber-200/75">
                                  Score {{ formatMatchupScore(tierListChartTooltipRow.pbi, 2) }}
                                </div>
                                <div
                                  v-if="
                                    tierListPatchDeltaRefLabel &&
                                    tierListChartTooltipRow.patchRefMatchupScorePp != null
                                  "
                                  class="text-[11px]"
                                  :class="
                                    tierListPatchDeltaClass(
                                      tierListChartTooltipRow.patchRefMatchupScorePp
                                    )
                                  "
                                >
                                  {{
                                    t('statisticsPage.tierListChartDeltaMatchupVsRef', {
                                      ref: tierListPatchDeltaRefLabel,
                                    })
                                  }}:
                                  {{
                                    formatTierListPatchDeltaPp(
                                      tierListChartTooltipRow.patchRefMatchupScorePp
                                    )
                                  }}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Teleport>
                        <div
                          class="flex h-[52px] items-center justify-stretch gap-px border-t border-amber-400/25 px-0.5 pt-1"
                        >
                          <div
                            v-for="c in tierListChartVisibleRows"
                            :key="'lbl-' + c.championId"
                            class="flex min-w-0 flex-1 items-center justify-center overflow-visible"
                          >
                            <img
                              v-if="gameVersion && championByKey(c.championId)"
                              :src="
                                getChampionImageUrl(
                                  gameVersion,
                                  championByKey(c.championId)!.image.full
                                )
                              "
                              :alt="championName(c.championId) || String(c.championId)"
                              class="h-9 w-9 shrink-0 rounded-full border border-amber-400/30 object-cover"
                              width="36"
                              height="36"
                            />
                            <span
                              v-else
                              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-black/40 text-[10px] font-semibold text-white/80"
                            >
                              {{ (championName(c.championId) || String(c.championId)).slice(0, 2) }}
                            </span>
                          </div>
                        </div>
                        <div
                          class="mt-1 flex justify-between border-t border-white/10 pt-1 text-[10px] text-amber-200/50"
                        >
                          <span>{{ t('statisticsPage.tierListChartWorst') }}</span>
                          <span>{{ t('statisticsPage.tierListChartBest') }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Tab: Champion (tableau global bleu/rouge + dégâts + KDA) -->
          <div v-show="activeTab === 'championTable'" class="space-y-4">
            <div v-if="championGlobalTablePending" class="text-text/70">
              {{ t('statisticsPage.loading') }}
            </div>
            <div
              v-else-if="championGlobalTableError"
              class="rounded border border-error bg-surface p-3 text-error"
            >
              {{ championGlobalTableError }}
            </div>
            <div
              v-else-if="championGlobalSortedRows.length === 0"
              class="statistics-overview-surface rounded-lg border border-primary/30 p-4 text-text/70"
            >
              {{ t('statisticsPage.championTableNoData') }}
            </div>
            <div
              v-else
              class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
            >
              <div
                class="tier-list-lolalytics champion-global-table text-[11px] text-text-primary/90"
                :style="{ minWidth: championGlobalTableMinWidthPx + 'px' }"
              >
                <div
                  class="tier-list-lolalytics-head sticky top-0 z-10 flex h-auto min-h-8 w-full flex-nowrap items-stretch justify-start border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
                >
                  <button
                    type="button"
                    class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-[220px] shrink-0 cursor-pointer items-center justify-start border-b border-t border-black border-t-[var(--color-grey-300)] px-2 hover:bg-primary/25"
                    @click="setChampionGlobalSort('champion')"
                  >
                    {{ t('statisticsPage.tierListColChampion')
                    }}{{ championGlobalSortIcon('champion') }}
                  </button>
                  <template v-if="championGlobalExpandBlue">
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex min-h-8 w-7 shrink-0 cursor-pointer items-center justify-center border-b border-l border-t border-black border-sky-400/45 border-t-[var(--color-grey-300)] text-[11px] hover:bg-primary/30"
                      :title="t('statisticsPage.championTableCollapseGroup')"
                      @click="championGlobalExpandBlue = false"
                    >
                      ◀
                    </button>
                    <div
                      class="tier-list-lolalytics-th flex w-12 shrink-0 flex-col justify-stretch border-b border-t border-black border-t-[var(--color-grey-300)] py-0.5"
                    >
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                        :title="
                          t('statisticsPage.championTableTooltipBlue') +
                          ' — ' +
                          t('statisticsPage.tierListWinrateTooltip')
                        "
                        @click="setChampionGlobalSort('blueWinrate')"
                      >
                        {{ t('statisticsPage.winrate') }}{{ championGlobalSortIcon('blueWinrate') }}
                      </button>
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center border-t border-black/20 px-0.5 pt-0.5 text-center text-[8px] leading-tight text-text/75 hover:bg-primary/20"
                        :title="t('statisticsPage.tierListPatchDeltaSortTooltip')"
                        @click="setChampionGlobalSort('blueWinrateDelta')"
                      >
                        {{ t('statisticsPage.championTableDeltaSymbol')
                        }}{{ championGlobalSortIcon('blueWinrateDelta') }}
                      </button>
                    </div>
                    <div
                      class="tier-list-lolalytics-th flex w-12 shrink-0 flex-col justify-stretch border-b border-t border-black border-t-[var(--color-grey-300)] py-0.5"
                    >
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                        :title="
                          t('statisticsPage.championTableTooltipBlue') +
                          ' — ' +
                          t('statisticsPage.tierListPickrateTooltip')
                        "
                        @click="setChampionGlobalSort('bluePickrate')"
                      >
                        {{ t('statisticsPage.pickrate')
                        }}{{ championGlobalSortIcon('bluePickrate') }}
                      </button>
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center border-t border-black/20 px-0.5 pt-0.5 text-center text-[8px] leading-tight text-text/75 hover:bg-primary/20"
                        :title="t('statisticsPage.tierListPatchDeltaSortTooltip')"
                        @click="setChampionGlobalSort('bluePickrateDelta')"
                      >
                        {{ t('statisticsPage.championTableDeltaSymbol')
                        }}{{ championGlobalSortIcon('bluePickrateDelta') }}
                      </button>
                    </div>
                    <div
                      class="tier-list-lolalytics-th flex w-12 shrink-0 flex-col justify-stretch border-b border-t border-black border-t-[var(--color-grey-300)] py-0.5"
                    >
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                        :title="
                          t('statisticsPage.championTableTooltipBlue') +
                          ' — ' +
                          t('statisticsPage.tierListBanrateTooltip')
                        "
                        @click="setChampionGlobalSort('blueBanrate')"
                      >
                        {{ t('statisticsPage.banrate') }}{{ championGlobalSortIcon('blueBanrate') }}
                      </button>
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center border-t border-black/20 px-0.5 pt-0.5 text-center text-[8px] leading-tight text-text/75 hover:bg-primary/20"
                        :title="t('statisticsPage.tierListPatchDeltaSortTooltip')"
                        @click="setChampionGlobalSort('blueBanrateDelta')"
                      >
                        {{ t('statisticsPage.championTableDeltaSymbol')
                        }}{{ championGlobalSortIcon('blueBanrateDelta') }}
                      </button>
                    </div>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="tier-list-lolalytics-th flex h-8 w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-l border-t border-black border-sky-400/45 border-t-[var(--color-grey-300)] px-0.5 text-center text-[9px] font-semibold leading-tight text-sky-200/90 hover:bg-primary/25"
                    :title="t('statisticsPage.championTableExpandGroup')"
                    @click="championGlobalExpandBlue = true"
                  >
                    <span>{{ t('statisticsPage.championTableGroupBlue') }}</span>
                    <span class="text-[10px] text-text/80">▶</span>
                  </button>
                  <template v-if="championGlobalExpandRed">
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex min-h-8 w-7 shrink-0 cursor-pointer items-center justify-center border-b border-l border-t border-black border-red-400/45 border-t-[var(--color-grey-300)] text-[11px] hover:bg-primary/30"
                      :title="t('statisticsPage.championTableCollapseGroup')"
                      @click="championGlobalExpandRed = false"
                    >
                      ◀
                    </button>
                    <div
                      class="tier-list-lolalytics-th flex w-12 shrink-0 flex-col justify-stretch border-b border-t border-black border-t-[var(--color-grey-300)] py-0.5"
                    >
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                        :title="
                          t('statisticsPage.championTableTooltipRed') +
                          ' — ' +
                          t('statisticsPage.tierListWinrateTooltip')
                        "
                        @click="setChampionGlobalSort('redWinrate')"
                      >
                        {{ t('statisticsPage.winrate') }}{{ championGlobalSortIcon('redWinrate') }}
                      </button>
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center border-t border-black/20 px-0.5 pt-0.5 text-center text-[8px] leading-tight text-text/75 hover:bg-primary/20"
                        :title="t('statisticsPage.tierListPatchDeltaSortTooltip')"
                        @click="setChampionGlobalSort('redWinrateDelta')"
                      >
                        {{ t('statisticsPage.championTableDeltaSymbol')
                        }}{{ championGlobalSortIcon('redWinrateDelta') }}
                      </button>
                    </div>
                    <div
                      class="tier-list-lolalytics-th flex w-12 shrink-0 flex-col justify-stretch border-b border-t border-black border-t-[var(--color-grey-300)] py-0.5"
                    >
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                        :title="
                          t('statisticsPage.championTableTooltipRed') +
                          ' — ' +
                          t('statisticsPage.tierListPickrateTooltip')
                        "
                        @click="setChampionGlobalSort('redPickrate')"
                      >
                        {{ t('statisticsPage.pickrate')
                        }}{{ championGlobalSortIcon('redPickrate') }}
                      </button>
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center border-t border-black/20 px-0.5 pt-0.5 text-center text-[8px] leading-tight text-text/75 hover:bg-primary/20"
                        :title="t('statisticsPage.tierListPatchDeltaSortTooltip')"
                        @click="setChampionGlobalSort('redPickrateDelta')"
                      >
                        {{ t('statisticsPage.championTableDeltaSymbol')
                        }}{{ championGlobalSortIcon('redPickrateDelta') }}
                      </button>
                    </div>
                    <div
                      class="tier-list-lolalytics-th flex w-12 shrink-0 flex-col justify-stretch border-b border-t border-black border-t-[var(--color-grey-300)] py-0.5"
                    >
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                        :title="
                          t('statisticsPage.championTableTooltipRed') +
                          ' — ' +
                          t('statisticsPage.tierListBanrateTooltip')
                        "
                        @click="setChampionGlobalSort('redBanrate')"
                      >
                        {{ t('statisticsPage.banrate') }}{{ championGlobalSortIcon('redBanrate') }}
                      </button>
                      <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center border-t border-black/20 px-0.5 pt-0.5 text-center text-[8px] leading-tight text-text/75 hover:bg-primary/20"
                        :title="t('statisticsPage.tierListPatchDeltaSortTooltip')"
                        @click="setChampionGlobalSort('redBanrateDelta')"
                      >
                        {{ t('statisticsPage.championTableDeltaSymbol')
                        }}{{ championGlobalSortIcon('redBanrateDelta') }}
                      </button>
                    </div>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="tier-list-lolalytics-th flex h-8 w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-l border-t border-black border-red-400/45 border-t-[var(--color-grey-300)] px-0.5 text-center text-[9px] font-semibold leading-tight text-red-200/90 hover:bg-primary/25"
                    :title="t('statisticsPage.championTableExpandGroup')"
                    @click="championGlobalExpandRed = true"
                  >
                    <span>{{ t('statisticsPage.championTableGroupRed') }}</span>
                    <span class="text-[10px] text-text/80">▶</span>
                  </button>
                  <template v-if="championGlobalExpandDealt">
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center border-b border-l border-t border-black border-white/25 border-t-[var(--color-grey-300)] text-[11px] hover:bg-primary/30"
                      :title="t('statisticsPage.championTableCollapseGroup')"
                      @click="championGlobalExpandDealt = false"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      :title="t('statisticsPage.championTableTooltipDealt')"
                      @click="setChampionGlobalSort('dmgTotal')"
                    >
                      {{ t('statisticsPage.championTableColTotal')
                      }}{{ championGlobalSortIcon('dmgTotal') }}
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      :title="t('statisticsPage.championTableDealtPhys')"
                      @click="setChampionGlobalSort('dmgPhys')"
                    >
                      {{ t('statisticsPage.championTableColPhys')
                      }}{{ championGlobalSortIcon('dmgPhys') }}
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      :title="t('statisticsPage.championTableDealtMagic')"
                      @click="setChampionGlobalSort('dmgMagic')"
                    >
                      {{ t('statisticsPage.championTableColMagic')
                      }}{{ championGlobalSortIcon('dmgMagic') }}
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      :title="t('statisticsPage.championTableDealtTrue')"
                      @click="setChampionGlobalSort('dmgTrue')"
                    >
                      {{ t('statisticsPage.championTableColBrut')
                      }}{{ championGlobalSortIcon('dmgTrue') }}
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="tier-list-lolalytics-th flex h-8 w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-l border-t border-black border-white/25 border-t-[var(--color-grey-300)] px-0.5 text-center text-[9px] font-semibold leading-tight hover:bg-primary/25"
                    :title="t('statisticsPage.championTableExpandGroup')"
                    @click="championGlobalExpandDealt = true"
                  >
                    <span>{{ t('statisticsPage.championTableGroupDealt') }}</span>
                    <span class="text-[10px] text-text/80">▶</span>
                  </button>
                  <template v-if="championGlobalExpandTaken">
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center border-b border-l border-t border-black border-white/25 border-t-[var(--color-grey-300)] text-[11px] hover:bg-primary/30"
                      :title="t('statisticsPage.championTableCollapseGroup')"
                      @click="championGlobalExpandTaken = false"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      :title="t('statisticsPage.championTableTooltipTaken')"
                      @click="setChampionGlobalSort('takenTotal')"
                    >
                      {{ t('statisticsPage.championTableColTotal')
                      }}{{ championGlobalSortIcon('takenTotal') }}
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      :title="t('statisticsPage.championTableTakenPhys')"
                      @click="setChampionGlobalSort('takenPhys')"
                    >
                      {{ t('statisticsPage.championTableColPhys')
                      }}{{ championGlobalSortIcon('takenPhys') }}
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      :title="t('statisticsPage.championTableTakenMagic')"
                      @click="setChampionGlobalSort('takenMagic')"
                    >
                      {{ t('statisticsPage.championTableColMagic')
                      }}{{ championGlobalSortIcon('takenMagic') }}
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-10 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      :title="t('statisticsPage.championTableTakenTrue')"
                      @click="setChampionGlobalSort('takenTrue')"
                    >
                      {{ t('statisticsPage.championTableColBrut')
                      }}{{ championGlobalSortIcon('takenTrue') }}
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="tier-list-lolalytics-th flex h-8 w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-l border-t border-black border-white/25 border-t-[var(--color-grey-300)] px-0.5 text-center text-[9px] font-semibold leading-tight hover:bg-primary/25"
                    :title="t('statisticsPage.championTableExpandGroup')"
                    @click="championGlobalExpandTaken = true"
                  >
                    <span>{{ t('statisticsPage.championTableGroupTaken') }}</span>
                    <span class="text-[10px] text-text/80">▶</span>
                  </button>
                  <template v-if="championGlobalExpandKda">
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center border-b border-l border-t border-black border-white/25 border-t-[var(--color-grey-300)] text-[11px] hover:bg-primary/30"
                      :title="t('statisticsPage.championTableCollapseGroup')"
                      @click="championGlobalExpandKda = false"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-9 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      :title="t('statisticsPage.championTableTooltipKda')"
                      @click="setChampionGlobalSort('kills')"
                    >
                      {{ t('statisticsPage.championTableColKill')
                      }}{{ championGlobalSortIcon('kills') }}
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-9 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      @click="setChampionGlobalSort('deaths')"
                    >
                      {{ t('statisticsPage.championTableColDeath')
                      }}{{ championGlobalSortIcon('deaths') }}
                    </button>
                    <button
                      type="button"
                      class="tier-list-lolalytics-th flex h-8 w-9 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                      @click="setChampionGlobalSort('assists')"
                    >
                      {{ t('statisticsPage.championTableColAssist')
                      }}{{ championGlobalSortIcon('assists') }}
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="tier-list-lolalytics-th flex h-8 w-[68px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0 border-b border-l border-t border-black border-white/25 border-t-[var(--color-grey-300)] px-0.5 text-center text-[9px] font-semibold leading-tight hover:bg-primary/25"
                    :title="t('statisticsPage.championTableExpandGroup')"
                    @click="championGlobalExpandKda = true"
                  >
                    <span>{{ t('statisticsPage.championTableGroupKda') }}</span>
                    <span class="text-[10px] text-text/80">▶</span>
                  </button>
                </div>
                <div
                  v-for="row in championGlobalSortedRows"
                  :key="row.championId"
                  class="tier-list-lolalytics-row flex min-h-[72px] w-full flex-nowrap items-center justify-start py-0.5 odd:bg-white/[0.04] even:bg-black/25"
                >
                  <div
                    class="tier-list-lolalytics-td flex w-[220px] shrink-0 items-center gap-2 px-2"
                  >
                    <img
                      v-if="gameVersion && championByKey(row.championId)"
                      :src="
                        getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)
                      "
                      :alt="championName(row.championId) || ''"
                      class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover"
                      width="50"
                      height="50"
                    />
                    <span class="min-w-0 truncate text-left font-medium text-accent">{{
                      championName(row.championId) || row.championId
                    }}</span>
                  </div>
                  <template v-if="championGlobalExpandBlue">
                    <div
                      class="tier-list-lolalytics-td w-7 shrink-0 border-l border-sky-400/35"
                      aria-hidden="true"
                    />
                    <div
                      class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
                    >
                      <span
                        :class="
                          row.blue.games ? tierListWinrateClass(row.blue.winrate) : 'text-text/55'
                        "
                        >{{ row.blue.games ? row.blue.winrate.toFixed(2) : '—' }}</span
                      >
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalSideStatDeltaPp(row.championId, 'blue', 'winrate') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          tierListPatchDeltaClass(
                            championGlobalSideStatDeltaPp(row.championId, 'blue', 'winrate')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatTierListPatchDeltaPp(
                            championGlobalSideStatDeltaPp(row.championId, 'blue', 'winrate')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
                    >
                      <span
                        :class="
                          row.blue.games
                            ? championGlobalPickrateClass(row.blue.pickrate)
                            : 'text-text/55'
                        "
                        >{{ row.blue.games ? row.blue.pickrate.toFixed(2) : '—' }}</span
                      >
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalSideStatDeltaPp(row.championId, 'blue', 'pickrate') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          tierListPatchDeltaClass(
                            championGlobalSideStatDeltaPp(row.championId, 'blue', 'pickrate')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatTierListPatchDeltaPp(
                            championGlobalSideStatDeltaPp(row.championId, 'blue', 'pickrate')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
                    >
                      <span
                        :class="
                          row.blue.games
                            ? championGlobalBanrateClass(row.blue.banrate)
                            : 'text-text/55'
                        "
                        >{{ row.blue.games ? row.blue.banrate.toFixed(2) : '—' }}</span
                      >
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalSideStatDeltaPp(row.championId, 'blue', 'banrate') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          tierListPatchDeltaClass(
                            championGlobalSideStatDeltaPp(row.championId, 'blue', 'banrate')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatTierListPatchDeltaPp(
                            championGlobalSideStatDeltaPp(row.championId, 'blue', 'banrate')!
                          )
                        }}</span
                      >
                    </div>
                  </template>
                  <div
                    v-else
                    class="tier-list-lolalytics-td w-[68px] shrink-0 border-l border-sky-400/35"
                    aria-hidden="true"
                  />
                  <template v-if="championGlobalExpandRed">
                    <div
                      class="tier-list-lolalytics-td w-7 shrink-0 border-l border-red-400/40"
                      aria-hidden="true"
                    />
                    <div
                      class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
                    >
                      <span
                        :class="
                          row.red.games ? tierListWinrateClass(row.red.winrate) : 'text-text/55'
                        "
                        >{{ row.red.games ? row.red.winrate.toFixed(2) : '—' }}</span
                      >
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalSideStatDeltaPp(row.championId, 'red', 'winrate') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          tierListPatchDeltaClass(
                            championGlobalSideStatDeltaPp(row.championId, 'red', 'winrate')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatTierListPatchDeltaPp(
                            championGlobalSideStatDeltaPp(row.championId, 'red', 'winrate')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
                    >
                      <span
                        :class="
                          row.red.games
                            ? championGlobalPickrateClass(row.red.pickrate)
                            : 'text-text/55'
                        "
                        >{{ row.red.games ? row.red.pickrate.toFixed(2) : '—' }}</span
                      >
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalSideStatDeltaPp(row.championId, 'red', 'pickrate') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          tierListPatchDeltaClass(
                            championGlobalSideStatDeltaPp(row.championId, 'red', 'pickrate')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatTierListPatchDeltaPp(
                            championGlobalSideStatDeltaPp(row.championId, 'red', 'pickrate')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
                    >
                      <span
                        :class="
                          row.red.games
                            ? championGlobalBanrateClass(row.red.banrate)
                            : 'text-text/55'
                        "
                        >{{ row.red.games ? row.red.banrate.toFixed(2) : '—' }}</span
                      >
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalSideStatDeltaPp(row.championId, 'red', 'banrate') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          tierListPatchDeltaClass(
                            championGlobalSideStatDeltaPp(row.championId, 'red', 'banrate')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatTierListPatchDeltaPp(
                            championGlobalSideStatDeltaPp(row.championId, 'red', 'banrate')!
                          )
                        }}</span
                      >
                    </div>
                  </template>
                  <div
                    v-else
                    class="tier-list-lolalytics-td w-[68px] shrink-0 border-l border-red-400/40"
                    aria-hidden="true"
                  />
                  <template v-if="championGlobalExpandDealt">
                    <div
                      class="tier-list-lolalytics-td w-7 shrink-0 border-l border-white/20"
                      aria-hidden="true"
                    />
                    <div
                      class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgDamageToChamps) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgDamageToChamps') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgDamageToChamps')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgDamageToChamps')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgDamageToChampsPhys) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgDamageToChampsPhys') !=
                            null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgDamageToChampsPhys')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgDamageToChampsPhys')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgDamageToChampsMagic) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgDamageToChampsMagic') !=
                            null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgDamageToChampsMagic')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgDamageToChampsMagic')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgDamageToChampsTrue) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgDamageToChampsTrue') !=
                            null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgDamageToChampsTrue')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgDamageToChampsTrue')!
                          )
                        }}</span
                      >
                    </div>
                  </template>
                  <div
                    v-else
                    class="tier-list-lolalytics-td w-[68px] shrink-0 border-l border-white/20"
                    aria-hidden="true"
                  />
                  <template v-if="championGlobalExpandTaken">
                    <div
                      class="tier-list-lolalytics-td w-7 shrink-0 border-l border-white/20"
                      aria-hidden="true"
                    />
                    <div
                      class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgDamageTakenTotal) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgDamageTakenTotal') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgDamageTakenTotal')!,
                            true
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgDamageTakenTotal')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgDamageTakenPhys) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgDamageTakenPhys') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgDamageTakenPhys')!,
                            true
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgDamageTakenPhys')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgDamageTakenMagic) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgDamageTakenMagic') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgDamageTakenMagic')!,
                            true
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgDamageTakenMagic')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgDamageTakenTrue) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgDamageTakenTrue') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgDamageTakenTrue')!,
                            true
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgDamageTakenTrue')!
                          )
                        }}</span
                      >
                    </div>
                  </template>
                  <div
                    v-else
                    class="tier-list-lolalytics-td w-[68px] shrink-0 border-l border-white/20"
                    aria-hidden="true"
                  />
                  <template v-if="championGlobalExpandKda">
                    <div
                      class="tier-list-lolalytics-td w-7 shrink-0 border-l border-white/20"
                      aria-hidden="true"
                    />
                    <div
                      class="tier-list-lolalytics-td flex w-9 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgKills) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgKills') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgKills')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgKills')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-9 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgDeaths) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgDeaths') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgDeaths')!,
                            true
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgDeaths')!
                          )
                        }}</span
                      >
                    </div>
                    <div
                      class="tier-list-lolalytics-td flex w-9 shrink-0 flex-col items-center justify-center gap-0 font-mono text-[10px] leading-tight"
                    >
                      <span>{{ formatChampionGlobalNum(row.avgAssists) }}</span>
                      <span
                        v-if="
                          championGlobalPatchDeltaRefLabel &&
                          championGlobalNumericDelta(row.championId, 'avgAssists') != null
                        "
                        class="text-[10px] leading-none"
                        :class="
                          championGlobalNumericDeltaClass(
                            championGlobalNumericDelta(row.championId, 'avgAssists')!
                          )
                        "
                        :title="
                          t('statisticsPage.tierListPatchDeltaTitle', {
                            ref: championGlobalPatchDeltaRefLabel,
                          })
                        "
                        >{{
                          formatChampionGlobalNumericDelta(
                            championGlobalNumericDelta(row.championId, 'avgAssists')!
                          )
                        }}</span
                      >
                    </div>
                  </template>
                  <div
                    v-else
                    class="tier-list-lolalytics-td w-[68px] shrink-0 border-l border-white/20"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
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
          <div v-show="activeTab === 'items'" class="space-y-6">
            <div v-if="overviewDetailPending" class="text-text/70">
              {{ t('statisticsPage.loading') }}
            </div>
            <div
              v-else-if="overviewDetailError"
              class="rounded border border-error/50 p-3 text-error"
            >
              {{ t('statisticsPage.overviewDetailTimeout') }}
            </div>
            <template
              v-else-if="
                itemFastSliceConfigs.length > 0 ||
                (overviewDetailData?.items?.length ?? 0) > 0 ||
                (overviewDetailData?.itemStarterSets?.length ?? 0) > 0
              "
            >
              <div
                v-if="itemFastSliceConfigs.length > 0"
                class="flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[10px] pb-2"
              >
                <StatisticsItemStatsFastSection
                  v-for="c in itemFastSliceConfigs"
                  :key="c.slice"
                  :slice="c.slice"
                  :rows="c.rows"
                  :baseline-rows="c.baselineRows"
                  :total-participants="overviewDetailData?.totalParticipants ?? 0"
                  :game-version="gameVersion"
                  :ref-version-label="progressionFromVersion"
                  :baseline-pending="overviewDetailBaselinePending"
                />
              </div>
              <template v-if="(overviewDetailData?.itemStarterSets ?? []).length">
                <h3 class="text-base font-semibold text-text-accent">
                  {{ t('statisticsPage.itemsStarterSetsTitle') }}
                </h3>
                <p class="text-xs text-text/65">{{ t('statisticsPage.itemsStarterSetsHint') }}</p>
                <div
                  class="statistics-overview-surface mt-2 overflow-x-auto rounded-lg border border-primary/30"
                >
                  <table class="w-full min-w-[320px] text-left text-sm">
                    <thead class="border-b border-primary/30 bg-black/25">
                      <tr>
                        <th class="px-3 py-2 font-semibold text-text">
                          {{ t('statisticsPage.overviewDetailItems') }}
                        </th>
                        <th class="px-3 py-2 font-semibold text-text">
                          {{ t('statisticsPage.overviewDetailPickRate') }} %
                        </th>
                        <th class="px-3 py-2 font-semibold text-text">
                          {{ t('statisticsPage.overviewDetailWinRate') }} %
                        </th>
                        <th class="hidden px-3 py-2 font-semibold text-text sm:table-cell">
                          {{ t('statisticsPage.tierListGames') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-primary/20">
                      <tr
                        v-for="srow in overviewDetailData?.itemStarterSets ?? []"
                        :key="srow.items.join('-')"
                        class="hover:bg-white/5"
                      >
                        <td class="px-3 py-2">
                          <div class="flex flex-wrap items-center gap-1">
                            <template v-for="(iid, iidx) in srow.items" :key="iidx + '-' + iid">
                              <img
                                v-if="itemImageName(iid)"
                                :src="getItemImageUrl(gameVersion, itemImageName(iid)!)"
                                :alt="itemName(iid) || ''"
                                class="h-7 w-7 rounded border border-primary/20 object-cover"
                                width="28"
                                height="28"
                              />
                              <span
                                v-else
                                class="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded border border-primary/30 px-1 text-[10px] text-text/70"
                                >{{ iid }}</span
                              >
                            </template>
                          </div>
                        </td>
                        <td class="px-3 py-2 tabular-nums text-text/90">
                          {{ Number(srow.pickrate).toFixed(2) }}
                        </td>
                        <td class="px-3 py-2 tabular-nums text-text/90">
                          {{ Number(srow.winrate).toFixed(2) }}
                        </td>
                        <td class="hidden px-3 py-2 tabular-nums text-text/80 sm:table-cell">
                          {{ srow.games.toLocaleString() }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
              <h3 class="text-base font-semibold text-text-accent">
                {{ t('statisticsPage.itemsFullTableTitle') }}
              </h3>
              <div
                class="statistics-overview-surface overflow-x-auto rounded-lg border border-primary/30"
              >
                <table class="w-full text-left text-sm">
                  <thead class="border-b border-primary/30 bg-black/25">
                    <tr>
                      <th class="font-semibold text-text">
                        {{ t('statisticsPage.overviewDetailItems') }}
                      </th>
                      <th class="font-semibold text-text">
                        {{ t('statisticsPage.overviewDetailPickRate') }} %
                      </th>
                      <th class="font-semibold text-text">
                        {{ t('statisticsPage.overviewDetailWinRate') }} %
                      </th>
                      <th class="font-semibold text-text">
                        {{ t('statisticsPage.itemStats') }}
                      </th>
                      <th class="font-semibold text-text">
                        {{ t('statisticsPage.itemEconomy') }}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-primary/20">
                    <tr v-for="row in paginatedItems" :key="row.itemId" class="hover:bg-white/5">
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
            </template>
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
            <SummonerSpellTierTables
              v-else-if="
                (overviewDetailData?.summonerSpells?.length ?? 0) > 0 ||
                (overviewDetailData?.summonerSpellSets?.length ?? 0) > 0
              "
              :solo-rows="overviewDetailData?.summonerSpells ?? []"
              :set-rows="overviewDetailData?.summonerSpellSets ?? []"
              :baseline-solo="overviewDetailBaselineData?.summonerSpells ?? null"
              :baseline-sets="overviewDetailBaselineData?.summonerSpellSets ?? null"
              :ref-version-label="progressionFromVersion"
              :baseline-pending="overviewDetailBaselinePending"
              :game-version="gameVersion"
            />
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
import { ref, computed, watch, nextTick } from 'vue'
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
    tab === 'trends' ||
    tab === 'team' ||
    tab === 'runes' ||
    tab === 'items' ||
    tab === 'spells' ||
    tab === 'infos' ||
    tab === 'bans'
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
  { id: 'tierlist' as const, label: t('statisticsPage.tabTierList'), widgetId: 'tierlist' },
  {
    id: 'championTable' as const,
    label: t('statisticsPage.tabChampionTable'),
    widgetId: 'championTable',
  },
  { id: 'trends' as const, label: t('statisticsPage.tabTrends'), widgetId: 'trends' },
  { id: 'runes' as const, label: t('statisticsPage.tabRunes'), widgetId: 'runes' },
  { id: 'items' as const, label: t('statisticsPage.tabItems'), widgetId: 'items' },
  { id: 'spells' as const, label: t('statisticsPage.tabSummonerSpells'), widgetId: 'spells' },
  { id: 'infos' as const, label: t('statisticsPage.tabInfos'), widgetId: 'infos' },
  { id: 'bans' as const, label: t('statisticsPage.tabBans'), widgetId: 'bans' },
])

function cardIsFavorite(cardId: string): boolean {
  return statisticsCustomStore.isFavorite(cardId)
}

function toggleFavoriteCard(cardId: string, title: string): void {
  statisticsCustomStore.toggleFavorite(cardId, title)
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

/** Tier list: types and sort (3-state: default, asc, desc). */
type TierListSortColumn =
  | 'rank'
  | 'champion'
  | 'tier'
  | 'mainRolePct'
  | 'winrate'
  | 'pickrate'
  | 'banrate'
  | 'patchWinratePp'
  | 'patchPickratePp'
  | 'patchBanratePp'
  | 'pbi'
  | 'games'
  | 'highEloRank'
  | 'highEloWinrate'
  | 'highEloGames'
  | 'delta'

const tierListViewModel = ref<'table' | 'chart'>('table')
const tierListSortColumn = ref<TierListSortColumn | null>('rank')
const tierListSortDir = ref<'asc' | 'desc'>('desc')
const tierListPage = ref(1)

/** Cartes « plus choisis / meilleurs WR / plus bannis » → tier list en mode tableau avec le bon tri. */
function goToTierListWithSort(sort: 'winrate' | 'pickrate' | 'banrate') {
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

/** Banrate % (0–100) : tons chauds si ban forte. */
function championGlobalBanrateClass(pct: number): string {
  if (!Number.isFinite(pct)) return 'text-text/80'
  if (pct >= 35) return 'font-medium text-amber-400/90'
  if (pct >= 18) return 'text-orange-300/85'
  if (pct >= 6) return 'text-text/85'
  return 'text-slate-400/85'
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
    else if (col === 'winrate') diff = a.winrate - b.winrate
    else if (col === 'pickrate') diff = a.pickrate - b.pickrate
    else if (col === 'banrate') diff = a.banrate - b.banrate
    else if (col === 'patchWinratePp')
      diff = (a.patchRefWinratePp ?? 0) - (b.patchRefWinratePp ?? 0)
    else if (col === 'patchPickratePp')
      diff = (a.patchRefPickratePp ?? 0) - (b.patchRefPickratePp ?? 0)
    else if (col === 'patchBanratePp')
      diff = (a.patchRefBanratePp ?? 0) - (b.patchRefBanratePp ?? 0)
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
const isTierListTab = computed(() => activeTab.value === 'tierlist')
const effectiveFiltersOpen = computed(() => (isTierListTab.value ? true : filtersOpen.value))
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
const infosMatchesByDivision = computed(() => {
  const rows = overviewData.value?.matchesByDivision ?? []
  return [...rows].sort((a, b) => (b.matchCount ?? 0) - (a.matchCount ?? 0))
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
  overviewDetailBaselineData.value = null
  overviewDetailError.value = false
  if (activeTab.value === 'overview') loadOverview()
  if (activeTab.value === 'infos') loadOverview()
  if (activeTab.value === 'bans') loadBansTable()
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
  progressionFromVersionOverride.value = ''
  championSearchQuery.value = ''
  onStatsFilterChange()
}
/** Overview detail (runes, items, spells) from GET /api/stats/overview-detail */
const overviewDetailData = ref<{
  totalParticipants: number
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  runeSets: Array<{
    runes: unknown
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
function overviewQueryParams(opts?: { version?: string | null }): string {
  const params = new URLSearchParams()
  const ver = opts?.version != null && opts.version !== '' ? opts.version : statsVersionFilter.value
  if (ver) params.set('version', ver)
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

async function loadOverviewVersionsCatalog() {
  if ((overviewData.value?.matchesByVersion?.length ?? 0) > 0) {
    mergeKnownVersions(overviewData.value?.matchesByVersion)
    return
  }
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
  try {
    overviewDetailBaselineData.value = await statsFetch(
      apiUrl('/api/stats/overview-detail' + overviewQueryParams({ version: cmp })),
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

type BansTableRow = {
  championId: number
  bansTotal: number
  bansBlue: number
  bansRed: number
  bansTop: number
  bansJungle: number
  bansMiddle: number
  bansBottom: number
  bansSupport: number
}
type BansSortCol =
  | 'total'
  | 'rate'
  | 'blue'
  | 'red'
  | 'top'
  | 'jungle'
  | 'middle'
  | 'bottom'
  | 'support'
const bansTableData = ref<{
  matchCount: number
  rows: BansTableRow[]
  message?: string
  error?: string
} | null>(null)
const bansPending = ref(false)
const bansError = ref<string | null>(null)
const bansSortColumn = ref<BansSortCol>('total')
const bansSortDir = ref<'asc' | 'desc'>('desc')
const bansPage = ref(1)

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

type ChampionGlobalSortColumn =
  | 'champion'
  | 'blueWinrate'
  | 'bluePickrate'
  | 'blueBanrate'
  | 'blueWinrateDelta'
  | 'bluePickrateDelta'
  | 'blueBanrateDelta'
  | 'redWinrate'
  | 'redPickrate'
  | 'redBanrate'
  | 'redWinrateDelta'
  | 'redPickrateDelta'
  | 'redBanrateDelta'
  | 'dmgTotal'
  | 'dmgPhys'
  | 'dmgMagic'
  | 'dmgTrue'
  | 'takenTotal'
  | 'takenPhys'
  | 'takenMagic'
  | 'takenTrue'
  | 'kills'
  | 'deaths'
  | 'assists'
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

const championGlobalExpandBlue = ref(true)
const championGlobalExpandRed = ref(true)
const championGlobalExpandDealt = ref(true)
const championGlobalExpandTaken = ref(true)
const championGlobalExpandKda = ref(true)

const championGlobalTableMinWidthPx = computed(() => {
  let w = 220
  const w12 = 48
  const wNarrow = 28
  const wDmg = 40
  const wKda = 36
  const wCollapsed = 68
  w += championGlobalExpandBlue.value ? wNarrow + 3 * w12 : wCollapsed
  w += championGlobalExpandRed.value ? wNarrow + 3 * w12 : wCollapsed
  w += championGlobalExpandDealt.value ? wNarrow + 4 * wDmg : wCollapsed
  w += championGlobalExpandTaken.value ? wNarrow + 4 * wDmg : wCollapsed
  w += championGlobalExpandKda.value ? wNarrow + 3 * wKda : wCollapsed
  return w
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
  if (String(col).startsWith('blue')) championGlobalExpandBlue.value = true
  if (String(col).startsWith('red')) championGlobalExpandRed.value = true
  activeTab.value = 'championTable'
  if (import.meta.client) {
    nextTick(() => {
      document
        .querySelector('.champion-global-table')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
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
  stat: 'winrate' | 'pickrate' | 'banrate'
): number {
  const refRow = championGlobalTableRefById.value.get(row.championId)
  if (!refRow) return 0
  const cur = side === 'blue' ? row.blue : row.red
  const rf = side === 'blue' ? refRow.blue : refRow.red
  return cur[stat] - rf[stat]
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
    case 'blueBanrate':
      return (a.blue.banrate - b.blue.banrate) * m
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
    case 'blueBanrateDelta':
      return (
        (championGlobalSideStatDeltaSortValue(a, 'blue', 'banrate') -
          championGlobalSideStatDeltaSortValue(b, 'blue', 'banrate')) *
        m
      )
    case 'redWinrate':
      return (a.red.winrate - b.red.winrate) * m
    case 'redPickrate':
      return (a.red.pickrate - b.red.pickrate) * m
    case 'redBanrate':
      return (a.red.banrate - b.red.banrate) * m
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
    case 'redBanrateDelta':
      return (
        (championGlobalSideStatDeltaSortValue(a, 'red', 'banrate') -
          championGlobalSideStatDeltaSortValue(b, 'red', 'banrate')) *
        m
      )
    case 'dmgTotal':
      return (a.avgDamageToChamps - b.avgDamageToChamps) * m
    case 'dmgPhys':
      return (a.avgDamageToChampsPhys - b.avgDamageToChampsPhys) * m
    case 'dmgMagic':
      return (a.avgDamageToChampsMagic - b.avgDamageToChampsMagic) * m
    case 'dmgTrue':
      return (a.avgDamageToChampsTrue - b.avgDamageToChampsTrue) * m
    case 'takenTotal':
      return (a.avgDamageTakenTotal - b.avgDamageTakenTotal) * m
    case 'takenPhys':
      return (a.avgDamageTakenPhys - b.avgDamageTakenPhys) * m
    case 'takenMagic':
      return (a.avgDamageTakenMagic - b.avgDamageTakenMagic) * m
    case 'takenTrue':
      return (a.avgDamageTakenTrue - b.avgDamageTakenTrue) * m
    case 'kills':
      return (a.avgKills - b.avgKills) * m
    case 'deaths':
      return (a.avgDeaths - b.avgDeaths) * m
    case 'assists':
      return (a.avgAssists - b.avgAssists) * m
    default:
      return 0
  }
}

const championGlobalSortedRows = computed(() => {
  const rows = [...(championGlobalTableData.value?.rows ?? [])]
  const col = championGlobalSortColumn.value
  const dir = championGlobalSortDir.value
  rows.sort((a, b) => championGlobalCompare(a, b, col, dir))
  return rows
})

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
  const s = params.toString()
  return s ? `?${s}` : ''
}

const showBansRoleColumns = computed(() => !statsRoleFilter.value)

function banRateForBansRow(row: { bansTotal: number }, matchCount: number): number {
  if (matchCount <= 0) return 0
  return Math.round((10000 * row.bansTotal) / (2 * matchCount)) / 100
}

function bansSortHint(col: BansSortCol): string {
  if (bansSortColumn.value !== col) return ''
  return bansSortDir.value === 'desc' ? ' ↓' : ' ↑'
}

const filteredBansRows = computed(() => {
  const list = bansTableData.value?.rows ?? []
  const mc = bansTableData.value?.matchCount ?? 0
  const q = championSearchQuery.value.toLowerCase()
  const filtered = q
    ? list.filter(row => {
        const name = championName(row.championId)?.toLowerCase() ?? ''
        return name.includes(q) || String(row.championId).includes(q)
      })
    : [...list]
  const col = bansSortColumn.value
  const dir = bansSortDir.value
  const mult = dir === 'desc' ? 1 : -1
  return filtered.sort((a, b) => {
    let va = 0
    let vb = 0
    switch (col) {
      case 'total':
        va = a.bansTotal
        vb = b.bansTotal
        break
      case 'rate':
        va = banRateForBansRow(a, mc)
        vb = banRateForBansRow(b, mc)
        break
      case 'blue':
        va = a.bansBlue
        vb = b.bansBlue
        break
      case 'red':
        va = a.bansRed
        vb = b.bansRed
        break
      case 'top':
        va = a.bansTop
        vb = b.bansTop
        break
      case 'jungle':
        va = a.bansJungle
        vb = b.bansJungle
        break
      case 'middle':
        va = a.bansMiddle
        vb = b.bansMiddle
        break
      case 'bottom':
        va = a.bansBottom
        vb = b.bansBottom
        break
      case 'support':
        va = a.bansSupport
        vb = b.bansSupport
        break
      default:
        break
    }
    return mult * (vb - va)
  })
})

const totalBansCount = computed(() => filteredBansRows.value.length)
const totalBansPages = computed(() =>
  Math.max(1, Math.ceil(totalBansCount.value / championsPageSize.value))
)
const paginatedBans = computed(() => {
  const list = filteredBansRows.value
  const size = championsPageSize.value
  const page = Math.min(bansPage.value, totalBansPages.value)
  const start = (page - 1) * size
  return list.slice(start, start + size)
})

watch(bansSortColumn, () => {
  bansSortDir.value = 'desc'
})
watch([championSearchQuery, bansSortColumn, bansSortDir, championsPageSize], () => {
  bansPage.value = 1
})

function setBansSort(col: BansSortCol) {
  if (bansSortColumn.value === col) {
    bansSortDir.value = bansSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    bansSortColumn.value = col
    bansSortDir.value = 'desc'
  }
}

async function loadBansTable() {
  const t = statsPerfStart('loadBansTable')
  bansPending.value = true
  bansError.value = null
  try {
    const qs = championGlobalTableQueryForVersion(statsVersionFilter.value)
    const data = await statsFetch<{
      matchCount: number
      rows: BansTableRow[]
      error?: string
      message?: string
    }>(apiUrl(`/api/stats/champions/bans-table${qs}`))
    bansTableData.value = data
    if (data?.error || data?.message) {
      bansError.value = [data.error, data.message].filter(Boolean).join(': ') || null
    } else {
      bansError.value = null
    }
  } catch (e) {
    bansError.value = e instanceof Error ? e.message : String(e)
  } finally {
    bansPending.value = false
    statsPerfEnd('loadBansTable', t)
  }
}

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
  stat: 'winrate' | 'pickrate' | 'banrate'
): number | undefined {
  if (!championGlobalPatchDeltaRefLabel.value) return undefined
  const refRow = championGlobalTableRefById.value.get(championId)
  const curRow = championGlobalTableData.value?.rows.find(r => r.championId === championId)
  if (!refRow || !curRow) return undefined
  const cur = side === 'blue' ? curRow.blue : curRow.red
  const rf = side === 'blue' ? refRow.blue : refRow.red
  return cur[stat] - rf[stat]
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
  if (tab === 'infos' || tab === 'tierlist' || tab === 'overview') loadChampions()
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
  if (tab === 'tierlist' || tab === 'infos') loadChampions()
  if (tab === 'tierlist') loadTierList()
  if (tab === 'championTable') loadChampionGlobalTable()
  if (tab === 'bans') loadBansTable()
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
  if (activeTab.value === 'bans') loadBansTable()
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
  await loadOverview()
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
  if (activeTab.value === 'bans') await loadBansTable()
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
