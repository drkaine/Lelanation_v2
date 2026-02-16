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

      <!-- Contenu principal -->
      <div class="min-w-0 flex-1 p-4 pt-14 lg:pt-4">
        <div class="mx-auto max-w-6xl">
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
            <!-- Header: champion image + name -->
            <div
              class="mb-6 flex flex-wrap items-center gap-6 rounded-lg border border-primary/30 bg-surface/30 p-6"
            >
              <img
                v-if="gameVersion && championByKey(championId)"
                :src="getChampionImageUrl(gameVersion, championByKey(championId)!.image.full)"
                :alt="championName(championId) ?? ''"
                class="h-24 w-24 rounded-full object-cover"
                width="96"
                height="96"
              />
              <div class="flex-1">
                <h1 class="text-2xl font-bold text-text">
                  {{ championName(championId) || championId }}
                </h1>
                <div class="mt-2 flex flex-wrap gap-4 text-sm text-text/90">
                  {{ t('statisticsPage.games') }}: {{ championStats.games }} ·
                  {{ t('statisticsPage.wins') }}: {{ championStats.wins }}
                </div>
              </div>
            </div>

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
                  <div class="text-lg font-semibold text-text">{{ roleLabel(mainRole.role) }}</div>
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

            <!-- By role (if any) -->
            <div
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
                      <td class="px-3 py-2 text-right text-text/90">{{ r.winrate }}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Builds (item sets) -->
            <div class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6">
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
                    >{{ build.pickrate }}% — {{ build.winrate }}%</span
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

            <!-- Runes -->
            <div class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6">
              <h2 class="mb-3 text-lg font-semibold text-text">
                {{ t('statisticsPage.championStatsRunes') }}
              </h2>
              <div v-if="runesPending" class="py-4 text-text/70">
                {{ t('statisticsPage.loading') }}
              </div>
              <div v-else-if="runesData?.runes?.length" class="flex flex-wrap gap-3">
                <div
                  v-for="(r, idx) in runesData.runes.slice(0, runesExpand ? 15 : 6)"
                  :key="idx"
                  class="rune-set"
                >
                  <div class="rune-set-stat" :data-pct="r.pickrate + '%'">
                    <div class="rune-set-pr" :style="{ '--n': r.pickrate }" />
                    <div class="rune-set-wr" :style="{ '--n': r.winrate }">
                      {{ Math.round(r.winrate) }}%
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
                <button
                  v-if="(runesData.runes?.length ?? 0) > 6"
                  type="button"
                  class="text-sm font-medium text-accent hover:underline"
                  @click="runesExpand = !runesExpand"
                >
                  {{
                    runesExpand
                      ? t('statisticsPage.showLess')
                      : t('statisticsPage.fastStatsSeeMore')
                  }}
                </button>
              </div>
              <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
            </div>

            <!-- Summoner spells (from overview-detail, global) -->
            <div class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6">
              <h2 class="mb-3 text-lg font-semibold text-text">
                {{ t('statisticsPage.championStatsSummonerSpells') }}
              </h2>
              <p class="mb-2 text-xs text-text/60">
                {{ t('statisticsPage.championStatsSummonerSpellsHint') }}
              </p>
              <div v-if="detailPending" class="py-4 text-text/70">
                {{ t('statisticsPage.loading') }}
              </div>
              <div v-else-if="detailData?.summonerSpells?.length" class="flex flex-wrap gap-2">
                <div
                  v-for="s in detailData.summonerSpells.slice(0, 10)"
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
                  <span class="text-xs text-text/80">{{ s.pickrate }}% — {{ s.winrate }}%</span>
                </div>
              </div>
              <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
            </div>

            <!-- Winrate by game duration (this champion) -->
            <div class="mb-6 rounded-lg border border-primary/30 bg-surface/30 p-6">
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
                      {{ durationChartTooltip.winrate }}%
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

            <!-- Top players on this champion -->
            <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
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
                      <td class="px-3 py-2 text-right text-text/90">{{ p.winrate }}%</td>
                      <td class="px-3 py-2 text-text/80">{{ p.rankTier ?? '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
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
  return Number.isFinite(value) ? (Math.round(value * 10) / 10).toFixed(1) : '0'
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
const runesExpand = ref(false)

const detailPending = ref(false)
const detailData = ref<{
  summonerSpells?: Array<{ spellId: number; pickrate: number; winrate: number }>
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

/** Short timeout for heavy global endpoints so filters stay responsive (avoid 504 wait). */
const OVERVIEW_FETCH_TIMEOUT_MS = 15000

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

function overviewQueryParams() {
  const p = new URLSearchParams()
  if (filterVersion.value) p.set('version', filterVersion.value)
  if (filterRank.value) p.set('rankTier', filterRank.value)
  return p.toString() ? '?' + p.toString() : ''
}

async function loadChampion() {
  if (!championId.value || Number.isNaN(championId.value)) {
    error.value = 'Invalid champion'
    pending.value = false
    return
  }
  pending.value = true
  error.value = null
  try {
    const url = apiUrl(`/api/stats/champions/${championId.value}${queryParams()}`)
    const data = await $fetch(url)
    championStats.value = data as typeof championStats.value
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    championStats.value = null
  } finally {
    pending.value = false
  }
}

async function loadBuilds() {
  if (!championId.value) return
  buildsPending.value = true
  try {
    const q = queryParams()
    buildsData.value = await $fetch(
      apiUrl(`/api/stats/champions/${championId.value}/builds${q ? q + '&' : '?'}minGames=10`)
    )
  } catch {
    buildsData.value = null
  } finally {
    buildsPending.value = false
  }
}

async function loadRunes() {
  if (!championId.value) return
  runesPending.value = true
  try {
    const q = queryParams()
    runesData.value = await $fetch(
      apiUrl(`/api/stats/champions/${championId.value}/runes${q ? q + '&' : '?'}minGames=10`)
    )
  } catch {
    runesData.value = null
  } finally {
    runesPending.value = false
  }
}

async function loadDetail() {
  detailPending.value = true
  try {
    const q = overviewQueryParams() ? overviewQueryParams() + '&' : '?'
    detailData.value = await $fetch(apiUrl('/api/stats/overview-detail' + q + 'includeSmite=1'), {
      timeout: OVERVIEW_FETCH_TIMEOUT_MS,
    })
  } catch {
    detailData.value = null
  } finally {
    detailPending.value = false
  }
}

async function loadDuration() {
  if (!championId.value) return
  durationPending.value = true
  try {
    const q = overviewQueryParams()
    durationData.value = await $fetch(
      apiUrl(`/api/stats/champions/${championId.value}/duration-winrate${q || ''}`),
      { timeout: OVERVIEW_FETCH_TIMEOUT_MS }
    )
  } catch {
    durationData.value = null
  } finally {
    durationPending.value = false
  }
}

async function loadPlayers() {
  if (!championId.value) return
  playersPending.value = true
  try {
    const q = queryParams()
    playersData.value = await $fetch(
      apiUrl(`/api/stats/champions/${championId.value}/players${q ? q + '&' : '?'}minGames=20`)
    )
  } catch {
    playersData.value = null
  } finally {
    playersPending.value = false
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

watch([championId, filterVersion, filterRank, filterRole], () => {
  if (!championId.value || Number.isNaN(championId.value)) return
  loadChampion()
  loadBuilds()
  loadRunes()
  loadPlayers()
  // Defer heavy global endpoints so champion/builds/runes/players load first; they use a short timeout to avoid long 504 waits.
  setTimeout(() => {
    loadDetail()
    loadDuration()
  }, 0)
})

async function loadVersionsForFilter() {
  try {
    const data = await $fetch<{
      matchesByVersion?: Array<{ version: string; matchCount: number }>
    }>(apiUrl('/api/stats/overview'))
    const list = data?.matchesByVersion ?? []
    versionsFromOverview.value = Array.isArray(list)
      ? list.map(v => ({
          version: String(v.version ?? '').trim(),
          matchCount: Number(v.matchCount ?? 0),
        }))
      : []
  } catch {
    versionsFromOverview.value = []
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
    loadBuilds()
    loadRunes()
    loadPlayers()
    setTimeout(() => {
      loadDetail()
      loadDuration()
    }, 0)
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
</style>
