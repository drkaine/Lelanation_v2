<template>
  <div class="error-page" :class="`error-page--${info.kind}`">
    <div class="error-bg" aria-hidden="true">
      <div class="error-glow" />
      <div class="error-grid" />
    </div>

    <header class="error-header">
      <a :href="homePath" class="error-logo" @click.prevent="go(homePath)">
        <img src="/images/logo.png" alt="Lelanation" width="40" height="40" />
        <span>Lelanation</span>
      </a>
    </header>

    <main class="error-main">
      <div class="error-emblem" aria-hidden="true">
        <svg viewBox="0 0 200 200" class="error-ring">
          <circle cx="100" cy="100" r="92" class="ring-outer" />
          <circle cx="100" cy="100" r="78" class="ring-inner" />
          <path
            d="M100 14 L112 30 L100 46 L88 30 Z M100 154 L112 170 L100 186 L88 170 Z M14 100 L30 88 L46 100 L30 112 Z M154 100 L170 88 L186 100 L170 112 Z"
            class="ring-gems"
          />
        </svg>
        <span class="error-code">{{ info.code || '!' }}</span>
      </div>

      <p class="error-eyebrow">
        {{ info.code ? t('errorPage.eyebrow', { code: info.code }) : t('errorPage.eyebrowNoCode') }}
      </p>
      <h1 class="error-title">{{ t(info.titleKey) }}</h1>
      <p class="error-message">{{ t(info.messageKey) }}</p>

      <p v-if="info.kind === 'notFound' && requestedPath" class="error-path">
        <span>{{ t('errorPage.requested') }}</span>
        <code>{{ requestedPath }}</code>
      </p>

      <div class="error-actions">
        <button type="button" class="btn btn-primary" @click="go(homePath)">
          {{ t('errorPage.home') }}
        </button>
        <button v-if="info.canRetry" type="button" class="btn btn-ghost" @click="retry">
          {{ t('errorPage.retry') }}
        </button>
        <button type="button" class="btn btn-ghost" @click="back">
          {{ t('errorPage.back') }}
        </button>
      </div>

      <nav class="error-suggest" :aria-label="t('errorPage.suggestions')">
        <p>{{ t('errorPage.suggestions') }}</p>
        <ul>
          <li v-for="link in suggestions" :key="link.to">
            <a :href="link.to" @click.prevent="go(link.to)">{{ link.label }}</a>
          </li>
        </ul>
      </nav>

      <details v-if="showDetails" class="error-details">
        <summary>{{ t('errorPage.details') }}</summary>
        <pre>{{ detailText }}</pre>
      </details>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'
import { resolveErrorPage } from '~/utils/errorPage'

const props = defineProps<{ error: NuxtError }>()

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const info = computed(() => resolveErrorPage(props.error?.statusCode))
const homePath = computed(() => localePath('/'))
const requestedPath = computed(() => route.fullPath)

const suggestions = computed(() => [
  { to: localePath('/builds'), label: t('nav.builds') },
  { to: localePath('/statistics'), label: t('nav.statistics') },
  { to: localePath('/patch-notes'), label: t('nav.patchNotes') },
  { to: localePath('/videos'), label: t('nav.videos') },
])

const showDetails = computed(() => import.meta.dev && Boolean(props.error?.message))
const detailText = computed(() =>
  [props.error?.message, props.error?.stack].filter(Boolean).join('\n\n')
)

useHead(() => ({
  title: `${info.value.code ? `${info.value.code} · ` : ''}${t(info.value.titleKey)}`,
  meta: [{ name: 'robots', content: 'noindex' }],
}))

function go(to: string) {
  clearError({ redirect: to })
}

function retry() {
  const target = route.fullPath
  clearError().then(() => {
    if (import.meta.client) window.location.assign(target)
  })
}

function back() {
  if (import.meta.client && window.history.length > 1) {
    clearError().then(() => window.history.back())
  } else {
    go(homePath.value)
  }
}
</script>

<style scoped>
.error-page {
  --ep-gold: rgb(var(--rgb-gold-300, 200 155 60));
  --ep-gold-soft: rgb(var(--rgb-gold-300, 200 155 60) / 0.35);
  --ep-blue: rgb(var(--rgb-blue-100, 10 200 185));
  --ep-blue-soft: rgb(var(--rgb-blue-100, 10 200 185) / 0.25);
  position: relative;
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  background: rgb(var(--rgb-background, 1 10 19));
  color: rgb(var(--rgb-text, 240 230 210));
}

