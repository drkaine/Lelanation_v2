<script setup lang="ts">
import { computed, ref } from 'vue'
import { isLowSample } from '~/utils/statistics/lowSample'
import { normalizeStatsRoleKey, roles } from '~/utils/statistics/statisticsTableFormat'
import {
  afkByRole,
  DUO_OBJECTIVES,
  duoBansByPair,
  duoPairKey,
  duoPicksByPair,
  duosByRolePair,
} from '~/utils/statistics/teamMiscTable'
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
const duoPicks = computed(() => duoPicksByPair(data.value.duoPicks ?? [], tiers.value, 5))
const duoBans = computed(() =>
  duoBansByPair(
    data.value.duoBans ?? [],
    tiers.value,
    new Map(duoLines.value.map(l => [duoPairKey(l.roleA, l.roleB), l.games])),
    5
  )
)
/** Paire dépliée (détail picks, bans, objectifs). */
const openPair = ref<string | null>(null)
function togglePair(key: string) {
  openPair.value = openPair.value === key ? null : key
}

function championSrc(championId: number): string | null {
  const champ = p.championByKey(championId)
  if (!p.gameVersion || !champ) return null
  return p.getChampionImageUrl(p.gameVersion, champ.image.full)
}

function championName(championId: number): string {
  return p.championByKey(championId)?.name ?? String(championId)
}

function avg(value: number): string {
  return value.toFixed(2)
}

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

      <section class="rounded-lg border border-white/10 bg-surface p-3 lg:col-span-2">
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
              <th class="text-right font-normal">
                {{ p.t('statisticsPage.teamMiscSurrenderFor') }}
              </th>
              <th class="text-right font-normal">
                {{ p.t('statisticsPage.teamMiscSurrenderAgainst') }}
              </th>
              <th class="text-right font-normal">{{ p.t('statisticsPage.teamMiscAfkRate') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="line in duoLines" :key="duoPairKey(line.roleA, line.roleB)">
              <tr
                class="cursor-pointer border-t border-white/5 hover:bg-white/5"
                :class="{ 'opacity-60': isLowSample(line.games) }"
                @click="togglePair(duoPairKey(line.roleA, line.roleB))"
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
                <td class="text-right tabular-nums">{{ pct(line.surrenderForRate) }}</td>
                <td class="text-right tabular-nums">{{ pct(line.surrenderAgainstRate) }}</td>
                <td class="text-right tabular-nums">{{ pct(line.afkRate) }}</td>
              </tr>
              <tr v-if="openPair === duoPairKey(line.roleA, line.roleB)" class="bg-white/5">
                <td colspan="9" class="p-3">
                  <div class="grid gap-4 md:grid-cols-3">
                    <div>
                      <h4 class="mb-1 text-xs font-semibold text-text/70">
                        {{ p.t('statisticsPage.teamMiscDuoObjectives') }}
                      </h4>
                      <table class="w-full text-xs">
                        <thead class="text-text/60">
                          <tr>
                            <th class="text-left font-normal"></th>
                            <th class="text-right font-normal">
                              {{ p.t('statisticsPage.teamMiscDuoOwn') }}
                            </th>
                            <th class="text-right font-normal">
                              {{ p.t('statisticsPage.teamMiscDuoEnemy') }}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="o in DUO_OBJECTIVES" :key="o">
                            <td>{{ p.t(`statisticsPage.teamMiscObjective.${o}`) }}</td>
                            <td
                              class="text-right tabular-nums"
                              :class="{
                                'text-green-400': line.objectives[o].own > line.objectives[o].enemy,
                              }"
                            >
                              {{ avg(line.objectives[o].own) }}
                            </td>
                            <td
                              class="text-right tabular-nums"
                              :class="{
                                'text-red-400': line.objectives[o].enemy > line.objectives[o].own,
                              }"
                            >
                              {{ avg(line.objectives[o].enemy) }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <h4 class="mb-1 text-xs font-semibold text-text/70">
                        {{ p.t('statisticsPage.teamMiscDuoPicks') }}
                      </h4>
                      <div
                        v-for="r in [line.roleA, line.roleB]"
                        :key="r"
                        class="mb-2 flex flex-wrap items-center gap-1.5"
                      >
                        <img
                          v-if="role(r).icon"
                          :src="role(r).icon"
                          :alt="role(r).label"
                          class="h-4 w-4 object-contain"
                        />
                        <span
                          v-for="pick in duoPicks.get(duoPairKey(line.roleA, line.roleB))?.[r] ??
                          []"
                          :key="pick.championId"
                          class="inline-flex items-center gap-1 text-xs"
                          :title="`${championName(pick.championId)} · ${count(pick.games)} · ${pct(pick.winrate)}`"
                        >
                          <img
                            v-if="championSrc(pick.championId)"
                            :src="championSrc(pick.championId) ?? ''"
                            :alt="championName(pick.championId)"
                            class="h-6 w-6 rounded"
                          />
                          <span class="tabular-nums">{{ pct(pick.winrate) }}</span>
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 class="mb-1 text-xs font-semibold text-text/70">
                        {{ p.t('statisticsPage.teamMiscDuoBans') }}
                      </h4>
                      <div class="flex flex-wrap gap-1.5">
                        <span
                          v-for="ban in duoBans.get(duoPairKey(line.roleA, line.roleB)) ?? []"
                          :key="ban.championId"
                          class="inline-flex items-center gap-1 text-xs"
                          :title="`${championName(ban.championId)} · ${count(ban.bans)}`"
                        >
                          <img
                            v-if="championSrc(ban.championId)"
                            :src="championSrc(ban.championId) ?? ''"
                            :alt="championName(ban.championId)"
                            class="h-6 w-6 rounded"
                          />
                          <span class="tabular-nums">{{ pct(ban.rate) }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>
