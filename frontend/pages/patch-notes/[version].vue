<template>
  <div class="min-h-screen overflow-x-hidden bg-background text-text">
    <!-- Header -->
    <div class="border-b border-primary/20 bg-surface/30 px-4 py-3">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2">
        <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 class="text-base font-bold text-accent md:text-lg">
            {{ t('patchNotesPage.title', { version: currentPatchVersion }) }}
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
            class="w-full rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-sm text-text placeholder:text-text/40 focus:border-accent focus:outline-none"
          />
        </div>

        <div v-if="availablePatches.length > 0" class="shrink-0">
          <label class="sr-only" for="patch-version-select">{{
            t('patchNotesPage.selectPatch')
          }}</label>
          <select
            id="patch-version-select"
            :value="selectedVersion ?? currentPatchVersion"
            class="rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
            @change="onPatchChange"
          >
            <option v-for="patch in availablePatches" :key="patch.version" :value="patch.version">
              {{ formatPatchOption(patch.version) }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Category Tabs — horizontal scroll (comme stats) -->
    <div
      class="patch-notes-tabs-bar sticky top-0 z-30 flex w-full min-w-0 flex-shrink-0 items-start gap-2 overflow-x-hidden border-b border-primary/20 bg-background/95 px-4 pb-2 pt-2 backdrop-blur"
    >
      <div class="patch-notes-tabs-scroll-wrap relative min-w-0 flex-1 overflow-hidden">
        <div
          ref="tabsNavEl"
          role="tablist"
          :aria-label="t('patchNotesPage.title', { version: currentPatchVersion })"
          class="patch-notes-tabs-nav flex flex-nowrap gap-1 overflow-x-auto border-b border-primary/30 pb-2"
        >
          <button
            v-for="tab in visibleTabs"
            :id="`patch-notes-tab-${tab.id}`"
            :key="tab.id"
            type="button"
            role="tab"
            :data-tab-id="tab.id"
            :aria-selected="activeTab === tab.id"
            :tabindex="activeTab === tab.id ? 0 : -1"
            :class="[
              'patch-notes-tab-btn flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border border-accent/50 bg-accent/20 text-accent'
                : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text',
            ]"
            @click="selectTab(tab.id)"
          >
            <span>{{ tab.label }}</span>
            <span
              v-if="tab.count > 0"
              :class="[
                'rounded-full px-1.5 py-0.5 text-[10px]',
                activeTab === tab.id ? 'bg-accent/30 text-accent' : 'bg-primary/20 text-text/60',
              ]"
            >
              {{ tab.count }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Content - reduced padding for more cards per row -->
    <div
      class="mx-auto max-w-full px-2 md:px-4 lg:px-6"
      :class="activeTab === 'summary' && !isSearchActive ? 'py-1' : 'py-4'"
    >
      <!-- Loading State -->
      <div
        v-if="status === 'loading'"
        class="flex flex-col items-center justify-center gap-4 py-12"
      >
        <div
          class="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-accent"
        />
        <p class="text-text/70">{{ t('patchNotesPage.loading') }}</p>
      </div>

      <!-- Error State -->
      <div
        v-else-if="status === 'error'"
        class="flex flex-col items-center justify-center gap-4 py-12"
      >
        <p class="text-error">{{ error || t('patchNotesPage.error') }}</p>
        <button
          type="button"
          class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent/90"
          @click="retryLoad"
        >
          {{ t('patchNotesPage.retry') }}
        </button>
      </div>

      <!-- Summary Tab Content - fit viewport without scroll -->
      <div
        v-else-if="activeTab === 'summary' && !isSearchActive"
        class="flex flex-col items-center"
      >
        <div
          v-if="summaryImageUrl"
          class="flex w-full cursor-pointer flex-col items-center justify-center"
          style="height: calc(100dvh - 14rem)"
          @click="isLightboxOpen = true"
        >
          <img
            :src="summaryImageUrl"
            :alt="t('patchNotesPage.summaryImageAlt', { version: currentPatchVersion })"
            class="max-h-full max-w-full rounded-lg object-contain transition-opacity hover:opacity-90"
          />
          <p class="mt-1 shrink-0 text-center text-xs text-text/50">
            {{ t('patchNotesPage.clickToZoom') }}
          </p>
        </div>
        <div v-else class="py-12 text-text/70">
          {{ t('patchNotesPage.noSummaryImage') }}
        </div>
      </div>

      <!-- Entity Cards Grid - tighter spacing, more cards per row -->
      <div
        v-else-if="filteredEntities.length > 0"
        class="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        <PatchEntityCard
          v-for="(entity, idx) in filteredEntities"
          :key="entity.patchSlug || entity.name || idx"
          :entity="entity"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center gap-4 py-12 text-text/70">
        <p v-if="isSearchActive">
          {{ t('patchNotesPage.noSearchResults', { query: searchQuery.trim() }) }}
        </p>
        <p v-else>{{ t('patchNotesPage.noChanges', { category: activeTabLabel }) }}</p>
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
import { usePatchNotesStore, type PatchEntity } from '~/stores/PatchNotesStore'
import PatchEntityCard from '~/components/PatchEntityCard.vue'
import PatchImageLightbox from '~/components/PatchImageLightbox.vue'
import { articleJsonLd } from '~/utils/jsonLd'
import { useJsonLdHead } from '~/composables/useJsonLdHead'
import { useSiteUrl } from '~/composables/useSiteUrl'

definePageMeta({
  validate(route) {
    const version = String(route.params.version ?? '')
    return version.length > 0 && !version.startsWith('_')
  },
})

const { t, locale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const patchNotesStore = usePatchNotesStore()
const runtimeConfig = useRuntimeConfig()
const siteUrl = useSiteUrl()
const fallbackGameVersion = String(runtimeConfig.public.fallbackGameVersion ?? '16.12')

// Use storeToRefs for reactive state extraction
const {
  status,
  error,
  currentPatch,
  selectedVersion,
  latestVersion,
  availablePatches,
  getSummaryImagePath,
  champions,
  items,
  runes,
  systems,
  aram,
  aramChaos,
  arena,
  bugfix,
} = storeToRefs(patchNotesStore)

type PatchNotesTabId =
  | 'summary'
  | 'champions'
  | 'items'
  | 'runes'
  | 'systems'
  | 'aram'
  | 'aram-chaos'
  | 'arena'
  | 'bugfix'

const activeTab = ref<PatchNotesTabId>('summary')
const isLightboxOpen = ref(false)
const searchQuery = ref('')
const tabsNavEl = ref<HTMLElement | null>(null)
useHorizontalScrollContainer(tabsNavEl)

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)

const currentPatchVersion = computed(() => currentPatch.value?.patchVersion ?? '')
const currentPatchDate = computed(() => currentPatch.value?.scrapedAt)

const summaryImageUrl = computed(() => getSummaryImagePath.value)

const tabs = computed(() => [
  {
    id: 'summary' as const,
    label: t('patchNotesPage.categories.summary'),
    icon: '📋',
    count: 0,
  },
  {
    id: 'champions' as const,
    label: t('patchNotesPage.categories.champions'),
    icon: '🏆',
    count: champions.value.length,
  },
  {
    id: 'items' as const,
    label: t('patchNotesPage.categories.items'),
    icon: '🛡️',
    count: items.value.length,
  },
  {
    id: 'runes' as const,
    label: t('patchNotesPage.categories.runes'),
    icon: '✨',
    count: runes.value.length,
  },
  {
    id: 'systems' as const,
    label: t('patchNotesPage.categories.systems'),
    icon: '⚙️',
    count: systems.value.length,
  },
  {
    id: 'aram' as const,
    label: t('patchNotesPage.categories.aram'),
    icon: '🎲',
    count: aram.value.length,
  },
  {
    id: 'aram-chaos' as const,
    label: t('patchNotesPage.categories.aramChaos'),
    icon: '🌀',
    count: aramChaos.value.length,
  },
  {
    id: 'arena' as const,
    label: t('patchNotesPage.categories.arena'),
    icon: '🏟️',
    count: arena.value.length,
  },
  {
    id: 'bugfix' as const,
    label: t('patchNotesPage.categories.bugfix'),
    icon: '🐛',
    count: bugfix.value.length,
  },
])

const visibleTabs = computed(() =>
  tabs.value.filter(tab => {
    if (tab.id === 'summary') return Boolean(summaryImageUrl.value)
    return tab.count > 0
  })
)

const activeTabLabel = computed(() => {
  return visibleTabs.value.find(t => t.id === activeTab.value)?.label ?? ''
})

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .trim()
}

