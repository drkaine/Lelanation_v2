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
      <div class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30 p-1">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-primary/30 bg-surface/50">
            <tr>
              <th
                scope="col"
                class="w-12 px-2 py-1.5 text-center font-semibold text-text"
                :title="p.t('statisticsPage.infosMatrixPatchHeader')"
              >
                {{ p.t('statisticsPage.infosMatrixPatchHeader') }}
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
                  <span
                    v-else
                    class="text-[11px] font-semibold uppercase tracking-wide text-text/85"
                  >
                    {{ p.t('statisticsPage.overviewVersionAll') }}
                  </span>
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
                class="px-2 py-1 text-center tabular-nums text-text/90"
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
