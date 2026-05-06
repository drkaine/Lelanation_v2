<template>
  <div class="build-grid" :style="buildGridVars">
    <div v-if="builds.length === 0" class="py-12 text-center">
      <p class="text-lg text-text">{{ t('buildDiscovery.noBuildsFound') }}</p>
      <p class="mt-2 text-sm text-text/70">
        {{
          hasActiveFilters
            ? t('buildDiscovery.adjustFilters')
            : t('buildDiscovery.createFirstBuild')
        }}
      </p>
      <NuxtLink
        v-if="!hasActiveFilters"
        :to="localePath('/builds/create')"
        class="mt-4 inline-block rounded bg-accent px-6 py-2 text-background hover:bg-accent-dark"
      >
        {{ t('buildsPage.createBuild') }}
      </NuxtLink>
    </div>

    <div v-else class="build-grid-list">
      <div v-for="build in builds" :key="build.id" class="build-grid-item">
        <div class="mb-[3px] flex w-full items-center gap-2">
          <div class="build-grid-top-icon-slot">
            <button
              v-if="hasBuildDescription(build)"
              type="button"
              class="build-grid-top-icon-button"
              :title="localFlippedMap[build.id] ? 'Voir le build' : 'Voir la description'"
              :aria-label="localFlippedMap[build.id] ? 'Voir le build' : 'Voir la description'"
              @click.stop="toggleBuildDescription(build.id)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            </button>
            <div v-else class="build-grid-top-icon-spacer"></div>
          </div>
          <div class="build-grid-author-row">
            <span class="truncate font-semibold">
              {{ build.author || t('buildDiscovery.anonymous') }}
            </span>
            <button
              v-if="props.showUserActions"
              type="button"
              class="inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide transition-colors"
              :class="
                (build.visibility ?? 'public') === 'private'
                  ? 'border border-rose-500/50 bg-rose-500/15 text-rose-400 hover:bg-emerald-500/20 hover:text-emerald-300'
                  : 'border border-emerald-500/50 bg-emerald-500/15 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-300'
              "
              :title="
                (build.visibility ?? 'public') === 'private'
                  ? t('buildsPage.public')
                  : t('buildsPage.private')
              "
              @click.stop="$emit('toggle-visibility', build.id)"
            >
              {{
                (build.visibility ?? 'public') === 'private'
                  ? t('buildsPage.private')
                  : t('buildsPage.public')
              }}
            </button>
          </div>
          <div class="flex items-center gap-1">
            <button
              v-if="isAdmin"
              type="button"
              class="build-grid-top-icon-button"
              :title="t('buildDiscovery.adminStatsInfo')"
              :aria-label="t('buildDiscovery.adminStatsInfo')"
              @click.stop="openBuildStatsModal(build.id)"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 10v6" />
                <path d="M12 7h.01" />
              </svg>
            </button>
            <button
              type="button"
              class="build-grid-top-icon-button"
              :title="t('buildDiscovery.viewBuild')"
              :aria-label="t('buildDiscovery.viewBuild')"
              @click="navigateToBuild(build.id)"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        <!-- BuildCard Sheet -->
        <div class="relative w-full">
          <div :ref="el => setBuildCardRef(build.id, el)" :data-build-id="build.id">
            <BuildCard
              :ref="instance => setBuildCardComponentRef(build.id, instance)"
              :build="build"
              :readonly="true"
              :sheet-tooltips="tooltipsEnabled"
              :hide-top-actions="true"
              :initial-displayed-variant-index="
                getSearchMatchedVariantIndex(build, discoveryStore.searchQuery)
              "
              @variant-change="
                idx => {
                  displayedSubMap[build.id] = idx
                }
              "
            />
          </div>
        </div>

        <div class="mt-[5px] flex w-full items-stretch gap-1.5">
          <!-- Boutons de vote (désactivés pour les builds de l'utilisateur) -->
          <!-- Bouton Favori -->
          <button
            v-if="props.showFavoriteToggle"
            class="build-grid-action-button build-grid-action-button--icon"
            :class="
              favoritesStore.isFavorite(build.id)
                ? 'border-amber-500 bg-amber-500/15 text-amber-500 hover:bg-amber-500/25'
                : 'border-amber-500/70 bg-surface text-amber-500/70 hover:bg-amber-500/15 hover:text-amber-500'
            "
            :title="
              favoritesStore.isFavorite(build.id)
                ? t('buildDiscovery.removeFavorite')
                : t('buildDiscovery.addFavorite')
            "
            :aria-label="
              favoritesStore.isFavorite(build.id)
                ? t('buildDiscovery.removeFavorite')
                : t('buildDiscovery.addFavorite')
            "
            @click.stop="favoritesStore.toggleFavorite(build.id)"
          >
            <svg
              v-if="favoritesStore.isFavorite(build.id)"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="h-3 w-3"
              aria-hidden="true"
            >
              <path
                d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.5L6 22V3.75Z"
              />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-3 w-3"
              aria-hidden="true"
            >
              <path
                d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.5L6 22V3.75Z"
              />
            </svg>
          </button>
          <div v-if="!isUserBuild(build.id)" class="flex min-w-0 flex-[2] items-stretch gap-1.5">
            <!-- Bouton Upvote -->
            <button
              class="build-grid-action-button build-grid-action-button--vote"
              :class="
                getUserVote(build.id) === 'up'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'border border-green-600 bg-surface text-green-600 hover:bg-green-50'
              "
              :title="
                getUserVote(build.id) === 'up'
                  ? t('buildDiscovery.removeUpvote')
                  : t('buildDiscovery.upvoteBuild')
              "
              :aria-label="
                getUserVote(build.id) === 'up'
                  ? t('buildDiscovery.removeUpvote')
                  : t('buildDiscovery.upvoteBuild')
              "
              @click.stop="handleUpvote(build.id)"
            >
              <span>👍</span>
              <span>{{ getUpvoteCount(build.id) }}</span>
            </button>
            <!-- Bouton Downvote -->
            <button
              class="build-grid-action-button build-grid-action-button--vote"
              :class="
                getUserVote(build.id) === 'down'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'border border-red-600 bg-surface text-red-600 hover:bg-red-50'
              "
              :title="
                getUserVote(build.id) === 'down'
                  ? t('buildDiscovery.removeDownvote')
                  : t('buildDiscovery.downvoteBuild')
              "
              :aria-label="
                getUserVote(build.id) === 'down'
                  ? t('buildDiscovery.removeDownvote')
                  : t('buildDiscovery.downvoteBuild')
              "
              @click.stop="handleDownvote(build.id)"
            >
              <span>👎</span>
              <span>{{ getDownvoteCount(build.id) }}</span>
            </button>
          </div>
          <!-- Bouton Partager avec dropdown -->
          <div v-if="props.showComparisonButtons" class="relative flex-1">
            <div class="flex items-stretch gap-1.5">
              <NuxtLink
                v-if="props.showUserActions"
                :to="localePath(`/builds/create/rune?editId=${build.id}`)"
                class="build-grid-action-button build-grid-action-button--icon build-grid-action-button--edit"
                :title="t('buildDiscovery.editBuild')"
                :aria-label="t('buildDiscovery.editBuild')"
                @click.stop
              >
                ✎
              </NuxtLink>
              <button
                :ref="el => setShareButtonRef(build.id, el)"
                class="build-grid-action-button build-grid-action-button--icon flex-1"
                :title="t('buildDiscovery.share')"
                :aria-label="t('buildDiscovery.share')"
                @click.stop="toggleShareDropdown(build.id)"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
                </svg>
              </button>
              <button
                v-if="props.showUserActions"
                type="button"
                class="build-grid-action-button build-grid-action-button--icon build-grid-action-button--delete"
                :title="t('buildDiscovery.deleteBuild')"
                :aria-label="t('buildDiscovery.deleteBuild')"
                @click.stop="$emit('delete-build', build.id)"
              >
                ✕
              </button>
              <button
                v-if="isCompanionAppEmbed"
                type="button"
                class="build-grid-action-button build-grid-action-button--icon build-grid-action-button--companion"
                :title="t('buildDiscovery.importInCompanion')"
                :aria-label="t('buildDiscovery.importInCompanion')"
                @click.stop="sendBuildToCompanion(build)"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 4v10" />
                  <path d="m8 10 4 4 4-4" />
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </button>
            </div>
            <!-- Dropdown -->
            <div
              v-if="openShareDropdown === build.id"
              :class="[
                'absolute right-0 z-50 w-52 rounded-lg border border-primary shadow-lg',
                shareDropdownOpenAbove[build.id] ? 'bottom-full mb-1' : 'top-full mt-1',
              ]"
              style="background-color: rgb(26, 26, 46)"
              @click.stop
            >
              <button
                v-if="!isPrivateBuild(build)"
                class="flex w-full items-center gap-2 rounded-t-lg px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                @click="copyBuildLink(build.id)"
              >
                <span class="text-base">🔗</span>
                <span>{{ t('buildDiscovery.copyLink') }}</span>
              </button>
              <button
                class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                :class="!isPrivateBuild(build) ? 'border-t border-primary' : 'rounded-t-lg'"
                @click="downloadBuildImage(build)"
              >
                <span class="text-base">⬇️</span>
                <span>{{ t('buildDiscovery.downloadImage') }}</span>
              </button>
              <button
                class="flex w-full items-center gap-2 border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                @click="copyBuildImage(build)"
              >
                <span class="text-base">📋</span>
                <span>{{ t('buildDiscovery.copyImage') }}</span>
              </button>
              <button
                class="flex w-full items-center gap-2 rounded-b-lg border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                @click="copyBuildImageWithAuthorAndDescription(build)"
              >
                <span class="text-base">🖼️</span>
                <span>{{ t('buildDiscovery.shareImageWithAuthorDescription') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="adminStatsModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      @click="closeBuildStatsModal"
    >
      <div
        class="w-full max-w-md rounded-lg border border-primary/30 bg-surface p-4 text-text"
        @click.stop
      >
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-base font-semibold">{{ t('buildDiscovery.adminStatsTitle') }}</h3>
          <button
            type="button"
            class="rounded px-2 py-1 text-sm hover:bg-primary/20"
            @click="closeBuildStatsModal"
          >
            ✕
          </button>
        </div>
        <p class="mb-3 text-xs text-text/70">
          {{ t('buildDiscovery.adminStatsBuildId') }}: {{ adminStatsBuildId }}
        </p>
        <p v-if="adminStatsLoading" class="text-sm text-text/70">{{ t('admin.loading') }}</p>
        <p v-else-if="adminStatsError" class="text-sm text-error">{{ adminStatsError }}</p>
        <div v-else-if="adminStatsData" class="space-y-2 text-sm">
          <div class="flex items-center justify-between">
            <span>{{ t('buildDiscovery.adminStatsViews') }}</span>
            <strong>{{ adminStatsData.views }}</strong>
          </div>
          <div class="flex items-center justify-between">
            <span>{{ t('buildDiscovery.adminStatsSharesTotal') }}</span>
            <strong>{{ adminStatsData.sharesTotal }}</strong>
          </div>
          <div class="mt-2 rounded border border-primary/30 bg-background/40 p-2 text-xs">
            <div class="flex items-center justify-between">
              <span>{{ t('buildDiscovery.adminStatsSharesLink') }}</span>
              <strong>{{ adminStatsData.shares.link }}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span>{{ t('buildDiscovery.adminStatsSharesImage') }}</span>
              <strong>{{ adminStatsData.shares.image }}</strong>
            </div>
            <div class="flex items-center justify-between">
              <span>{{ t('buildDiscovery.adminStatsSharesImageMeta') }}</span>
              <strong>{{ adminStatsData.shares.image_with_meta }}</strong>
            </div>
          </div>
          <p class="text-xs text-text/60">
            {{ t('buildDiscovery.adminStatsLastView') }}:
            {{ formatAdminStatsDate(adminStatsData.lastViewedAt) }}
          </p>
          <p class="text-xs text-text/60">
            {{ t('buildDiscovery.adminStatsLastShare') }}:
            {{ formatAdminStatsDate(adminStatsData.lastSharedAt) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Pagination (Discover, Mes builds, Favoris) -->
    <div
      v-if="showPagination"
      class="mt-6 flex flex-wrap items-center justify-center gap-3"
      role="navigation"
      aria-label="Pagination"
    >
      <button
        type="button"
        class="pagination-btn disabled:opacity-50"
        :disabled="discoveryStore.currentPage <= 1"
        :aria-label="t('buildDiscovery.previousPage')"
        @click="discoveryStore.setPage(discoveryStore.currentPage - 1)"
      >
        {{ t('buildDiscovery.previousPage') }}
      </button>
      <span class="text-sm text-text">
        {{
          t('buildDiscovery.pageXOfY', {
            current: discoveryStore.currentPage,
            total: totalPagesForPagination,
          })
        }}
      </span>
      <button
        type="button"
        class="pagination-btn disabled:opacity-50"
        :disabled="discoveryStore.currentPage >= totalPagesForPagination"
        :aria-label="t('buildDiscovery.nextPage')"
        @click="discoveryStore.setPage(discoveryStore.currentPage + 1)"
      >
        {{ t('buildDiscovery.nextPage') }}
      </button>
    </div>
    <NotificationToast
      v-if="shareToastMessage"
      :message="shareToastMessage"
      :type="shareToastType"
      :duration="2800"
      @close="closeShareToast"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BuildCard from '~/components/Build/BuildCard.vue'
import NotificationToast from '~/components/NotificationToast.vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useBuildStore } from '~/stores/BuildStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import type { Build } from '~/types/build'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useTooltipsPreference } from '~/composables/useTooltipsPreference'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { apiUrl } from '~/utils/apiUrl'
import {
  fetchBuildCardSharePngResilient,
  copyPngBlobToClipboard,
} from '~/utils/buildCardShareImage'
import { useChampionSplashPreference } from '~/composables/useChampionSplashPreference'

const { t, locale } = useI18n()
const { championSplashEnabled } = useChampionSplashPreference()
const buildStore = useBuildStore()
const { hydrated } = useClientHydrated()
const { isLayoutScaled } = useLayoutScaled()

// Global tooltip preference (shared state via composable)
const { tooltipsEnabled } = useTooltipsPreference()
const openShareDropdown = ref<string | null>(null)
const shareToastMessage = ref('')
const shareToastType = ref<'success' | 'error'>('success')
const shareButtonRefs = ref<Record<string, HTMLButtonElement | null>>({})
const shareDropdownOpenAbove = ref<Record<string, boolean>>({})
const buildCardRefs = ref<Record<string, HTMLElement | null>>({})
const buildCardComponentRefs = ref<Record<string, { toggleFlipped: () => void } | null>>({})
const localFlippedMap = ref<Record<string, boolean>>({})
const isAdmin = ref(false)
const adminStatsModalOpen = ref(false)
const adminStatsLoading = ref(false)
const adminStatsError = ref('')
const adminStatsBuildId = ref('')
const adminStatsData = ref<{
  views: number
  sharesTotal: number
  shares: { link: number; image: number; image_with_meta: number }
  lastViewedAt: string | null
  lastSharedAt: string | null
} | null>(null)
/** Variante actuellement affichée par build (null = principale). */
const displayedSubMap = ref<Record<string, number | null>>({})
const { fetchWithAuth, checkLoggedIn } = useAdminAuth()
const buildGridVars = computed(() => ({
  '--build-grid-card-width': isLayoutScaled.value
    ? 'min(390px, calc(100vw - 30px))'
    : 'min(300px, calc(100vw - 30px))',
}))

function getDisplayedDescription(build: Build): string | undefined {
  const mode = build.descriptionMode ?? 'single'
  const idx = displayedSubMap.value[build.id]
  if (mode === 'single' || idx == null) {
    return build.description
  }
  const sub = (build.subBuilds ?? [])[idx]
  return sub?.description ?? build.description
}

function hasBuildDescription(build: Build): boolean {
  return Boolean(getDisplayedDescription(build)?.trim())
}

/**
 * Si une recherche est active et que seul un titre de variante matche (pas le build principal),
 * retourne l'index de la première variante qui matche pour afficher cette variante par défaut.
 */
function getSearchMatchedVariantIndex(build: Build, searchQuery: string): number | null {
  const query = searchQuery?.toLowerCase().trim()
  if (!query) return null
  const mainMatches =
    build.name?.toLowerCase().includes(query) ||
    build.champion?.name?.toLowerCase().includes(query) ||
    build.champion?.id?.toLowerCase().includes(query) ||
    build.author?.toLowerCase().includes(query)
  if (mainMatches) return null
  const subBuilds = build.subBuilds ?? []
  const idx = subBuilds.findIndex(sub => sub.title?.toLowerCase().includes(query))
  return idx >= 0 ? idx : null
}

interface Props {
  showComparisonButtons?: boolean
  customBuilds?: Build[]
  showUserActions?: boolean
  showFavoriteToggle?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showComparisonButtons: true,
  customBuilds: undefined,
  showUserActions: false,
  showFavoriteToggle: false,
})

defineEmits<{
  'delete-build': [buildId: string]
  'toggle-visibility': [buildId: string]
}>()

const discoveryStore = useBuildDiscoveryStore()
const voteStore = useVoteStore()
const favoritesStore = useFavoritesStore()
const router = useRouter()
const route = useRoute()
const isCompanionAppEmbed = computed(
  () => route.query.app === 'on' || route.query.source === 'companion'
)

// Filtrer les customBuilds avec les mêmes critères que discoveryStore
const filteredCustomBuilds = computed(() => {
  if (!props.customBuilds) return null

  let results = [...props.customBuilds]
  // Search by build name, variant titles, champion name or author
  if (discoveryStore.searchQuery) {
    const query = discoveryStore.searchQuery.toLowerCase().trim()
    results = results.filter(build => {
      if (build.name?.toLowerCase().includes(query)) return true
      if (build.champion?.name?.toLowerCase().includes(query)) return true
      if (build.champion?.id?.toLowerCase().includes(query)) return true
      if (build.author?.toLowerCase().includes(query)) return true
      const subBuilds = build.subBuilds ?? []
      if (subBuilds.some(sub => sub.title?.toLowerCase().includes(query))) return true
      return false
    })
  }

  // Filter by champion
  if (discoveryStore.selectedChampion) {
    results = results.filter(build => build.champion?.id === discoveryStore.selectedChampion)
  }

  // Filter by role
  if (discoveryStore.selectedRole) {
    results = results.filter(build => build.roles?.includes(discoveryStore.selectedRole!))
  }

  // Filter by build tag
  if (discoveryStore.selectedTag) {
    const tag = discoveryStore.selectedTag
    results = results.filter(build => {
      if (build.tags?.includes(tag)) return true
      return (build.subBuilds ?? []).some(sub => sub.tags?.includes(tag))
    })
  }

  // Filter by version
  if (discoveryStore.selectedVersion) {
    results = results.filter(build => build.gameVersion === discoveryStore.selectedVersion)
  }

  // Sort
  switch (discoveryStore.sortBy) {
    case 'recent':
      results.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime()
        const dateB = new Date(b.createdAt || 0).getTime()
        return dateB - dateA
      })
      break
    case 'popular': {
      results.sort((a, b) => {
        const votesA = voteStore.getVoteCount(a.id)
        const votesB = voteStore.getVoteCount(b.id)
        if (votesA !== votesB) {
          return votesB - votesA
        }
        // If same votes, sort by most recent
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      })
      break
    }
    case 'name':
      results.sort((a, b) => {
        const nameA = a.name?.toLowerCase() || ''
        const nameB = b.name?.toLowerCase() || ''
        return nameA.localeCompare(nameB)
      })
      break
  }

  return results
})

