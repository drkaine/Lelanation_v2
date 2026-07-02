<template>
  <div class="build-details min-h-screen p-4 text-text">
    <div class="w-full">
      <div v-if="loading" class="py-12 text-center">
        <p class="text-text">Loading build...</p>
      </div>

      <div v-else-if="error" class="py-12 text-center">
        <p class="text-error">{{ error }}</p>
        <NuxtLink
          :to="localePath('/builds')"
          class="mt-4 inline-block rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
          :prefetch="false"
        >
          Back to Builds
        </NuxtLink>
      </div>

      <div v-else-if="build" class="space-y-4">
        <OutdatedBuildBanner
          v-if="build.gameVersion"
          :build-version="build.gameVersion"
          :storage-key="`build:${build.id}:${build.gameVersion}`"
          :on-update="updateToCurrentVersion"
        />

        <PatchStaleBuildBanner
          v-if="build.patchStale"
          :patch-stale="build.patchStale"
          :storage-key="`build:${build.id}:patch:${build.patchStale.patchVersion}`"
        />

        <div class="build-detail-toolbar">
          <NuxtLink
            :to="localePath('/builds')"
            class="build-detail-back flex-shrink-0 rounded bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-primary hover:text-white"
            :prefetch="false"
          >
            ← Retour
          </NuxtLink>

          <div class="build-detail-toolbar__tabs scrollable-tabs-scroll-wrap min-w-0 flex-1">
            <div class="detail-page-tabs streamer-tabs scrollable-tabs-nav">
              <button
                type="button"
                class="streamer-tab-button"
                :class="{ 'is-active': activeDetailTab === 'statistics' }"
                @click="activeDetailTab = 'statistics'"
              >
                {{ t('createBuild.stats') }}
              </button>
              <button
                v-if="linkedGuide"
                type="button"
                class="streamer-tab-button"
                :class="{ 'is-active': activeDetailTab === 'guide' }"
                @click="activeDetailTab = 'guide'"
              >
                {{ t('buildDetailPage.tabGuide') }}
              </button>
              <button
                type="button"
                class="streamer-tab-button"
                :class="{ 'is-active': activeDetailTab === 'theorycraft' }"
                @click="activeDetailTab = 'theorycraft'"
              >
                {{ t('nav.theorycraft') }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="activeDetailTab === 'statistics'" class="flex flex-col gap-6 lg:flex-row">
          <div class="w-full flex-shrink-0 lg:w-auto">
            <div class="build-detail-card-column w-full max-w-full md:max-w-[380px]">
              <div class="build-detail-card-bar mb-[3px] flex w-full items-center gap-2">
                <div class="build-detail-card-bar__icon-slot">
                  <button
                    v-if="hasDisplayedDescription"
                    type="button"
                    class="build-detail-card-bar__icon-button"
                    :title="
                      cardFlipped
                        ? t('buildDetailPage.viewBuild')
                        : t('buildDetailPage.viewDescription')
                    "
                    :aria-label="
                      cardFlipped
                        ? t('buildDetailPage.viewBuild')
                        : t('buildDetailPage.viewDescription')
                    "
                    @click.stop="toggleCardDescription"
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
                  <div v-else class="build-detail-card-bar__icon-spacer" />
                </div>
                <div class="build-detail-card-bar__author-row">
                  <span class="truncate font-semibold">
                    {{ build.author || t('buildDiscovery.anonymous') }}
                  </span>
                </div>
              </div>

              <div ref="buildCardRef" :data-build-id="build.id">
                <BuildCard
                  ref="buildCardComponentRef"
                  v-model:flipped="cardFlipped"
                  :build="detailDisplayedBuild || build"
                  :readonly="true"
                  :sheet-tooltips="true"
                  :hide-top-actions="true"
                  selection-mode="none"
                  @variant-change="
                    idx => {
                      detailDisplayedSubIndex = idx
                    }
                  "
                />
              </div>
            </div>

            <div class="mt-4 w-full max-w-full md:max-w-[380px]">
              <div class="build-details-actions flex flex-wrap items-stretch gap-1.5">
                <button
                  v-if="build && !isUserBuild"
                  type="button"
                  class="details-action-btn details-action-btn--icon"
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
                    class="h-3.5 w-3.5 shrink-0"
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
                    class="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.5L6 22V3.75Z"
                    />
                  </svg>
                </button>
                <div v-if="!isUserBuild" class="flex min-w-0 flex-[2] items-stretch gap-1.5">
                  <button
                    type="button"
                    class="details-action-btn details-action-btn--vote"
                    :class="
                      userVote === 'up'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'border border-green-600 bg-surface text-green-600 hover:bg-green-50'
                    "
                    :title="userVote === 'up' ? 'Retirer votre upvote' : 'Upvoter ce build'"
                    @click.stop="handleUpvote"
                  >
                    <span>👍</span>
                    <span>{{ upvoteCount }}</span>
                  </button>
                  <button
                    type="button"
                    class="details-action-btn details-action-btn--vote"
                    :class="
                      userVote === 'down'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'border border-red-600 bg-surface text-red-600 hover:bg-red-50'
                    "
                    :title="userVote === 'down' ? 'Retirer votre downvote' : 'Downvoter ce build'"
                    @click.stop="handleDownvote"
                  >
                    <span>👎</span>
                    <span>{{ downvoteCount }}</span>
                  </button>
                </div>

                <NuxtLink
                  v-if="isUserBuild"
                  :to="localePath(`/builds/create/rune?editId=${build.id}`)"
                  class="details-action-btn details-action-btn--icon details-action-btn--edit"
                  :title="t('buildDiscovery.editBuild')"
                  :aria-label="t('buildDiscovery.editBuild')"
                  @click.stop
                >
                  ✎
                </NuxtLink>

                <div class="relative min-w-0 flex-1">
                  <button
                    ref="shareToggleButtonRef"
                    type="button"
                    class="details-action-btn details-action-btn--icon w-full min-w-[88px]"
                    :title="t('buildDiscovery.share')"
                    :aria-label="t('buildDiscovery.share')"
                    @click.stop="toggleShareDropdown"
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
                      class="shrink-0"
                      aria-hidden="true"
                    >
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
                    </svg>
                  </button>
                  <div
                    v-if="openShareDropdown"
                    :class="[
                      'absolute right-0 z-50 w-52 rounded-lg border border-primary shadow-lg',
                      openShareDropdownAbove ? 'bottom-full mb-1' : 'top-full mt-1',
                    ]"
                    style="background-color: rgb(26, 26, 46)"
                    @click.stop
                  >
                    <button
                      class="flex w-full items-center gap-2 rounded-t-lg px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                      @click="copyBuildLink"
                    >
                      <span class="text-base">🔗</span>
                      <span>{{ t('buildDiscovery.copyLink') }}</span>
                    </button>
                    <button
                      class="flex w-full items-center gap-2 border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                      @click="downloadBuildImage"
                    >
                      <span class="text-base">⬇️</span>
                      <span>{{ t('buildDiscovery.downloadImage') }}</span>
                    </button>
                    <button
                      class="flex w-full items-center gap-2 border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                      @click="copyBuildImage"
                    >
                      <span class="text-base">📋</span>
                      <span>{{ t('buildDiscovery.copyImage') }}</span>
                    </button>
                    <button
                      class="flex w-full items-center gap-2 rounded-b-lg border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                      @click="copyBuildImageWithAuthorAndDescription"
                    >
                      <span class="text-base">🖼️</span>
                      <span>{{ t('buildDiscovery.shareImageWithAuthorDescription') }}</span>
                    </button>
                  </div>
                </div>

                <button
                  v-if="isUserBuild"
                  type="button"
                  class="details-action-btn details-action-btn--icon details-action-btn--delete"
                  :title="t('buildDiscovery.deleteBuild')"
                  :aria-label="t('buildDiscovery.deleteBuild')"
                  @click.stop="confirmDelete"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="space-y-4">
              <div class="space-y-2 rounded-lg border border-primary/30 p-4">
                <h2 class="text-lg font-semibold text-text">{{ t('stats.title') }}</h2>
                <StatsTable
                  v-if="detailDisplayedBuild && detailDisplayedBuild.champion"
                  :build="detailDisplayedBuild"
                />
              </div>

              <p v-if="build.createdAt && hydrated" class="text-xs text-text/50">
                Créé le : {{ formatDate(build.createdAt) }}
              </p>
            </div>
          </div>
        </div>

        <BuildDetailGuideTab
          v-if="linkedGuide && activeDetailTab === 'guide'"
          :guide="linkedGuide"
        />

        <BuildDetailTheorycraftTab
          v-if="activeDetailTab === 'theorycraft' && detailDisplayedBuild"
          :build="detailDisplayedBuild"
        />
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="buildToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black"
      @click="buildToDelete = null"
    >
      <div
        class="mx-4 w-full max-w-md rounded-lg bg-surface p-6"
        style="background-color: var(--color-surface); opacity: 1"
        @click.stop
      >
        <h3 class="mb-4 text-lg font-bold text-text">Supprimer le build ?</h3>
        <p class="mb-6 text-text">
          Êtes-vous sûr de vouloir supprimer ce build ? Cette action est irréversible.
        </p>
        <div class="flex gap-4">
          <button
            class="rounded-lg bg-error px-4 py-2 text-text transition-colors hover:bg-error/80"
            @click="deleteBuild"
          >
            Supprimer
          </button>
          <button
            class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-text transition-colors hover:bg-accent/10"
            @click="buildToDelete = null"
          >
            Annuler
          </button>
        </div>
      </div>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import { useMatchupGuideDiscoveryStore } from '~/stores/MatchupGuideDiscoveryStore'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildDetailGuideTab from '~/components/Build/BuildDetailGuideTab.vue'
