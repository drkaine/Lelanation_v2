<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold text-text-accent">
      {{ p.t('statisticsPage.abandonsTitle') }}
    </h2>
    <p class="text-sm text-text/80">{{ p.t('statisticsPage.abandonsDescription') }}</p>
    <div v-if="p.overviewAbandonsPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewAbandonsData" class="grid gap-4 sm:grid-cols-3">
      <div class="ui-build-card-surface rounded-xl p-4">
        <div class="text-sm text-text/70">{{ p.t('statisticsPage.abandonsRemakeRate') }}</div>
        <div class="text-2xl font-semibold text-text">
          {{ p.overviewAbandonsData.remakeRate?.toFixed(2) ?? 0 }}%
        </div>
        <div class="text-xs text-text/50">
          {{ p.overviewAbandonsData.remakeCount }} / {{ p.overviewAbandonsData.totalMatches }}
        </div>
      </div>
      <div class="ui-build-card-surface rounded-xl p-4">
        <div class="text-sm text-text/70">
          {{ p.t('statisticsPage.abandonsEarlySurrenderRate') }}
        </div>
        <div class="text-2xl font-semibold text-text">
          {{ p.overviewAbandonsData.earlySurrenderRate?.toFixed(2) ?? 0 }}%
        </div>
        <div class="text-xs text-text/50">
          {{ p.overviewAbandonsData.earlySurrenderCount }} /
          {{ p.overviewAbandonsData.totalMatches }}
        </div>
      </div>
      <div class="ui-build-card-surface rounded-xl p-4">
        <div class="text-sm text-text/70">
          {{ p.t('statisticsPage.abandonsSurrenderRate') }}
        </div>
        <div class="text-2xl font-semibold text-text">
          {{ p.overviewAbandonsData.surrenderRate?.toFixed(2) ?? 0 }}%
        </div>
        <div class="text-xs text-text/50">
          {{ p.overviewAbandonsData.surrenderCount }} /
          {{ p.overviewAbandonsData.totalMatches }}
        </div>
      </div>
    </div>
    <div v-else class="text-text/70">{{ p.t('statisticsPage.noData') }}</div>
  </div>
</template>