// Pagination: same store (pageSize, currentPage) for Discover and for custom lists (Mes builds, Favoris)
const customTotalCount = computed(() => filteredCustomBuilds.value?.length ?? 0)
const customTotalPages = computed(() => {
  if (!props.customBuilds) return 0
  if (discoveryStore.pageSize === 'all') return 1
  const n = discoveryStore.pageSize
  return customTotalCount.value === 0 ? 0 : Math.ceil(customTotalCount.value / n)
})
const customPaginatedBuilds = computed(() => {
  const list = filteredCustomBuilds.value
  if (!list) return []
  if (discoveryStore.pageSize === 'all') return list
  const start = (discoveryStore.currentPage - 1) * discoveryStore.pageSize
  return list.slice(start, start + discoveryStore.pageSize)
})

const builds = computed(() =>
  props.customBuilds ? customPaginatedBuilds.value : discoveryStore.paginatedBuilds
)
const totalPagesForPagination = computed(() =>
  props.customBuilds ? customTotalPages.value : discoveryStore.totalPages
)
const showPagination = computed(() => totalPagesForPagination.value > 1)

// Clamp current page when custom list has fewer pages (e.g. switch tab or filter)
watch(
  () => [props.customBuilds, customTotalPages.value] as const,
  ([hasCustom, total]) => {
    if (hasCustom && typeof total === 'number' && total >= 1) {
      discoveryStore.clampPageToMax(total)
    }
  },
  { immediate: true }
)

