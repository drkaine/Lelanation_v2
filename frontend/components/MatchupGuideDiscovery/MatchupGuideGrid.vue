<template>
  <div class="matchup-guide-grid">
    <div v-if="discoveryStore.loading" class="py-12 text-center text-text/70">
      {{ t('matchupGuideDiscovery.loading') }}
    </div>

    <div v-else-if="discoveryStore.loadError" class="py-12 text-center">
      <p class="text-lg text-red-400">{{ t('matchupGuideDiscovery.loadError') }}</p>
      <p class="mt-2 text-sm text-text/70">{{ discoveryStore.loadError }}</p>
    </div>

    <div v-else-if="guides.length === 0" class="py-12 text-center">
      <p class="text-lg text-text">{{ t('matchupGuideDiscovery.noGuidesFound') }}</p>
      <p class="mt-2 text-sm text-text/70">
        {{
          hasActiveFilters
            ? t('matchupGuideDiscovery.adjustFilters')
            : t('matchupGuideDiscovery.emptyState')
        }}
      </p>
    </div>

    <template v-else>
      <div class="matchup-guide-grid-list">
        <div v-for="guide in guides" :key="guide.id" class="matchup-guide-grid-item">
          <div class="matchup-guide-grid-author-row">
            <span class="truncate font-semibold">
              {{ guide.author?.trim() || t('matchupGuideDiscovery.authorAnonymous') }}
            </span>
            <span
              v-if="(guide.visibility ?? 'public') === 'private'"
              class="matchup-guide-grid-author-badge matchup-guide-grid-author-badge--private"
            >
              {{ t('buildsPage.private') }}
            </span>
          </div>

          <NuxtLink :to="matchupGuideDetailPath(guide, localePath)" class="matchup-guide-card-link">
            <MatchupGuideCard :guide="guide" />
          </NuxtLink>

          <div v-if="!hideBottomActions" class="matchup-guide-grid-actions">
            <button
              v-if="showFavoriteToggle"
              type="button"
              class="matchup-guide-grid-action-button matchup-guide-grid-action-button--icon"
              :class="
                favoritesStore.isFavorite(guide.id)
                  ? 'border-amber-500 bg-amber-500/15 text-amber-500 hover:bg-amber-500/25'
                  : 'border-amber-500/70 bg-surface text-amber-500/70 hover:bg-amber-500/15 hover:text-amber-500'
              "
              :title="
                favoritesStore.isFavorite(guide.id)
                  ? t('buildDiscovery.removeFavorite')
                  : t('buildDiscovery.addFavorite')
              "
              :aria-label="
                favoritesStore.isFavorite(guide.id)
                  ? t('buildDiscovery.removeFavorite')
                  : t('buildDiscovery.addFavorite')
              "
              @click.stop="favoritesStore.toggleFavorite(guide.id)"
            >
              <svg
                v-if="favoritesStore.isFavorite(guide.id)"
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

            <div v-if="!isUserGuide(guide.id)" class="flex min-w-0 flex-[2] items-stretch gap-1.5">
              <button
                type="button"
                class="matchup-guide-grid-action-button matchup-guide-grid-action-button--vote"
                :class="
                  voteStore.getUserVote(guide.id) === 'up'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'border border-green-600 bg-surface text-green-600 hover:bg-green-50'
                "
                :title="
                  voteStore.getUserVote(guide.id) === 'up'
                    ? t('buildDiscovery.removeUpvote')
                    : t('buildDiscovery.upvoteBuild')
                "
                @click.stop="handleUpvote(guide.id)"
              >
                <span>👍</span>
                <span>{{ voteStore.getUpvoteCount(guide.id) }}</span>
              </button>
              <button
                type="button"
                class="matchup-guide-grid-action-button matchup-guide-grid-action-button--vote"
                :class="
                  voteStore.getUserVote(guide.id) === 'down'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'border border-red-600 bg-surface text-red-600 hover:bg-red-50'
                "
                :title="
                  voteStore.getUserVote(guide.id) === 'down'
                    ? t('buildDiscovery.removeDownvote')
                    : t('buildDiscovery.downvoteBuild')
                "
                @click.stop="handleDownvote(guide.id)"
              >
                <span>👎</span>
                <span>{{ voteStore.getDownvoteCount(guide.id) }}</span>
              </button>
            </div>

            <button
              type="button"
              class="matchup-guide-grid-action-button matchup-guide-grid-action-button--icon flex-1"
              :title="t('buildDiscovery.share')"
              :aria-label="t('buildDiscovery.share')"
              @click.stop="copyGuideLink(guide)"
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
          </div>
        </div>
      </div>

      <div v-if="showPagination" class="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          class="pagination-btn disabled:opacity-50"
          :disabled="discoveryStore.currentPage <= 1"
          :aria-label="t('matchupGuideDiscovery.previousPage')"
          @click="discoveryStore.setPage(discoveryStore.currentPage - 1)"
        >
          ‹
        </button>
        <span class="text-sm text-text/80">
          {{
            t('matchupGuideDiscovery.pageXOfY', {
              current: discoveryStore.currentPage,
              total: totalPagesForPagination,
            })
          }}
        </span>
        <button
          type="button"
          class="pagination-btn disabled:opacity-50"
          :disabled="discoveryStore.currentPage >= totalPagesForPagination"
          :aria-label="t('matchupGuideDiscovery.nextPage')"
          @click="discoveryStore.setPage(discoveryStore.currentPage + 1)"
        >
          ›
        </button>
      </div>
    </template>

    <NotificationToast
      v-if="shareToastMessage"
      :message="shareToastMessage"
      :type="shareToastType"
      @close="shareToastMessage = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { MatchupGuide } from '@lelanation/shared-types'
