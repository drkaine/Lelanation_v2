<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-lg">
      <div v-if="p.overviewPending" class="text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div
        v-else-if="p.overviewError"
        class="rounded border border-error/50 bg-error/10 p-4 text-error"
      >
        <p class="mb-2">{{ p.overviewError }}</p>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
          @click="p.loadOverview()"
        >
          {{ p.t('statisticsPage.retry') }}
        </button>
      </div>
      <div v-else-if="p.overviewData" class="space-y-[10px]">
        <!-- Fast Stats encarts (style LeagueOfGraphs avec nos couleurs) -->
        <div class="flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[10px] pb-[10px]">
          <!-- Champions les plus choisis -->
          <div
            class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
          >
            <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
              <button
                type="button"
                class="text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.mostPicked')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.mostPicked')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.mostPicked',
                    p.t('statisticsPage.fastStatsMostPicked')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.mostPicked') ? '★' : '☆' }}
              </button>
              <span class="flex-1">
                {{ p.t('statisticsPage.fastStatsMostPicked') }}
                <span
                  class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsMostPicked') }}
                  </span>
                </span>
              </span>
            </h3>
            <table
              v-if="p.overviewTopPickrateChampionsFiltered.length"
              class="fast-stat-table w-full text-xs"
            >
              <tbody>
                <tr
                  v-for="(row, idx) in p.overviewTopPickrateChampionsFiltered"
                  :key="row.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5 align-middle">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <span class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">{{
                        p.championName(row.championId) || row.championId
                      }}</span>
                      <span class="ml-auto w-9 shrink-0 text-right font-medium text-text"
                        >{{ Number(row.pickrate).toFixed(2) }}%</span
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.fastStatsNoData') }}
            </div>
            <div v-if="p.overviewTopPickrateChampionsFiltered.length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToTierListWithSort('pickrate')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
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
                  p.cardIsFavorite('overview.bestWinrate')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.bestWinrate')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.bestWinrate',
                    p.t('statisticsPage.fastStatsBestWinrate')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.bestWinrate') ? '★' : '☆' }}
              </button>
              <span class="inline-flex flex-1 items-center">
                {{ p.t('statisticsPage.fastStatsBestWinrate') }}
                <span
                  class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsBestWinrate') }}
                  </span>
                </span>
              </span>
            </h3>
            <table
              v-if="p.overviewEffectiveTopWinrateChampions.length"
              class="fast-stat-table w-full text-xs"
            >
              <tbody>
                <tr
                  v-for="(row, idx) in p.overviewEffectiveTopWinrateChampions"
                  :key="row.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5 align-middle">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <span class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">{{
                        p.championName(row.championId) || row.championId
                      }}</span>
                      <span class="ml-auto w-9 shrink-0 text-right font-medium text-text"
                        >{{ Number(row.winrate).toFixed(2) }}%</span
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.fastStatsNoData') }}
            </div>
            <div v-if="p.overviewEffectiveTopWinrateChampions.length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToTierListWithSort('winrate')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
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
                  p.cardIsFavorite('overview.mostBanned')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.mostBanned')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.mostBanned',
                    p.t('statisticsPage.fastStatsMostBanned')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.mostBanned') ? '★' : '☆' }}
              </button>
              <span class="inline-flex flex-1 items-center">
                {{ p.t('statisticsPage.fastStatsMostBanned') }}
                <span
                  class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipFastStatsMostBanned') }}
                  </span>
                </span>
              </span>
            </h3>
            <table
              v-if="p.overviewEffectiveTopBanrateChampions.length"
              class="fast-stat-table w-full text-xs"
            >
              <tbody>
                <tr
                  v-for="(row, idx) in p.overviewEffectiveTopBanrateChampions"
                  :key="row.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5 align-middle">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <span class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">{{
                        p.championName(row.championId) || row.championId
                      }}</span>
                      <span class="ml-auto w-9 shrink-0 text-right font-medium text-text"
                        >{{ Number(row.banrate).toFixed(2) }}%</span
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.fastStatsNoData') }}
            </div>
            <div v-if="p.overviewEffectiveTopBanrateChampions.length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToBansTab()"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
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
                  p.cardIsFavorite('overview.winrateSince')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.winrateSince')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.winrateSince',
                    p.t('statisticsPage.fastStatsWinrateProgression')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.winrateSince') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>
                  {{
                    p.progressionFromVersion
                      ? p.t('statisticsPage.fastStatsWinrateSince', {
                          version: p.progressionFromVersion ?? undefined,
                        })
                      : p.t('statisticsPage.fastStatsWinrateProgression')
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
                    {{ p.t('statisticsPage.tooltipFastStatsWinrateSince') }}
                  </span>
                </span>
              </span>
            </h3>
            <table v-if="p.overviewTopWinrateSince.length" class="fast-stat-table w-full text-xs">
              <tbody>
                <tr
                  v-for="(row, idx) in p.overviewTopWinrateSince.slice(0, 5)"
                  :key="'wr-' + row.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5 align-middle">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <div class="min-w-0 max-w-[6.5rem] shrink-0">
                        <div class="truncate font-medium leading-tight text-text">
                          {{ p.championName(row.championId) || row.championId }}
                        </div>
                        <div
                          class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                        >
                          {{ Number(row.wrOldest).toFixed(1) }}% →
                          {{ Number(row.wrSince).toFixed(1) }}%
                        </div>
                      </div>
                      <span
                        class="ml-auto w-10 shrink-0 text-right font-medium"
                        :class="Number(row.deltaWr) >= 0 ? 'text-success' : 'text-error'"
                        >{{ Number(row.deltaWr) > 0 ? '+' : ''
                        }}{{ Number(row.deltaWr).toFixed(2) }}%</span
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.fastStatsNoProgression') }}
            </div>
            <div v-if="p.overviewTopWinrateSince.length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('blueWinrate')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
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
                  p.cardIsFavorite('overview.pickrateSince')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.pickrateSince')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.pickrateSince',
                    p.t('statisticsPage.fastStatsPickrateSinceTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.pickrateSince') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>{{
                  p.t('statisticsPage.fastStatsPickrateSinceTitle', {
                    version: p.progressionFromVersion || '—',
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
                    {{ p.t('statisticsPage.tooltipFastStatsPickrateSince') }}
                  </span>
                </span>
              </span>
            </h3>
            <table v-if="p.overviewTopPickrateSince.length" class="fast-stat-table w-full text-xs">
              <tbody>
                <tr
                  v-for="(row, idx) in p.overviewTopPickrateSince.slice(0, 5)"
                  :key="'pr-' + row.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5 align-middle">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <div class="min-w-0 max-w-[6.5rem] shrink-0">
                        <div class="truncate font-medium leading-tight text-text">
                          {{ p.championName(row.championId) || row.championId }}
                        </div>
                        <div
                          class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                        >
                          {{ Number(row.pickrateOldest).toFixed(1) }}% →
                          {{ Number(row.pickrateSince).toFixed(1) }}%
                        </div>
                      </div>
                      <span
                        class="ml-auto w-10 shrink-0 text-right font-medium"
                        :class="Number(row.deltaPick) >= 0 ? 'text-success' : 'text-error'"
                        >{{ Number(row.deltaPick) > 0 ? '+' : ''
                        }}{{ Number(row.deltaPick).toFixed(2) }}%</span
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.fastStatsNoProgression') }}
            </div>
            <div v-if="p.overviewTopPickrateSince.length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('bluePickrate')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
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
                  p.cardIsFavorite('overview.banrateSince')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.banrateSince')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.banrateSince',
                    p.t('statisticsPage.fastStatsBanrateSinceTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.banrateSince') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>{{
                  p.t('statisticsPage.fastStatsBanrateSinceTitle', {
                    version: p.progressionFromVersion || '—',
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
                    {{ p.t('statisticsPage.tooltipFastStatsBanrateSince') }}
                  </span>
                </span>
              </span>
            </h3>
            <table v-if="p.overviewTopBanrateSince.length" class="fast-stat-table w-full text-xs">
              <tbody>
                <tr
                  v-for="(row, idx) in p.overviewTopBanrateSince.slice(0, 5)"
                  :key="'br-' + row.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5 align-middle">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <div class="min-w-0 max-w-[6.5rem] shrink-0">
                        <div class="truncate font-medium leading-tight text-text">
                          {{ p.championName(row.championId) || row.championId }}
                        </div>
                        <div
                          class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                        >
                          {{ Number(row.banrateOldest).toFixed(1) }}% →
                          {{ Number(row.banrateSince).toFixed(1) }}%
                        </div>
                      </div>
                      <span
                        class="ml-auto w-10 shrink-0 text-right font-medium"
                        :class="Number(row.deltaBan) >= 0 ? 'text-success' : 'text-error'"
                        >{{ Number(row.deltaBan) > 0 ? '+' : ''
                        }}{{ Number(row.deltaBan).toFixed(2) }}%</span
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.fastStatsNoProgression') }}
            </div>
            <div v-if="p.overviewTopBanrateSince.length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToBansTab()"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
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
                  p.cardIsFavorite('overview.winrateSinceDown')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.winrateSinceDown')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.winrateSinceDown',
                    p.t('statisticsPage.fastStatsWinrateSinceDownTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.winrateSinceDown') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>{{
                  p.t('statisticsPage.fastStatsWinrateSinceDownTitle', {
                    version: p.progressionFromVersion || '—',
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
                    {{ p.t('statisticsPage.tooltipFastStatsWinrateSinceDown') }}
                  </span>
                </span>
              </span>
            </h3>
            <table
              v-if="p.overviewBottomWinrateSince.length"
              class="fast-stat-table w-full text-xs"
            >
              <tbody>
                <tr
                  v-for="(row, idx) in p.overviewBottomWinrateSince.slice(0, 5)"
                  :key="'wr-down-' + row.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5 align-middle">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <div class="min-w-0 max-w-[6.5rem] shrink-0">
                        <div class="truncate font-medium leading-tight text-text">
                          {{ p.championName(row.championId) || row.championId }}
                        </div>
                        <div
                          class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                        >
                          {{ Number(row.wrOldest).toFixed(1) }}% →
                          {{ Number(row.wrSince).toFixed(1) }}%
                        </div>
                      </div>
                      <span class="ml-auto w-10 shrink-0 text-right font-medium text-error"
                        >{{ Number(row.deltaWr).toFixed(2) }}%</span
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.fastStatsNoProgression') }}
            </div>
            <div v-if="p.overviewBottomWinrateSince.length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('blueWinrate', 'asc')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
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
                  p.cardIsFavorite('overview.pickrateSinceDown')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.pickrateSinceDown')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.pickrateSinceDown',
                    p.t('statisticsPage.fastStatsPickrateSinceDownTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.pickrateSinceDown') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>{{
                  p.t('statisticsPage.fastStatsPickrateSinceDownTitle', {
                    version: p.progressionFromVersion || '—',
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
                    {{ p.t('statisticsPage.tooltipFastStatsPickrateSinceDown') }}
                  </span>
                </span>
              </span>
            </h3>
            <table
              v-if="p.overviewBottomPickrateSince.length"
              class="fast-stat-table w-full text-xs"
            >
              <tbody>
                <tr
                  v-for="(row, idx) in p.overviewBottomPickrateSince.slice(0, 5)"
                  :key="'pr-down-' + row.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5 align-middle">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <div class="min-w-0 max-w-[6.5rem] shrink-0">
                        <div class="truncate font-medium leading-tight text-text">
                          {{ p.championName(row.championId) || row.championId }}
                        </div>
                        <div
                          class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                        >
                          {{ Number(row.pickrateOldest).toFixed(1) }}% →
                          {{ Number(row.pickrateSince).toFixed(1) }}%
                        </div>
                      </div>
                      <span class="ml-auto w-10 shrink-0 text-right font-medium text-error"
                        >{{ Number(row.deltaPick).toFixed(2) }}%</span
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.fastStatsNoProgression') }}
            </div>
            <div v-if="p.overviewBottomPickrateSince.length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('bluePickrate', 'asc')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
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
                  p.cardIsFavorite('overview.banrateSinceDown')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.banrateSinceDown')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.banrateSinceDown',
                    p.t('statisticsPage.fastStatsBanrateSinceDownTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.banrateSinceDown') ? '★' : '☆' }}
              </button>
              <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span>{{
                  p.t('statisticsPage.fastStatsBanrateSinceDownTitle', {
                    version: p.progressionFromVersion || '—',
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
                    {{ p.t('statisticsPage.tooltipFastStatsBanrateSinceDown') }}
                  </span>
                </span>
              </span>
            </h3>
            <table
              v-if="p.overviewBottomBanrateSince.length"
              class="fast-stat-table w-full text-xs"
            >
              <tbody>
                <tr
                  v-for="(row, idx) in p.overviewBottomBanrateSince.slice(0, 5)"
                  :key="'br-down-' + row.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5 align-middle">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <div class="min-w-0 max-w-[6.5rem] shrink-0">
                        <div class="truncate font-medium leading-tight text-text">
                          {{ p.championName(row.championId) || row.championId }}
                        </div>
                        <div
                          class="whitespace-nowrap text-[9px] tabular-nums leading-tight text-text/70"
                        >
                          {{ Number(row.banrateOldest).toFixed(1) }}% →
                          {{ Number(row.banrateSince).toFixed(1) }}%
                        </div>
                      </div>
                      <span class="ml-auto w-10 shrink-0 text-right font-medium text-error"
                        >{{ Number(row.deltaBan).toFixed(2) }}%</span
                      >
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.fastStatsNoProgression') }}
            </div>
            <div v-if="p.overviewBottomBanrateSince.length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToBansTab()"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
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
                  p.cardIsFavorite('overview.matchOutcome')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.matchOutcome')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.matchOutcome',
                    p.t('statisticsPage.overviewMatchOutcomesTitle')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.matchOutcome') ? '★' : '☆' }}
              </button>
              <span class="flex-1">{{ p.t('statisticsPage.overviewMatchOutcomesTitle') }}</span>
            </h3>
            <div
              v-if="p.overviewAbandonsPending || p.overviewPending"
              class="py-3 text-center text-text/60"
            >
              {{ p.t('statisticsPage.loading') }}
            </div>
            <div
              v-else-if="p.overviewMatchOutcomeTotal > 0"
              class="flex flex-col items-center gap-3 sm:flex-row sm:items-center"
            >
              <StatisticsMatchOutcomeDonut
                :total="p.overviewMatchOutcomeTotal"
                :early="p.overviewEarlySurrenderCount"
                :surrender-only="p.overviewSurrenderOnlyCount"
                :played="p.overviewPlayedCount"
              />
              <div class="min-w-0 space-y-1 text-xs">
                <div class="font-medium text-text">
                  Total: {{ p.overviewMatchOutcomeTotal.toLocaleString() }}
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300" />
                  Early surrender: {{ p.overviewEarlySurrenderCount.toLocaleString() }} ({{
                    p.overviewEarlySurrenderPct.toFixed(2)
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-100" />
                  Surrender: {{ p.overviewSurrenderOnlyCount.toLocaleString() }} ({{
                    p.overviewSurrenderOnlyPct.toFixed(2)
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400" />
                  Jouees: {{ p.overviewPlayedCount.toLocaleString() }} ({{
                    p.overviewPlayedPct.toFixed(2)
                  }}%)
                </div>
              </div>
            </div>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.overviewNoData') }}
            </div>
          </div>

          <!-- Bans par équipe gagnante -->
          <div
            v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0"
            class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
          >
            <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
              <button
                type="button"
                class="text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.bansByWin')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.bansByWin')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.bansByWin',
                    p.t('statisticsPage.overviewTeamsBansByWin')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.bansByWin') ? '★' : '☆' }}
              </button>
              <span class="flex-1">{{ p.t('statisticsPage.overviewTeamsBansByWin') }}</span>
            </h3>
            <table
              v-if="(p.overviewTeamsData.bans.byWin ?? []).length"
              class="fast-stat-table w-full text-xs"
            >
              <tbody>
                <tr
                  v-for="(b, idx) in (p.overviewTeamsData.bans.byWin ?? []).slice(
                    0,
                    p.bansExpandByWin ? 20 : 5
                  )"
                  :key="'win-' + b.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(b.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(b.championId)!.image.full
                          )
                        "
                        :alt="p.championName(b.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <span class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">{{
                        p.championName(b.championId) || b.championId
                      }}</span>
                      <span class="ml-auto w-9 shrink-0 text-right font-medium text-text">{{
                        b.banRatePercent
                      }}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="(p.overviewTeamsData.bans.byWin ?? []).length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToBansTab()"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>

          <!-- Bans par équipe perdante -->
          <div
            v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0"
            class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
          >
            <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
              <button
                type="button"
                class="text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('overview.bansByLoss')
                    ? 'text-amber-300 hover:text-amber-200'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('overview.bansByLoss')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'overview.bansByLoss',
                    p.t('statisticsPage.overviewTeamsBansByLoss')
                  )
                "
              >
                {{ p.cardIsFavorite('overview.bansByLoss') ? '★' : '☆' }}
              </button>
              <span class="flex-1">{{ p.t('statisticsPage.overviewTeamsBansByLoss') }}</span>
            </h3>
            <table
              v-if="(p.overviewTeamsData.bans.byLoss ?? []).length"
              class="fast-stat-table w-full text-xs"
            >
              <tbody>
                <tr
                  v-for="(b, idx) in (p.overviewTeamsData.bans.byLoss ?? []).slice(
                    0,
                    p.bansExpandByLoss ? 20 : 5
                  )"
                  :key="'loss-' + b.championId"
                  class="fast-stat-row"
                >
                  <td class="py-0.5">
                    <div class="flex w-full min-w-0 items-center gap-0.5">
                      <span class="w-4 shrink-0 text-text/70">{{ Number(idx) + 1 }}.</span>
                      <img
                        v-if="p.gameVersion && p.championByKey(b.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(b.championId)!.image.full
                          )
                        "
                        :alt="p.championName(b.championId) || ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                      />
                      <span class="min-w-[5.5rem] shrink-0 truncate font-medium text-text">{{
                        p.championName(b.championId) || b.championId
                      }}</span>
                      <span class="ml-auto w-9 shrink-0 text-right font-medium text-text">{{
                        b.banRatePercent
                      }}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="(p.overviewTeamsData.bans.byLoss ?? []).length" class="mt-1 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToBansTab()"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewNoData') }}</div>
    </div>
  </div>
</template>
