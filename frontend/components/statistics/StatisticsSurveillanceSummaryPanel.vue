<template>
  <div class="space-y-4">
    <p v-if="entries.length === 0" class="text-sm text-text/60">
      {{ t('statisticsPage.surveillanceSummaryEmpty') }}
    </p>

    <article
      v-for="entry in entries"
      :key="entry.id"
      class="rounded-xl border border-primary/25 bg-surface/20 p-4"
    >
      <header class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-text-accent">
          {{ t('statisticsPage.surveillanceSummaryTitle') }}
        </h2>
        <time class="text-xs text-text/55" :datetime="entry.acknowledgedAt">
          {{ formatAcknowledgedAt(entry.acknowledgedAt) }}
        </time>
      </header>

      <div class="space-y-4">
        <section
          v-for="block in entryBlocks(entry)"
          :key="block.championKey"
          class="rounded-md border border-primary/20 bg-surface/30 px-3 py-2"
        >
          <h3 class="text-sm font-medium text-text/90">{{ block.championName }}</h3>
          <div v-if="block.statsLines.length > 0" class="mt-2">
            <p class="text-xs font-semibold text-text/75">
              {{ t('statisticsPage.surveillanceAlertTitle') }}
            </p>
            <ul class="mt-1 list-disc space-y-0.5 pl-4 text-xs">
              <li
                v-for="(line, index) in block.statsLines"
                :key="'stats-' + index"
                :class="line.tone === 'positive' ? 'text-emerald-400' : 'text-red-400'"
              >
                {{ line.text }}
              </li>
            </ul>
          </div>
          <div v-if="block.buildLines.length > 0" class="mt-2">
            <p class="text-xs font-semibold text-text/75">
              {{ t('statisticsPage.surveillanceBuildAlertTitle') }}
            </p>
            <ul class="mt-1 list-disc space-y-0.5 pl-4 text-xs">
              <li
                v-for="(line, index) in block.buildLines"
                :key="'build-' + index"
                :class="line.tone === 'positive' ? 'text-emerald-400' : 'text-red-400'"
              >
                {{ line.text }}
              </li>
            </ul>
          </div>
        </section>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChampionsStore } from '~/stores/ChampionsStore'
import {
  useStatisticsSurveillanceHistoryStore,
  type SurveillanceAlertHistoryEntry,
} from '~/stores/StatisticsSurveillanceHistoryStore'
import { formatBuildSurveillanceAlertSummary } from '~/utils/formatBuildSurveillanceAlert'
import { formatSurveillanceAlertSummary } from '~/utils/formatSurveillanceAlert'

const { t, locale } = useI18n()
const championsStore = useChampionsStore()
const historyStore = useStatisticsSurveillanceHistoryStore()

if (import.meta.client) {
  historyStore.init()
}

const entries = computed(() => historyStore.entries)

type SummaryBlock = {
  championKey: string
  championName: string
  statsLines: ReturnType<typeof formatSurveillanceAlertSummary>
  buildLines: ReturnType<typeof formatBuildSurveillanceAlertSummary>
}

function championNameFor(key: string): string {
  const normalized = String(key ?? '').trim()
  if (!normalized) return '—'
  const champ = championsStore.champions.find(c => String(c.key) === normalized)
  return champ?.name ?? normalized
}

function entryBlocks(entry: SurveillanceAlertHistoryEntry): SummaryBlock[] {
  const keys = new Set([...Object.keys(entry.statsAlerts), ...Object.keys(entry.buildAlerts)])
  return [...keys]
    .sort((a, b) => championNameFor(a).localeCompare(championNameFor(b), locale.value))
    .map(championKey => ({
      championKey,
      championName: championNameFor(championKey),
      statsLines: formatSurveillanceAlertSummary(entry.statsAlerts[championKey] ?? [], t),
      buildLines: formatBuildSurveillanceAlertSummary(entry.buildAlerts[championKey] ?? [], t),
    }))
    .filter(block => block.statsLines.length > 0 || block.buildLines.length > 0)
}

function formatAcknowledgedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
</script>
