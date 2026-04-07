<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>

<template>
  <div class="space-y-6">
    <div v-if="p.overviewDetailPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewDetailError" class="rounded border border-error/50 p-3 text-error">
      {{ p.t('statisticsPage.overviewDetailTimeout') }}
    </div>
    <template
      v-else-if="
        p.itemFastSliceConfigs.length > 0 ||
        (p.overviewDetailData?.items?.length ?? 0) > 0 ||
        (p.overviewDetailData?.itemStarterSets?.length ?? 0) > 0
      "
    >
      <div
        v-if="p.itemFastSliceConfigs.length > 0"
        class="flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[10px] pb-2"
      >
        <StatisticsItemStatsFastSection
          v-for="c in p.itemFastSliceConfigs"
          :key="c.slice"
          :slice="c.slice"
          :rows="c.rows"
          :baseline-rows="c.baselineRows"
          :total-participants="p.overviewDetailData?.totalParticipants ?? 0"
          :game-version="p.gameVersion"
          :ref-version-label="p.progressionFromVersion"
          :baseline-pending="p.overviewDetailBaselinePending"
        />
      </div>
      <template v-if="(p.overviewDetailData?.itemStarterSets ?? []).length">
        <h3 class="text-base font-semibold text-text-accent">
          {{ p.t('statisticsPage.itemsStarterSetsTitle') }}
        </h3>
        <p class="text-xs text-text/65">{{ p.t('statisticsPage.itemsStarterSetsHint') }}</p>
        <div
          class="statistics-overview-surface mt-2 overflow-x-auto rounded-lg border border-primary/30"
        >
          <table class="w-full min-w-[320px] text-left text-sm">
            <thead class="border-b border-primary/30 bg-black/25">
              <tr>
                <th class="px-3 py-2 font-semibold text-text">
                  {{ p.t('statisticsPage.overviewDetailItems') }}
                </th>
                <th class="px-3 py-2 font-semibold text-text">
                  {{ p.t('statisticsPage.overviewDetailPickRate') }} %
                </th>
                <th class="px-3 py-2 font-semibold text-text">
                  {{ p.t('statisticsPage.overviewDetailWinRate') }} %
                </th>
                <th class="hidden px-3 py-2 font-semibold text-text sm:table-cell">
                  {{ p.t('statisticsPage.tierListGames') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="srow in p.overviewDetailData?.itemStarterSets ?? []"
                :key="srow.items.join('-')"
                class="hover:bg-white/5"
              >
                <td class="px-3 py-2">
                  <div class="flex flex-wrap items-center gap-1">
                    <template v-for="(iid, iidx) in srow.items" :key="iidx + '-' + iid">
                      <img
                        v-if="p.itemImageName(iid)"
                        :src="p.getItemImageUrl(p.gameVersion, p.itemImageName(iid)!)"
                        :alt="p.itemName(iid) || ''"
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
        {{ p.t('statisticsPage.itemsFullTableTitle') }}
      </h3>
      <div class="statistics-overview-surface overflow-x-auto rounded-lg border border-primary/30">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-primary/30 bg-black/25">
            <tr>
              <th class="font-semibold text-text">
                {{ p.t('statisticsPage.overviewDetailItems') }}
              </th>
              <th class="font-semibold text-text">
                {{ p.t('statisticsPage.overviewDetailPickRate') }} %
              </th>
              <th class="font-semibold text-text">
                {{ p.t('statisticsPage.overviewDetailWinRate') }} %
              </th>
              <th class="font-semibold text-text">
                {{ p.t('statisticsPage.itemStats') }}
              </th>
              <th class="font-semibold text-text">
                {{ p.t('statisticsPage.itemEconomy') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20">
            <tr v-for="row in p.paginatedItems" :key="row.itemId" class="hover:bg-white/5">
              <td class="px-4 py-2">
                <div class="flex items-center gap-2">
                  <img
                    v-if="p.itemImageName(row.itemId)"
                    :src="p.getItemImageUrl(p.gameVersion, p.itemImageName(row.itemId)!)"
                    :alt="p.itemName(row.itemId) || ''"
                    class="h-8 w-8 rounded object-cover"
                    width="32"
                    height="32"
                  />
                  <span class="text-text">{{ p.itemName(row.itemId) || row.itemId }}</span>
                </div>
              </td>
              <td class="px-4 py-2 text-text/90">{{ row.pickrate?.toFixed(2) ?? '—' }}</td>
              <td class="px-4 py-2 text-text/90">
                {{ row.winrate != null ? Number(row.winrate).toFixed(2) : '—' }}
              </td>
              <td class="max-w-[200px] px-4 py-2 text-text/80">
                <span
                  v-if="p.itemStatsForItem(row.itemId).length"
                  :title="p.itemStatsForItem(row.itemId).join(', ')"
                  class="line-clamp-2 text-xs"
                >
                  {{ p.itemStatsForItem(row.itemId).join(', ') }}
                </span>
                <span v-else class="text-text/50">—</span>
              </td>
              <td class="max-w-[160px] px-4 py-2 text-text/80">
                <span
                  v-if="p.itemEconomicForItem(row.itemId).length"
                  :title="p.itemEconomicForItem(row.itemId).join(', ')"
                  class="line-clamp-2 text-xs"
                >
                  {{ p.itemEconomicForItem(row.itemId).join(', ') }}
                </span>
                <span v-else class="text-text/50">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="p.totalItemsCount > 0"
          class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
        >
          <span>{{ p.totalItemsCount }} {{ p.t('statisticsPage.overviewDetailItems') }}</span>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5">
              <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
              <select
                v-model.number="p.itemsPageSize"
                class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
              >
                <option v-for="n in p.PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
              </select>
            </label>
            <span class="text-text/70">
              {{ (p.itemsPage - 1) * p.itemsPageSize + 1 }}-{{
                Math.min(p.itemsPage * p.itemsPageSize, p.totalItemsCount)
              }}
              / {{ p.totalItemsCount }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="p.itemsPage <= 1"
                @click="p.itemsPage = Math.max(1, p.itemsPage - 1)"
              >
                ‹
              </button>
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="p.itemsPage >= p.totalItemsPages"
                @click="p.itemsPage = Math.min(p.totalItemsPages, p.itemsPage + 1)"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewDetailNoData') }}</div>
  </div>
</template>
