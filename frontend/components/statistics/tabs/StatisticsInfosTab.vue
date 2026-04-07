<template>
  <div class="space-y-2">
    <div v-if="p.overviewPending || p.infosMatrixPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.overviewError }}
    </div>
    <div
      v-else-if="p.infosMatrixError"
      class="rounded border border-error bg-surface p-3 text-error"
    >
      {{ p.infosMatrixError }}
    </div>
    <div v-else class="space-y-3">
      <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-3">
          <div class="text-xs text-text/70">{{ p.t('statisticsPage.overviewTotalMatches') }}</div>
          <div class="text-lg font-semibold text-text">
            {{ (p.overviewData?.totalMatches ?? 0).toLocaleString() }}
          </div>
        </div>
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-3">
          <div class="text-xs text-text/70">
            {{ p.t('statisticsPage.overviewPlayerCountDistinct') }}
          </div>
          <div class="text-lg font-semibold text-text">
            {{ (p.overviewData?.playerCount ?? 0).toLocaleString() }}
          </div>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30 p-1">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-primary/30 bg-surface/50">
            <tr>
              <th
                scope="col"
                class="w-12 px-2 py-1.5 text-center font-semibold text-text"
                :title="p.t('statisticsPage.infosMatrixPatchHeader')"
              >
                <span class="sr-only">{{ p.t('statisticsPage.infosMatrixPatchHeader') }}</span>
                <svg
                  class="mx-auto h-5 w-5 text-text/85"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </th>
              <th
                v-for="division in p.infosMatrixColumns ?? []"
                :key="'infos-col-' + division"
                scope="col"
                class="px-2 py-1.5 text-center font-semibold text-text"
                :title="
                  division === 'ALL'
                    ? p.t('statisticsPage.overviewVersionAll')
                    : p.formatDivisionLabel(division)
                "
              >
                <span class="sr-only">{{
                  division === 'ALL'
                    ? p.t('statisticsPage.overviewVersionAll')
                    : p.formatDivisionLabel(division)
                }}</span>
                <div class="flex justify-center">
                  <img
                    v-if="division !== 'ALL' && p.getRankedEmblemUrl(division)"
                    :src="p.getRankedEmblemUrl(division)!"
                    alt=""
                    class="h-5 w-5 object-contain"
                  />
                  <svg
                    v-else
                    class="h-5 w-5 text-text/85"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20">
            <tr v-for="row in p.infosMatrixRows ?? []" :key="'infos-row-' + row.version">
              <td class="px-3 py-1 font-medium text-text">{{ row.version }}</td>
              <td
                v-for="division in p.infosMatrixColumns ?? []"
                :key="'infos-cell-' + row.version + '-' + division"
                class="px-3 py-1 text-text/90"
              >
                {{ Number(p.infosMatrixCell(row, division)).toLocaleString() }}
              </td>
            </tr>
            <tr v-if="(p.infosMatrixRows ?? []).length === 0">
              <td
                :colspan="(p.infosMatrixColumns ?? []).length + 1"
                class="px-3 py-2 text-center text-text/70"
              >
                {{ p.t('statisticsPage.noData') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>
