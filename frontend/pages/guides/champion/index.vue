<template>
  <div class="champion-guides min-h-screen px-4 pb-8 pt-4 text-text max-lg:px-3">
    <div class="champion-selector">
      <div class="champion-toolbar mb-3">
        <label for="champion-guides-search" class="sr-only">{{ t('common.search') }}</label>
        <input
          id="champion-guides-search"
          v-model="searchQuery"
          type="text"
          :placeholder="t('common.search')"
          class="champion-search-input ui-build-card-surface rounded-lg px-2 py-1 text-sm text-text placeholder:text-text/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        />
        <div class="champion-filter-bar flex flex-wrap">
          <button
            v-for="role in CHAMPION_GUIDE_ROLES"
            :key="role"
            type="button"
            :aria-pressed="selectedRoles.includes(role)"
            :class="[
              'champion-filter-btn ui-build-card-button text-sm font-semibold',
              selectedRoles.includes(role) ? 'is-active' : '',
            ]"
            @click="toggleRole(role)"
          >
            {{ t(`statisticsPage.championVideosRole.${role}`) }}
          </button>
        </div>
      </div>

      <div class="champions-list mt-2">
        <button
          v-for="champion in champions"
          :key="champion.id"
          type="button"
          :disabled="!isVisible(champion)"
          :title="champion.name"
          :class="['champ', isVisible(champion) ? '' : 'hide']"
          @click="openChampion(champion)"
        >
          <img
            :src="getChampionImageUrl(version, champion.image.full)"
            :alt="champion.name"
            loading="lazy"
            width="48"
            height="48"
            decoding="async"
          />
          <span v-if="counts[champion.name]" class="champ-count">
            {{ counts[champion.name] }}
          </span>
          <span
            v-if="matchupCounts[champion.name]"
            class="champ-matchup-count"
            :aria-label="
              t('championGuidesPage.matchupCount', { count: matchupCounts[champion.name] })
            "
          >
            {{ matchupCounts[champion.name] }}
          </span>
        </button>
      </div>

      <p v-if="!champions.some(isVisible)" class="py-8 text-center text-sm text-text/70">
        {{ t('championGuidesPage.noMatch') }}
      </p>
    </div>

    <ChampionGuidesModal
      :champion="selectedChampion"
      :version="version"
      :video-count="selectedChampion ? (counts[selectedChampion.name] ?? 0) : 0"
      :matchup-count="selectedChampion ? (matchupCounts[selectedChampion.name] ?? 0) : 0"
      @close="closeChampion"
    />
  </div>
</template>

<script setup lang="ts">
import ChampionGuidesModal from '~/components/Videos/ChampionGuidesModal.vue'
import { useGameVersion } from '~/composables/useGameVersion'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useYouTubeStore } from '~/stores/YouTubeStore'
import type { Champion } from '~/types/build'
import {
  CHAMPION_GUIDE_ROLES,
  championGuideRoles,
  championGuideVideoCounts,
  championMatchesGuideFilter,
  type ChampionGuideRole,
} from '~/utils/championGuideVideos'
import {
  championRolesWithMatchupGuides,
  matchupGuideCounts,
  matchupGuideRoles,
  type MatchupGuidesByChampion,
} from '~/utils/matchupGuidesSheet'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { riotLanguage } from '~/utils/riotLanguage'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const championsStore = useChampionsStore()
const youtube = useYouTubeStore()
const { version } = useGameVersion()

const searchQuery = ref('')
const selectedRoles = ref<ChampionGuideRole[]>([])

await championsStore.loadChampions(riotLanguage(locale.value)).catch(() => undefined)

const champions = computed(() =>
  [...championsStore.champions].sort((a, b) => a.name.localeCompare(b.name, locale.value))
)
const names = computed(() => champions.value.map(c => c.name))
const videos = computed(() => Object.values(youtube.channelDataById).flatMap(d => d?.videos ?? []))
const counts = computed(() => championGuideVideoCounts(videos.value, names.value))
const rolesByName = computed(() => championGuideRoles(videos.value, names.value))

const { data: matchupGuideData } = useLazyFetch<MatchupGuidesByChampion>('/matchup-guides.json', {
  key: 'matchup-guides',
  server: false,
  default: () => ({}),
})