const hasActiveFilters = computed(() => {
  return (
    !!discoveryStore.searchQuery ||
    !!discoveryStore.selectedChampion ||
    !!discoveryStore.selectedRole ||
    !!discoveryStore.selectedVersion ||
    discoveryStore.sortBy !== 'recent'
  )
})

const localePath = useLocalePath()
const navigateToBuild = (buildId: string) => {
  router.push(localePath(`/builds/${buildId}`))
}

function sendBuildToCompanion(build: Build) {
  if (typeof window === 'undefined') return
  const parentWindow = window.parent
  if (!parentWindow || parentWindow === window) return

  const subIdx = displayedSubMap.value[build.id]
  const selectedSub =
    typeof subIdx === 'number' && subIdx >= 0 ? (build.subBuilds ?? [])[subIdx] : null
  const buildForImport: Build = selectedSub
    ? {
        ...build,
        name: selectedSub.title || build.name,
        description: selectedSub.description ?? build.description,
        items: selectedSub.items,
        runes: selectedSub.runes,
        shards: selectedSub.shards,
        summonerSpells: selectedSub.summonerSpells,
        skillOrder: selectedSub.skillOrder,
        roles: selectedSub.roles,
        tags: selectedSub.tags ?? build.tags,
        gameVersion: selectedSub.gameVersion || build.gameVersion,
      }
    : build

  parentWindow.postMessage(
    {
      type: 'lelanation:companion-import-build',
      payload: {
        build: buildForImport,
      },
    },
    '*'
  )
}

