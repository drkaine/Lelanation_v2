<template>
  <div
    :key="`patch-notes-page-${routeVersion}`"
    :class="[
      'bg-background text-text',
      summaryLayoutLocked
        ? 'flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden'
        : 'min-h-screen overflow-x-hidden',
    ]"
  >
    <!-- Header -->
    <div class="px-[10px] py-3 sm:px-3 lg:px-6">
      <div class="mx-auto max-w-[1600px]">
        <section class="ui-build-card-surface rounded-xl p-4">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <h1
                class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-base font-bold md:text-lg"
              >
                <span class="patch-notes-title">{{ t('patchNotesPage.titleLabel') }}</span>
                <a
                  :href="officialPatchNotesUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-accent underline decoration-accent/40 underline-offset-2 transition hover:decoration-accent"
                  :title="t('patchNotesPage.viewOfficial')"
                >
                  {{ currentPatchVersion }}
                </a>
              </h1>
              <p v-if="currentPatchDate" class="text-xs text-text/60">
                {{ t('patchNotesPage.publishedAt', { date: formatDate(currentPatchDate) }) }}
              </p>
            </div>

            <div class="min-w-[10rem] flex-1 sm:max-w-xs">
              <label class="sr-only" for="patch-entity-search">{{
                t('patchNotesPage.searchPlaceholder')
              }}</label>
              <input
                id="patch-entity-search"
                v-model="searchQuery"
                type="search"
                :placeholder="t('patchNotesPage.searchPlaceholder')"
                class="w-full rounded-lg border border-primary/35 bg-background px-3 py-1.5 text-sm text-text placeholder:text-text/45 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
            </div>

            <div class="flex shrink-0 flex-wrap items-center gap-2">
              <div v-if="patchOptions.length > 0">
                <label class="sr-only" for="patch-version-select">{{
                  t('patchNotesPage.selectPatch')
                }}</label>
                <select
                  id="patch-version-select"
                  :value="routeVersion"
                  class="rounded-lg border border-primary/35 bg-background px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
                  @change="onPatchChange"
                >
                  <option v-for="patch in patchOptions" :key="patch.version" :value="patch.version">
                    {{ formatPatchOption(patch.version) }}
                  </option>
                </select>
              </div>

              <div v-if="showTagFilterSelect">
                <label class="sr-only" for="patch-tag-select">{{
                  t('patchNotesPage.tagFilters.label')
                }}</label>
                <select
                  id="patch-tag-select"
                  v-model="activeTagFilter"
                  class="rounded-lg border border-primary/35 bg-background px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
                >
                  <option value="all">
                    {{ t('patchNotesPage.tagFilters.all') }} ({{ modeEntitiesForTagFilter.length }})
                  </option>
                  <option v-for="filter in availableTagFilters" :key="filter.id" :value="filter.id">
                    {{ filter.label }} ({{ filter.count }})
                  </option>
                </select>
              </div>

              <div v-if="showModeSelect">
                <label class="sr-only" for="patch-mode-select">{{
                  t('patchNotesPage.modes.label')
                }}</label>
                <select
                  id="patch-mode-select"
                  v-model="activeMode"
                  class="rounded-lg border border-primary/35 bg-background px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
                >
                  <option v-for="mode in visibleModes" :key="mode.id" :value="mode.id">
                    {{ mode.label }} ({{ mode.count }})
                  </option>
                </select>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Content tabs for the active game mode -->
    <div
      v-if="showContentTabs"
      class="patch-notes-tabs-bar sticky top-0 z-30 flex w-full min-w-0 flex-shrink-0 items-start gap-2 overflow-x-hidden border-b border-primary/20 bg-chrome/95 px-[10px] pb-2 pt-2 backdrop-blur sm:px-3 lg:px-6"
    >
      <div
        class="patch-notes-tabs-scroll-wrap relative mx-auto min-w-0 max-w-[1600px] flex-1 overflow-hidden"
      >
        <div
          ref="tabsNavEl"
          role="tablist"
          :aria-label="t('patchNotesPage.title', { version: currentPatchVersion })"
          class="patch-notes-tabs-nav flex flex-nowrap gap-2 overflow-x-auto pb-1"
        >
          <button
            v-for="tab in visibleContentTabs"
            :id="`patch-notes-tab-${tab.id}`"
            :key="tab.id"
            type="button"
            role="tab"
            :data-tab-id="tab.id"
            :aria-selected="activeContentTab === tab.id"
            :tabindex="activeContentTab === tab.id ? 0 : -1"
            :class="[
              'patch-notes-tab-btn ui-build-card-button flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm font-medium',
              activeContentTab === tab.id ? 'is-active' : '',
            ]"
            @click="selectContentTab(tab.id)"
          >
            <span>{{ tab.label }}</span>
            <span
              v-if="tab.id !== 'summary' && tab.count > 0"
              :class="[
                'rounded-full px-1.5 py-0.5 text-[10px]',
                activeContentTab === tab.id
                  ? 'bg-accent/25 text-accent'
                  : 'bg-panel-elevated/60 text-text/60',
              ]"
            >
              {{ tab.count }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div
      :class="[
        contentWrapperClass,
        summaryLayoutLocked ? 'flex min-h-0 flex-1 flex-col' : '',
        activeContentTab === 'summary' && !isSearchActive ? 'py-1' : 'py-4',
      ]"
    >
      <!-- Loading State -->
      <div
        v-if="status === 'loading'"
        class="ui-build-card-surface flex flex-col items-center justify-center gap-4 rounded-xl py-12"
      >
        <div
          class="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-accent"
        />
        <p class="text-text/70">{{ t('patchNotesPage.loading') }}</p>
      </div>

      <!-- Error State -->
      <div
        v-else-if="status === 'error'"
        class="ui-build-card-surface flex flex-col items-center justify-center gap-4 rounded-xl py-12"
      >
        <p class="text-error">{{ error || t('patchNotesPage.error') }}</p>
        <button
          type="button"
          class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:bg-accent-dark"
          @click="retryLoad"
        >
          {{ t('patchNotesPage.retry') }}
        </button>
      </div>

      <!-- Summary Tab Content - fit viewport without scroll -->
      <div
        v-else-if="activeContentTab === 'summary' && !isSearchActive"
        class="flex min-h-0 flex-1 flex-col items-center"
      >
        <div
          v-if="summaryImageUrl"
          class="ui-build-card-surface flex min-h-0 w-full flex-1 cursor-pointer flex-col items-center justify-center rounded-xl p-2 sm:p-3"
          @click="isLightboxOpen = true"
        >
          <img
            :src="summaryImageUrl"
            :alt="t('patchNotesPage.summaryImageAlt', { version: currentPatchVersion })"
            class="max-h-full max-w-full rounded-lg object-contain transition-opacity hover:opacity-90"
          />
          <p class="mt-2 shrink-0 text-center text-xs text-text/55">
            {{ t('patchNotesPage.clickToZoom') }}
          </p>
        </div>
        <div v-else class="ui-build-card-surface rounded-xl px-4 py-12 text-center text-text/70">
          {{ t('patchNotesPage.noSummaryImage') }}
        </div>
      </div>

      <!-- Bugfix tab — full width, multi-column list -->
      <PatchBugfixPanel
        v-else-if="activeContentTab === 'bugfix' && filteredEntities.length > 0"
        :entities="filteredEntities"
        :group-by-mode="false"
      />

      <!-- Entity Cards Grid -->
      <div
        v-else-if="filteredEntities.length > 0"
        class="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
      >
        <PatchEntityCard
          v-for="(entity, idx) in filteredEntities"
          :key="`${routeVersion}-${entity.patchSlug || entity.name || idx}`"
          :entity="entity"
        />
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="ui-build-card-surface flex flex-col items-center justify-center gap-4 rounded-xl py-12 text-text/70"
      >
        <p v-if="isSearchActive">
          {{ t('patchNotesPage.noSearchResults', { query: searchQuery.trim() }) }}
        </p>
        <p v-else-if="activeTagFilter !== 'all'">
          {{
            t('patchNotesPage.noTagResults', {
              tag: t(`patchNotesPage.changeTypes.${activeTagFilter}`),
            })
          }}
        </p>
        <p v-else>{{ t('patchNotesPage.noChanges', { category: activeContentTabLabel }) }}</p>
      </div>

      <!-- Image Lightbox (teleports to body, can be placed anywhere) -->
      <PatchImageLightbox
        :is-open="isLightboxOpen"
        :src="summaryImageUrl || ''"
        :alt="t('patchNotesPage.summaryImageAlt', { version: currentPatchVersion })"
        @close="isLightboxOpen = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import {
  usePatchNotesStore,
  normalizePatchNotesVersion,
  resolveSummaryImageUrl,
  type PatchData,
  type PatchEntity,
  type PatchIndexEntry,
} from '~/stores/PatchNotesStore'
import PatchEntityCard from '~/components/PatchEntityCard.vue'
import PatchBugfixPanel from '~/components/PatchBugfixPanel.vue'
import { isBugfixPatchEntity, excludeBugfixEntities } from '~/utils/patchBugfixItems'
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
import PatchImageLightbox from '~/components/PatchImageLightbox.vue'
import { articleJsonLd } from '~/utils/jsonLd'
import { useJsonLdHead } from '~/composables/useJsonLdHead'
import { useSiteUrl } from '~/composables/useSiteUrl'
import { pageOgImageUrl } from '~/utils/siteUrl'
import { getOfficialPatchNotesUrl } from '~/utils/officialPatchNotesUrl'
import {
  PATCH_ENTITY_TAG_FILTER_ORDER,
  entityMatchesSummaryTag,
  resolvePatchEntitySummaryTag,
  type PatchEntitySummaryType,
} from '~/utils/patchEntitySummary'

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
const runtimeConfig = useRuntimeConfig()
const siteUrl = useSiteUrl()
const fallbackGameVersion = String(runtimeConfig.public.fallbackGameVersion ?? '16.12')

