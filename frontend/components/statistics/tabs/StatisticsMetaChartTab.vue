<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { metaQuadrantPicks } from '~/utils/statistics/metaQuadrantPicks'
import {
  defaultMetaChampion,
  findMetaChartChampion,
  metaQuadrantList,
  type MetaQuadrantKey,
} from '~/utils/statistics/metaChartSelection'
import StatisticsTierListBubbleChart from '~/components/statistics/StatisticsTierListBubbleChart.vue'
import NotificationToast from '~/components/NotificationToast.vue'
import { copyPngBlobToClipboard } from '~/utils/buildCardShareImage'
import {
  captureElementToPngBlob,
  downloadPngBlob,
  sanitizeFilenameSegment,
} from '~/utils/chartShareImage'

import {
  injectStatisticsPageCtx,
  type StatisticsMetaChartPageCtx,
} from '~/composables/statistics/statisticsPageCtx'

const p = injectStatisticsPageCtx<StatisticsMetaChartPageCtx>()

const quadrantLists = computed(() => {
  const rows = (p.tierListChartVisibleRows ?? []) as Array<{
    championId: number
    winrate: number
    pickrate: number
  }>
  const q = metaQuadrantPicks(rows)
  return [
    { key: 'gems' as const, rows: q.gems },
    { key: 'popularWeak' as const, rows: q.popularWeak },
  ]
})
const fmt1 = (v: number) => v.toFixed(1)
const pct1 = (v: number) => fmt1(v > 1 ? v : v * 100)

type ChartRow = {
  championId: number
  winrate: number
  pickrate: number
  games: number
  tier: string
}
const chartRows = computed(() => (p.tierListChartVisibleRows ?? []) as ChartRow[])
const nameOf = (id: number) => p.championName(id) || ''

const highlightQuery = ref('')
const selectedId = ref<number | null>(null)
const highlightMiss = ref(false)

function applyHighlight() {
  const id = findMetaChartChampion(highlightQuery.value, chartRows.value, nameOf)
  highlightMiss.value = highlightQuery.value.trim() !== '' && id == null
  selectedId.value = id
}
function clearHighlight() {
  highlightQuery.value = ''
  highlightMiss.value = false
  selectedId.value = null
}
function onBubbleSelect(id: number) {
  selectedId.value = selectedId.value === id ? null : id
  highlightQuery.value = selectedId.value == null ? '' : nameOf(id)
  highlightMiss.value = false
}
const displayId = computed(() => selectedId.value ?? defaultMetaChampion(chartRows.value))
const selectedRow = computed(
  () => chartRows.value.find(r => r.championId === displayId.value) ?? null
)

const quadrantKeys: MetaQuadrantKey[] = ['meta', 'gems', 'traps', 'niche']
const mobileQuadrant = ref<MetaQuadrantKey>('meta')
const mobileQuadrantRows = computed(() => metaQuadrantList(chartRows.value, mobileQuadrant.value))

const bubbleChartRef = ref<{ chartCaptureRoot: HTMLElement | null } | null>(null)
const metaChartExportPending = ref(false)
const chartExportToastMessage = ref('')
const chartExportToastType = ref<'success' | 'error'>('success')
const chartExportToastVisible = ref(false)
let chartExportToastTimer: ReturnType<typeof setTimeout> | null = null

function showChartExportToast(message: string, type: 'success' | 'error' = 'success') {
  chartExportToastMessage.value = message
  chartExportToastType.value = type
  chartExportToastVisible.value = true
  if (chartExportToastTimer) clearTimeout(chartExportToastTimer)
  chartExportToastTimer = setTimeout(() => {
    chartExportToastVisible.value = false
  }, 3200)
}

async function captureMetaChartBlob(): Promise<Blob | null> {
  await nextTick()
  const root = bubbleChartRef.value?.chartCaptureRoot
  if (!root) return null
  return captureElementToPngBlob(root)
}

function metaChartExportFilename(): string {
  const heading = String(p.tierListChartHeading ?? 'meta-chart')
  const patch = String(p.effectiveTierListPatch ?? p.gameVersion ?? 'patch')
  return `lelanation-meta-chart-${sanitizeFilenameSegment(heading)}-${sanitizeFilenameSegment(patch)}.png`
}

async function downloadMetaChartImage() {
  if (metaChartExportPending.value) return
  metaChartExportPending.value = true
  try {
    const blob = await captureMetaChartBlob()
    if (!blob) {
      showChartExportToast(p.t('statisticsPage.tierListChartExportError'), 'error')
      return
    }
    downloadPngBlob(blob, metaChartExportFilename())
  } finally {
    metaChartExportPending.value = false
  }
}