import MatchupGuideCard from '~/components/MatchupGuideDiscovery/MatchupGuideCard.vue'
import NotificationToast from '~/components/NotificationToast.vue'
import { useMatchupGuideDiscoveryStore } from '~/stores/MatchupGuideDiscoveryStore'
import { useMatchupGuideFavoritesStore } from '~/stores/MatchupGuideFavoritesStore'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'
import { useMatchupGuideVoteStore } from '~/stores/MatchupGuideVoteStore'
import { matchupGuideDetailPath } from '~/utils/matchupGuideSlug'

const props = withDefaults(
  defineProps<{
    customGuides?: MatchupGuide[]
    showFavoriteToggle?: boolean
    hideBottomActions?: boolean
  }>(),
  {
    customGuides: undefined,
    showFavoriteToggle: false,
    hideBottomActions: false,
  }
)

const { t } = useI18n()
const localePath = useLocalePath()
const discoveryStore = useMatchupGuideDiscoveryStore()
const voteStore = useMatchupGuideVoteStore()
const favoritesStore = useMatchupGuideFavoritesStore()
const guideStore = useMatchupGuideStore()

const shareToastMessage = ref('')
const shareToastType = ref<'success' | 'error'>('success')

const filteredCustomGuides = computed(() => {
  if (!props.customGuides) return null
  return discoveryStore.filterGuides(props.customGuides)
})

const customTotalPages = computed(() => {
  if (!props.customGuides) return 0
  if (discoveryStore.pageSize === 'all') return 1
  const n = filteredCustomGuides.value?.length ?? 0
  return n === 0 ? 0 : Math.ceil(n / discoveryStore.pageSize)
})

const customPaginatedGuides = computed(() => {
  const list = filteredCustomGuides.value
  if (!list) return []
  if (discoveryStore.pageSize === 'all') return list
  const start = (discoveryStore.currentPage - 1) * discoveryStore.pageSize
  return list.slice(start, start + discoveryStore.pageSize)
})