const getUpvoteCount = (buildId: string): number => {
  return voteStore.getUpvoteCount(buildId)
}

const getDownvoteCount = (buildId: string): number => {
  return voteStore.getDownvoteCount(buildId)
}

const getUserVote = (buildId: string): 'up' | 'down' | null => {
  return voteStore.getUserVote(buildId)
}

const handleUpvote = async (buildId: string) => {
  voteStore.upvote(buildId)
  await buildStore.checkAndUpdateVisibility(buildId)
}

const handleDownvote = async (buildId: string) => {
  voteStore.downvote(buildId)
  await buildStore.checkAndUpdateVisibility(buildId)
}

const isUserBuild = (buildId: string): boolean => {
  if (!hydrated.value) return false
  const savedBuilds = buildStore.getSavedBuilds()
  return savedBuilds.some(b => b.id === buildId)
}

const isPrivateBuild = (build: Build): boolean => (build.visibility ?? 'public') === 'private'
const SHARE_DROPDOWN_ESTIMATED_HEIGHT_PX = 190
const VIEWPORT_SAFE_MARGIN_PX = 12

const setBuildCardRef = (buildId: string, el: unknown) => {
  if (el && el instanceof HTMLElement) {
    // Stocker la référence au div qui contient le BuildCard
    buildCardRefs.value[buildId] = el
  }
}

