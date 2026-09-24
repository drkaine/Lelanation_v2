<template>
  <div class="space-y-6">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <h2 class="mb-4 text-lg font-semibold text-text">{{ t('admin.videos.title') }}</h2>
      <div class="mb-4">
        <h3 class="mb-2 text-sm font-medium text-text">{{ t('admin.videos.cronStatus') }}</h3>
        <p v-if="cronLoading" class="text-text/70">Chargement…</p>
        <div v-else class="space-y-1 text-sm text-text/80">
          <p>
            {{ t('admin.videos.lastSuccess') }}:
            {{ cron?.cronJobs?.youtubeSync?.lastSuccessAt ?? '—' }}
          </p>
          <p v-if="cron?.cronJobs?.youtubeSync?.lastFailureAt">
            {{ t('admin.videos.lastFailure') }}:
            {{ cron?.cronJobs?.youtubeSync?.lastFailureAt }}
            ({{ cron?.cronJobs?.youtubeSync?.lastFailureMessage ?? '' }})
          </p>
        </div>
      </div>
      <div class="mb-4">
        <button
          type="button"
          class="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          :disabled="videosTriggering"
          @click="triggerVideosSync"
        >
          {{ videosTriggering ? '…' : t('admin.videos.trigger') }}
        </button>
        <p
          v-if="videosTriggerMessage"
          :class="videosTriggerError ? 'text-error' : 'text-green-600'"
          class="mt-2 text-sm"
        >
          {{ videosTriggerMessage }}
        </p>
      </div>
      <div>
        <h3 class="mb-2 text-sm font-medium text-text">{{ t('admin.videos.addChannel') }}</h3>
        <form class="flex flex-wrap gap-2" @submit.prevent="addChannel">
          <input
            v-model="newChannelHandle"
            type="text"
            :placeholder="t('admin.videos.addChannelPlaceholder')"
            class="min-w-[200px] rounded border border-primary/50 bg-background px-3 py-2 text-text"
          />
          <button
            type="submit"
            class="rounded bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            :disabled="videosAdding || !(newChannelHandle ?? '').trim()"
          >
            {{ videosAdding ? '…' : t('admin.videos.addChannel') }}
          </button>
        </form>
        <p
          v-if="videosAddMessage"
          :class="videosAddError ? 'text-error' : 'text-green-600'"
          class="mt-2 text-sm"
        >
          {{ videosAddMessage }}
        </p>
      </div>
      <div v-if="(cron?.youtube?.channels?.length ?? 0) > 0" class="mt-4">
        <h3 class="mb-2 text-sm font-medium text-text">{{ t('admin.videos.channels') }}</h3>
        <ul class="space-y-1 text-sm text-text/80">
          <li v-for="c in cron?.youtube?.channels ?? []" :key="c.channelId">
            {{ c.channelName ?? c.channelId }} · {{ c.videoCount ?? 0 }} vidéos ·
            {{ c.lastSync ?? '—' }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { apiUrl } from '~/utils/apiUrl'
import { useAdminAuth } from '~/composables/useAdminAuth'

const emit = defineEmits<{ 'auth-error': [message: string | null] }>()
const { t } = useI18n()
const localePath = useLocalePath()
const { fetchWithAuth, clearAuth } = useAdminAuth()

// Videos / Cron
const cron = ref<any>(null)
const cronLoading = ref(false)

const videosTriggering = ref(false)
const videosTriggerMessage = ref('')
const videosTriggerError = ref(false)
const newChannelHandle = ref('')
const videosAdding = ref(false)
const videosAddMessage = ref('')
const videosAddError = ref(false)

async function loadCron() {
  cronLoading.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/cron'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    cron.value = await res.json()
  } catch {
    emit('auth-error', t('admin.login.error'))
  } finally {
    cronLoading.value = false
  }
}

async function triggerVideosSync() {
  videosTriggerMessage.value = ''
  videosTriggerError.value = false
  videosTriggering.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/youtube/trigger'), { method: 'POST' })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      videosTriggerMessage.value = t('admin.videos.triggerSuccess')
      await loadCron()
    } else {
      videosTriggerError.value = true
      videosTriggerMessage.value = data?.error ?? t('admin.videos.triggerError')
    }
  } catch {
    videosTriggerError.value = true
    videosTriggerMessage.value = t('admin.videos.triggerError')
  } finally {
    videosTriggering.value = false
  }
}

async function addChannel() {
  const handle = newChannelHandle.value.trim()
  if (!handle) return
  videosAddMessage.value = ''
  videosAddError.value = false
  videosAdding.value = true
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/youtube/channels'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    })
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    const data = await res.json()
    if (res.ok) {
      videosAddMessage.value = t('admin.videos.addChannelSuccess')
      newChannelHandle.value = ''
      await loadCron()
    } else {
      videosAddError.value = true
      videosAddMessage.value = data?.error ?? t('admin.videos.addChannelError')
    }
  } catch {
    videosAddError.value = true
    videosAddMessage.value = t('admin.videos.addChannelError')
  } finally {
    videosAdding.value = false
  }
}

function activate() {
  if (!cronLoading.value) return loadCron()
}

defineExpose({ load: loadCron, activate })
</script>
