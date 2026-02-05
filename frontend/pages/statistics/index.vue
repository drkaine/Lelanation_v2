<template>
  <div class="statistics min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <h1 class="mb-6 text-3xl font-bold text-text-accent">
        {{ t('statisticsPage.title') }}
      </h1>
      <p class="mb-6 text-text/80">
        {{ t('statisticsPage.description') }}
      </p>

      <!-- Tabs -->
      <div class="mb-4 flex flex-wrap gap-2 border-b border-primary/30 pb-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="[
            'rounded px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-accent text-background'
              : 'bg-surface/50 text-text/80 hover:bg-primary/20 hover:text-text',
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab: Overview (default, shyv.net style) -->
      <div v-show="activeTab === 'overview'" class="space-y-6">
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
          <h2 class="mb-4 text-xl font-semibold text-text-accent">
            {{ t('statisticsPage.overviewTitle') }}
          </h2>
          <p class="mb-4 text-text/80">
            {{ t('statisticsPage.overviewDescription') }}
          </p>
          <div
            v-if="!championsPending && championsData"
            class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div class="rounded border border-primary/20 bg-background/50 p-4">
              <div class="text-2xl font-bold text-text-accent">
                {{ championsData.totalMatches ?? championsData.totalGames ?? 0 }}
              </div>
              <div class="text-sm text-text/70">{{ t('statisticsPage.totalGames') }}</div>
            </div>
            <div class="rounded border border-primary/20 bg-background/50 p-4">
              <div class="text-2xl font-bold text-text-accent">
                {{ championsData?.champions?.length ?? 0 }}
              </div>
              <div class="text-sm text-text/70">{{ t('statisticsPage.overviewChampions') }}</div>
            </div>
            <div class="rounded border border-primary/20 bg-background/50 p-4">
              <div class="text-sm font-medium text-text">
                {{
                  championsData?.generatedAt ? formatGeneratedAt(championsData.generatedAt) : '—'
                }}
              </div>
              <div class="text-sm text-text/70">{{ t('statisticsPage.generatedAt') }}</div>
            </div>
          </div>
          <div v-else-if="championsPending" class="text-text/70">
            {{ t('statisticsPage.loading') }}
          </div>
          <div v-else class="text-text/70">{{ t('statisticsPage.overviewNoData') }}</div>
        </div>
        <div
          v-if="championsData?.champions?.length"
          class="rounded-lg border border-primary/30 bg-surface/30 p-6"
        >
          <h3 class="mb-3 text-lg font-medium text-text">
            {{ t('statisticsPage.overviewTopChampions') }}
          </h3>
          <ul class="space-y-2">
            <li
              v-for="row in (championsData?.champions ?? []).slice(0, 5)"
              :key="row.championId"
              class="flex items-center gap-2 text-text/90"
            >
              <img
                v-if="gameVersion && championByKey(row.championId)"
                :src="getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)"
                :alt="championName(row.championId) || ''"
                class="h-6 w-6 rounded-full object-cover"
                width="24"
                height="24"
              />
              <span>{{ championName(row.championId) || row.championId }}</span>
              <span class="text-text/60"
                >— {{ row.games }} {{ t('statisticsPage.games') }}, {{ row.winrate }}% WR</span
              >
            </li>
          </ul>
        </div>
      </div>

      <!-- Tab: Champions -->
      <div v-show="activeTab === 'champions'" class="space-y-4">
        <div class="flex flex-wrap items-end gap-4">
          <div>
            <label for="champion-search" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.searchChampion')
            }}</label>
            <input
              id="champion-search"
              v-model.trim="championSearchQuery"
              type="text"
              :placeholder="t('statisticsPage.searchChampionPlaceholder')"
              class="min-w-[200px] rounded border border-primary/50 bg-background px-3 py-2 text-text placeholder:text-text/50"
            />
          </div>
          <div>
            <label for="filter-rank" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.filterRank')
            }}</label>
            <select
              id="filter-rank"
              v-model="filterRank"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allRanks') }}</option>
              <option v-for="r in rankTiers" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <div>
            <label for="filter-role" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.filterRole')
            }}</label>
            <select
              id="filter-role"
              v-model="filterRole"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allRoles') }}</option>
              <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>
        </div>
        <div v-if="championsPending" class="text-text/70">{{ t('statisticsPage.loading') }}</div>
        <div
          v-else-if="championsError"
          class="rounded border border-error bg-surface p-3 text-error"
        >
          {{ championsError }}
        </div>
        <div
          v-else-if="championsData?.message && !championsData?.champions?.length"
          class="text-text/70"
        >
          {{ championsData.message }}
        </div>
        <div v-else class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30">
          <table class="w-full min-w-[400px] text-left text-sm">
            <thead class="border-b border-primary/30 bg-surface/50">
              <tr>
                <th class="px-4 py-3 font-semibold text-text">
                  {{ t('statisticsPage.champion') }}
                </th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.games') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.wins') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.winrate') }}</th>
                <th class="px-4 py-3 font-semibold text-text">
                  {{ t('statisticsPage.pickrate') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="row in filteredChampions"
                :key="row.championId"
                class="hover:bg-surface/50"
              >
                <td class="px-4 py-2 font-medium text-text">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="gameVersion && championByKey(row.championId)"
                      :src="
                        getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)
                      "
                      :alt="championName(row.championId) || ''"
                      class="h-8 w-8 rounded-full object-cover"
                      width="32"
                      height="32"
                    />
                    <span>{{ championName(row.championId) || row.championId }}</span>
                  </div>
                </td>
                <td class="px-4 py-2 text-text/90">{{ row.games }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.wins }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.winrate }}%</td>
                <td class="px-4 py-2 text-text/90">{{ row.pickrate }}%</td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="
              (championsData?.totalMatches != null || championsData?.totalGames != null) &&
              filteredChampions.length
            "
            class="border-t border-primary/20 px-4 py-2 text-xs text-text/70"
          >
            {{ t('statisticsPage.totalGames') }}:
            {{ championsData.totalMatches ?? championsData.totalGames }}
            <span v-if="championSearchQuery">
              ({{ t('statisticsPage.showing') }} {{ filteredChampions.length }})</span
            >
          </p>
        </div>
      </div>

      <!-- Tab: Builds -->
      <div v-show="activeTab === 'builds'" class="space-y-4">
        <div class="flex flex-wrap gap-4">
          <div>
            <label for="build-champion" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.champion')
            }}</label>
            <select
              id="build-champion"
              v-model="buildsChampionId"
              class="min-w-[180px] rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.selectChampion') }}</option>
              <option v-for="c in championsForSelect" :key="c.id" :value="c.key">
                {{ c.name }}
              </option>
            </select>
          </div>
          <div>
            <label for="build-rank" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.filterRank')
            }}</label>
            <select
              id="build-rank"
              v-model="buildsRank"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allRanks') }}</option>
              <option v-for="r in rankTiers" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
        </div>
        <div v-if="!buildsChampionId" class="text-text/70">
          {{ t('statisticsPage.selectChampion') }}
        </div>
        <div v-else-if="buildsPending" class="text-text/70">{{ t('statisticsPage.loading') }}</div>
        <div v-else class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-primary/30 bg-surface/50">
              <tr>
                <th class="px-4 py-3 font-semibold text-text">
                  {{ t('statisticsPage.buildsItems') }}
                </th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.games') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.wins') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.winrate') }}</th>
                <th class="px-4 py-3 font-semibold text-text">
                  {{ t('statisticsPage.pickrate') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="(row, idx) in buildsData?.builds ?? []"
                :key="idx"
                class="hover:bg-surface/50"
              >
                <td class="px-4 py-2 text-text/90">
                  <div class="flex flex-wrap items-center gap-1">
                    <template v-for="itemId in row.items" :key="itemId">
                      <img
                        v-if="gameVersion && itemImageName(itemId)"
                        :src="getItemImageUrl(gameVersion, itemImageName(itemId)!)"
                        :alt="itemName(itemId) || String(itemId)"
                        class="h-6 w-6 rounded object-contain"
                        width="24"
                        height="24"
                      />
                      <span v-else class="text-xs">{{ itemName(itemId) || itemId }}</span>
                    </template>
                    <span v-if="!row.items?.length" class="text-text/60">—</span>
                  </div>
                </td>
                <td class="px-4 py-2 text-text/90">{{ row.games }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.wins }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.winrate }}%</td>
                <td class="px-4 py-2 text-text/90">{{ row.pickrate }}%</td>
              </tr>
            </tbody>
          </table>
          <p v-if="buildsData && !buildsData.builds?.length" class="px-4 py-3 text-text/70">
            {{ t('statisticsPage.noData') }}
          </p>
          <p
            v-else-if="
              buildsData?.builds?.length &&
              !itemsStore.items.length &&
              itemsStore.status !== 'loading'
            "
            class="px-4 py-2 text-xs text-text/60"
          >
            {{ t('statisticsPage.gameDataItemsHint') }}
          </p>
        </div>
      </div>

      <!-- Tab: Runes -->
      <div v-show="activeTab === 'runes'" class="space-y-4">
        <div class="flex flex-wrap gap-4">
          <div>
            <label for="runes-champion" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.champion')
            }}</label>
            <select
              id="runes-champion"
              v-model="runesChampionId"
              class="min-w-[180px] rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.selectChampion') }}</option>
              <option v-for="c in championsForSelect" :key="c.id" :value="c.key">
                {{ c.name }}
              </option>
            </select>
          </div>
          <div>
            <label for="runes-rank" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.filterRank')
            }}</label>
            <select
              id="runes-rank"
              v-model="runesRank"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allRanks') }}</option>
              <option v-for="r in rankTiers" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
        </div>
        <div v-if="!runesChampionId" class="text-text/70">
          {{ t('statisticsPage.selectChampion') }}
        </div>
        <div v-else-if="runesPending" class="text-text/70">{{ t('statisticsPage.loading') }}</div>
        <div v-else class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-primary/30 bg-surface/50">
              <tr>
                <th class="px-4 py-3 font-semibold text-text">#</th>
                <th class="px-4 py-3 font-semibold text-text">
                  {{ t('statisticsPage.runesSetup') }}
                </th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.games') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.wins') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.winrate') }}</th>
                <th class="px-4 py-3 font-semibold text-text">
                  {{ t('statisticsPage.pickrate') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="(row, idx) in runesData?.runes ?? []"
                :key="idx"
                class="hover:bg-surface/50"
              >
                <td class="px-4 py-2 text-text/90">{{ idx + 1 }}</td>
                <td class="px-4 py-2 text-text/90">{{ runeSetupLabel(row.runes) }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.games }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.wins }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.winrate }}%</td>
                <td class="px-4 py-2 text-text/90">{{ row.pickrate }}%</td>
              </tr>
            </tbody>
          </table>
          <p v-if="runesData && !runesData.runes?.length" class="px-4 py-3 text-text/70">
            {{ t('statisticsPage.noData') }}
          </p>
          <p
            v-else-if="
              runesData?.runes?.length &&
              !runesStore.runePaths.length &&
              runesStore.status !== 'loading'
            "
            class="px-4 py-2 text-xs text-text/60"
          >
            {{ t('statisticsPage.gameDataRunesHint') }}
          </p>
        </div>
      </div>

      <!-- Tab: Recherche joueur -->
      <div v-show="activeTab === 'players'" class="space-y-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="min-w-[200px] flex-1">
            <label for="player-search" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.searchPlayer')
            }}</label>
            <div class="flex gap-2">
              <input
                id="player-search"
                v-model.trim="playerSearchQuery"
                type="text"
                :placeholder="t('statisticsPage.searchPlayerPlaceholder')"
                class="min-w-0 flex-1 rounded border border-primary/50 bg-background px-3 py-2 text-text placeholder:text-text/50"
                @keydown.enter="searchPlayer"
              />
              <button
                type="button"
                class="rounded bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                :disabled="!playerSearchQuery || playerSearchPending"
                @click="searchPlayer"
              >
                {{
                  playerSearchPending
                    ? t('statisticsPage.loading')
                    : t('statisticsPage.searchPlayerButton')
                }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="playerSearchError" class="rounded border border-error bg-surface p-3 text-error">
          {{ playerSearchError }}
        </div>
        <div v-else-if="playerSearchResult" class="space-y-4">
          <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
            <h3 class="mb-2 text-lg font-semibold text-text">
              {{ playerSearchResult.player.summonerName || playerSearchResult.player.maskedPuid }}
            </h3>
            <div class="flex flex-wrap gap-4 text-sm text-text/90">
              <span>{{ t('statisticsPage.region') }}: {{ playerSearchResult.player.region }}</span>
              <span
                >{{ t('statisticsPage.rank') }}:
                {{ playerSearchResult.player.rankTier || '—' }}</span
              >
              <span
                >{{ t('statisticsPage.games') }}: {{ playerSearchResult.player.totalGames }}</span
              >
              <span
                >{{ t('statisticsPage.winrate') }}: {{ playerSearchResult.player.winrate }}%</span
              >
            </div>
          </div>
          <div class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-primary/30 bg-surface/50">
                <tr>
                  <th class="px-4 py-3 font-semibold text-text">
                    {{ t('statisticsPage.champion') }}
                  </th>
                  <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.games') }}</th>
                  <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.wins') }}</th>
                  <th class="px-4 py-3 font-semibold text-text">
                    {{ t('statisticsPage.winrate') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20">
                <tr
                  v-for="row in playerSearchResult.championStats"
                  :key="row.championId"
                  class="hover:bg-surface/50"
                >
                  <td class="px-4 py-2 font-medium text-text">
                    <div class="flex items-center gap-2">
                      <img
                        v-if="gameVersion && championByKey(row.championId)"
                        :src="
                          getChampionImageUrl(
                            gameVersion,
                            championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="championName(row.championId) || ''"
                        class="h-8 w-8 rounded-full object-cover"
                        width="32"
                        height="32"
                      />
                      <span>{{ championName(row.championId) || row.championId }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-2 text-text/90">{{ row.games }}</td>
                  <td class="px-4 py-2 text-text/90">{{ row.wins }}</td>
                  <td class="px-4 py-2 text-text/90">{{ row.winrate }}%</td>
                </tr>
              </tbody>
            </table>
            <p
              v-if="playerSearchResult.championStats && !playerSearchResult.championStats.length"
              class="px-4 py-3 text-text/70"
            >
              {{ t('statisticsPage.noData') }}
            </p>
          </div>
        </div>
        <p v-else class="text-text/70">
          {{ t('statisticsPage.searchPlayerHint') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '~/utils/apiUrl'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { getChampionImageUrl, getItemImageUrl } from '~/utils/imageUrl'

definePageMeta({
  layout: 'default',
})

const { t, locale } = useI18n()

useHead({
  title: () => t('statisticsPage.metaTitle'),
  meta: [{ name: 'description', content: () => t('statisticsPage.metaDescription') }],
})
useSeoMeta({
  ogTitle: () => t('statisticsPage.metaTitle'),
  ogDescription: () => t('statisticsPage.metaDescription'),
  ogType: 'website',
})

const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const versionStore = useVersionStore()
const { version: gameVersion } = useGameVersion()

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const activeTab = ref<'overview' | 'champions' | 'builds' | 'runes' | 'players'>('overview')
const tabs = computed(() => [
  { id: 'overview' as const, label: t('statisticsPage.tabOverview') },
  { id: 'champions' as const, label: t('statisticsPage.tabChampions') },
  { id: 'builds' as const, label: t('statisticsPage.tabBuilds') },
  { id: 'runes' as const, label: t('statisticsPage.tabRunes') },
  { id: 'players' as const, label: t('statisticsPage.tabPlayers') },
])

const championSearchQuery = ref('')
const filteredChampions = computed(() => {
  const list = championsData.value?.champions ?? []
  const q = championSearchQuery.value.toLowerCase()
  if (!q) return list
  return list.filter(row => {
    const name = championName(row.championId)?.toLowerCase() ?? ''
    return name.includes(q) || String(row.championId).includes(q)
  })
})

function formatGeneratedAt(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    return d.toLocaleString(locale.value)
  } catch {
    return value
  }
}

const filterRank = ref('')
const filterRole = ref('')
const rankTiers = [
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
const roles = [
  { value: 'TOP', label: 'Top' },
  { value: 'JUNGLE', label: 'Jungle' },
  { value: 'MIDDLE', label: 'Mid' },
  { value: 'BOTTOM', label: 'ADC' },
  { value: 'UTILITY', label: 'Support' },
]

// Champions
const championsData = ref<{
  totalGames: number
  totalMatches?: number
  champions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  message?: string
} | null>(null)
const championsPending = ref(true)
const championsError = ref<string | null>(null)
const queryString = computed(() => {
  const params = new URLSearchParams()
  if (filterRank.value) params.set('rankTier', filterRank.value)
  if (filterRole.value) params.set('role', filterRole.value)
  return params.toString() ? `?${params.toString()}` : ''
})
async function loadChampions() {
  championsPending.value = true
  championsError.value = null
  try {
    championsData.value = await $fetch(apiUrl(`/api/stats/champions${queryString.value}`))
  } catch (e) {
    championsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    championsPending.value = false
  }
}
watch([filterRank, filterRole], loadChampions)

// Builds
const buildsChampionId = ref('')
const buildsRank = ref('')
const buildsData = ref<{
  totalGames: number
  builds: Array<{ items: number[]; games: number; wins: number; winrate: number; pickrate: number }>
} | null>(null)
const buildsPending = ref(false)
const buildsQuery = computed(() => {
  const params = new URLSearchParams()
  if (buildsRank.value) params.set('rankTier', buildsRank.value)
  params.set('minGames', '5')
  return params.toString() ? `?${params.toString()}` : ''
})
async function loadBuilds() {
  if (!buildsChampionId.value) return
  buildsPending.value = true
  try {
    buildsData.value = await $fetch(
      apiUrl(`/api/stats/champions/${buildsChampionId.value}/builds${buildsQuery.value}`)
    )
  } catch {
    buildsData.value = null
  } finally {
    buildsPending.value = false
  }
}
watch([buildsChampionId, buildsRank], loadBuilds)

// Runes
const runesChampionId = ref('')
const runesRank = ref('')
const runesData = ref<{
  totalGames: number
  runes: Array<{ runes?: unknown; games: number; wins: number; winrate: number; pickrate: number }>
} | null>(null)
const runesPending = ref(false)
const runesQuery = computed(() => {
  const params = new URLSearchParams()
  if (runesRank.value) params.set('rankTier', runesRank.value)
  params.set('minGames', '5')
  return params.toString() ? `?${params.toString()}` : ''
})
async function loadRunes() {
  if (!runesChampionId.value) return
  runesPending.value = true
  try {
    runesData.value = await $fetch(
      apiUrl(`/api/stats/champions/${runesChampionId.value}/runes${runesQuery.value}`)
    )
  } catch {
    runesData.value = null
  } finally {
    runesPending.value = false
  }
}
watch([runesChampionId, runesRank], loadRunes)

// Player search (by summoner name)
const playerSearchQuery = ref('')
const playerSearchPending = ref(false)
const playerSearchError = ref<string | null>(null)
const playerSearchResult = ref<{
  player: {
    puuid: string
    maskedPuid: string
    summonerName: string | null
    region: string
    rankTier: string | null
    totalGames: number
    totalWins: number
    winrate: number
  }
  championStats: Array<{ championId: number; games: number; wins: number; winrate: number }>
} | null>(null)

async function searchPlayer() {
  const name = playerSearchQuery.value.trim()
  if (!name) return
  playerSearchPending.value = true
  playerSearchError.value = null
  playerSearchResult.value = null
  try {
    const res = await $fetch<{
      player: NonNullable<typeof playerSearchResult.value>['player']
      championStats: NonNullable<typeof playerSearchResult.value>['championStats']
    }>(apiUrl(`/api/stats/players/search?name=${encodeURIComponent(name)}`))
    playerSearchResult.value = res
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    playerSearchError.value =
      msg.includes('404') || msg.includes('not found') ? t('statisticsPage.playerNotFound') : msg
  } finally {
    playerSearchPending.value = false
  }
}

/** Champions for Builds/Runes dropdown: game data first, then stats list so dropdown is never empty. */
const championsForSelect = computed(() => {
  const fromStore = championsStore.champions
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  if (fromStore.length > 0) return fromStore
  const fromStats = championsData.value?.champions ?? []
  return fromStats.map(c => ({
    id: `stats-${c.championId}`,
    key: String(c.championId),
    name: championName(c.championId) ?? `Champion ${c.championId}`,
  }))
})

/** Resolve champion by numeric id (API uses Riot champion key). */
function championByKey(championId: number): (typeof championsStore.champions)[0] | null {
  const champ = championsStore.champions.find(c => c.key === String(championId))
  return champ ?? null
}

function championName(championId: number): string | null {
  return championByKey(championId)?.name ?? null
}

function itemName(itemId: number): string | null {
  const item = itemsStore.items.find(i => i.id === String(itemId))
  return item?.name ?? null
}

function itemImageName(itemId: number): string | null {
  const item = itemsStore.items.find(i => i.id === String(itemId))
  return item?.image?.full ?? null
}

/** Riot perks: { styles: [ { style: 8100 }, { style: 8200 } ] } — style = tree ID */
function runeSetupLabel(runesUnknown: unknown): string {
  if (runesUnknown == null || typeof runesUnknown !== 'object') return '—'
  const perks = runesUnknown as { styles?: Array<{ style?: number }> }
  const styles = perks?.styles
  if (!Array.isArray(styles) || styles.length < 2) return '—'
  const primaryId = styles[0]?.style
  const secondaryId = styles[1]?.style
  const primary = primaryId != null ? runesStore.getRunePathById(primaryId)?.name : null
  const secondary = secondaryId != null ? runesStore.getRunePathById(secondaryId)?.name : null
  if (primary && secondary) return `${primary} / ${secondary}`
  if (primary) return primary
  if (secondary) return secondary
  return primaryId != null && secondaryId != null ? `${primaryId} / ${secondaryId}` : '—'
}

watch(activeTab, tab => {
  if (tab === 'builds' && buildsChampionId.value) loadBuilds()
  if (tab === 'runes' && runesChampionId.value) loadRunes()
})

onMounted(async () => {
  if (!versionStore.currentVersion) await versionStore.loadCurrentVersion()
  await Promise.all([
    championsStore.loadChampions(riotLocale.value),
    itemsStore.loadItems(riotLocale.value),
    runesStore.loadRunes(riotLocale.value),
  ])
  await loadChampions()
})
</script>
