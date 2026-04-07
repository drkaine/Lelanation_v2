<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-4">
      <h2 class="text-xl font-semibold text-text-accent">
        {{ p.t('statisticsPage.tierListTitle') }}
      </h2>
      <div class="flex gap-2">
        <button
          type="button"
          :class="[
            'rounded px-3 py-1.5 text-sm font-medium',
            p.tierListViewModel === 'table'
              ? 'bg-accent text-background'
              : 'bg-surface/50 text-text/80 hover:bg-primary/20',
          ]"
          @click="p.tierListViewModel = 'table'"
        >
          {{ p.t('statisticsPage.tierListViewTable') }}
        </button>
        <button
          type="button"
          :class="[
            'rounded px-3 py-1.5 text-sm font-medium',
            p.tierListViewModel === 'chart'
              ? 'bg-accent text-background'
              : 'bg-surface/50 text-text/80 hover:bg-primary/20',
          ]"
          @click="p.tierListViewModel = 'chart'"
        >
          {{ p.t('statisticsPage.tierListViewChart') }}
        </button>
      </div>
    </div>
    <div v-if="p.tierListPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.tierListError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.tierListError }}
    </div>
    <template v-else>
      <div
        v-if="p.totalTierListCount === 0"
        class="statistics-overview-surface rounded-lg border border-primary/30 p-4 text-text/70"
      >
        {{ p.t('statisticsPage.tierListNoData') }}
      </div>
      <!-- Vue tableau (grille type LoLalytics, couleurs Lelanation) -->
      <div
        v-show="p.tierListViewModel === 'table' && p.totalTierListCount > 0"
        class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
      >
        <div class="tier-list-lolalytics w-full min-w-0 text-[13px]">
          <div
            class="tier-list-lolalytics-head sticky top-0 z-10 flex h-auto min-h-8 w-full items-stretch justify-between border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
          >
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t hidden w-10 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap border-b border-black text-center hover:bg-primary/25 md:flex"
              :class="
                p.tierListSortColumn === 'rank'
                  ? 'border-p.t-accent'
                  : 'border-p.t-[var(--color-grey-300)]'
              "
              @click="p.cycleTierListSort('rank')"
            >
              {{ p.t('statisticsPage.tierListRank') }}{{ p.tierListSortIcon('rank') }}
            </button>
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[220px] shrink-0 items-center justify-start border-b border-black px-2"
            >
              {{ p.t('statisticsPage.tierListColChampion') }}
            </div>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-10 shrink-0 cursor-pointer items-center justify-center border-b border-black hover:bg-primary/25"
              :title="p.t('statisticsPage.tierListTierTooltip')"
              @click="p.cycleTierListSort('tier')"
            >
              {{ p.t('statisticsPage.tierListTier') }}{{ p.tierListSortIcon('tier') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-10 shrink-0 cursor-pointer flex-col items-center justify-center border-b border-black text-[11px] leading-tight hover:bg-primary/25"
              :title="p.t('statisticsPage.tierListMainRoleTooltip')"
              @click="p.cycleTierListSort('mainRolePct')"
            >
              {{ p.t('statisticsPage.tierListColLane') }}{{ p.tierListSortIcon('mainRolePct') }}
            </button>
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-12 shrink-0 flex-col justify-stretch border-b border-black py-0.5"
            >
              <button
                type="button"
                class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                :title="p.t('statisticsPage.tierListWinrateTooltip')"
                @click="p.cycleTierListSort('winrate')"
              >
                {{ p.t('statisticsPage.winrate') }}{{ p.tierListSortIcon('winrate') }}
              </button>
              <button
                type="button"
                class="border-p.t flex flex-1 flex-col items-center justify-center border-black/20 px-0.5 pt-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.cycleTierListSort('patchWinratePp')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.tierListSortIcon('patchWinratePp') }}
              </button>
            </div>
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-12 shrink-0 flex-col justify-stretch border-b border-black py-0.5"
            >
              <button
                type="button"
                class="flex flex-1 flex-col items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                :title="p.t('statisticsPage.tierListPickrateTooltip')"
                @click="p.cycleTierListSort('pickrate')"
              >
                {{ p.t('statisticsPage.pickrate') }}{{ p.tierListSortIcon('pickrate') }}
              </button>
              <button
                type="button"
                class="border-p.t flex flex-1 flex-col items-center justify-center border-black/20 px-0.5 pt-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.cycleTierListSort('patchPickratePp')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.tierListSortIcon('patchPickratePp') }}
              </button>
            </div>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-black hover:bg-primary/25 md:flex"
              :title="p.t('statisticsPage.tierListPbiTooltip')"
              @click="p.cycleTierListSort('pbi')"
            >
              {{ p.t('statisticsPage.tierListPbi') }}{{ p.tierListSortIcon('pbi') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] hidden w-[72px] shrink-0 cursor-pointer items-center justify-center border-b border-black hover:bg-primary/25 sm:flex"
              @click="p.cycleTierListSort('games')"
            >
              {{ p.t('statisticsPage.tierListGames') }}{{ p.tierListSortIcon('games') }}
            </button>
            <template v-if="p.hasTierListHighElo">
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex border-p.t border-p.t-[var(--color-grey-300)] hidden w-10 shrink-0 cursor-pointer items-center justify-center border-b border-black text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                :title="p.t('statisticsPage.tierListApexRankTooltip')"
                @click="p.cycleTierListSort('highEloRank')"
              >
                {{ p.t('statisticsPage.tierListApexRank') }}{{ p.tierListSortIcon('highEloRank') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex border-p.t border-p.t-[var(--color-grey-300)] hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-black text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                :title="p.t('statisticsPage.tierListHighEloWinTooltip')"
                @click="p.cycleTierListSort('highEloWinrate')"
              >
                {{ p.t('statisticsPage.winrate') }}{{ p.tierListSortIcon('highEloWinrate') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex border-p.t border-p.t-[var(--color-grey-300)] hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-black text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                @click="p.cycleTierListSort('highEloGames')"
              >
                {{ p.t('statisticsPage.tierListGames') }}{{ p.tierListSortIcon('highEloGames') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex border-p.t border-p.t-[var(--color-grey-300)] hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-black text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                :title="p.t('statisticsPage.tierListDeltaTooltip')"
                @click="p.cycleTierListSort('delta')"
              >
                {{ p.t('statisticsPage.tierListDelta') }}{{ p.tierListSortIcon('delta') }}
              </button>
            </template>
          </div>

          <div
            v-for="row in p.paginatedTierList"
            :key="row.championId"
            class="tier-list-lolalytics-row flex min-h-[60px] w-full cursor-pointer items-center justify-between py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
            role="button"
            tabindex="0"
            @click="navigateTo(p.localePath('/statistics/champion/' + row.championId))"
            @keydown.enter="navigateTo(p.localePath('/statistics/champion/' + row.championId))"
          >
            <div
              class="tier-list-lolalytics-td hidden w-10 shrink-0 flex-col items-center justify-center gap-0 leading-tight md:flex"
            >
              <span>{{ p.tierListDisplayRankByChampionId.get(row.championId) ?? '—' }}</span>
              <span
                v-if="
                  p.tierListPatchDeltaRefLabel && p.tierListPatchRankDelta(row.championId) != null
                "
                class="text-[10px] leading-none"
                :class="
                  p.tierListPatchDeltaRankClass(p.tierListPatchRankDelta(row.championId) || 0)
                "
                :title="
                  p.t('statisticsPage.tierListPatchDeltaRankTitle', {
                    ref: p.tierListPatchDeltaRefLabel,
                  })
                "
                >{{
                  p.formatTierListPatchDeltaRank(p.tierListPatchRankDelta(row.championId) || 0)
                }}</span
              >
            </div>
            <div class="tier-list-lolalytics-td flex w-[220px] shrink-0 items-center gap-2 px-2">
              <img
                v-if="p.gameVersion && p.championByKey(row.championId)"
                :src="
                  p.getChampionImageUrl(p.gameVersion, p.championByKey(row.championId)!.image.full)
                "
                :alt="p.championName(row.championId) || ''"
                class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover"
                width="50"
                height="50"
              />
              <span class="min-w-0 truncate text-left font-medium text-accent">{{
                p.championName(row.championId) || row.championId
              }}</span>
            </div>
            <div class="tier-list-lolalytics-td flex w-10 shrink-0 items-center justify-center">
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
                    ? p.t('statisticsPage.tierF')
                    : p.t('statisticsPage.tier' + row.tier)
                }}
              </span>
            </div>
            <div
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 text-center text-[11px] leading-tight"
            >
              <img
                v-if="p.mainRoleIconSrc(row.mainRole)"
                :src="p.mainRoleIconSrc(row.mainRole)!"
                :alt="p.mainRoleLabel(row.mainRole)"
                :title="p.mainRoleLabel(row.mainRole)"
                class="mb-0.5 h-[27px] w-[27px] object-contain"
                width="27"
                height="27"
              />
              <span v-else class="max-w-[2.5rem] truncate text-[10px]">{{ row.mainRole }}</span>
              <span>{{ Number(row.mainRolePct).toFixed(0) }}%</span>
              <span
                v-if="p.tierListPatchDeltaRefLabel && row.patchRefMainRolePctPp != null"
                class="text-[10px] leading-none"
                :class="p.tierListPatchDeltaClass(row.patchRefMainRolePctPp)"
                :title="
                  p.t('statisticsPage.tierListPatchDeltaTitle', {
                    ref: p.tierListPatchDeltaRefLabel,
                  })
                "
                >{{ p.formatTierListPatchDeltaPp(row.patchRefMainRolePctPp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
            >
              <span :class="p.tierListWinrateClass(row.winrate * 100)">{{
                (row.winrate * 100).toFixed(2)
              }}</span>
              <span
                v-if="p.tierListPatchDeltaRefLabel && row.patchRefWinratePp != null"
                class="text-[10px] leading-none"
                :class="p.tierListPatchDeltaClass(row.patchRefWinratePp)"
                :title="
                  p.t('statisticsPage.tierListPatchDeltaTitle', {
                    ref: p.tierListPatchDeltaRefLabel,
                  })
                "
                >{{ p.formatTierListPatchDeltaPp(row.patchRefWinratePp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
            >
              <span>{{ (row.pickrate * 100).toFixed(2) }}</span>
              <span
                v-if="p.tierListPatchDeltaRefLabel && row.patchRefPickratePp != null"
                class="text-[10px] leading-none"
                :class="p.tierListPatchDeltaClass(row.patchRefPickratePp)"
                :title="
                  p.t('statisticsPage.tierListPatchDeltaTitle', {
                    ref: p.tierListPatchDeltaRefLabel,
                  })
                "
                >{{ p.formatTierListPatchDeltaPp(row.patchRefPickratePp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td hidden w-12 shrink-0 items-center justify-center text-center md:flex"
            >
              {{ p.formatMatchupScore(row.pbi, 2) }}
            </div>
            <div
              class="tier-list-lolalytics-td hidden w-[72px] shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight sm:flex"
            >
              <span>{{ row.games.toLocaleString() }}</span>
              <span
                v-if="p.tierListPatchDeltaRefLabel && row.patchRefGamesDelta != null"
                class="text-[10px] leading-none"
                :class="p.tierListPatchDeltaGamesClass(row.patchRefGamesDelta)"
                :title="
                  p.t('statisticsPage.tierListPatchDeltaGamesTitle', {
                    ref: p.tierListPatchDeltaRefLabel,
                  })
                "
                >{{ p.formatTierListPatchDeltaGames(row.patchRefGamesDelta) }}</span
              >
            </div>
            <template v-if="p.hasTierListHighElo">
              <div
                class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-10 shrink-0 items-center justify-center sm:flex"
              >
                {{ row.highEloRank != null ? row.highEloRank : '—' }}
              </div>
              <div
                class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-12 shrink-0 flex-col items-center justify-center gap-0 leading-tight sm:flex"
              >
                <template v-if="row.highEloWinrate != null">
                  <span :class="p.tierListWinrateClass(row.highEloWinrate * 100)">{{
                    (row.highEloWinrate * 100).toFixed(2)
                  }}</span>
                  <span
                    v-if="p.tierListPatchDeltaRefLabel && row.patchRefHighEloWinratePp != null"
                    class="text-[10px] leading-none"
                    :class="p.tierListPatchDeltaClass(row.patchRefHighEloWinratePp)"
                    :title="
                      p.t('statisticsPage.tierListPatchDeltaTitle', {
                        ref: p.tierListPatchDeltaRefLabel,
                      })
                    "
                    >{{ p.formatTierListPatchDeltaPp(row.patchRefHighEloWinratePp) }}</span
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
                  v-if="p.tierListPatchDeltaRefLabel && row.patchRefHighEloGamesDelta != null"
                  class="text-[10px] leading-none"
                  :class="p.tierListPatchDeltaGamesClass(row.patchRefHighEloGamesDelta)"
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaGamesTitle', {
                      ref: p.tierListPatchDeltaRefLabel,
                    })
                  "
                  >{{ p.formatTierListPatchDeltaGames(row.patchRefHighEloGamesDelta) }}</span
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
          v-if="p.totalTierListCount > 0"
          class="border-p.t flex flex-wrap items-center justify-between gap-2 border-primary/20 px-4 py-2 text-sm text-text/80"
        >
          <span>{{ p.t('statisticsPage.showing') }} {{ p.totalTierListCount }}</span>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5">
              <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
              <select
                v-model.number="p.championsPageSize"
                class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
              >
                <option v-for="n in p.PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
              </select>
            </label>
            <span class="text-text/70">
              {{ (p.tierListPage - 1) * p.championsPageSize + 1 }}-{{
                Math.min(p.tierListPage * p.championsPageSize, p.totalTierListCount)
              }}
              / {{ p.totalTierListCount }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="p.tierListPage <= 1"
                @click="p.tierListPage = Math.max(1, p.tierListPage - 1)"
              >
                ‹
              </button>
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="p.tierListPage >= p.totalTierListPages"
                @click="p.tierListPage = Math.min(p.totalTierListPages, p.tierListPage + 1)"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- Vue graphique : barres divergentes (PBI), style analytics sombre -->
      <div
        v-show="p.tierListViewModel === 'chart' && p.totalTierListCount > 0"
        class="tier-list-diverging-wrap statistics-overview-surface overflow-x-auto rounded-xl border border-primary/30 p-4 shadow-inner"
      >
        <div class="flex min-w-[640px] flex-col gap-3 lg:min-w-0">
          <div class="min-w-0 flex-1">
            <h3
              class="mb-2 font-sans text-sm font-bold uppercase tracking-tight text-white md:text-base"
            >
              {{ p.tierListChartHeading }}
            </h3>
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <button
                v-for="entry in p.TIER_DIVERGING_LEGEND"
                :key="'tier-filter-' + entry.key"
                type="button"
                class="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold transition-colors"
                :class="
                  p.tierListChartTierEnabled(entry.key)
                    ? 'border-white/40 bg-white/10 text-white'
                    : 'border-white/20 bg-black/20 text-white/60'
                "
                @click="p.toggleTierListChartTier(entry.key)"
              >
                <span
                  class="inline-block h-3 w-3 rounded-sm"
                  :style="{ backgroundColor: entry.color }"
                />
                <span>{{
                  entry.key === 'S+'
                    ? p.t('statisticsPage.tierS+')
                    : entry.key === 'D'
                      ? p.t('statisticsPage.tierF')
                      : p.t('statisticsPage.tier' + entry.key)
                }}</span>
              </button>
            </div>
            <p class="mb-3 text-[11px] text-amber-200/60">
              {{ p.t('statisticsPage.tierListChartPbiAxis') }}
            </p>
            <div class="flex gap-1">
              <div class="relative w-9 shrink-0 text-[10px] leading-none text-amber-100/80 md:w-10">
                <div class="relative h-[320px]">
                  <div class="absolute inset-0">
                    <span
                      v-for="tick in p.tierListChartYScale.ticks"
                      :key="'ytick-' + tick"
                      class="absolute right-0.5 -translate-y-1/2 tabular-nums"
                      :style="{ bottom: p.tierListChartYTickBottomPct(tick) + '%' }"
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
                      v-for="tick in p.tierListChartYScale.ticks"
                      :key="'grid-' + tick"
                      class="border-p.t pointer-events-none absolute left-0 right-0 z-0 border-amber-400/20"
                      :style="{ bottom: p.tierListChartYTickBottomPct(tick) + '%' }"
                    />
                    <div
                      class="pointer-events-none absolute bottom-0 right-0 top-0 z-[1] w-[12%] bg-slate-950/35"
                      aria-hidden="true"
                    />
                    <div
                      class="absolute bottom-0 left-0 right-0 top-0 z-[2] flex items-stretch gap-px px-0.5"
                    >
                      <NuxtLink
                        v-for="c in p.tierListChartVisibleRows"
                        :key="c.championId"
                        :to="p.localePath('/statistics/champion/' + c.championId)"
                        class="group relative min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
                        :title="
                          (p.championName(c.championId) || c.championId) +
                          ' — Score ' +
                          p.formatMatchupScore(c.pbi, 2)
                        "
                        @mouseenter="p.onTierListChartBarEnter(c, $event)"
                        @mousemove="p.onTierListChartBarMove"
                        @mouseleave="p.onTierListChartBarLeave"
                      >
                        <div class="relative h-full w-full">
                          <div class="flex h-full w-full justify-center">
                            <div class="relative h-full w-[85%] max-w-[12px]">
                              <div
                                class="absolute left-0 right-0 z-[1] h-px bg-amber-400/55"
                                :style="{ bottom: p.tierListChartZeroBottomPct + '%' }"
                              />
                              <div
                                v-if="p.scaleMatchupScore(c.pbi) >= 0"
                                class="rounded-p.t-[2px] absolute left-0 right-0 transition-all group-hover:brightness-110"
                                :style="{
                                  bottom: p.tierListChartZeroBottomPct + '%',
                                  height: p.tierListChartBarHeightPct(c.pbi) + '%',
                                  backgroundColor: p.tierListChartBarColor(c.tier),
                                }"
                              />
                              <div
                                v-else
                                class="absolute left-0 right-0 rounded-b-[2px] transition-all group-hover:brightness-110"
                                :style="{
                                  bottom: p.tierListChartScoreBottomPct(c.pbi) + '%',
                                  height: p.tierListChartBarHeightPct(c.pbi) + '%',
                                  backgroundColor: p.tierListChartBarColor(c.tier),
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
                    v-if="p.tierListChartTooltip && p.tierListChartTooltipRow"
                    class="pointer-events-none fixed z-[300] w-max max-w-[17rem] rounded border border-amber-500/45 bg-[#0c1222] p-2 text-left text-xs text-amber-50 shadow-xl"
                    :style="{
                      left: p.tierListChartTooltip.x + 'px',
                      top: p.tierListChartTooltip.y + 'px',
                      transform: 'translate(-50%, calc(-100% - 12px))',
                    }"
                  >
                    <div class="flex items-center gap-2">
                      <img
                        v-if="p.tierListChartChampionImage(p.tierListChartTooltipRow.championId)"
                        :src="
                          p.tierListChartChampionImage(p.tierListChartTooltipRow.championId) || ''
                        "
                        :alt="
                          p.championName(p.tierListChartTooltipRow.championId) ||
                          String(p.tierListChartTooltipRow.championId)
                        "
                        class="h-8 w-8 shrink-0 rounded object-cover"
                      />
                      <div class="min-w-0">
                        <div class="truncate font-semibold text-amber-100">
                          {{
                            p.championName(p.tierListChartTooltipRow.championId) ||
                            p.tierListChartTooltipRow.championId
                          }}
                        </div>
                        <div class="text-[11px] text-amber-200/75">
                          Score {{ p.formatMatchupScore(p.tierListChartTooltipRow.pbi, 2) }}
                        </div>
                        <div
                          v-if="
                            p.tierListPatchDeltaRefLabel &&
                            p.tierListChartTooltipRow.patchRefMatchupScorePp != null
                          "
                          class="text-[11px]"
                          :class="
                            p.tierListPatchDeltaClass(
                              p.tierListChartTooltipRow.patchRefMatchupScorePp
                            )
                          "
                        >
                          {{
                            p.t('statisticsPage.tierListChartDeltaMatchupVsRef', {
                              ref: p.tierListPatchDeltaRefLabel,
                            })
                          }}:
                          {{
                            p.formatTierListPatchDeltaPp(
                              p.tierListChartTooltipRow.patchRefMatchupScorePp
                            )
                          }}
                        </div>
                      </div>
                    </div>
                  </div>
                </Teleport>
                <div
                  class="border-p.t flex h-[52px] items-center justify-stretch gap-px border-amber-400/25 px-0.5 pt-1"
                >
                  <div
                    v-for="c in p.tierListChartVisibleRows"
                    :key="'lbl-' + c.championId"
                    class="flex min-w-0 flex-1 items-center justify-center overflow-visible"
                  >
                    <img
                      v-if="p.gameVersion && p.championByKey(c.championId)"
                      :src="
                        p.getChampionImageUrl(
                          p.gameVersion,
                          p.championByKey(c.championId)!.image.full
                        )
                      "
                      :alt="p.championName(c.championId) || String(c.championId)"
                      class="h-9 w-9 shrink-0 rounded-full border border-amber-400/30 object-cover"
                      width="36"
                      height="36"
                    />
                    <span
                      v-else
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-black/40 text-[10px] font-semibold text-white/80"
                    >
                      {{ (p.championName(c.championId) || String(c.championId)).slice(0, 2) }}
                    </span>
                  </div>
                </div>
                <div
                  class="border-p.t mt-1 flex justify-between border-white/10 pt-1 text-[10px] text-amber-200/50"
                >
                  <span>{{ p.t('statisticsPage.tierListChartWorst') }}</span>
                  <span>{{ p.t('statisticsPage.tierListChartBest') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