const setBuildCardComponentRef = (buildId: string, instance: unknown) => {
  if (
    instance &&
    typeof instance === 'object' &&
    'toggleFlipped' in instance &&
    typeof instance.toggleFlipped === 'function'
  ) {
    buildCardComponentRefs.value[buildId] = instance as { toggleFlipped: () => void }
    return
  }
  buildCardComponentRefs.value[buildId] = null
}

const setShareButtonRef = (buildId: string, el: unknown) => {
  if (el && el instanceof HTMLButtonElement) {
    shareButtonRefs.value[buildId] = el
    return
  }
  shareButtonRefs.value[buildId] = null
}

const toggleBuildDescription = (buildId: string) => {
  buildCardComponentRefs.value[buildId]?.toggleFlipped()
  localFlippedMap.value[buildId] = !localFlippedMap.value[buildId]
}

const toggleShareDropdown = (buildId: string) => {
  if (openShareDropdown.value === buildId) {
    openShareDropdown.value = null
  } else {
    const trigger = shareButtonRefs.value[buildId]
    if (trigger) {
      const rect = trigger.getBoundingClientRect()
      const wouldOverflowBottom =
        rect.bottom + SHARE_DROPDOWN_ESTIMATED_HEIGHT_PX + VIEWPORT_SAFE_MARGIN_PX >
        window.innerHeight
      shareDropdownOpenAbove.value[buildId] = wouldOverflowBottom
    } else {
      shareDropdownOpenAbove.value[buildId] = false
    }
    openShareDropdown.value = buildId
  }
}

