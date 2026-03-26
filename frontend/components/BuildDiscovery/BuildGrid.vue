<template>
  <div class="build-grid" :style="buildGridVars">
    <BuildDiscoveryListShell :empty="builds.length === 0">
      <template #empty>
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
      </template>
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
          <!-- <button
              class="rounded border border-accent/70 bg-surface px-2 py-1 text-xs text-text transition-colors hover:bg-accent/10"
              :title="t('theorycraft.testBuild')"
              @click.stop="goToTheorycraft(build)"
            >
              <span>{{ t('theorycraft.testBuild') }}</span>
            </button> -->
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
            </div>
            <!-- Dropdown -->
            <div
              v-if="openShareDropdown === build.id"
              class="absolute right-0 top-full z-50 mt-1 max-h-[min(80vh,320px)] w-52 overflow-y-auto rounded-lg border border-primary shadow-lg"
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
                @click="downloadBuildImage(build.id)"
              >
                <span class="text-base">⬇️</span>
                <span>{{ t('buildDiscovery.downloadImage') }}</span>
              </button>
              <button
                class="flex w-full items-center gap-2 border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                @click="copyBuildImage(build.id)"
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
    </BuildDiscoveryListShell>

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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { BuildDiscoveryListShell } from '@lelanation/builds-ui'
import BuildCard from '~/components/Build/BuildCard.vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useBuildStore } from '~/stores/BuildStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import type { Build } from '~/types/build'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useTooltipsPreference } from '~/composables/useTooltipsPreference'
import { useStreamerMode } from '~/composables/useStreamerMode'

const { t } = useI18n()
const buildStore = useBuildStore()
const { hydrated } = useClientHydrated()
const { isStreamerMode } = useStreamerMode()

