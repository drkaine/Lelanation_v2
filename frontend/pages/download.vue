<template>
  <div class="dl-page text-text">
    <section class="dl-hero">
      <div class="dl-hero-inner">
        <p class="dl-eyebrow">
          <Icon name="mdi:microsoft-windows" size="16px" />
          {{ t('downloadTest.eyebrow') }}
        </p>
        <h1 class="dl-title">{{ t('lelanationApp.title') }}</h1>
        <p class="dl-subtitle">{{ t('lelanationApp.subtitle') }}</p>

        <div class="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-bold text-background transition hover:bg-accent-dark disabled:opacity-50"
            :disabled="downloading"
            @click="downloadCompanionApp"
          >
            <Icon name="mdi:download" size="20px" />
            {{ downloading ? '…' : t('lelanationApp.downloadButton') }}
          </button>
          <NuxtLink
            :to="localePath('/privacy')"
            class="ui-build-card-button inline-flex items-center gap-2 px-6 py-3 text-sm font-bold transition"
          >
            <Icon name="mdi:shield-lock-outline" size="20px" />
            {{ t('lelanationApp.privacyButton') }}
          </NuxtLink>
        </div>
        <p v-if="message" class="mt-3 text-sm" :class="isError ? 'text-error' : 'text-info'">
          {{ message }}
        </p>
        <p class="mt-3 text-xs text-text/55">{{ t('lelanationApp.downloadHint') }}</p>

        <ul class="dl-stats">
          <li v-if="downloadStats">
            <strong>{{ formatStat(downloadStats.total) }}</strong>
            <span>{{ t('downloadTest.statTotal') }}</span>
          </li>
          <li v-if="downloadStats">
            <strong>{{ formatStat(weekCount) }}</strong>
            <span>{{ t('downloadTest.statWeek') }}</span>
          </li>
        </ul>
      </div>
      <Icon name="mdi:application-brackets-outline" class="dl-hero-art" aria-hidden="true" />
    </section>

    <div class="dl-container">
      <section class="dl-section">
        <h2 class="dl-h2">{{ t('downloadTest.stepsTitle') }}</h2>
        <ol class="dl-steps">
          <li v-for="(step, i) in steps" :key="step.key" class="dl-step">
            <span class="dl-step-index">{{ i + 1 }}</span>
            <Icon :name="step.icon" size="26px" class="dl-step-icon" />
            <h3 class="dl-step-title">{{ t(`downloadTest.${step.key}Title`) }}</h3>
            <p class="dl-step-text">{{ t(`downloadTest.${step.key}Text`) }}</p>
          </li>
        </ol>
        <div class="dl-warning">
          <Icon name="mdi:alert-outline" size="22px" class="shrink-0 text-warning" />
          <div>
            <p class="font-bold text-warning">{{ t('lelanationApp.smartScreenTitle') }}</p>
            <p class="mt-1 text-sm text-text/80">{{ t('lelanationApp.smartScreenText') }}</p>
          </div>
        </div>
      </section>

      <section class="dl-section">
        <h2 class="dl-h2">{{ t('lelanationApp.featuresTitle') }}</h2>
        <ul class="dl-features">
          <li v-for="feature in features" :key="feature.key" class="dl-feature">
            <Icon :name="feature.icon" size="28px" class="dl-feature-icon" />
            <p>{{ t(`lelanationApp.features.${feature.key}`) }}</p>
          </li>
        </ul>
      </section>

      <section class="dl-section dl-privacy">
        <div>
          <h2 class="dl-h2">{{ t('lelanationApp.gdprTitle') }}</h2>
          <p class="mt-3 max-w-xl text-text/80">{{ t('lelanationApp.gdprIntro') }}</p>
          <NuxtLink :to="localePath('/privacy')" class="dl-more">
            {{ t('downloadTest.privacyCta') }}
            <Icon name="mdi:arrow-right" size="16px" />
          </NuxtLink>
        </div>
        <ul class="dl-gdpr">
          <li v-for="item in gdprItems" :key="item">
            <Icon name="mdi:check-decagram" size="20px" class="shrink-0 text-accent" />
            {{ t(`lelanationApp.gdpr.items.${item}`) }}
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiUrl } from '~/utils/apiUrl'
import { recentDownloadCount } from '~/utils/legalPageGaming'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()

const downloading = ref(false)
const message = ref('')
const isError = ref(false)
const downloadStats = ref<{ total: number; daily: Record<string, number> } | null>(null)

const weekCount = computed(() =>
  downloadStats.value ? recentDownloadCount(downloadStats.value.daily, 7) : 0
)

const steps = [
  { key: 'step1', icon: 'mdi:download-circle-outline' },
  { key: 'step2', icon: 'mdi:shield-check-outline' },
  { key: 'step3', icon: 'mdi:sword-cross' },
]

const features = [
  { key: 'importBuilds', icon: 'mdi:import' },
  { key: 'localFavorites', icon: 'mdi:star-outline' },
  { key: 'settings', icon: 'mdi:tune-variant' },
]