import BuildDetailTheorycraftTab from '~/components/Build/BuildDetailTheorycraftTab.vue'
import NotificationToast from '~/components/NotificationToast.vue'
import OutdatedBuildBanner from '~/components/Build/OutdatedBuildBanner.vue'
import PatchStaleBuildBanner from '~/components/Build/PatchStaleBuildBanner.vue'
import StatsTable from '~/components/Build/StatsTable.vue'
import { apiUrl } from '~/utils/apiUrl'
import {
  fetchBuildCardSharePngResilient,
  copyPngBlobToClipboard,
} from '~/utils/buildCardShareImage'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'
import { findMatchupGuideForBuildId } from '~/utils/matchupGuideByBuild'
import { championWithStatsForBuild, resolveChampionStatsForBuild } from '~/utils/theorycraftStats'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import type { Build, SubBuild } from '~/types/build'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useChampionSplashPreference } from '~/composables/useChampionSplashPreference'

const props = defineProps<{ buildId: string; initialBuild?: Build | null }>()

const buildStore = useBuildStore()
const voteStore = useVoteStore()
const discoveryStore = useBuildDiscoveryStore()
const favoritesStore = useFavoritesStore()
const matchupGuideDiscoveryStore = useMatchupGuideDiscoveryStore()
const matchupGuideStore = useMatchupGuideStore()
const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const localePath = useLocalePath()
const { t, locale } = useI18n()
const riotLocale = computed(() => (locale.value === 'en' ? 'en_US' : 'fr_FR'))
const route = useRoute()
const { hydrated } = useClientHydrated()
const { championSplashEnabled } = useChampionSplashPreference()

