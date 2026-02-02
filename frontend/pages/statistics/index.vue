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

      <!-- Tab: Champions -->
      <div v-show="activeTab === 'champions'" class="space-y-4">
        <div class="flex flex-wrap gap-4">
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
              <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
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
                v-for="row in championsData?.champions ?? []"
                :key="row.championId"
                class="hover:bg-surface/50"
              >
                <td class="px-4 py-2 font-medium text-text">
                  {{ championName(row.championId) || row.championId }}
                </td>
                <td class="px-4 py-2 text-text/90">{{ row.games }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.wins }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.winrate }}%</td>
                <td class="px-4 py-2 text-text/90">{{ row.pickrate }}%</td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="championsData?.totalGames != null && championsData?.champions?.length"
            class="border-t border-primary/20 px-4 py-2 text-xs text-text/70"
          >
            {{ t('statisticsPage.totalGames') }}: {{ championsData.totalGames }}
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
              <option v-for="c in championsForSelect" :key="c.id" :value="c.id">
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
              <option v-for="c in championsForSelect" :key="c.id" :value="c.id">
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
        </div>
      </div>

      <!-- Tab: Meilleurs joueurs -->
      <div v-show="activeTab === 'players'" class="space-y-4">
        <div class="flex flex-wrap gap-4">
          <div>
            <label for="players-champion" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.champion')
            }}</label>
            <select
              id="players-champion"
              v-model="playersChampionId"
              class="min-w-[180px] rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allChampions') }}</option>
              <option v-for="c in championsForSelect" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
          </div>
          <div>
            <label for="players-rank" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.filterRank')
            }}</label>
            <select
              id="players-rank"
              v-model="playersRank"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allRanks') }}</option>
              <option v-for="r in rankTiers" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <div>
            <label for="players-min" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.minGames')
            }}</label>
            <input
              id="players-min"
              v-model.number="playersMinGames"
              type="number"
              min="1"
              class="w-24 rounded border border-primary/50 bg-background px-3 py-2 text-text"
            />
          </div>
        </div>
        <div v-if="playersPending" class="text-text/70">{{ t('statisticsPage.loading') }}</div>
        <div v-else class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-primary/30 bg-surface/50">
              <tr>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.player') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.region') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.rank') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.games') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.winrate') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr v-for="row in playersData ?? []" :key="row.puuid" class="hover:bg-surface/50">
                <td class="px-4 py-2 font-medium text-text">
                  {{ row.summonerName || row.maskedPuid }}
                </td>
                <td class="px-4 py-2 text-text/90">{{ row.region }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.rankTier || '—' }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.totalGames }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.winrate }}%</td>
              </tr>
            </tbody>
          </table>
          <p v-if="playersData && !playersData.length" class="px-4 py-3 text-text/70">
            {{ t('statisticsPage.noData') }}
          </p>
        </div>
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
import { getItemImageUrl } from '~/utils/imageUrl'

definePageMeta({
  layout: 'default',
})

const { t, locale } = useI18n()
const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const versionStore = useVersionStore()
const { version: gameVersion } = useGameVersion()

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const activeTab = ref<'champions' | 'builds' | 'runes' | 'players'>('champions')
const tabs = computed(() => [
  { id: 'champions' as const, label: t('statisticsPage.tabChampions') },
  { id: 'builds' as const, label: t('statisticsPage.tabBuilds') },
  { id: 'runes' as const, label: t('statisticsPage.tabRunes') },
  { id: 'players' as const, label: t('statisticsPage.tabPlayers') },
])

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
const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

// Champions
const championsData = ref<{
  totalGames: number
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

// Players
const playersChampionId = ref('')
const playersRank = ref('')
const playersMinGames = ref(50)
const playersData = ref<Array<{
  puuid: string
  maskedPuid: string
  summonerName: string | null
  region: string
  rankTier: string | null
  totalGames: number
  totalWins: number
  winrate: number
}> | null>(null)
const playersPending = ref(false)
const playersQuery = computed(() => {
  const params = new URLSearchParams()
  if (playersRank.value) params.set('rankTier', playersRank.value)
  params.set('minGames', String(playersMinGames.value || 1))
  params.set('limit', playersChampionId.value ? '50' : '100')
  return params.toString() ? `?${params.toString()}` : ''
})
async function loadPlayers() {
  playersPending.value = true
  try {
    const base = playersChampionId.value
      ? `/api/stats/champions/${playersChampionId.value}/players`
      : '/api/stats/players'
    const res = await $fetch<{ players: typeof playersData.value }>(
      apiUrl(`${base}${playersQuery.value}`)
    )
    playersData.value = res.players ?? []
  } catch {
    playersData.value = []
  } finally {
    playersPending.value = false
  }
}
watch([playersChampionId, playersRank, playersMinGames], loadPlayers)

const championsForSelect = computed(() =>
  championsStore.champions.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
)

function championName(championId: number): string | null {
  const champ = championsStore.champions.find(c => c.id === String(championId))
  return champ?.name ?? null
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
  if (tab === 'players') loadPlayers()
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
