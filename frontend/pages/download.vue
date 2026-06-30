<template>
  <div class="download-page w-full text-text">
    <section
      class="w-full border-b border-primary/25 bg-surface/30 px-3 py-8 sm:px-5 lg:px-8 lg:py-10"
    >
      <div class="mx-auto w-full max-w-[1600px]">
        <h1 class="text-3xl font-bold text-text-accent sm:text-4xl">
          {{ t('lelanationApp.title') }}
        </h1>
        <p class="mt-3 max-w-3xl text-text/80 sm:text-lg">
          {{ t('lelanationApp.subtitle') }}
        </p>

        <div
          v-if="downloadStats"
          class="mt-4 inline-block rounded-lg border border-primary/20 bg-surface/40 px-4 py-3 text-sm text-text/85"
        >
          {{ t('lelanationApp.downloadCount', { count: downloadStats.total }) }}
        </div>

        <div class="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            class="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 font-semibold text-background transition hover:bg-accent-dark disabled:opacity-50"
            :disabled="downloading"
            @click="downloadCompanionApp"
          >
            {{ downloading ? '…' : t('lelanationApp.downloadButton') }}
          </button>
          <NuxtLink
            :to="localePath('/privacy')"
            class="inline-flex items-center rounded-lg border border-primary/50 bg-background px-5 py-2.5 font-semibold text-text transition hover:bg-primary/15"
          >
            {{ t('lelanationApp.privacyButton') }}
          </NuxtLink>
        </div>

        <p v-if="message" :class="isError ? 'text-error' : 'text-green-600'" class="mt-3 text-sm">
          {{ message }}
        </p>

        <p class="mt-3 text-xs text-text/60">
          {{ t('lelanationApp.downloadHint') }}
        </p>

        <div class="mt-5 max-w-3xl rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 class="text-sm font-semibold text-amber-400">
            ⚠ {{ t('lelanationApp.smartScreenTitle') }}
          </h3>
          <p class="mt-2 text-sm text-text/80">{{ t('lelanationApp.smartScreenText') }}</p>
          <p class="mt-2 text-sm font-medium text-text/90">
            {{ t('lelanationApp.smartScreenSteps') }}
          </p>
        </div>
      </div>
    </section>

    <section class="w-full border-b border-primary/20 px-3 py-8 sm:px-5 lg:px-8 lg:py-10">
      <div class="mx-auto w-full max-w-[1600px]">
        <h2 class="text-xl font-semibold text-text-accent sm:text-2xl">
          {{ t('lelanationApp.featuresTitle') }}
        </h2>
        <ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="feature in featureItems"
            :key="feature"
            class="rounded-lg border border-primary/20 bg-surface/30 px-4 py-3 text-sm text-text/85"
          >
            {{ feature }}
          </li>
        </ul>
      </div>
    </section>

    <section class="w-full px-3 py-8 sm:px-5 lg:px-8 lg:py-10">
      <div class="mx-auto w-full max-w-[1600px]">
        <h2 class="text-xl font-semibold text-text-accent sm:text-2xl">
          {{ t('lelanationApp.gdprTitle') }}
        </h2>
        <p class="mt-3 max-w-3xl text-text/85">{{ t('lelanationApp.gdprIntro') }}</p>
        <ul class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <li class="text-sm text-text/85">• {{ t('lelanationApp.gdpr.items.consent') }}</li>
          <li class="text-sm text-text/85">• {{ t('lelanationApp.gdpr.items.localOnly') }}</li>
          <li class="text-sm text-text/85">• {{ t('lelanationApp.gdpr.items.rights') }}</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiUrl } from '~/utils/apiUrl'

const { t } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()

const downloading = ref(false)
const message = ref('')
const isError = ref(false)
const downloadStats = ref<{ total: number; daily: Record<string, number> } | null>(null)

const featureItems = computed(() => [
  t('lelanationApp.features.importBuilds'),
  t('lelanationApp.features.localFavorites'),
  t('lelanationApp.features.matchSync'),
  t('lelanationApp.features.settings'),
])

const downloadUrl = computed(() => {
  const configured = config.public.companionAppDownloadUrl as string | undefined
  return configured && configured.trim() ? configured : apiUrl('/api/app/download')
})

async function bumpDownloadStats(): Promise<void> {
  try {
    await $fetch(apiUrl('/api/app/track-download'), { method: 'POST' })
    if (downloadStats.value) {
      const today = new Date().toISOString().slice(0, 10)
      downloadStats.value = {
        total: downloadStats.value.total + 1,
        daily: {
          ...downloadStats.value.daily,
          [today]: (downloadStats.value.daily[today] || 0) + 1,
        },
      }
    }
  } catch {
    // Non-blocking
  }
}

async function downloadCompanionApp(): Promise<void> {
  message.value = ''
  isError.value = false
  downloading.value = true
  try {
    await bumpDownloadStats()

    const configuredUrl = String(config.public.companionAppDownloadUrl || '').trim()
    if (configuredUrl) {
      window.location.href = configuredUrl
      return
    }

    const res = await fetch(downloadUrl.value)
    if (res.status === 404) {
      isError.value = true
      message.value = t('lelanationApp.downloadUnavailable')
      return
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      isError.value = true
      message.value = (data as { error?: string })?.error ?? t('lelanationApp.downloadError')
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
    message.value = t('lelanationApp.downloadError')
  } finally {
    downloading.value = false
  }
}

async function loadDownloadStats(): Promise<void> {
  try {
    downloadStats.value = await $fetch<{ total: number; daily: Record<string, number> }>(
      apiUrl('/api/app/download-stats')
    )
  } catch {
    downloadStats.value = null
  }
}

useHead({
  title: () => t('lelanationApp.metaTitle'),
  meta: [{ name: 'description', content: () => t('lelanationApp.metaDescription') }],
})

useSeoMeta({
  ogTitle: () => t('lelanationApp.metaTitle'),
  ogDescription: () => t('lelanationApp.metaDescription'),
  ogType: 'website',
})

onMounted(() => {
  loadDownloadStats()
})
</script>