type ShareTrackType = 'link' | 'image' | 'image_with_meta'

async function trackBuildShare(buildId: string, shareType: ShareTrackType) {
  try {
    await fetch(apiUrl(`/api/builds/${encodeURIComponent(buildId)}/track-share`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareType }),
    })
  } catch {
    // Ignore analytics errors
  }
}

function showShareToast(message: string, type: 'success' | 'error' = 'success') {
  shareToastMessage.value = ''
  shareToastType.value = type
  requestAnimationFrame(() => {
    shareToastMessage.value = message
  })
}

function closeShareToast() {
  shareToastMessage.value = ''
}

const copyBuildLink = async (buildId: string) => {
  const subIdx = displayedSubMap.value[buildId]
  const subParam = typeof subIdx === 'number' ? `?sub=${subIdx}` : ''
  const buildUrl = `${window.location.origin}/builds/${buildId}${subParam}`

  try {
    await navigator.clipboard.writeText(buildUrl)
    trackBuildShare(buildId, 'link').catch(() => {})
    openShareDropdown.value = null
    showShareToast(t('buildDiscovery.linkCopied'), 'success')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = buildUrl
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)

    if (copied) {
      trackBuildShare(buildId, 'link').catch(() => {})
      openShareDropdown.value = null
      showShareToast(t('buildDiscovery.linkCopied'), 'success')
    } else {
      showShareToast(t('buildDiscovery.imageCopyError'), 'error')
    }
  }
}

