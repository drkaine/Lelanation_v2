<template>
  <div class="tp text-text">
    <section class="tp-hero">
      <div class="tp-hero-inner">
        <div>
          <p class="tp-kicker">
            <Icon name="mdi:scroll-text" aria-hidden="true" />
            {{ t('testPatch.kicker') }}
          </p>
          <div class="tp-title-row">
            <h1 class="tp-title">{{ t('testPatch.title', { version: currentPatchVersion }) }}</h1>
            <span v-if="isLatest" class="tp-latest">
              <Icon name="mdi:fire" aria-hidden="true" />
              {{ t('testPatch.latestBadge') }}
            </span>
          </div>
          <p class="tp-meta">
            <span v-if="currentPatchDate">{{ formatDate(currentPatchDate) }}</span>
            <a
              v-if="officialPatchNotesUrl"
              :href="officialPatchNotesUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="tp-official"
            >
              <Icon name="mdi:open-in-new" aria-hidden="true" />
              {{ t('patchNotesPage.officialLink') }}
            </a>
          </p>
        </div>

        <div class="tp-switcher">
          <NuxtLink
            v-if="neighbors.older"
            :to="localePath(`/patch-notes/${neighbors.older}`)"
            class="tp-switch-btn ui-build-card-button"
            :title="t('testPatch.older')"
            :aria-label="t('testPatch.older')"
          >
            <Icon name="mdi:chevron-left" aria-hidden="true" />
          </NuxtLink>
          <span v-else class="tp-switch-btn is-disabled" aria-hidden="true">
            <Icon name="mdi:chevron-left" />
          </span>

          <label class="sr-only" for="tp-version-select">{{
            t('patchNotesPage.selectPatch')
          }}</label>
          <select
            id="tp-version-select"
            class="tp-select"
            :value="routeVersion"
            @change="onPatchChange"
          >
            <option v-for="patch in patchOptions" :key="patch.version" :value="patch.version">
              {{ patch.version }}
            </option>
          </select>

          <NuxtLink
            v-if="neighbors.newer"
            :to="localePath(`/patch-notes/${neighbors.newer}`)"
            class="tp-switch-btn ui-build-card-button"
            :title="t('testPatch.newer')"
            :aria-label="t('testPatch.newer')"
          >
            <Icon name="mdi:chevron-right" aria-hidden="true" />
          </NuxtLink>
          <span v-else class="tp-switch-btn is-disabled" aria-hidden="true">
            <Icon name="mdi:chevron-right" />
          </span>
        </div>
      </div>

      <div v-if="status === 'success' && tagCounts.length > 0" class="tp-score">
        <p class="tp-score-title">{{ t('testPatch.scoreboard') }}</p>
        <div class="tp-score-grid" :class="{ 'has-filter': activeTag !== 'all' }">
          <button
            v-for="tag in tagCounts"
            :key="tag.id"
            type="button"
            class="tp-score-tile ui-build-card-surface"
            :class="[`tone-${PATCH_VERDICT_TONES[tag.id]}`, { 'is-active': activeTag === tag.id }]"
            :aria-pressed="activeTag === tag.id"
            @click="toggleTag(tag.id)"
          >
            <Icon :name="PATCH_TAG_TILES[tag.id].icon" class="tp-score-icon" aria-hidden="true" />
            <span class="tp-score-count">{{ tag.count }}</span>
            <span class="tp-score-label">{{ t(`patchNotesPage.changeTypes.${tag.id}`) }}</span>
          </button>
        </div>
      </div>
    </section>

    <section class="tp-body">
      <div v-if="status === 'loading'" class="tp-state ui-build-card-surface">
        <Icon name="mdi:loading" class="tp-spin" aria-hidden="true" />
        {{ t('patchNotesPage.loading') }}
      </div>

      <div v-else-if="status === 'error'" class="tp-state ui-build-card-surface">
        <Icon name="mdi:alert-circle" class="tp-state-icon text-error" aria-hidden="true" />
        <p>{{ error || t('patchNotesPage.loadError') }}</p>
        <button
          type="button"
          class="rounded-md bg-accent px-4 py-2 text-sm font-bold text-background hover:bg-accent-dark"
          @click="refreshPatchData()"
        >
          {{ t('patchNotesPage.retry') }}
        </button>
      </div>

      <template v-else>
        <div v-if="visibleModes.length > 1" class="tp-modes">
          <button
            v-for="mode in visibleModes"
            :key="mode.id"
            type="button"
            class="tp-chip ui-build-card-button"
            :class="{ 'is-active': activeMode === mode.id }"
            @click="activeMode = mode.id"
          >
            {{ mode.label }}
            <span class="tp-chip-count">{{ mode.count }}</span>
          </button>
        </div>

        <nav class="tp-tabs" :aria-label="t('testPatch.kicker')">
          <button
            v-for="tab in visibleContentTabs"
            :key="tab.id"
            type="button"
            class="tp-tab ui-build-card-surface"
            :class="{ 'is-active': activeContentTab === tab.id }"
            :aria-pressed="activeContentTab === tab.id"
            @click="activeContentTab = tab.id"
          >
            <Icon :name="PATCH_TAB_ICONS[tab.id]" class="tp-tab-icon" aria-hidden="true" />
            <span class="tp-tab-label">{{ tab.label }}</span>
            <span v-if="tab.id !== 'summary' && tab.count > 0" class="tp-tab-count">
              {{ tab.count }}
            </span>
          </button>
        </nav>

        <div v-if="activeContentTab !== 'summary'" class="tp-toolbar ui-build-card-surface">
          <label class="tp-search">
            <Icon name="mdi:magnify" aria-hidden="true" />
            <input v-model="searchQuery" type="search" :placeholder="t('testPatch.search')" />
          </label>
          <button
            v-if="activeTag !== 'all'"
            type="button"
            class="tp-chip ui-build-card-button is-active"
            @click="activeTag = 'all'"
          >
            {{ t(`patchNotesPage.changeTypes.${activeTag}`) }}
            <Icon name="mdi:close" aria-hidden="true" />
          </button>
          <button
            v-if="activeContentTab !== 'bugfix'"
            type="button"
            class="tp-chip ui-build-card-button tp-compact-toggle"
            :class="{ 'is-active': compactCards }"
            :aria-pressed="compactCards"
            @click="compactCards = !compactCards"
          >
            <Icon :name="compactCards ? 'mdi:view-agenda' : 'mdi:view-grid'" aria-hidden="true" />
            {{ t(compactCards ? 'testPatch.detailedView' : 'testPatch.compactView') }}
          </button>
        </div>

        <div v-if="activeContentTab === 'summary'" class="tp-summary">
          <button
            v-if="summaryImageUrl"
            type="button"
            class="tp-summary-btn ui-build-card-surface"
            @click="isLightboxOpen = true"
          >
            <img
              :src="summaryImageUrl"
              :alt="t('patchNotesPage.summaryImageAlt', { version: currentPatchVersion })"
              loading="eager"
              decoding="async"
            />
            <span class="tp-zoom">
              <Icon name="mdi:magnify-plus" aria-hidden="true" />
              {{ t('patchNotesPage.clickToZoom') }}
            </span>
          </button>
          <div v-else class="tp-state ui-build-card-surface">
            {{ t('patchNotesPage.noSummaryImage') }}
          </div>
        </div>

        <PatchBugfixPanel
          v-else-if="activeContentTab === 'bugfix' && filteredEntities.length > 0"
          :entities="filteredEntities"
          :group-by-mode="false"
        />

        <div
          v-else-if="filteredEntities.length > 0"
          class="tp-grid"
          :class="{ 'is-compact': compactCards }"
        >
          <PatchGamingCard
            v-for="(entity, idx) in filteredEntities"
            :key="`${routeVersion}-${entity.patchSlug || entity.name || idx}`"
            :entity="entity"
            :compact="compactCards"
          />
        </div>

        <div v-else class="tp-state ui-build-card-surface">
          <Icon name="mdi:ghost-outline" class="tp-state-icon" aria-hidden="true" />
          <p>{{ t('patchNotesPage.noChanges', { category: activeContentTabLabel }) }}</p>
        </div>
      </template>
    </section>

    <PatchImageLightbox
      :is-open="isLightboxOpen"
      :src="summaryImageUrl || ''"
      :alt="t('patchNotesPage.summaryImageAlt', { version: currentPatchVersion })"
      @close="isLightboxOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  usePatchNotesStore,
  normalizePatchNotesVersion,
  resolveSummaryImageUrl,
  type PatchData,
  type PatchEntity,
} from '~/stores/PatchNotesStore'
import PatchGamingCard from '~/components/patch/PatchGamingCard.vue'
import { PATCH_VERDICT_TONES } from '~/utils/patchCardGaming'
import PatchBugfixPanel from '~/components/PatchBugfixPanel.vue'
import PatchImageLightbox from '~/components/PatchImageLightbox.vue'
import { excludeBugfixEntities } from '~/utils/patchBugfixItems'
import {
  type PatchNotesModeId,
  type PatchNotesContentTabId,
  PATCH_MODE_I18N_KEYS,
  PATCH_CONTENT_TAB_I18N_KEYS,
  entitiesForPatchMode,
  entitiesForPatchModeTab,
  countPatchMode,
  countPatchModeTab,
  visiblePatchContentTabs,
  visiblePatchModes,
  defaultPatchContentTab,
} from '~/utils/patchNotesModes'
import {
  entityMatchesSummaryTag,
  resolvePatchEntitySummaryTag,
  type PatchEntitySummaryType,
} from '~/utils/patchEntitySummary'
import { getOfficialPatchNotesUrl } from '~/utils/officialPatchNotesUrl'
import { articleJsonLd } from '~/utils/jsonLd'
import { useJsonLdHead } from '~/composables/useJsonLdHead'
import { pageOgImageUrl } from '~/utils/siteUrl'
import {
  PATCH_TAB_ICONS,
  PATCH_TAG_TILES,
  countPatchTags,
  patchNeighbors,
} from '~/utils/patchGaming'

