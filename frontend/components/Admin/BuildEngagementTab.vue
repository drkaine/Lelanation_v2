<template>
  <div class="space-y-6">
    <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-text">{{ t('admin.buildEngagement.title') }}</h2>
          <p class="mt-1 text-xs text-text/70">{{ t('admin.buildEngagement.subtitle') }}</p>
        </div>
        <button
          type="button"
          class="rounded border border-primary/50 bg-surface px-3 py-2 text-sm text-text transition-colors hover:bg-primary/20"
          :disabled="loading"
          @click="loadRecap"
        >
          {{ loading ? t('admin.loading') : t('admin.buildEngagement.refresh') }}
        </button>
      </div>

      <p v-if="loading" class="text-text/70">{{ t('admin.loading') }}</p>
      <p v-else-if="error" class="text-sm text-error">{{ error }}</p>
      <template v-else-if="recap">
        <div
          class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-10"
        >
          <div
            v-for="card in summaryCards"
            :key="card.label"
            class="rounded border border-primary/20 bg-background/30 p-3"
          >
            <div class="text-xl font-bold text-text">{{ card.value }}</div>
            <div class="text-xs text-text/70">{{ card.label }}</div>
          </div>
        </div>

        <div class="w-full overflow-x-auto rounded border border-primary/20">
          <table class="w-full min-w-full table-auto text-left text-sm">
            <thead class="border-b border-primary/20 bg-background/40 text-text/80">
              <tr>
                <th
                  v-for="col in sortColumns"
                  :key="col.key"
                  class="px-3 py-2 font-semibold"
                  :class="col.align === 'right' ? 'text-right' : 'text-left'"
                >
                  <button
                    type="button"
                    class="inline-flex w-full items-center gap-0.5 hover:text-text"
                    :class="col.align === 'right' ? 'justify-end' : 'justify-start'"
                    @click="toggleSort(col.key)"
                  >
                    {{ col.label }}
                    <span class="text-xs text-text/50">{{ sortIcon(col.key) }}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="sortedRows.length === 0">
                <td colspan="16" class="px-3 py-6 text-center text-text/60">
                  {{ t('admin.buildEngagement.empty') }}
                </td>
              </tr>
              <tr
                v-for="row in sortedRows"
                :key="row.buildId"
                class="border-b border-primary/10 hover:bg-background/20"
              >
                <td class="px-3 py-2 text-text">{{ row.author }}</td>
                <td class="px-3 py-2">
                  <NuxtLink
                    :to="localePath(`/builds/${row.buildId}`)"
                    class="font-medium text-accent hover:underline"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ row.name }}
                  </NuxtLink>
                </td>
                <td class="px-3 py-2 text-text/80">{{ row.championName ?? '—' }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ formatInt(row.views) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ formatInt(row.shares.link) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ formatInt(row.shares.image) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">
                  {{ formatInt(row.shares.image_with_meta) }}
                </td>
                <td class="px-3 py-2 text-right font-medium tabular-nums">
                  {{ formatInt(row.sharesTotal) }}
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-success">
                  {{ formatInt(row.upvotes) }}
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-error">
                  {{ formatInt(row.downvotes) }}
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-accent">
                  {{ formatInt(row.imports) }}
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-warning">
                  {{ formatInt(row.favorites) }}
                </td>
                <td class="px-3 py-2 text-xs text-text/70">{{ formatDate(row.lastViewedAt) }}</td>
                <td class="px-3 py-2 text-xs text-text/70">{{ formatDate(row.lastSharedAt) }}</td>
                <td class="px-3 py-2 text-xs text-text/70">{{ formatDate(row.lastImportedAt) }}</td>
                <td class="px-3 py-2 text-xs text-text/70">
                  {{ formatDate(row.lastFavoritedAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { apiUrl } from '~/utils/apiUrl'

type BuildEngagementRow = {
  buildId: string
  name: string
  author: string
  championName: string | null
  views: number
  shares: { link: number; image: number; image_with_meta: number }
  sharesTotal: number
  upvotes: number
  downvotes: number
  imports: number
  favorites: number
  lastViewedAt: string | null
  lastSharedAt: string | null
  lastImportedAt: string | null
  lastFavoritedAt: string | null
}

type BuildEngagementRecap = {
  totals: {
    builds: number
    views: number
    sharesLink: number
    sharesImage: number
    sharesImageWithMeta: number
    sharesTotal: number
    upvotes: number
    downvotes: number
    imports: number
    favorites: number
  }
  rows: BuildEngagementRow[]
}

type SortKey =
  | 'author'
  | 'name'
  | 'championName'
  | 'views'
  | 'shareLink'
  | 'shareImage'
  | 'shareImageMeta'
  | 'sharesTotal'
  | 'upvotes'
  | 'downvotes'
  | 'imports'
  | 'favorites'
  | 'lastViewedAt'
  | 'lastSharedAt'
  | 'lastImportedAt'
  | 'lastFavoritedAt'

type SortDir = 'asc' | 'desc'

const { t } = useI18n()
const { fetchWithAuth, clearAuth } = useAdminAuth()
const localePath = useLocalePath()

const loading = ref(false)
const error = ref<string | null>(null)
const recap = ref<BuildEngagementRecap | null>(null)
const sortBy = ref<SortKey>('views')
const sortDir = ref<SortDir>('desc')

const sortColumns = computed(() => [
  { key: 'author' as const, label: t('admin.buildEngagement.colAuthor'), align: 'left' as const },
  { key: 'name' as const, label: t('admin.buildEngagement.colBuild'), align: 'left' as const },
  {
    key: 'championName' as const,
    label: t('admin.buildEngagement.colChampion'),
    align: 'left' as const,
  },
  { key: 'views' as const, label: t('admin.buildEngagement.colViews'), align: 'right' as const },
  {
    key: 'shareLink' as const,
    label: t('admin.buildEngagement.colShareLink'),
    align: 'right' as const,
  },
  {
    key: 'shareImage' as const,
    label: t('admin.buildEngagement.colShareImage'),
    align: 'right' as const,
  },
  {
    key: 'shareImageMeta' as const,
    label: t('admin.buildEngagement.colShareImageMeta'),
    align: 'right' as const,
  },
  {
    key: 'sharesTotal' as const,
    label: t('admin.buildEngagement.colSharesTotal'),
    align: 'right' as const,
  },
  {
    key: 'upvotes' as const,
    label: t('admin.buildEngagement.colUpvotes'),
    align: 'right' as const,
  },
  {
    key: 'downvotes' as const,
    label: t('admin.buildEngagement.colDownvotes'),
    align: 'right' as const,
  },
  {
    key: 'imports' as const,
    label: t('admin.buildEngagement.colImports'),
    align: 'right' as const,
  },
  {
    key: 'favorites' as const,
    label: t('admin.buildEngagement.colFavorites'),
    align: 'right' as const,
  },
  {
    key: 'lastViewedAt' as const,
    label: t('admin.buildEngagement.colLastView'),
    align: 'left' as const,
  },
  {
    key: 'lastSharedAt' as const,
    label: t('admin.buildEngagement.colLastShare'),
    align: 'left' as const,
  },
  {
    key: 'lastImportedAt' as const,
    label: t('admin.buildEngagement.colLastImport'),
    align: 'left' as const,
  },
  {
    key: 'lastFavoritedAt' as const,
    label: t('admin.buildEngagement.colLastFavorite'),
    align: 'left' as const,
  },
])

function formatInt(value: number): string {
  return value.toLocaleString('fr-FR')
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dateSortValue(iso: string | null): number {
  if (!iso) return Number.NEGATIVE_INFINITY
  const time = new Date(iso).getTime()
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY
}

function compareText(a: string, b: string, dir: SortDir): number {
  const cmp = a.localeCompare(b, 'fr', { sensitivity: 'base' })
  return dir === 'asc' ? cmp : -cmp
}

function compareNumber(a: number, b: number, dir: SortDir): number {
  return dir === 'asc' ? a - b : b - a
}

function toggleSort(key: SortKey) {
  if (sortBy.value !== key) {
    sortBy.value = key
    sortDir.value = key === 'author' || key === 'name' || key === 'championName' ? 'asc' : 'desc'
    return
  }
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
}

function sortIcon(key: SortKey): string {
  if (sortBy.value !== key) return '↕'
  return sortDir.value === 'asc' ? '▲' : '▼'
}

const sortedRows = computed(() => {
  const rows = recap.value?.rows ?? []
  if (rows.length <= 1) return rows

  const key = sortBy.value
  const dir = sortDir.value
  return [...rows].sort((a, b) => {
    if (key === 'author') return compareText(a.author, b.author, dir)
    if (key === 'name') return compareText(a.name, b.name, dir)
    if (key === 'championName') {
      return compareText(a.championName ?? '', b.championName ?? '', dir)
    }
    if (key === 'views') return compareNumber(a.views, b.views, dir)
    if (key === 'shareLink') return compareNumber(a.shares.link, b.shares.link, dir)
    if (key === 'shareImage') return compareNumber(a.shares.image, b.shares.image, dir)
    if (key === 'shareImageMeta') {
      return compareNumber(a.shares.image_with_meta, b.shares.image_with_meta, dir)
    }
    if (key === 'sharesTotal') return compareNumber(a.sharesTotal, b.sharesTotal, dir)
    if (key === 'upvotes') return compareNumber(a.upvotes, b.upvotes, dir)
    if (key === 'downvotes') return compareNumber(a.downvotes, b.downvotes, dir)
    if (key === 'imports') return compareNumber(a.imports, b.imports, dir)
    if (key === 'favorites') return compareNumber(a.favorites, b.favorites, dir)
    if (key === 'lastViewedAt') {
      return compareNumber(dateSortValue(a.lastViewedAt), dateSortValue(b.lastViewedAt), dir)
    }
    if (key === 'lastSharedAt') {
      return compareNumber(dateSortValue(a.lastSharedAt), dateSortValue(b.lastSharedAt), dir)
    }
    if (key === 'lastImportedAt') {
      return compareNumber(dateSortValue(a.lastImportedAt), dateSortValue(b.lastImportedAt), dir)
    }
    return compareNumber(dateSortValue(a.lastFavoritedAt), dateSortValue(b.lastFavoritedAt), dir)
  })
})

const summaryCards = computed(() => {
  const totals = recap.value?.totals
  if (!totals) return []
  return [
    { label: t('admin.buildEngagement.totalBuilds'), value: formatInt(totals.builds) },
    { label: t('admin.buildEngagement.totalViews'), value: formatInt(totals.views) },
    { label: t('admin.buildEngagement.totalShareLink'), value: formatInt(totals.sharesLink) },
    { label: t('admin.buildEngagement.totalShareImage'), value: formatInt(totals.sharesImage) },
    {
      label: t('admin.buildEngagement.totalShareImageMeta'),
      value: formatInt(totals.sharesImageWithMeta),
    },
    { label: t('admin.buildEngagement.totalShares'), value: formatInt(totals.sharesTotal) },
    { label: t('admin.buildEngagement.totalUpvotes'), value: formatInt(totals.upvotes) },
    { label: t('admin.buildEngagement.totalDownvotes'), value: formatInt(totals.downvotes) },
    { label: t('admin.buildEngagement.totalImports'), value: formatInt(totals.imports) },
    { label: t('admin.buildEngagement.totalFavorites'), value: formatInt(totals.favorites) },
  ]
})

async function loadRecap() {
  loading.value = true
  error.value = null
  try {
    const res = await fetchWithAuth(apiUrl('/api/admin/build-engagement-recap'))
    if (res.status === 401) {
      clearAuth()
      await navigateTo(localePath('/admin/login'))
      return
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      error.value = body?.error ?? t('admin.buildEngagement.loadError')
      recap.value = null
      return
    }
    recap.value = (await res.json()) as BuildEngagementRecap
  } catch {
    error.value = t('admin.buildEngagement.loadError')
    recap.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadRecap().catch(() => undefined)
})

defineExpose({ loadRecap })
</script>
