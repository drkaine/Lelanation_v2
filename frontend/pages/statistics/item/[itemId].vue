<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useItemsStore } from '~/stores/ItemsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { apiUrl } from '~/utils/apiUrl'
import { getItemImageUrl } from '~/utils/imageUrl'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'
import {
  formatItemGoldEfficiency,
  getItemGoldEfficiency,
  getItemGoldValue,
} from '~/utils/formatItemStats'
import type { DailyTrendSnapshotPoint } from '~/composables/statistics/useStatisticsDailyTrendCharts'
import type { ItemPurchaseOrderStats } from '~/components/statistics/StatisticsItemPurchaseTab.vue'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const itemsStore = useItemsStore()
const versionStore = useVersionStore()
const statisticsUiStore = useStatisticsUiStore()
const { filtersOpen } = storeToRefs(statisticsUiStore)
const { effectiveFiltersSheetMode, showDesktopFiltersTrigger, filtersFabClass } =
  useStatisticsFiltersSheetMode()

const { currentVersion: gameVersion } = storeToRefs(versionStore)

const itemId = computed(() => {
  const raw = route.params.itemId
  const n = parseInt(Array.isArray(raw) ? raw[0]! : String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : NaN
})

const item = computed(() => itemsStore.items.find(i => Number(i.id) === itemId.value) ?? null)
const itemImageSrc = computed(() => {
  const version = gameVersion.value
  const full = item.value?.image?.full
  if (!version || !full) return null
  return getItemImageUrl(version, full)
})

const filterRank = ref<string[]>([])
const filterRole = ref('')
const trendChartFromDate = ref('')
const trendPending = ref(false)
const trendError = ref<string | null>(null)
const trendPoints = ref<DailyTrendSnapshotPoint[]>([])
const trendVersionsCatalog = ref<Array<{ patchLabel: string; releaseDate: string }>>([])
const breakdownPending = ref(false)
const breakdownError = ref<string | null>(null)
const breakdown = ref<ItemTierBreakdown | null>(null)
const purchasePending = ref(false)
const purchaseError = ref<string | null>(null)
const purchaseOrderStats = ref<ItemPurchaseOrderStats | null>(null)

const RANK_TIERS = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
] as const

const roleOptions = [
  { value: 'TOP', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'JUNGLE', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'MIDDLE', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'BOTTOM', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'SUPPORT', label: 'Support', icon: '/icons/roles/support.png' },
]

type ItemTabId = 'overview' | 'purchase'
const itemTabs = [
  { id: 'overview' as const, label: 'statisticsPage.championStatsTabOverview' },
  { id: 'purchase' as const, label: 'statisticsPage.itemStatsTabPurchase' },
]
const itemTabIds = new Set<ItemTabId>(itemTabs.map(t => t.id))
function normalizeItemTab(input: unknown): ItemTabId {
  const raw = Array.isArray(input) ? input[0] : input
  const val = String(raw ?? '').trim() as ItemTabId
  return itemTabIds.has(val) ? val : 'overview'
}
const activeItemTab = ref<ItemTabId>(normalizeItemTab(route.query.tab))
const itemTabsNavEl = ref<HTMLElement | null>(null)
useHorizontalScrollContainer(itemTabsNavEl)

function scrollActiveItemTabIntoView(behavior: ScrollBehavior = 'smooth'): void {
  if (!import.meta.client || !itemTabsNavEl.value) return
  const el = itemTabsNavEl.value.querySelector<HTMLButtonElement>(
    `button[data-tab-id="${activeItemTab.value}"]`
  )
  el?.scrollIntoView({ inline: 'start', block: 'nearest', behavior })
}

const ITEM_HEADER_BAND_STORAGE_KEY = 'item-header-band-open'
const itemHeaderBandOpen = ref(true)

const goldValue = computed(() => getItemGoldValue(item.value ?? undefined))
const goldEfficiency = computed(() => getItemGoldEfficiency(item.value ?? undefined))

const activeItemFiltersCount = computed(() => {
  let count = 0
  if (filterRank.value.length > 0) count++
  if (filterRole.value) count++
  if (trendChartFromDate.value.trim()) count++
  return count
})

function formatPercent(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? Number(value).toFixed(2) : '—'
}