definePageMeta({
  key: route => String(route.params.version ?? ''),
  validate(route) {
    const version = String(route.params.version ?? '')
    return version.length > 0 && !version.startsWith('_')
  },
})

const { t, locale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const patchNotesStore = usePatchNotesStore()
const requestFetch = useRequestFetch()
const { latestVersion, availablePatches } = storeToRefs(patchNotesStore)

const routeVersion = computed(() =>
  normalizePatchNotesVersion(String(route.params.version ?? '').trim())
)

async function fetchPatchJson(version: string, loc: string): Promise<PatchData | null> {
  const patchLocale = loc === 'fr' ? 'fr-FR' : 'en-GB'
  const url = (l: string) => `/data/patch-notes/${version}/patch-${version}-${l}.json`
  try {
    return await requestFetch<PatchData>(url(patchLocale), { cache: 'no-cache' })
  } catch {
    if (patchLocale === 'en-GB') return null
    try {
      return await requestFetch<PatchData>(url('en-GB'), { cache: 'no-cache' })
    } catch {
      return null
    }
  }
}

await useAsyncData(
  () => `patch-notes-index-${locale.value}`,
  async () => {
    await patchNotesStore.loadIndex(false, requestFetch)
    return patchNotesStore.index?.patches.length ?? 0
  },
  { watch: [locale] }
)

const {
  data: patchData,
  status: fetchStatus,
  error: fetchError,
  refresh: refreshPatchData,
} = await useAsyncData(
  () => `patch-notes-${locale.value}-${routeVersion.value}`,
  () =>
    routeVersion.value ? fetchPatchJson(routeVersion.value, locale.value) : Promise.resolve(null),
  { watch: [locale, routeVersion], dedupe: 'cancel' }
)

const status = computed<'loading' | 'success' | 'error'>(() => {
  if (fetchStatus.value === 'pending') return 'loading'
  if (fetchStatus.value === 'error' || !patchData.value) return 'error'
  return 'success'
})
const error = computed(() => fetchError.value?.message ?? null)

const allEntities = computed(() => patchData.value?.entities ?? [])
const activeMode = ref<PatchNotesModeId>('rift')
const activeContentTab = ref<PatchNotesContentTabId>('summary')
const activeTag = ref<PatchEntitySummaryType | 'all'>('all')
const compactCards = ref(false)
const searchQuery = ref('')
const isLightboxOpen = ref(false)

const currentPatchVersion = computed(() => patchData.value?.patchVersion ?? routeVersion.value)
const currentPatchDate = computed(() => patchData.value?.scrapedAt)
const isLatest = computed(() => routeVersion.value === latestVersion.value)
const officialPatchNotesUrl = computed(() =>
  getOfficialPatchNotesUrl(currentPatchVersion.value, locale.value)
)
const patchOptions = computed(() => availablePatches.value)
const neighbors = computed(() =>
  patchNeighbors(
    patchOptions.value.map(p => p.version),
    routeVersion.value
  )
)

const summaryImageUrl = computed(() => {
  const patch = patchData.value
  if (!patch?.patchVersion) return null
  return resolveSummaryImageUrl(
    patch.patchVersion,
    patch.locale,
    patchNotesStore.index,
    patch.summaryImage
  )
})

const visibleModes = computed(() =>
  visiblePatchModes(allEntities.value).map(id => ({
    id,
    label: t(PATCH_MODE_I18N_KEYS[id]),
    count: countPatchMode(allEntities.value, id),
  }))
)

const visibleContentTabs = computed(() =>
  visiblePatchContentTabs(allEntities.value, activeMode.value, Boolean(summaryImageUrl.value)).map(
    id => ({
      id,
      label: t(PATCH_CONTENT_TAB_I18N_KEYS[id]),
      count: countPatchModeTab(allEntities.value, activeMode.value, id),
    })
  )
)

const activeContentTabLabel = computed(
  () => visibleContentTabs.value.find(tab => tab.id === activeContentTab.value)?.label ?? ''
)

/** Tableau des scores : buffs / nerfs / … du mode actif, hors correctifs. */
const tagCounts = computed(() =>
  countPatchTags(
    excludeBugfixEntities(entitiesForPatchMode(allEntities.value, activeMode.value)).map(entity =>
      resolvePatchEntitySummaryTag(entity)
    )
  )
)

function normalizeSearch(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function matchesSearch(entity: PatchEntity, query: string): boolean {
  const changes = entity.changes.map(c => `${c.after} ${c.subCategory ?? ''}`).join(' ')
  return normalizeSearch(`${entity.name} ${entity.subCategory ?? ''} ${changes}`).includes(query)
}

const filteredEntities = computed<PatchEntity[]>(() => {
  if (activeContentTab.value === 'summary') return []
  const query = normalizeSearch(searchQuery.value)
  let list = entitiesForPatchModeTab(allEntities.value, activeMode.value, activeContentTab.value)
  if (query) list = list.filter(entity => matchesSearch(entity, query))
  const tag = activeTag.value
  if (tag !== 'all') list = list.filter(entity => entityMatchesSummaryTag(entity, tag))
  return list
})

/** Un clic sur une tuile du score : filtre et ouvre l'onglet champions si on est sur le résumé. */
function toggleTag(tag: PatchEntitySummaryType) {
  activeTag.value = activeTag.value === tag ? 'all' : tag
  if (activeTag.value !== 'all' && activeContentTab.value === 'summary') {
    const firstEntityTab = visibleContentTabs.value.find(
      tab => tab.id !== 'summary' && tab.id !== 'bugfix'
    )
    if (firstEntityTab) activeContentTab.value = firstEntityTab.id
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function onPatchChange(event: Event) {
  const version = (event.target as HTMLSelectElement).value
  if (!version || version === routeVersion.value) return
  await navigateTo(localePath(`/patch-notes/${version}`))
}

watch(visibleModes, modes => {
  if (modes.length > 0 && !modes.some(mode => mode.id === activeMode.value)) {
    activeMode.value = modes.find(mode => mode.id === 'rift')?.id ?? modes[0]!.id
  }
})

watch(
  [visibleContentTabs, summaryImageUrl],
  () => {
    const tabs = visibleContentTabs.value
    if (tabs.length > 0 && !tabs.some(tab => tab.id === activeContentTab.value)) {
      activeContentTab.value = defaultPatchContentTab(
        allEntities.value,
        activeMode.value,
        Boolean(summaryImageUrl.value)
      )
    }
  },
  { immediate: true }
)

watch(activeMode, () => {
  activeTag.value = 'all'
})

const runtimeConfig = useRuntimeConfig()
const siteUrl = useSiteUrl()
const fallbackGameVersion = String(runtimeConfig.public.fallbackGameVersion ?? '16.12')

const seoPatchVersion = computed(() => routeVersion.value || currentPatchVersion.value || '')

const patchNotesCanonicalPath = computed(() =>
  seoPatchVersion.value ? `/patch-notes/${seoPatchVersion.value}` : '/patch-notes'
)

const patchNotesSeoDescription = computed(() => {
  const version = seoPatchVersion.value
  if (!version) {
    return t('patchNotesPage.metaDescription', { version: fallbackGameVersion })
  }
  const list = entitiesForPatchModeTab(allEntities.value, 'rift', 'champions')
  if (list.length === 0) {
    return t('patchNotesPage.metaDescription', { version })
  }
  const topChamps = list
    .slice(0, 3)
    .map(c => c.name)
    .filter(Boolean)
    .join(', ')
  const countLabel =
    locale.value === 'fr' ? `${list.length} champions modifiés` : `${list.length} champions changed`
  return `Patch ${version} : ${countLabel} — ${topChamps}...`
})

const patchNotesOgTitle = computed(() => {
  const version = seoPatchVersion.value
  if (!version) return t('patchNotesPage.metaTitleFallback')
  const resume = locale.value === 'fr' ? 'Résumé' : 'Summary'
  return `Patch ${version} LoL - ${resume} | Lelanation`
})

const patchNotesOgImage = computed(() =>
  seoPatchVersion.value
    ? pageOgImageUrl(siteUrl, `patch-${seoPatchVersion.value}`)
    : pageOgImageUrl(siteUrl, 'default')
)

useSeoMeta({
  title: () =>
    seoPatchVersion.value
      ? t('patchNotesPage.metaTitle', { version: seoPatchVersion.value })
      : t('patchNotesPage.metaTitleFallback'),
  description: patchNotesSeoDescription,
  ogTitle: patchNotesOgTitle,
  ogImage: patchNotesOgImage,
  twitterImage: patchNotesOgImage,
  twitterCard: 'summary_large_image',
})

useJsonLdHead(
  'patch-notes-article',
  computed(() => {
    const version = seoPatchVersion.value
    if (!version) return null
    return articleJsonLd({
      siteUrl,
      path: patchNotesCanonicalPath.value,
      headline: t('patchNotesPage.metaTitle', { version }),
      description: patchNotesSeoDescription.value,
      datePublished: currentPatchDate.value,
      dateModified: currentPatchDate.value,
    })
  })
)
</script>

<style scoped>
.tp {
  min-height: 100vh;
  padding-bottom: 2rem;
}

.tp-hero {
  background:
    radial-gradient(ellipse at top, rgb(var(--rgb-primary) / 0.25), transparent 70%),
    linear-gradient(180deg, var(--color-blue-500) 0%, var(--color-background) 100%);
  border-bottom: 1px solid var(--card-border-color-soft-default);
}

.tp-hero-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  max-width: none;
  margin: 0 auto;
  padding: 2rem 1rem 1.25rem;
}

.tp-kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text-accent);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tp-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.tp-title {
  color: var(--color-text-accent);
  font-size: clamp(1.75rem, 4vw, 2.75rem);
  font-weight: 800;
  line-height: 1.1;
  text-transform: uppercase;
}

.tp-latest {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-background);
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  box-shadow: 0 0 14px rgb(var(--rgb-primary) / 0.5);
}

.tp-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.4rem;
  font-size: 0.875rem;
  opacity: 0.8;
}

