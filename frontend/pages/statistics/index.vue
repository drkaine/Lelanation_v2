<template>
  <div class="statistics min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <h1 class="mb-6 text-3xl font-bold text-text-accent">
        {{ t('statisticsPage.title') }}
      </h1>
      <p class="mb-6 text-text/80">
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
            <div
              v-if="(overviewData.matchesByDivision ?? []).length && overviewData.totalMatches > 0"
              class="rounded-lg border border-primary/30 bg-surface/30 p-6"
            >
              <h3 class="mb-3 text-lg font-medium text-text">
                {{ t('statisticsPage.overviewMatchesByDivision') }}
              </h3>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  :class="[
                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    overviewDivisionFilter === null
                      ? 'bg-accent text-background'
                      : 'bg-surface/80 text-text/90 hover:bg-primary/20 hover:text-text',
                  ]"
                  @click="setOverviewDivisionFilter(null)"
                >
                  {{ t('statisticsPage.overviewDivisionAll') }}
                </button>
                <button
                  v-for="d in overviewData.matchesByDivision ?? []"
                  :key="d.rankTier"
                  type="button"
                  :class="[
                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    overviewDivisionFilter === d.rankTier
                      ? 'bg-accent text-background'
                      : 'bg-surface/80 text-text/90 hover:bg-primary/20 hover:text-text',
                  ]"
                  :style="
                    overviewDivisionFilter !== d.rankTier ? divisionStyle(d.rankTier) : undefined
                  "
                  @click="setOverviewDivisionFilter(d.rankTier)"
                >
                  {{ d.rankTier }}: {{ d.matchCount }} ({{ divisionPercent(d) }}%)
                </button>
              </div>
            </div>
            <div
              v-if="(overviewData.matchesByVersion ?? []).length"
              class="rounded-lg border border-primary/30 bg-surface/30 p-6"
            >
              <h3 class="mb-3 text-lg font-medium text-text">
                {{ t('statisticsPage.overviewFilterByVersion') }}
              </h3>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  :class="[
                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    overviewVersionFilter === null
                      ? 'bg-accent text-background'
                      : 'bg-surface/80 text-text/90 hover:bg-primary/20 hover:text-text',
                  ]"
                  @click="setOverviewVersionFilter(null)"
                >
                  {{ t('statisticsPage.overviewVersionAll') }}
                </button>
                <button
                  v-for="v in overviewData.matchesByVersion ?? []"
                  :key="v.version"
                  type="button"
                  :class="[
                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    overviewVersionFilter === v.version
                      ? 'bg-accent text-background'
                      : 'bg-surface/80 text-text/90 hover:bg-primary/20 hover:text-text',
                  ]"
                  @click="setOverviewVersionFilter(v.version)"
                >
                  {{ v.version }} ({{ v.matchCount }})
                </button>
              </div>
            </div>

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
                            >{{ row.pickrate }}%</span
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
                            >{{ row.winrate }}%</span
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
                            >{{ row.banrate }}%</span
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
                            <span class="min-w-[2.5rem] text-right text-sm font-medium text-success"
                              >+{{ g.delta }}%</span
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
                              >{{ l.delta }}%</span
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
                                    ((parseFloat(String(b.banRatePercent).replace(',', '.')) || 0) /
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
                          <span class="min-w-[2.5rem] text-right text-sm font-medium text-text"
                            >{{ b.banRatePercent }}%</span
                          >
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
                                    ((parseFloat(String(b.banRatePercent).replace(',', '.')) || 0) /
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
                          <span class="min-w-[2.5rem] text-right text-sm font-medium text-text"
                            >{{ b.banRatePercent }}%</span
                          >
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

        <!-- Overview detail: 6 cards (runes fieldset, rune sets, items, item sets, items by order, summoner spells) -->
        <div
          v-if="overviewDetailPending"
          class="rounded-lg border border-primary/30 bg-surface/30 p-6"
        >
          <div class="py-4 text-text/70">{{ t('statisticsPage.loading') }}</div>
        </div>
        <template v-else-if="overviewDetailData">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <!-- Runes: fieldset + legend + grid (shyv-style) -->
            <fieldset class="rounded-lg border border-primary/30 bg-surface/30 p-6">
              <legend class="mb-3 text-lg font-medium text-text">
                {{ t('statisticsPage.overviewDetailRunes') }}
              </legend>
              <div class="blocks runes grid grid-cols-4 gap-2 sm:grid-cols-5">
                <button
                  v-for="r in (overviewDetailData.runes ?? []).slice(
                    0,
                    detailExpand.runes ? 30 : 5
                  )"
                  :key="r.runeId"
                  type="button"
                  class="rune flex flex-col items-center gap-1 rounded border border-primary/20 bg-surface/50 p-2 text-center transition-colors hover:bg-primary/20"
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
                    class="h-8 w-8 object-contain"
                    width="32"
                    height="32"
                  />
                  <span class="text-[10px] text-text/70">{{ r.pickrate }}%</span>
                  <span class="text-xs font-medium text-text/90">{{ r.winrate }}%</span>
                </button>
              </div>
              <button
                v-if="(overviewDetailData.runes ?? []).length > 5"
                type="button"
                class="mt-2 text-sm font-medium text-accent hover:underline"
                @click="detailExpand.runes = !detailExpand.runes"
              >
                {{
                  detailExpand.runes
                    ? t('statisticsPage.showLess')
                    : t('statisticsPage.fastStatsSeeMore')
                }}
              </button>
            </fieldset>

            <!-- Rune sets -->
            <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
              <h3 class="mb-3 text-lg font-medium text-text">
                {{ t('statisticsPage.overviewDetailRuneSets') }}
              </h3>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="(set, idx) in (overviewDetailData.runeSets ?? []).slice(
                    0,
                    detailExpand.runeSets ? 20 : 5
                  )"
                  :key="idx"
                  class="flex flex-wrap items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1.5"
                >
                  <template v-for="runeId in runeIdsFromSet(set.runes)" :key="runeId">
                    <img
                      v-if="gameVersion && getRuneById(runeId)"
                      :src="getRuneImageUrl(gameVersion, getRuneById(runeId)!.icon)"
                      :alt="getRuneById(runeId)?.name ?? ''"
                      class="h-5 w-5 object-contain"
                      width="20"
                      height="20"
                    />
                  </template>
                  <span class="text-xs text-text/70">{{ set.pickrate }}% — {{ set.winrate }}%</span>
                </div>
              </div>
              <button
                v-if="(overviewDetailData.runeSets ?? []).length > 5"
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
                  v-for="it in (overviewDetailData.items ?? []).slice(
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
                  <span class="text-xs text-text/70">{{ it.pickrate }}% — {{ it.winrate }}%</span>
                </div>
              </div>
              <button
                v-if="(overviewDetailData.items ?? []).length > 5"
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
                  v-for="(set, idx) in (overviewDetailData.itemSets ?? []).slice(
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
                  <span class="text-xs text-text/70">{{ set.pickrate }}% — {{ set.winrate }}%</span>
                </div>
              </div>
              <button
                v-if="(overviewDetailData.itemSets ?? []).length > 5"
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
                  <div class="mb-1 text-xs font-medium text-text/70">Slot {{ slotIdx + 1 }}</div>
                  <div class="flex flex-wrap gap-1.5">
                    <div
                      v-for="row in sortedItemsBySlot(slotIdx).slice(
                        0,
                        detailExpand.itemsByOrder ? 10 : 5
                      )"
                      :key="row.itemId"
                      class="flex items-center gap-1 rounded px-1 py-0.5"
                      :title="(itemName(row.itemId) ?? row.itemId) + ' — ' + row.winrate + '%'"
                    >
                      <img
                        v-if="gameVersion && itemImageName(row.itemId)"
                        :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                        :alt="itemName(row.itemId) ?? ''"
                        class="h-4 w-4 object-contain"
                        width="16"
                        height="16"
                      />
                      <span class="text-xs text-text/80">{{ row.winrate }}%</span>
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

            <!-- Summoner spells -->
            <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
              <h3 class="mb-3 text-lg font-medium text-text">
                {{ t('statisticsPage.overviewDetailSummonerSpells') }}
              </h3>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="s in (overviewDetailData.summonerSpells ?? []).slice(
                    0,
                    detailExpand.summonerSpells ? 20 : 5
                  )"
                  :key="s.spellId"
                  class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                >
                  <img
                    v-if="gameVersion && spellImageName(s.spellId)"
                    :src="getSpellImageUrl(gameVersion, spellImageName(s.spellId)!)"
                    :alt="spellName(s.spellId) ?? ''"
                    class="h-5 w-5 object-contain"
                    width="20"
                    height="20"
                  />
                  <span class="text-xs text-text/90">{{ spellName(s.spellId) ?? s.spellId }}</span>
                  <span class="text-xs text-text/70">{{ s.pickrate }}% — {{ s.winrate }}%</span>
                </div>
              </div>
              <button
                v-if="(overviewDetailData.summonerSpells ?? []).length > 5"
                type="button"
                class="mt-2 text-sm font-medium text-accent hover:underline"
                @click="detailExpand.summonerSpells = !detailExpand.summonerSpells"
              >
                {{
                  detailExpand.summonerSpells
                    ? t('statisticsPage.showLess')
                    : t('statisticsPage.fastStatsSeeMore')
                }}
              </button>
            </div>
          </div>
        </template>
        <div
          v-else-if="!overviewDetailPending"
          class="rounded-lg border border-primary/30 bg-surface/30 p-6"
        >
          <div class="py-4 text-text/70">{{ t('statisticsPage.overviewDetailNoData') }}</div>
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
          <!-- Filtres version et division (dropdowns comme onglet Champions) -->
          <div v-if="overviewData" class="mb-6 flex flex-wrap items-end gap-4">
            <div>
              <label for="sides-version" class="mb-1 block text-sm font-medium text-text">
                {{ t('statisticsPage.overviewFilterByVersion') }}
              </label>
              <select
                id="sides-version"
                v-model="sidesVersionFilter"
                class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
              >
                <option value="">{{ t('statisticsPage.overviewVersionAll') }}</option>
                <option
                  v-for="v in overviewData.matchesByVersion ?? []"
                  :key="v.version"
                  :value="v.version"
                >
                  {{ v.version }}
                </option>
              </select>
            </div>
            <div>
              <label for="sides-division" class="mb-1 block text-sm font-medium text-text">
                {{ t('statisticsPage.overviewMatchesByDivision') }}
              </label>
              <select
                id="sides-division"
                v-model="sidesDivisionFilter"
                class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
              >
                <option value="">{{ t('statisticsPage.overviewDivisionAll') }}</option>
                <option
                  v-for="d in overviewData.matchesByDivision ?? []"
                  :key="d.rankTier"
                  :value="d.rankTier"
                >
                  {{ d.rankTier }}
                </option>
              </select>
            </div>
          </div>
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
                        (championName(c.championId) ?? c.championId) + ' — ' + c.games + ' parties'
                      "
                    >
                      <img
                        v-if="gameVersion && championByKey(c.championId)"
                        :src="
                          getChampionImageUrl(gameVersion, championByKey(c.championId)!.image.full)
                        "
                        :alt="championName(c.championId) ?? ''"
                        class="h-6 w-6 rounded-full object-cover"
                        width="24"
                        height="24"
                      />
                      <span class="text-xs text-text/80">{{ c.games }} ({{ c.winrate }}%)</span>
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
                        (championName(c.championId) ?? c.championId) + ' — ' + c.games + ' parties'
                      "
                    >
                      <img
                        v-if="gameVersion && championByKey(c.championId)"
                        :src="
                          getChampionImageUrl(gameVersion, championByKey(c.championId)!.image.full)
                        "
                        :alt="championName(c.championId) ?? ''"
                        class="h-6 w-6 rounded-full object-cover"
                        width="24"
                        height="24"
                      />
                      <span class="text-xs text-text/80">{{ c.games }} ({{ c.winrate }}%)</span>
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
                        (championName(c.championId) ?? c.championId) + ' — ' + c.winrate + '%'
                      "
                    >
                      <img
                        v-if="gameVersion && championByKey(c.championId)"
                        :src="
                          getChampionImageUrl(gameVersion, championByKey(c.championId)!.image.full)
                        "
                        :alt="championName(c.championId) ?? ''"
                        class="h-6 w-6 rounded-full object-cover"
                        width="24"
                        height="24"
                      />
                      <span class="text-xs text-text/80">{{ c.winrate }}% ({{ c.games }})</span>
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
                        (championName(c.championId) ?? c.championId) + ' — ' + c.winrate + '%'
                      "
                    >
                      <img
                        v-if="gameVersion && championByKey(c.championId)"
                        :src="
                          getChampionImageUrl(gameVersion, championByKey(c.championId)!.image.full)
                        "
                        :alt="championName(c.championId) ?? ''"
                        class="h-6 w-6 rounded-full object-cover"
                        width="24"
                        height="24"
                      />
                      <span class="text-xs text-text/80">{{ c.winrate }}% ({{ c.games }})</span>
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
                          getChampionImageUrl(gameVersion, championByKey(b.championId)!.image.full)
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
                          getChampionImageUrl(gameVersion, championByKey(b.championId)!.image.full)
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
        <div class="flex flex-wrap items-end gap-4">
          <div>
            <label for="champion-sort" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.championsSortBy')
            }}</label>
            <select
              id="champion-sort"
              v-model="championsSortOrder"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
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
              class="min-w-[200px] rounded border border-primary/50 bg-background px-3 py-2 text-text placeholder:text-text/50"
            />
          </div>
          <div>
            <label for="filter-rank" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.filterRank')
            }}</label>
            <select
              id="filter-rank"
              v-model="filterRank"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allRanks') }}</option>
              <option v-for="r in rankTiers" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <div>
            <label for="filter-role" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.filterRole')
            }}</label>
            <select
              id="filter-role"
              v-model="filterRole"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allRoles') }}</option>
              <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>
        </div>
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
                v-for="row in filteredChampions"
                :key="row.championId"
                class="cursor-pointer hover:bg-surface/50"
                @click="navigateTo(localePath('/statistics/champion/' + row.championId))"
              >
                <td class="px-4 py-2 font-medium text-text">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="gameVersion && championByKey(row.championId)"
                      :src="
                        getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)
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
                <td class="px-4 py-2 text-text/90">{{ row.winrate }}%</td>
                <td class="px-4 py-2 text-text/90">{{ row.pickrate }}%</td>
                <td class="px-4 py-2 text-text/90">
                  {{ row.banrate ?? '—' }}{{ row.banrate != null ? '%' : '' }}
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="
              (championsData?.totalMatches != null || championsData?.totalGames != null) &&
              filteredChampions.length
            "
            class="border-t border-primary/20 px-4 py-2 text-xs text-text/70"
          >
            {{ t('statisticsPage.totalGames') }}:
            {{ championsData.totalMatches ?? championsData.totalGames }}
            <span v-if="championSearchQuery">
              ({{ t('statisticsPage.showing') }} {{ filteredChampions.length }})</span
            >
          </p>
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

