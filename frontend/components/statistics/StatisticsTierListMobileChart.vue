<script setup lang="ts">
import { computed, inject } from 'vue'
import { tierChartColor } from '~/utils/tierChartColors'
import { championStatsDetailPathIfValid } from '~/utils/championStatsRoutes'

type ChartRow = {
  championId: number
  tier: string
  pickrate: number
  winrate: number
  pbi: number
}

const p = inject('statisticsPageCtx') as Record<string, unknown>

function t(key: string): string {
  const fn = p.t as ((k: string) => string) | undefined
  return fn?.(key) ?? key
}

const rows = computed(() => (p.tierListChartVisibleRows as ChartRow[] | undefined) ?? [])

const zeroLinePct = computed(() => Number(p.tierListChartZeroBottomPct) || 50)

function barStyle(pbi: number, tier: string): { leftPct: number; widthPct: number; color: string } {
  const fn = p.tierListChartHorizontalBarStyle as
    | ((pbi: number, tier: string) => { leftPct: number; widthPct: number; color: string })
    | undefined
  return fn?.(pbi, tier) ?? { leftPct: 0, widthPct: 0, color: tierChartColor(tier) }
}

function tierLabel(tier: string): string {
  if (tier === 'D') return t('statisticsPage.tierF')
  if (tier === 'S+') return t('statisticsPage.tierS+')
  return t(`statisticsPage.tier${tier}`)
}

function championName(id: number): string {
  const fn = p.championName as ((id: number) => string | null) | undefined
  return fn?.(id) ?? String(id)
}

function portraitSrc(id: number): string | null {
  const gv = p.gameVersion as string | undefined
  const byKey = p.championByKey as ((id: number) => { image: { full: string } } | null) | undefined
  const urlFn = p.getChampionImageUrl as ((v: string, f: string) => string) | undefined
  const champ = byKey?.(id)
  if (!gv || !champ || !urlFn) return null
  return urlFn(gv, champ.image.full)
}

function formatPbi(pbi: number): string {
  const fn = p.formatMatchupScore as ((n: number, d?: number) => string) | undefined
  return fn?.(pbi, 2) ?? pbi.toFixed(2)
}

function championDetailTo(id: number): string | null {
  const pathFn = p.localePath as ((path: string) => string) | undefined
  return championStatsDetailPathIfValid(id, pathFn)
}

function barColor(tier: string): string {
  const fn = p.tierListChartBarColor as ((tier: string) => string) | undefined
  return fn?.(tier) ?? tierChartColor(tier)
}
</script>

<template>
  <div
    class="statistics-tier-list-mobile-chart space-y-1.5"
    role="list"
    :aria-label="t('statisticsPage.tierListViewChart')"
  >
    <div
      v-for="row in rows"
      :key="'tl-chart-m-' + row.championId"
      role="listitem"
      class="statistics-tier-list-mobile-chart-row overflow-hidden rounded-lg border border-primary/25 bg-black/25"
    >
      <div class="flex min-w-0 items-start gap-2.5 px-2.5 py-2">
        <component
          :is="championDetailTo(row.championId) ? 'NuxtLink' : 'div'"
          :to="championDetailTo(row.championId) ?? undefined"
          class="flex min-w-0 max-w-[42%] shrink-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          :class="championDetailTo(row.championId) ? 'hover:opacity-90 active:opacity-80' : ''"
          :aria-label="
            championDetailTo(row.championId)
              ? t('statisticsPage.championStatsOpenDetail')
              : undefined
          "
        >
          <img
            v-if="portraitSrc(row.championId)"
            :src="portraitSrc(row.championId)!"
            :alt="championName(row.championId)"
            class="h-10 w-10 shrink-0 rounded-full border object-cover"
            :style="{ borderColor: barColor(row.tier) + '99' }"
            width="40"
            height="40"
          />
          <span
            v-else
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-black/40 text-[10px] font-bold text-white/85"
            :style="{ borderColor: barColor(row.tier) + '99' }"
          >
            {{ championName(row.championId).slice(0, 2) }}
          </span>
          <span
            class="min-w-0 truncate text-sm font-semibold"
            :class="
              championDetailTo(row.championId)
                ? 'text-accent underline decoration-accent/40 underline-offset-2'
                : 'text-text'
            "
          >
            {{ championName(row.championId) }}
          </span>
        </component>
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center justify-end gap-2">
            <span
              class="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold leading-none text-black"
              :style="{ backgroundColor: barColor(row.tier) }"
            >
              {{ tierLabel(row.tier) }}
            </span>
          </div>
          <div class="mt-1.5 flex min-w-0 items-center gap-2">
            <div
              class="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/35"
              :title="t('statisticsPage.tierListPbi')"
            >
              <div
                class="pointer-events-none absolute bottom-0 top-0 z-[1] w-px bg-amber-400/55"
                :style="{ left: `calc(${zeroLinePct}% - 0.5px)` }"
                aria-hidden="true"
              />
              <div
                class="absolute inset-y-0 rounded-full transition-[left,width] duration-200"
                :style="{
                  left: barStyle(row.pbi, row.tier).leftPct + '%',
                  width: barStyle(row.pbi, row.tier).widthPct + '%',
                  backgroundColor: barStyle(row.pbi, row.tier).color,
                }"
              />
            </div>
            <span class="shrink-0 text-xs font-semibold tabular-nums text-text/90">
              {{ formatPbi(row.pbi) }}
            </span>
          </div>
          <div
            class="mt-0.5 flex items-center justify-between gap-2 text-[10px] tabular-nums text-text/60"
          >
            <span>
              {{ t('statisticsPage.winrate') }}
              {{ (row.winrate * 100).toFixed(1) }}%
            </span>
            <span>
              {{ t('statisticsPage.pickrate') }}
              {{ (row.pickrate * 100).toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
