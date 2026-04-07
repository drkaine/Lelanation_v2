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
              <th class="px-3 py-1.5 font-semibold text-text">Patch</th>
              <th
                v-for="division in p.infosMatrixColumns ?? []"
                :key="'infos-col-' + division"
                class="px-3 py-1.5 font-semibold text-text"
              >
                <div class="flex items-center gap-2">
                  <img
                    v-if="division !== 'ALL' && p.getRankedEmblemUrl(division)"
                    :src="p.getRankedEmblemUrl(division)!"
                    :alt="p.formatDivisionLabel(division)"
                    class="h-5 w-5 object-contain"
                  />
                  <span>{{
                    division === 'ALL'
                      ? p.t('statisticsPage.overviewVersionAll')
                      : p.formatDivisionLabel(division)
                  }}</span>
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