const { latestVersion, availablePatches } = storeToRefs(patchNotesStore)

function localeToPatchLocale(loc: string): string {
  return loc === 'fr' ? 'fr-FR' : 'en-GB'
}

async function fetchPatchJsonForPage(version: string, loc: string): Promise<PatchData | null> {
  const patchLocale = localeToPatchLocale(loc)
  const primaryUrl = `/data/patch-notes/${version}/patch-${version}-${patchLocale}.json`
  try {
    return await requestFetch<PatchData>(primaryUrl, { cache: 'no-cache' })
  } catch {
    if (patchLocale === 'en-GB') return null
    try {
      return await requestFetch<PatchData>(
        `/data/patch-notes/${version}/patch-${version}-en-GB.json`,
        { cache: 'no-cache' }
      )
    } catch {
      return null
    }
  }
}

const routeVersion = computed(() =>
  normalizePatchNotesVersion(String(route.params.version ?? '').trim())
)

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
  status: patchFetchStatus,
  error: patchFetchError,
  refresh: refreshPatchData,
} = await useAsyncData(
  () => `patch-notes-page-${locale.value}-${String(route.params.version ?? '')}`,
  async () => {
    const version = normalizePatchNotesVersion(String(route.params.version ?? '').trim())
    if (!version) return null
    return await fetchPatchJsonForPage(version, locale.value)
  },
  {
    watch: [locale, () => route.params.version],
    dedupe: 'cancel',
  }
)

