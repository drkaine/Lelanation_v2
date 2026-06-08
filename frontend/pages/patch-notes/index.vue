<template>
  <div class="min-h-screen bg-background text-text">
    <!-- Header -->
    <div class="border-b border-primary/20 bg-surface/30 px-4 py-4">
      <div class="mx-auto max-w-7xl">
        <div class="flex flex-col items-start gap-2">
          <h1 class="text-2xl font-bold md:text-3xl lg:text-4xl">
            {{ t('patchNotesPage.title', { version: currentPatchVersion }) }}
          </h1>
          <p v-if="currentPatchDate" class="text-sm text-text/70">
            {{ t('patchNotesPage.publishedAt', { date: formatDate(currentPatchDate) }) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="sticky top-0 z-30 border-b border-primary/20 bg-background/95 backdrop-blur">
      <div class="mx-auto max-w-7xl px-4">
        <div class="scrollbar-hide flex gap-1 overflow-x-auto py-2">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            :class="[
              'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-accent text-background'
                : 'text-text/70 hover:bg-primary/10 hover:text-text',
            ]"
            @click="activeTab = tab.id"
          >
            <span v-if="tab.icon" class="text-lg">{{ tab.icon }}</span>
            {{ tab.label }}
            <span
              v-if="tab.count > 0"
              :class="[
                'ml-1 rounded-full px-2 py-0.5 text-xs',
                activeTab === tab.id
                  ? 'bg-background/20 text-background'
                  : 'bg-primary/20 text-text',
              ]"
            >
              {{ tab.count }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="mx-auto max-w-7xl px-4 py-6">
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

      <!-- Summary Tab Content -->
      <div v-else-if="activeTab === 'summary'" class="flex flex-col items-center">
        <div v-if="summaryImageUrl" class="w-full">
          <img
            :src="summaryImageUrl"
            :alt="t('patchNotesPage.summaryImageAlt', { version: currentPatchVersion })"
            class="w-full rounded-lg"
          />
        </div>
        <div v-else class="py-12 text-text/70">
          {{ t('patchNotesPage.noSummaryImage') }}
        </div>
      </div>

      <!-- Entity Cards Grid -->
      <div v-else-if="filteredEntities.length > 0" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PatchEntityCard
          v-for="(entity, idx) in filteredEntities"
          :key="entity.patchSlug || entity.name || idx"
          :entity="entity"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center gap-4 py-12 text-text/70">
        <p>{{ t('patchNotesPage.noChanges', { category: activeTabLabel }) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { usePatchNotesStore, type PatchEntity } from '~/stores/PatchNotesStore'
import PatchEntityCard from '~/components/PatchEntityCard.vue'

const { t, locale } = useI18n()
const patchNotesStore = usePatchNotesStore()

// Use storeToRefs for reactive state extraction
const { status, error, currentPatch, champions, items, runes, systems } =
  storeToRefs(patchNotesStore)

const activeTab = ref<'summary' | 'champions' | 'items' | 'runes' | 'systems'>('summary')

const currentPatchVersion = computed(() => currentPatch.value?.patchVersion ?? '')
const currentPatchDate = computed(() => currentPatch.value?.scrapedAt)

const summaryImageUrl = computed(() => {
  if (!currentPatch.value?.summaryImage) return null
  const localPath = currentPatch.value.summaryImage.localPath
  if (localPath) {
    return localPath.replace(/^data\/patches\//, '/data/patch-notes/')
  }
  return currentPatch.value.summaryImage.url
})

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
])

const activeTabLabel = computed(() => {
  return tabs.value.find(t => t.id === activeTab.value)?.label ?? ''
})

const filteredEntities = computed<PatchEntity[]>(() => {
  switch (activeTab.value) {
    case 'champions':
      return champions.value
    case 'items':
      return items.value
    case 'runes':
      return runes.value
    case 'systems':
      return systems.value
    case 'summary':
    default:
      return []
  }
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function retryLoad() {
  patchNotesStore.loadLatestPatch(locale.value)
}

// Load patch on mount
onMounted(() => {
  patchNotesStore.loadLatestPatch(locale.value)
})

// Watch locale changes
watch(locale, () => {
  patchNotesStore.loadLatestPatch(locale.value)
})

useHead(() => ({
  title: t('patchNotesPage.metaTitle', { version: currentPatchVersion.value }),
  meta: [
    {
      name: 'description',
      content: t('patchNotesPage.metaDescription', { version: currentPatchVersion.value }),
    },
  ],
}))
</script>