const itemHeaderKpis = computed(() => {
  if (trendPoints.value.length === 0) return null
  const latestDate = trendPoints.value.reduce(
    (max, p) => (p.dateOfGame > max ? p.dateOfGame : max),
    ''
  )
  if (!latestDate) return null
  const latest = trendPoints.value.filter(p => p.dateOfGame === latestDate)
  let games = 0
  let wins = 0
  let pickSum = 0
  let pickCount = 0
  for (const p of latest) {
    games += p.games
    wins += p.wins
    if (Number.isFinite(p.pickRatePct)) {
      pickSum += p.pickRatePct
      pickCount++
    }
  }
  return {
    pickrate: pickCount > 0 ? pickSum / pickCount : null,
    winrate: games > 0 ? (wins / games) * 100 : null,
  }
})

const itemHeaderCollapsedSummary = computed(() => {
  const kpis = itemHeaderKpis.value
  if (!kpis) return item.value?.name ?? ''
  return `${t('statisticsPage.pickrate')} ${formatPercent(kpis.pickrate)}% · ${t('statisticsPage.winrate')} ${formatPercent(kpis.winrate)}%`
})

function formatDivisionLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}

function toggleRankFilter(tier: string): void {
  const arr = filterRank.value
  const idx = arr.indexOf(tier)
  filterRank.value = idx >= 0 ? arr.filter((_, i) => i !== idx) : [...arr, tier]
}

function selectAllDivisions(): void {
  filterRank.value = []
}

function selectAllRoles(): void {
  filterRole.value = ''
}

function toggleRoleFilter(r: (typeof roleOptions)[number]): void {
  filterRole.value = filterRole.value === r.value ? '' : r.value
}

function resetItemFilters(): void {
  filterRank.value = []
  filterRole.value = ''
  trendChartFromDate.value = ''
}

function closeFilters(): void {
  statisticsUiStore.setFiltersOpen(false)
}

function openFilters(): void {
  statisticsUiStore.setFiltersOpen(true)
}

function toggleFiltersOpen(): void {
  if (filtersOpen.value) closeFilters()
  else openFilters()
}

function initItemHeaderBandOpen(): void {
  if (!import.meta.client) return
  const stored = sessionStorage.getItem(ITEM_HEADER_BAND_STORAGE_KEY)
  if (stored === '0' || stored === '1') {
    itemHeaderBandOpen.value = stored === '1'
    return
  }
  itemHeaderBandOpen.value = window.matchMedia('(min-width: 1024px)').matches
}

watch(itemHeaderBandOpen, open => {
  if (!import.meta.client) return
  sessionStorage.setItem(ITEM_HEADER_BAND_STORAGE_KEY, open ? '1' : '0')
})

watch([filtersOpen, effectiveFiltersSheetMode], () => {
  if (!import.meta.client) return
  const lock = effectiveFiltersSheetMode.value && filtersOpen.value
  document.body.style.overflow = lock ? 'hidden' : ''
})

function appendRankAndDateFilters(params: URLSearchParams): void {
  for (const tier of filterRank.value) {
    const normalized = String(tier || '')
      .trim()
      .toUpperCase()
      .split('_')[0]
    if (normalized) params.append('rankTier', normalized)
  }
  const from = trendChartFromDate.value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) params.set('from', from)
}

function buildItemStatsQueryParams(): URLSearchParams {
  const params = new URLSearchParams()
  if (filterRole.value) params.set('role', filterRole.value)
  appendRankAndDateFilters(params)
  return params
}

function buildItemPurchaseQueryParams(): URLSearchParams {
  const params = new URLSearchParams()
  appendRankAndDateFilters(params)
  return params
}

async function loadBreakdown(): Promise<void> {
  if (!Number.isFinite(itemId.value)) return
  breakdownPending.value = true
  breakdownError.value = null
  try {
    const query = buildItemStatsQueryParams().toString()
    const data = await $fetch<ItemTierBreakdown & { itemId?: number }>(
      apiUrl(`/api/stats/items/${itemId.value}/breakdown${query ? `?${query}` : ''}`)
    )
    breakdown.value = {
      roles: Array.isArray(data?.roles) ? data.roles : [],
      roleTrendPoints: Array.isArray(data?.roleTrendPoints) ? data.roleTrendPoints : [],
      purchaseTiming: Array.isArray(data?.purchaseTiming) ? data.purchaseTiming : [],
      overallAvgPurchaseMs: data?.overallAvgPurchaseMs ?? null,
    }
  } catch (e) {
    breakdown.value = null
    breakdownError.value = e instanceof Error ? e.message : String(e)
  } finally {
    breakdownPending.value = false
  }
}

