<template>
  <div class="space-y-6">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <h2 class="mb-2 text-lg font-semibold text-text">{{ t('admin.tabs.purge') }}</h2>
      <p class="mb-4 text-xs text-text/70">
        Garde en base les données brutes des matchs joués depuis la date choisie (<code
          class="text-[11px]"
          >matchs</code
        >, <code class="text-[11px]">participants</code>, <code class="text-[11px]">teams</code>,
        <code class="text-[11px]">player_rank_history</code>) et supprime tout ce qui est plus
        vieux. Les agrégats ne sont pas touchés. Le poller est arrêté pendant la purge (export des
        lignes gardées, TRUNCATE qui rend l'espace disque, réimport) puis relancé.
      </p>

      <form class="flex flex-wrap items-end gap-3" @submit.prevent="runPurge">
        <label class="flex flex-col gap-1 text-sm text-text">
          Garder les matchs depuis le
          <input
            v-model="cutoffDate"
            type="date"
            required
            :max="today"
            class="rounded border border-primary/30 bg-background px-2 py-1 text-text"
            @change="preview = null"
          />
        </label>
        <button
          type="button"
          class="rounded border border-primary/40 px-3 py-1 text-sm text-text hover:bg-primary/10"
          :disabled="loading"
          @click="loadPreview"
        >
          Aperçu
        </button>
        <button
          type="submit"
          class="rounded bg-error/80 px-3 py-1 text-sm font-semibold text-white hover:bg-error disabled:opacity-50"
          :disabled="loading || status.state === 'running'"
        >
          Purger
        </button>
      </form>

      <p v-if="error" class="mt-3 text-sm text-error">{{ error }}</p>
      <p v-if="preview" class="mt-3 whitespace-pre-line text-sm text-text/80">
        {{ purgeConfirmMessage(cutoffDate, preview) }}
      </p>
      <p class="mt-3 text-sm text-text">{{ purgeProgressLabel(status) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { apiUrl } from '~/utils/apiUrl'
import { useAdminAuth } from '~/composables/useAdminAuth'
import {
  defaultPurgeCutoffDate,
  purgeConfirmMessage,
  purgeProgressLabel,
  type RawMatchPurgePreview,
  type RawMatchPurgeStatus,
} from '~/utils/rawMatchPurge'

const { t } = useI18n()
const { fetchWithAuth } = useAdminAuth()

const today = new Date().toISOString().slice(0, 10)
const cutoffDate = ref(defaultPurgeCutoffDate())
const loading = ref(false)
const error = ref<string | null>(null)
const preview = ref<RawMatchPurgePreview | null>(null)
const status = ref<RawMatchPurgeStatus>({ state: 'idle' })
let pollTimer: ReturnType<typeof setTimeout> | null = null

async function fetchState(date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  const res = await fetchWithAuth(apiUrl(`/api/admin/raw-match-purge${qs}`))
  const body = (await res.json()) as {
    status?: RawMatchPurgeStatus
    preview?: RawMatchPurgePreview
    error?: string
  }
  if (body.status) status.value = body.status
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body
}

function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer)
  if (status.value.state !== 'running') return
  pollTimer = setTimeout(async () => {
    try {
      await fetchState()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
    schedulePoll()
  }, 3000)
}

async function loadPreview(): Promise<RawMatchPurgePreview | null> {
  loading.value = true
  error.value = null
  try {
    const body = await fetchState(cutoffDate.value)
    preview.value = body.preview ?? null
    return preview.value
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    return null
  } finally {
    loading.value = false
  }
}

async function runPurge() {
  const p = await loadPreview()
  if (!p || !window.confirm(purgeConfirmMessage(cutoffDate.value, p))) return
  loading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/raw-match-purge'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: cutoffDate.value }),
    })
    const body = (await res.json()) as { status?: RawMatchPurgeStatus; error?: string }
    if (body.status) status.value = body.status
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
    schedulePoll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function activate() {
  try {
    await fetchState()
    schedulePoll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer)
})

defineExpose({ activate })
</script>
