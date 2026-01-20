<template>
  <div class="admin-dashboard min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-text-accent">Admin</h1>
          <p class="text-text/70 mt-1 text-sm">Monitoring (Epic 8)</p>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink
            to="/admin/youtube-creators"
            class="rounded-lg border border-primary bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-primary hover:text-white"
          >
            Créateurs YouTube
          </NuxtLink>
          <button
            class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            @click="refresh"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      <div
        v-if="error"
        class="mb-4 rounded-lg border border-error bg-surface p-3 text-sm text-error"
      >
        {{ error }}
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="rounded-lg border-2 border-primary bg-surface p-4">
          <h2 class="mb-2 text-base font-bold text-text">Système</h2>
          <div class="text-text/80 space-y-1 text-sm">
            <div>
              Uptime: <span class="font-semibold">{{ metrics?.uptimeSec ?? '—' }}s</span>
            </div>
            <div>
              Req: <span class="font-semibold">{{ metrics?.requestCount ?? '—' }}</span>
            </div>
            <div>
              Errors (5xx): <span class="font-semibold">{{ metrics?.errorCount ?? '—' }}</span>
            </div>
            <div>
              Avg ms: <span class="font-semibold">{{ metrics?.avgResponseTimeMs ?? '—' }}</span>
            </div>
            <div>
              P95 ms: <span class="font-semibold">{{ metrics?.p95ResponseTimeMs ?? '—' }}</span>
            </div>
            <div>
              Node: <span class="font-semibold">{{ metrics?.nodeVersion ?? '—' }}</span>
            </div>
          </div>
        </div>

        <div class="rounded-lg border-2 border-primary bg-surface p-4">
          <h2 class="mb-2 text-base font-bold text-text">Data Dragon</h2>
          <div class="text-text/80 space-y-1 text-sm">
            <div>
              Version:
              <span class="font-semibold">{{ cron?.dataDragon?.currentVersion ?? '—' }}</span>
            </div>
            <div>
              Last sync:
              <span class="font-semibold">{{ cron?.dataDragon?.lastSyncDate ?? '—' }}</span>
            </div>
          </div>
          <div class="text-text/60 mt-3 text-xs">
            Cron: dataDragonSync — last success:
            {{ cron?.cronJobs?.dataDragonSync?.lastSuccessAt ?? '—' }}
          </div>
        </div>

        <div class="rounded-lg border-2 border-primary bg-surface p-4 md:col-span-2">
          <h2 class="mb-2 text-base font-bold text-text">YouTube</h2>
          <div class="text-text/60 mb-3 text-xs">
            Cron: youtubeSync — last success:
            {{ cron?.cronJobs?.youtubeSync?.lastSuccessAt ?? '—' }}
            <span v-if="cron?.cronJobs?.youtubeSync?.lastFailureAt">
              · last failure: {{ cron?.cronJobs?.youtubeSync?.lastFailureAt }} ({{
                cron?.cronJobs?.youtubeSync?.lastFailureMessage
              }})
            </span>
          </div>

          <div v-if="(cron?.youtube?.channels?.length || 0) === 0" class="text-text/70 text-sm">
            Aucun channel configuré.
          </div>
          <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div
              v-for="c in cron?.youtube?.channels || []"
              :key="c.channelId"
              class="rounded border border-primary bg-surface p-3"
            >
              <div class="font-semibold text-text">{{ c.channelName || c.channelId }}</div>
              <div class="text-text/60 mt-1 text-xs">
                videos: {{ c.videoCount }} · lastSync: {{ c.lastSync || '—' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="text-text/80 mt-6 rounded-lg border border-primary bg-surface p-4 text-sm">
        Shared builds count (server):
        <span class="font-semibold">{{ cron?.metrics?.sharedBuildsCount ?? 0 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { apiUrl } from '~/utils/apiUrl'

type Metrics = {
  uptimeSec: number
  requestCount: number
  errorCount: number
  avgResponseTimeMs: number
  p95ResponseTimeMs: number
  nodeVersion: string
}

type CronPayload = any

const metrics = ref<Metrics | null>(null)
const cron = ref<CronPayload | null>(null)
const error = ref<string | null>(null)

const refresh = async () => {
  error.value = null
  try {
    const [mRes, cRes] = await Promise.all([
      fetch(apiUrl('/api/admin/metrics')),
      fetch(apiUrl('/api/admin/cron')),
    ])
    const mJson = await mRes.json()
    const cJson = await cRes.json()
    if (!mRes.ok) throw new Error(mJson?.error || 'Failed to load admin metrics')
    if (!cRes.ok) throw new Error(cJson?.error || 'Failed to load cron status')
    metrics.value = mJson
    cron.value = cJson
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load admin dashboard'
  }
}

onMounted(refresh)
</script>
