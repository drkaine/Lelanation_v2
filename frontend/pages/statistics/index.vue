<template>
  <div class="statistics flex min-h-screen text-text">
    <!-- Burger pour ouvrir les filtres (mobile) -->
    <button
      type="button"
      class="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-surface/90 text-text shadow lg:hidden"
      :aria-label="t('statisticsPage.openFilters')"
      @click="filtersOpen = true"
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
      @click="filtersOpen = false"
    />

    <!-- Sidebar filtres : même charte que le reste (border-primary/30, bg-surface/30) -->
    <aside
      :class="[
        'fixed left-0 top-0 z-40 flex h-full w-64 shrink-0 flex-col rounded-r-lg border border-l-0 border-primary/30 bg-surface/30 shadow-lg transition-transform duration-200 lg:static lg:z-0 lg:translate-x-0 lg:rounded-lg lg:border lg:border-primary/30 lg:shadow-none',
        filtersOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="flex items-center justify-between border-b border-primary/30 p-4 lg:border-0">
        <h2 class="text-lg font-semibold text-text-accent">
          {{ t('statisticsPage.filtersTitle') }}
        </h2>
        <button
          type="button"
          class="rounded p-1 text-text/70 hover:bg-primary/20 hover:text-text lg:hidden"
          :aria-label="t('statisticsPage.closeFilters')"
          @click="filtersOpen = false"
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
      <div class="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div>
          <label for="stats-filter-version" class="mb-1 block text-sm font-medium text-text">
            {{ t('statisticsPage.overviewFilterByVersion') }}
          </label>
          <select
            id="stats-filter-version"
            v-model="statsVersionFilter"
            class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
            @change="onStatsFilterChange"
          >
            <option value="">{{ t('statisticsPage.overviewVersionAll') }}</option>
            <option
              v-for="v in overviewData?.matchesByVersion ?? []"
              :key="v.version"
              :value="v.version"
            >
              {{ v.version }}
            </option>
          </select>
        </div>
        <div>
          <label for="stats-filter-division" class="mb-1 block text-sm font-medium text-text">
            {{ t('statisticsPage.overviewMatchesByDivision') }}
          </label>
          <select
            id="stats-filter-division"
            v-model="statsDivisionFilter"
            class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
            @change="onStatsFilterChange"
          >
            <option value="">{{ t('statisticsPage.overviewDivisionAll') }}</option>
            <option v-for="r in rankTiers" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>
        <div>
          <div class="mb-2 text-sm font-medium text-text">
            {{ t('statisticsPage.filterRole') }}
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="r in roles"
              :key="r.value"
              type="button"
              class="stats-role-btn rounded border p-1 transition-colors"
              :class="
                statsRoleFilter === r.value
                  ? 'border-accent bg-accent/20'
                  : 'border-primary/30 bg-surface/50 hover:bg-surface/80'
              "
              :title="r.label"
              @click="toggleRoleFilter(r)"
            >
              <img
                :src="r.icon"
                :alt="r.label"
                class="h-3 w-3 object-contain"
                width="12"
                height="12"
              />
            </button>
          </div>
        </div>
        <div>
          <label for="champion-sort" class="mb-1 block text-sm font-medium text-text">{{
            t('statisticsPage.championsSortBy')
          }}</label>
          <select
            id="champion-sort"
            v-model="championsSortOrder"
            class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
          >
            <option value="winrate">{{ t('statisticsPage.championsSortWinrate') }}</option>
            <option value="pickrate">{{ t('statisticsPage.championsSortPickrate') }}</option>
            <option value="banrate">{{ t('statisticsPage.championsSortBanrate') }}</option>
            <option value="games">{{ t('statisticsPage.championsSortGames') }}</option>
            <option value="wins">{{ t('statisticsPage.wins') }}</option>
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
            class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text placeholder:text-text/50"
          />
        </div>
      </div>
    </aside>

    <!-- Contenu principal : pleine largeur à côté des filtres -->
    <div class="min-w-0 flex-1 p-4 pt-14 lg:pl-4 lg:pt-4">
      <div class="w-full">
        <div class="mb-6 text-text/80">
          <p>
            <template v-if="overviewData">
              {{
                t('statisticsPage.overviewDescriptionSummary', {
                  lastUpdate: overviewData.lastUpdate
                    ? formatGeneratedAt(overviewData.lastUpdate)
                    : '—',
                  total: overviewEffectiveTotalMatches,
                  count: overviewData.playerCount ?? 0,
                })
              }}
            </template>
            <template v-else>
              {{ t('statisticsPage.description') }}
            </template>
          </p>
          <p v-if="overviewData && overviewDescriptionVersionsSummary" class="mt-1 text-sm">
            {{ t('statisticsPage.overviewFilterByVersion') }} :
            {{ overviewDescriptionVersionsSummary }}
          </p>
          <p
            v-if="overviewData && overviewDivisionsForDescription.length"
            class="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm"
          >
            <span class="text-text/80">{{ t('statisticsPage.overviewMatchesByDivision') }} :</span>
            <template v-for="(d, idx) in overviewDivisionsForDescription" :key="d.rankTier">
              <span v-if="idx > 0" class="text-text/40" aria-hidden="true">·</span>
              <span class="text-sky-400">
                {{ d.rankTier }} ({{ d.matchCount }}, {{ divisionPercent(d) }}%)
              </span>
            </template>
          </p>
        </div>

        <!-- Tabs -->
        <div class="mb-4 flex flex-wrap gap-2 border-b border-primary/30 pb-2">
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

        <!-- Tab: Overview (default) -->
        <div v-show="activeTab === 'overview'" class="space-y-6">
          <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
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
            <div v-else-if="overviewData" class="space-y-6">
              <!-- Fast Stats encarts (style LeagueOfGraphs avec nos couleurs) -->
              <div class="grid gap-4 sm:grid-cols-2">
                <!-- Champions les plus choisis -->
                <div class="fast-stat-card rounded-lg border border-primary/30 bg-surface/30 p-4">
                  <h3 class="fast-stat-title mb-2 text-base font-semibold text-text">
                    {{ t('statisticsPage.fastStatsMostPicked') }}
                    <span
                      class="relative ml-1 inline-flex cursor-help text-text/50"
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
                  </h3>
                  <table
                    v-if="(overviewData.topPickrateChampions ?? []).length"
                    class="fast-stat-table w-full text-sm"
                  >
                    <tbody>
                      <tr
                        v-for="(row, idx) in (overviewData.topPickrateChampions ?? []).slice(0, 5)"
                        :key="row.championId"
                        class="fast-stat-row"
                      >
                        <td class="py-1">
                          <div class="flex items-center gap-2">
                            <span class="w-6 shrink-0 text-text/70">{{ idx + 1 }}.</span>
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
                              width="20"
                              height="20"
                            />
                            <span class="min-w-0 truncate text-sm font-medium text-text">{{
                              championName(row.championId) || row.championId
                            }}</span>
                          </div>
                        </td>
                        <td class="w-[140px] py-1 pl-2">
                          <div class="flex items-center justify-end gap-2">
                            <div
                              class="fast-stat-bar-container h-2 w-[110px] overflow-hidden rounded bg-surface/80"
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
                            <span class="min-w-[2.5rem] text-right text-sm font-medium text-text"
                              >{{ Number(row.pickrate).toFixed(2) }}%</span
                            >
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else class="py-6 text-center text-text/60">
                    {{ t('statisticsPage.fastStatsNoData') }}
                  </div>
                  <div
                    v-if="(overviewData.topPickrateChampions ?? []).length"
                    class="mt-2 text-center"
                  >
                    <button
                      type="button"
                      class="fast-stat-button rounded bg-accent px-3 py-1.5 text-xs font-medium text-background transition-colors hover:opacity-90"
                      @click="goToChampionsWithSort('pickrate')"
                    >
                      {{ t('statisticsPage.fastStatsSeeMore') }}
                    </button>
                  </div>
                </div>

                <!-- Meilleurs champions -->
                <div class="fast-stat-card rounded-lg border border-primary/30 bg-surface/30 p-4">
                  <h3 class="fast-stat-title mb-2 text-base font-semibold text-text">
                    {{ t('statisticsPage.fastStatsBestWinrate') }}
                    <span
                      class="relative ml-1 inline-flex cursor-help text-text/50"
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
                  </h3>
                  <table
                    v-if="(overviewData.topWinrateChampions ?? []).length"
                    class="fast-stat-table w-full text-sm"
                  >
                    <tbody>
                      <tr
                        v-for="(row, idx) in (overviewData.topWinrateChampions ?? []).slice(0, 5)"
                        :key="row.championId"
                        class="fast-stat-row"
                      >
                        <td class="py-1">
                          <div class="flex items-center gap-2">
                            <span class="w-6 shrink-0 text-text/70">{{ idx + 1 }}.</span>
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
                              width="20"
                              height="20"
                            />
                            <span class="min-w-0 truncate text-sm font-medium text-text">{{
                              championName(row.championId) || row.championId
                            }}</span>
                          </div>
                        </td>
                        <td class="w-[140px] py-1 pl-2">
                          <div class="flex items-center justify-end gap-2">
                            <div
                              class="fast-stat-bar-container h-2 w-[110px] overflow-hidden rounded bg-surface/80"
                            >
                              <div
                                class="h-full rounded bg-success transition-[width]"
                                :style="{
                                  width: (() => {
                                    const list = overviewData.topWinrateChampions ?? []
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
                            <span class="min-w-[2.5rem] text-right text-sm font-medium text-text"
                              >{{ Number(row.winrate).toFixed(2) }}%</span
                            >
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else class="py-6 text-center text-text/60">
                    {{ t('statisticsPage.fastStatsNoData') }}
                  </div>
                  <div
                    v-if="(overviewData.topWinrateChampions ?? []).length"
                    class="mt-2 text-center"
                  >
                    <button
                      type="button"
                      class="fast-stat-button rounded bg-accent px-3 py-1.5 text-xs font-medium text-background transition-colors hover:opacity-90"
                      @click="goToChampionsWithSort('winrate')"
                    >
                      {{ t('statisticsPage.fastStatsSeeMore') }}
                    </button>
                  </div>
                </div>

                <!-- Champions les plus bannis -->
                <div class="fast-stat-card rounded-lg border border-primary/30 bg-surface/30 p-4">
                  <h3 class="fast-stat-title mb-2 text-base font-semibold text-text">
                    {{ t('statisticsPage.fastStatsMostBanned') }}
                    <span
                      class="relative ml-1 inline-flex cursor-help text-text/50"
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
                  </h3>
                  <table
                    v-if="overviewEffectiveTopBanrateChampions.length"
                    class="fast-stat-table w-full text-sm"
                  >
                    <tbody>
                      <tr
                        v-for="(row, idx) in overviewEffectiveTopBanrateChampions.slice(0, 5)"
                        :key="row.championId"
                        class="fast-stat-row"
                      >
                        <td class="py-1">
                          <div class="flex items-center gap-2">
                            <span class="w-6 shrink-0 text-text/70">{{ idx + 1 }}.</span>
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
                              width="20"
                              height="20"
                            />
                            <span class="min-w-0 truncate text-sm font-medium text-text">{{
                              championName(row.championId) || row.championId
                            }}</span>
                          </div>
                        </td>
                        <td class="w-[140px] py-1 pl-2">
                          <div class="flex items-center justify-end gap-2">
                            <div
                              class="fast-stat-bar-container h-2 w-[110px] overflow-hidden rounded bg-surface/80"
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
                            <span class="min-w-[2.5rem] text-right text-sm font-medium text-text"
                              >{{ Number(row.banrate).toFixed(2) }}%</span
                            >
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else class="py-6 text-center text-text/60">
                    {{ t('statisticsPage.fastStatsNoData') }}
                  </div>
                  <div v-if="overviewEffectiveTopBanrateChampions.length" class="mt-2 text-center">
                    <button
                      type="button"
                      class="fast-stat-button rounded bg-accent px-3 py-1.5 text-xs font-medium text-background transition-colors hover:opacity-90"
                      @click="goToChampionsWithSort('banrate')"
                    >
                      {{ t('statisticsPage.fastStatsSeeMore') }}
                    </button>
                  </div>
                </div>

                <!-- Winrates depuis X -->
                <div class="fast-stat-card rounded-lg border border-primary/30 bg-surface/30 p-4">
                  <h3 class="fast-stat-title mb-2 text-base font-semibold text-text">
                    {{
                      oldestVersionForProgression
                        ? t('statisticsPage.fastStatsWinrateSince', {
                            version: oldestVersionForProgression,
                          })
                        : t('statisticsPage.fastStatsWinrateProgression')
                    }}
                    <span
                      class="relative ml-1 inline-flex cursor-help text-text/50"
                      aria-hidden="true"
                    >
                      ⓘ
                      <span
                        role="tooltip"
                        class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden min-w-[14rem] max-w-[26rem] -translate-x-1/2 rounded border border-primary/40 bg-surface/100 px-3 py-2 text-left text-xs font-normal leading-snug text-text shadow-lg group-hover/tooltip:block"
                      >
                        {{ t('statisticsPage.tooltipFastStatsWinrateSince') }}
                      </span>
                    </span>
                  </h3>
                  <table
                    v-if="
                      (overviewProgressionData?.gainers?.length ?? 0) +
                        (overviewProgressionData?.losers?.length ?? 0) >
                      0
                    "
                    class="fast-stat-table w-full text-sm"
                  >
                    <tbody>
                      <template
                        v-for="g in (overviewProgressionData?.gainers ?? []).slice(0, 3)"
                        :key="'g-' + g.championId"
                      >
                        <tr class="fast-stat-row">
                          <td class="py-1">
                            <div class="flex items-center gap-2">
                              <img
                                v-if="gameVersion && championByKey(g.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(g.championId)!.image.full
                                  )
                                "
                                :alt="championName(g.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                                width="20"
                                height="20"
                              />
                              <span class="min-w-0 truncate text-sm font-medium text-text">{{
                                championName(g.championId) || g.championId
                              }}</span>
                            </div>
                          </td>
                          <td class="w-[140px] py-1 pl-2">
                            <div class="flex items-center justify-end gap-2">
                              <div
                                class="fast-stat-bar-container h-2 w-[110px] overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-success transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        (Math.abs(g.delta) /
                                          Math.max(
                                            ...[
                                              ...(overviewProgressionData?.gainers ?? []).map(g2 =>
                                                Math.abs(g2.delta)
                                              ),
                                              ...(overviewProgressionData?.losers ?? []).map(l =>
                                                Math.abs(l.delta)
                                              ),
                                            ],
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span
                                class="min-w-[2.5rem] text-right text-sm font-medium text-success"
                                >+{{ Number(g.delta).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </template>
                      <tr
                        v-if="
                          (overviewProgressionData?.gainers?.length ?? 0) +
                            (overviewProgressionData?.losers?.length ?? 0) >
                          0
                        "
                        class="border-b border-primary/20"
                      >
                        <td colspan="2" class="py-1"><div class="h-px bg-primary/20" /></td>
                      </tr>
                      <template
                        v-for="l in (overviewProgressionData?.losers ?? []).slice(0, 3)"
                        :key="'l-' + l.championId"
                      >
                        <tr class="fast-stat-row">
                          <td class="py-1">
                            <div class="flex items-center gap-2">
                              <img
                                v-if="gameVersion && championByKey(l.championId)"
                                :src="
                                  getChampionImageUrl(
                                    gameVersion,
                                    championByKey(l.championId)!.image.full
                                  )
                                "
                                :alt="championName(l.championId) || ''"
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                                width="20"
                                height="20"
                              />
                              <span class="min-w-0 truncate text-sm font-medium text-text">{{
                                championName(l.championId) || l.championId
                              }}</span>
                            </div>
                          </td>
                          <td class="w-[140px] py-1 pl-2">
                            <div class="flex items-center justify-end gap-2">
                              <div
                                class="fast-stat-bar-container h-2 w-[110px] overflow-hidden rounded bg-surface/80"
                              >
                                <div
                                  class="h-full rounded bg-error transition-[width]"
                                  :style="{
                                    width:
                                      Math.min(
                                        100,
                                        (Math.abs(l.delta) /
                                          Math.max(
                                            ...[
                                              ...(overviewProgressionData?.gainers ?? []).map(g2 =>
                                                Math.abs(g2.delta)
                                              ),
                                              ...(overviewProgressionData?.losers ?? []).map(l2 =>
                                                Math.abs(l2.delta)
                                              ),
                                            ],
                                            1
                                          )) *
                                          100
                                      ) + '%',
                                  }"
                                />
                              </div>
                              <span class="min-w-[2.5rem] text-right text-sm font-medium text-error"
                                >{{ Number(l.delta).toFixed(2) }}%</span
                              >
                            </div>
                          </td>
                        </tr>
                      </template>
                      <tr
                        v-if="
                          !overviewProgressionData?.gainers?.length &&
                          !overviewProgressionData?.losers?.length
                        "
                      >
                        <td colspan="2" class="py-3 text-center text-text/60">
                          {{ t('statisticsPage.fastStatsNoProgression') }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else class="py-6 text-center text-text/60">
                    {{ t('statisticsPage.fastStatsNoProgression') }}
                  </div>
                </div>

                <!-- Bans par équipe gagnante -->
                <div
                  v-if="overviewTeamsData && overviewTeamsData.matchCount > 0"
                  class="fast-stat-card rounded-lg border border-primary/30 bg-surface/30 p-4"
                >
                  <h3 class="fast-stat-title mb-2 text-base font-semibold text-text">
                    {{ t('statisticsPage.overviewTeamsBansByWin') }}
                  </h3>
                  <table
                    v-if="(overviewTeamsData.bans.byWin ?? []).length"
                    class="fast-stat-table w-full text-sm"
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
                        <td class="py-1">
                          <div class="flex items-center gap-2">
                            <span class="w-6 shrink-0 text-text/70">{{ idx + 1 }}.</span>
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
                              width="20"
                              height="20"
                            />
                            <span class="min-w-0 truncate text-sm font-medium text-text">{{
                              championName(b.championId) || b.championId
                            }}</span>
                          </div>
                        </td>
                        <td class="w-[140px] py-1 pl-2">
                          <div class="flex items-center justify-end gap-2">
                            <div
                              class="fast-stat-bar-container h-2 w-[110px] overflow-hidden rounded bg-surface/80"
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
                            <span class="min-w-[2.5rem] text-right text-sm font-medium text-text">{{
                              b.banRatePercent
                            }}</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-if="(overviewTeamsData.bans.byWin ?? []).length" class="mt-2 text-center">
                    <button
                      v-if="(overviewTeamsData.bans.byWin ?? []).length > 5"
                      type="button"
                      class="fast-stat-button rounded bg-accent px-3 py-1.5 text-xs font-medium text-background transition-colors hover:opacity-90"
                      @click="bansExpandByWin = !bansExpandByWin"
                    >
                      {{
                        bansExpandByWin
                          ? t('statisticsPage.showLess')
                          : t('statisticsPage.fastStatsSeeMore')
                      }}
                    </button>
                  </div>
                </div>

                <!-- Bans par équipe perdante -->
                <div
                  v-if="overviewTeamsData && overviewTeamsData.matchCount > 0"
                  class="fast-stat-card rounded-lg border border-primary/30 bg-surface/30 p-4"
                >
                  <h3 class="fast-stat-title mb-2 text-base font-semibold text-text">
                    {{ t('statisticsPage.overviewTeamsBansByLoss') }}
                  </h3>
                  <table
                    v-if="(overviewTeamsData.bans.byLoss ?? []).length"
                    class="fast-stat-table w-full text-sm"
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
                        <td class="py-1">
                          <div class="flex items-center gap-2">
                            <span class="w-6 shrink-0 text-text/70">{{ idx + 1 }}.</span>
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
                              width="20"
                              height="20"
                            />
                            <span class="min-w-0 truncate text-sm font-medium text-text">{{
                              championName(b.championId) || b.championId
                            }}</span>
                          </div>
                        </td>
                        <td class="w-[140px] py-1 pl-2">
                          <div class="flex items-center justify-end gap-2">
                            <div
                              class="fast-stat-bar-container h-2 w-[110px] overflow-hidden rounded bg-surface/80"
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
                            <span class="min-w-[2.5rem] text-right text-sm font-medium text-text">{{
                              b.banRatePercent
                            }}</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-if="(overviewTeamsData.bans.byLoss ?? []).length" class="mt-2 text-center">
                    <button
                      v-if="(overviewTeamsData.bans.byLoss ?? []).length > 5"
                      type="button"
                      class="fast-stat-button rounded bg-accent px-3 py-1.5 text-xs font-medium text-background transition-colors hover:opacity-90"
                      @click="bansExpandByLoss = !bansExpandByLoss"
                    >
                      {{
                        bansExpandByLoss
                          ? t('statisticsPage.showLess')
                          : t('statisticsPage.fastStatsSeeMore')
                      }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="grid gap-4 lg:grid-cols-2">
                <div
                  v-if="overviewTeamsData && overviewTeamsData.matchCount > 0"
                  class="rounded-lg border border-primary/30 bg-surface/30 p-6"
                >
                  <h3
                    class="group/tooltip mb-3 flex items-center gap-1.5 text-lg font-medium text-text"
                  >
                    {{ t('statisticsPage.overviewTeamsObjectives') }}
                    <span class="relative inline-flex cursor-help text-text/50" aria-hidden="true">
                      ⓘ
                      <span
                        role="tooltip"
                        class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden min-w-[14rem] max-w-[26rem] -translate-x-1/2 rounded border border-primary/40 bg-surface/100 px-3 py-2 text-left text-xs font-normal leading-snug text-text shadow-lg group-hover/tooltip:block"
                      >
                        {{ t('statisticsPage.tooltipOverviewObjectives') }}
                      </span>
                    </span>
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
                </div>
              </div>
            </div>
            <div v-else class="text-text/70">{{ t('statisticsPage.overviewNoData') }}</div>
          </div>
        </div>

        <!-- Tab: Runes, items, sorts (chargé à l'ouverture de l'onglet) -->
        <div v-show="activeTab === 'detail'" class="space-y-6">
          <template v-if="overviewDetailPending">
            <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
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
                <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
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
                <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
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
                <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
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
                <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
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
        <div v-show="activeTab === 'progressions'" class="space-y-6">
          <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
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
        <div v-show="activeTab === 'sides'" class="space-y-6">
          <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
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
                        v-for="c in overviewSidesData.championWinrateBySide.blue.slice(
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
                      v-if="overviewSidesData.championWinrateBySide.blue.length > 5"
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
                        v-for="c in overviewSidesData.championWinrateBySide.red.slice(
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
                      v-if="overviewSidesData.championWinrateBySide.red.length > 5"
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
                              overviewSidesData.objectivesBySideTable?.firstBlood?.firstByBlue ?? 0,
                              overviewSidesData.objectivesBySideTable?.firstBlood?.firstByRed ?? 0,
                              overviewSidesData.matchCount
                            ).blue
                          }}
                        </td>
                        <td class="py-1.5 text-center">
                          {{
                            firstPercentBySide(
                              overviewSidesData.objectivesBySideTable?.firstBlood?.firstByBlue ?? 0,
                              overviewSidesData.objectivesBySideTable?.firstBlood?.firstByRed ?? 0,
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
                        v-for="b in overviewSidesData.bansBySide.blue.slice(
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
                      v-if="overviewSidesData.bansBySide.blue.length > 5"
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
                        v-for="b in overviewSidesData.bansBySide.red.slice(
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
                      v-if="overviewSidesData.bansBySide.red.length > 5"
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
        <div v-show="activeTab === 'champions'" class="space-y-4">
          <div v-if="championsPending" class="text-text/70">{{ t('statisticsPage.loading') }}</div>
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
                  <th class="px-4 py-3 font-semibold text-text">
                    {{ t('statisticsPage.champion') }}
                  </th>
                  <th
                    class="cursor-pointer select-none px-4 py-3 font-semibold text-text transition-[box-shadow]"
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
                    class="cursor-pointer select-none px-4 py-3 font-semibold text-text transition-[box-shadow]"
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
                    class="cursor-pointer select-none px-4 py-3 font-semibold text-text transition-[box-shadow]"
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
                    class="cursor-pointer select-none px-4 py-3 font-semibold text-text transition-[box-shadow]"
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
                    class="cursor-pointer select-none px-4 py-3 font-semibold text-text transition-[box-shadow]"
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
                  <td class="px-4 py-2 text-text/90">{{ row.games }}</td>
                  <td class="px-4 py-2 text-text/90">{{ row.wins }}</td>
                  <td class="px-4 py-2 text-text/90">{{ Number(row.winrate).toFixed(2) }}%</td>
                  <td class="px-4 py-2 text-text/90">{{ Number(row.pickrate).toFixed(2) }}%</td>
                  <td class="px-4 py-2 text-text/90">
                    {{ row.banrate != null ? Number(row.banrate).toFixed(2) + '%' : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div
              v-if="totalChampionsCount > 0"
              class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
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
          <div v-if="championsPending" class="text-text/70">{{ t('statisticsPage.loading') }}</div>
          <div
            v-else-if="championsError"
            class="rounded border border-error bg-surface p-3 text-error"
          >
            {{ championsError }}
          </div>
          <template v-else>
            <!-- Vue tableau -->
            <div
              v-show="tierListViewModel === 'table'"
              class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30"
            >
              <table class="w-full min-w-[500px] text-left text-sm">
                <thead class="border-b border-primary/30 bg-surface/50">
                  <tr>
                    <th class="px-4 py-3 font-semibold text-text">
                      {{ t('statisticsPage.champion') }}
                    </th>
                    <th
                      class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                      @click="setTierListSort('tier')"
                    >
                      {{ t('statisticsPage.tierListTier') }}
                      <span v-if="tierListSortOrder === 'tier'" class="ml-1">{{
                        tierListSortDir === 'desc' ? '↓' : '↑'
                      }}</span>
                    </th>
                    <th
                      class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                      @click="setTierListSort('winrate')"
                    >
                      {{ t('statisticsPage.winrate') }}
                      <span v-if="tierListSortOrder === 'winrate'" class="ml-1">{{
                        tierListSortDir === 'desc' ? '↓' : '↑'
                      }}</span>
                    </th>
                    <th
                      class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                      @click="setTierListSort('pickrate')"
                    >
                      {{ t('statisticsPage.pickrate') }}
                      <span v-if="tierListSortOrder === 'pickrate'" class="ml-1">{{
                        tierListSortDir === 'desc' ? '↓' : '↑'
                      }}</span>
                    </th>
                    <th
                      class="cursor-pointer select-none px-4 py-3 font-semibold text-text hover:bg-primary/20"
                      @click="setTierListSort('banrate')"
                    >
                      {{ t('statisticsPage.banrate') }}
                      <span v-if="tierListSortOrder === 'banrate'" class="ml-1">{{
                        tierListSortDir === 'desc' ? '↓' : '↑'
                      }}</span>
                    </th>
                    <th class="px-4 py-3 font-semibold text-text">
                      {{ t('statisticsPage.tierListRole') }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-primary/20">
                  <tr
                    v-for="row in paginatedTierList"
                    :key="row.championId"
                    class="cursor-pointer hover:bg-surface/50"
                    @click="navigateTo(localePath('/statistics/champion/' + row.championId))"
                  >
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
                          row.tier === 'S' && 'bg-amber-500',
                          row.tier === 'A' && 'bg-slate-400',
                          row.tier === 'B' && 'bg-amber-700',
                          row.tier === 'C' && 'bg-stone-600',
                          row.tier === 'F' && 'bg-stone-700',
                        ]"
                      >
                        {{ t('statisticsPage.tier' + row.tier) }}
                      </span>
                    </td>
                    <td class="px-4 py-2 text-text/90">{{ Number(row.winrate).toFixed(2) }}%</td>
                    <td class="px-4 py-2 text-text/90">{{ Number(row.pickrate).toFixed(2) }}%</td>
                    <td class="px-4 py-2 text-text/90">
                      {{ row.banrate != null ? Number(row.banrate).toFixed(2) + '%' : '—' }}
                    </td>
                    <td class="px-4 py-2 text-xs text-text/70">{{ row.primaryRole ?? '—' }}</td>
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
              v-show="tierListViewModel === 'chart'"
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
                      ' – ' +
                      Number(c.winrate).toFixed(2) +
                      '%'
                    "
                  >
                    <div class="flex min-h-[52px] flex-1 flex-col items-center justify-end">
                      <div
                        v-if="c.score >= 0"
                        class="tier-bar tier-bar-up w-6 shrink-0 rounded-t"
                        :style="{
                          height: c.barHeight * 0.52 + 'px',
                          minHeight: c.score > 0 ? '4px' : '0',
                          backgroundColor: TIER_CHART_COLORS[c.tier],
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
                        v-if="c.score < 0"
                        class="tier-bar tier-bar-down w-6 shrink-0 rounded-b"
                        :style="{
                          height: c.barHeight * 0.52 + 'px',
                          minHeight: c.score < 0 ? '4px' : '0',
                          backgroundColor: TIER_CHART_COLORS[c.tier],
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
          <p class="text-sm text-text/80">{{ t('statisticsPage.durationDescription') }}</p>
          <div
            v-if="overviewDurationWinratePending || !overviewDurationWinrateData?.buckets?.length"
            class="text-text/70"
          >
            {{ t('statisticsPage.loading') }}
          </div>
          <div
            v-else-if="durationWinrateChartBuckets.length"
            class="relative flex justify-center rounded-lg border border-primary/30 bg-surface/30 p-4"
          >
            <div class="relative inline-block min-h-[260px] w-full max-w-[600px]">
              <svg
                :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
                class="h-auto w-full"
                :width="CHART_W"
                :height="CHART_H"
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
                    {{ tick.value }}%
                  </text>
                </g>
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
                  {{ Number(durationChartTooltip.winrate).toFixed(2) }}%
                  {{ t('statisticsPage.winrate') }}
                </div>
                <div class="text-text/70">
                  {{ durationChartTooltip.matchCount }}
                  {{ t('statisticsPage.championStatsDurationWinrateTooltipMatches') }}
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
                {{ overviewAbandonsData.surrenderCount }} / {{ overviewAbandonsData.totalMatches }}
              </div>
            </div>
          </div>
          <div v-else class="text-text/70">{{ t('statisticsPage.noData') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '~/utils/apiUrl'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useGameVersion } from '~/composables/useGameVersion'
import {
  getChampionImageUrl,
  getItemImageUrl,
  getRuneImageUrl,
  getSpellImageUrl,
} from '~/utils/imageUrl'

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
const { version: gameVersion } = useGameVersion()

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const activeTab = ref<
  | 'overview'
  | 'progressions'
  | 'sides'
  | 'champions'
  | 'tierlist'
  | 'duration'
  | 'items'
  | 'spells'
  | 'abandons'
  | 'detail'
>('overview')
const tabs = computed(() => [
  { id: 'overview' as const, label: t('statisticsPage.tabOverview') },
  { id: 'tierlist' as const, label: t('statisticsPage.tabTierList') },
  { id: 'champions' as const, label: t('statisticsPage.tabChampions') },
  { id: 'duration' as const, label: t('statisticsPage.tabDuration') },
  { id: 'items' as const, label: t('statisticsPage.tabItems') },
  { id: 'spells' as const, label: t('statisticsPage.tabSummonerSpells') },
  { id: 'abandons' as const, label: t('statisticsPage.tabAbandons') },
  { id: 'progressions' as const, label: t('statisticsPage.tabProgressions') },
  { id: 'sides' as const, label: t('statisticsPage.tabSides') },
  { id: 'detail' as const, label: t('statisticsPage.tabRunesItemsSpells') },
])

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
/** Navigate to Champions tab with sort (filtres déjà partagés). */
function goToChampionsWithSort(sort: 'winrate' | 'pickrate' | 'banrate') {
  championsSortOrder.value = sort
  activeTab.value = 'champions'
}

/** Tier list: assign S/A/B/C/F by winrate percentiles (top 10% = S, next 20% = A, 30% B, 25% C, rest F). */
type Tier = 'S' | 'A' | 'B' | 'C' | 'F'
function computeTiers(
  champions: Array<{
    championId: number
    winrate: number
    pickrate: number
    banrate?: number
    byRole?: Record<string, { games: number }>
  }>
): Array<{
  championId: number
  winrate: number
  pickrate: number
  banrate?: number
  tier: Tier
  primaryRole: string | null
}> {
  if (!champions.length) return []
  const sorted = [...champions].sort((a, b) => b.winrate - a.winrate)
  const n = sorted.length
  const pct = (i: number) => Math.floor((i / n) * 100)
  const tierRanges: Array<{ tier: Tier; maxPct: number }> = [
    { tier: 'S', maxPct: 10 },
    { tier: 'A', maxPct: 30 },
    { tier: 'B', maxPct: 60 },
    { tier: 'C', maxPct: 85 },
    { tier: 'F', maxPct: 100 },
  ]
  return sorted.map((c, i) => {
    const p = pct(i)
    let tier: Tier = 'F'
    for (const r of tierRanges) {
      if (p < r.maxPct) {
        tier = r.tier
        break
      }
    }
    const byRole = (c as { byRole?: Record<string, { games: number }> }).byRole
    let primaryRole: string | null = null
    if (byRole && typeof byRole === 'object') {
      const entries = Object.entries(byRole)
      if (entries.length) {
        const best = entries.reduce((a, b) => (b[1].games > a[1].games ? b : a))
        primaryRole = best[0]
      }
    }
    return {
      championId: c.championId,
      winrate: c.winrate,
      pickrate: c.pickrate,
      banrate: c.banrate,
      tier,
      primaryRole,
    }
  })
}

const tierListViewModel = ref<'table' | 'chart'>('table')
const tierListSortOrder = ref<'winrate' | 'pickrate' | 'banrate' | 'tier' | 'games'>('winrate')
const tierListSortDir = ref<'asc' | 'desc'>('desc')
const tierListPage = ref(1)
const TIER_ORDER: Record<Tier, number> = { S: 5, A: 4, B: 3, C: 2, F: 1 }
const championsWithTier = computed(() => {
  const list = championsData.value?.champions ?? []
  return computeTiers(
    list as Array<{
      championId: number
      winrate: number
      pickrate: number
      banrate?: number
      byRole?: Record<string, { games: number }>
    }>
  )
})
const sortedChampionsWithTier = computed(() => {
  const list = championsWithTier.value
  const sort = tierListSortOrder.value
  const dir = tierListSortDir.value
  const mult = dir === 'desc' ? 1 : -1
  return [...list].sort((a, b) => {
    let diff = 0
    if (sort === 'tier') diff = (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0)
    else if (sort === 'winrate') diff = (b.winrate ?? 0) - (a.winrate ?? 0)
    else if (sort === 'pickrate') diff = (b.pickrate ?? 0) - (a.pickrate ?? 0)
    else if (sort === 'banrate') diff = (b.banrate ?? 0) - (a.banrate ?? 0)
    else diff = 0
    return mult * diff
  })
})
const totalTierListCount = computed(() => sortedChampionsWithTier.value.length)
const totalTierListPages = computed(() =>
  Math.max(1, Math.ceil(totalTierListCount.value / championsPageSize.value))
)
const paginatedTierList = computed(() => {
  const list = sortedChampionsWithTier.value
  const size = championsPageSize.value
  const page = Math.min(tierListPage.value, Math.max(1, Math.ceil(list.length / size) || 1))
  const start = (page - 1) * size
  return list.slice(start, start + size)
})
/** Tier list bar chart: champions ordered by winrate (worst to best), score = (winrate - 50) for bar height. */
const tierListBarChartData = computed(() => {
  const list = [...championsWithTier.value].sort((a, b) => a.winrate - b.winrate)
  const minWr = Math.min(...list.map(c => c.winrate), 50)
  const maxWr = Math.max(...list.map(c => c.winrate), 50)
  const range = Math.max(maxWr - 50, 50 - minWr, 1)
  return list.map(c => ({
    ...c,
    score: c.winrate - 50,
    barHeight: (Math.abs(c.winrate - 50) / range) * 100,
  }))
})
const TIER_CHART_COLORS: Record<Tier, string> = {
  S: '#eab308',
  A: '#38bdf8',
  B: '#a78bfa',
  C: '#fb923c',
  F: '#dc2626',
}
function setTierListSort(col: 'tier' | 'winrate' | 'pickrate' | 'banrate') {
  if (tierListSortOrder.value === col) {
    tierListSortDir.value = tierListSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    tierListSortOrder.value = col
    tierListSortDir.value = 'desc'
  }
}
watch([tierListSortOrder, tierListSortDir, championsPageSize], () => {
  tierListPage.value = 1
})

function formatGeneratedAt(value: string | null | undefined): string {
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
const statsDivisionFilter = ref('')
const statsRoleFilter = ref('')
const filtersOpen = ref(false)
/** Alias pour compatibilité avec l’overview (requête utilise version/rankTier). */
const overviewVersionFilter = computed(() => statsVersionFilter.value || null)
const overviewDivisionFilter = computed(() => statsDivisionFilter.value || null)
/** Résumé versions (version + nb parties) pour la description en haut de page. */
const overviewDescriptionVersionsSummary = computed(() => {
  const list = overviewData.value?.matchesByVersion ?? []
  if (!list.length) return ''
  return list.map(v => `${v.version} (${v.matchCount})`).join(', ')
})
/** Divisions à afficher dans la description (sans UNRANKED). */
const overviewDivisionsForDescription = computed(() => {
  const list = overviewData.value?.matchesByDivision ?? []
  return list.filter(d => d.rankTier !== 'UNRANKED')
})
/** Pourcentage de parties pour une division (sur le total des divisions). */
function divisionPercent(d: { matchCount: number }): string {
  const divisions = overviewData.value?.matchesByDivision ?? []
  const total = divisions.reduce((s, x) => s + (x.matchCount ?? 0), 0)
  if (!total) return '0'
  return (Math.round((d.matchCount / total) * 10000) / 100).toFixed(2)
}
function toggleRoleFilter(r: (typeof roles)[number]) {
  statsRoleFilter.value = statsRoleFilter.value === r.value ? '' : r.value
  onStatsFilterChange()
}
function onStatsFilterChange() {
  overviewDetailData.value = null
  overviewDetailError.value = false
  if (activeTab.value === 'overview') loadOverview()
  if (activeTab.value === 'sides') loadOverviewSides()
  if (activeTab.value === 'champions') loadChampions()
  if (activeTab.value === 'detail') loadOverviewDetail()
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
  if (statsDivisionFilter.value) params.set('rankTier', statsDivisionFilter.value)
  const q = params.toString()
  return q ? '?' + q : ''
}
const STATS_FETCH_TIMEOUT_MS = 90_000

/** Logs de perf (dev only) pour identifier ce qui ralentit l’affichage des stats. */
const STATS_PERF = import.meta.dev
function statsPerfStart(label: string): number {
  if (!STATS_PERF) return 0
  // eslint-disable-next-line no-console
  console.log('[Stats perf]', label, 'start')
  return performance.now()
}
function statsPerfEnd(label: string, start: number) {
  if (!STATS_PERF || start === 0) return
  // eslint-disable-next-line no-console
  console.log('[Stats perf]', label, Math.round(performance.now() - start) + 'ms')
}

/** Fetch stats API and log backend timing from X-Backend-Time / X-Stats-Path (tout au même endroit que les logs front). */
function statsFetch<T = unknown>(url: string, options?: Parameters<typeof $fetch>[1]): Promise<T> {
  const existingOnResponse = (options as { onResponse?: (ctx: { response: Response }) => void })
    ?.onResponse
  return $fetch(url, {
    ...options,
    onResponse: ctx => {
      if (STATS_PERF && ctx.response?.headers) {
        const backendMs = ctx.response.headers.get('X-Backend-Time')
        const sqlMs = ctx.response.headers.get('X-SQL-Time')
        const path = ctx.response.headers.get('X-Stats-Path') || url
        if (backendMs) {
          // eslint-disable-next-line no-console
          console.log(
            '[Stats perf] backend',
            path,
            backendMs + 'ms' + (sqlMs ? ' (SQL ' + sqlMs + 'ms)' : '')
          )
        }
      }
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
    if (
      import.meta.dev &&
      overviewRes &&
      typeof overviewRes === 'object' &&
      'totalMatches' in overviewRes
    ) {
      // eslint-disable-next-line no-console
      console.log(
        '[stats/overview]',
        (overviewRes as { totalMatches: number }).totalMatches,
        'matches'
      )
    }
    loadOverviewTeams()
    loadOverviewDurationWinrate()
    loadOverviewProgression()
  } catch (err) {
    const url = baseUrl + '/overview' + query
    // eslint-disable-next-line no-console
    console.error('[stats/overview] fetch failed', url, err)
    overviewData.value = null
    overviewError.value =
      err instanceof Error
        ? err.message
        : 'Impossible de charger les statistiques (vérifiez que le backend est démarré).'
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
/** Progression: WR delta from oldest version to all since. For "Winrate depuis X" encart. */
const overviewProgressionData = ref<{
  oldestVersion: string | null
  gainers: Array<{ championId: number; wrOldest: number; wrSince: number; delta: number }>
  losers: Array<{ championId: number; wrOldest: number; wrSince: number; delta: number }>
} | null>(null)
async function loadOverviewProgression() {
  const oldest = oldestVersionForProgression.value
  if (!oldest) {
    overviewProgressionData.value = null
    return
  }
  const t = statsPerfStart('loadOverviewProgression')
  const params = new URLSearchParams()
  params.set('version', oldest)
  if (overviewDivisionFilter.value) params.set('rankTier', overviewDivisionFilter.value)
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
/** Version to use for progression: selected version, oldest from matchesByVersion, or current game version. */
const oldestVersionForProgression = computed(() => {
  if (overviewVersionFilter.value) return overviewVersionFilter.value
  const versions = overviewData.value?.matchesByVersion ?? []
  if (versions.length) {
    const sorted = [...versions].sort((a, b) => a.version.localeCompare(b.version))
    const first = sorted[0]?.version
    if (first) return first
  }
  return normalizeVersionToPrefix(versionStore.currentVersion)
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
  }>
} | null>(null)
const progressionFullPending = ref(false)
async function loadProgressionsFull() {
  const oldest = oldestVersionForProgression.value
  if (!oldest) {
    progressionFullData.value = null
    return
  }
  const t = statsPerfStart('loadProgressionsFull')
  progressionFullPending.value = true
  const params = new URLSearchParams()
  params.set('version', oldest)
  if (overviewDivisionFilter.value) params.set('rankTier', overviewDivisionFilter.value)
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

/** Points for line chart: X=duration, Y=winrate. Winrate à gauche, 0 en commun (bas-gauche). Courbe lissée (Catmull-Rom). */
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
  const sorted = [...buckets].sort((a, b) => a.durationMin - b.durationMin)
  const minDur = Math.min(...sorted.map(b => b.durationMin))
  const maxDur = Math.max(...sorted.map(b => b.durationMin + 5))
  const durRange = maxDur - minDur || 1
  const originY = CHART_PAD.top + PLOT_H
  const pts = sorted.map(b => {
    const midDur = b.durationMin + 2.5
    const x = CHART_PAD.left + ((midDur - minDur) / durRange) * PLOT_W
    const y = originY - (b.winrate / 100) * PLOT_H
    return {
      x,
      y,
      label: `${b.durationMin}-${b.durationMin + 5} min: ${Number(b.winrate).toFixed(2)}% WR (${b.matchCount})`,
      durationLabel: `${b.durationMin}-${b.durationMin + 5} min`,
      winrate: b.winrate,
      matchCount: b.matchCount,
    }
  })
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
  for (let v = 0; v <= 100; v += 20) {
    axisYTicks.push({
      value: v,
      y: originY - (v / 100) * PLOT_H,
    })
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
} | null>(null)
const overviewTeamsPending = ref(false)
const bansExpandByWin = ref(false)
const bansExpandByLoss = ref(false)

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
const sidesExpandBlue = ref(false)
const sidesExpandRed = ref(false)
const sidesExpandPickBlue = ref(false)
const sidesExpandPickRed = ref(false)
const sidesExpandBansBlue = ref(false)
const sidesExpandBansRed = ref(false)
const sidesObjectiveKeysWithKills = ['baron', 'dragon', 'tower', 'inhibitor', 'horde'] as const
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
  return Object.entries(dist)
    .map(([k, n]) => ({
      count: parseInt(k, 10) || 0,
      percent: Math.round((Number(n) / total) * 10000) / 100,
    }))
    .filter(({ percent }) => percent > 0)
    .sort((a, b) => a.count - b.count)
}
function sidesObjectiveCounts(key: string): number[] {
  const blue = sidesObjectiveDistributionPercentages(key, true)
  const red = sidesObjectiveDistributionPercentages(key, false)
  const set = new Set<number>([...blue.map(r => r.count), ...red.map(r => r.count)])
  return [...set].sort((a, b) => a - b)
}
function percentForCountSides(key: string, count: number, byBlue: boolean): string {
  const rows = sidesObjectiveDistributionPercentages(key, byBlue)
  const row = rows.find(r => r.count === count)
  return row ? Number(row.percent).toFixed(2) + '%' : '—'
}
function sidesQueryParams(): string {
  const params = new URLSearchParams()
  if (statsVersionFilter.value) params.set('version', statsVersionFilter.value)
  if (statsDivisionFilter.value) params.set('rankTier', statsDivisionFilter.value)
  const s = params.toString()
  return s ? '?' + s : ''
}
/** Donut: circumference for r=48 */
const sidesDonutCircumference = 2 * Math.PI * 48
/** Nombre réel de matchs (1 victoire par match, donc blue.wins + red.wins). matchCount côté API = blue.matches + red.matches = 2× matchs. */
const sidesDonutTotalMatches = computed(() => {
  const data = overviewSidesData.value
  if (!data) return 0
  return data.sideWinrate.blue.wins + data.sideWinrate.red.wins
})
/** % de matchs gagnés par le côté bleu (bleu + rouge = 100%). */
const sidesDonutBluePct = computed(() => {
  const data = overviewSidesData.value
  const total = sidesDonutTotalMatches.value
  if (!data || !total) return '0.00'
  const pct = (data.sideWinrate.blue.wins / total) * 100
  return Number(pct).toFixed(2)
})
const sidesDonutRedPct = computed(() => {
  const data = overviewSidesData.value
  const total = sidesDonutTotalMatches.value
  if (!data || !total) return '0.00'
  const pct = (data.sideWinrate.red.wins / total) * 100
  return Number(pct).toFixed(2)
})
const sidesDonutBlueDash = computed(() => {
  const data = overviewSidesData.value
  const total = sidesDonutTotalMatches.value
  if (!data || !total) return 0
  const pct = data.sideWinrate.blue.wins / total
  return sidesDonutCircumference * pct
})
const sidesDonutRedDash = computed(() => {
  const data = overviewSidesData.value
  const total = sidesDonutTotalMatches.value
  if (!data || !total) return 0
  const pct = data.sideWinrate.red.wins / total
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
const overviewEffectiveTotalMatches = computed(() => {
  const total = overviewData.value?.totalMatches ?? 0
  if (total > 0) return total
  return overviewTeamsData.value?.matchCount ?? 0
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
/** Distribution as % of matches, sorted by count (number then percent). */
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
  return Object.entries(dist)
    .map(([k, n]) => ({
      count: parseInt(k, 10) || 0,
      percent: Math.round((Number(n) / total) * 10000) / 100,
    }))
    .filter(({ percent }) => percent > 0)
    .sort((a, b) => a.count - b.count)
}
/** All counts (0, 1, 2, …) for an objective, from both teams, sorted. */
function objectiveCounts(key: string): number[] {
  const win = objectiveDistributionPercentages(key, true)
  const loss = objectiveDistributionPercentages(key, false)
  const set = new Set<number>([...win.map(r => r.count), ...loss.map(r => r.count)])
  return [...set].sort((a, b) => a - b)
}
/** Percent for a given count and team (for dropdown content). */
function percentForCount(key: string, count: number, byWin: boolean): string {
  const rows = objectiveDistributionPercentages(key, byWin)
  const row = rows.find(r => r.count === count)
  return row ? Number(row.percent).toFixed(2) + '%' : '—'
}
const objectiveKeysWithKills = ['baron', 'dragon', 'tower', 'inhibitor', 'horde'] as const
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
  { value: 'UTILITY', label: 'Support', icon: '/icons/roles/support.png' },
]

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
const queryString = computed(() => {
  const params = new URLSearchParams()
  if (statsDivisionFilter.value) params.set('rankTier', statsDivisionFilter.value)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
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
watch([statsDivisionFilter, statsRoleFilter], () => {
  if (activeTab.value === 'champions' || activeTab.value === 'tierlist') loadChampions()
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

function itemImageName(itemId: number): string | null {
  const item = itemsStore.items.find(i => i.id === String(itemId))
  return item?.image?.full ?? null
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
  if (STATS_PERF) {
    // eslint-disable-next-line no-console
    console.log('[Stats perf] activeTab', tab)
  }
  if (tab === 'overview') loadOverview()
  if (tab === 'progressions') {
    if (!overviewData.value?.matchesByVersion?.length) await loadOverview()
    if (!oldestVersionForProgression.value && !versionStore.currentVersion)
      await versionStore.loadCurrentVersion()
    loadProgressionsFull()
  }
  if (tab === 'sides') loadOverviewSides()
  if (tab === 'tierlist' || tab === 'champions') loadChampions()
  if (tab === 'duration') loadOverviewDurationWinrate()
  if (tab === 'items' || tab === 'spells' || tab === 'detail') {
    if (!overviewDetailData.value && !overviewDetailPending.value) loadOverviewDetail()
  }
  if (tab === 'abandons') loadOverviewAbandons()
})
watch([statsVersionFilter, statsDivisionFilter], () => {
  if (activeTab.value === 'sides') loadOverviewSides()
  if (activeTab.value === 'progressions') loadProgressionsFull()
})

onMounted(async () => {
  const versionPromise = versionStore.currentVersion
    ? Promise.resolve()
    : versionStore.loadCurrentVersion()
  // Priorité: overview + champions (noms dans les cartes). Les stores runes/items/sorts
  // et la liste des champions (onglet) partent en arrière-plan pour ne pas saturer l’API.
  const tPage = statsPerfStart('page mount (version + overview + championsStore)')
  const tVersion = statsPerfStart('version')
  await versionPromise
  statsPerfEnd('version', tVersion)
  const tChampionsStore = statsPerfStart('championsStore.loadChampions')
  const tOverview = statsPerfStart('loadOverview')
  await Promise.all([
    championsStore
      .loadChampions(riotLocale.value)
      .then(() => statsPerfEnd('championsStore.loadChampions', tChampionsStore)),
    loadOverview().then(() => statsPerfEnd('loadOverview (initial)', tOverview)),
  ])
  statsPerfEnd('page mount', tPage)
  // Chargement en arrière-plan (sans bloquer le rendu)
  if (STATS_PERF) {
    // eslint-disable-next-line no-console
    console.log('[Stats perf] background: itemsStore, runesStore, summonerSpellsStore')
  }
  itemsStore.loadItems(riotLocale.value)
  runesStore.loadRunes(riotLocale.value)
  summonerSpellsStore.loadSummonerSpells(riotLocale.value)
  // Champions chargés à la demande à l’ouverture des onglets Champions / Tier list
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

/* Fast Stats cards - style LeagueOfGraphs */
.fast-stat-card {
  min-width: 0;
}
.fast-stat-title {
  line-height: 1.4;
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
}
.fast-stat-button {
  font-weight: 500;
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

.stats-role-btn:focus {
  outline: 2px solid rgb(var(--rgb-accent));
  outline-offset: 1px;
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
