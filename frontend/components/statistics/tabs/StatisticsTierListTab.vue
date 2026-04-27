<script setup lang="ts">
import { inject } from 'vue'
import { useAdminAuth } from '~/composables/useAdminAuth'

const p = inject('statisticsPageCtx') as any
const { isLoggedIn: isAdminLoggedIn } = useAdminAuth()

withDefaults(
  defineProps<{
    /** When false, parent page renders the table/chart strip (e.g. tier-list.vue). */
    showViewModelToggle?: boolean
  }>(),
  { showViewModelToggle: true }
)
</script>

<template>
  <div class="space-y-4">
    <div v-if="showViewModelToggle" class="flex flex-wrap items-center gap-4">
      <div class="flex gap-2">
        <button
          type="button"
          :class="[
            'rounded px-3 py-1.5 text-sm font-medium',
            p.tierListViewModel === 'table'
              ? 'bg-accent text-background'
              : 'bg-surface/50 text-text/80 hover:bg-primary/20',
          ]"
          @click="p.setTierListViewModel('table')"
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
          @click="p.setTierListViewModel('chart')"
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
        class="tier-list-mobile-rotate statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
      >
        <div class="tier-list-lolalytics w-full min-w-0 text-[13px] max-lg:min-w-[760px]">
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
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[220px] shrink-0 items-center justify-start border-b border-black px-2 max-lg:w-[56px] max-lg:justify-center max-lg:px-0.5"
            >
              <span class="max-lg:hidden">{{ p.t('statisticsPage.tierListColChampion') }}</span>
            </div>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-10 shrink-0 cursor-pointer items-center justify-center border-b border-black hover:bg-primary/25 max-lg:w-auto max-lg:px-1"
              :title="p.t('statisticsPage.tierListTierTooltip')"
              @click="p.cycleTierListSort('tier')"
            >
              {{ p.t('statisticsPage.tierListTier') }}{{ p.tierListSortIcon('tier') }}
            </button>
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-10 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1 max-lg:w-auto max-lg:px-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                :title="p.t('statisticsPage.tierListMainRoleTooltip')"
                @click="p.cycleTierListSort('mainRolePct')"
              >
                {{ p.t('statisticsPage.tierListColLane') }}{{ p.tierListSortIcon('mainRolePct') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.cycleTierListSort('patchMainRolePctPp')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.tierListSortIcon('patchMainRolePctPp') }}
              </button>
            </div>
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1 max-lg:w-auto max-lg:px-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                :title="p.t('statisticsPage.tierListWinrateTooltip')"
                @click="p.cycleTierListSort('winrate')"
              >
                {{ p.t('statisticsPage.winrate') }}{{ p.tierListSortIcon('winrate') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.cycleTierListSort('patchWinratePp')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.tierListSortIcon('patchWinratePp') }}
              </button>
            </div>
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1 max-lg:w-auto max-lg:px-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                :title="p.t('statisticsPage.tierListPickrateTooltip')"
                @click="p.cycleTierListSort('pickrate')"
              >
                {{ p.t('statisticsPage.pickrate') }}{{ p.tierListSortIcon('pickrate') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.cycleTierListSort('patchPickratePp')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.tierListSortIcon('patchPickratePp') }}
              </button>
            </div>
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] hidden min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1 md:flex"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                :title="p.t('statisticsPage.tierListPbiTooltip')"
                @click="p.cycleTierListSort('pbi')"
              >
                {{ p.t('statisticsPage.tierListPbi') }}{{ p.tierListSortIcon('pbi') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.cycleTierListSort('patchPbiPp')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.tierListSortIcon('patchPbiPp') }}
              </button>
            </div>
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] hidden min-h-8 w-[72px] shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1 sm:flex"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                @click="p.cycleTierListSort('games')"
              >
                {{ p.t('statisticsPage.tierListGames') }}{{ p.tierListSortIcon('games') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.cycleTierListSort('patchGamesDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.tierListSortIcon('patchGamesDelta') }}
              </button>
            </div>
            <template v-if="p.hasTierListHighElo">
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex border-p.t border-p.t-[var(--color-grey-300)] hidden w-10 shrink-0 cursor-pointer items-center justify-center border-b border-black text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                :title="p.t('statisticsPage.tierListApexRankTooltip')"
                @click="p.cycleTierListSort('highEloRank')"
              >
                {{ p.t('statisticsPage.tierListApexRank') }}{{ p.tierListSortIcon('highEloRank') }}
              </button>
              <div
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex border-p.t border-p.t-[var(--color-grey-300)] hidden min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1 text-[rgb(var(--rgb-gold-100))] sm:flex"
              >
                <button
                  type="button"
                  class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                  :title="p.t('statisticsPage.tierListHighEloWinTooltip')"
                  @click="p.cycleTierListSort('highEloWinrate')"
                >
                  {{ p.t('statisticsPage.winrate') }}{{ p.tierListSortIcon('highEloWinrate') }}
                </button>
                <button
                  type="button"
                  class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-[rgb(var(--rgb-gold-100))]/90 hover:bg-primary/20"
                  :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                  @click="p.cycleTierListSort('patchHighEloWinratePp')"
                >
                  {{ p.t('statisticsPage.championTableDeltaSymbol')
                  }}{{ p.tierListSortIcon('patchHighEloWinratePp') }}
                </button>
              </div>
              <div
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex border-p.t border-p.t-[var(--color-grey-300)] hidden min-h-8 w-12 shrink-0 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1 text-[rgb(var(--rgb-gold-100))] sm:flex"
              >
                <button
                  type="button"
                  class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] leading-tight hover:bg-primary/25"
                  @click="p.cycleTierListSort('highEloGames')"
                >
                  {{ p.t('statisticsPage.tierListGames') }}{{ p.tierListSortIcon('highEloGames') }}
                </button>
                <button
                  type="button"
                  class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-[rgb(var(--rgb-gold-100))]/90 hover:bg-primary/20"
                  :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                  @click="p.cycleTierListSort('patchHighEloGamesDelta')"
                >
                  {{ p.t('statisticsPage.championTableDeltaSymbol')
                  }}{{ p.tierListSortIcon('patchHighEloGamesDelta') }}
                </button>
              </div>
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
            :class="[
              'tier-list-lolalytics-row flex min-h-[60px] w-full items-center justify-between py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25',
              isAdminLoggedIn ? 'cursor-pointer hover:brightness-110' : '',
            ]"
            :role="isAdminLoggedIn ? 'button' : undefined"
            :tabindex="isAdminLoggedIn ? 0 : undefined"
            @click="
              isAdminLoggedIn
                ? navigateTo(p.localePath('/statistics/champion/' + row.championId))
                : undefined
            "
            @keydown.enter="
              isAdminLoggedIn
                ? navigateTo(p.localePath('/statistics/champion/' + row.championId))
                : undefined
            "
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
            <div
              class="tier-list-lolalytics-td flex w-[220px] shrink-0 items-center gap-2 px-2 max-lg:w-[56px] max-lg:justify-center max-lg:gap-0 max-lg:px-0.5"
            >
              <img
                v-if="p.gameVersion && p.championByKey(row.championId)"
                :src="
                  p.getChampionImageUrl(p.gameVersion, p.championByKey(row.championId)!.image.full)
                "
                :alt="p.championName(row.championId) || ''"
                class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover max-lg:h-10 max-lg:w-10"
                width="50"
                height="50"
              />
              <span class="min-w-0 truncate text-[12px] text-text/90 max-lg:hidden">
                {{ p.championName(row.championId) || String(row.championId) }}
              </span>
            </div>
            <div
              class="tier-list-lolalytics-td flex w-10 shrink-0 items-center justify-center max-lg:w-auto max-lg:px-1"
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
                    ? p.t('statisticsPage.tierF')
                    : p.t('statisticsPage.tier' + row.tier)
                }}
              </span>
            </div>
            <div
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 text-center text-[11px] leading-tight max-lg:w-auto max-lg:px-1"
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
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight max-lg:w-auto max-lg:px-1"
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
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight max-lg:w-auto max-lg:px-1"
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
              class="tier-list-lolalytics-td hidden w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight md:flex"
            >
              <span>{{ p.formatMatchupScore(row.pbi, 2) }}</span>
              <span
                v-if="p.tierListPatchDeltaRefLabel && row.patchRefMatchupScorePp != null"
                class="text-[10px] leading-none"
                :class="p.tierListPatchDeltaClass(row.patchRefMatchupScorePp)"
                :title="
                  p.t('statisticsPage.tierListPatchDeltaTitle', {
                    ref: p.tierListPatchDeltaRefLabel,
                  })
                "
                >{{ p.formatTierListPatchDeltaPp(row.patchRefMatchupScorePp) }}</span
              >
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
              {{ p.tierListRangeStart }}-{{ p.tierListRangeEnd }} / {{ p.totalTierListCount }}
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
        class="tier-list-mobile-rotate tier-list-diverging-wrap statistics-overview-surface overflow-x-auto rounded-xl border border-primary/30 py-4 pl-2 pr-4 shadow-inner"
      >
        <div class="flex min-w-[640px] flex-col gap-3 max-lg:min-w-[920px] lg:min-w-0">
          <div class="min-w-0 flex-1">
            <div class="flex gap-0.5">
              <div
                class="relative z-[4] w-7 shrink-0 overflow-visible text-[10px] leading-none text-amber-100/80 md:w-8"
              >
                <div class="tier-list-chart-plot relative overflow-visible">
                  <div class="absolute inset-0 overflow-visible">
                    <span
                      v-for="tick in p.tierListChartYScale.ticks"
                      :key="'ytick-' + tick"
                      class="absolute right-0.5 whitespace-nowrap tabular-nums leading-none"
                      :style="p.tierListChartYTickLabelStyle(tick)"
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
                <div class="tier-list-chart-plot relative w-full overflow-hidden">
                  <div class="absolute inset-0">
                    <div
                      v-for="(seg, idx) in p.tierListChartYBandSegments"
                      :key="'yband-' + idx"
                      class="pointer-events-none absolute left-0 right-0 z-0"
                      :class="seg.shaded ? 'bg-amber-400/[0.09]' : 'bg-amber-950/[0.12]'"
                      :style="{
                        bottom: seg.bottomPct + '%',
                        height: seg.heightPct + '%',
                      }"
                    />
                    <div
                      v-for="score in p.tierListChartYScale.gridScores"
                      :key="'hgrid-' + score"
                      class="pointer-events-none absolute left-0 right-0 z-[1] h-px"
                      :class="
                        score === 0
                          ? 'bg-amber-400/45'
                          : Math.abs(score) === 500
                            ? 'bg-amber-400/35'
                            : 'bg-amber-400/12'
                      "
                      :style="{
                        bottom:
                          score === p.tierListChartYScale.yMax
                            ? 'calc(100% - 1px)'
                            : score === p.tierListChartYScale.yMin
                              ? '0px'
                              : 'calc(' + p.tierListChartYTickBottomPct(score) + '% - 0.5px)',
                      }"
                    />
                    <div
                      class="pointer-events-none absolute bottom-0 right-0 top-0 z-[2] w-[12%] bg-slate-950/35"
                      aria-hidden="true"
                    />
                    <div
                      class="absolute bottom-0 left-0 right-0 top-0 z-[3] flex items-stretch gap-px px-0.5"
                    >
                      <div
                        v-for="c in p.tierListChartVisibleRows"
                        :key="c.championId"
                        class="group pointer-events-none relative min-w-0 flex-1"
                      >
                        <div class="pointer-events-none relative h-full w-full">
                          <div class="pointer-events-none flex h-full w-full justify-center">
                            <div class="pointer-events-none relative h-full w-[85%] max-w-[12px]">
                              <div
                                v-if="p.scaleMatchupScore(c.pbi) >= 0"
                                class="pointer-events-auto absolute left-0 right-0 rounded-t-[2px] transition-all group-hover:brightness-110"
                                :style="{
                                  bottom: p.tierListChartZeroBottomPct + '%',
                                  height: p.tierListChartBarHeightPct(c.pbi) + '%',
                                  backgroundColor: p.tierListChartBarColor(c.tier),
                                }"
                                @mouseenter="p.onTierListChartBarEnter(c, $event)"
                                @mousemove="p.onTierListChartBarMove"
                                @mouseleave="p.onTierListChartBarLeave"
                              />
                              <div
                                v-else
                                class="pointer-events-auto absolute left-0 right-0 rounded-b-[2px] transition-all group-hover:brightness-110"
                                :style="{
                                  bottom: p.tierListChartScoreBottomPct(c.pbi) + '%',
                                  height: p.tierListChartBarHeightPct(c.pbi) + '%',
                                  backgroundColor: p.tierListChartBarColor(c.tier),
                                }"
                                @mouseenter="p.onTierListChartBarEnter(c, $event)"
                                @mousemove="p.onTierListChartBarMove"
                                @mouseleave="p.onTierListChartBarLeave"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
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
                  class="relative z-10 flex h-[52px] items-center justify-stretch gap-px border-t border-amber-400/25 bg-[#08101f] px-0.5 pt-1"
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Hauteur du tracé divergent : occupe une grande part du viewport sur grands écrans */
.tier-list-chart-plot {
  height: min(75dvh, calc(100dvh - 14rem));
  min-height: 280px;
}

@media (max-width: 1023px) {
  .tier-list-chart-plot {
    height: min(50dvh, 320px);
    min-height: 220px;
  }

  /* Force landscape rendering on phones held in portrait. */
  @media (orientation: portrait) {
    .tier-list-mobile-rotate {
      width: 100dvh;
      min-width: 100dvh;
      height: 100dvw;
      transform: rotate(90deg) translateY(-100%);
      transform-origin: top left;
    }
  }
}
</style>
