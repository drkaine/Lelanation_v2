<template>
  <section
    class="champion-stats-seo-summary mb-4 rounded-lg border border-primary/30 bg-surface/40 p-4"
    aria-label="Résumé statistiques"
  >
    <h1 class="text-xl font-bold text-accent">
      {{ heading }}
    </h1>
    <p class="mt-2 text-sm text-text/80">{{ intro }}</p>
    <table class="mt-4 w-full max-w-lg border-collapse text-sm">
      <caption class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr class="border-b border-primary/30 text-left text-text/70">
          <th scope="col" class="py-2 pr-3">{{ t('statisticsPage.filterRole') }}</th>
          <th scope="col" class="py-2 pr-3">{{ t('statisticsPage.winrate') }}</th>
          <th scope="col" class="py-2 pr-3">{{ t('statisticsPage.pickrate') }}</th>
          <th scope="col" class="py-2">{{ t('statisticsPage.games') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b border-primary/20 font-medium text-text">
          <th scope="row" class="py-2 pr-3">{{ t('statisticsPage.championStatsGlobalRow') }}</th>
          <td class="py-2 pr-3 tabular-nums">{{ formatPct(stats.winrate) }}%</td>
          <td class="py-2 pr-3 tabular-nums">{{ formatPct(stats.pickrate) }}%</td>
          <td class="py-2 tabular-nums">{{ stats.games }}</td>
        </tr>
        <tr v-for="row in roleRows" :key="row.role" class="border-b border-primary/10 text-text/90">
          <th scope="row" class="py-2 pr-3">{{ roleLabel(row.role) }}</th>
          <td class="py-2 pr-3 tabular-nums">{{ formatPct(row.winrate) }}%</td>
          <td class="py-2 pr-3 tabular-nums">{{ formatPct(row.pickrate) }}%</td>
          <td class="py-2 tabular-nums">{{ row.games }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="stats.banrate != null" class="mt-3 text-sm text-text/75">
      {{ t('statisticsPage.championStatsBanrateTitle') }}:
      <strong class="tabular-nums">{{ formatPct(stats.banrate) }}%</strong>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChampionStatsSummary } from '~/composables/statistics/useChampionStatsSsr'

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

const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'] as const

const roleRows = computed(() => {
  const byRole = props.stats.byRole ?? {}
  const total = ROLE_ORDER.reduce((sum, role) => sum + (byRole[role]?.games ?? 0), 0)
  return ROLE_ORDER.map(role => {
    const data = byRole[role]
    const games = data?.games ?? 0
    return {
      role,
      games,
      winrate: data?.winrate ?? 0,
      pickrate: total > 0 ? (100 * games) / total : 0,
    }
  }).filter(row => row.games > 0)
})

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