function shareImageOptionsForBuild(buildId: string, meta: boolean) {
  const sub = displayedSubMap.value[buildId]
  return {
    sub: typeof sub === 'number' ? sub : null,
    meta,
    splash: championSplashEnabled.value,
  }
}

const downloadBuildImage = async (build: Build) => {
  try {
    const blob = await fetchBuildCardSharePngResilient(
      build,
      locale.value,
      shareImageOptionsForBuild(build.id, false)
    )
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `build-${build.id}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    trackBuildShare(build.id, 'image').catch(() => {})
    openShareDropdown.value = null
  } catch {
    // Failed to download image
  }
}

const copyBuildImage = async (build: Build) => {
  try {
    const blob = await fetchBuildCardSharePngResilient(
      build,
      locale.value,
      shareImageOptionsForBuild(build.id, false)
    )
    if (!blob) {
      console.warn('[BuildGrid] fetch build card png returned null', build.id)
      showShareToast(t('buildDiscovery.imageCopyError'), 'error')
      return
    }

    const copied = await copyPngBlobToClipboard(blob)
    if (!copied) {
      showShareToast(t('buildDiscovery.imageCopyError'), 'error')
      return
    }

    trackBuildShare(build.id, 'image').catch(() => {})
    openShareDropdown.value = null
    showShareToast(t('buildDiscovery.imageCopied'), 'success')
  } catch {
    showShareToast(t('buildDiscovery.imageCopyError'), 'error')
  }
}

async function copyBuildImageWithAuthorAndDescription(build: Build) {
  try {
    const blob = await fetchBuildCardSharePngResilient(
      build,
      locale.value,
      shareImageOptionsForBuild(build.id, true)
    )
    if (!blob) {
      console.warn('[BuildGrid] fetch build card png (meta) returned null', build.id)
      showShareToast(t('buildDiscovery.imageCopyError'), 'error')
      return
    }

    const copied = await copyPngBlobToClipboard(blob)
    if (!copied) {
      showShareToast(t('buildDiscovery.imageCopyError'), 'error')
      return
    }

    trackBuildShare(build.id, 'image_with_meta').catch(() => {})
    openShareDropdown.value = null
    showShareToast(t('buildDiscovery.imageCopied'), 'success')
  } catch {
    showShareToast(t('buildDiscovery.imageCopyError'), 'error')
  }
}

function formatAdminStatsDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

function closeBuildStatsModal() {
  adminStatsModalOpen.value = false
  adminStatsBuildId.value = ''
  adminStatsData.value = null
  adminStatsError.value = ''
}

async function openBuildStatsModal(buildId: string) {
  adminStatsModalOpen.value = true
  adminStatsBuildId.value = buildId
  adminStatsLoading.value = true
  adminStatsError.value = ''
  adminStatsData.value = null
  try {
    const res = await fetchWithAuth(
      apiUrl(`/api/admin/builds/${encodeURIComponent(buildId)}/engagement`)
    )
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      adminStatsError.value = 'Impossible de charger les stats.'
      return
    }
    adminStatsData.value = {
      views: Number(data.views) || 0,
      sharesTotal: Number(data.sharesTotal) || 0,
      shares: {
        link: Number(data.shares?.link) || 0,
        image: Number(data.shares?.image) || 0,
        image_with_meta: Number(data.shares?.image_with_meta) || 0,
      },
      lastViewedAt: typeof data.lastViewedAt === 'string' ? data.lastViewedAt : null,
      lastSharedAt: typeof data.lastSharedAt === 'string' ? data.lastSharedAt : null,
    }
  } catch {
    adminStatsError.value = 'Impossible de charger les stats.'
  } finally {
    adminStatsLoading.value = false
  }
}

// Fermer le dropdown si on clique ailleurs
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  // Vérifier si le clic est en dehors du dropdown
  const clickedInsideDropdown = target.closest('.relative') && target.closest('button')
  if (!clickedInsideDropdown) {
    openShareDropdown.value = null
  }
}

onMounted(() => {
  if (checkLoggedIn()) {
    fetchWithAuth(apiUrl('/api/admin/me'))
      .then(r => {
        isAdmin.value = r.ok
      })
      .catch(() => {
        isAdmin.value = false
      })
  } else {
    isAdmin.value = false
  }
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.build-grid-list {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-evenly;
  gap: 15px;
  padding-inline: 5px;
  box-sizing: border-box;
}

.build-grid-item {
  padding-bottom: 15px;
  display: flex;
  width: min(100%, var(--build-grid-card-width));
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}

.build-grid-top-icon-slot {
  display: flex;
  width: 28px;
  flex: 0 0 28px;
}

.build-grid-top-icon-button {
  display: inline-flex;
  height: 30px;
  width: 30px;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.55);
  border-radius: 8px;
  background: rgb(var(--rgb-background) / 0.22);
  color: rgb(var(--rgb-text));
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.build-grid-top-icon-spacer {
  width: 30px;
  height: 30px;
}

.build-grid-top-icon-button--delete {
  border-color: rgb(127 29 29 / 0.85);
  background: rgb(127 29 29 / 0.28);
  color: rgb(254 202 202);
  font-size: 13px;
  font-weight: 700;
}

.build-grid-top-icon-button--delete:hover {
  border-color: rgb(153 27 27 / 1);
  background: rgb(153 27 27 / 0.5);
  color: rgb(254 226 226);
}

.build-grid-top-icon-button--edit {
  border-color: rgb(56 189 248 / 0.85);
  background: rgb(56 189 248 / 0.24);
  color: rgb(186 230 253);
  font-size: 13px;
  font-weight: 700;
}

.build-grid-top-icon-button--edit:hover {
  border-color: rgb(14 165 233 / 1);
  background: rgb(14 165 233 / 0.42);
  color: rgb(224 242 254);
}

.build-grid-top-icon-button:hover {
  background: rgb(var(--rgb-accent) / 0.14);
  border-color: rgb(var(--rgb-accent) / 0.8);
  color: var(--color-accent);
}

.build-grid-author-row {
  display: flex;
  min-width: 0;
  flex: 1;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 6px;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-gold-300);
  text-align: center;
  text-transform: uppercase;
}

.build-grid-action-button {
  display: inline-flex;
  height: 32px;
  min-height: 32px;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid rgb(var(--rgb-accent) / 0.55);
  border-radius: 8px;
  background: rgb(var(--rgb-background) / 0.22);
  padding: 0.35rem 0.45rem;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.build-grid-action-button--icon {
  flex: 1;
}

.build-grid-action-button--vote {
  flex: 1 1 0;
}

.build-grid-action-button--companion {
  border-color: rgb(3 151 171 / 0.85);
  background: rgb(3 151 171 / 0.16);
  color: rgb(207 250 254);
  font-weight: 700;
}

.build-grid-action-button--companion:hover {
  border-color: rgb(3 151 171 / 1);
  background: rgb(3 151 171 / 0.3);
}

.build-grid-action-button--delete {
  border-color: rgb(127 29 29 / 0.85);
  background: rgb(127 29 29 / 0.28);
  color: rgb(254 202 202);
  font-size: 13px;
  font-weight: 700;
}

.build-grid-action-button--delete:hover {
  border-color: rgb(153 27 27 / 1);
  background: rgb(153 27 27 / 0.5);
  color: rgb(254 226 226);
}

.build-grid-action-button--edit {
  border-color: rgb(56 189 248 / 0.85);
  background: rgb(56 189 248 / 0.24);
  color: rgb(186 230 253);
  font-size: 13px;
  font-weight: 700;
}

.build-grid-action-button--edit:hover {
  border-color: rgb(14 165 233 / 1);
  background: rgb(14 165 233 / 0.42);
  color: rgb(224 242 254);
}

.pagination-btn {
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  color: rgb(var(--rgb-text));
  transition: background-color 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: rgb(var(--rgb-primary) / 0.2);
}

@media (max-width: 639px) {
  .build-grid-list {
    justify-content: center;
    padding-inline: 0;
  }
}
</style>
