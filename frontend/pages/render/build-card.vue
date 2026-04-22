<template>
  <div class="screenshot-page">
    <div v-if="!buildId" class="screenshot-state">Invalid id</div>
    <div v-else-if="pending" class="screenshot-state">Loading…</div>
    <div v-else-if="fetchError || !build" class="screenshot-state">Build not found</div>
    <div v-else data-build-card-screenshot-root class="screenshot-root">
      <BuildCard
        :build="build"
        readonly
        :hide-top-actions="true"
        :sheet-tooltips="false"
        :initial-displayed-variant-index="subIndex"
        :for-screenshot="true"
        :champion-splash-override="splashQueryOverride ?? null"
      />
      <div v-if="showMeta" class="screenshot-meta">
        <div class="screenshot-meta-author">
          <span v-if="localeTag === 'fr'">Par</span>
          <span v-else>By</span>
          {{ ' ' }}{{ authorName }}
        </div>
        <div v-if="descText" class="screenshot-meta-desc">
          {{ descText }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Build } from '~/types/build'
import BuildCard from '~/components/Build/BuildCard.vue'
import { resolveDisplayedBuild, descriptionTextForMetaShare } from '~/utils/buildDisplayVariant'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

definePageMeta({
  layout: false,
})

const route = useRoute()

useHead({
  title: 'Render',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const buildId = computed(() => {
  const raw = typeof route.query.id === 'string' ? route.query.id.trim() : ''
  return UUID_RE.test(raw) ? raw : ''
})

const subIndex = computed((): number | null => {
  const s = route.query.sub
  if (s === undefined || s === null || String(s).trim() === '') return null
  const n = Number.parseInt(String(s), 10)
  if (!Number.isFinite(n) || n < 0) return null
  return n
})

const showMeta = computed(() => route.query.meta === '1' || route.query.meta === 'true')

const localeTag = computed(() => (route.query.locale === 'en' ? 'en' : 'fr'))

/** ?splash=1|0 depuis l’API capture ; absent = préférence localStorage (BuildCard). */
const splashQueryOverride = computed((): boolean | undefined => {
  const s = route.query.splash
  if (s === '1' || s === 'true') return true
  if (s === '0' || s === 'false') return false
  return undefined
})

const build = ref<Build | null>(null)
const pending = ref(false)
const fetchError = ref<unknown>(null)

async function loadBuildForRender() {
  fetchError.value = null
  if (!buildId.value) {
    build.value = null
    return
  }
  pending.value = true
  try {
    build.value = await $fetch<Build>(`/api/builds/${encodeURIComponent(buildId.value)}`)
  } catch (e) {
    build.value = null
    fetchError.value = e
  } finally {
    pending.value = false
  }
}

watch(buildId, loadBuildForRender, { immediate: true })

const displayedForMeta = computed(() => {
  const b = build.value
  if (!b) return null
  return resolveDisplayedBuild(b, subIndex.value)
})

const descText = computed(() => {
  const b = build.value
  const d = displayedForMeta.value
  if (!b || !d) return ''
  return descriptionTextForMetaShare(b, d)
})

const authorName = computed(() => {
  const b = build.value
  const fallback = localeTag.value === 'en' ? 'Anonymous' : 'Anonyme'
  if (!b) return fallback
  const a = (b.author || '').trim()
  return a || fallback
})
</script>

<style scoped>
.screenshot-page {
  margin: 0;
  min-height: 100vh;
  padding: 16px;
  box-sizing: border-box;
  background: #0d0d18;
}

.screenshot-state {
  color: #a09f9b;
  font-family: system-ui, sans-serif;
  font-size: 14px;
}

.screenshot-root {
  display: inline-block;
  vertical-align: top;
}

/* Masque les ↓ entre sorts sur la capture ; les → items sont laissées visibles */
.screenshot-root :deep(.arrow-down) {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  clip-path: inset(50%) !important;
  font-size: 0 !important;
  line-height: 0 !important;
  color: transparent !important;
  border: none !important;
  visibility: hidden !important;
}

.screenshot-root :deep(.variants-count-indicator:not(.variants-count-indicator--layout-spacer)),
.screenshot-root :deep(.skill-slot-dropdown) {
  display: none !important;
}

.screenshot-meta {
  max-width: 420px;
  margin-top: 14px;
  color: #e7e6e3;
  font-family: system-ui, sans-serif;
}

.screenshot-meta-author {
  font-weight: 700;
  font-size: 15px;
  line-height: 1.35;
}

.screenshot-meta-desc {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  color: #c8c4bf;
}
</style>
