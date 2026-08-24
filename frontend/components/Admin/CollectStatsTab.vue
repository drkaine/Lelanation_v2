<template>
  <div class="space-y-6">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-text">{{ t('admin.stats.title') }}</h2>
          <p class="mt-1 text-xs text-text/70">{{ t('admin.stats.subtitle') }}</p>
        </div>
        <button
          type="button"
          class="rounded border border-primary/50 bg-surface px-3 py-2 text-sm text-text transition-colors hover:bg-primary/20"
          :disabled="loading"
          @click="loadStats"
        >
          {{ loading ? t('admin.loading') : t('admin.stats.refresh') }}
        </button>
      </div>

      <p v-if="loading" class="text-text/70">{{ t('admin.loading') }}</p>
      <p v-else-if="error" class="text-sm text-error">{{ error }}</p>
      <p v-else-if="data?.error" class="text-sm text-error">{{ data.error }}</p>
      <p v-else-if="!data?.configured" class="text-sm text-text/70">
        {{ t('admin.stats.notConfigured') }}
      </p>
      <template v-else>
        <p class="mb-4 text-xs text-text/60">
          {{
            t('admin.stats.range', {
              days: data.range.days,
              hourDays: data.range.hourDays,
            })
          }}
        </p>

        <section v-if="data.byDay" class="mb-8 space-y-4">
          <h3 class="text-base font-semibold text-text">{{ t('admin.stats.byDayTitle') }}</h3>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div
              v-for="card in daySummaryCards"
              :key="card.label"
              class="rounded border border-primary/20 bg-background/30 p-3"
            >
              <div class="text-xl font-bold text-text">{{ card.value }}</div>
              <div class="text-xs text-text/70">{{ card.label }}</div>
            </div>
          </div>
          <CollectStatsBucketTable :buckets="data.byDay.buckets" granularity="day" />
        </section>

        <section v-if="data.byHour" class="space-y-4">
          <h3 class="text-base font-semibold text-text">{{ t('admin.stats.byHourTitle') }}</h3>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div
              v-for="card in hourSummaryCards"
              :key="card.label"
              class="rounded border border-primary/20 bg-background/30 p-3"
            >
              <div class="text-xl font-bold text-text">{{ card.value }}</div>
              <div class="text-xs text-text/70">{{ card.label }}</div>
            </div>
          </div>
          <CollectStatsBucketTable :buckets="recentHourBuckets" granularity="hour" />
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CollectStatsBucketTable from '~/components/Admin/CollectStatsBucketTable.vue'
import { useAdminAuth } from '~/composables/useAdminAuth'

type CollectTimeseriesBucket = {
  bucket: string
  newPlayers: number
  playersWithMatches: number
  matchesIngested: number
  matchesPerPlayer: number | null
}

type CollectTimeseriesView = {
  granularity: 'hour' | 'day'
  bucketCount: number
  averages: {
    newPlayers: number
    playersWithMatches: number
    matchesIngested: number
    matchesPerPlayer: number | null
  }
  buckets: CollectTimeseriesBucket[]
}

type CollectTimeseriesResponse = {
  configured: boolean
  range: { from: string; to: string; days: number; hourDays: number }
  byDay: CollectTimeseriesView | null
  byHour: CollectTimeseriesView | null
  error?: string
}

const { t } = useI18n()
const { fetchWithAuth, clearAuth } = useAdminAuth()
const localePath = useLocalePath()

const loading = ref(false)
const error = ref<string | null>(null)
const data = ref<CollectTimeseriesResponse | null>(null)

const recentHourBuckets = computed(() => {
  const buckets = data.value?.byHour?.buckets ?? []
  return buckets.slice(-72)
})

function formatNumber(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

function formatOptional(value: number | null): string {
  return value == null ? '—' : formatNumber(value)
}

function buildSummaryCards(view: CollectTimeseriesView | null, granularity: 'day' | 'hour') {
  if (!view) return []
  const suffix = granularity === 'day' ? 'Day' : 'Hour'
  return [
    {
      label: t(`admin.stats.avgNewPlayers${suffix}`),
      value: formatNumber(view.averages.newPlayers),
    },
    {
      label: t(`admin.stats.avgPlayersWithMatches${suffix}`),
      value: formatNumber(view.averages.playersWithMatches),
    },
    {
      label: t(`admin.stats.avgMatches${suffix}`),
      value: formatNumber(view.averages.matchesIngested),
    },
    {
      label: t(`admin.stats.avgMatchesPerPlayer${suffix}`),
      value: formatOptional(view.averages.matchesPerPlayer),
    },
  ]
}

const daySummaryCards = computed(() => buildSummaryCards(data.value?.byDay ?? null, 'day'))
const hourSummaryCards = computed(() => buildSummaryCards(data.value?.byHour ?? null, 'hour'))

async function loadStats() {
  loading.value = true
  error.value = null
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/collect-timeseries'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    if (!res.ok) {
      error.value = `${t('admin.stats.loadError')} (HTTP ${res.status})`
      data.value = null
      return
    }
    const payload = (await res.json()) as CollectTimeseriesResponse
    if (payload.error && !payload.byDay && !payload.byHour) {
      error.value = payload.error
      data.value = payload
      return
    }
    data.value = payload
  } catch {
    error.value = t('admin.stats.loadError')
    data.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStats()
})

defineExpose({ loadStats })
</script>