const tabEntities = computed<PatchEntity[]>(() => {
  switch (activeTab.value) {
    case 'champions':
      return champions.value
    case 'items':
      return items.value
    case 'runes':
      return runes.value
    case 'systems':
      return systems.value
    case 'aram':
      return aram.value
    case 'aram-chaos':
      return aramChaos.value
    case 'arena':
      return arena.value
    case 'bugfix':
      return bugfix.value
    case 'summary':
    default:
      return []
  }
})

const filteredEntities = computed<PatchEntity[]>(() => {
  const query = normalizeSearch(searchQuery.value)
  if (!query) return tabEntities.value

  const entities = currentPatch.value?.entities ?? []
  return entities.filter(entity => {
    const name = entity.name?.trim()
    if (!name) return false
    const changeLabels = entity.changes.map(c => c.subCategory ?? '').join(' ')
    const haystack = [name, entity.subCategory ?? '', changeLabels].map(normalizeSearch).join(' ')
    return haystack.includes(query)
  })
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

const routeVersion = computed(() => String(route.params.version ?? '').trim())

function retryLoad() {
  const version = routeVersion.value || selectedVersion.value || latestVersion.value
  if (version) {
    patchNotesStore.loadPatch(version, locale.value)
  } else {
    patchNotesStore.loadLatestPatch(locale.value)
  }
}

function onPatchChange(event: Event) {
  const version = (event.target as HTMLSelectElement).value
  searchQuery.value = ''
  navigateTo(localePath(`/patch-notes/${version}`))
}

function scrollActiveTabIntoView(behavior: ScrollBehavior = 'smooth'): void {
  if (!import.meta.client || !tabsNavEl.value) return
  const el = tabsNavEl.value.querySelector<HTMLButtonElement>(
    `button[data-tab-id="${activeTab.value}"]`
  )
  el?.scrollIntoView({ inline: 'start', block: 'nearest', behavior })
}

function selectTab(tabId: PatchNotesTabId): void {
  activeTab.value = tabId
  if (!import.meta.client) return
  requestAnimationFrame(() => scrollActiveTabIntoView())
}

// Load patch on mount
await useAsyncData(
  () => `patch-notes-${locale.value}-${routeVersion.value}`,
  async () => {
    await patchNotesStore.loadIndex()
    const version = routeVersion.value || patchNotesStore.latestVersion
    if (!version) return ''
    await patchNotesStore.loadPatch(version, locale.value)
    patchNotesStore.selectPatch(version, locale.value)
    return version
  },
  { watch: [locale, routeVersion] }
)

onMounted(() => {
  if (!currentPatch.value && routeVersion.value) {
    patchNotesStore.loadPatch(routeVersion.value, locale.value)
  }
})

// Watch locale changes
watch(locale, () => {
  searchQuery.value = ''
  const version = routeVersion.value || latestVersion.value
  if (version) {
    patchNotesStore.loadPatch(version, locale.value)
  }
})

watch(visibleTabs, tabs => {
  if (tabs.length === 0) return
  if (!tabs.some(tab => tab.id === activeTab.value)) {
    activeTab.value = tabs[0].id
  }
})

watch(activeTab, () => {
  if (!import.meta.client) return
  requestAnimationFrame(() => scrollActiveTabIntoView('auto'))
})

const seoPatchVersion = computed(
  () => routeVersion.value || currentPatchVersion.value || latestVersion.value || ''
)

const patchNotesCanonicalPath = computed(() =>
  seoPatchVersion.value ? `/patch-notes/${seoPatchVersion.value}` : '/patch-notes'
)

useSeoMeta({
  title: () =>
    seoPatchVersion.value
      ? t('patchNotesPage.metaTitle', { version: seoPatchVersion.value })
      : t('patchNotesPage.metaTitleFallback'),
  description: () =>
    seoPatchVersion.value
      ? t('patchNotesPage.metaDescription', { version: seoPatchVersion.value })
      : t('patchNotesPage.metaDescription', { version: fallbackGameVersion }),
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
      description: t('patchNotesPage.metaDescription', { version }),
      datePublished: currentPatchDate.value,
      dateModified: currentPatchDate.value,
    })
  })
)
</script>

<style>
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
