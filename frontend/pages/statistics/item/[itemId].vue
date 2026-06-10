<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useLocalePath } from '#i18n'
import { useItemsStore } from '~/stores/ItemsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { apiUrl } from '~/utils/apiUrl'
import { getItemImageUrl } from '~/utils/imageUrl'
import {
  formatItemGoldEfficiency,
  getItemGoldEfficiency,
  getItemGoldValue,
} from '~/utils/formatItemStats'
import type { DailyTrendSnapshotPoint } from '~/composables/statistics/useStatisticsDailyTrendCharts'

definePageMeta({ layout: 'default' })

const route = useRoute()
const localePath = useLocalePath()
const { t, locale } = useI18n()
const itemsStore = useItemsStore()
const versionStore = useVersionStore()
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
]

const goldValue = computed(() => getItemGoldValue(item.value ?? undefined))
const goldEfficiency = computed(() => getItemGoldEfficiency(item.value ?? undefined))

function toggleRank(tier: string): void {
  const set = new Set(filterRank.value)
  if (set.has(tier)) set.delete(tier)
  else set.add(tier)
  filterRank.value = [...set]
}

async function loadTrendSnapshots(): Promise<void> {
  if (!Number.isFinite(itemId.value)) return
  trendPending.value = true
  trendError.value = null
  try {
    const params = new URLSearchParams()
    if (filterRole.value) params.set('role', filterRole.value)
    for (const tier of filterRank.value) {
      const normalized = String(tier || '')
        .trim()
        .toUpperCase()
        .split('_')[0]
      if (normalized) params.append('rankTier', normalized)
    }
    const from = trendChartFromDate.value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) params.set('from', from)
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
})

onMounted(async () => {
  if (!versionStore.currentVersion) await versionStore.loadCurrentVersion()
  const riotLocale = locale.value === 'fr' ? 'fr_FR' : 'en_US'
  await itemsStore.loadItems(riotLocale)
  await loadVersionsCatalog()
  await loadTrendSnapshots()
})
</script>

<template>
  <div class="item-stats flex min-h-screen flex-col bg-background text-text">
    <div class="border-b border-primary/25 bg-surface/30 px-4 py-3">
      <NuxtLink
        :to="localePath('/statistics?tab=items')"
        class="text-sm text-accent underline decoration-accent/40"
      >
        ← {{ t('statisticsPage.tabItems') }}
      </NuxtLink>
    </div>

    <div class="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4">
      <header
        v-if="item"
        class="flex flex-wrap items-center gap-4 rounded-lg border border-primary/25 bg-surface/40 p-4"
      >
        <img
          v-if="itemImageSrc"
          :src="itemImageSrc"
          :alt="item.name"
          class="h-16 w-16 rounded border border-black/30 object-cover"
          width="64"
          height="64"
        />
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold text-text">{{ item.name }}</h1>
          <p class="text-sm text-text/60">#{{ itemId }}</p>
          <div class="mt-2 flex flex-wrap gap-4 text-sm tabular-nums text-text/85">
            <span v-if="item.gold?.total"
              >{{ t('statisticsPage.itemPrice') }}: {{ item.gold.total }}</span
            >
            <span v-if="goldValue > 0"
              >{{ t('statisticsPage.itemsColGoldValue') }}: {{ Math.round(goldValue) }}</span
            >
            <span v-if="goldEfficiency != null"
              >{{ t('statisticsPage.itemsColGoldEfficiency') }}:
              {{ formatItemGoldEfficiency(item) }}</span
            >
          </div>
        </div>
      </header>

      <aside class="rounded-lg border border-primary/25 bg-surface/40 p-4">
        <h2 class="mb-3 text-sm font-semibold text-text">{{ t('statisticsPage.filtersTitle') }}</h2>
        <div class="space-y-4 text-sm">
          <div>
            <div class="mb-2 text-text/70">{{ t('statisticsPage.filterRank') }}</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tier in RANK_TIERS"
                :key="tier"
                type="button"
                class="rounded border px-2 py-1 text-xs font-medium transition-colors"
                :class="
                  filterRank.includes(tier)
                    ? 'border-accent/60 bg-accent/20 text-accent'
                    : 'border-primary/30 text-text/75 hover:bg-primary/10'
                "
                @click="toggleRank(tier)"
              >
                {{ tier.charAt(0) + tier.slice(1).toLowerCase() }}
              </button>
            </div>
          </div>
          <label class="block">
            <span class="mb-1 block text-text/70">{{ t('statisticsPage.filterRole') }}</span>
            <select
              v-model="filterRole"
              class="w-full max-w-xs rounded border border-primary/40 bg-background px-2 py-1 text-text"
            >
              <option value="">{{ t('statisticsPage.allRoles') }}</option>
              <option value="TOP">Top</option>
              <option value="JUNGLE">Jungle</option>
              <option value="MIDDLE">Mid</option>
              <option value="BOTTOM">ADC</option>
              <option value="SUPPORT">Support</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-text/70">{{
              t('statisticsPage.championStatsTrendFromDate')
            }}</span>
            <input
              v-model="trendChartFromDate"
              type="date"
              class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
            />
          </label>
        </div>
      </aside>

      <StatisticsDailyTrendChartsPanel
        :points="trendPoints"
        :pending="trendPending"
        :error="trendError"
        :filter-rank="filterRank"
        :versions-catalog="trendVersionsCatalog"
        :show-banrate="false"
      />
    </div>
  </div>
</template>