.tp-official {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color-text-accent);
  font-weight: 600;
}

.tp-switcher {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.tp-switch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  font-size: 1.25rem;
}

.tp-switch-btn.is-disabled {
  opacity: 0.25;
}

.tp-select {
  height: 2.25rem;
  padding: 0 0.75rem;
  border: 1px solid var(--color-accent);
  border-radius: 0.5rem;
  background: var(--color-background);
  color: var(--color-text-accent);
  font-weight: 800;
}

.tp-score {
  max-width: none;
  margin: 0 auto;
  padding: 0 1rem 1rem;
}

.tp-score-title {
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.7;
}

.tp-score-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 0.5rem;
}

.tone-info {
  --tone-rgb: var(--rgb-info);
}

.tone-error {
  --tone-rgb: var(--rgb-error);
}

.tone-warning {
  --tone-rgb: var(--rgb-warning);
}

.tone-accent {
  --tone-rgb: var(--rgb-accent);
}

.tone-muted {
  --tone-rgb: var(--rgb-muted);
}

.tp-score-tile {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 0.6rem;
  align-items: center;
  padding: 0.65rem 0.85rem;
  border-left: 4px solid rgb(var(--tone-rgb));
  border-radius: 0.75rem;
  text-align: left;
  transition: box-shadow 0.15s;
}

