<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>

<template>
  <div class="space-y-6">
    <template v-if="p.overviewDetailPending">
      <div class="rounded-lg">
        <div class="py-4 text-text/70">{{ p.t('statisticsPage.loading') }}</div>
      </div>
    </template>
    <template v-else>
      <div
        v-if="p.overviewDetailError"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
      >
        <p class="text-text/90">{{ p.t('statisticsPage.overviewDetailTimeout') }}</p>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          @click="p.retryOverviewDetail()"
        >
          {{ p.t('statisticsPage.retry') }}
        </button>
      </div>
      <template v-if="!p.overviewDetailError">
        <div
          v-if="p.overviewDetailPending && !p.overviewDetailData"
          class="rounded-lg py-8 text-center text-text/70"
        >
          {{ p.t('statisticsPage.loading') }}
        </div>
        <StatisticsRunesOverviewPanel
          v-else-if="p.overviewDetailData"
          :game-version="p.gameVersion || p.versionStore.currentVersion || ''"
          :data="p.overviewDetailData"
          :baseline="p.overviewDetailBaselineData"
          :baseline-pending="p.overviewDetailBaselinePending"
          :comparison-version="p.overviewDetailComparisonVersion"
        />
        <div v-else class="statistics-overview-surface rounded-lg border border-primary/30 p-6">
          <div class="py-4 text-text/70">
            {{ p.t('statisticsPage.overviewDetailNoData') }}
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
