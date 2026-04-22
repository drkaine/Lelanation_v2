<template>
  <div class="min-h-screen bg-zinc-950 pb-12 pt-6 text-zinc-100">
    <div class="mx-auto max-w-3xl px-4">
      <div class="mb-6">
        <NuxtLink
          :to="localePath('/statistics')"
          class="text-sm text-emerald-400/90 hover:text-emerald-300"
        >
          ← {{ t('statisticsPage.recapBack') }}
        </NuxtLink>
        <h1 class="mt-3 text-2xl font-bold tracking-tight text-zinc-50">
          {{ t('statisticsPage.recapTitle') }}
        </h1>
        <p class="mt-2 text-sm text-zinc-400">
          {{ t('statisticsPage.recapDescription') }}
        </p>
      </div>

      <section class="mb-10">
        <h2 class="mb-3 text-lg font-semibold text-emerald-300/95">
          {{ t('statisticsPage.recapGlobalMovers') }}
        </h2>
        <p v-if="moversMeta" class="mb-3 text-xs text-zinc-500">{{ moversMeta }}</p>
        <div v-if="globalPending" class="text-sm text-zinc-500">
          {{ t('statisticsPage.recapLoading') }}
        </div>
        <div v-else-if="globalError" class="text-sm text-rose-400">{{ globalError }}</div>
        <div v-else class="space-y-2">
          <StatisticsMoverCard
            v-for="m in globalMovers"
            :key="m.championId"
            :title="championLabel(m.championId)"
            :subtitle="t('statisticsPage.recapMoverSubtitle', { games: m.gamesLatest })"
            :delta="m.deltaWinRate"
            metric-label="Δ WR"
            :image-src="championImage(m.championId)"
          />
          <p v-if="globalMovers.length === 0" class="text-sm text-zinc-500">
            {{ t('statisticsPage.recapEmptyGlobal') }}
          </p>
        </div>
      </section>

      <section class="mb-10">
        <h2 class="mb-3 text-lg font-semibold text-amber-300/95">
          {{ t('statisticsPage.recapWatchlist') }}
        </h2>
        <div v-if="alertsPending" class="text-sm text-zinc-500">
          {{ t('statisticsPage.recapLoading') }}
        </div>
        <template v-else>
          <div class="mb-4 space-y-2">
            <div
              v-for="a in triggeredAlerts"
              :key="a.rule.id"
              class="rounded-md border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-sm"
            >
              <span class="font-medium text-emerald-300">{{ formatRuleSummary(a.rule) }}</span>
              <span v-if="a.delta.ok" class="ml-2 text-zinc-400">
                {{ formatDeltaSnippet(a.rule, a.delta) }}
              </span>
            </div>
            <p
              v-if="triggeredAlerts.length === 0 && watchlist.rules.length > 0"
              class="text-sm text-zinc-500"
            >
              {{ t('statisticsPage.recapNoTriggers') }}
            </p>
            <p v-if="watchlist.rules.length === 0" class="text-sm text-zinc-500">
              {{ t('statisticsPage.recapNoRules') }}
            </p>
          </div>

          <ul class="space-y-2 border-t border-zinc-800 pt-4">
            <li
              v-for="r in watchlist.rules"
              :key="r.id"
              class="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-300"
            >
              <span>{{ formatRuleSummary(r) }}</span>
              <button
                type="button"
                class="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-400 hover:border-rose-500 hover:text-rose-400"
                @click="watchlist.removeRule(r.id)"
              >
                {{ t('statisticsPage.recapRemove') }}
              </button>
            </li>
          </ul>
        </template>
      </section>

      <section class="rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-4">
        <h2 class="mb-3 text-lg font-semibold text-zinc-200">
          {{ t('statisticsPage.recapBuilderTitle') }}
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-xs text-zinc-400">
            {{ t('statisticsPage.recapTargetType') }}
            <select
              v-model="form.targetType"
              class="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              <option value="ROLE">{{ t('statisticsPage.recapTargetRole') }}</option>
              <option value="CHAMPION">{{ t('statisticsPage.recapTargetChampion') }}</option>
              <option value="GLOBAL">{{ t('statisticsPage.recapTargetGlobal') }}</option>
            </select>
          </label>
          <label v-if="form.targetType === 'ROLE'" class="block text-xs text-zinc-400">
            {{ t('statisticsPage.recapLane') }}
            <select
              v-model="form.lane"
              class="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              <option v-for="lane in lanes" :key="lane" :value="lane">{{ laneLabel(lane) }}</option>
            </select>
          </label>
          <template v-if="form.targetType === 'CHAMPION'">
            <label class="block text-xs text-zinc-400 sm:col-span-2">
              {{ t('statisticsPage.recapChampion') }}
              <input
                v-model="form.championQuery"
                type="text"
                class="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
                :placeholder="t('statisticsPage.recapChampionPlaceholder')"
                autocomplete="off"
                @input="onChampionSearch"
              />
              <ul
                v-if="championSuggestions.length > 0"
                class="mt-1 max-h-40 overflow-auto rounded border border-zinc-700 bg-zinc-950 text-sm"
              >
                <li
                  v-for="c in championSuggestions"
                  :key="c.key"
                  class="cursor-pointer px-2 py-1 hover:bg-zinc-800"
                  @click="pickChampion(c)"
                >
                  {{ c.name }}
                </li>
              </ul>
            </label>
            <label class="block text-xs text-zinc-400">
              {{ t('statisticsPage.recapRoleFilter') }}
              <select
                v-model="form.roleFilter"
                class="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
              >
                <option value="">{{ t('statisticsPage.recapAllLanes') }}</option>
                <option v-for="lane in lanes" :key="lane" :value="lane">
                  {{ laneLabel(lane) }}
                </option>
              </select>
            </label>
          </template>

          <label class="block text-xs text-zinc-400 sm:col-span-2">
            {{ t('statisticsPage.recapRankTier') }}
            <select
              v-model="form.rankTier"
              class="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              <option value="">{{ t('statisticsPage.recapAllRanks') }}</option>
              <option v-for="tier in RANK_TIERS" :key="tier" :value="tier">{{ tier }}</option>
            </select>
          </label>

          <label class="block text-xs text-zinc-400">
            {{ t('statisticsPage.recapMetric') }}
            <select
              v-model="form.metric"
              class="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              <option value="winRate">{{ t('statisticsPage.recapMetricWr') }}</option>
              <option value="pickRate">{{ t('statisticsPage.recapMetricPr') }}</option>
              <option value="banRate">{{ t('statisticsPage.recapMetricBr') }}</option>
            </select>
          </label>
          <label class="block text-xs text-zinc-400">
            {{ t('statisticsPage.recapOperator') }}
            <select
              v-model="form.operator"
              class="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              <option value=">">{{ t('statisticsPage.recapOpGt') }}</option>
              <option value="<">{{ t('statisticsPage.recapOpLt') }}</option>
              <option value="increase_plus">{{ t('statisticsPage.recapOpInc') }}</option>
              <option value="decrease_plus">{{ t('statisticsPage.recapOpDec') }}</option>
            </select>
          </label>
          <label class="block text-xs text-zinc-400">
            {{ t('statisticsPage.recapThreshold') }}
            <input
              v-model.number="form.threshold"
              type="number"
              min="0"
              max="100"
              step="0.1"
              class="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
            />
          </label>
          <label class="block text-xs text-zinc-400">
            {{ t('statisticsPage.recapTimeframe') }}
            <select
              v-model.number="form.timeframe"
              class="mt-1 w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
            >
              <option :value="1">1j</option>
              <option :value="3">3j</option>
              <option :value="7">7j</option>
            </select>
          </label>
        </div>
        <p v-if="formError" class="mt-2 text-sm text-rose-400">{{ formError }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            @click="submitRule"
          >
            {{ t('statisticsPage.recapAddRule') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:border-amber-500/60 hover:text-amber-200"
            @click="applyExampleRule"
          >
            {{ t('statisticsPage.recapExample') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Champion } from '@lelanation/shared-types'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '#imports'
import { useWatchlistStore } from '~/stores/WatchlistStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { RANK_TIERS } from '~/utils/rankTiers'
import {
  buildWatchlistAlerts,
  fetchGlobalWinrateMovers,
  type WatchlistAlert,
  type WatchlistDeltaApi,
} from '~/composables/useWatchlist'
import type { WatchMetric, WatchOperator, WatchRule } from '~/types/watchlist'
import { parseRankTierFromRule, validateWatchRuleThreshold } from '~/types/watchlist'

definePageMeta({
  layout: 'default',
})

const { t, locale } = useI18n()
const localePath = useLocalePath()
const watchlist = useWatchlistStore()
const champions = useChampionsStore()
const { version: gameVersion } = useGameVersion()

const lanes = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'] as const

const globalPending = ref(true)
const globalError = ref<string | null>(null)
const globalMovers = ref<
  Array<{
    championId: number
    gamesLatest: number
    gamesPast: number
    winRateLatest: number
    winRatePast: number
    deltaWinRate: number
  }>
>([])
const moversMeta = ref<string | null>(null)

const alertsPending = ref(true)
const allAlerts = ref<WatchlistAlert[]>([])
const triggeredAlerts = computed(() => allAlerts.value.filter(a => a.triggered))

const form = ref({
  targetType: 'ROLE' as 'ROLE' | 'CHAMPION' | 'GLOBAL',
  lane: 'JUNGLE',
  championQuery: '',
  pickedChampionKey: null as string | null,
  roleFilter: '' as string,
  rankTier: '' as string,
  metric: 'winRate' as WatchMetric,
  operator: '>' as WatchOperator,
  threshold: 52,
  timeframe: 7,
})
const championSuggestions = ref<Champion[]>([])
const formError = ref<string | null>(null)

useHead({
  title: () => t('statisticsPage.recapMetaTitle'),
  meta: [{ name: 'description', content: t('statisticsPage.recapMetaDescription') }],
})

function championByKey(id: number): Champion | null {
  return champions.champions.find(c => c.key === String(id)) ?? null
}

function championLabel(id: number): string {
  return championByKey(id)?.name ?? `#${id}`
}

function championImage(id: number): string | null {
  const ch = championByKey(id)
  if (!ch || !gameVersion.value) return null
  return getChampionImageUrl(gameVersion.value, ch.image.full)
}

function laneLabel(lane: string): string {
  const map: Record<string, string> = {
    TOP: t('statisticsPage.bansColTop'),
    JUNGLE: t('statisticsPage.bansColJungle'),
    MIDDLE: t('statisticsPage.bansColMiddle'),
    BOTTOM: t('statisticsPage.bansColBottom'),
    SUPPORT: t('statisticsPage.bansColSupport'),
  }
  return map[lane] ?? lane
}

function tierSuffix(r: WatchRule): string {
  const rt = parseRankTierFromRule(r)
  return rt ? ` · ${rt}` : ''
}

function formatRuleSummary(r: WatchRule): string {
  const tier = tierSuffix(r)
  const tail = ` — ${r.metric} ${r.operator} ${r.threshold}% / ${r.timeframe}j`
  if (r.targetType === 'GLOBAL') {
    return `${t('statisticsPage.recapTargetGlobal')}${tier}${tail}`
  }
  if (r.targetType === 'ROLE') {
    return `${laneLabel(String(r.targetValue))}${tier}${tail}`
  }
  const id =
    typeof r.targetValue === 'number' ? r.targetValue : Number.parseInt(String(r.targetValue), 10)
  const name = championLabel(Number.isFinite(id) ? id : 0)
  const lane = r.roleFilter ? ` · ${laneLabel(r.roleFilter)}` : ''
  return `${name}${lane}${tier}${tail}`
}

function formatDeltaSnippet(r: WatchRule, d: WatchlistDeltaApi): string {
  if (!d.current) return ''
  if (r.metric === 'winRate')
    return `WR ${d.current.winRate.toFixed(1)}% (Δ ${(d.deltaWinRate ?? 0).toFixed(2)}%)`
  if (r.metric === 'pickRate')
    return `PR ${d.current.pickRate.toFixed(1)}% (Δ ${(d.deltaPickRate ?? 0).toFixed(2)}%)`
  return `BR ${d.current.banRate.toFixed(1)}% (Δ ${(d.deltaBanRate ?? 0).toFixed(2)}%)`
}

function onChampionSearch(): void {
  formError.value = null
  const q = form.value.championQuery.trim().toLowerCase()
  if (q.length < 2) {
    championSuggestions.value = []
    return
  }
  championSuggestions.value = champions.searchChampions(q).slice(0, 8)
}

function pickChampion(c: Champion): void {
  form.value.championQuery = c.name
  form.value.pickedChampionKey = c.key
  championSuggestions.value = []
}

async function refreshAlerts(): Promise<void> {
  alertsPending.value = true
  try {
    allAlerts.value = await buildWatchlistAlerts(watchlist.rules)
  } finally {
    alertsPending.value = false
  }
}

async function applyExampleRule(): Promise<void> {
  watchlist.loadExampleRule()
  await refreshAlerts()
}

function submitRule(): void {
  formError.value = null
  const timeframe = form.value.timeframe as number
  const rankTier = form.value.rankTier.trim() || null
  let rule: WatchRule | null = null
  if (form.value.targetType === 'GLOBAL') {
    rule = {
      id: crypto.randomUUID(),
      targetType: 'GLOBAL',
      targetValue: 'POOL',
      rankTier,
      metric: form.value.metric,
      operator: form.value.operator,
      threshold: form.value.threshold,
      timeframe,
    }
  } else if (form.value.targetType === 'ROLE') {
    rule = {
      id: crypto.randomUUID(),
      targetType: 'ROLE',
      targetValue: form.value.lane,
      rankTier,
      metric: form.value.metric,
      operator: form.value.operator,
      threshold: form.value.threshold,
      timeframe,
    }
  } else {
    const key = form.value.pickedChampionKey
    if (!key) {
      formError.value = t('statisticsPage.recapPickChampion')
      return
    }
    const id = Number.parseInt(String(key), 10)
    if (!Number.isFinite(id) || id <= 0) {
      formError.value = t('statisticsPage.recapPickChampion')
      return
    }
    rule = {
      id: crypto.randomUUID(),
      targetType: 'CHAMPION',
      targetValue: id,
      roleFilter: form.value.roleFilter || null,
      rankTier,
      metric: form.value.metric,
      operator: form.value.operator,
      threshold: form.value.threshold,
      timeframe,
    }
  }
  const v = validateWatchRuleThreshold(rule)
  if (!v.ok) {
    formError.value = v.message ?? t('statisticsPage.recapInvalid')
    return
  }
  watchlist.addRule(rule)
  refreshAlerts().catch(() => undefined)
}

onMounted(async () => {
  watchlist.init()
  const riotLang = locale.value === 'en' ? 'en_US' : 'fr_FR'
  if (champions.champions.length === 0) {
    await champions.loadChampions(riotLang)
  }

  globalPending.value = true
  globalError.value = null
  try {
    const data = await fetchGlobalWinrateMovers({ days: 7, limit: 5 })
    globalMovers.value = data.movers
    if (data.dLatest && data.dPast) {
      moversMeta.value = t('statisticsPage.recapMoversMeta', {
        latest: data.dLatest,
        past: data.dPast,
      })
    } else {
      moversMeta.value = null
    }
  } catch (e) {
    globalError.value = e instanceof Error ? e.message : String(e)
  } finally {
    globalPending.value = false
  }

  await refreshAlerts()
})
</script>