.tp-score-tile:hover,
.tp-score-tile.is-active {
  box-shadow: 0 0 14px rgb(var(--tone-rgb) / 0.45);
}

.tp-score-grid.has-filter .tp-score-tile:not(.is-active) {
  opacity: 0.45;
}

.tp-score-tile.is-active {
  outline: 1px solid rgb(var(--tone-rgb));
  background: rgb(var(--tone-rgb) / 0.12);
}

.tp-score-icon {
  grid-row: 1 / 3;
  width: 1.75rem;
  height: 1.75rem;
  color: rgb(var(--tone-rgb));
}

.tp-score-count {
  color: rgb(var(--tone-rgb));
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1;
}

.tp-score-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  opacity: 0.8;
}

.tp-body {
  max-width: none;
  margin: 0 auto;
  padding: 1rem;
}

.tp-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.tp-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.tp-chip-count {
  font-size: 0.7rem;
  opacity: 0.7;
}

.tp-tabs {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: none;
}

.tp-tab {
  display: flex;
  flex: 1 0 auto;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.7rem 0.9rem;
  border-radius: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0.75;
  transition: opacity 0.15s;
}

.tp-tab:hover,
.tp-tab.is-active {
  opacity: 1;
}

.tp-tab.is-active {
  color: var(--color-text-accent);
  outline: 1px solid var(--color-accent);
  box-shadow: 0 0 14px rgb(var(--rgb-primary) / 0.3);
}