const guides = computed(() =>
  props.customGuides ? customPaginatedGuides.value : discoveryStore.paginatedGuides
)

const totalPagesForPagination = computed(() =>
  props.customGuides ? customTotalPages.value : discoveryStore.totalPages
)

const showPagination = computed(() => totalPagesForPagination.value > 1)

const hasActiveFilters = computed(() => discoveryStore.hasActiveFilters)

watch(
  () => [props.customGuides, customTotalPages.value] as const,
  ([hasCustom, total]) => {
    if (hasCustom && typeof total === 'number' && total >= 1) {
      discoveryStore.clampPageToMax(total)
    }
  },
  { immediate: true }
)

function isUserGuide(guideId: string): boolean {
  return guideStore.getSavedGuides().some(g => g.id === guideId)
}

function removeGuideFromDiscoverList(guideId: string) {
  if (props.customGuides) return
  if (!discoveryStore.guides.some(g => g.id === guideId)) return
  discoveryStore.guides = discoveryStore.guides.filter(g => g.id !== guideId)
  discoveryStore.applyFilters()
}

async function handleUpvote(guideId: string) {
  voteStore.upvote(guideId)
  const privatized = await guideStore.checkAndUpdateVisibility(guideId)
  if (privatized) removeGuideFromDiscoverList(guideId)
}

async function handleDownvote(guideId: string) {
  voteStore.downvote(guideId)
  const privatized = await guideStore.checkAndUpdateVisibility(guideId)
  if (privatized) removeGuideFromDiscoverList(guideId)
}

function showShareToast(message: string, type: 'success' | 'error' = 'success') {
  shareToastMessage.value = ''
  shareToastType.value = type
  requestAnimationFrame(() => {
    shareToastMessage.value = message
  })
}

async function copyGuideLink(guide: MatchupGuide) {
  if (!import.meta.client) return
  const path = matchupGuideDetailPath(guide, localePath)
  const url = `${window.location.origin}${path}`
  try {
    await navigator.clipboard.writeText(url)
    showShareToast(t('buildDiscovery.linkCopied'))
  } catch {
    showShareToast(t('buildDiscovery.shareError'), 'error')
  }
}

onMounted(() => {
  voteStore.init()
  favoritesStore.init()
})
</script>

<style scoped>
.matchup-guide-grid-list {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-evenly;
  gap: 15px;
  padding-inline: 5px;
  box-sizing: border-box;
}

.matchup-guide-grid-item {
  display: flex;
  width: min(100%, 420px);
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  min-height: 420px;
  padding-bottom: 15px;
}

.matchup-guide-grid-author-row {
  display: flex;
  min-width: 0;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 3px;
  padding: 0 6px;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-gold-300);
  text-align: center;
  text-transform: uppercase;
}

.matchup-guide-grid-author-badge {
  flex-shrink: 0;
  border-radius: 0.35rem;
  padding: 0.1rem 0.35rem;
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
}

.matchup-guide-grid-author-badge--private {
  border: 1px solid rgb(244 63 94 / 0.45);
  background: rgb(244 63 94 / 0.12);
  color: rgb(251 113 133);
}

.matchup-guide-card-link {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  color: inherit;
  text-decoration: none;
}

.matchup-guide-grid-actions {
  display: flex;
  width: 100%;
  align-items: stretch;
  gap: 0.375rem;
  margin-top: 5px;
}

.matchup-guide-grid-action-button {
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

.matchup-guide-grid-action-button--icon {
  flex: 1;
}

.matchup-guide-grid-action-button--vote {
  flex: 1 1 0;
}

.pagination-btn {
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.45rem 0.85rem;
  font-size: 1rem;
  color: rgb(var(--rgb-text));
  transition: background-color 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: rgb(var(--rgb-primary) / 0.2);
}

@media (max-width: 639px) {
  .matchup-guide-grid-list {
    justify-content: center;
    padding-inline: 0;
  }
}
</style>
