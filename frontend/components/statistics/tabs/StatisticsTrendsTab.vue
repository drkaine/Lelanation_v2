<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-lg">
      <h2 class="mb-4 text-xl font-semibold text-text-accent">
        {{ p.t('statisticsPage.progressionsTitle') }}
      </h2>
      <p class="mb-4 text-text/80">
        {{
          p.t('statisticsPage.progressionsDescription', {
            version: p.progressionFullData?.oldestVersion ?? '—',
          })
        }}
      </p>
      <div v-if="p.progressionFullPending" class="text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div v-else-if="!p.progressionFullData?.oldestVersion" class="text-text/70">
        {{ p.t('statisticsPage.progressionsNoVersion') }}
      </div>
      <div v-else-if="p.progressionFullData" class="space-y-8">
        <!-- Progression du winrate -->
        <div class="rounded-lg border border-primary/30 bg-surface/50 p-4">
          <h3 class="mb-3 text-lg font-medium text-text">
            {{ p.t('statisticsPage.progressionsWinrateTable') }}
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-left text-text/80">
                  <th class="pb-2 pr-2">{{ p.t('statisticsPage.champion') }}</th>
                  <th class="pb-2 pr-2 text-right">
                    {{ p.t('statisticsPage.progressionsWinrateCol') }}
                  </th>
                  <th class="pb-2 pl-2 text-right">
                    {{ p.t('statisticsPage.progressionsDelta') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in p.paginatedProgressionsChampions"
                  :key="'wr-' + row.championId"
                  class="border-b border-primary/20"
                >
                  <td class="py-1.5 pr-2">
                    <NuxtLink
                      :to="p.localePath('/statistics/champion/' + row.championId)"
                      class="flex items-center gap-2 hover:text-accent"
                    >
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) ?? ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                        width="24"
                        height="24"
                      />
                      <span>{{ p.championName(row.championId) || row.championId }}</span>
                    </NuxtLink>
                  </td>
                  <td class="py-1.5 text-right">{{ Number(row.wrSince).toFixed(2) }}%</td>
                  <td
                    class="py-1.5 pl-2 text-right"
                    :class="row.deltaWr >= 0 ? 'text-success' : 'text-error'"
                  >
                    {{ row.deltaWr >= 0 ? '+' : '' }}{{ row.deltaWr.toFixed(2) }}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <!-- Progression de la popularité -->
        <div class="rounded-lg border border-primary/30 bg-surface/50 p-4">
          <h3 class="mb-3 text-lg font-medium text-text">
            {{ p.t('statisticsPage.progressionsPopularityTable') }}
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-left text-text/80">
                  <th class="pb-2 pr-2">{{ p.t('statisticsPage.champion') }}</th>
                  <th class="pb-2 pr-2 text-right">
                    {{ p.t('statisticsPage.progressionsPopularity') }}
                  </th>
                  <th class="pb-2 pl-2 text-right">
                    {{ p.t('statisticsPage.progressionsDelta') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in p.paginatedProgressionsByPickrate"
                  :key="'pick-' + row.championId"
                  class="border-b border-primary/20"
                >
                  <td class="py-1.5 pr-2">
                    <NuxtLink
                      :to="p.localePath('/statistics/champion/' + row.championId)"
                      class="flex items-center gap-2 hover:text-accent"
                    >
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) ?? ''"
                        class="h-5 w-5 shrink-0 rounded-full object-cover"
                        width="24"
                        height="24"
                      />
                      <span>{{ p.championName(row.championId) || row.championId }}</span>
                    </NuxtLink>
                  </td>
                  <td class="py-1.5 text-right">{{ Number(row.pickrateSince).toFixed(2) }}%</td>
                  <td
                    class="py-1.5 pl-2 text-right"
                    :class="row.deltaPick >= 0 ? 'text-success' : 'text-error'"
                  >
                    {{ row.deltaPick >= 0 ? '+' : '' }}{{ row.deltaPick.toFixed(2) }}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div
          v-if="p.totalProgressionsCount > 0"
          class="border-p.t flex flex-wrap items-center justify-between gap-2 border-primary/20 px-4 py-2 text-sm text-text/80"
        >
          <span>{{ p.totalProgressionsCount }} {{ p.t('statisticsPage.champion') }}</span>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5">
              <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
              <select
                v-model.number="p.progressionsPageSizeModel"
                class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
              >
                <option v-for="n in p.PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
              </select>
            </label>
            <span class="text-text/70">
              {{ (p.progressionsPage - 1) * p.progressionsPageSize + 1 }}-{{
                Math.min(p.progressionsPage * p.progressionsPageSize, p.totalProgressionsCount)
              }}
              / {{ p.totalProgressionsCount }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="p.progressionsPage <= 1"
                @click="p.progressionsPage = Math.max(1, p.progressionsPage - 1)"
              >
                ‹
              </button>
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="p.progressionsPage >= p.totalProgressionsPages"
                @click="
                  p.progressionsPage = Math.min(p.totalProgressionsPages, p.progressionsPage + 1)
                "
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