async function copyMetaChartImage() {
  if (metaChartExportPending.value) return
  metaChartExportPending.value = true
  try {
    const blob = await captureMetaChartBlob()
    if (!blob) {
      showChartExportToast(p.t('statisticsPage.tierListChartExportError'), 'error')
      return
    }
    const copied = await copyPngBlobToClipboard(blob)
    if (!copied) {
      showChartExportToast(p.t('buildDiscovery.imageCopyError'), 'error')
      return
    }
    showChartExportToast(p.t('buildDiscovery.imageCopied'), 'success')
  } finally {
    metaChartExportPending.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="p.tierListPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.tierListError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.tierListError }}
    </div>
    <template v-else>
      <div
        v-if="p.totalTierListCount === 0"
        class="statistics-overview-surface rounded-lg border border-primary/30 p-4 text-text/70"
      >
        {{ p.t('statisticsPage.tierListNoData') }}
      </div>
      <template v-else>
        <div class="meta-chart-layout">
          <section class="meta-card meta-chart-card">
            <form class="meta-highlight" role="search" @submit.prevent="applyHighlight">
              <label for="meta-highlight-input" class="meta-highlight-label">
                {{ p.t('statisticsPage.metaHighlightLabel') }}
              </label>
              <input
                id="meta-highlight-input"
                v-model="highlightQuery"
                list="meta-highlight-options"
                type="search"
                autocomplete="off"
                class="meta-highlight-input"
                :placeholder="p.t('statisticsPage.metaHighlightPlaceholder')"
                @change="applyHighlight"
              />
              <datalist id="meta-highlight-options">
                <option v-for="r in chartRows" :key="r.championId" :value="nameOf(r.championId)" />
              </datalist>
              <button
                v-if="selectedId != null"
                type="button"
                class="meta-highlight-clear"
                @click="clearHighlight"
              >
                {{ p.t('statisticsPage.metaHighlightClear') }}
              </button>
              <span v-if="highlightMiss" class="text-xs text-error" role="status">
                {{ p.t('statisticsPage.metaHighlightMiss') }}
              </span>
            </form>
            <StatisticsTierListBubbleChart
              ref="bubbleChartRef"
              class="w-full min-w-0"
              :highlight-id="selectedId"
              @select="onBubbleSelect"
            >
              <template #toolbar-actions>
                <button
                  type="button"
                  class="ui-build-card-action-button ui-build-card-action-button--icon"
                  :disabled="metaChartExportPending"
                  :title="p.t('statisticsPage.tierListChartDownload')"
                  :aria-label="p.t('statisticsPage.tierListChartDownload')"
                  @click="downloadMetaChartImage"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 4v10" />
                    <path d="m8 10 4 4 4-4" />
                    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="ui-build-card-action-button ui-build-card-action-button--icon"
                  :disabled="metaChartExportPending"
                  :title="p.t('statisticsPage.tierListChartCopyImage')"
                  :aria-label="p.t('statisticsPage.tierListChartCopyImage')"
                  @click="copyMetaChartImage"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </template>
            </StatisticsTierListBubbleChart>
          </section>
          <div class="meta-side">
            <StatisticsChampionDetailLink
              v-if="selectedRow"
              :champion-id="selectedRow.championId"
              class="meta-detail-m"
            >
              <img
                v-if="p.tierListChartChampionImage(selectedRow.championId)"
                :src="p.tierListChartChampionImage(selectedRow.championId) ?? undefined"
                :alt="nameOf(selectedRow.championId)"
                class="meta-detail-m-img"
              />
              <span class="min-w-0 flex-1">
                <span class="meta-detail-m-name">
                  {{ nameOf(selectedRow.championId) }}
                  <span class="meta-detail-m-tier">
                    · {{ p.t('statisticsPage.metaDetailTier', { tier: selectedRow.tier }) }}
                  </span>
                </span>
                <span class="meta-detail-m-line">
                  {{
                    p.t('statisticsPage.metaDetailCompact', {
                      wr: pct1(selectedRow.winrate),
                      pick: pct1(selectedRow.pickrate),
                      games: selectedRow.games.toLocaleString(),
                    })
                  }}
                </span>
              </span>
              <span aria-hidden="true" class="meta-detail-m-chev">›</span>
            </StatisticsChampionDetailLink>
            <aside v-if="selectedRow" class="meta-card meta-detail" aria-live="polite">
              <div class="flex items-center gap-3">
                <img
                  v-if="p.tierListChartChampionImage(selectedRow.championId)"
                  :src="p.tierListChartChampionImage(selectedRow.championId) ?? undefined"
                  :alt="nameOf(selectedRow.championId)"
                  class="h-[52px] w-[52px] shrink-0 rounded-lg object-cover"
                />
                <div class="min-w-0">
                  <p class="truncate text-lg font-bold text-text">
                    {{ nameOf(selectedRow.championId) }}
                  </p>
                  <span class="meta-detail-tier">
                    {{ p.t('statisticsPage.metaDetailTier', { tier: selectedRow.tier }) }}
                  </span>
                </div>
              </div>
              <dl class="meta-detail-stats">
                <div>
                  <dt>{{ p.t('statisticsPage.metaDetailWinrate') }}</dt>
                  <dd>{{ pct1(selectedRow.winrate) }} %</dd>
                </div>
                <div>
                  <dt>{{ p.t('statisticsPage.metaDetailPickrate') }}</dt>
                  <dd>{{ pct1(selectedRow.pickrate) }} %</dd>
                </div>
                <div>
                  <dt>{{ p.t('statisticsPage.metaDetailGames') }}</dt>
                  <dd>{{ selectedRow.games.toLocaleString() }}</dd>
                </div>
              </dl>
              <StatisticsChampionDetailLink
                :champion-id="selectedRow.championId"
                class="meta-detail-cta"
              >
                {{ p.t('statisticsPage.metaDetailCta') }}
              </StatisticsChampionDetailLink>
            </aside>
            <article class="meta-card meta-lists max-md:hidden">
              <template v-for="list in quadrantLists" :key="list.key">
                <h3 class="meta-quadrant-title">
                  {{ p.t(`statisticsPage.metaQuadrantList_${list.key}`) }}
                </h3>
                <p v-if="!list.rows.length" class="text-xs text-text/60">
                  {{ p.t('statisticsPage.noData') }}
                </p>
                <ol v-else class="meta-quadrant-list">
                  <li v-for="row in list.rows" :key="row.championId" class="meta-quadrant-row">
                    <button
                      type="button"
                      class="meta-quadrant-champ"
                      @click="onBubbleSelect(row.championId)"
                    >
                      {{ p.championName(row.championId) || row.championId }}
                    </button>
                    <span class="meta-quadrant-num is-dim">
                      {{ fmt1(row.winPct) }} % · {{ fmt1(row.pickPct) }} %
                      {{ p.t('statisticsPage.metaQuadrantPick') }}
                    </span>
                  </li>
                </ol>
              </template>
            </article>
          </div>
        </div>
      </template>
      <section class="meta-mobile-quadrants md:hidden">
        <div class="meta-chips" role="group" :aria-label="p.t('statisticsPage.metaQuadrantGroup')">
          <button
            v-for="k in quadrantKeys"
            :key="k"
            type="button"
            class="meta-chip"
            :class="`is-${k}`"
            :aria-pressed="mobileQuadrant === k"
            @click="mobileQuadrant = k"
          >
            {{ p.t(`statisticsPage.metaQuadrantChip_${k}`) }}
          </button>
        </div>
        <p v-if="!mobileQuadrantRows.length" class="mt-2 text-xs text-text/60">
          {{ p.t('statisticsPage.noData') }}
        </p>
        <ol v-else class="meta-quadrant-list mt-2">
          <li v-for="row in mobileQuadrantRows" :key="row.championId" class="meta-quadrant-row">
            <button
              type="button"
              class="meta-quadrant-champ text-left"
              @click="onBubbleSelect(row.championId)"
            >
              <span class="truncate">{{ nameOf(row.championId) || row.championId }}</span>
            </button>
            <span class="meta-quadrant-num is-dim">
              WR {{ fmt1(row.winPct) }} % · {{ p.t('statisticsPage.metaQuadrantPick') }}
              {{ fmt1(row.pickPct) }} %
            </span>
          </li>
        </ol>
      </section>
    </template>
    <NotificationToast
      v-if="chartExportToastVisible"
      :message="chartExportToastMessage"
      :type="chartExportToastType"
      @close="chartExportToastVisible = false"
    />
  </div>
</template>

<style scoped>
.meta-highlight {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.meta-highlight-label {
  font-size: 12px;
  color: #a09b8c;
}
.meta-highlight-input {
  min-width: 0;
  flex: 1 1 200px;
  max-width: 320px;
  border: 1px solid rgb(200 155 60 / 0.45);
  border-radius: 6px;
  background: rgb(10 20 40 / 0.85);
  padding: 6px 10px;
  color: #f0e6d2;
}
.meta-highlight-clear {
  font-size: 12px;
  color: #0ac8b9;
  text-decoration: underline;
}
.meta-chart-layout {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr);
  max-width: 1280px;
  margin: 0 auto;
}
@media (min-width: 1024px) {
  .meta-chart-layout {
    grid-template-columns: minmax(0, 1fr) 300px;
    align-items: start;
  }
}
.meta-card {
  border: 1px solid #463714;
  border-radius: 12px;
  background: #0a1428;
  padding: 20px;
}
.meta-chart-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.meta-chart-card .meta-highlight {
  justify-content: flex-end;
}
.meta-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.meta-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.meta-detail-tier {
  display: inline-block;
  margin-top: 4px;
  border-radius: 999px;
  background: #c8aa6e;
  padding: 1px 8px;
  font-size: 12px;
  font-weight: 700;
  color: #010a13;
}
.meta-detail-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.meta-detail-stats dt {
  font-size: 12px;
  color: #a09b8c;
}
.meta-detail-stats dd {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.meta-detail-cta {
  display: block;
  border-radius: 8px;
  background: #c8aa6e;
  padding: 12px;
  text-align: center;
  font-weight: 700;
  color: #010a13;
}
.meta-detail-cta:hover {
  background: #f0e6d2;
}
.meta-chip {
  border: 1px solid #0a323c;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  color: #cbc3b0;
}
.meta-chip[aria-pressed='true'] {
  background: #1e2328;
}
.meta-chip.is-meta[aria-pressed='true'] {
  border-color: #c8aa6e;
  color: #c8aa6e;
}
.meta-chip.is-gems[aria-pressed='true'] {
  border-color: #0ac8b9;
  color: #0ac8b9;
}
.meta-chip.is-traps[aria-pressed='true'] {
  border-color: #e2665a;
  color: #e2665a;
}
.meta-chip.is-niche[aria-pressed='true'] {
  border-color: #a09b8c;
  color: #a09b8c;
}
.meta-lists {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.meta-quadrant-title {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 700;
  color: #f0e6d2;
}
.meta-quadrant-title:first-child {
  margin-top: 0;
}
.meta-quadrant-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 3px 0;
  font-size: 13px;
}
.meta-quadrant-champ {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}
.meta-quadrant-num {
  font-variant-numeric: tabular-nums;
}
.meta-quadrant-num.is-dim {
  color: var(--color-grey-50, #a09b8c);
}
.meta-detail-m {
  display: none;
}
@media (max-width: 767px) {
  .meta-card {
    padding: 12px;
  }
  .meta-chart-card .meta-highlight,
  .meta-chart-card :deep([data-bubble-chart-toolbar]),
  .meta-detail,
  .meta-lists {
    display: none;
  }
  .meta-detail-m {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid #785a28;
    border-radius: 12px;
    background: #0a1428;
    color: #f0e6d2;
  }
  .meta-detail-m-name {
    display: block;
    font-size: 15px;
    font-weight: 700;
  }
  .meta-detail-m-tier {
    color: #c8aa6e;
    font-size: 12px;
    font-weight: 600;
  }
  .meta-detail-m-line {
    display: block;
    color: #a09b8c;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .meta-detail-m-img {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 8px;
    object-fit: cover;
  }
  .meta-detail-m-chev {
    color: #a09b8c;
    font-size: 20px;
  }
  .meta-chips {
    display: flex;
    gap: 8px;
    margin: 0 -16px;
    padding: 0 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .meta-chips .meta-chip {
    flex-shrink: 0;
    height: 36px;
    padding: 0 12px;
    border-color: #463714;
    font-size: 14px;
    font-weight: 500;
    color: #f0e6d2;
  }
  .meta-chips .meta-chip[aria-pressed='true'] {
    background: #1e2328;
    font-weight: 600;
  }
  .meta-mobile-quadrants .meta-quadrant-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .meta-mobile-quadrants .meta-quadrant-row {
    padding: 10px 12px;
    border: 1px solid #463714;
    border-radius: 8px;
    background: #0a1428;
  }
  .meta-mobile-quadrants .meta-quadrant-champ {
    font-size: 14px;
    font-weight: 700;
    color: #f0e6d2;
  }
  .meta-mobile-quadrants .meta-quadrant-num {
    font-size: 12px;
  }
}
</style>
