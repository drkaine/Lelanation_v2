<script setup lang="ts">
import { computed } from 'vue'
import { isLowSample } from '~/utils/statistics/lowSample'
import { normalizeStatsRoleKey, roles } from '~/utils/statistics/statisticsTableFormat'
import { afkByRole, duosByRolePair } from '~/utils/statistics/teamMiscTable'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

const data = computed(() => p.teamMiscData ?? { afk: [], duos: [] })
/** Rangs du panneau filtres ; vide = tous rangs. */
const tiers = computed(() => p.statsDivisionFilter ?? [])
const afkLines = computed(() => afkByRole(data.value.afk, tiers.value))
const duoLines = computed(() => duosByRolePair(data.value.duos, tiers.value))

function role(value: string) {
  const key = normalizeStatsRoleKey(value)
  return roles.find(r => r.value === key) ?? { value, label: value, icon: '' }
}

function pct(value: number): string {
  return `${value.toFixed(2)}%`
}

function count(value: number): string {
  return Math.round(value)
    .toLocaleString('fr-FR')
    .replace(/\u202F/g, ' ')
}
</script>

<template>
  <div class="statistics-team-misc-tab space-y-4">
    <div v-if="p.teamMiscPending" class="text-sm text-text/70">
      {{ p.t('statisticsPage.teamMiscLoading') }}
    </div>
    <div v-else class="grid gap-4 lg:grid-cols-2">
      <section class="rounded-lg border border-white/10 bg-surface p-3">
        <h3 class="text-sm font-semibold">{{ p.t('statisticsPage.teamMiscAfkTitle') }}</h3>
        <p class="mb-2 text-xs text-text/60">{{ p.t('statisticsPage.teamMiscAfkHint') }}</p>
        <p v-if="afkLines.length === 0" class="text-sm text-text/70">
          {{ p.t('statisticsPage.teamMiscEmpty') }}
        </p>
        <table v-else class="w-full text-sm">
          <thead class="text-xs text-text/60">
            <tr>
              <th class="text-left font-normal">{{ p.t('statisticsPage.teamMiscRole') }}</th>
              <th class="text-right font-normal">{{ p.t('statisticsPage.teamMiscGames') }}</th>
              <th class="text-right font-normal">{{ p.t('statisticsPage.teamMiscAfkCount') }}</th>
              <th class="text-right font-normal">{{ p.t('statisticsPage.teamMiscAfkRate') }}</th>
              <th class="text-right font-normal text-sky-400">
                {{ p.t('statisticsPage.teamMiscBlue') }}
              </th>
              <th class="text-right font-normal text-red-400">
                {{ p.t('statisticsPage.teamMiscRed') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="line in afkLines"
              :key="line.role"
              class="border-t border-white/5"
              :class="{ 'opacity-60': isLowSample(line.games) }"
            >
              <td class="py-1">
                <span class="inline-flex items-center gap-1.5">
                  <img
                    v-if="role(line.role).icon"
                    :src="role(line.role).icon"
                    alt=""
                    class="h-4 w-4 object-contain"
                  />
                  {{ role(line.role).label }}
                </span>
              </td>
              <td class="text-right tabular-nums">{{ count(line.games) }}</td>
              <td class="text-right tabular-nums">{{ count(line.afk) }}</td>
              <td class="text-right font-semibold tabular-nums">{{ pct(line.rate) }}</td>
              <td class="text-right tabular-nums text-sky-400" :title="count(line.blue.games)">
                {{ pct(line.blue.rate) }}
              </td>
              <td class="text-right tabular-nums text-red-400" :title="count(line.red.games)">
                {{ pct(line.red.rate) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="rounded-lg border border-white/10 bg-surface p-3">
        <h3 class="text-sm font-semibold">{{ p.t('statisticsPage.teamMiscDuosTitle') }}</h3>
        <p class="mb-2 text-xs text-text/60">{{ p.t('statisticsPage.teamMiscDuosHint') }}</p>
        <p v-if="duoLines.length === 0" class="text-sm text-text/70">
          {{ p.t('statisticsPage.teamMiscEmpty') }}
        </p>
        <table v-else class="w-full text-sm">
          <thead class="text-xs text-text/60">
            <tr>
              <th class="text-left font-normal">{{ p.t('statisticsPage.teamMiscDuoPair') }}</th>
              <th class="text-right font-normal">{{ p.t('statisticsPage.teamMiscGames') }}</th>
              <th class="text-right font-normal">{{ p.t('statisticsPage.teamMiscWinrate') }}</th>
              <th class="text-right font-normal">{{ p.t('statisticsPage.teamMiscDuoShare') }}</th>
              <th class="text-right font-normal text-sky-400">
                {{ p.t('statisticsPage.teamMiscBlue') }}
              </th>
              <th class="text-right font-normal text-red-400">
                {{ p.t('statisticsPage.teamMiscRed') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="line in duoLines"
              :key="`${line.roleA}-${line.roleB}`"
              class="border-t border-white/5"
              :class="{ 'opacity-60': isLowSample(line.games) }"
            >
              <td class="py-1">
                <span class="inline-flex items-center gap-1.5">
                  <img
                    v-if="role(line.roleA).icon"
                    :src="role(line.roleA).icon"
                    alt=""
                    class="h-4 w-4 object-contain"
                  />
                  <img
                    v-if="role(line.roleB).icon"
                    :src="role(line.roleB).icon"
                    alt=""
                    class="h-4 w-4 object-contain"
                  />
                  {{ role(line.roleA).label }} + {{ role(line.roleB).label }}
                </span>
              </td>
              <td class="text-right tabular-nums">{{ count(line.games) }}</td>
              <td class="text-right font-semibold tabular-nums">{{ pct(line.winrate) }}</td>
              <td class="text-right tabular-nums">{{ pct(line.share) }}</td>
              <td class="text-right tabular-nums text-sky-400" :title="count(line.blue.games)">
                {{ pct(line.blue.winrate) }}
              </td>
              <td class="text-right tabular-nums text-red-400" :title="count(line.red.games)">
                {{ pct(line.red.winrate) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>