const activeTab = ref<'overview' | 'sides' | 'champions'>('overview')
const tabs = computed(() => [
  { id: 'overview' as const, label: t('statisticsPage.tabOverview') },
  { id: 'sides' as const, label: t('statisticsPage.tabSides') },
  { id: 'champions' as const, label: t('statisticsPage.tabChampions') },
])

const championSearchQuery = ref('')
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
/** Click on sortable column header: same column toggles asc/desc, else set column and desc. */
function setChampionsSort(col: 'games' | 'wins' | 'winrate' | 'pickrate' | 'banrate') {
  if (championsSortOrder.value === col) {
    championsSortDir.value = championsSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    championsSortOrder.value = col
    championsSortDir.value = 'desc'
  }
}
/** Navigate to Champions tab with sort and sync overview filters. */
function goToChampionsWithSort(sort: 'winrate' | 'pickrate' | 'banrate') {
  championsSortOrder.value = sort
  if (overviewDivisionFilter.value) filterRank.value = overviewDivisionFilter.value
  activeTab.value = 'champions'
}

function formatGeneratedAt(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    return d.toLocaleString(locale.value)
  } catch {
    return value
  }
}

/** Official LoL rank tier colors (background + text for contrast). */
const DIVISION_COLORS: Record<string, { bg: string; text: string }> = {
  IRON: { bg: '#5e5e5e', text: '#fff' },
  BRONZE: { bg: '#cd7f32', text: '#fff' },
  SILVER: { bg: '#c0c0c0', text: '#1f2937' },
  GOLD: { bg: '#ffd700', text: '#1f2937' },
  PLATINUM: { bg: '#00d4aa', text: '#0f172a' },
  EMERALD: { bg: '#10b981', text: '#fff' },
  DIAMOND: { bg: '#00bfff', text: '#0f172a' },
  MASTER: { bg: '#9d4edd', text: '#fff' },
  GRANDMASTER: { bg: '#c41e3a', text: '#fff' },
  CHALLENGER: { bg: '#fbbf24', text: '#1f2937' },
  UNRANKED: { bg: '#6b7280', text: '#fff' },
}
function divisionStyle(rankTier: string): { backgroundColor: string; color: string } {
  const c = DIVISION_COLORS[rankTier] ?? { bg: '#4b5563', text: '#fff' }
  return { backgroundColor: c.bg, color: c.text }
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
const overviewVersionFilter = ref<string | null>(null)
/** Selected division (rank tier) filter for overview (null = all divisions). */
const overviewDivisionFilter = ref<string | null>(null)
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
  if (overviewVersionFilter.value != null && overviewVersionFilter.value !== '') {
    params.set('version', overviewVersionFilter.value)
  }
  if (overviewDivisionFilter.value != null && overviewDivisionFilter.value !== '') {
    params.set('rankTier', overviewDivisionFilter.value)
  }
  const q = params.toString()
  return q ? '?' + q : ''
}
const STATS_FETCH_TIMEOUT_MS = 90_000

