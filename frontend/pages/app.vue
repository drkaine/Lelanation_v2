<template>
  <div class="min-h-screen bg-background text-text">
    <div class="mx-auto max-w-4xl px-4 py-8">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold text-text-accent">{{ t('adminApp.title') }}</h1>
        <NuxtLink
          :to="localePath('/admin')"
          class="rounded border border-primary/40 px-3 py-1.5 text-sm hover:bg-primary/15"
        >
          {{ t('adminApp.backToAdmin') }}
        </NuxtLink>
      </div>

      <section class="rounded-lg border border-primary/30 bg-surface/30 p-5">
        <h2 class="text-lg font-semibold">{{ t('adminApp.downloadTitle') }}</h2>
        <p class="mt-2 text-sm text-text/80">{{ t('adminApp.description') }}</p>

        <div v-if="downloadStats" class="mt-4 rounded border border-primary/20 bg-surface/20 p-3">
          <p class="text-sm font-semibold text-text-accent">
            {{ t('adminApp.downloadCount', { count: downloadStats.total }) }}
          </p>
          <div v-if="recentDays.length" class="mt-2 space-y-1">
            <div
              v-for="day in recentDays"
              :key="day.date"
              class="flex justify-between text-xs text-text/70"
            >
              <span>{{ day.date }}</span>
              <span class="font-mono">{{ day.count }}</span>
            </div>
          </div>
        </div>
        <p v-else-if="statsError" class="mt-3 text-sm text-error">
          {{ t('adminApp.downloadCountError') }}
        </p>

        <p v-if="message" :class="isError ? 'text-error' : 'text-green-600'" class="mt-3 text-sm">
          {{ message }}
        </p>
        <button
          type="button"
          class="mt-4 rounded bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          :disabled="downloading"
          @click="downloadCompanionApp"
        >
          {{ downloading ? '…' : t('adminApp.downloadButton') }}
        </button>
      </section>

      <section class="mt-6 rounded-lg border border-primary/30 bg-surface/30 p-5">
        <h2 class="text-lg font-semibold">{{ t('adminApp.featuresTitle') }}</h2>
        <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-text/85">
          <li>{{ t('adminApp.features.importBuilds') }}</li>
          <li>{{ t('adminApp.features.localFavorites') }}</li>
          <li>{{ t('adminApp.features.matchSync') }}</li>
          <li>{{ t('adminApp.features.settings') }}</li>
        </ul>
      </section>

      <section class="mt-6 rounded-lg border border-primary/30 bg-surface/30 p-5">
        <h2 class="text-lg font-semibold">{{ t('adminApp.gdprTitle') }}</h2>
        <p class="mt-2 text-sm text-text/80">{{ t('adminApp.gdprIntro') }}</p>
        <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-text/85">
          <li>{{ t('adminApp.gdpr.consent') }}</li>
          <li>{{ t('adminApp.gdpr.minData') }}</li>
          <li>{{ t('adminApp.gdpr.localOnly') }}</li>
          <li>{{ t('adminApp.gdpr.privacyPolicy') }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { apiUrl } from '~/utils/apiUrl'
import { useAdminAuth } from '~/composables/useAdminAuth'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const localePath = useLocalePath()
const { fetchWithAuth, clearAuth, checkLoggedIn } = useAdminAuth()
const config = useRuntimeConfig()

const downloading = ref(false)
const message = ref('')
const isError = ref(false)

const downloadStats = ref<{ total: number; daily: Record<string, number> } | null>(null)
const statsError = ref(false)

const recentDays = computed(() => {
  if (!downloadStats.value?.daily) return []
  return Object.entries(downloadStats.value.daily)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14)
    .map(([date, count]) => ({ date, count }))
})

async function downloadCompanionApp() {
  message.value = ''
  isError.value = false
  downloading.value = true
  try {
    // Track download on click (+1 in file)
    try {
      await $fetch(apiUrl('/api/app/track-download'), { method: 'POST' })
      // Update stats reactively
      if (downloadStats.value) {
        const today = new Date().toISOString().slice(0, 10)
        downloadStats.value = {
          total: downloadStats.value.total + 1,
          daily: {
            ...downloadStats.value.daily,
            [today]: (downloadStats.value.daily[today] || 0) + 1,
          },
        }
      } else {
        await loadDownloadStats()
      }
    } catch {
      // Non-blocking: continue with download even if track fails
    }
    const configuredUrl = String(config.public.companionAppDownloadUrl || '').trim()
    if (configuredUrl) {
      window.location.href = configuredUrl
      return
    }
    const res = await fetchWithAuth(apiUrl('/api/admin/app-download'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    if (res.status === 404) {
      isError.value = true
      message.value = t('adminApp.unavailable')
      return
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      isError.value = true
      message.value = data?.error ?? t('adminApp.error')
      return
    }
    const contentType = res.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as { redirect?: string }
      if (data.redirect) {
        window.location.href = data.redirect
        return
      }
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download =
      res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/^"|"$/g, '') ??
      'Lelanation.exe'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    isError.value = true
    message.value = t('adminApp.error')
  } finally {
    downloading.value = false
  }
}

async function loadDownloadStats() {
  try {
    const res = await fetchWithAuth(apiUrl('/api/app/download-stats'))
    if (res.ok) {
      downloadStats.value = (await res.json()) as { total: number; daily: Record<string, number> }
    } else {
      statsError.value = true
    }
  } catch {
    statsError.value = true
  }
}

onMounted(async () => {
  if (!checkLoggedIn()) {
    await navigateTo(localePath('/admin/login'))
    return
  }
  loadDownloadStats()
})
</script>