const matchupCounts = computed(() => matchupGuideCounts(matchupGuideData.value ?? {}, names.value))
/** Filtre par rôle : rôles des vidéos + onglet du sheet des guides matchups. */
const filterRolesByName = computed(() =>
  championRolesWithMatchupGuides(
    rolesByName.value,
    matchupGuideRoles(matchupGuideData.value ?? {}, names.value)
  )
)

/** Champion ouvert dans la modale, gardé dans l'URL (?champion=ahri) pour partager le lien. */
const selectedChampion = computed<Champion | null>(() => {
  const slug = String(route.query.champion ?? '').toLowerCase()
  return slug ? (champions.value.find(c => c.id.toLowerCase() === slug) ?? null) : null
})

function openChampion(champion: Champion): void {
  router.replace({ query: { ...route.query, champion: champion.id.toLowerCase() } })
}

function closeChampion(): void {
  const { champion: _closed, ...query } = route.query
  router.replace({ query })
}

function toggleRole(role: ChampionGuideRole): void {
  const i = selectedRoles.value.indexOf(role)
  if (i > -1) selectedRoles.value.splice(i, 1)
  else selectedRoles.value.push(role)
}

/** Sans filtre, un champion sans guide est grisé ; avec filtre, ceux hors filtre le sont. */
function isVisible(champion: Champion): boolean {
  if (!counts.value[champion.name] && !matchupCounts.value[champion.name]) return false
  return championMatchesGuideFilter(
    { name: champion.name, roles: filterRolesByName.value[champion.name] ?? [] },
    searchQuery.value,
    selectedRoles.value
  )
}

onMounted(() => {
  youtube.loadAllChannelsData().catch(() => undefined)
})

useHead({
  title: () => t('championGuidesPage.title'),
  meta: [{ name: 'description', content: () => t('championGuidesPage.hint') }],
})
</script>

<style scoped>
.champion-selector {
  background: transparent !important;
}

.champion-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  width: 100%;
}

.champion-search-input {
  flex: 1 1 5rem;
  min-width: 5rem;
  max-width: 100%;
  width: auto;
}

.champion-filter-bar {
  flex: 0 1 auto;
  gap: 5px;
}

.champion-filter-btn {
  padding: 0.35rem 0.6rem;
  margin: 0;
}

.champions-list {
  --champSizeButton: 59px;
  display: grid;
  grid-template-columns: repeat(auto-fit, var(--champSizeButton));
  place-content: center;
  width: 100%;
  gap: 0;
}

.champ {
  border: 1px solid transparent;
  position: relative;
  height: var(--champSizeButton);
  width: var(--champSizeButton);
  background-color: unset;
  display: inline-block;
  line-height: 1rem;
  border-radius: 0;
  appearance: none;
  cursor: pointer;
  padding: 0;
  margin: 0;
  transition: border-color 0.2s;
}

.champ-count {
  position: absolute;
  right: 1px;
  bottom: 1px;
  min-width: 1rem;
  border-radius: 9999px;
  background: rgb(var(--rgb-accent));
  padding: 0 0.25rem;
  font-size: 10px;
  font-weight: 700;
  line-height: 1rem;
  text-align: center;
  color: rgb(var(--rgb-background));
  pointer-events: none;
}

.champ-matchup-count {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 1rem;
  border-radius: 9999px;
  background: #dc2626;
  padding: 0 0.25rem;
  font-size: 10px;
  font-weight: 700;
  line-height: 1rem;
  text-align: center;
  color: #fff;
  pointer-events: none;
}

.champ.hide {
  cursor: default;
}

.champ.hide .champ-count,
.champ.hide .champ-matchup-count {
  display: none;
}

.champ img {
  display: block;
  height: 100%;
  width: 100%;
  object-fit: cover;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
}

.champ.hide img {
  filter: grayscale(1) brightness(0.4);
}

.champ-dimmed img {
  filter: grayscale(1) brightness(0.45);
}

.champ-selected {
  position: absolute;
  inset: 0;
  border: 2px solid rgb(var(--rgb-accent));
  pointer-events: none;
}

@media (hover: hover) {
  .champ:hover {
    border-color: rgb(var(--rgb-accent));
    z-index: 1;
  }

  .champ-dimmed:hover img {
    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
  }
}

@media (max-width: 700px) {
  .champions-list {
    --champSizeButton: 48px;
  }
}
</style>