async function loadOverview() {
  overviewPending.value = true
  overviewError.value = null
  const baseUrl = apiUrl('/api/stats')
  const query = overviewQueryParams()
  try {
    const overviewRes = await $fetch(baseUrl + '/overview' + query, {
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
    loadOverviewDetail()
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
  }
}
/** Duration vs winrate (5-min buckets, uses version + rank filters). */
const overviewDurationWinrateData = ref<{
  buckets: Array<{ durationMin: number; matchCount: number; wins: number; winrate: number }>
} | null>(null)
async function loadOverviewDurationWinrate() {
  try {
    overviewDurationWinrateData.value = await $fetch(
      apiUrl('/api/stats/overview-duration-winrate' + overviewQueryParams())
    )
  } catch {
    overviewDurationWinrateData.value = null
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
  const params = new URLSearchParams()
  params.set('version', oldest)
  if (overviewDivisionFilter.value) params.set('rankTier', overviewDivisionFilter.value)
  const q = params.toString() ? '?' + params.toString() : ''
  try {
    overviewProgressionData.value = await $fetch(apiUrl('/api/stats/overview-progression' + q))
  } catch {
    overviewProgressionData.value = null
  }
}
/** Version to use for progression: selected version or oldest from matchesByVersion. */
const oldestVersionForProgression = computed(() => {
  if (overviewVersionFilter.value) return overviewVersionFilter.value
  const versions = overviewData.value?.matchesByVersion ?? []
  if (!versions.length) return null
  const sorted = [...versions].sort((a, b) => a.version.localeCompare(b.version))
  return sorted[0]?.version ?? null
})
const CHART_W = 320
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
      label: `${b.durationMin}-${b.durationMin + 5} min: ${b.winrate}% WR (${b.matchCount})`,
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
/* eslint-disable @typescript-eslint/no-unused-vars */
const durationWinrateChartClosedPath = computed(
  () => durationWinrateChartScaledData.value.closedPath
)
const durationWinrateChartLinePath = computed(() => durationWinrateChartScaledData.value.linePath)
const durationWinrateChartPointsList = computed(() => durationWinrateChartScaledData.value.list)
const durationWinrateAxisX = computed(() => durationWinrateChartScaledData.value.axisX)
const durationWinrateAxisY = computed(() => durationWinrateChartScaledData.value.axisY)
/* eslint-enable @typescript-eslint/no-unused-vars */
/** Shorter timeout for heavy overview-detail so we don't wait for 504 (gateway often times out before backend). */
const OVERVIEW_DETAIL_TIMEOUT_MS = 20_000

async function loadOverviewDetail() {
  overviewDetailPending.value = true
  try {
    overviewDetailData.value = await $fetch(
      apiUrl('/api/stats/overview-detail' + overviewQueryParams()),
      { timeout: OVERVIEW_DETAIL_TIMEOUT_MS }
    )
  } catch {
    overviewDetailData.value = null
  } finally {
    overviewDetailPending.value = false
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
  const bluePct = Math.round((firstByBlue / matchCount) * 1000) / 10
  const redPct = Math.round((firstByRed / matchCount) * 1000) / 10
  return { blue: bluePct + '%', red: redPct + '%' }
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
      percent: Math.round((Number(n) / total) * 1000) / 10,
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
  return row ? row.percent + '%' : '—'
}
/** Sides tab: dropdown filters (comme onglet Champions). */
const sidesVersionFilter = ref('')
const sidesDivisionFilter = ref('')
function sidesQueryParams(): string {
  const params = new URLSearchParams()
  if (sidesVersionFilter.value) params.set('version', sidesVersionFilter.value)
  if (sidesDivisionFilter.value) params.set('rankTier', sidesDivisionFilter.value)
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
  if (!data || !total) return '0'
  const pct = (data.sideWinrate.blue.wins / total) * 100
  return (Math.round(pct * 10) / 10).toFixed(1)
})
const sidesDonutRedPct = computed(() => {
  const data = overviewSidesData.value
  const total = sidesDonutTotalMatches.value
  if (!data || !total) return '0'
  const pct = (data.sideWinrate.red.wins / total) * 100
  return (Math.round(pct * 10) / 10).toFixed(1)
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
  overviewSidesPending.value = true
  try {
    overviewSidesData.value = await $fetch(apiUrl('/api/stats/overview-sides' + sidesQueryParams()))
  } catch {
    overviewSidesData.value = null
  } finally {
    overviewSidesPending.value = false
  }
}

async function loadOverviewTeams() {
  overviewTeamsPending.value = true
  try {
    overviewTeamsData.value = await $fetch(
      apiUrl('/api/stats/overview-teams' + overviewQueryParams())
    )
  } catch {
    overviewTeamsData.value = null
  } finally {
    overviewTeamsPending.value = false
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
  const winPct = Math.round((firstByWin / matchCount) * 1000) / 10
  const lossPct = Math.round((firstByLoss / matchCount) * 1000) / 10
  return { win: winPct + '%', loss: lossPct + '%' }
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
      percent: Math.round((Number(n) / total) * 1000) / 10,
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
  return row ? row.percent + '%' : '—'
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
function setOverviewVersionFilter(version: string | null) {
  overviewVersionFilter.value = version
  loadOverview()
}
function setOverviewDivisionFilter(division: string | null) {
  overviewDivisionFilter.value = division
  loadOverview()
}
/** Percentage of matches for this division (relative to total from divisions breakdown - unaffected by division filter). */
function divisionPercent(d: { matchCount: number }): string {
  const divisions = overviewData.value?.matchesByDivision ?? []
  const total = divisions.reduce((s, x) => s + (x.matchCount ?? 0), 0)
  if (!total) return '0'
  return (Math.round((d.matchCount / total) * 10000) / 100).toFixed(2)
}

const filterRank = ref('')
const filterRole = ref('')
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
  { value: 'TOP', label: 'Top' },
  { value: 'JUNGLE', label: 'Jungle' },
  { value: 'MIDDLE', label: 'Mid' },
  { value: 'BOTTOM', label: 'ADC' },
  { value: 'UTILITY', label: 'Support' },
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
  if (filterRank.value) params.set('rankTier', filterRank.value)
  if (filterRole.value) params.set('role', filterRole.value)
  return params.toString() ? `?${params.toString()}` : ''
})
async function loadChampions() {
  championsPending.value = true
  championsError.value = null
  try {
    championsData.value = await $fetch(apiUrl(`/api/stats/champions${queryString.value}`))
  } catch (e) {
    championsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    championsPending.value = false
  }
}
watch([filterRank, filterRole], loadChampions)

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

watch(activeTab, tab => {
  if (tab === 'overview') loadOverview()
  if (tab === 'sides') loadOverviewSides()
})
watch([sidesVersionFilter, sidesDivisionFilter], () => {
  if (activeTab.value === 'sides') loadOverviewSides()
})

onMounted(async () => {
  const versionPromise = versionStore.currentVersion
    ? Promise.resolve()
    : versionStore.loadCurrentVersion()
  await Promise.all([
    versionPromise,
    championsStore.loadChampions(riotLocale.value),
    itemsStore.loadItems(riotLocale.value),
    runesStore.loadRunes(riotLocale.value),
    summonerSpellsStore.loadSummonerSpells(riotLocale.value),
    loadOverview(),
    loadChampions(),
  ])
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
</style>
