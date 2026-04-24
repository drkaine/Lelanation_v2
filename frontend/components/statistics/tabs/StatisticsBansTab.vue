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
      <div
        class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
      >
        <div class="tier-list-lolalytics w-full min-w-0 text-[13px]">
          <table class="w-full min-w-[520px] text-left text-sm">
            <thead
              class="sticky top-0 z-10 border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
            >
              <tr>
                <th class="px-3 py-1.5 font-semibold text-text">
                  {{ p.t('statisticsPage.champion') }}
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
                <th class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text">
                  <div class="flex items-center gap-1">
                    <button type="button" class="text-blue-300" @click="p.setBansSort('blue')">
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
                <th class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text">
                  <div class="flex items-center gap-1">
                    <button type="button" class="text-red-300" @click="p.setBansSort('red')">
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
                  v-show="p.showBansRoleColumns"
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
                class="cursor-pointer text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
                @click="navigateTo(p.localePath('/statistics/champion/' + row.championId))"
              >
                <td class="px-3 py-1 font-medium text-text">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="p.gameVersion && p.championByKey(row.championId)"
                      :src="
                        p.getChampionImageUrl(
                          p.gameVersion,
                          p.championByKey(row.championId)!.image.full
                        )
                      "
                      :alt="p.championName(row.championId) || ''"
                      class="h-5 w-5 rounded-full object-cover"
                    />
                    <span class="text-accent underline-offset-2 hover:underline">{{
                      p.championName(row.championId) || row.championId
                    }}</span>
                  </div>
                </td>
                <td class="px-3 py-1 tabular-nums text-text/90">
                  {{ p.banRateForBansRow(row, p.bansTableData?.matchCount ?? 0).toFixed(2) }}%
                  <div
                    v-if="p.bansDeltaPct(row, 'bansTotal', 2) != null"
                    class="text-[11px]"
                    :class="p.pctDeltaClass(p.bansDeltaPct(row, 'bansTotal', 2)!)"
                  >
                    {{
                      (p.bansDeltaPct(row, 'bansTotal', 2)! > 0 ? '+' : '') +
                      p.bansDeltaPct(row, 'bansTotal', 2)!.toFixed(2)
                    }}%
                  </div>
                </td>
                <td class="px-3 py-1 tabular-nums text-text/90">
                  {{
                    p.banPctForCount(row.bansBlue, p.bansTableData?.matchCount ?? 0, 1).toFixed(2)
                  }}%
                  <div
                    v-if="p.bansDeltaPct(row, 'bansBlue', 1) != null"
                    class="text-[11px]"
                    :class="p.pctDeltaClass(p.bansDeltaPct(row, 'bansBlue', 1)!)"
                  >
                    {{
                      (p.bansDeltaPct(row, 'bansBlue', 1)! > 0 ? '+' : '') +
                      p.bansDeltaPct(row, 'bansBlue', 1)!.toFixed(2)
                    }}%
                  </div>
                </td>
                <td class="px-3 py-1 tabular-nums text-text/90">
                  {{
                    p.banPctForCount(row.bansRed, p.bansTableData?.matchCount ?? 0, 1).toFixed(2)
                  }}%
                  <div
                    v-if="p.bansDeltaPct(row, 'bansRed', 1) != null"
                    class="text-[11px]"
                    :class="p.pctDeltaClass(p.bansDeltaPct(row, 'bansRed', 1)!)"
                  >
                    {{
                      (p.bansDeltaPct(row, 'bansRed', 1)! > 0 ? '+' : '') +
                      p.bansDeltaPct(row, 'bansRed', 1)!.toFixed(2)
                    }}%
                  </div>
                </td>
                <td v-show="p.showBansRoleColumns" class="px-3 py-1 tabular-nums text-text/90">
                  {{
                    p.banPctForCount(row.bansTop, p.bansTableData?.matchCount ?? 0, 1).toFixed(2)
                  }}%
                  <div
                    v-if="p.bansDeltaPct(row, 'bansTop', 1) != null"
                    class="text-[11px]"
                    :class="p.pctDeltaClass(p.bansDeltaPct(row, 'bansTop', 1)!)"
                  >
                    {{
                      (p.bansDeltaPct(row, 'bansTop', 1)! > 0 ? '+' : '') +
                      p.bansDeltaPct(row, 'bansTop', 1)!.toFixed(2)
                    }}%
                  </div>
                </td>
                <td v-show="p.showBansRoleColumns" class="px-3 py-1 tabular-nums text-text/90">
                  {{
                    p
                      .banPctForCount(row.bansJungle, p.bansTableData?.matchCount ?? 0, 1)
                      .toFixed(2)
                  }}%
                  <div
                    v-if="p.bansDeltaPct(row, 'bansJungle', 1) != null"
                    class="text-[11px]"
                    :class="p.pctDeltaClass(p.bansDeltaPct(row, 'bansJungle', 1)!)"
                  >
                    {{
                      (p.bansDeltaPct(row, 'bansJungle', 1)! > 0 ? '+' : '') +
                      p.bansDeltaPct(row, 'bansJungle', 1)!.toFixed(2)
                    }}%
                  </div>
                </td>
                <td v-show="p.showBansRoleColumns" class="px-3 py-1 tabular-nums text-text/90">
                  {{
                    p
                      .banPctForCount(row.bansMiddle, p.bansTableData?.matchCount ?? 0, 1)
                      .toFixed(2)
                  }}%
                  <div
                    v-if="p.bansDeltaPct(row, 'bansMiddle', 1) != null"
                    class="text-[11px]"
                    :class="p.pctDeltaClass(p.bansDeltaPct(row, 'bansMiddle', 1)!)"
                  >
                    {{
                      (p.bansDeltaPct(row, 'bansMiddle', 1)! > 0 ? '+' : '') +
                      p.bansDeltaPct(row, 'bansMiddle', 1)!.toFixed(2)
                    }}%
                  </div>
                </td>
                <td v-show="p.showBansRoleColumns" class="px-3 py-1 tabular-nums text-text/90">
                  {{
                    p
                      .banPctForCount(row.bansBottom, p.bansTableData?.matchCount ?? 0, 1)
                      .toFixed(2)
                  }}%
                  <div
                    v-if="p.bansDeltaPct(row, 'bansBottom', 1) != null"
                    class="text-[11px]"
                    :class="p.pctDeltaClass(p.bansDeltaPct(row, 'bansBottom', 1)!)"
                  >
                    {{
                      (p.bansDeltaPct(row, 'bansBottom', 1)! > 0 ? '+' : '') +
                      p.bansDeltaPct(row, 'bansBottom', 1)!.toFixed(2)
                    }}%
                  </div>
                </td>
                <td v-show="p.showBansRoleColumns" class="px-3 py-1 tabular-nums text-text/90">
                  {{
                    p
                      .banPctForCount(row.bansSupport, p.bansTableData?.matchCount ?? 0, 1)
                      .toFixed(2)
                  }}%
                  <div
                    v-if="p.bansDeltaPct(row, 'bansSupport', 1) != null"
                    class="text-[11px]"
                    :class="p.pctDeltaClass(p.bansDeltaPct(row, 'bansSupport', 1)!)"
                  >
                    {{
                      (p.bansDeltaPct(row, 'bansSupport', 1)! > 0 ? '+' : '') +
                      p.bansDeltaPct(row, 'bansSupport', 1)!.toFixed(2)
                    }}%
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
                  class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                  :disabled="p.bansPage <= 1"
                  @click="p.onBansPageUpdated(Math.max(1, p.bansPage - 1))"
                >
                  ‹
                </button>
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
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
import { inject, unref } from 'vue'
import type { BansSortCol } from '~/composables/statistics/useStatisticsBansTab'

const p = inject('statisticsPageCtx') as any

function onPageSizeChange(event: Event): void {
  const target = event.target as HTMLSelectElement | null
  const fallback = unref(p.championsPageSize)
  p.onBansPageSizeUpdated(Number(target?.value ?? fallback))
}

const roleHeaders: Array<{ key: BansSortCol; deltaKey: BansSortCol; icon: string; alt: string }> = [
  { key: 'top', deltaKey: 'topDelta', icon: '/icons/roles/top.png', alt: 'Top' },
  { key: 'jungle', deltaKey: 'jungleDelta', icon: '/icons/roles/jungle.png', alt: 'Jungle' },
  { key: 'middle', deltaKey: 'middleDelta', icon: '/icons/roles/mid.png', alt: 'Mid' },
  { key: 'bottom', deltaKey: 'bottomDelta', icon: '/icons/roles/bot.png', alt: 'Bot' },
  { key: 'support', deltaKey: 'supportDelta', icon: '/icons/roles/support.png', alt: 'Support' },
]
</script>
