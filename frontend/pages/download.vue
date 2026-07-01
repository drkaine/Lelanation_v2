<template>
  <div class="download-page min-h-screen w-full px-3 py-4 text-text sm:px-5 lg:px-6">
    <div class="mx-auto w-full max-w-[1600px] space-y-6">
      <section class="ui-build-card-surface rounded-2xl p-5 sm:p-8 lg:p-10">
        <h1 class="download-title text-2xl font-bold sm:text-3xl lg:text-4xl">
          {{ t('lelanationApp.title') }}
        </h1>
        <p class="download-subtitle mt-3 max-w-3xl text-sm sm:text-base">
          {{ t('lelanationApp.subtitle') }}
        </p>

        <div
          v-if="downloadStats"
          class="ui-build-card-surface mt-5 inline-flex rounded-lg px-4 py-2.5 text-sm text-text/85"
        >
          {{ t('lelanationApp.downloadCount', { count: downloadStats.total }) }}
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-accent-dark disabled:opacity-50"
            :disabled="downloading"
            @click="downloadCompanionApp"
          >
            {{ downloading ? '…' : t('lelanationApp.downloadButton') }}
          </button>
          <NuxtLink
            :to="localePath('/privacy')"
            class="ui-build-card-button inline-flex items-center px-5 py-2.5 text-sm font-semibold"
          >
            {{ t('lelanationApp.privacyButton') }}
          </NuxtLink>
          <span
            class="download-install-tip relative inline-flex shrink-0"
            tabindex="0"
            :aria-label="t('lelanationApp.smartScreenTitle')"
          >
            <span
              class="inline-flex h-8 w-8 cursor-help items-center justify-center rounded-full border border-warning/45 bg-warning/10 text-sm font-bold text-warning"
              aria-hidden="true"
            >
              !
            </span>
            <span role="tooltip" class="download-install-tooltip">
              <span class="block font-semibold text-warning">
                {{ t('lelanationApp.smartScreenTitle') }}
              </span>
              <span class="mt-1.5 block text-text/85">
                {{ t('lelanationApp.smartScreenText') }}
              </span>
              <span class="mt-1.5 block font-medium text-text/90">
                {{ t('lelanationApp.smartScreenSteps') }}
              </span>
            </span>
          </span>
        </div>

        <p v-if="message" class="mt-3 text-sm" :class="isError ? 'text-error' : 'text-info'">
          {{ message }}
        </p>

        <p class="mt-3 text-xs text-text/55">
          {{ t('lelanationApp.downloadHint') }}
        </p>
      </section>

      <section>
        <h2 class="download-section-title text-xl font-bold sm:text-2xl">
          {{ t('lelanationApp.featuresTitle') }}
        </h2>
        <ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="feature in featureItems"
            :key="feature"
            class="ui-build-card-surface rounded-lg px-4 py-3 text-sm leading-relaxed text-text/85"
          >
            {{ feature }}
          </li>
        </ul>
      </section>

      <section class="ui-build-card-surface rounded-2xl p-5 sm:p-8">
        <h2 class="download-section-title text-xl font-bold sm:text-2xl">
          {{ t('lelanationApp.gdprTitle') }}
        </h2>
        <p class="mt-3 max-w-3xl text-sm leading-relaxed text-text/80 sm:text-base">
          {{ t('lelanationApp.gdprIntro') }}
        </p>
        <ul class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="item in gdprItems"
            :key="item"
            class="ui-build-card-surface rounded-lg px-4 py-3 text-sm text-text/85"
          >
            {{ item }}
          </li>
        </ul>
      </section>
    </div>
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

const gdprItems = computed(() => [
  t('lelanationApp.gdpr.items.consent'),
  t('lelanationApp.gdpr.items.localOnly'),
  t('lelanationApp.gdpr.items.rights'),
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

<style scoped>
.download-title,
.download-section-title {
  color: var(--color-gold-300);
}

.download-subtitle {
  color: rgb(125 211 252 / 0.88);
}

.download-install-tooltip {
  pointer-events: none;
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 50%;
  z-index: 50;
  display: none;
  width: max-content;
  max-width: min(28rem, calc(100vw - 2rem));
  transform: translateX(-50%);
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-warning) / 0.35);
  background: rgb(var(--rgb-chrome) / 1);
  padding: 0.75rem 0.9rem;
  text-align: left;
  font-size: 0.75rem;
  line-height: 1.5;
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.45);
}

.download-install-tip:hover .download-install-tooltip,
.download-install-tip:focus-within .download-install-tooltip {
  display: block;
}
</style>