const loading = ref(!props.initialBuild)
const error = ref<string | null>(null)
const detailRootBuild = ref<Build | null>(props.initialBuild ?? null)
const build = computed(() => detailRootBuild.value)
const openShareDropdown = ref(false)
const openShareDropdownAbove = ref(false)
const buildCardRef = ref<HTMLElement | null>(null)
const buildCardComponentRef = ref<{ toggleFlipped: () => void } | null>(null)
const cardFlipped = ref(false)
const shareToggleButtonRef = ref<HTMLButtonElement | null>(null)
const buildToDelete = ref<string | null>(null)
const shareToastMessage = ref('')
const shareToastType = ref<'success' | 'error'>('success')

type DetailTab = 'statistics' | 'guide' | 'theorycraft'
const activeDetailTab = ref<DetailTab>('statistics')

type ShareTrackType = 'link' | 'image' | 'image_with_meta'

/** Variante affichée sur la BuildCard (null = principale). */
const detailDisplayedSubIndex = ref<number | null>(null)

const detailDisplayedBuild = computed<Build | null>(() => {
  if (!build.value) return null
  if (detailDisplayedSubIndex.value === null) return build.value
  const subs = build.value.subBuilds as SubBuild[] | undefined
  const sub = subs?.[detailDisplayedSubIndex.value]
  if (!sub) return build.value
  return {
    ...build.value,
    items: sub.items,
    runes: sub.runes,
    shards: sub.shards,
    summonerSpells: sub.summonerSpells,
    skillOrder: sub.skillOrder,
    roles: sub.roles,
    tags: sub.tags !== undefined ? sub.tags : (build.value.tags ?? []),
    description: sub.description ?? build.value.description,
    gameVersion: sub.gameVersion || build.value.gameVersion,
  } as Build
})