// Global tooltip preference (shared state via composable)
const { tooltipsEnabled } = useTooltipsPreference()
const openShareDropdown = ref<string | null>(null)
const buildCardRefs = ref<Record<string, HTMLElement | null>>({})
const buildCardComponentRefs = ref<Record<string, { toggleFlipped: () => void } | null>>({})
const localFlippedMap = ref<Record<string, boolean>>({})
/** Variante actuellement affichée par build (null = principale). */
const displayedSubMap = ref<Record<string, number | null>>({})
const buildGridVars = computed(() => ({
  '--build-grid-card-width': isStreamerMode.value
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

const toggleBuildDescription = (buildId: string) => {
  buildCardComponentRefs.value[buildId]?.toggleFlipped()
  localFlippedMap.value[buildId] = !localFlippedMap.value[buildId]
}

const toggleShareDropdown = (buildId: string) => {
  if (openShareDropdown.value === buildId) {
    openShareDropdown.value = null
  } else {
    openShareDropdown.value = buildId
  }
}

const copyBuildLink = async (buildId: string) => {
  const subIdx = displayedSubMap.value[buildId]
  const subParam = typeof subIdx === 'number' ? `?sub=${subIdx}` : ''
  const buildUrl = `${window.location.origin}/builds/${buildId}${subParam}`
  try {
    await navigator.clipboard.writeText(buildUrl)
    openShareDropdown.value = null
  } catch (error) {
    const textarea = document.createElement('textarea')
    textarea.value = buildUrl
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    openShareDropdown.value = null
  }
}

const captureBuildImage = async (buildId: string): Promise<Blob | null> => {
  const cardElement = buildCardRefs.value[buildId]
  if (!cardElement) return null

  try {
    // Trouver le BuildCard à l'intérieur (élément avec classe build-card-wrapper)
    const buildCardWrapper = cardElement.querySelector('.build-card-wrapper') as HTMLElement
    if (!buildCardWrapper) return null

    // Attendre un peu pour s'assurer que tout est rendu
    await new Promise(resolve => setTimeout(resolve, 200))

    // Cloner l'élément pour éviter de modifier l'original
    const clonedElement = buildCardWrapper.cloneNode(true) as HTMLElement

    // Positionner le clone hors écran mais visible pour le rendu
    // IMPORTANT: Ne pas mettre opacity à 0, sinon dom-to-image-more ne peut pas capturer
    clonedElement.style.position = 'fixed'
    clonedElement.style.left = '-9999px'
    clonedElement.style.top = '0'
    clonedElement.style.zIndex = '9999'
    clonedElement.style.opacity = '1'
    clonedElement.style.visibility = 'visible'
    clonedElement.style.pointerEvents = 'none'
    document.body.appendChild(clonedElement)

    // Fonction pour forcer tous les backgrounds à être transparents sauf ceux explicitement définis
    const sanitizeStyles = (element: HTMLElement) => {
      const allElements = [element, ...Array.from(element.querySelectorAll('*'))] as HTMLElement[]

      // Fonction helper pour détecter si une couleur est blanche ou gris très clair
      const isWhiteOrLightGrey = (color: string): boolean => {
        if (!color) return false
        const normalized = color.toLowerCase().trim()

        // Couleurs blanches
        if (
          normalized === 'rgb(255, 255, 255)' ||
          normalized === 'rgba(255, 255, 255, 1)' ||
          normalized === '#ffffff' ||
          normalized === '#fff' ||
          normalized === 'white'
        ) {
          return true
        }

        // Gris très clair (comme rgb(229, 231, 235))
        const rgbMatch = normalized.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
        if (
          rgbMatch &&
          rgbMatch[1] !== undefined &&
          rgbMatch[2] !== undefined &&
          rgbMatch[3] !== undefined
        ) {
          const r = parseInt(rgbMatch[1], 10)
          const g = parseInt(rgbMatch[2], 10)
          const b = parseInt(rgbMatch[3], 10)
          // Si toutes les valeurs sont > 200, c'est très clair
          if (r > 200 && g > 200 && b > 200) {
            return true
          }
        }

        return false
      }

      allElements.forEach(el => {
        const computed = window.getComputedStyle(el)
        const style = el.style

        // Vérifier si c'est un séparateur (doit conserver son background)
        const isSeparator = el.classList.contains('separator-line')
        // Clés de spell et badges (niveau, MAX) : conserver fond opaque pour la capture (lisibilité)
        const isSpellOrLevelBadge =
          el.classList.contains('skill-key') ||
          el.classList.contains('level-badge') ||
          el.classList.contains('max-badge')

        // FORCER le background à transparent par défaut (sauf séparateurs et badges spell/niveau/max)
        if (!isSeparator && !isSpellOrLevelBadge) {
          style.backgroundColor = 'transparent'
        }

        // Pour skill-key, level-badge et max-badge : forcer des couleurs opaques pour dom-to-image
        if (el.classList.contains('skill-key')) {
          style.backgroundColor = 'rgba(0, 0, 0, 0.9)'
          style.color = computed.color || '#c9a227'
        } else if (el.classList.contains('level-badge')) {
          style.backgroundColor = '#c9a227'
          style.color = '#2563eb'
        } else if (el.classList.contains('max-badge')) {
          style.backgroundColor = '#7dd3fc'
          style.color = '#082f49'
          style.visibility = 'visible'
          style.opacity = '1'
        }

        // Puis appliquer seulement si une couleur est explicitement définie et non blanche/transparente
        const bgColor = computed.backgroundColor
        if (
          !isSpellOrLevelBadge &&
          bgColor &&
          !isWhiteOrLightGrey(bgColor) &&
          bgColor !== 'rgba(0, 0, 0, 0)' &&
          bgColor !== 'transparent'
        ) {
          style.backgroundColor = bgColor
          // Pour les séparateurs, aussi appliquer l'opacité
          if (isSeparator) {
            style.opacity = computed.opacity || '0.8'
          }
        }

        // Même chose pour les images de fond
        if (computed.backgroundImage && computed.backgroundImage !== 'none') {
          style.backgroundImage = computed.backgroundImage
          style.backgroundSize = computed.backgroundSize
          style.backgroundPosition = computed.backgroundPosition
          style.backgroundRepeat = computed.backgroundRepeat
        }

        // Supprimer les bordures blanches/gris clair
        const borderColor = computed.borderColor
        if (isWhiteOrLightGrey(borderColor)) {
          // Supprimer la bordure si elle est blanche/gris clair
          style.border = 'none'
          style.borderWidth = '0'
          style.borderColor = 'transparent'
        } else if (
          borderColor &&
          borderColor !== 'rgba(0, 0, 0, 0)' &&
          borderColor !== 'transparent'
        ) {
          // Garder la bordure seulement si elle a une couleur valide
          style.borderColor = borderColor
        } else {
          // Pas de bordure
          style.border = 'none'
        }

        // Remplacer color (mais pas si c'est noir par défaut)
        if (computed.color && computed.color !== 'rgb(0, 0, 0)') {
          style.color = computed.color
        }

        // Pour les séparateurs, s'assurer que la hauteur et la largeur sont préservées
        if (isSeparator) {
          style.width = computed.width || '100%'
          style.height = computed.height || '1px'
          style.margin = computed.margin || '8px 0'
        }
      })
    }

    // Forcer l'affichage de la face avant (retirer l'état "flipped" sur le clone)
    const flipContainers = clonedElement.querySelectorAll('.flip-container')
    flipContainers.forEach(fc => fc.classList.remove('flipped'))
    // Cacher explicitement les faces arrière pour éviter de capturer la liste des variantes
    const backFaces = clonedElement.querySelectorAll('.build-card-back') as NodeListOf<HTMLElement>
    backFaces.forEach(b => {
      b.style.display = 'none'
    })

    // Nettoyer les styles
    sanitizeStyles(clonedElement)

    // Attendre un peu pour que les styles soient appliqués et que le clone soit rendu
    await new Promise(resolve => setTimeout(resolve, 300))

    // Utiliser dom-to-image-more directement pour convertir en blob
    const domtoimage = await import('dom-to-image-more')
    const resultBlob = await domtoimage.toBlob(clonedElement, {
      bgcolor: '#0a0a14',
      quality: 1.0,
    })

    // Nettoyer : retirer le clone du DOM
    document.body.removeChild(clonedElement)

    return resultBlob
  } catch {
    return null
  }
}

const downloadBuildImage = async (buildId: string) => {
  try {
    const blob = await captureBuildImage(buildId)
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `build-${buildId}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    openShareDropdown.value = null
  } catch {
    // Failed to download image
  }
}

const copyBuildImage = async (buildId: string) => {
  try {
    const blob = await captureBuildImage(buildId)
    if (!blob) return

    // Utiliser l'API Clipboard pour copier l'image
    if (navigator.clipboard && navigator.clipboard.write) {
      const item = new ClipboardItem({ 'image/png': blob })
      await navigator.clipboard.write([item])
      openShareDropdown.value = null
    } else {
      // Fallback: convertir en data URL et copier via un élément temporaire
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const img = new Image()
        img.src = dataUrl
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            canvas.toBlob(async blob => {
              if (blob && navigator.clipboard && navigator.clipboard.write) {
                const item = new ClipboardItem({ 'image/png': blob })
                await navigator.clipboard.write([item])
              }
            })
          }
        }
      }
      reader.readAsDataURL(blob)
      openShareDropdown.value = null
    }
  } catch {
    // Failed to copy image
  }
}

const DESCRIPTION_MAX_CHARS = 250
const CARD_PADDING = 16
const AUTHOR_FONT = '14px system-ui, sans-serif'
const DESC_FONT = '12px system-ui, sans-serif'
const LINE_HEIGHT_AUTHOR = 20
const LINE_HEIGHT_DESC = 16
const TEXT_COLOR = 'rgba(255, 255, 255, 0.9)'
const TEXT_COLOR_DIM = 'rgba(255, 255, 255, 0.7)'

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const next = current ? `${current} ${w}` : w
    const m = ctx.measureText(next)
    if (m.width > maxWidth && current) {
      lines.push(current)
      current = w
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

async function captureBuildImageWithAuthorAndDescription(
  buildId: string,
  authorText: string,
  descriptionText: string
): Promise<Blob | null> {
  const blob = await captureBuildImage(buildId)
  if (!blob) return null

  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const cardWidth = img.width
      const cardHeight = img.height
      const descRaw = descriptionText.trim().slice(0, DESCRIPTION_MAX_CHARS)
      const descText = descRaw + (descRaw.length >= DESCRIPTION_MAX_CHARS ? '…' : '')

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }

      ctx.font = AUTHOR_FONT
      const authorWidth = cardWidth - CARD_PADDING * 2
      ctx.font = DESC_FONT
      const descLines = descText ? wrapText(ctx, descText, authorWidth) : []
      const descHeight =
        descLines.length > 0 ? descLines.length * LINE_HEIGHT_DESC + CARD_PADDING : 0
      const authorBlockHeight = CARD_PADDING + LINE_HEIGHT_AUTHOR
      const totalHeight = cardHeight + authorBlockHeight + descHeight + CARD_PADDING

      canvas.width = cardWidth
      canvas.height = totalHeight

      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, cardWidth, totalHeight)
      ctx.drawImage(img, 0, 0)

      let y = cardHeight + CARD_PADDING
      ctx.font = AUTHOR_FONT
      ctx.fillStyle = TEXT_COLOR
      ctx.fillText(
        `${t('buildDiscovery.byAuthor')} ${authorText}`,
        CARD_PADDING,
        y + LINE_HEIGHT_AUTHOR * 0.8
      )
      y += authorBlockHeight

      if (descLines.length > 0) {
        ctx.font = DESC_FONT
        ctx.fillStyle = TEXT_COLOR_DIM
        for (const line of descLines) {
          ctx.fillText(line, CARD_PADDING, y + LINE_HEIGHT_DESC * 0.8)
          y += LINE_HEIGHT_DESC
        }
      }

      canvas.toBlob(
        b => {
          URL.revokeObjectURL(img.src)
          resolve(b)
        },
        'image/png',
        1.0
      )
    }
    img.onerror = () => resolve(null)
    img.src = URL.createObjectURL(blob)
  })
}

async function copyBuildImageWithAuthorAndDescription(build: Build) {
  try {
    const authorText = (build.author || t('buildDiscovery.anonymous')).trim() || '—'
    const descText = getDisplayedDescription(build) || ''
    const blob = await captureBuildImageWithAuthorAndDescription(build.id, authorText, descText)
    if (!blob) return

    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    openShareDropdown.value = null
  } catch {
    const authorText = (build.author || t('buildDiscovery.anonymous')).trim() || '—'
    const descText = getDisplayedDescription(build) || ''
    const blob = await captureBuildImageWithAuthorAndDescription(build.id, authorText, descText)
    if (blob) {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `build-${build.id}-avec-auteur-description.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      openShareDropdown.value = null
    }
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

// const goToTheorycraft = async (build: Build) => {
//   if (!build) return
//   // Charger le build dans le store theorycraft avant de naviguer
//   const { useTheorycraftStore } = await import('~/stores/TheorycraftStore')
//   const theorycraftStore = useTheorycraftStore()
//   theorycraftStore.loadBuild(build)
//   navigateTo(localePath('/theorycraft'))
// }

onMounted(() => {
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
  gap: 10px;
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
