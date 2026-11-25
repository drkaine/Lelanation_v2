<template>
  <div class="statistics-region-filter mb-3">
    <div class="mb-1 text-sm font-medium text-text">{{ t('statisticsPage.region') }}</div>
    <div class="flex flex-wrap gap-1">
      <button
        type="button"
        class="stats-region-btn rounded px-1.5 py-0.5 text-xs font-semibold transition-colors"
        :class="selected.length === 0 ? ACTIVE : INACTIVE"
        :aria-pressed="selected.length === 0"
        @mousedown.prevent
        @click.stop="apply([])"
      >
        {{ t('statisticsPage.regionAll') }}
      </button>
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="stats-region-btn rounded px-1.5 py-0.5 text-xs font-semibold transition-colors"
        :class="selected.includes(opt.value) ? ACTIVE : INACTIVE"
        :aria-pressed="selected.includes(opt.value)"
        @mousedown.prevent
        @click.stop="apply(toggleStatsRegion(selected, opt.value))"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  STATS_REGION_COOKIE,
  type StatsRegion,
  parseStatsRegions,
  serializeStatsRegions,
  toggleStatsRegion,
  visibleStatsRegionOptions,
} from '~/utils/statsRegion'
import { apiUrl } from '~/utils/apiUrl'

const ACTIVE = 'bg-info/20 ring-1 ring-info/60 text-text'
const INACTIVE = 'bg-chrome text-text/80 hover:bg-white/10'
/** Laisse le temps de cocher plusieurs régions avant le rechargement. */
const RELOAD_DELAY_MS = 800

const { t } = useI18n()
const cookie = useCookie<string | null>(STATS_REGION_COOKIE, {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
})
const selected = ref<StatsRegion[]>(parseStatsRegions(cookie.value))
/** Seules les régions ayant des matchs en base ; erreur ou vide = toutes. */
const { data: regionsResponse } = useAsyncData(
  'stats-available-regions',
  () => $fetch<unknown>(apiUrl('/api/stats/regions')).catch(() => null),
  { default: () => null }
)
const options = computed(() => visibleStatsRegionOptions(regionsResponse.value, selected.value))
let reloadTimer: ReturnType<typeof setTimeout> | null = null

/** Toutes les données stats dépendent des régions : cookie puis rechargement pour tout refetch. */
function apply(regions: StatsRegion[]) {
  selected.value = regions
  cookie.value = regions.length > 0 ? serializeStatsRegions(regions) : null
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(async () => {
    await nextTick()
    reloadNuxtApp({ persistState: false })
  }, RELOAD_DELAY_MS)
}

onBeforeUnmount(() => {
  if (reloadTimer) clearTimeout(reloadTimer)
})
</script>
