<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold text-text-accent">
      {{ p.t('statisticsPage.durationTitle') }}
    </h2>
    <p class="text-sm text-text/80">
      {{ p.t('statisticsPage.overviewDurationWinrateDescription') }}
    </p>
    <div
      v-if="p.overviewDurationWinratePending || !p.overviewDurationWinrateData?.buckets?.length"
      class="text-text/70"
    >
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div
      v-else-if="p.durationWinrateChartBuckets.length"
      class="relative w-full rounded-lg border border-primary/30 bg-surface/30 p-4"
    >
      <div class="relative min-h-[280px] w-full">
        <svg
          :viewBox="`0 0 ${p.CHART_W} ${p.CHART_H}`"
          class="h-auto min-h-[260px] w-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="duration-fill-global" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="rgb(var(--rgb-accent) / 0.4)" />
              <stop offset="100%" stop-color="rgb(var(--rgb-accent) / 0.05)" />
            </linearGradient>
          </defs>
          <path :d="p.durationWinrateChartClosedPath" fill="url(#duration-fill-global)" />
          <path
            :d="p.durationWinrateChartLinePath"
            fill="none"
            stroke="rgb(var(--rgb-accent))"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <g v-for="(pt, i) in p.durationWinrateChartPointsList" :key="'dpt-' + i">
            <circle
              :cx="pt.x"
              :cy="pt.y"
              r="12"
              fill="transparent"
              class="cursor-pointer"
              @mouseenter="
                p.durationChartTooltip = {
                  durationLabel: pt.durationLabel,
                  winrate: pt.winrate,
                  matchCount: pt.matchCount,
                  x: pt.x,
                  y: pt.y,
                }
              "
              @mouseleave="p.durationChartTooltip = null"
            />
            <circle :cx="pt.x" :cy="pt.y" r="3" fill="rgb(var(--rgb-accent))" />
          </g>
          <g v-for="(tick, i) in p.durationWinrateAxisX.ticks" :key="'dx-' + i">
            <line
              :x1="tick.x"
              :y1="p.CHART_PAD.top + p.PLOT_H"
              :y2="p.CHART_PAD.top + p.PLOT_H + 4"
              stroke="currentColor"
              stroke-width="1"
              class="text-text/50"
            />
            <text
              :x="tick.x"
              :y="p.CHART_H - 6"
              text-anchor="middle"
              class="fill-text/70 text-[10px]"
            >
              {{ tick.value }}
            </text>
          </g>
          <g v-for="(tick, i) in p.durationWinrateAxisY.ticks" :key="'dy-' + i">
            <line
              :x1="p.CHART_PAD.left"
              :y1="tick.y"
              :x2="p.CHART_PAD.left - 4"
              :y2="tick.y"
              stroke="currentColor"
              stroke-width="1"
              class="text-text/50"
            />
            <text
              :x="p.CHART_PAD.left - 8"
              :y="tick.y + 4"
              text-anchor="end"
              class="fill-text/70 text-[10px]"
            >
              {{ tick.value }}
            </text>
          </g>
          <!-- Légende abscisse (X) -->
          <text
            :x="p.CHART_W / 2"
            :y="p.CHART_H - 4"
            text-anchor="middle"
            class="fill-text/60 text-[11px]"
          >
            {{ p.t('statisticsPage.overviewDurationWinrateAxisX') }}
          </text>
          <!-- Légende ordonnée (Y) -->
          <text
            :x="14"
            :y="p.CHART_H / 2"
            text-anchor="middle"
            class="fill-text/60 text-[11px]"
            :transform="`rotate(-90, 14, ${p.CHART_H / 2})`"
          >
            {{ p.t('statisticsPage.overviewDurationMatchesAxisY') }}
          </text>
        </svg>
        <div
          v-if="p.durationChartTooltip"
          class="duration-chart-tooltip pointer-events-none absolute z-10 rounded border border-primary/40 bg-surface px-2 py-1.5 text-left text-xs shadow-lg"
          :style="{
            left: (p.durationChartTooltip.x / p.CHART_W) * 100 + '%',
            top: (p.durationChartTooltip.y / p.CHART_H) * 100 + '%',
            transform: 'translate(-50%, -100%) translateY(-8px)',
          }"
        >
          <div class="font-medium text-text">
            {{ p.durationChartTooltip.durationLabel }}
          </div>
          <div class="text-text/80">
            {{ p.durationChartTooltip.matchCount }}
            {{ p.t('statisticsPage.overviewDurationWinrateTooltipMatches') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
