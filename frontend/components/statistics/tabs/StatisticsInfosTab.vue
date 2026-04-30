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
            <tr v-for="row in paginatedRows" :key="'infos-row-' + row.version">
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
        <div
          v-if="totalRowsCount > 0"
          class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
        >
          <span>{{ totalRowsCount }} {{ p.t('statisticsPage.infosMatrixPatchHeader') }}</span>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5">
              <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
              <select
                v-model.number="pageSize"
                class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
              >
                <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
              </select>
            </label>
            <span class="text-text/70">
              {{ (page - 1) * pageSize + 1 }}-{{ Math.min(page * pageSize, totalRowsCount) }} /
              {{ totalRowsCount }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="page <= 1"
                @click="page = Math.max(1, page - 1)"
              >
                ‹
              </button>
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="page >= totalPages"
                @click="page = Math.min(totalPages, page + 1)"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="rounded-lg border border-primary/30 bg-surface/20 p-2">
        <img
          src="/images/champion-balance-framework.png"
          alt="Champion Balance Framework"
          class="mx-auto w-full max-w-3xl rounded object-contain"
          loading="lazy"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'

const p = inject('statisticsPageCtx') as any
const pageSize = ref<number>(20)
const page = ref<number>(1)
const PAGE_SIZE_OPTIONS = computed<number[]>(() =>
  Array.isArray(p.PAGE_SIZE_OPTIONS) && p.PAGE_SIZE_OPTIONS.length > 0
    ? p.PAGE_SIZE_OPTIONS
    : [10, 20, 50, 100]
)
const totalRowsCount = computed<number>(() => (p.infosMatrixRows ?? []).length)
const totalPages = computed<number>(() =>
  Math.max(1, Math.ceil(totalRowsCount.value / pageSize.value))
)
const paginatedRows = computed(() => {
  const rows = p.infosMatrixRows ?? []
  const pnum = Math.min(page.value, totalPages.value)
  const start = (pnum - 1) * pageSize.value
  return rows.slice(start, start + pageSize.value)
})

watch(
  () => [p.infosMatrixRows, pageSize.value],
  () => {
    page.value = 1
  }
)
</script>
