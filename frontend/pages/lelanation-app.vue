<template>
  <div class="mx-auto max-w-4xl px-4 py-10">
    <section class="rounded-xl border border-primary/30 bg-surface/40 p-6 md:p-8">
      <h1 class="text-3xl font-bold text-text-accent">{{ t('lelanationApp.title') }}</h1>
      <p class="mt-3 text-text/80">
        {{ t('lelanationApp.subtitle') }}
      </p>

      <div class="mt-6 flex flex-wrap gap-3">
        <a
          :href="downloadUrl"
          class="inline-flex items-center rounded bg-accent px-5 py-2.5 font-semibold text-background transition hover:bg-accent-dark"
          @click.prevent="trackDownload"
        >
          {{ t('lelanationApp.downloadButton') }}
        </a>
        <NuxtLink
          :to="localePath('/privacy')"
          class="inline-flex items-center rounded border border-primary/50 bg-background px-5 py-2.5 font-semibold text-text transition hover:bg-primary/15"
        >
          {{ t('lelanationApp.privacyButton') }}
        </NuxtLink>
      </div>

      <p class="mt-3 text-xs text-text/60">
        {{ t('lelanationApp.downloadHint') }}
      </p>

      <div class="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 class="text-sm font-semibold text-amber-400">
          ⚠ {{ t('lelanationApp.smartScreenTitle') }}
        </h3>
        <p class="mt-2 text-sm text-text/80">{{ t('lelanationApp.smartScreenText') }}</p>
        <p class="mt-2 text-sm font-medium text-text/90">
          {{ t('lelanationApp.smartScreenSteps') }}
        </p>
      </div>
    </section>

    <section class="mt-8 rounded-xl border border-primary/30 bg-surface/40 p-6 md:p-8">
      <h2 class="text-xl font-semibold text-text">{{ t('lelanationApp.featuresTitle') }}</h2>
      <ul class="mt-4 space-y-2 text-text/85">
        <li>• {{ t('lelanationApp.features.importBuilds') }}</li>
        <li>• {{ t('lelanationApp.features.localFavorites') }}</li>
        <li>• {{ t('lelanationApp.features.matchSync') }}</li>
        <li>• {{ t('lelanationApp.features.settings') }}</li>
      </ul>
    </section>

    <section class="mt-8 rounded-xl border border-primary/30 bg-surface/40 p-6 md:p-8">
      <h2 class="text-xl font-semibold text-text">{{ t('lelanationApp.gdprTitle') }}</h2>
      <p class="mt-3 text-text/85">{{ t('lelanationApp.gdprIntro') }}</p>
      <ul class="mt-4 space-y-2 text-text/85">
        <li>• {{ t('lelanationApp.gdpr.items.consent') }}</li>
        <li>• {{ t('lelanationApp.gdpr.items.minData') }}</li>
        <li>• {{ t('lelanationApp.gdpr.items.localOnly') }}</li>
        <li>• {{ t('lelanationApp.gdpr.items.rights') }}</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { apiUrl } from '~/utils/apiUrl'

const { t } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()

const downloadUrl = computed(() => {
  const configured = config.public.companionAppDownloadUrl as string | undefined
  return configured && configured.trim() ? configured : apiUrl('/api/admin/app-download')
})

async function trackDownload() {
  try {
    await $fetch(apiUrl('/api/app/track-download'), { method: 'POST' })
  } catch {
    // Non-blocking: proceed with download even if track fails
  }
  window.location.href = downloadUrl.value
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
</script>