const gdprItems = ['consent', 'minData', 'localOnly', 'rights']

function formatStat(value: number): string {
  return new Intl.NumberFormat(locale.value === 'fr' ? 'fr-FR' : 'en-US').format(value)
}

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
/* Couleurs : uniquement les tokens du site (même langage que la home). */
.dl-page {
  width: 100%;
  padding-bottom: 3rem;
}

.dl-hero {
  position: relative;
  overflow: hidden;
  min-height: 420px;
  display: flex;
  align-items: flex-end;
  border-bottom: 1px solid rgb(var(--rgb-accent) / 0.3);
  background:
    radial-gradient(ellipse at 80% 30%, rgb(var(--rgb-accent) / 0.16), transparent 55%),
    var(--color-blue-600);
}

.dl-hero-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 3rem 16px 2rem;
}

@media (min-width: 640px) {
  .dl-hero-inner {
    padding-inline: 2rem;
  }
}

.dl-hero-art {
  position: absolute;
  right: 4%;
  top: 50%;
  display: none;
  width: 18rem;
  height: 18rem;
  transform: translateY(-50%) rotate(-8deg);
  color: rgb(var(--rgb-accent) / 0.18);
}

@media (min-width: 1024px) {
  .dl-hero-art {
    display: block;
  }
}

.dl-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgb(var(--rgb-accent) / 0.75);
}

.dl-title {
  margin-top: 0.25rem;
  font-size: clamp(2.25rem, 6vw, 4.5rem);
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-text-accent);
  text-shadow: 0 4px 24px rgb(0 0 0 / 0.5);
}

.dl-subtitle {
  margin-top: 0.75rem;
  max-width: 36rem;
  font-size: 1.05rem;
  color: rgb(var(--rgb-text) / 0.8);
}

.dl-stats {
  margin-top: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem 2.5rem;
}

.dl-stats li {
  display: flex;
  flex-direction: column;
}

.dl-stats strong {
  font-size: 1.6rem;
  font-weight: 900;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}

.dl-stats span {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgb(var(--rgb-text) / 0.6);
}

.dl-container {
  padding-inline: 16px;
}

@media (min-width: 640px) {
  .dl-container {
    padding-inline: 2rem;
  }
}

.dl-section {
  margin-top: 2.5rem;
}

.dl-h2 {
  position: relative;
  padding-left: 0.85rem;
  font-size: 1.4rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-accent);
}

.dl-h2::before {
  content: '';
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 4px;
  background: var(--color-accent);
}

.dl-steps {
  margin-top: 1rem;
  display: grid;
  gap: 1rem;
}

@media (min-width: 768px) {
  .dl-steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.dl-step {
  position: relative;
  overflow: hidden;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-chrome) / 0.5);
  padding: 1.25rem;
}

.dl-step-index {
  position: absolute;
  right: 0.75rem;
  top: -0.5rem;
  font-size: 4.5rem;
  font-weight: 900;
  line-height: 1;
  color: rgb(var(--rgb-accent) / 0.12);
}

.dl-step-icon {
  color: var(--color-accent);
}

.dl-step-title {
  margin-top: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text);
}

.dl-step-text {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  color: rgb(var(--rgb-text) / 0.78);
}

.dl-warning {
  margin-top: 1rem;
  display: flex;
  gap: 0.75rem;
  border: 1px solid rgb(var(--rgb-warning) / 0.35);
  border-left-width: 4px;
  border-radius: 0.5rem;
  background: rgb(var(--rgb-warning) / 0.08);
  padding: 0.9rem 1rem;
}

.dl-features {
  margin-top: 1rem;
  display: grid;
  gap: 1rem;
}

@media (min-width: 640px) {
  .dl-features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .dl-features {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.dl-feature {
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 0.75rem;
  background: rgb(var(--rgb-chrome) / 0.5);
  padding: 1.25rem;
  font-size: 0.9rem;
  line-height: 1.55;
  color: rgb(var(--rgb-text) / 0.85);
  transition:
    border-color 0.15s,
    transform 0.15s;
}

.dl-feature:hover {
  border-color: rgb(var(--rgb-accent) / 0.55);
  transform: translateY(-2px);
}

.dl-feature-icon {
  margin-bottom: 0.6rem;
  color: var(--color-accent);
}

.dl-privacy {
  display: grid;
  gap: 1.5rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.25);
  border-radius: 0.75rem;
  background:
    linear-gradient(120deg, rgb(var(--rgb-accent) / 0.08), transparent 60%),
    rgb(var(--rgb-chrome) / 0.5);
  padding: 1.5rem;
}

@media (min-width: 1024px) {
  .dl-privacy {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    align-items: center;
  }
}

.dl-more {
  margin-top: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-accent);
}

.dl-more:hover {
  text-decoration: underline;
}

.dl-gdpr {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.dl-gdpr li {
  display: flex;
  gap: 0.6rem;
  font-size: 0.9rem;
  color: rgb(var(--rgb-text) / 0.85);
}
</style>