const linkedGuide = computed(() => {
  if (!build.value?.id) return null
  const guides = [...matchupGuideDiscoveryStore.guides, ...matchupGuideStore.getSavedGuides()]
  return findMatchupGuideForBuildId(build.value.id, guides)
})

function getDisplayedDescription(target: Build): string | undefined {
  const idx = detailDisplayedSubIndex.value
  if (idx === null) return target.description
  const sub = (target.subBuilds ?? [])[idx]
  return sub?.description ?? target.description
}

const hasDisplayedDescription = computed(() => {
  if (!build.value) return false
  return Boolean(getDisplayedDescription(build.value)?.trim())
})

function toggleCardDescription() {
  buildCardComponentRef.value?.toggleFlipped()
  cardFlipped.value = !cardFlipped.value
}

watch(linkedGuide, guide => {
  if (!guide && activeDetailTab.value === 'guide') {
    activeDetailTab.value = 'statistics'
  }
})

watch(
  () => [build.value?.id, route.query.sub] as const,
  () => {
    const subQ = route.query.sub
    if (subQ !== undefined && subQ !== null && String(subQ).trim() !== '') {
      activeDetailTab.value = 'statistics'
    }
  },
  { immediate: true }
)

const upvoteCount = computed(() => (build.value ? voteStore.getUpvoteCount(build.value.id) : 0))
const downvoteCount = computed(() => (build.value ? voteStore.getDownvoteCount(build.value.id) : 0))
const userVote = computed(() => (build.value ? voteStore.getUserVote(build.value.id) : null))
const isUserBuild = computed(() => {
  if (!hydrated.value || !build.value) return false
  const savedBuilds = buildStore.getSavedBuilds()
  return savedBuilds.some(b => b.id === build.value!.id)
})
const SHARE_DROPDOWN_ESTIMATED_HEIGHT_PX = 190
const VIEWPORT_SAFE_MARGIN_PX = 12

const handleUpvote = async () => {
  if (!build.value) return
  voteStore.upvote(build.value.id)
  await buildStore.checkAndUpdateVisibility(build.value.id)
}

const handleDownvote = async () => {
  if (!build.value) return
  voteStore.downvote(build.value.id)
  await buildStore.checkAndUpdateVisibility(build.value.id)
}