.error-page--server,
.error-page--unavailable {
  --ep-blue: rgb(248 113 113);
  --ep-blue-soft: rgb(248 113 113 / 0.25);
}

.error-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.error-glow {
  position: absolute;
  left: 50%;
  top: 38%;
  width: min(900px, 140vw);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle,
    var(--ep-blue-soft) 0%,
    rgb(var(--rgb-gold-300, 200 155 60) / 0.08) 35%,
    transparent 65%
  );
  filter: blur(10px);
}

.error-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgb(var(--rgb-gold-300, 200 155 60) / 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgb(var(--rgb-gold-300, 200 155 60) / 0.05) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at 50% 40%, black 0%, transparent 70%);
}

.error-header {
  position: relative;
  z-index: 1;
  padding: 20px 16px;
}

.error-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--ep-gold);
  text-decoration: none;
}

.error-logo img {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.error-main {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px 64px;
  text-align: center;
}

.error-emblem {
  position: relative;
  display: grid;
  width: clamp(180px, 42vw, 240px);
  aspect-ratio: 1;
  place-items: center;
  margin-bottom: 8px;
}

.error-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  animation: ep-spin 60s linear infinite;
}

.ring-outer {
  fill: none;
  stroke: var(--ep-gold-soft);
  stroke-width: 1.5;
  stroke-dasharray: 4 6;
}

.ring-inner {
  fill: rgb(var(--rgb-background, 1 10 19) / 0.6);
  stroke: var(--ep-gold);
  stroke-width: 2;
}

.ring-gems {
  fill: var(--ep-blue);
  opacity: 0.85;
}

.error-code {
  position: relative;
  font-size: clamp(3rem, 12vw, 4.5rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.02em;
  background: linear-gradient(180deg, rgb(240 230 210) 0%, var(--ep-gold) 70%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 40px var(--ep-gold-soft);
}

.error-eyebrow {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ep-blue);
}

.error-title {
  margin: 0;
  font-size: clamp(1.5rem, 5vw, 2.25rem);
  font-weight: 800;
  line-height: 1.15;
  color: rgb(var(--rgb-text-accent, 200 155 60));
  text-wrap: balance;
}

.error-message {
  margin: 0;
  max-width: 48ch;
  font-size: 1rem;
  line-height: 1.6;
  opacity: 0.85;
  text-wrap: pretty;
}

.error-path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 4px 0 0;
  font-size: 0.8rem;
  opacity: 0.75;
}

.error-path code {
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 2px 8px;
  border: 1px solid var(--ep-gold-soft);
  border-radius: 4px;
  background: rgb(var(--rgb-surface, 30 40 45) / 0.6);
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
}

.btn {
  min-height: 44px;
  padding: 10px 20px;
  border-radius: 4px;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.btn:focus-visible {
  outline: 2px solid var(--ep-blue);
  outline-offset: 3px;
}

.btn-primary {
  border: 1px solid var(--ep-gold);
  background: linear-gradient(180deg, rgb(200 155 60) 0%, rgb(120 90 40) 100%);
  color: rgb(1 10 19);
  box-shadow: 0 0 0 0 var(--ep-gold-soft);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px var(--ep-gold-soft);
}

.btn-ghost {
  border: 1px solid var(--ep-gold-soft);
  background: rgb(var(--rgb-surface, 30 40 45) / 0.5);
  color: inherit;
}

.btn-ghost:hover {
  border-color: var(--ep-gold);
  background: rgb(var(--rgb-surface, 30 40 45) / 0.85);
}

.error-suggest {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--ep-gold-soft);
  width: 100%;
}

.error-suggest p {
  margin: 0 0 10px;
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.6;
}

.error-suggest ul {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.error-suggest a {
  display: inline-block;
  padding: 6px 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--ep-blue);
  text-decoration: none;
  transition: border-color 0.15s ease;
}

.error-suggest a:hover,
.error-suggest a:focus-visible {
  border-color: var(--ep-blue-soft);
  outline: none;
}

.error-details {
  width: 100%;
  margin-top: 16px;
  text-align: left;
  font-size: 0.8rem;
}

.error-details summary {
  cursor: pointer;
  opacity: 0.7;
}

.error-details pre {
  max-height: 280px;
  overflow: auto;
  padding: 12px;
  border-radius: 4px;
  background: rgb(0 0 0 / 0.4);
  white-space: pre-wrap;
}

@keyframes ep-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .error-ring {
    animation: none;
  }
  .btn {
    transition: none;
  }
}
</style>