.tp-tab-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.tp-tab-label {
  font-size: 0.875rem;
}

.tp-tab-count {
  min-width: 1.5rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--color-accent);
  color: var(--color-background);
  font-size: 0.75rem;
  text-align: center;
}

.tp-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem;
  border-radius: 0.75rem;
}

.tp-search {
  display: flex;
  flex: 1 1 14rem;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--card-border-color-soft-default);
  border-radius: 0.5rem;
  background: var(--color-background);
}

.tp-search:focus-within {
  border-color: var(--color-accent);
}

.tp-search input {
  width: 100%;
  background: transparent;
  color: var(--color-text);
  font-size: 0.875rem;
  outline: none;
}

.tp-summary,
.tp-grid,
.tp-body > :deep(.patch-bugfix-panel) {
  margin-top: 1rem;
}

.tp-summary-btn {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: 0.75rem;
}

.tp-summary-btn img {
  width: 100%;
  height: auto;
}

.tp-zoom {
  position: absolute;
  right: 0.6rem;
  bottom: 0.6rem;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.75);
  color: var(--color-text-accent);
  font-size: 0.75rem;
  font-weight: 700;
}

.tp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  align-items: start;
  gap: 0.75rem;
}

.tp-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 3rem 1rem;
  border-radius: 0.75rem;
  text-align: center;
  opacity: 0.85;
}

.tp-state-icon {
  width: 2rem;
  height: 2rem;
}

.tp-spin {
  animation: tp-spin 1s linear infinite;
}

@keyframes tp-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .tp-tab {
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.55rem 0.7rem;
  }

  .tp-tab-label {
    font-size: 0.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tp-spin {
    animation: none;
  }
}

.tp-grid.is-compact {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
  gap: 0.5rem;
}

.tp-compact-toggle {
  margin-left: auto;
}
</style>
