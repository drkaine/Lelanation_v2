<template>
  <div class="space-y-6">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-text">{{ t('admin.monitoring.title') }}</h2>
          <p class="mt-1 text-xs text-text/70">{{ t('admin.monitoring.subtitle') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="action in actions"
            :key="action.id"
            type="button"
            class="rounded border border-primary/50 bg-surface px-3 py-2 text-sm text-text transition-colors hover:bg-primary/20 disabled:opacity-50"
            :disabled="loading || busyAction !== null"
            @click="action.run"
          >
            {{ busyAction === action.id ? t('admin.loading') : action.label }}
          </button>
        </div>
      </div>
      <p v-if="actionMessage" class="mt-3 text-sm text-text/80">{{ actionMessage }}</p>
      <p
        v-if="data && !data.webhookConfigured"
        class="mt-3 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
      >
        {{ t('admin.monitoring.noWebhook') }}
      </p>
    </div>

    <p v-if="loading && !data" class="text-text/70">{{ t('admin.loading') }}</p>
    <p v-else-if="error" class="text-sm text-error">{{ error }}</p>

    <template v-if="data">
      <!-- Health banner -->
      <div class="rounded-lg border p-4" :class="HEALTH_CLASSES[health]">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <span class="text-2xl" aria-hidden="true">{{ HEALTH_ICONS[health] }}</span>
            <div>
              <div class="text-lg font-semibold">{{ healthTitle }}</div>
              <div class="text-xs opacity-80">
                {{ t('admin.monitoring.lastCheck') }} :
                {{
                  data.state.lastCheckAt
                    ? formatDate(data.state.lastCheckAt)
                    : t('admin.monitoring.never')
                }}
                ·
                {{
                  t('admin.monitoring.apiLive', {
                    total: data.http.total,
                    errors: data.http.errors5xx,
                  })
                }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Processes -->
      <section class="rounded-lg border border-primary/30 bg-surface/30 p-4">
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-base font-semibold text-text">{{ t('admin.monitoring.processes') }}</h3>
          <span class="font-mono text-xs text-text/60">
            {{ t('admin.monitoring.repoHead') }} : {{ data.repoHead?.slice(0, 7) ?? '—' }}
          </span>
        </div>
        <div class="overflow-x-auto rounded border border-primary/20">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-primary/20 bg-background/40 text-text/80">
              <tr>
                <th class="px-3 py-2">{{ t('admin.monitoring.process') }}</th>
                <th class="px-3 py-2">PID</th>
                <th class="px-3 py-2">{{ t('admin.monitoring.startedAt') }}</th>
                <th class="px-3 py-2">Commit</th>
                <th class="px-3 py-2">{{ t('admin.monitoring.codeStatus') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="data.processes.length === 0">
                <td colspan="5" class="px-3 py-4 text-center text-text/60">
                  {{ t('admin.monitoring.noProcess') }}
                </td>
              </tr>
              <tr v-for="p in data.processes" :key="p.name" class="border-t border-primary/10">
                <td class="px-3 py-1.5 font-mono text-xs">{{ p.name }}</td>
                <td class="px-3 py-1.5 text-xs">{{ p.pid }}</td>
                <td class="whitespace-nowrap px-3 py-1.5 text-xs">{{ formatDate(p.startedAt) }}</td>
                <td class="px-3 py-1.5 font-mono text-xs">{{ p.commit?.slice(0, 7) ?? '—' }}</td>
                <td class="px-3 py-1.5 text-xs">
                  <span v-if="p.stale" class="font-semibold text-warning">{{
                    t('admin.monitoring.stale')
                  }}</span>
                  <span v-else class="text-success">{{ t('admin.monitoring.upToDate') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Active incidents -->
      <section v-if="data.state.incidents.active.length > 0" class="space-y-3">
        <h3 class="text-base font-semibold text-text">
          {{ t('admin.monitoring.activeIncidents') }}
        </h3>
        <div class="grid gap-3 md:grid-cols-2">
          <article
            v-for="inc in data.state.incidents.active"
            :key="inc.code"
            class="rounded-lg border p-4"
            :class="HEALTH_CLASSES[inc.severity]"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="font-semibold">{{ HEALTH_ICONS[inc.severity] }} {{ inc.title }}</div>
              <span class="rounded bg-background/40 px-2 py-0.5 font-mono text-[10px]">{{
                inc.code
              }}</span>
            </div>
            <p class="mt-2 text-sm">{{ inc.message }}</p>
            <dl v-if="inc.context" class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <template v-for="(value, key) in inc.context" :key="key">
                <dt class="opacity-70">{{ key }}</dt>
                <dd class="break-all font-mono">{{ value }}</dd>
              </template>
            </dl>
            <div class="mt-3 text-xs opacity-80">
              {{ t('admin.monitoring.since') }} {{ formatDate(inc.openedAt) }} ({{
                formatDurationMin(incidentDurationMin(inc.openedAt, null, nowMs))
              }})
              <template v-if="inc.lastNotifiedAt">
                · {{ t('admin.monitoring.notifiedAt') }} {{ formatDate(inc.lastNotifiedAt) }}
              </template>
            </div>
          </article>
        </div>
      </section>

      <!-- 24h recap -->
      <section class="rounded-lg border border-primary/30 bg-surface/30 p-4">
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-base font-semibold text-text">{{ t('admin.monitoring.recapTitle') }}</h3>
          <span class="text-xs text-text/60">
            {{ t('admin.monitoring.lastRecapSent') }} :
            {{
              data.state.lastRecapSentAt
                ? formatDate(data.state.lastRecapSentAt)
                : t('admin.monitoring.never')
            }}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <div
            v-for="card in recapCards"
            :key="card.label"
            class="rounded border bg-background/30 p-3"
            :class="card.alert ? 'border-error/50' : 'border-primary/20'"
          >
            <div class="text-xl font-bold" :class="card.alert ? 'text-error' : 'text-text'">
              {{ card.value }}
            </div>
            <div class="text-xs text-text/70">{{ card.label }}</div>
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-3">
          <div class="overflow-x-auto rounded border border-primary/20">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-primary/20 bg-background/40 text-text/80">
                <tr>
                  <th class="px-3 py-2">{{ t('admin.monitoring.source') }}</th>
                  <th class="px-3 py-2 text-right">{{ t('admin.monitoring.errors') }}</th>
                  <th class="px-3 py-2 text-right">{{ t('admin.monitoring.warnings') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="data.recap24h.byScript.length === 0">
                  <td colspan="3" class="px-3 py-4 text-center text-text/60">
                    {{ t('admin.monitoring.nothing') }}
                  </td>
                </tr>
                <tr
                  v-for="s in data.recap24h.byScript"
                  :key="s.script"
                  class="border-t border-primary/10"
                >
                  <td class="px-3 py-1.5 font-mono text-xs">{{ s.script }}</td>
                  <td
                    class="px-3 py-1.5 text-right"
                    :class="s.errors > 0 ? 'font-semibold text-error' : 'text-text/60'"
                  >
                    {{ s.errors }}
                  </td>
                  <td
                    class="px-3 py-1.5 text-right"
                    :class="s.warnings > 0 ? 'text-warning' : 'text-text/60'"
                  >
                    {{ s.warnings }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="overflow-x-auto rounded border border-primary/20 lg:col-span-2">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-primary/20 bg-background/40 text-text/80">
                <tr>
                  <th class="px-3 py-2 text-right">×</th>
                  <th class="px-3 py-2">{{ t('admin.monitoring.source') }}</th>
                  <th class="px-3 py-2">{{ t('admin.monitoring.message') }}</th>
                  <th class="px-3 py-2">{{ t('admin.monitoring.last') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="data.recap24h.topMessages.length === 0">
                  <td colspan="4" class="px-3 py-4 text-center text-text/60">
                    {{ t('admin.monitoring.nothing') }}
                  </td>
                </tr>
                <tr
                  v-for="m in data.recap24h.topMessages"
                  :key="`${m.script}-${m.lastAt}-${m.message}`"
                  class="border-t border-primary/10 align-top"
                >
                  <td class="px-3 py-1.5 text-right font-semibold">{{ m.count }}</td>
                  <td class="px-3 py-1.5">
                    <span class="font-mono text-xs">{{ m.script }}</span>
                    <span
                      class="ml-1 rounded px-1 text-[10px]"
                      :class="
                        m.type === 'erreur'
                          ? 'bg-error/20 text-error'
                          : 'bg-warning/20 text-warning'
                      "
                    >
                      {{ m.type }}
                    </span>
                  </td>
                  <td class="break-all px-3 py-1.5 text-xs">{{ m.message }}</td>
                  <td class="whitespace-nowrap px-3 py-1.5 text-xs text-text/70">
                    {{ formatDate(m.lastAt) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Incident history -->
      <section class="rounded-lg border border-primary/30 bg-surface/30 p-4">
        <h3 class="mb-3 text-base font-semibold text-text">{{ t('admin.monitoring.history') }}</h3>
        <div class="overflow-x-auto rounded border border-primary/20">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-primary/20 bg-background/40 text-text/80">
              <tr>
                <th class="px-3 py-2">{{ t('admin.monitoring.incident') }}</th>
                <th class="px-3 py-2">{{ t('admin.monitoring.start') }}</th>
                <th class="px-3 py-2">{{ t('admin.monitoring.end') }}</th>
                <th class="px-3 py-2 text-right">{{ t('admin.monitoring.duration') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="historyRows.length === 0">
                <td colspan="4" class="px-3 py-4 text-center text-text/60">
                  {{ t('admin.monitoring.noHistory') }}
                </td>
              </tr>
              <tr
                v-for="h in historyRows"
                :key="`${h.code}-${h.openedAt}`"
                class="border-t border-primary/10"
              >
                <td class="px-3 py-1.5">
                  {{ HEALTH_ICONS[h.severity] }} {{ h.title }}
                  <span class="ml-1 font-mono text-[10px] text-text/50">{{ h.code }}</span>
                </td>
                <td class="whitespace-nowrap px-3 py-1.5 text-xs">{{ formatDate(h.openedAt) }}</td>
                <td class="whitespace-nowrap px-3 py-1.5 text-xs">
                  {{ formatDate(h.resolvedAt) }}
                </td>
                <td class="px-3 py-1.5 text-right text-xs">
                  {{ formatDurationMin(incidentDurationMin(h.openedAt, h.resolvedAt, nowMs)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { apiUrl } from '~/utils/apiUrl'
import {
  formatDurationMin,
  incidentDurationMin,
  overallHealth,
  type MonitoringHealth,
  type MonitoringSeverity,
} from '~/utils/adminMonitoring'

type Incident = {
  code: string
  severity: MonitoringSeverity
  title: string
  message: string
  context?: Record<string, string | number>
  openedAt: string
  lastSeenAt: string
  lastNotifiedAt: string | null
}

type MonitoringPayload = {
  webhookConfigured: boolean
  repoHead: string | null
  processes: Array<{
    name: string
    pid: number
    startedAt: string
    commit: string | null
    stale: boolean
  }>
  http: { total: number; errors5xx: number }
  state: {
    incidents: { active: Incident[]; history: Array<Incident & { resolvedAt: string }> }
    lastCheckAt: string | null
    lastRecapSentAt: string | null
  }
  recap24h: {
    errors: number
    warnings: number
    http5xx: number
    byScript: Array<{ script: string; errors: number; warnings: number }>
    topMessages: Array<{
      script: string
      type: string
      message: string
      count: number
      lastAt: string
    }>
    poller: {
      windows: number
      requests: number
      count429: number
      matchesFetchedFailed: number
      matchesIngested: number
      matchesFailed: number
    }
  }
}

const HISTORY_ROWS = 50
const HEALTH_CLASSES: Record<MonitoringHealth, string> = {
  ok: 'border-success/40 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  critical: 'border-error/50 bg-error/10 text-error',
}
const HEALTH_ICONS: Record<MonitoringHealth, string> = { ok: '✅', warning: '🟠', critical: '🔴' }

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { fetchWithAuth, clearAuth } = useAdminAuth()

const data = ref<MonitoringPayload | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const busyAction = ref<string | null>(null)
const actionMessage = ref<string | null>(null)
const nowMs = ref(Date.now())

const health = computed(() => overallHealth(data.value?.state.incidents.active ?? []))
const healthTitle = computed(() => {
  const active = data.value?.state.incidents.active ?? []
  if (health.value === 'ok') return t('admin.monitoring.healthOk')
  const critical = active.filter(i => i.severity === 'critical').length
  return health.value === 'critical'
    ? t('admin.monitoring.healthCritical', { n: critical })
    : t('admin.monitoring.healthWarning', { n: active.length })
})

const recapCards = computed(() => {
  const r = data.value?.recap24h
  if (!r) return []
  const p = r.poller
  return [
    {
      label: t('admin.monitoring.cards.ingested'),
      value: p.matchesIngested,
      alert: p.windows > 0 && p.matchesIngested === 0,
    },
    {
      label: t('admin.monitoring.cards.ingestFailed'),
      value: p.matchesFailed,
      alert: p.matchesFailed > 0,
    },
    { label: t('admin.monitoring.cards.riotRequests'), value: p.requests, alert: false },
    { label: t('admin.monitoring.cards.rateLimit'), value: p.count429, alert: p.count429 > 0 },
    {
      label: t('admin.monitoring.cards.windows'),
      value: `${p.windows}/144`,
      alert: p.windows < 130,
    },
    { label: t('admin.monitoring.cards.errors'), value: r.errors, alert: r.errors > 0 },
    { label: t('admin.monitoring.cards.warnings'), value: r.warnings, alert: false },
    { label: t('admin.monitoring.cards.api5xx'), value: r.http5xx, alert: r.http5xx > 0 },
  ]
})

const historyRows = computed(() =>
  (data.value?.state.incidents.history ?? []).slice(0, HISTORY_ROWS)
)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(locale.value, { dateStyle: 'short', timeStyle: 'short' })
}

async function handleUnauthorized(res: Response): Promise<boolean> {
  if (res.status !== 401) return false
  clearAuth()
  await navigateTo(localePath('/admin/login'))
  return true
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/monitoring'))
    if (await handleUnauthorized(res)) return
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      error.value = body?.error ?? t('admin.monitoring.loadError')
      return
    }
    data.value = (await res.json()) as MonitoringPayload
    nowMs.value = Date.now()
  } catch {
    error.value = t('admin.monitoring.loadError')
  } finally {
    loading.value = false
  }
}

async function post(id: string, path: string, okMessage: string) {
  busyAction.value = id
  actionMessage.value = null
  try {
    const res = await fetchWithAuth(apiUrl(path), { method: 'POST' })
    if (await handleUnauthorized(res)) return
    actionMessage.value = res.ok ? okMessage : t('admin.monitoring.actionFailed')
    await load()
  } catch {
    actionMessage.value = t('admin.monitoring.actionFailed')
  } finally {
    busyAction.value = null
  }
}

const actions = computed(() => [
  { id: 'refresh', label: t('admin.monitoring.refresh'), run: load },
  {
    id: 'check',
    label: t('admin.monitoring.runCheck'),
    run: () => post('check', '/api/admin/monitoring/check', t('admin.monitoring.checkDone')),
  },
  {
    id: 'recap',
    label: t('admin.monitoring.sendRecap'),
    run: () => post('recap', '/api/admin/monitoring/recap', t('admin.monitoring.recapSent')),
  },
  {
    id: 'test',
    label: t('admin.monitoring.testDiscord'),
    run: () => post('test', '/api/admin/monitoring/test-alert', t('admin.monitoring.testSent')),
  },
])

defineExpose({ load })
</script>