const status = computed<'loading' | 'success' | 'error'>(() => {
  if (patchFetchStatus.value === 'pending') return 'loading'
  if (patchFetchStatus.value === 'error') return 'error'
  if (!patchData.value) return 'error'
  return 'success'
})

const error = computed(() => patchFetchError.value?.message ?? null)

const allPatchEntities = computed(() => patchData.value?.entities ?? [])

const activeMode = ref<PatchNotesModeId>('rift')
const activeContentTab = ref<PatchNotesContentTabId>('summary')
const isLightboxOpen = ref(false)
const searchQuery = ref('')
const activeTagFilter = ref<PatchEntitySummaryType | 'all'>('all')
const tabsNavEl = ref<HTMLElement | null>(null)
useHorizontalScrollContainer(tabsNavEl)

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)

const summaryLayoutLocked = computed(
  () =>
    activeContentTab.value === 'summary' &&
    !isSearchActive.value &&
    status.value !== 'loading' &&
    status.value !== 'error'
)

const currentPatchVersion = computed(() => patchData.value?.patchVersion ?? routeVersion.value)
const currentPatchDate = computed(() => patchData.value?.scrapedAt)

const officialPatchNotesUrl = computed(() =>
  getOfficialPatchNotesUrl(currentPatchVersion.value, locale.value)
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

function applyTagFilter(entities: PatchEntity[]): PatchEntity[] {
  if (activeTagFilter.value === 'all') return entities
  return entities.filter(entity => entityMatchesSummaryTag(entity, activeTagFilter.value))
}

function entityMatchesSearch(entity: PatchEntity, query: string): boolean {
  const changeLabels = entity.changes.map(c => [c.after, c.subCategory].join(' ')).join(' ')
  const haystack = [entity.name, entity.subCategory ?? '', changeLabels]
    .map(normalizeSearch)
    .join(' ')
  return haystack.includes(query)
}

const visibleModes = computed(() => {
  const entities = allPatchEntities.value
  return visiblePatchModes(entities).map(modeId => ({
    id: modeId,
    label: t(PATCH_MODE_I18N_KEYS[modeId]),
    count: countPatchMode(entities, modeId),
  }))
})

const showModeSelect = computed(() => status.value === 'success' && visibleModes.value.length > 1)

const modeEntitiesForTagFilter = computed(() =>
  entitiesForPatchMode(allPatchEntities.value, activeMode.value)
)

const visibleContentTabs = computed(() =>
  visiblePatchContentTabs(
    allPatchEntities.value,
    activeMode.value,
    Boolean(summaryImageUrl.value)
  ).map(tabId => ({
    id: tabId,
    label: t(PATCH_CONTENT_TAB_I18N_KEYS[tabId]),
    count: countPatchModeTab(allPatchEntities.value, activeMode.value, tabId),
  }))
)

const showContentTabs = computed(
  () => status.value === 'success' && visibleContentTabs.value.length > 0
)

const activeContentTabLabel = computed(
  () => visibleContentTabs.value.find(tab => tab.id === activeContentTab.value)?.label ?? ''
)

const contentWrapperClass = computed(() =>
  activeContentTab.value === 'bugfix'
    ? 'w-full max-w-none px-[10px] sm:px-4 lg:px-8'
    : 'mx-auto w-full max-w-[1600px] px-[10px] sm:px-3 lg:px-6'
)

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .trim()
}