const toggleShareDropdown = () => {
  if (openShareDropdown.value) {
    openShareDropdown.value = false
    return
  }
  const trigger = shareToggleButtonRef.value
  if (trigger) {
    const rect = trigger.getBoundingClientRect()
    openShareDropdownAbove.value =
      rect.bottom + SHARE_DROPDOWN_ESTIMATED_HEIGHT_PX + VIEWPORT_SAFE_MARGIN_PX >
      window.innerHeight
  } else {
    openShareDropdownAbove.value = false
  }
  openShareDropdown.value = true
}

const trackBuildShare = async (shareType: ShareTrackType) => {
  if (!build.value?.id) return
  try {
    await fetch(apiUrl(`/api/builds/${encodeURIComponent(build.value.id)}/track-share`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareType }),
    })
  } catch {
    // Ignore analytics errors
  }
}

const showShareToast = (message: string, type: 'success' | 'error' = 'success') => {
  shareToastMessage.value = ''
  shareToastType.value = type
  requestAnimationFrame(() => {
    shareToastMessage.value = message
  })
}

const closeShareToast = () => {
  shareToastMessage.value = ''
}

const copyBuildLink = async () => {
  if (!build.value) return
  const subParam =
    typeof detailDisplayedSubIndex.value === 'number' ? `?sub=${detailDisplayedSubIndex.value}` : ''
  const buildUrl = `${window.location.origin}/builds/${build.value.id}${subParam}`

  try {
    await navigator.clipboard.writeText(buildUrl)
    trackBuildShare('link').catch(() => {})
    openShareDropdown.value = false
    showShareToast(t('buildDiscovery.linkCopied'), 'success')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = buildUrl
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)

    if (copied) {
      trackBuildShare('link').catch(() => {})
      openShareDropdown.value = false
      showShareToast(t('buildDiscovery.linkCopied'), 'success')
    } else {
      showShareToast(t('buildDiscovery.imageCopyError'), 'error')
    }
  }
}

function detailShareImageOptions(meta: boolean) {
  const sub = detailDisplayedSubIndex.value
  return {
    sub: typeof sub === 'number' ? sub : null,
    meta,
    splash: championSplashEnabled.value,
    cardHost: buildCardRef.value,
  }
}

