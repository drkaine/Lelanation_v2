<template>
  <div class="space-y-2">
    <div v-if="p.bansPending" class="text-text/70">{{ p.t('statisticsPage.loading') }}</div>
    <div v-else-if="p.bansError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.bansError }}
    </div>
    <div
      v-else-if="p.bansTableData?.message && !p.bansTableData?.rows?.length"
      class="text-text/70"
    >
      {{ p.bansTableData.message }}
    </div>
    <div v-else class="space-y-3">
      <StatisticsMobileSortBar
        id="bans-mobile-sort"
        v-model:column="bansMobileSortColumn"
        v-model:direction="bansMobileSortDir"
        :options="bansMobileSortOptions"
        :help-aria-label="p.t('statisticsPage.tooltipTableBansAria')"
        :help-text="p.t('statisticsPage.tooltipTableBans')"
        :help-secondary-text="p.t('statisticsPage.tooltipTableBansSecondary')"
      />
      <div class="statistics-bans-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in p.paginatedBans"
          :key="'ban-mobile-' + row.championId"
          class="statistics-champion-stats-mobile-card statistics-ban-mobile-card w-full overflow-hidden"
        >
          <div
            class="statistics-champion-stats-mobile-card-header flex w-full items-center gap-3 p-3"
          >
            <StatisticsChampionStatsMobileCardHeader
              :champion-id="row.championId"
              :champion-name="String(p.championName(row.championId) || row.championId)"
              :search-query="p.championSearchQuery"
              :portrait-src="
                p.gameVersion && p.championByKey(row.championId)
                  ? p.getChampionImageUrl(
                      p.gameVersion,
                      p.championByKey(row.championId)!.image.full
                    )
                  : null
              "
              :portrait-alt="p.championName(row.championId) || ''"
            />
            <button
              type="button"
              class="flex min-w-0 flex-1 flex-col items-end justify-center text-right"
              @click="toggleBanCardExpanded(row.championId)"
            >
              <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                {{ p.t('statisticsPage.bansColRate') }}
              </div>
              <div
                class="text-2xl font-bold tabular-nums leading-none text-text-accent sm:text-3xl"
              >
                {{ p.banRateForBansRow(row, p.bansTableData?.matchCount ?? 0).toFixed(2) }}%
              </div>
              <div
                v-if="p.bansDeltaPct(row, 'bansTotal', 2) != null"
                class="mt-0.5 text-xs tabular-nums leading-none"
                :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansTotal', 2)!)"
              >
                {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansTotal', 2)!) }}
              </div>
            </button>
          </div>

          <div
            v-if="visibleRoleHeaders.length > 0"
            class="statistics-ban-mobile-card-roles border-t border-primary/15 px-3 py-2.5"
          >
            <div class="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text/55">
              {{ p.t('statisticsPage.bansByRole') }}
            </div>
            <div
              class="grid gap-2"
              :style="{
                gridTemplateColumns: `repeat(${visibleRoleHeaders.length}, minmax(0, 1fr))`,
              }"
            >
              <div
                v-for="role in visibleRoleHeaders"
                :key="'ban-mobile-role-' + row.championId + '-' + role.key"
                class="flex min-w-0 flex-col items-center gap-0.5 text-center"
              >
                <img :src="role.icon" :alt="role.alt" class="h-5 w-5 object-contain" />
                <span class="text-sm font-semibold tabular-nums text-text">
                  {{
                    p
                      .banPctForCount(row[role.countKey], p.bansTableData?.matchCount ?? 0, 1)
                      .toFixed(2)
                  }}%
                </span>
                <span
                  v-if="p.bansDeltaPct(row, role.countKey, 1) != null"
                  class="text-[10px] tabular-nums leading-none"
                  :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, role.countKey, 1)!)"
                >
                  {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, role.countKey, 1)!) }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="expandedBanIds.has(row.championId)"
            class="statistics-ban-mobile-card-details space-y-1.5 border-t border-primary/20 bg-black/20 px-3 py-2.5 text-sm text-text/85"
          >
            <div
              v-if="p.showBansOutcomeColumns"
              class="flex flex-wrap items-baseline justify-between gap-x-2"
            >
              <span>{{ p.t('statisticsPage.overviewTeamsByWin') }}</span>
              <span class="tabular-nums">
                {{ p.bansOutcomePct(row.championId, 'win').toFixed(2) }}%
                <span
                  v-if="p.bansOutcomeDeltaPct(row.championId, 'win') != null"
                  class="ml-1 text-xs"
                  :class="p.tierListPatchDeltaClass(p.bansOutcomeDeltaPct(row.championId, 'win')!)"
                >
                  {{ formatBansPatchDeltaPct(p.bansOutcomeDeltaPct(row.championId, 'win')!) }}
                </span>
              </span>
            </div>
            <div
              v-if="p.showBansOutcomeColumns"
              class="flex flex-wrap items-baseline justify-between gap-x-2"
            >
              <span>{{ p.t('statisticsPage.overviewTeamsByLoss') }}</span>
              <span class="tabular-nums">
                {{ p.bansOutcomePct(row.championId, 'loss').toFixed(2) }}%
                <span
                  v-if="p.bansOutcomeDeltaPct(row.championId, 'loss') != null"
                  class="ml-1 text-xs"
                  :class="p.tierListPatchDeltaClass(p.bansOutcomeDeltaPct(row.championId, 'loss')!)"
                >
                  {{ formatBansPatchDeltaPct(p.bansOutcomeDeltaPct(row.championId, 'loss')!) }}
                </span>
              </span>
            </div>
            <div
              v-if="p.showBansSideColumns"
              class="flex flex-wrap items-baseline justify-between gap-x-2 text-primary-light/95"
            >
              <span>{{ p.t('statisticsPage.bansColBlueSide') }}</span>
              <span class="tabular-nums">
                {{
                  p.banPctForCount(row.bansBlue, p.bansTableData?.matchCount ?? 0, 1).toFixed(2)
                }}%
                <span
                  v-if="p.bansDeltaPct(row, 'bansBlue', 1) != null"
                  class="ml-1 text-xs"
                  :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansBlue', 1)!)"
                >
                  {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansBlue', 1)!) }}
                </span>
              </span>
            </div>
            <div
              v-if="p.showBansSideColumns"
              class="text-error/70/95 flex flex-wrap items-baseline justify-between gap-x-2"
            >
              <span>{{ p.t('statisticsPage.bansColRedSide') }}</span>
              <span class="tabular-nums">
                {{ p.banPctForCount(row.bansRed, p.bansTableData?.matchCount ?? 0, 1).toFixed(2) }}%
                <span
                  v-if="p.bansDeltaPct(row, 'bansRed', 1) != null"
                  class="ml-1 text-xs"
                  :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansRed', 1)!)"
                >
                  {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansRed', 1)!) }}
                </span>
              </span>
            </div>
          </div>
        </article>
      </div>

      <div
        class="tier-list-mobile-rotate statistics-overview-surface hidden w-full overflow-x-auto rounded-lg border border-primary/30 md:block"
      >
        <div class="tier-list-lolalytics w-full min-w-0 text-[13px] max-lg:min-w-[720px]">
          <table class="w-full min-w-[520px] text-left text-[13px]">
            <thead
              class="sticky top-0 z-10 border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
            >
              <tr>
                <th class="min-w-[220px] px-2 py-1.5 text-left font-semibold text-text">
                  {{ p.t('statisticsPage.tierListColChampion') }}
                </th>
                <th class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text">
                  <div class="flex items-center gap-1">
                    <button type="button" @click="p.setBansSort('rate')">
                      {{ p.t('statisticsPage.bansColRate') }}{{ p.bansSortHint('rate') }}
                    </button>
                    <button
                      v-if="p.bansTableRefData"
                      type="button"
                      class="text-[10px] text-text/70 hover:text-text"
                      :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                      @click="p.setBansSort('rateDelta')"
                    >
                      Δ{{ p.bansSortHint('rateDelta') }}
                    </button>
                  </div>
                </th>
                <th
                  v-show="p.showBansOutcomeColumns"
                  class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                >
                  <div class="flex items-center gap-1">
                    <button type="button" @click="p.setBansSort('win')">
                      {{ p.t('statisticsPage.overviewTeamsByWin') }}{{ p.bansSortHint('win') }}
                    </button>
                    <button
                      v-if="p.bansTableRefData"
                      type="button"
                      class="text-[10px] text-text/70 hover:text-text"
                      :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                      @click="p.setBansSort('winDelta')"
                    >
                      Δ{{ p.bansSortHint('winDelta') }}
                    </button>
                  </div>
                </th>
                <th
                  v-show="p.showBansOutcomeColumns"
                  class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                >
                  <div class="flex items-center gap-1">
                    <button type="button" @click="p.setBansSort('loss')">
                      {{ p.t('statisticsPage.overviewTeamsByLoss') }}{{ p.bansSortHint('loss') }}
                    </button>
                    <button
                      v-if="p.bansTableRefData"
                      type="button"
                      class="text-[10px] text-text/70 hover:text-text"
                      :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                      @click="p.setBansSort('lossDelta')"
                    >
                      Δ{{ p.bansSortHint('lossDelta') }}
                    </button>
                  </div>
                </th>
                <th
                  v-show="p.showBansSideColumns"
                  class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                >
                  <div class="flex items-center gap-1">
                    <button type="button" class="text-primary-light" @click="p.setBansSort('blue')">
                      {{ p.t('statisticsPage.bansColBlueSide') }}{{ p.bansSortHint('blue') }}
                    </button>
                    <button
                      v-if="p.bansTableRefData"
                      type="button"
                      class="text-[10px] text-text/70 hover:text-text"
                      :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                      @click="p.setBansSort('blueDelta')"
                    >
                      Δ{{ p.bansSortHint('blueDelta') }}
                    </button>
                  </div>
                </th>
                <th
                  v-show="p.showBansSideColumns"
                  class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                >
                  <div class="flex items-center gap-1">
                    <button type="button" class="text-error/70" @click="p.setBansSort('red')">
                      {{ p.t('statisticsPage.bansColRedSide') }}{{ p.bansSortHint('red') }}
                    </button>
                    <button
                      v-if="p.bansTableRefData"
                      type="button"
                      class="text-[10px] text-text/70 hover:text-text"
                      :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                      @click="p.setBansSort('redDelta')"
                    >
                      Δ{{ p.bansSortHint('redDelta') }}
                    </button>
                  </div>
                </th>

                <th
                  v-for="role in roleHeaders"
                  v-show="p.showBansRoleColumn(role.key)"
                  :key="'bans-role-header-' + role.key"
                  class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                >
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      class="inline-flex items-center"
                      @click="p.setBansSort(role.key)"
                    >
                      <img :src="role.icon" :alt="role.alt" class="h-4 w-4" />{{
                        p.bansSortHint(role.key)
                      }}
                    </button>
                    <button
                      v-if="p.bansTableRefData"
                      type="button"
                      class="text-[10px] text-text/70 hover:text-text"
                      :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                      @click="p.setBansSort(role.deltaKey)"
                    >
                      Δ{{ p.bansSortHint(role.deltaKey) }}
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="row in p.paginatedBans"
                :key="'ban-' + row.championId"
                class="text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
              >
                <td class="min-w-[220px] py-0.5 pl-2 pr-0">
                  <StatisticsChampionDetailLink
                    :champion-id="row.championId"
                    class="flex items-center gap-2"
                  >
                    <img
                      v-if="p.gameVersion && p.championByKey(row.championId)"
                      :src="
                        p.getChampionImageUrl(
                          p.gameVersion,
                          p.championByKey(row.championId)!.image.full
                        )
                      "
                      :alt="p.championName(row.championId) || ''"
                      class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover"
                      width="50"
                      height="50"
                      loading="lazy"
                      decoding="async"
                    />
                    <span
                      class="min-w-0 truncate text-[12px] text-accent underline decoration-accent/40 underline-offset-2"
                    >
                      <StatisticsChampionNameHighlight
                        :name="String(p.championName(row.championId) || row.championId)"
                        :query="p.championSearchQuery"
                      />
                    </span>
                  </StatisticsChampionDetailLink>
                </td>
                <td class="px-1 py-0.5 align-middle">
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span>{{
                      p.banRateForBansRow(row, p.bansTableData?.matchCount ?? 0).toFixed(2)
                    }}</span>
                    <span
                      v-if="p.bansDeltaPct(row, 'bansTotal', 2) != null"
                      class="text-[10px] leading-none"
                      :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansTotal', 2)!)"
                    >
                      {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansTotal', 2)!) }}
                    </span>
                  </div>
                </td>
                <td v-show="p.showBansOutcomeColumns" class="px-1 py-0.5 align-middle">
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span>{{ p.bansOutcomePct(row.championId, 'win').toFixed(2) }}</span>
                    <span
                      v-if="p.bansOutcomeDeltaPct(row.championId, 'win') != null"
                      class="text-[10px] leading-none"
                      :class="
                        p.tierListPatchDeltaClass(p.bansOutcomeDeltaPct(row.championId, 'win')!)
                      "
                    >
                      {{ formatBansPatchDeltaPct(p.bansOutcomeDeltaPct(row.championId, 'win')!) }}
                    </span>
                  </div>
                </td>
                <td v-show="p.showBansOutcomeColumns" class="px-1 py-0.5 align-middle">
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span>{{ p.bansOutcomePct(row.championId, 'loss').toFixed(2) }}</span>
                    <span
                      v-if="p.bansOutcomeDeltaPct(row.championId, 'loss') != null"
                      class="text-[10px] leading-none"
                      :class="
                        p.tierListPatchDeltaClass(p.bansOutcomeDeltaPct(row.championId, 'loss')!)
                      "
                    >
                      {{ formatBansPatchDeltaPct(p.bansOutcomeDeltaPct(row.championId, 'loss')!) }}
                    </span>
                  </div>
                </td>
                <td v-show="p.showBansSideColumns" class="px-1 py-0.5 align-middle">
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight text-primary-light/95"
                  >
                    <span>{{
                      p.banPctForCount(row.bansBlue, p.bansTableData?.matchCount ?? 0, 1).toFixed(2)
                    }}</span>
                    <span
                      v-if="p.bansDeltaPct(row, 'bansBlue', 1) != null"
                      class="text-[10px] leading-none"
                      :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansBlue', 1)!)"
                    >
                      {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansBlue', 1)!) }}
                    </span>
                  </div>
                </td>
                <td v-show="p.showBansSideColumns" class="px-1 py-0.5 align-middle">
                  <div
                    class="text-error/70/95 flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span>{{
                      p.banPctForCount(row.bansRed, p.bansTableData?.matchCount ?? 0, 1).toFixed(2)
                    }}</span>
                    <span
                      v-if="p.bansDeltaPct(row, 'bansRed', 1) != null"
                      class="text-[10px] leading-none"
                      :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansRed', 1)!)"
                    >
                      {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansRed', 1)!) }}
                    </span>
                  </div>
                </td>
                <td v-show="p.showBansRoleColumn('top')" class="px-1 py-0.5 align-middle">
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span>{{
                      p.banPctForCount(row.bansTop, p.bansTableData?.matchCount ?? 0, 1).toFixed(2)
                    }}</span>
                    <span
                      v-if="p.bansDeltaPct(row, 'bansTop', 1) != null"
                      class="text-[10px] leading-none"
                      :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansTop', 1)!)"
                    >
                      {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansTop', 1)!) }}
                    </span>
                  </div>
                </td>
                <td v-show="p.showBansRoleColumn('jungle')" class="px-1 py-0.5 align-middle">
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span>{{
                      p
                        .banPctForCount(row.bansJungle, p.bansTableData?.matchCount ?? 0, 1)
                        .toFixed(2)
                    }}</span>
                    <span
                      v-if="p.bansDeltaPct(row, 'bansJungle', 1) != null"
                      class="text-[10px] leading-none"
                      :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansJungle', 1)!)"
                    >
                      {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansJungle', 1)!) }}
                    </span>
                  </div>
                </td>
                <td v-show="p.showBansRoleColumn('middle')" class="px-1 py-0.5 align-middle">
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span>{{
                      p
                        .banPctForCount(row.bansMiddle, p.bansTableData?.matchCount ?? 0, 1)
                        .toFixed(2)
                    }}</span>
                    <span
                      v-if="p.bansDeltaPct(row, 'bansMiddle', 1) != null"
                      class="text-[10px] leading-none"
                      :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansMiddle', 1)!)"
                    >
                      {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansMiddle', 1)!) }}
                    </span>
                  </div>
                </td>
                <td v-show="p.showBansRoleColumn('bottom')" class="px-1 py-0.5 align-middle">
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span>{{
                      p
                        .banPctForCount(row.bansBottom, p.bansTableData?.matchCount ?? 0, 1)
                        .toFixed(2)
                    }}</span>
                    <span
                      v-if="p.bansDeltaPct(row, 'bansBottom', 1) != null"
                      class="text-[10px] leading-none"
                      :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansBottom', 1)!)"
                    >
                      {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansBottom', 1)!) }}
                    </span>
                  </div>
                </td>
                <td v-show="p.showBansRoleColumn('support')" class="px-1 py-0.5 align-middle">
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span>{{
                      p
                        .banPctForCount(row.bansSupport, p.bansTableData?.matchCount ?? 0, 1)
                        .toFixed(2)
                    }}</span>
                    <span
                      v-if="p.bansDeltaPct(row, 'bansSupport', 1) != null"
                      class="text-[10px] leading-none"
                      :class="p.tierListPatchDeltaClass(p.bansDeltaPct(row, 'bansSupport', 1)!)"
                    >
                      {{ formatBansPatchDeltaPct(p.bansDeltaPct(row, 'bansSupport', 1)!) }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="p.totalBansCount > 0"
            class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
          >
            <span v-if="p.championSearchQuery"
              >{{ p.t('statisticsPage.showing') }} {{ p.totalBansCount }}</span
            >
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1.5">
                <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
                <select
                  :value="p.championsPageSize"
                  class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                  @change="onPageSizeChange"
                >
                  <option v-for="n in p.PAGE_SIZE_OPTIONS" :key="'bans-ps-' + n" :value="n">
                    {{ n }}
                  </option>
                </select>
              </label>
              <span class="text-text/70">
                {{ (p.bansPage - 1) * p.championsPageSize + 1 }}-{{
                  Math.min(p.bansPage * p.championsPageSize, p.totalBansCount)
                }}
                / {{ p.totalBansCount }}
              </span>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="statistics-pagination-btn text-text"
                  :disabled="p.bansPage <= 1"
                  @click="p.onBansPageUpdated(Math.max(1, p.bansPage - 1))"
                >
                  ‹
                </button>
                <button
                  type="button"
                  class="statistics-pagination-btn text-text"
                  :disabled="p.bansPage >= p.totalBansPages"
                  @click="p.onBansPageUpdated(Math.min(p.totalBansPages, p.bansPage + 1))"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, unref } from 'vue'
import type { BansSortCol } from '~/composables/statistics/useStatisticsBansTab'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'

const p = inject('statisticsPageCtx') as any
const expandedBanIds = ref<Set<number>>(new Set())

function toggleBanCardExpanded(championId: number): void {
  const next = new Set(expandedBanIds.value)
  if (next.has(championId)) next.delete(championId)
  else next.add(championId)
  expandedBanIds.value = next
}

function onPageSizeChange(event: Event): void {
  const target = event.target as HTMLSelectElement | null
  const fallback = unref(p.championsPageSize)
  p.onBansPageSizeUpdated(Number(target?.value ?? fallback))
}

function formatBansPatchDeltaPct(pp: number): string {
  const sign = pp > 0 ? '+' : ''
  return `${sign}${pp.toFixed(2)}%`
}

const bansMobileSortColumn = computed({
  get: () => String(p.bansSortColumn ?? 'rate'),
  set: (v: string) => {
    p.setBansSort(v)
  },
})

const bansMobileSortDir = computed({
  get: () => (p.bansSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  set: (v: 'asc' | 'desc') => {
    p.bansSortDir = v
  },
})

const bansMobileSortOptions = computed<StatisticsMobileSortOption[]>(() => {
  const t = p.t
  const opts: StatisticsMobileSortOption[] = [
    { value: 'rate', label: t('statisticsPage.bansColRate') },
    { value: 'win', label: t('statisticsPage.overviewTeamsByWin') },
    { value: 'loss', label: t('statisticsPage.overviewTeamsByLoss') },
    { value: 'blue', label: t('statisticsPage.bansColBlueSide') },
    { value: 'red', label: t('statisticsPage.bansColRedSide') },
    { value: 'top', label: t('statisticsPage.bansColTop') },
    { value: 'jungle', label: t('statisticsPage.bansColJungle') },
    { value: 'middle', label: t('statisticsPage.bansColMiddle') },
    { value: 'bottom', label: t('statisticsPage.bansColBottom') },
    { value: 'support', label: t('statisticsPage.bansColSupport') },
  ]
  if (p.bansPatchDeltaRefLabel) {
    const deltaOpts: StatisticsMobileSortOption[] = [
      { value: 'rateDelta', label: `Δ ${t('statisticsPage.bansColRate')}` },
      { value: 'winDelta', label: `Δ ${t('statisticsPage.overviewTeamsByWin')}` },
      { value: 'lossDelta', label: `Δ ${t('statisticsPage.overviewTeamsByLoss')}` },
      { value: 'blueDelta', label: `Δ ${t('statisticsPage.bansColBlue')}` },
      { value: 'redDelta', label: `Δ ${t('statisticsPage.bansColRed')}` },
      { value: 'topDelta', label: `Δ ${t('statisticsPage.bansColTop')}` },
      { value: 'jungleDelta', label: `Δ ${t('statisticsPage.bansColJungle')}` },
      { value: 'middleDelta', label: `Δ ${t('statisticsPage.bansColMiddle')}` },
      { value: 'bottomDelta', label: `Δ ${t('statisticsPage.bansColBottom')}` },
      { value: 'supportDelta', label: `Δ ${t('statisticsPage.bansColSupport')}` },
    ]
    return [...opts, ...deltaOpts]
  }
  return opts
})

type BanRoleMetricKey = 'bansTop' | 'bansJungle' | 'bansMiddle' | 'bansBottom' | 'bansSupport'

const roleHeaders: Array<{
  key: BansSortCol
  deltaKey: BansSortCol
  countKey: BanRoleMetricKey
  icon: string
  alt: string
}> = [
  {
    key: 'top',
    deltaKey: 'topDelta',
    countKey: 'bansTop',
    icon: '/icons/roles/top.png',
    alt: 'Top',
  },
  {
    key: 'jungle',
    deltaKey: 'jungleDelta',
    countKey: 'bansJungle',
    icon: '/icons/roles/jungle.png',
    alt: 'Jungle',
  },
  {
    key: 'middle',
    deltaKey: 'middleDelta',
    countKey: 'bansMiddle',
    icon: '/icons/roles/mid.png',
    alt: 'Mid',
  },
  {
    key: 'bottom',
    deltaKey: 'bottomDelta',
    countKey: 'bansBottom',
    icon: '/icons/roles/bot.png',
    alt: 'Bot',
  },
  {
    key: 'support',
    deltaKey: 'supportDelta',
    countKey: 'bansSupport',
    icon: '/icons/roles/support.png',
    alt: 'Support',
  },
]

const visibleRoleHeaders = computed(() =>
  roleHeaders.filter(role => p.showBansRoleColumn(role.key))
)
</script>
