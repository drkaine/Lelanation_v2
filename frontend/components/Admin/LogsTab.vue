<template>
  <div class="w-full space-y-4">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.logs.title') }}</h2>
      <div class="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label class="flex flex-col gap-1 text-xs text-text/80">
          {{ t('admin.logs.section') }}
          <select
            v-model="unifiedLogSection"
            class="rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
          >
            <option value="">{{ t('admin.logs.all') }}</option>
            <option value="back">back</option>
            <option value="front">front</option>
            <option value="db">db</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs text-text/80">
          {{ t('admin.logs.type') }}
          <select
            v-model="unifiedLogType"
            class="rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
          >
            <option value="">{{ t('admin.logs.all') }}</option>
            <option value="debut">debut</option>
            <option value="fin">fin</option>
            <option value="erreur">erreur</option>
            <option value="warning">warning</option>
            <option value="info">info</option>
            <option value="rate_limit">rate_limit</option>
            <option value="verification">verification</option>
            <option value="step">step</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs text-text/80">
          {{ t('admin.logs.script') }}
          <input
            v-model="unifiedLogScript"
            type="text"
            list="admin-log-scripts"
            placeholder="poller, datadragon…"
            class="min-w-[9rem] rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
          />
          <datalist id="admin-log-scripts">
            <option value="poller" />
            <option value="datadragon" />
            <option value="youtube" />
            <option value="community_dragon" />
            <option value="mv_refresh" />
            <option value="poller_v3_10m" />
            <option value="poller_v3_30m" />
            <option value="poller_v3_1h" />
            <option value="puuid_migration" />
            <option value="league_xp" />
            <option value="frontend" />
          </datalist>
        </label>
        <label class="flex flex-col gap-1 text-xs text-text/80">
          {{ t('admin.logs.from') }}
          <input
            v-model="unifiedLogFrom"
            type="datetime-local"
            class="rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-text/80">
          {{ t('admin.logs.to') }}
          <input
            v-model="unifiedLogTo"
            type="datetime-local"
            class="rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-text/80">
          {{ t('admin.logs.search') }}
          <input
            v-model="unifiedLogSearch"
            type="search"
            class="min-w-[8rem] rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-text/80">
          {{ t('admin.logs.sort') }}
          <select
            v-model="unifiedLogSort"
            class="rounded border border-primary/50 bg-background px-2 py-1.5 text-sm text-text"
          >
            <option value="desc">{{ t('admin.logs.sortDesc') }}</option>
            <option value="asc">{{ t('admin.logs.sortAsc') }}</option>
          </select>
        </label>
        <div class="col-span-1 flex w-full flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
          <button
            type="button"
            class="flex-1 rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:flex-none"
            :disabled="unifiedLogsLoading"
            @click="applyUnifiedLogFilters"
          >
            {{ unifiedLogsLoading ? '…' : t('admin.logs.apply') }}
          </button>
          <button
            type="button"
            class="flex-1 rounded border border-primary/40 bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-primary/10 disabled:opacity-50 sm:flex-none"
            :disabled="unifiedLogsLoading"
            @click="refreshUnifiedLogs"
          >
            {{ unifiedLogsLoading ? '…' : 'Actualiser' }}
          </button>
        </div>
      </div>
      <div
        class="mb-4 flex flex-col gap-3 rounded border border-error/30 bg-error/5 p-3 text-sm sm:flex-row sm:flex-wrap sm:items-center"
      >
        <span class="font-medium text-text">{{ t('admin.logs.deleteRange') }}</span>
        <input
          v-model="unifiedLogDeleteFrom"
          type="datetime-local"
          class="w-full rounded border border-primary/50 bg-background px-2 py-1 text-text sm:w-auto"
        />
        <span class="text-text/60">→</span>
        <input
          v-model="unifiedLogDeleteTo"
          type="datetime-local"
          class="w-full rounded border border-primary/50 bg-background px-2 py-1 text-text sm:w-auto"
        />
        <button
          type="button"
          class="rounded border border-error bg-error/20 px-3 py-1.5 font-medium text-error hover:bg-error/30"
          :disabled="unifiedLogsDeleting"
          @click="deleteUnifiedLogsRange"
        >
          {{ unifiedLogsDeleting ? '…' : t('admin.logs.deleteButton') }}
        </button>
        <span v-if="unifiedLogsDeleteMessage" class="text-text">{{
          unifiedLogsDeleteMessage
        }}</span>
      </div>
      <p v-if="unifiedLogsLoading" class="text-text/70">{{ t('admin.loading') }}</p>
      <p v-else class="mb-2 text-sm text-text/70">
        {{ t('admin.logs.total', { n: unifiedLogsTotal }) }}
      </p>
      <div class="w-full overflow-x-auto rounded border border-primary/20">
        <table class="w-full min-w-[56rem] text-left text-sm">
          <thead class="sticky top-0 z-10 border-b border-primary/30 bg-surface/95">
            <tr>
              <th
                class="cursor-pointer px-2 py-2 font-semibold text-text"
                @click="toggleUnifiedSort('script')"
              >
                {{ t('admin.logs.colScript') }}
                {{ unifiedSortKey === 'script' ? (unifiedSortDir === 'asc' ? '▲' : '▼') : '' }}
              </th>
              <th
                class="cursor-pointer px-2 py-2 font-semibold text-text"
                @click="toggleUnifiedSort('type')"
              >
                {{ t('admin.logs.colType') }}
                {{ unifiedSortKey === 'type' ? (unifiedSortDir === 'asc' ? '▲' : '▼') : '' }}
              </th>
              <th
                class="cursor-pointer px-2 py-2 font-semibold text-text"
                @click="toggleUnifiedSort('atIso')"
              >
                {{ t('admin.logs.colDate') }}
                {{ unifiedSortKey === 'atIso' ? (unifiedSortDir === 'asc' ? '▲' : '▼') : '' }}
              </th>
              <th class="px-2 py-2 font-semibold text-text">
                {{ t('admin.logs.colMessage') }}
              </th>
              <th class="px-2 py-2 font-semibold text-text">{{ t('admin.logs.colJson') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in unifiedLogsDisplay"
              :key="`${row.atIso}-${idx}-${row.lineNumber}`"
              class="border-b border-primary/10 odd:bg-background/20"
            >
              <td class="max-w-[8rem] truncate px-2 py-1.5 font-mono text-xs text-text">
                {{ row.script }}
              </td>
              <td class="max-w-[6rem] truncate px-2 py-1.5 text-xs text-text">
                {{ row.type }}
              </td>
              <td class="whitespace-nowrap px-2 py-1.5 text-xs text-text/90">
                {{ formatUnifiedLogDate(row.atIso) }}
              </td>
              <td class="max-w-[24rem] px-2 py-1.5 text-text">
                <span class="line-clamp-2" :title="row.message">{{ row.message }}</span>
              </td>
              <td class="px-2 py-1.5">
                <button
                  v-if="row.json"
                  type="button"
                  class="rounded border border-primary/40 bg-surface px-2 py-0.5 text-xs text-text hover:bg-primary/10"
                  @click="unifiedLogJsonModal = row"
                >
                  JSON
                </button>
                <span v-else class="text-text/40">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="unifiedLogsTotal > unifiedLogLimit"
        class="mt-3 flex flex-wrap items-center gap-2 text-sm"
      >
        <button
          type="button"
          class="rounded border border-primary/40 px-3 py-1 disabled:opacity-50"
          :disabled="unifiedLogOffset <= 0 || unifiedLogsLoading"
          @click="unifiedLogsGoPrev"
        >
          {{ t('admin.pagination.prev') }}
        </button>
        <span class="text-text/80">
          {{ t('admin.pagination.page') }}
          {{ Math.floor(unifiedLogOffset / unifiedLogLimit) + 1 }}
        </span>
        <button
          type="button"
          class="rounded border border-primary/40 px-3 py-1 disabled:opacity-50"
          :disabled="unifiedLogOffset + unifiedLogLimit >= unifiedLogsTotal || unifiedLogsLoading"
          @click="unifiedLogsGoNext"
        >
          {{ t('admin.pagination.next') }}
        </button>
      </div>
    </div>
    <AppModal
      :open="Boolean(unifiedLogJsonModal)"
      size="lg"
      scrollable
      :title="t('admin.logs.jsonTitle')"
      body-class="max-h-[70vh] overflow-auto p-4"
      @close="unifiedLogJsonModal = null"
    >
      <pre class="whitespace-pre-wrap break-all font-mono text-xs text-text">{{
        unifiedLogJsonModal ? prettyUnifiedJson(unifiedLogJsonModal.json) : ''
      }}</pre>
      <template #footer>
        <button
          type="button"
          class="ui-build-card-button rounded-lg px-4 py-2 text-sm font-semibold"
          @click="copyUnifiedJson(unifiedLogJsonModal!)"
        >
          {{ t('admin.logs.copyJson') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { apiUrl } from '~/utils/apiUrl'
import { useAdminAuth } from '~/composables/useAdminAuth'

const { t } = useI18n()
const { fetchWithAuth } = useAdminAuth()

type UnifiedLogEntry = {
  raw: string
  section: string
  type: string
  script: string
  atIso: string
  message: string
  json: Record<string, unknown> | null
  lineNumber: number
}
const unifiedLogsLoading = ref(false)
const unifiedLogsFetched = ref<UnifiedLogEntry[]>([])
const unifiedLogsTotal = ref(0)
const unifiedLogsPathHint = ref('')
const unifiedLogSection = ref('')
const unifiedLogType = ref('')
const unifiedLogScript = ref('')
const unifiedLogFrom = ref('')
const unifiedLogTo = ref('')
const unifiedLogSearch = ref('')
const unifiedLogSort = ref<'asc' | 'desc'>('desc')
const unifiedLogLimit = 500
const unifiedLogOffset = ref(0)
const unifiedSortKey = ref<'atIso' | 'script' | 'type' | 'message'>('atIso')
const unifiedSortDir = ref<'asc' | 'desc'>('desc')
const unifiedLogJsonModal = ref<UnifiedLogEntry | null>(null)
const unifiedLogDeleteFrom = ref('')
const unifiedLogDeleteTo = ref('')
const unifiedLogsDeleting = ref(false)
const unifiedLogsDeleteMessage = ref('')

const unifiedLogsDisplay = computed(() => {
  const rows = [...unifiedLogsFetched.value]
  const k = unifiedSortKey.value
  const dir = unifiedSortDir.value
  const m = dir === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    const va = String(a[k] ?? '')
    const vb = String(b[k] ?? '')
    if (k === 'atIso') return m * va.localeCompare(vb)
    return m * va.localeCompare(vb, undefined, { sensitivity: 'base' })
  })
  return rows
})

function formatUnifiedLogDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function toggleUnifiedSort(key: 'atIso' | 'script' | 'type' | 'message') {
  if (unifiedSortKey.value === key) {
    unifiedSortDir.value = unifiedSortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    unifiedSortKey.value = key
    unifiedSortDir.value = key === 'atIso' ? 'desc' : 'asc'
  }
}

function prettyUnifiedJson(j: Record<string, unknown> | null): string {
  if (!j) return ''
  try {
    return JSON.stringify(j, null, 2)
  } catch {
    return String(j)
  }
}

async function copyUnifiedJson(row: UnifiedLogEntry) {
  const text = prettyUnifiedJson(row.json)
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignore */
  }
}

function datetimeLocalToIso(local: string): string | undefined {
  if (!local || !local.trim()) return undefined
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function applyUnifiedLogFilters() {
  unifiedLogOffset.value = 0
  loadUnifiedLogs().catch(() => {})
}

function refreshUnifiedLogs() {
  loadUnifiedLogs().catch(() => {})
}

function unifiedLogsGoPrev() {
  unifiedLogOffset.value = Math.max(0, unifiedLogOffset.value - unifiedLogLimit)
  loadUnifiedLogs().catch(() => {})
}

function unifiedLogsGoNext() {
  unifiedLogOffset.value += unifiedLogLimit
  loadUnifiedLogs().catch(() => {})
}

async function loadUnifiedLogs() {
  unifiedLogsLoading.value = true
  unifiedLogsDeleteMessage.value = ''
  try {
    const params = new URLSearchParams()
    if (unifiedLogSection.value.trim()) params.set('section', unifiedLogSection.value.trim())
    if (unifiedLogType.value.trim()) params.set('type', unifiedLogType.value.trim())
    if (unifiedLogScript.value.trim()) params.set('script', unifiedLogScript.value.trim())
    const fromIso = datetimeLocalToIso(unifiedLogFrom.value)
    const toIso = datetimeLocalToIso(unifiedLogTo.value)
    if (fromIso) params.set('from', fromIso)
    if (toIso) params.set('to', toIso)
    if (unifiedLogSearch.value.trim()) params.set('search', unifiedLogSearch.value.trim())
    params.set('sort', unifiedLogSort.value)
    params.set('limit', String(unifiedLogLimit))
    params.set('offset', String(unifiedLogOffset.value))
    const res = await fetchWithAuth(apiUrl(`/api/admin/unified-logs?${params.toString()}`))
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      unifiedLogsFetched.value = []
      unifiedLogsTotal.value = 0
      return
    }
    unifiedLogsFetched.value = Array.isArray(data.entries) ? data.entries : []
    unifiedLogsTotal.value = typeof data.totalMatched === 'number' ? data.totalMatched : 0
    unifiedLogsPathHint.value = typeof data.logPath === 'string' ? data.logPath : ''
  } catch {
    unifiedLogsFetched.value = []
    unifiedLogsTotal.value = 0
  } finally {
    unifiedLogsLoading.value = false
  }
}

async function deleteUnifiedLogsRange() {
  const fromIso = datetimeLocalToIso(unifiedLogDeleteFrom.value)
  const toIso = datetimeLocalToIso(unifiedLogDeleteTo.value)
  if (!fromIso || !toIso) {
    unifiedLogsDeleteMessage.value = 'Plage invalide'
    return
  }
  if (!confirm('Supprimer définitivement les entrées dans cette plage ?')) return
  unifiedLogsDeleting.value = true
  unifiedLogsDeleteMessage.value = ''
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/unified-logs'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromIso, toIso }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) {
      unifiedLogsDeleteMessage.value = `Supprimé : ${data.removed ?? 0} ligne(s)`
      unifiedLogOffset.value = 0
      await loadUnifiedLogs()
    } else {
      unifiedLogsDeleteMessage.value = data.error || 'Erreur'
    }
  } catch {
    unifiedLogsDeleteMessage.value = 'Erreur réseau'
  } finally {
    unifiedLogsDeleting.value = false
  }
}

function reload() {
  unifiedLogOffset.value = 0
  return loadUnifiedLogs().catch(() => {})
}

defineExpose({ reload })
</script>
