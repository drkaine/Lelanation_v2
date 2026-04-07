<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold text-text-accent">
      {{ p.t('statisticsPage.spellsTitle') }}
    </h2>
    <p class="text-sm text-text/80">{{ p.t('statisticsPage.spellsDescription') }}</p>
    <div v-if="p.overviewDetailPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewDetailError" class="rounded border border-error/50 p-3 text-error">
      {{ p.t('statisticsPage.overviewDetailTimeout') }}
    </div>
    <SummonerSpellTierTables
      v-else-if="
        (p.overviewDetailData?.summonerSpells?.length ?? 0) > 0 ||
        (p.overviewDetailData?.summonerSpellSets?.length ?? 0) > 0
      "
      :solo-rows="p.overviewDetailData?.summonerSpells ?? []"
      :set-rows="p.overviewDetailData?.summonerSpellSets ?? []"
      :baseline-solo="p.overviewDetailBaselineData?.summonerSpells ?? null"
      :baseline-sets="p.overviewDetailBaselineData?.summonerSpellSets ?? null"
      :ref-version-label="p.progressionFromVersion"
      :baseline-pending="p.overviewDetailBaselinePending"
      :game-version="p.gameVersion"
    />
    <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewDetailNoData') }}</div>
  </div>
</template>