const downloadBuildImage = async () => {
  if (!build.value) return
  try {
    const b = build.value
    const blob = await fetchBuildCardSharePngResilient(
      b,
      locale.value,
      detailShareImageOptions(false)
    )
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `build-${build.value.id}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    trackBuildShare('image').catch(() => {})
    openShareDropdown.value = false
  } catch {
    // Failed to download image
  }
}

const copyBuildImage = async () => {
  if (!build.value) return
  try {
    const b = build.value
    const blob = await fetchBuildCardSharePngResilient(
      b,
      locale.value,
      detailShareImageOptions(false)
    )
    if (!blob) {
      console.warn('[BuildDetailsPage] fetch build card png returned null', build.value.id)
      showShareToast(t('buildDiscovery.imageCopyError'), 'error')
      return
    }

    const copied = await copyPngBlobToClipboard(blob)
    if (!copied) {
      showShareToast(t('buildDiscovery.imageCopyError'), 'error')
      return
    }

    trackBuildShare('image').catch(() => {})
    openShareDropdown.value = false
    showShareToast(t('buildDiscovery.imageCopied'), 'success')
  } catch {
    showShareToast(t('buildDiscovery.imageCopyError'), 'error')
  }
}

const copyBuildImageWithAuthorAndDescription = async () => {
  if (!build.value) return
  try {
    const b = build.value
    const blob = await fetchBuildCardSharePngResilient(
      b,
      locale.value,
      detailShareImageOptions(true)
    )
    if (!blob) {
      console.warn('[BuildDetailsPage] fetch build card png (meta) returned null', build.value.id)
      showShareToast(t('buildDiscovery.imageCopyError'), 'error')
      return
    }

    const copied = await copyPngBlobToClipboard(blob)
    if (!copied) {
      showShareToast(t('buildDiscovery.imageCopyError'), 'error')
      return
    }

    trackBuildShare('image_with_meta').catch(() => {})
    openShareDropdown.value = false
    showShareToast(t('buildDiscovery.imageCopied'), 'success')
  } catch {
    showShareToast(t('buildDiscovery.imageCopyError'), 'error')
  }
}

const confirmDelete = () => {
  if (!build.value) return
  buildToDelete.value = build.value.id
}

const deleteBuild = async () => {
  if (buildToDelete.value) {
    const success = await buildStore.deleteBuild(buildToDelete.value)
    if (success) {
      // Recharger la liste des builds pour mettre à jour l'affichage
      await discoveryStore.loadBuilds()
      buildToDelete.value = null
      navigateTo('/builds')
    } else {
      // Afficher une erreur si la suppression a échoué
      error.value = buildStore.error || 'Erreur lors de la suppression du build'
    }
  }
}

const updateToCurrentVersion = async () => {
  if (!build.value) return
  try {
    const { migrated } = await migrateBuildToCurrent(build.value)
    const newId = buildStore.importBuild(migrated, { nameSuffix: ' (maj)' })
    if (newId) navigateTo(localePath(`/builds/create/rune?editId=${newId}`))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Migration failed'
  }
}

async function enrichDetailBuildChampion(target: Build): Promise<Build> {
  const championId = target.champion?.id
  if (!championId || resolveChampionStatsForBuild(target.champion)) return target

  if (championsStore.champions.length === 0) {
    await championsStore.loadChampions(riotLocale.value).catch(() => undefined)
  }

  let enriched = championsStore.champions.find(champion => champion.id === championId) ?? null
  if (!resolveChampionStatsForBuild(enriched)) {
    enriched =
      (await championsStore.loadChampionDetails(championId, riotLocale.value).catch(() => null)) ??
      enriched
  }

  if (!enriched || !resolveChampionStatsForBuild(enriched)) return target

  return {
    ...target,
    champion: championWithStatsForBuild({ ...target.champion!, ...enriched }),
  }
}

let enrichDetailBuildRequest = 0

watch(
  () => detailRootBuild.value,
  async target => {
    if (!target?.champion?.id) return
    const requestId = ++enrichDetailBuildRequest
    const enriched = await enrichDetailBuildChampion(target)
    if (requestId !== enrichDetailBuildRequest || enriched === target) return
    detailRootBuild.value = enriched
  },
  { immediate: true }
)

watch(
  () => detailRootBuild.value?.id,
  buildId => {
    if (!buildId) return
    itemsStore.loadItems(riotLocale.value).catch(() => undefined)
  },
  { immediate: true }
)

watch(
  () => [props.buildId, props.initialBuild] as const,
  async ([id, seededBuild]) => {
    if (!id) return
    if (seededBuild && seededBuild.id === id) {
      detailRootBuild.value = seededBuild
      loading.value = false
      error.value = null
      return
    }
    if (detailRootBuild.value?.id === id) {
      loading.value = false
      return
    }
    loading.value = true
    error.value = null
    detailDisplayedSubIndex.value = null

    // Lire ?sub= pour afficher directement un sous-build
    const subParam = route.query.sub
    if (subParam !== undefined && subParam !== null) {
      const subIdx = parseInt(String(subParam), 10)
      if (!isNaN(subIdx) && subIdx >= 0) {
        detailDisplayedSubIndex.value = subIdx
      }
    }

    // Client-only: localStorage override AFTER hydration (prevents SSR/CSR mismatch)
    if (import.meta.client && hydrated.value) {
      try {
        const savedBuilds = buildStore.getSavedBuilds()
        const localBuild = savedBuilds.find(b => b.id === id) || null
        if (localBuild) {
          const withPatchStale = await buildStore.applyServerPatchStale(localBuild)
          const { migrated } = await migrateBuildToCurrent(withPatchStale)
          detailRootBuild.value = migrated
          loading.value = false
          return
        }
      } catch {
        // Failed to load local build
      }
    }

    // Si pas trouvé localement, charger depuis l'API
    try {
      fetch(apiUrl(`/api/builds/${encodeURIComponent(id)}/track-view`), {
        method: 'POST',
      }).catch(() => {})
      const response = await fetch(apiUrl(`/api/builds/${encodeURIComponent(id)}`))
      if (response.ok) {
        const buildData = await response.json()
        const { hydrateBuild, isStoredBuild } = await import('~/utils/buildSerialize')
        const buildToMigrate = isStoredBuild(buildData) ? hydrateBuild(buildData) : buildData
        const { migrated } = await migrateBuildToCurrent(buildToMigrate)
        detailRootBuild.value = migrated
      } else {
        error.value = 'Build not found'
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load build'
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)

const formatDate = (dateString: string): string => {
  if (!hydrated.value) return ''
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

onMounted(() => {
  voteStore.init()
  favoritesStore.init()
  matchupGuideDiscoveryStore.loadGuides().catch(() => undefined)
})
</script>

<style scoped>
.build-detail-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.build-detail-toolbar__tabs {
  display: flex;
  justify-content: center;
}

@media (min-width: 768px) {
  .build-detail-toolbar__tabs {
    justify-content: flex-start;
  }
}

/* Aligné sur BuildGrid : barre d’actions sous la carte */
.build-details-actions .details-action-btn {
  display: inline-flex;
  height: 32px;
  min-height: 32px;
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
  color: rgb(var(--rgb-text));
  text-decoration: none;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
  box-sizing: border-box;
}

.build-details-actions .details-action-btn--vote {
  flex: 1 1 0;
  min-width: 0;
}

.build-details-actions .details-action-btn--icon {
  flex: 1;
  min-width: 36px;
}

.build-details-actions .details-action-btn--delete {
  border-color: rgb(127 29 29 / 0.85);
  background: rgb(127 29 29 / 0.28);
  color: rgb(254 202 202);
  font-size: 13px;
  font-weight: 700;
}

.build-details-actions .details-action-btn--delete:hover {
  border-color: rgb(153 27 27 / 1);
  background: rgb(153 27 27 / 0.5);
  color: rgb(254 226 226);
}

.build-details-actions .details-action-btn--edit {
  border-color: rgb(56 189 248 / 0.85);
  background: rgb(56 189 248 / 0.24);
  color: rgb(186 230 253);
  font-size: 13px;
  font-weight: 700;
}

.build-details-actions .details-action-btn--edit:hover {
  border-color: rgb(14 165 233 / 1);
  background: rgb(14 165 233 / 0.42);
  color: rgb(224 242 254);
}

.detail-page-tabs.streamer-tabs {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.25rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 9999px;
  background: rgb(var(--rgb-background) / 0.22);
  padding: 0.2rem;
  max-width: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.detail-page-tabs.streamer-tabs::-webkit-scrollbar {
  display: none;
}

.detail-page-tabs .streamer-tab-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  scroll-snap-align: start;
  white-space: nowrap;
  border: none;
  border-radius: 9999px;
  background: transparent;
  min-height: 36px;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.1;
  color: rgb(var(--rgb-text) / 0.75);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.detail-page-tabs .streamer-tab-button.is-active {
  background: rgb(var(--rgb-accent) / 0.2);
  color: var(--color-accent);
}

.build-detail-card-bar__icon-slot {
  width: 28px;
  flex-shrink: 0;
}

.build-detail-card-bar__icon-spacer {
  width: 28px;
  height: 28px;
}

.build-detail-card-bar__icon-button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.45);
  border-radius: 6px;
  background: rgb(var(--rgb-background) / 0.22);
  color: var(--color-gold-300, #f0e6d2);
  transition:
    box-shadow 0.2s ease,
    color 0.2s ease;
}

.build-detail-card-bar__icon-button:hover {
  box-shadow: 0 4px 14px var(--card-border-color-soft-default);
  color: var(--color-gold-300);
}

.build-detail-card-bar__author-row {
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
</style>