async function loadPurchaseOrder(): Promise<void> {
  if (!Number.isFinite(itemId.value)) return
  purchasePending.value = true
  purchaseError.value = null
  try {
    const query = buildItemPurchaseQueryParams().toString()
    const data = await $fetch<ItemPurchaseOrderStats & { itemId?: number }>(
      apiUrl(`/api/stats/items/${itemId.value}/purchase-order${query ? `?${query}` : ''}`)
    )
    purchaseOrderStats.value = {
      byOrder: Array.isArray(data?.byOrder) ? data.byOrder : [],
      orderTrendPoints: Array.isArray(data?.orderTrendPoints) ? data.orderTrendPoints : [],
      orderDivisionTrendPoints: Array.isArray(data?.orderDivisionTrendPoints)
        ? data.orderDivisionTrendPoints
        : [],
      timingTrendPoints: Array.isArray(data?.timingTrendPoints) ? data.timingTrendPoints : [],
      purchaseTiming: Array.isArray(data?.purchaseTiming) ? data.purchaseTiming : [],
      overallAvgPurchaseMs: data?.overallAvgPurchaseMs ?? null,
    }
  } catch (e) {
    purchaseOrderStats.value = null
    purchaseError.value = e instanceof Error ? e.message : String(e)
  } finally {
    purchasePending.value = false
  }
}

async function loadTrendSnapshots(): Promise<void> {
  if (!Number.isFinite(itemId.value)) return
  trendPending.value = true
  trendError.value = null
  try {
    const params = buildItemStatsQueryParams()
    params.set('limit', '1200')
    const query = params.toString()
    const data = await $fetch<{ points?: DailyTrendSnapshotPoint[] }>(
      apiUrl(`/api/stats/items/${itemId.value}/tier-trend-snapshots${query ? `?${query}` : ''}`)
    )
    trendPoints.value = Array.isArray(data?.points) ? data.points : []
  } catch (e) {
    trendPoints.value = []
    trendError.value = e instanceof Error ? e.message : String(e)
  } finally {
    trendPending.value = false
  }
}

async function loadVersionsCatalog(): Promise<void> {
  try {
    const res = await fetch('/data/patch-notes/index.json')
    if (!res.ok) return
    const idx = (await res.json()) as { patches?: Array<{ version?: string; date?: string }> }
    trendVersionsCatalog.value = (idx.patches ?? [])
      .map(p => ({
        patchLabel: String(p.version ?? '').trim(),
        releaseDate: String(p.date ?? '')
          .trim()
          .slice(0, 10),
      }))
      .filter(p => p.patchLabel && p.releaseDate)
      .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
  } catch {
    trendVersionsCatalog.value = []
  }
}

watch([itemId, filterRank, filterRole, trendChartFromDate], () => {
  loadTrendSnapshots()
  if (activeItemTab.value === 'overview') loadBreakdown()
  else if (activeItemTab.value === 'purchase') loadPurchaseOrder()
})

if (import.meta.client) {
  watch(
    () => route.query.tab,
    tabRaw => {
      const tab = normalizeItemTab(tabRaw)
      if (activeItemTab.value !== tab) activeItemTab.value = tab
    },
    { immediate: true }
  )
  watch(activeItemTab, async tab => {
    scrollActiveItemTabIntoView()
    if (tab === 'purchase') loadPurchaseOrder().catch(() => undefined)
    else if (tab === 'overview') loadBreakdown().catch(() => undefined)
    const current = normalizeItemTab(route.query.tab)
    if (current === tab) return
    await router.replace({
      query: {
        ...route.query,
        tab,
      },
    })
  })
}

useHead({
  title: () =>
    item.value?.name
      ? `${item.value.name} — ${t('statisticsPage.itemStatsTitle')}`
      : t('statisticsPage.itemStatsTitle'),
})

