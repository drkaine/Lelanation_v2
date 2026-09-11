<script setup lang="ts">
import { inject, nextTick, ref } from 'vue'
import StatisticsTierListBubbleChart from '~/components/statistics/StatisticsTierListBubbleChart.vue'
import NotificationToast from '~/components/NotificationToast.vue'
import { copyPngBlobToClipboard } from '~/utils/buildCardShareImage'
import {
  captureElementToPngBlob,
  downloadPngBlob,
  sanitizeFilenameSegment,
} from '~/utils/chartShareImage'

const p = inject('statisticsPageCtx') as Record<string, unknown>

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
      showChartExportToast(p.t('statisticsPage.tierListChartExportError') as string, 'error')
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
      showChartExportToast(p.t('statisticsPage.tierListChartExportError') as string, 'error')
      return
    }
    const copied = await copyPngBlobToClipboard(blob)
    if (!copied) {
      showChartExportToast(p.t('buildDiscovery.imageCopyError') as string, 'error')
      return
    }
    showChartExportToast(p.t('buildDiscovery.imageCopied') as string, 'success')
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
      <StatisticsTierListBubbleChart v-else ref="bubbleChartRef" class="w-full">
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
    </template>
    <NotificationToast
      v-if="chartExportToastVisible"
      :message="chartExportToastMessage"
      :type="chartExportToastType"
      @close="chartExportToastVisible = false"
    />
  </div>
</template>
