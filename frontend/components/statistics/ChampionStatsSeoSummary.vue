<template>
  <div class="sr-only" aria-hidden="true">
    <p class="font-bold">{{ heading }}</p>
    <p>{{ intro }}</p>
    <table class="w-full max-w-lg border-collapse text-sm">
      <caption>
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ t('statisticsPage.filterRole') }}</th>
          <th scope="col">{{ t('statisticsPage.winrate') }}</th>
          <th scope="col">{{ t('statisticsPage.pickrate') }}</th>
          <th scope="col">{{ t('statisticsPage.games') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">{{ t('statisticsPage.championStatsGlobalRow') }}</th>
          <td>{{ formatPct(stats.winrate) }}%</td>
          <td>{{ formatPct(stats.pickrate) }}%</td>
          <td>{{ stats.games }}</td>
        </tr>
        <tr v-for="row in roleRows" :key="row.role">
          <th scope="row">{{ roleLabel(row.role) }}</th>
          <td>{{ formatPct(row.winrate) }}%</td>
          <td>{{ formatPct(row.pickrate) }}%</td>
          <td>{{ row.games }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="stats.banrate != null">
      {{ t('statisticsPage.championStatsBanrateTitle') }}: {{ formatPct(stats.banrate) }}%
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChampionStatsSummary } from '~/composables/statistics/useChampionStatsSsr'
import { buildChampionRoleDistribution } from '~/utils/championRoleDistribution'

const props = defineProps<{
  championName: string
  season: string
  patch: string
  stats: ChampionStatsSummary
}>()

const { t } = useI18n()

const heading = computed(() =>
  t('statisticsPage.championStatsSeoHeading', {
    champion: props.championName,
    season: props.season,
    patch: props.patch,
  })
)

const intro = computed(() =>
  t('statisticsPage.championStatsSeoIntro', {
    champion: props.championName,
    winrate: formatPct(props.stats.winrate),
    pickrate: formatPct(props.stats.pickrate),
    patch: props.patch,
  })
)

const caption = computed(() =>
  t('statisticsPage.championStatsSeoTableCaption', { champion: props.championName })
)

const roleRows = computed(() =>
  buildChampionRoleDistribution(props.stats.byRole).filter(row => row.games > 0)
)

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(1)
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    TOP: t('home.tierRoles.top'),
    JUNGLE: t('home.tierRoles.jungle'),
    MIDDLE: t('home.tierRoles.mid'),
    BOTTOM: t('home.tierRoles.adc'),
    SUPPORT: t('home.tierRoles.support'),
  }
  return map[role] ?? role
}
</script>