const tabEntities = computed<PatchEntity[]>(() => {
  if (activeContentTab.value === 'summary') return []
  return entitiesForPatchModeTab(allPatchEntities.value, activeMode.value, activeContentTab.value)
})

const availableTagFilters = computed(() => {
  const counts = new Map<PatchEntitySummaryType, number>()
  for (const entity of modeEntitiesForTagFilter.value) {
    if (isBugfixPatchEntity(entity)) continue
    const tag = resolvePatchEntitySummaryTag(entity)
    if (!tag) continue
    counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }

  return PATCH_ENTITY_TAG_FILTER_ORDER.filter(tag => (counts.get(tag) ?? 0) > 0).map(tag => ({
    id: tag,
    label: t(`patchNotesPage.changeTypes.${tag}`),
    count: counts.get(tag) ?? 0,
  }))
})

const showTagFilterSelect = computed(
  () =>
    status.value === 'success' &&
    activeContentTab.value !== 'summary' &&
    Boolean(modeEntitiesForTagFilter.value.length)
)

const filteredEntities = computed<PatchEntity[]>(() => {
  if (activeContentTab.value === 'summary') return []

  const query = normalizeSearch(searchQuery.value)
  const basePool = isSearchActive.value
    ? entitiesForPatchMode(allPatchEntities.value, activeMode.value)
    : tabEntities.value

  if (!query) {
    return applyTagFilter(basePool)
  }

  const searchPool =
    activeContentTab.value === 'bugfix'
      ? entitiesForPatchModeTab(allPatchEntities.value, activeMode.value, 'bugfix')
      : excludeBugfixEntities(entitiesForPatchMode(allPatchEntities.value, activeMode.value))

  const searched = searchPool.filter(entity => entityMatchesSearch(entity, query))

  return applyTagFilter(searched)
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatPatchOption(version: string): string {
  if (version === latestVersion.value) {
    return `${version} (${t('patchNotesPage.latest')})`
  }
  return version
}

if (import.meta.client) {
  watch(
    () => route.params.version,
    raw => {
      const normalized = normalizePatchNotesVersion(String(raw ?? '').trim())
      if (raw && normalized && String(raw) !== normalized) {
        navigateTo(localePath(`/patch-notes/${normalized}`), { replace: true }).catch(() => {})
      }
    },
    { immediate: true }
  )
}

function retryLoad() {
  refreshPatchData()
}

async function onPatchChange(event: Event) {
  const version = (event.target as HTMLSelectElement).value
  if (!version || version === routeVersion.value) return
  searchQuery.value = ''
  activeTagFilter.value = 'all'
  activeMode.value = 'rift'
  activeContentTab.value = 'summary'
  await navigateTo(localePath(`/patch-notes/${version}`))
}

function scrollActiveTabIntoView(behavior: ScrollBehavior = 'smooth'): void {
  if (!import.meta.client || !tabsNavEl.value) return
  const el = tabsNavEl.value.querySelector<HTMLButtonElement>(
    `button[data-tab-id="${activeContentTab.value}"]`
  )
  el?.scrollIntoView({ inline: 'start', block: 'nearest', behavior })
}

function selectContentTab(tabId: PatchNotesContentTabId): void {
  activeContentTab.value = tabId
  if (!import.meta.client) return
  requestAnimationFrame(() => scrollActiveTabIntoView())
}

const patchOptions = computed<PatchIndexEntry[]>(() => availablePatches.value)

watch(visibleModes, modes => {
  if (modes.length === 0) return
  if (!modes.some(mode => mode.id === activeMode.value)) {
    activeMode.value = modes.find(mode => mode.id === 'rift')?.id ?? modes[0].id
  }
})

watch(
  [visibleContentTabs, summaryImageUrl],
  () => {
    const tabs = visibleContentTabs.value
    if (tabs.length === 0) return
    if (!tabs.some(tab => tab.id === activeContentTab.value)) {
      activeContentTab.value = defaultPatchContentTab(
        allPatchEntities.value,
        activeMode.value,
        Boolean(summaryImageUrl.value)
      )
    }
  },
  { immediate: true }
)

watch(activeMode, mode => {
  const tabs = visiblePatchContentTabs(allPatchEntities.value, mode, Boolean(summaryImageUrl.value))
  if (tabs.length > 0 && !tabs.includes(activeContentTab.value)) {
    activeContentTab.value = tabs[0]
  }
  activeTagFilter.value = 'all'
})

watch(activeContentTab, () => {
  if (!import.meta.client) return
  requestAnimationFrame(() => scrollActiveTabIntoView('auto'))
})

watch(availableTagFilters, filters => {
  if (activeTagFilter.value === 'all') return
  if (!filters.some(filter => filter.id === activeTagFilter.value)) {
    activeTagFilter.value = 'all'
  }
})

const seoPatchVersion = computed(() => routeVersion.value || currentPatchVersion.value || '')

const patchNotesCanonicalPath = computed(() =>
  seoPatchVersion.value ? `/patch-notes/${seoPatchVersion.value}` : '/patch-notes'
)

const patchNotesSeoDescription = computed(() => {
  const version = seoPatchVersion.value
  if (!version) {
    return t('patchNotesPage.metaDescription', { version: fallbackGameVersion })
  }
  const list = entitiesForPatchModeTab(allPatchEntities.value, 'rift', 'champions')
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

<style>
.patch-notes-title {
  color: var(--color-gold-300);
}

/* width/overflow scroll rules in app.vue */
.patch-notes-tabs-scroll-wrap::before,
.patch-notes-tabs-scroll-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 8px;
  width: 28px;
  z-index: 2;
  pointer-events: none;
}
.patch-notes-tabs-scroll-wrap::before {
  left: 0;
  background: linear-gradient(to right, rgb(8 16 31 / 0.95), transparent);
}
.patch-notes-tabs-scroll-wrap::after {
  right: 0;
  background: linear-gradient(to left, rgb(8 16 31 / 0.95), transparent);
}
@media (max-width: 767px) {
  .patch-notes-tab-btn {
    font-size: 13px;
    padding-left: 12px;
    padding-right: 12px;
  }
}
</style>