onMounted(async () => {
  initItemHeaderBandOpen()
  if (!versionStore.currentVersion) await versionStore.loadCurrentVersion()
  const riotLocale = locale.value === 'fr' ? 'fr_FR' : 'en_US'
  await itemsStore.loadItems(riotLocale)
  await loadVersionsCatalog()
  await loadTrendSnapshots()
  if (activeItemTab.value === 'purchase') await loadPurchaseOrder()
  else await loadBreakdown()
  nextTick(() => scrollActiveItemTabIntoView('auto'))
})

onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <div
    class="item-stats flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-background text-text"
  >
    <div class="w-full flex-shrink-0 px-4 pb-2 pt-4 max-lg:px-3">
      <div
        class="statistics-tabs-bar item-tabs-bar flex w-full min-w-0 items-start gap-2 overflow-x-hidden bg-surface/30"
      >
        <div class="statistics-tabs-scroll-wrap relative min-w-0 flex-1 overflow-hidden">
          <nav
            ref="itemTabsNavEl"
            role="tablist"
            :aria-label="t('statisticsPage.itemStatsTitle')"
            class="statistics-tabs-nav item-tabs-nav flex flex-nowrap gap-1 overflow-x-auto border-b border-primary/30 pb-2"
          >
            <button
              v-for="tab in itemTabs"
              :id="`item-tab-${tab.id}`"
              :key="tab.id"
              type="button"
              role="tab"
              :data-tab-id="tab.id"
              :aria-selected="activeItemTab === tab.id"
              :tabindex="activeItemTab === tab.id ? 0 : -1"
              :class="[
                'statistics-tab-btn item-tab-btn shrink-0 snap-start whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors',
                activeItemTab === tab.id
                  ? 'border border-accent/50 bg-accent/20 text-accent'
                  : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text',
              ]"
              @click="activeItemTab = tab.id"
            >
              {{ t(tab.label) }}
            </button>
          </nav>
        </div>
      </div>
    </div>

    <div class="flex min-h-0 w-full min-w-0 flex-1">
      <button
        v-if="showDesktopFiltersTrigger"
        type="button"
        class="statistics-filters-desktop-trigger hidden shrink-0 touch-manipulation lg:sticky lg:top-4 lg:z-20 lg:mr-2 lg:flex lg:flex-col lg:items-center lg:gap-1 lg:self-start"
        :aria-label="
          filtersOpen ? t('statisticsPage.closeFilters') : t('statisticsPage.openFilters')
        "
        :aria-expanded="filtersOpen"
        @click="toggleFiltersOpen"
      >
        <span class="filters-collapse-floating inline-flex" aria-hidden="true">
          <svg
            class="h-2 w-2 transition-transform duration-200"
            :class="filtersOpen ? 'rotate-180' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </span>
        <span
          class="max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight text-text/85"
        >
          {{ t('statisticsPage.filtersTitle') }}
        </span>
        <span
          v-if="activeItemFiltersCount > 0"
          class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
        >
          {{ activeItemFiltersCount }}
        </span>
      </button>

      <div
        v-if="filtersOpen && effectiveFiltersSheetMode"
        class="fixed inset-0 z-[10050] bg-black/50"
        aria-hidden="true"
        role="presentation"
        @click="closeFilters"
      />

      <aside
        v-show="filtersOpen || !effectiveFiltersSheetMode"
        :class="[
          'statistics-filters-panel flex shrink-0 flex-col overflow-hidden bg-surface',
          effectiveFiltersSheetMode
            ? 'fixed inset-x-0 bottom-0 top-auto z-[10051] max-h-[85vh] w-full rounded-t-2xl shadow-lg'
            : [
                'hidden w-0 opacity-0 transition-[width,opacity] duration-200',
                'lg:sticky lg:top-4 lg:z-0 lg:flex lg:h-auto lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:rounded-lg lg:shadow-none',
                filtersOpen ? 'lg:w-64 lg:opacity-100' : 'lg:w-0 lg:opacity-0',
              ],
        ]"
        :role="effectiveFiltersSheetMode ? 'dialog' : undefined"
        :aria-modal="effectiveFiltersSheetMode ? true : undefined"
        :aria-label="t('statisticsPage.filtersTitle')"
        @click.stop
      >
        <div
          class="relative z-[1] flex shrink-0 items-center gap-2 border-b border-primary/25 p-2 lg:border-transparent lg:pb-2"
        >
          <button
            type="button"
            :class="[
              'mx-auto mb-1 flex h-6 w-14 shrink-0 touch-manipulation items-center justify-center rounded-full',
              effectiveFiltersSheetMode ? '' : 'lg:hidden',
            ]"
            :aria-label="t('statisticsPage.closeFilters')"
            @click="closeFilters"
          >
            <span class="h-1 w-10 rounded-full bg-primary/40" aria-hidden="true" />
          </button>
          <h2 class="min-w-0 flex-1 truncate text-lg font-semibold text-text-accent">
            {{ t('statisticsPage.filtersTitle') }}
          </h2>
          <button
            type="button"
            class="statistics-filters-reset inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold text-primary-light transition-colors hover:bg-info/15 hover:text-primary-light"
            @click="resetItemFilters"
          >
            <span class="iconify i-mdi:refresh" aria-hidden="true" />
            Reset
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 lg:flex-none">
          <div class="statistics-filters-fields flex flex-col gap-3">
            <div>
              <div class="mb-1 text-sm font-medium text-text">
                {{ t('statisticsPage.overviewMatchesByDivision') }}
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="stats-division-btn rounded p-0.5 transition-colors"
                  :class="
                    filterRank.length === 0
                      ? 'bg-info/20 ring-1 ring-info/60'
                      : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="t('statisticsPage.allRanks')"
                  :aria-pressed="filterRank.length === 0"
                  @mousedown.prevent
                  @click.stop="selectAllDivisions()"
                >
                  <img
                    src="/data/community-dragon/ranked-emblem/Unranked.png"
                    :alt="t('statisticsPage.allRanks')"
                    class="h-3 w-3 object-contain"
                    :class="
                      filterRank.length === 0
                        ? 'saturate-110 opacity-100'
                        : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
                <button
                  v-for="tier in RANK_TIERS"
                  :key="tier"
                  type="button"
                  class="stats-division-btn rounded p-0.5 transition-colors"
                  :class="
                    filterRank.includes(tier)
                      ? 'bg-info/20 ring-1 ring-info/60'
                      : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="formatDivisionLabel(tier)"
                  :aria-pressed="filterRank.includes(tier)"
                  @mousedown.prevent
                  @click.stop="toggleRankFilter(tier)"
                >
                  <img
                    v-if="getRankedEmblemUrl(tier)"
                    :src="getRankedEmblemUrl(tier)!"
                    :alt="tier"
                    class="h-3 w-3 object-contain"
                    :class="
                      filterRank.includes(tier)
                        ? 'saturate-110 opacity-100'
                        : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
              </div>
            </div>
            <div>
              <div class="mb-1 text-sm font-medium text-text">
                {{ t('statisticsPage.filterRole') }}
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="stats-role-btn rounded p-0.5 transition-colors"
                  :class="!filterRole ? 'bg-info/20' : 'bg-black/20 hover:bg-white/10'"
                  :title="t('statisticsPage.allRoles')"
                  @click="selectAllRoles()"
                >
                  <img
                    src="/icons/roles/all-role.png"
                    :alt="t('statisticsPage.allRoles')"
                    class="h-3 w-3 object-contain"
                    :class="!filterRole ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'"
                    width="12"
                    height="12"
                  />
                </button>
                <button
                  v-for="r in roleOptions"
                  :key="r.value"
                  type="button"
                  class="stats-role-btn rounded p-0.5 transition-colors"
                  :class="filterRole === r.value ? 'bg-info/20' : 'bg-black/20 hover:bg-white/10'"
                  :title="r.label"
                  @click="toggleRoleFilter(r)"
                >
                  <img
                    :src="r.icon"
                    :alt="r.label"
                    class="h-3 w-3 object-contain"
                    :class="
                      filterRole === r.value
                        ? 'saturate-110 opacity-100'
                        : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
              </div>
            </div>
            <div>
              <label
                for="item-stats-chart-from-date"
                class="mb-1 block text-sm font-medium text-text"
              >
                {{ t('statisticsPage.championStatsTrendFromDate') }}
              </label>
              <input
                id="item-stats-chart-from-date"
                v-model="trendChartFromDate"
                type="date"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              />
              <p class="mt-0.5 text-[10px] leading-snug text-text/55">
                {{ t('statisticsPage.championStatsTrendFromDateHint') }}
              </p>
            </div>
          </div>
        </div>
        <div class="shrink-0 border-t border-primary/25 p-3 lg:hidden">
          <button
            type="button"
            class="w-full touch-manipulation rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-text hover:bg-primary/20"
            @click="closeFilters"
          >
            {{ t('statisticsPage.closeFilters') }}
          </button>
        </div>
      </aside>

      <div
        class="item-page-main min-w-0 flex-1 p-4 max-lg:px-0 max-lg:py-2 max-lg:pb-20 lg:px-3 lg:pb-4 lg:pt-0"
      >
        <div class="w-full">
          <div
            v-if="!Number.isFinite(itemId)"
            class="rounded-lg border border-red-500/30 bg-surface/30 p-6"
          >
            <p class="text-error">{{ t('statisticsPage.loading') }}</p>
          </div>
          <div
            v-else-if="trendPending && !item"
            class="rounded-lg border border-primary/30 bg-surface/30 p-8 text-center"
          >
            <p class="text-text/70">{{ t('statisticsPage.loading') }}</p>
          </div>
          <template v-else-if="item">
            <div
              class="item-content-stack w-full min-w-0 overflow-hidden rounded-lg border border-primary/30 bg-surface/30 max-lg:rounded-none max-lg:border-x-0"
            >
              <div class="item-header-wrap border-b border-primary/25 max-lg:border-b">
                <button
                  v-if="!itemHeaderBandOpen"
                  type="button"
                  class="item-header-band-toggle flex w-full touch-manipulation items-center gap-2.5 px-3 py-2.5 text-left lg:hidden"
                  :aria-expanded="false"
                  :aria-controls="'item-header-band'"
                  @click="itemHeaderBandOpen = true"
                >
                  <img
                    v-if="itemImageSrc"
                    :src="itemImageSrc"
                    :alt="item.name"
                    class="h-9 w-9 shrink-0 rounded border border-black/30 object-cover"
                    width="36"
                    height="36"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-accent">
                      {{ item.name }}
                    </span>
                    <span class="mt-0.5 block truncate text-[11px] tabular-nums text-text/70">
                      {{ itemHeaderCollapsedSummary }}
                    </span>
                  </span>
                  <svg
                    class="h-4 w-4 shrink-0 text-text/60"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div
                  id="item-header-band"
                  class="item-header-band flex flex-wrap items-center gap-2 px-3 py-2 max-lg:flex-col max-lg:items-stretch lg:flex-nowrap lg:items-center lg:gap-3 lg:py-2.5"
                  :class="itemHeaderBandOpen ? 'flex' : 'hidden lg:flex'"
                >
                  <div
                    class="item-header-identity flex shrink-0 items-center gap-2 max-lg:w-full lg:flex-col lg:gap-0.5 lg:text-center"
                  >
                    <h1
                      class="order-2 min-w-0 truncate text-sm font-semibold leading-tight text-accent max-lg:flex-1 lg:order-1 lg:max-w-[8rem]"
                    >
                      {{ item.name }}
                    </h1>
                    <img
                      v-if="itemImageSrc"
                      :src="itemImageSrc"
                      :alt="item.name"
                      class="order-1 h-9 w-9 shrink-0 rounded border border-black/30 object-cover lg:order-2 lg:h-10 lg:w-10"
                      width="40"
                      height="40"
                    />
                  </div>
                  <div
                    class="item-header-meta flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-text/85 max-lg:w-full"
                  >
                    <span v-if="item.gold?.total">
                      {{ t('statisticsPage.itemPrice') }}:
                      <strong>{{ item.gold.total }}</strong>
                    </span>
                    <span v-if="goldValue > 0">
                      {{ t('statisticsPage.itemsColGoldValue') }}:
                      <strong>{{ Math.round(goldValue) }}</strong>
                    </span>
                    <span v-if="goldEfficiency != null">
                      {{ t('statisticsPage.itemsColGoldEfficiency') }}:
                      <strong>{{ formatItemGoldEfficiency(item) }}</strong>
                    </span>
                  </div>
                  <div
                    class="item-header-kpis-wrap ml-auto flex shrink-0 items-center gap-2 max-lg:ml-0 max-lg:w-full max-lg:justify-between"
                  >
                    <div
                      v-if="itemHeaderKpis"
                      class="item-header-kpis flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text/85"
                    >
                      <span>
                        {{ t('statisticsPage.pickrate') }}:
                        <strong>{{ formatPercent(itemHeaderKpis.pickrate) }}%</strong>
                      </span>
                      <span>
                        {{ t('statisticsPage.winrate') }}:
                        <strong>{{ formatPercent(itemHeaderKpis.winrate) }}%</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      class="item-header-band-collapse shrink-0 rounded p-1 text-text/60 transition-colors hover:bg-white/5 hover:text-text lg:hidden"
                      :aria-expanded="true"
                      :aria-controls="'item-header-band'"
                      :title="t('statisticsPage.itemStatsHeaderHide')"
                      @click="itemHeaderBandOpen = false"
                    >
                      <svg
                        class="h-4 w-4 rotate-180"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <section
                v-if="activeItemTab === 'overview'"
                id="item-tab-panel-overview"
                role="tabpanel"
                class="item-tab-panel p-3 max-lg:px-3 max-lg:py-3 lg:p-4"
              >
                <StatisticsDailyTrendChartsPanel
                  :points="trendPoints"
                  :pending="trendPending"
                  :error="trendError"
                  :filter-rank="filterRank"
                  :versions-catalog="trendVersionsCatalog"
                  :show-banrate="false"
                />
              </section>

              <section
                v-if="activeItemTab === 'purchase'"
                id="item-tab-panel-purchase"
                role="tabpanel"
                class="item-tab-panel p-3 max-lg:px-3 max-lg:py-3 lg:p-4"
              >
                <StatisticsItemPurchaseTab
                  :stats="purchaseOrderStats"
                  :pending="purchasePending"
                  :error="purchaseError"
                  :filter-rank="filterRank"
                  :versions-catalog="trendVersionsCatalog"
                />
              </section>
            </div>
          </template>
          <div
            v-else
            class="rounded-lg border border-primary/30 bg-surface/30 p-8 text-center text-text/70"
          >
            {{ t('statisticsPage.loading') }}
          </div>
        </div>
      </div>
    </div>

    <button
      v-if="!filtersOpen"
      type="button"
      :class="[
        'statistics-filters-fab fixed bottom-4 left-1/2 z-[58] -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-surface/95 px-4 py-2.5 text-sm font-semibold text-text shadow-lg backdrop-blur-sm',
        filtersFabClass,
      ]"
      :aria-label="t('statisticsPage.openFilters')"
      @click="openFilters"
    >
      {{ t('statisticsPage.filtersTitle') }}
      <span
        v-if="activeItemFiltersCount > 0"
        class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
      >
        {{ activeItemFiltersCount }}
      </span>
    </button>
  </div>
</template>

<style>
.statistics-tabs-scroll-wrap::before,
.statistics-tabs-scroll-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 8px;
  width: 28px;
  z-index: 2;
  pointer-events: none;
}
.statistics-tabs-scroll-wrap::before {
  left: 0;
  background: linear-gradient(to right, rgb(8 16 31 / 0.95), transparent);
}
.statistics-tabs-scroll-wrap::after {
  right: 0;
  background: linear-gradient(to left, rgb(8 16 31 / 0.95), transparent);
}
@media (max-width: 767px) {
  .item-stats .statistics-tab-btn {
    font-size: 13px;
    padding-left: 12px;
    padding-right: 12px;
  }
}
@media (max-width: 1023px) {
  .item-stats .statistics-filters-panel .flex.min-h-0.flex-1 {
    overflow-y: auto;
  }
}
.item-stats aside {
  background: rgb(var(--rgb-chrome) / 1) !important;
}
.item-stats .item-content-stack {
  background-color: rgb(var(--rgb-chrome) / 1);
}
</style>
