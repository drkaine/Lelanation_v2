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
      @click="championFiltersOpen = false"
    />

    <!-- Retour au-dessus de la box filtre -->
    <div class="shrink-0 px-4 pt-4 lg:px-4 lg:pb-2">
      <NuxtLink
        :to="localePath('/statistics')"
        class="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
      >
        ← {{ t('statisticsPage.championStatsBack') }}
      </NuxtLink>
    </div>

    <div class="flex w-full min-w-0 flex-col lg:flex-row">
      <!-- Sidebar (même charte que page stats) -->
      <aside
        :class="[
          'fixed left-0 top-0 z-40 flex h-full w-64 shrink-0 flex-col rounded-r-lg border border-l-0 border-primary/30 bg-surface/30 shadow-lg transition-transform duration-200 lg:static lg:z-0 lg:translate-x-0 lg:rounded-lg lg:border lg:border-primary/30 lg:shadow-none',
          championFiltersOpen ? 'translate-x-0' : '-translate-x-full',
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
            @click="championFiltersOpen = false"
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
            <label for="champion-stat-version" class="mb-1 block text-sm font-medium text-text">
              {{ t('statisticsPage.filterVersion') }}
            </label>
            <select
              id="champion-stat-version"
              v-model="filterVersion"
              class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allVersions') }}</option>
              <option v-for="v in versionsFromOverview" :key="v.version" :value="v.version">
                {{ v.version }} ({{ v.matchCount }})
              </option>
            </select>
          </div>
          <div>
            <label for="champion-stat-rank" class="mb-1 block text-sm font-medium text-text">
              {{ t('statisticsPage.filterRank') }}
            </label>
            <select
              id="champion-stat-rank"
              v-model="filterRank"
              class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allRanks') }}</option>
              <option v-for="d in divisions" :key="d" :value="d">
                {{ d }}
              </option>
            </select>
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-text">
              {{ t('statisticsPage.filterRole') }}
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="opt in roleOptions"
                :key="opt.value"
                type="button"
                class="champion-role-filter-btn rounded border p-1 transition-colors"
                :class="[
                  filterRole === opt.value
                    ? 'border-accent bg-accent/20'
                    : 'border-primary/30 bg-surface/50 hover:bg-surface/80',
                  !rolesWithData.has(opt.value) ? 'champion-role-disabled' : '',
                ]"
                :title="opt.label"
                :disabled="!rolesWithData.has(opt.value)"
                @click="
                  rolesWithData.has(opt.value) &&
                  (filterRole = filterRole === opt.value ? '' : opt.value)
                "
              >
                <img
                  :src="opt.icon"
                  :alt="opt.label"
                  class="h-3 w-3 object-contain"
                  width="12"
                  height="12"
                />
              </button>
            </div>
          </div>
          <div>
            <label class="flex cursor-pointer items-center gap-2 text-sm text-text">
              <input
                v-model="filterPlayersMasterPlus"
                type="checkbox"
                class="rounded border-primary/50"
              />
              {{ t('statisticsPage.championStatsPlayersMasterPlus') }}
            </label>
          </div>
          <div v-if="showSearchChampionFilter">
            <label
              for="champion-search-champion-page"
              class="mb-1 block text-sm font-medium text-text"
              >{{ t('statisticsPage.searchChampion') }}</label
            >
            <input
              id="champion-search-champion-page"
              v-model.trim="championSearchQueryPlaceholder"
              type="text"
              :placeholder="t('statisticsPage.searchChampionPlaceholder')"
              class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text placeholder:text-text/50"
            />
          </div>
        </div>
      </aside>

      <!-- Contenu principal : pleine largeur à côté des filtres (comme page stats) -->
      <div class="min-w-0 flex-1 p-4 pt-14 lg:pl-4 lg:pt-4">
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
            <!-- Header: bandeau fin (image + nom + infos, hauteur proche des onglets) -->
            <div
              class="champion-header-band mb-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-surface/30 px-3 py-1.5"
            >
              <img
                v-if="gameVersion && championByKey(championId)"
                :src="getChampionImageUrl(gameVersion, championByKey(championId)!.image.full)"
                :alt="championName(championId) ?? ''"
                class="h-8 w-8 shrink-0 rounded-full object-cover"
                width="32"
                height="32"
              />
              <div class="min-w-0 flex-1">
                <h1 class="truncate text-base font-semibold text-text">
                  {{ championName(championId) || championId }}
                </h1>
                <div class="flex flex-wrap gap-x-3 gap-y-0 text-xs text-text/80">
                  {{ t('statisticsPage.games') }}: {{ championStats.games }} ·
                  {{ t('statisticsPage.wins') }}: {{ championStats.wins }}
                </div>
              </div>
            </div>

            <!-- Onglets -->
            <nav
              class="champion-tabs mb-4 flex flex-nowrap gap-1 overflow-x-auto border-b border-primary/30 pb-2"
              role="tablist"
            >
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
            </nav>
            <div class="champion-tab-panels">
              <!-- Vue d'ensemble -->
              <div v-show="activeChampionTab === 'overview'" role="tabpanel" class="space-y-6">
                <!-- Donuts: Popularité (pickrate), % victoire (winrate), Taux de ban (banrate) -->
                <div
                  class="mb-6 flex flex-wrap justify-center gap-6 rounded-lg border border-primary/30 bg-surface/30 p-6 sm:justify-start"
                >
                  <div class="champion-donut flex flex-col items-center">
                    <div class="relative inline-flex items-center justify-center">
                      <svg class="champion-donut-svg" viewBox="0 0 100 100" aria-hidden="true">
                        <circle
                          class="champion-donut-bg"
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke-width="12"
                        />
                        <circle
                          class="champion-donut-fill champion-donut-pickrate"
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke-width="12"
                          stroke-dasharray="251.33 251.33"
                          :stroke-dashoffset="
                            251.33 -
                            (251.33 * Math.min(100, Math.max(0, championStats.pickrate ?? 0))) / 100
                          "
                          stroke-linecap="butt"
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <span class="champion-donut-value"
                        >{{ formatDonutPercent(championStats.pickrate ?? 0) }}%</span
                      >
                    </div>
                    <span class="champion-donut-title">{{
                      t('statisticsPage.championStatsPopularity')
                    }}</span>
                  </div>
                  <div class="champion-donut flex flex-col items-center">
                    <div class="relative inline-flex items-center justify-center">
                      <svg class="champion-donut-svg" viewBox="0 0 100 100" aria-hidden="true">
                        <circle
                          class="champion-donut-bg"
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke-width="12"
                        />
                        <circle
                          class="champion-donut-fill champion-donut-winrate"
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke-width="12"
                          stroke-dasharray="251.33 251.33"
                          :stroke-dashoffset="
                            251.33 -
                            (251.33 * Math.min(100, Math.max(0, championStats.winrate ?? 0))) / 100
                          "
                          stroke-linecap="butt"
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <span class="champion-donut-value"
                        >{{ formatDonutPercent(championStats.winrate ?? 0) }}%</span
                      >
                    </div>
                    <span class="champion-donut-title">{{
                      t('statisticsPage.championStatsWinratePercent')
                    }}</span>
                  </div>
                  <div class="champion-donut flex flex-col items-center">
                    <div class="relative inline-flex items-center justify-center">
                      <svg class="champion-donut-svg" viewBox="0 0 100 100" aria-hidden="true">
                        <circle
                          class="champion-donut-bg"
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke-width="12"
                        />
                        <circle
                          class="champion-donut-fill champion-donut-banrate"
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke-width="12"
                          stroke-dasharray="251.33 251.33"
                          :stroke-dashoffset="
                            251.33 -
                            (251.33 * Math.min(100, Math.max(0, championStats.banrate ?? 0))) / 100
                          "
                          stroke-linecap="butt"
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                      <span class="champion-donut-value"
                        >{{ formatDonutPercent(championStats.banrate ?? 0) }}%</span
                      >
                    </div>
                    <span class="champion-donut-title">{{
                      t('statisticsPage.championStatsBanrateTitle')
                    }}</span>
                  </div>
                </div>

                <!-- Matchups 3 best / 3 worst dans Vue d'ensemble -->
                <div
                  v-show="activeChampionTab === 'overview'"
                  class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
                >
                  <h2 class="mb-3 text-lg font-semibold text-text">
                    {{ t('statisticsPage.championStatsMatchups') }}
                  </h2>
                  <div v-if="matchupsPending" class="py-4 text-text/70">
                    {{ t('statisticsPage.loading') }}
                  </div>
                  <template v-else-if="matchupsData?.matchups?.length">
                    <div class="grid gap-4 sm:grid-cols-2">
                      <div>
                        <h3 class="mb-2 text-sm font-medium text-text/80">
                          {{ t('statisticsPage.championStatsMatchupsBestAgainst') }}
                        </h3>
                        <ul class="flex flex-col gap-1.5">
                          <li
                            v-for="m in bestMatchups"
                            :key="m.opponentChampionId"
                            class="flex items-center gap-2 rounded border border-primary/20 bg-surface/50 px-2 py-1.5"
                          >
                            <img
                              v-if="gameVersion && championByKey(m.opponentChampionId)?.image?.full"
                              :src="
                                getChampionImageUrl(
                                  gameVersion,
                                  championByKey(m.opponentChampionId)!.image!.full
                                )
                              "
                              :alt="championName(m.opponentChampionId) ?? ''"
                              class="h-8 w-8 rounded object-cover"
                              width="32"
                              height="32"
                            />
                            <span class="min-w-0 flex-1 truncate text-sm text-text/90">{{
                              championName(m.opponentChampionId) ?? m.opponentChampionId
                            }}</span>
                            <span class="text-xs text-text/70">Score {{ m.score }}</span>
                            <span class="text-sm font-semibold text-green-600 dark:text-green-400"
                              >{{ Number(m.winrate).toFixed(2) }}%</span
                            >
                          </li>
                        </ul>
                      </div>
                      <div>
                        <h3 class="mb-2 text-sm font-medium text-text/80">
                          {{ t('statisticsPage.championStatsMatchupsWorstAgainst') }}
                        </h3>
                        <ul class="flex flex-col gap-1.5">
                          <li
                            v-for="m in worstMatchups"
                            :key="m.opponentChampionId"
                            class="flex items-center gap-2 rounded border border-primary/20 bg-surface/50 px-2 py-1.5"
                          >
                            <img
                              v-if="gameVersion && championByKey(m.opponentChampionId)?.image?.full"
                              :src="
                                getChampionImageUrl(
                                  gameVersion,
                                  championByKey(m.opponentChampionId)!.image!.full
                                )
                              "
                              :alt="championName(m.opponentChampionId) ?? ''"
                              class="h-8 w-8 rounded object-cover"
                              width="32"
                              height="32"
                            />
                            <span class="min-w-0 flex-1 truncate text-sm text-text/90">{{
                              championName(m.opponentChampionId) ?? m.opponentChampionId
                            }}</span>
                            <span class="text-xs text-text/70">Score {{ m.score }}</span>
                            <span class="text-sm font-semibold text-red-600 dark:text-red-400"
                              >{{ Number(m.winrate).toFixed(2) }}%</span
                            >
                          </li>
                        </ul>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="mt-3 text-sm font-medium text-accent hover:underline"
                      @click="scrollToMatchups"
                    >
                      {{ t('statisticsPage.championStatsMatchupsSeeMore') }}
                    </button>
                  </template>
                  <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
                </div>

                <!-- Rôle principal (most played role) -->
                <div
                  v-if="mainRole"
                  class="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-primary/30 bg-surface/30 p-6"
                >
                  <div class="flex items-center gap-3">
                    <img
                      :src="roleIconPath(mainRole.role)"
                      :alt="roleLabel(mainRole.role)"
                      class="h-12 w-12 object-contain"
                      width="48"
                      height="48"
                    />
                    <div>
                      <div class="text-sm font-medium text-text/70">
                        {{ t('statisticsPage.championStatsMainRole') }}
                      </div>
                      <div class="text-lg font-semibold text-text">
                        {{ roleLabel(mainRole.role) }}
                      </div>
                      <div class="text-sm text-text/80">
                        {{
                          t('statisticsPage.championStatsMainRoleStats', {
                            games: mainRole.games,
                            winrate: mainRole.winrate,
                          })
                        }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Graph winrate selon durée (dans Vue d'ensemble) -->
                <div
                  v-show="activeChampionTab === 'overview'"
                  class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
                >
                  <h2 class="mb-3 text-lg font-semibold text-text">
                    {{ t('statisticsPage.championStatsDurationWinrate') }}
                  </h2>
                  <p class="mb-3 text-xs text-text/60">
                    {{ t('statisticsPage.championStatsDurationWinrateChampionHint') }}
                  </p>
                  <div v-if="durationPending" class="py-4 text-text/70">
                    {{ t('statisticsPage.loading') }}
                  </div>
                  <div
                    v-else-if="durationData?.buckets?.length"
                    class="relative flex justify-center"
                  >
                    <div class="relative inline-block min-h-[260px] w-full max-w-[600px]">
                      <svg
                        ref="durationChartSvgRef"
                        :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
                        class="h-auto w-full"
                        :width="CHART_W"
                        :height="CHART_H"
                        preserveAspectRatio="xMidYMid meet"
                        aria-hidden="true"
                      >
                        <defs>
                          <linearGradient id="duration-fill-champ" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stop-color="rgb(var(--rgb-accent) / 0.4)" />
                            <stop offset="100%" stop-color="rgb(var(--rgb-accent) / 0.05)" />
                          </linearGradient>
                        </defs>
                        <path :d="durationChartData.closedPath" fill="url(#duration-fill-champ)" />
                        <path
                          :d="durationChartData.linePath"
                          fill="none"
                          stroke="rgb(var(--rgb-accent))"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                        <g v-for="(pt, i) in durationChartData.points" :key="'pt-' + i">
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
                        <g v-for="(tick, i) in durationChartData.axisX.ticks" :key="'x-' + i">
                          <line
                            :x1="tick.x"
                            :y1="CHART_PAD.top + PLOT_H"
                            :x2="tick.x"
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
                        <g v-for="(tick, i) in durationChartData.axisY.ticks" :key="'y-' + i">
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
                          {{ t('statisticsPage.championStatsDurationWinrateTooltipWinrate') }}
                        </div>
                        <div class="text-text/70">
                          {{ durationChartTooltip.matchCount }}
                          {{ t('statisticsPage.championStatsDurationWinrateTooltipMatches') }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p v-else class="py-4 text-text/70">{{ t('statisticsPage.noData') }}</p>
                </div>
              </div>

              <!-- Stats: by role -->
              <div
                v-show="activeChampionTab === 'stats'"
                v-if="byRoleList.length"
                class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h2 class="mb-3 text-lg font-semibold text-text">
                  {{ t('statisticsPage.championStatsByRole') }}
                </h2>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-primary/30">
                        <th class="px-3 py-2 text-left font-medium text-text">
                          {{ t('statisticsPage.filterRole') }}
                        </th>
                        <th class="px-3 py-2 text-right font-medium text-text">
                          {{ t('statisticsPage.games') }}
                        </th>
                        <th class="px-3 py-2 text-right font-medium text-text">Score</th>
                        <th class="px-3 py-2 text-right font-medium text-text">Δ Patch</th>
                        <th class="px-3 py-2 text-right font-medium text-text">
                          {{ t('statisticsPage.winrate') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="r in byRoleList" :key="r.role" class="border-b border-primary/20">
                        <td class="px-3 py-2 text-text/90">
                          <span class="inline-flex items-center gap-2">
                            <img
                              :src="roleIconPath(r.role)"
                              :alt="roleLabel(r.role)"
                              class="h-5 w-5 object-contain"
                              width="20"
                              height="20"
                            />
                            {{ roleLabel(r.role) }}
                          </span>
                        </td>
                        <td class="px-3 py-2 text-right text-text/90">{{ r.games }}</td>
                        <td class="px-3 py-2 text-right text-text/90">
                          {{ Number(r.winrate).toFixed(2) }}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Counters: matchups card -->
              <div
                v-show="activeChampionTab === 'counters'"
                class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h2 class="mb-3 text-lg font-semibold text-text">
                  {{ t('statisticsPage.championStatsMatchups') }}
                </h2>
                <div v-if="matchupsPending" class="py-4 text-text/70">
                  {{ t('statisticsPage.loading') }}
                </div>
                <template v-else-if="matchupsData?.matchups?.length">
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h3 class="mb-2 text-sm font-medium text-text/80">
                        {{ t('statisticsPage.championStatsMatchupsBestAgainst') }}
                      </h3>
                      <ul class="flex flex-col gap-1.5">
                        <li
                          v-for="m in bestMatchups"
                          :key="m.opponentChampionId"
                          class="flex items-center gap-2 rounded border border-primary/20 bg-surface/50 px-2 py-1.5"
                        >
                          <img
                            v-if="gameVersion && championByKey(m.opponentChampionId)?.image?.full"
                            :src="
                              getChampionImageUrl(
                                gameVersion,
                                championByKey(m.opponentChampionId)!.image!.full
                              )
                            "
                            :alt="championName(m.opponentChampionId) ?? ''"
                            class="h-8 w-8 rounded object-cover"
                            width="32"
                            height="32"
                          />
                          <span class="min-w-0 flex-1 truncate text-sm text-text/90">{{
                            championName(m.opponentChampionId) ?? m.opponentChampionId
                          }}</span>
                          <span class="text-sm font-semibold text-green-600 dark:text-green-400"
                            >{{ Number(m.winrate).toFixed(2) }}%</span
                          >
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h3 class="mb-2 text-sm font-medium text-text/80">
                        {{ t('statisticsPage.championStatsMatchupsWorstAgainst') }}
                      </h3>
                      <ul class="flex flex-col gap-1.5">
                        <li
                          v-for="m in worstMatchups"
                          :key="m.opponentChampionId"
                          class="flex items-center gap-2 rounded border border-primary/20 bg-surface/50 px-2 py-1.5"
                        >
                          <img
                            v-if="gameVersion && championByKey(m.opponentChampionId)?.image?.full"
                            :src="
                              getChampionImageUrl(
                                gameVersion,
                                championByKey(m.opponentChampionId)!.image!.full
                              )
                            "
                            :alt="championName(m.opponentChampionId) ?? ''"
                            class="h-8 w-8 rounded object-cover"
                            width="32"
                            height="32"
                          />
                          <span class="min-w-0 flex-1 truncate text-sm text-text/90">{{
                            championName(m.opponentChampionId) ?? m.opponentChampionId
                          }}</span>
                          <span class="text-sm font-semibold text-red-600 dark:text-red-400"
                            >{{ Number(m.winrate).toFixed(2) }}%</span
                          >
                        </li>
                      </ul>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="mt-3 text-sm font-medium text-accent hover:underline"
                    @click="scrollToMatchups"
                  >
                    {{ t('statisticsPage.championStatsMatchupsSeeMore') }}
                  </button>
                </template>
                <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
              </div>

              <!-- Objets (builds) -->
              <div
                v-show="activeChampionTab === 'items'"
                class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h2 class="mb-3 text-lg font-semibold text-text">
                  {{ t('statisticsPage.championStatsBuilds') }}
                </h2>
                <div v-if="buildsPending" class="py-4 text-text/70">
                  {{ t('statisticsPage.loading') }}
                </div>
                <div v-else-if="buildsData?.builds?.length" class="flex flex-wrap gap-3">
                  <div
                    v-for="(build, idx) in buildsData.builds.slice(0, buildsExpand ? 20 : 8)"
                    :key="idx"
                    class="flex flex-wrap items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-3 py-2"
                  >
                    <template v-for="itemId in build.items" :key="itemId">
                      <img
                        v-if="gameVersion && itemImageName(itemId)"
                        :src="getItemImageUrl(gameVersion, itemImageName(itemId)!)"
                        :alt="itemName(itemId) ?? ''"
                        class="h-8 w-8 object-contain"
                        width="32"
                        height="32"
                      />
                    </template>
                    <span class="ml-1 text-xs text-text/80"
                      >{{ Number(build.pickrate).toFixed(2) }}% —
                      {{ Number(build.winrate).toFixed(2) }}%</span
                    >
                  </div>
                  <button
                    v-if="(buildsData.builds?.length ?? 0) > 8"
                    type="button"
                    class="text-sm font-medium text-accent hover:underline"
                    @click="buildsExpand = !buildsExpand"
                  >
                    {{
                      buildsExpand
                        ? t('statisticsPage.showLess')
                        : t('statisticsPage.fastStatsSeeMore')
                    }}
                  </button>
                </div>
                <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
              </div>

              <!-- Skills (placeholder) -->
              <div
                v-show="activeChampionTab === 'skills'"
                class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h2 class="mb-3 text-lg font-semibold text-text">
                  {{ t('statisticsPage.championStatsTabSkills') }}
                </h2>
                <p class="text-text/70">{{ t('statisticsPage.noData') }}</p>
              </div>

              <!-- Runes -->
              <div
                v-show="activeChampionTab === 'runes'"
                class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h2 class="mb-3 text-lg font-semibold text-text">
                  {{ t('statisticsPage.championStatsRunes') }}
                </h2>
                <div v-if="runesPending" class="py-4 text-text/70">
                  {{ t('statisticsPage.loading') }}
                </div>
                <template v-else-if="runesData?.runes?.length">
                  <!-- Grille par rune (winrate / pickrate comme onglet runes) -->
                  <div
                    v-if="championRunesByPath.some(p => p.cells.length > 0)"
                    class="champion-runes-grid-wrap mb-6 flex flex-wrap gap-6"
                  >
                    <div
                      v-for="{ path, cells } in championRunesByPath"
                      :key="path.id"
                      class="runes champion-overview-runes-grid"
                    >
                      <button
                        v-for="(cell, idx) in cells"
                        :key="path.id + '-' + cell.rune.id + '-' + idx"
                        type="button"
                        class="champion-overview-rune-cell"
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
                          class="champion-overview-rune-img"
                          width="32"
                          height="32"
                        />
                        <div v-if="cell.stats" class="champion-overview-rune-stat">
                          <div class="champion-overview-rune-pick">
                            {{ Number(cell.stats.pickrate).toFixed(2) }}%
                            {{ t('statisticsPage.overviewDetailPickRate') }}
                          </div>
                          <div class="champion-overview-rune-wr">
                            {{ Number(cell.stats.winrate).toFixed(2) }}%
                            {{ t('statisticsPage.overviewDetailWinRate') }}
                          </div>
                        </div>
                        <div
                          v-else
                          class="champion-overview-rune-stat champion-overview-rune-no-stat"
                        >
                          —
                        </div>
                      </button>
                    </div>
                  </div>
                  <!-- Pages de runes (sets) -->
                  <div class="flex flex-wrap gap-3">
                    <div
                      v-for="(r, idx) in runesData.runes.slice(0, runesExpand ? 15 : 6)"
                      :key="idx"
                      class="rune-set"
                    >
                      <div class="rune-set-stat" :data-pct="r.pickrate + '%'">
                        <div class="rune-set-pr" :style="{ '--n': r.pickrate }" />
                        <div class="rune-set-pickrate text-xs text-text/70">
                          {{ Number(r.pickrate).toFixed(2) }}%
                          {{ t('statisticsPage.overviewDetailPickRate') }}
                        </div>
                        <div class="rune-set-wr" :style="{ '--n': r.winrate }">
                          {{ Number(r.winrate).toFixed(2) }}%
                          {{ t('statisticsPage.overviewDetailWinRate') }}
                        </div>
                      </div>
                      <div class="rune-set-runes">
                        <div
                          v-for="runeId in runeIdsFromSet(r.runes)"
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
                    v-if="(runesData.runes?.length ?? 0) > 6"
                    type="button"
                    class="mt-2 text-sm font-medium text-accent hover:underline"
                    @click="runesExpand = !runesExpand"
                  >
                    {{
                      runesExpand
                        ? t('statisticsPage.showLess')
                        : t('statisticsPage.fastStatsSeeMore')
                    }}
                  </button>
                  <!-- Sets de runes globaux (overview-detail) pour comparaison -->
                  <div
                    v-if="(detailData?.runeSets?.length ?? 0) > 0"
                    class="mt-8 border-t border-primary/20 pt-6"
                  >
                    <h3 class="mb-3 text-base font-medium text-text">
                      {{ t('statisticsPage.overviewDetailRuneSets') }} ({{
                        t('statisticsPage.allChampions')
                      }})
                    </h3>
                    <div class="flex flex-wrap gap-3">
                      <div
                        v-for="(set, idx) in (detailData?.runeSets ?? []).slice(
                          0,
                          globalRunesExpand ? 20 : 6
                        )"
                        :key="'global-' + idx"
                        class="rune-set"
                      >
                        <div class="rune-set-stat" :data-pct="set.pickrate + '%'">
                          <div class="rune-set-pr" :style="{ '--n': set.pickrate }" />
                          <div class="rune-set-pickrate text-xs text-text/70">
                            {{ Number(set.pickrate).toFixed(2) }}%
                            {{ t('statisticsPage.overviewDetailPickRate') }}
                          </div>
                          <div class="rune-set-wr" :style="{ '--n': set.winrate }">
                            {{ Number(set.winrate).toFixed(2) }}%
                            {{ t('statisticsPage.overviewDetailWinRate') }}
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
                      v-if="(detailData?.runeSets?.length ?? 0) > 6"
                      type="button"
                      class="mt-2 text-sm font-medium text-accent hover:underline"
                      @click="globalRunesExpand = !globalRunesExpand"
                    >
                      {{
                        globalRunesExpand
                          ? t('statisticsPage.showLess')
                          : t('statisticsPage.fastStatsSeeMore')
                      }}
                    </button>
                  </div>
                </template>
                <template v-else-if="(detailData?.runeSets?.length ?? 0) > 0">
                  <p class="mb-4 text-text/70">{{ t('statisticsPage.noData') }}</p>
                  <h3 class="mb-3 text-base font-medium text-text">
                    {{ t('statisticsPage.overviewDetailRuneSets') }} ({{
                      t('statisticsPage.allChampions')
                    }})
                  </h3>
                  <div class="flex flex-wrap gap-3">
                    <div
                      v-for="(set, idx) in (detailData?.runeSets ?? []).slice(
                        0,
                        globalRunesExpand ? 20 : 6
                      )"
                      :key="'global-only-' + idx"
                      class="rune-set"
                    >
                      <div class="rune-set-stat" :data-pct="set.pickrate + '%'">
                        <div class="rune-set-pr" :style="{ '--n': set.pickrate }" />
                        <div class="rune-set-pickrate text-xs text-text/70">
                          {{ Number(set.pickrate).toFixed(2) }}%
                          {{ t('statisticsPage.overviewDetailPickRate') }}
                        </div>
                        <div class="rune-set-wr" :style="{ '--n': set.winrate }">
                          {{ Number(set.winrate).toFixed(2) }}%
                          {{ t('statisticsPage.overviewDetailWinRate') }}
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
                    v-if="(detailData?.runeSets?.length ?? 0) > 6"
                    type="button"
                    class="mt-2 text-sm font-medium text-accent hover:underline"
                    @click="globalRunesExpand = !globalRunesExpand"
                  >
                    {{
                      globalRunesExpand
                        ? t('statisticsPage.showLess')
                        : t('statisticsPage.fastStatsSeeMore')
                    }}
                  </button>
                </template>
                <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
              </div>

              <!-- Counters: liste complète matchups -->
              <div
                v-show="activeChampionTab === 'counters'"
                id="champion-stats-matchups"
                ref="matchupsSectionRef"
                class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h2 class="mb-3 text-lg font-semibold text-text">
                  {{ t('statisticsPage.championStatsMatchups') }}
                </h2>
                <div v-if="matchupsPending" class="py-4 text-text/70">
                  {{ t('statisticsPage.loading') }}
                </div>
                <div v-else-if="matchupsData?.matchups?.length" class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-primary/30">
                        <th class="px-3 py-2 text-left font-medium text-text">
                          {{ t('statisticsPage.champion') }}
                        </th>
                        <th class="px-3 py-2 text-right font-medium text-text">
                          {{ t('statisticsPage.games') }}
                        </th>
                        <th class="px-3 py-2 text-right font-medium text-text">
                          {{ t('statisticsPage.winrate') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="m in matchupsData.matchups"
                        :key="m.opponentChampionId"
                        class="border-b border-primary/20"
                      >
                        <td class="px-3 py-2">
                          <span class="inline-flex items-center gap-2">
                            <img
                              v-if="gameVersion && championByKey(m.opponentChampionId)?.image?.full"
                              :src="
                                getChampionImageUrl(
                                  gameVersion,
                                  championByKey(m.opponentChampionId)!.image!.full
                                )
                              "
                              :alt="championName(m.opponentChampionId) ?? ''"
                              class="h-6 w-6 rounded object-cover"
                              width="24"
                              height="24"
                            />
                            {{ championName(m.opponentChampionId) ?? m.opponentChampionId }}
                          </span>
                        </td>
                        <td class="px-3 py-2 text-right text-text/90">{{ m.games }}</td>
                        <td class="px-3 py-2 text-right text-text/90">{{ m.score }}</td>
                        <td class="px-3 py-2 text-right text-text/90">
                          {{
                            m.deltaVsPrevPatch != null
                              ? (m.deltaVsPrevPatch > 0 ? '+' : '') + m.deltaVsPrevPatch
                              : '—'
                          }}
                        </td>
                        <td class="px-3 py-2 text-right text-text/90">
                          {{ Number(m.winrate).toFixed(2) }}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
              </div>

              <!-- Sorts d'invocateur (par champion : par sort + duos) -->
              <div
                v-show="activeChampionTab === 'spells'"
                class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h2 class="mb-3 text-lg font-semibold text-text">
                  {{ t('statisticsPage.championStatsSummonerSpells') }}
                </h2>
                <p class="mb-4 text-xs text-text/60">
                  {{ t('statisticsPage.championStatsSummonerSpellsHint') }}
                </p>
                <div v-if="championSpellsPending" class="py-4 text-text/70">
                  {{ t('statisticsPage.loading') }}
                </div>
                <template v-else>
                  <!-- Par sort -->
                  <h3 class="mb-2 text-sm font-medium text-text-accent">
                    {{ t('statisticsPage.championStatsSummonerSpellsPerSpell') }}
                  </h3>
                  <div v-if="championSpellsData?.spells?.length" class="mb-6 flex flex-wrap gap-2">
                    <div
                      v-for="s in championSpellsData.spells"
                      :key="s.spellId"
                      class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                      :title="spellName(s.spellId) ?? ''"
                    >
                      <img
                        v-if="gameVersion && spellImageName(s.spellId)"
                        :src="getSpellImageUrl(gameVersion, spellImageName(s.spellId)!)"
                        :alt="spellName(s.spellId) ?? ''"
                        class="h-6 w-6 object-contain"
                        width="24"
                        height="24"
                      />
                      <span class="text-xs text-text/80"
                        >{{ Number(s.pickrate).toFixed(2) }}% — {{ Number(s.winrate).toFixed(2) }}%
                        WR ({{ s.games }})</span
                      >
                    </div>
                  </div>
                  <p v-else class="mb-6 text-text/70">{{ t('statisticsPage.noData') }}</p>
                  <!-- Duos -->
                  <h3 class="mb-2 text-sm font-medium text-text-accent">
                    {{ t('statisticsPage.championStatsSummonerSpellsDuos') }}
                  </h3>
                  <div v-if="championSpellsDuosData?.duos?.length" class="flex flex-wrap gap-2">
                    <div
                      v-for="(d, i) in championSpellsDuosData.duos"
                      :key="i"
                      class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                    >
                      <img
                        v-if="gameVersion && spellImageName(d.spellId1)"
                        :src="getSpellImageUrl(gameVersion, spellImageName(d.spellId1)!)"
                        :alt="spellName(d.spellId1) ?? ''"
                        class="h-5 w-5 object-contain"
                        width="20"
                        height="20"
                      />
                      <img
                        v-if="gameVersion && spellImageName(d.spellId2)"
                        :src="getSpellImageUrl(gameVersion, spellImageName(d.spellId2)!)"
                        :alt="spellName(d.spellId2) ?? ''"
                        class="h-5 w-5 object-contain"
                        width="20"
                        height="20"
                      />
                      <span class="text-xs text-text/80"
                        >{{ Number(d.winrate).toFixed(2) }}% ({{ d.games }})</span
                      >
                    </div>
                  </div>
                  <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
                </template>
              </div>

              <!-- Stats: duration winrate -->
              <div
                v-show="activeChampionTab === 'stats'"
                class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h2 class="mb-3 text-lg font-semibold text-text">
                  {{ t('statisticsPage.championStatsDurationWinrate') }}
                </h2>
                <p class="mb-3 text-xs text-text/60">
                  {{ t('statisticsPage.championStatsDurationWinrateChampionHint') }}
                </p>
                <div v-if="durationPending" class="py-4 text-text/70">
                  {{ t('statisticsPage.loading') }}
                </div>
                <div v-else-if="durationData?.buckets?.length" class="relative flex justify-center">
                  <div class="relative inline-block">
                    <svg
                      ref="durationChartSvgRef"
                      :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
                      class="max-w-full"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="duration-fill-champ" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stop-color="rgb(var(--rgb-accent) / 0.4)" />
                          <stop offset="100%" stop-color="rgb(var(--rgb-accent) / 0.05)" />
                        </linearGradient>
                      </defs>
                      <path :d="durationChartData.closedPath" fill="url(#duration-fill-champ)" />
                      <path
                        :d="durationChartData.linePath"
                        fill="none"
                        stroke="rgb(var(--rgb-accent))"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <g v-for="(pt, i) in durationChartData.points" :key="'pt-' + i">
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
                      <g v-for="(tick, i) in durationChartData.axisX.ticks" :key="'x-' + i">
                        <line
                          :x1="tick.x"
                          :y1="CHART_PAD.top + PLOT_H"
                          :x2="tick.x"
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
                      <g v-for="(tick, i) in durationChartData.axisY.ticks" :key="'y-' + i">
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
                        {{ t('statisticsPage.championStatsDurationWinrateTooltipWinrate') }}
                      </div>
                      <div class="text-text/70">
                        {{ durationChartTooltip.matchCount }}
                        {{ t('statisticsPage.championStatsDurationWinrateTooltipMatches') }}
                      </div>
                    </div>
                  </div>
                </div>
                <p v-else class="py-4 text-text/70">{{ t('statisticsPage.noData') }}</p>
              </div>

              <!-- Stats: top players -->
              <div
                v-show="activeChampionTab === 'stats'"
                class="rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h2 class="mb-3 text-lg font-semibold text-text">
                  {{ t('statisticsPage.championStatsTopPlayers') }}
                </h2>
                <div v-if="playersPending" class="py-4 text-text/70">
                  {{ t('statisticsPage.loading') }}
                </div>
                <div v-else-if="playersData?.players?.length" class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-primary/30">
                        <th class="px-3 py-2 text-left font-medium text-text">
                          {{ t('statisticsPage.player') }}
                        </th>
                        <th class="px-3 py-2 text-right font-medium text-text">
                          {{ t('statisticsPage.games') }}
                        </th>
                        <th class="px-3 py-2 text-right font-medium text-text">
                          {{ t('statisticsPage.winrate') }}
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-text">
                          {{ t('statisticsPage.rank') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="p in playersData.players"
                        :key="p.puuid"
                        class="border-b border-primary/20"
                      >
                        <td class="px-3 py-2 font-medium text-text/90">
                          {{ p.summonerName || p.puuid?.slice(0, 8) }}
                        </td>
                        <td class="px-3 py-2 text-right text-text/90">{{ p.totalGames }}</td>
                        <td class="px-3 py-2 text-right text-text/90">
                          {{ Number(p.winrate).toFixed(2) }}%
                        </td>
                        <td class="px-3 py-2 text-text/80">{{ p.rankTier ?? '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
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
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '~/utils/apiUrl'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useVersionStore } from '~/stores/VersionStore'
import {
  getChampionImageUrl,
  getItemImageUrl,
  getRuneImageUrl,
  getSpellImageUrl,
} from '~/utils/imageUrl'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
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
function itemName(itemId: number) {
  return itemsStore.items.find(i => i.id === String(itemId))?.name ?? null
}
function itemImageName(itemId: number) {
  return itemsStore.items.find(i => i.id === String(itemId))?.image?.full ?? null
}
function getRuneById(runeId: number) {
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
const championRunesByPath = computed(() => {
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

/** Top 3 matchups (highest winrate vs), worst 3 (lowest winrate vs). API returns sorted by winrate DESC. */
const bestMatchups = computed(() => (matchupsData.value?.matchups ?? []).slice(0, 3))
const worstMatchups = computed(() => {
  const list = matchupsData.value?.matchups ?? []
  return list.length <= 3 ? list : list.slice(-3).reverse()
})

function spellName(spellId: number) {
  return summonerSpellsStore.getSpellById(String(spellId))?.name ?? null
}
function spellImageName(spellId: number) {
  return summonerSpellsStore.getSpellById(String(spellId))?.image?.full ?? null
}

const championFiltersOpen = ref(false)
const filterVersion = ref('')
const filterRank = ref('')
const filterRole = ref('')
const filterPlayersMasterPlus = ref(false)
/** Versions chargées depuis l’overview pour le filtre (version + matchCount). */
const versionsFromOverview = ref<Array<{ version: string; matchCount: number }>>([])
/** Même sélection de filtres que la page stats ; on cache uniquement « Rechercher un champion ». */
const showSearchChampionFilter = false
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
const divisions = RANK_TIERS

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

const byRoleList = computed(() => {
  const br = championStats.value?.byRole
  if (!br || typeof br !== 'object') return []
  return Object.entries(br).map(([role, data]) => ({
    role,
    games: data.games,
    winrate: data.winrate,
  }))
})

/** Rôles pour lesquels on a des données (pour griser/désactiver les autres). */
const rolesWithData = computed(() => new Set(byRoleList.value.map(r => r.role)))

/** Role with the most games (main role). */
const mainRole = computed(() => {
  const list = byRoleList.value
  if (!list.length) return null
  const sorted = [...list].sort((a, b) => b.games - a.games)
  return sorted[0] ?? null
})

const ROLE_LABELS: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'ADC',
  UTILITY: 'Support',
}
const ROLE_ICON_MAP: Record<string, string> = {
  TOP: '/icons/roles/top.png',
  JUNGLE: '/icons/roles/jungle.png',
  MIDDLE: '/icons/roles/mid.png',
  BOTTOM: '/icons/roles/bot.png',
  UTILITY: '/icons/roles/support.png',
}
const roleOptions = [
  { value: 'TOP', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'JUNGLE', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'MIDDLE', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'BOTTOM', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'UTILITY', label: 'Support', icon: '/icons/roles/support.png' },
]
function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role
}
function roleIconPath(role: string) {
  return ROLE_ICON_MAP[role] ?? '/icons/roles/mid.png'
}
function formatDonutPercent(value: number) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : '0'
}

const buildsPending = ref(false)
const buildsData = ref<{
  totalGames: number
  builds: Array<{ items: number[]; games: number; wins: number; winrate: number; pickrate: number }>
} | null>(null)
const buildsExpand = ref(false)

const runesPending = ref(false)
const runesData = ref<{
  totalGames: number
  runes: Array<{ runes: unknown; games: number; wins: number; winrate: number; pickrate: number }>
} | null>(null)
const runesPerRuneData = ref<{
  totalGames: number
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
} | null>(null)
const runesExpand = ref(false)

const detailPending = ref(false)
const detailData = ref<{
  runeSets?: Array<{
    runes: unknown
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  runes?: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  summonerSpells?: Array<{ spellId: number; pickrate: number; winrate: number }>
} | null>(null)
const globalRunesExpand = ref(false)

const championSpellsPending = ref(false)
const championSpellsData = ref<{
  totalGames: number
  spells: Array<{ spellId: number; games: number; wins: number; pickrate: number; winrate: number }>
} | null>(null)
const championSpellsDuosData = ref<{
  totalGames: number
  duos: Array<{ spellId1: number; spellId2: number; games: number; wins: number; winrate: number }>
} | null>(null)

const durationPending = ref(false)
const durationData = ref<{
  buckets: Array<{ durationMin: number; matchCount: number; wins: number; winrate: number }>
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

const matchupsPending = ref(false)
const matchupsData = ref<{
  matchups: Array<{
    opponentChampionId: number
    games: number
    wins: number
    winrate: number
    avgKda: number
    avgLevel: number
    score: number
    confidence: number
    prevPatchScore: number | null
    deltaVsPrevPatch: number | null
  }>
} | null>(null)
const matchupsSectionRef = ref<HTMLElement | null>(null)

const activeChampionTab = ref<
  'overview' | 'stats' | 'counters' | 'runes' | 'skills' | 'items' | 'spells'
>('overview')
const championTabs = [
  { id: 'overview' as const, label: 'statisticsPage.championStatsTabOverview' },
  { id: 'stats' as const, label: 'statisticsPage.championStatsTabStats' },
  { id: 'counters' as const, label: 'statisticsPage.championStatsTabCounters' },
  { id: 'runes' as const, label: 'statisticsPage.championStatsTabRunes' },
  { id: 'skills' as const, label: 'statisticsPage.championStatsTabSkills' },
  { id: 'items' as const, label: 'statisticsPage.championStatsTabItems' },
  { id: 'spells' as const, label: 'statisticsPage.championStatsTabSpells' },
]

function queryParams() {
  const p = new URLSearchParams()
  if (filterVersion.value) {
    p.set('version', filterVersion.value)
    p.set('patch', filterVersion.value) // builds/runes API attendent "patch"
  }
  if (filterRank.value) p.set('rankTier', filterRank.value)
  if (filterRole.value) p.set('role', filterRole.value)
  return p.toString() ? '?' + p.toString() : ''
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

function overviewQueryParams() {
  const p = new URLSearchParams()
  if (filterVersion.value) p.set('version', filterVersion.value)
  if (filterRank.value) p.set('rankTier', filterRank.value)
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
function statsPerfStart(label: string): number {
  if (!isStatsPerfEnabled()) return 0
  console.log('[Stats perf]', label, 'start')
  return performance.now()
}
function statsPerfEnd(label: string, start: number) {
  if (!isStatsPerfEnabled() || start === 0) return
  console.log('[Stats perf]', label, Math.round(performance.now() - start) + 'ms')
}
function statsFetch<T = unknown>(url: string, options?: Parameters<typeof $fetch>[1]): Promise<T> {
  const existingOnResponse = (options as { onResponse?: (ctx: { response: Response }) => void })
    ?.onResponse
  return $fetch(url, {
    ...options,
    onResponse: ctx => {
      if (isStatsPerfEnabled() && ctx.response?.headers) {
        const backendMs = ctx.response.headers.get('X-Backend-Time')
        const sqlMs = ctx.response.headers.get('X-SQL-Time')
        const path = ctx.response.headers.get('X-Stats-Path') || url
        if (backendMs) {
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

async function loadBuilds() {
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

async function loadRunes() {
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

async function loadMatchups() {
  if (!championId.value) return
  const t = statsPerfStart('loadMatchups')
  matchupsPending.value = true
  try {
    const params = new URLSearchParams()
    const effectiveVersion = filterVersion.value || gameVersion.value || ''
    const patch = patchFromVersion(effectiveVersion)
    if (patch) params.set('patch', patch)
    if (filterRank.value) params.set('rankTier', filterRank.value)
    if (filterRole.value) params.set('lane', filterRole.value)
    params.set('minGames', '10')
    matchupsData.value = await statsFetch(
      apiUrl(`/api/stats/champions/${championId.value}/matchups-tier?${params.toString()}`)
    )
  } catch {
    matchupsData.value = null
  } finally {
    matchupsPending.value = false
    statsPerfEnd('loadMatchups', t)
  }
}

function scrollToMatchups() {
  activeChampionTab.value = 'counters'
  setTimeout(() => {
    matchupsSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 50)
}

async function loadDetail() {
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

async function loadChampionSpells() {
  if (!championId.value) return
  const t = statsPerfStart('loadChampionSpells')
  championSpellsPending.value = true
  championSpellsData.value = null
  championSpellsDuosData.value = null
  try {
    const q = overviewQueryParams()
    const [spellsRes, duosRes] = await Promise.all([
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
    ])
    championSpellsData.value = spellsRes
    championSpellsDuosData.value = duosRes
  } catch {
    championSpellsData.value = null
    championSpellsDuosData.value = null
  } finally {
    championSpellsPending.value = false
    statsPerfEnd('loadChampionSpells', t)
  }
}

async function loadDuration() {
  if (!championId.value) return
  const t = statsPerfStart('loadDuration')
  durationPending.value = true
  try {
    const q = overviewQueryParams()
    durationData.value = await statsFetch(
      apiUrl(`/api/stats/champions/${championId.value}/duration-winrate${q || ''}`)
    )
  } catch {
    durationData.value = null
  } finally {
    durationPending.value = false
    statsPerfEnd('loadDuration', t)
  }
}

async function loadPlayers() {
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

const CHART_W = 400
const CHART_H = 260
const CHART_PAD = { left: 44, right: 20, top: 20, bottom: 30 }
const PLOT_W = CHART_W - CHART_PAD.left - CHART_PAD.right
const PLOT_H = CHART_H - CHART_PAD.top - CHART_PAD.bottom

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

function durationWinrateChartScaled(
  buckets: Array<{ durationMin: number; matchCount: number; wins: number; winrate: number }>
) {
  const empty = {
    linePath: '',
    closedPath: '',
    points: [] as {
      x: number
      y: number
      durationLabel: string
      winrate: number
      matchCount: number
    }[],
    axisX: { ticks: [] as { value: number; x: number }[] },
    axisY: { ticks: [] as { value: number; y: number }[] },
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
      durationLabel: `${b.durationMin}–${b.durationMin + 5} min`,
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
    points: pts,
    axisX: { ticks: axisXTicks },
    axisY: { ticks: axisYTicks },
  }
}

const durationChartData = computed(() =>
  durationWinrateChartScaled(durationData.value?.buckets ?? [])
)

const durationChartTooltip = ref<{
  durationLabel: string
  winrate: number
  matchCount: number
  x: number
  y: number
} | null>(null)
const durationChartSvgRef = ref<SVGSVGElement | null>(null)

watch([championId, filterVersion, filterRank, filterRole, filterPlayersMasterPlus], () => {
  if (!championId.value || Number.isNaN(championId.value)) return
  loadChampion()
  loadBuilds()
  loadRunes()
  loadMatchups()
  loadPlayers()
  loadDetail()
  loadDuration()
  championSpellsData.value = null
  championSpellsDuosData.value = null
  if (activeChampionTab.value === 'spells') loadChampionSpells()
})

watch(activeChampionTab, tab => {
  if (
    tab === 'spells' &&
    championId.value &&
    !championSpellsData.value &&
    !championSpellsPending.value
  ) {
    loadChampionSpells()
  }
})

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
}

onMounted(async () => {
  if (import.meta.client) {
    // eslint-disable-next-line no-console
    console.log(
      isStatsPerfEnabled()
        ? '[Stats perf] logs activés — durées dans la console'
        : '[Stats perf] pour afficher les durées, ajoute ?stats_perf=1 à l’URL'
    )
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
  if (championId.value && !Number.isNaN(championId.value)) {
    await loadChampion()
    loadBuilds()
    loadRunes()
    loadMatchups()
    loadPlayers()
    loadDetail()
    loadDuration()
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
</style>
