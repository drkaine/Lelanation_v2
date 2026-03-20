<template>
  <div class="build-details min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <div v-if="loading" class="py-12 text-center">
        <p class="text-text">Loading build...</p>
      </div>

      <div v-else-if="error" class="py-12 text-center">
        <p class="text-error">{{ error }}</p>
        <NuxtLink
          :to="localePath('/builds')"
          class="mt-4 inline-block rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
        >
          Back to Builds
        </NuxtLink>
      </div>

      <div v-else-if="build" class="space-y-6">
        <div class="relative flex w-full items-center">
          <NuxtLink
            :to="localePath('/builds')"
            class="absolute left-0 flex-shrink-0 rounded bg-surface px-4 py-2 text-text transition-colors hover:bg-primary hover:text-white"
          >
            ← Retour
          </NuxtLink>
          <div class="mx-auto flex flex-col text-center">
            <h3 class="text-lg font-semibold text-text">{{ activeTitle }}</h3>
            <div class="text-sm text-text/70">
              <span class="ml-1">{{ build.author || t('buildDiscovery.anonymous') }}</span>
            </div>
          </div>
        </div>

        <OutdatedBuildBanner
          v-if="build.gameVersion"
          :build-version="build.gameVersion"
          :storage-key="`build:${build.id}:${build.gameVersion}`"
          :on-update="updateToCurrentVersion"
        />

        <div class="flex flex-col gap-6 lg:flex-row">
          <div class="flex-shrink-0 lg:w-auto">
            <div class="relative">
              <div ref="buildCardRef" :data-build-id="build.id">
                <BuildCard
                  :build="detailDisplayedBuild || build"
                  :readonly="true"
                  :sheet-tooltips="true"
                  :hide-top-actions="true"
                  @variant-change="
                    idx => {
                      detailDisplayedSubIndex = idx
                    }
                  "
                />
              </div>
            </div>

            <div class="mt-4 w-full max-w-[380px]">
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
                  v-if="isUserBuild && !isStreamerMode"
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
                    class="absolute right-0 top-full z-50 mt-1 max-h-[min(80vh,320px)] w-52 overflow-y-auto rounded-lg border border-primary shadow-lg"
                    style="background-color: rgb(26, 26, 46)"
                    @click.stop
                  >
                    <button
                      class="flex w-full items-center gap-2 rounded-t-lg px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                      @click="copyBuildLink"
                    >
                      <span class="text-base">🔗</span>
                      <span>Copier le lien</span>
                    </button>
                    <button
                      class="flex w-full items-center gap-2 border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                      @click="downloadBuildImage"
                    >
                      <span class="text-base">⬇️</span>
                      <span>Télécharger l'image</span>
                    </button>
                    <button
                      class="flex w-full items-center gap-2 border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                      @click="copyBuildImage"
                    >
                      <span class="text-base">📋</span>
                      <span>Copier l'image</span>
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

          <div class="flex-1">
            <div class="space-y-4">
              <div v-if="hasDescriptionTab" class="detail-page-tabs stats-tabs">
                <button
                  type="button"
                  class="stats-tab"
                  :class="{ 'stats-tab--active': activeDetailTab === 'description' }"
                  @click="activeDetailTab = 'description'"
                >
                  {{ t('createBuild.description') }}
                </button>
                <button
                  type="button"
                  class="stats-tab"
                  :class="{ 'stats-tab--active': activeDetailTab === 'statistics' }"
                  @click="activeDetailTab = 'statistics'"
                >
                  {{ t('createBuild.stats') }}
                </button>
              </div>

              <div
                v-show="hasDescriptionTab && activeDetailTab === 'description'"
                class="space-y-4"
              >
                <div
                  v-for="(section, sidx) in descriptionTabSections"
                  :key="`desc-${sidx}-${section.title}`"
                  class="rounded-lg border border-primary/25 bg-surface/40 p-4"
                >
                  <h2 class="mb-2 text-base font-semibold text-text">{{ section.title }}</h2>
                  <div class="text-base text-text/85">
                    <!-- eslint-disable vue/no-v-html -->
                    <p class="whitespace-pre-wrap" v-html="linkifyDescription(section.text)" />
                    <!-- eslint-enable vue/no-v-html -->
                  </div>
                </div>
              </div>

              <div
                v-show="!hasDescriptionTab || activeDetailTab === 'statistics'"
                class="space-y-2 rounded-lg border border-primary/30 p-4"
              >
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { CalculatedStats } from '@lelanation/shared-types'
import { calculateStats, filterItemsForStats } from '@lelanation/builds-stats'
import { useBuildStore } from '~/stores/BuildStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import OutdatedBuildBanner from '~/components/Build/OutdatedBuildBanner.vue'
import StatsTable from '~/components/Build/StatsTable.vue'
import { apiUrl } from '~/utils/apiUrl'
import { linkifyDescription } from '~/utils/linkifyDescription'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'
import type { Build, SubBuild } from '~/types/build'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useStreamerMode } from '~/composables/useStreamerMode'

const props = defineProps<{ buildId: string }>()

const buildStore = useBuildStore()
const voteStore = useVoteStore()
const discoveryStore = useBuildDiscoveryStore()
const favoritesStore = useFavoritesStore()
const localePath = useLocalePath()
const { t } = useI18n()
const route = useRoute()
const { hydrated } = useClientHydrated()
const { isStreamerMode } = useStreamerMode()

const loading = ref(true)
const error = ref<string | null>(null)
const detailRootBuild = ref<Build | null>(null)
const build = computed(() => detailRootBuild.value)
const openShareDropdown = ref(false)
const buildCardRef = ref<HTMLElement | null>(null)
const buildToDelete = ref<string | null>(null)

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
    description: sub.description ?? build.value.description,
    gameVersion: sub.gameVersion || build.value.gameVersion,
  } as Build
})

const activeTitle = computed(() => {
  const b = build.value
  if (!b) return ''
  if (detailDisplayedSubIndex.value === null) return b.name || b.author || 'Sans nom'
  const subs = b.subBuilds as SubBuild[] | undefined
  const sub = subs?.[detailDisplayedSubIndex.value]
  return sub?.title || b.name || b.author || 'Sans nom'
})

const activeDetailTab = ref<'description' | 'statistics'>('statistics')

const createEmptyStats = (): CalculatedStats => ({
  health: 0,
  mana: 0,
  attackDamage: 0,
  abilityPower: 0,
  armor: 0,
  magicResist: 0,
  attackSpeed: 0,
  critChance: 0,
  critDamage: 1.75,
  lifeSteal: 0,
  spellVamp: 0,
  cooldownReduction: 0,
  movementSpeed: 0,
  healthRegen: 0,
  manaRegen: 0,
  armorPenetration: 0,
  magicPenetration: 0,
  tenacity: 0,
  lethality: 0,
  percentLethality: 0,
  omnivamp: 0,
  shield: 0,
  attackRange: 0,
})

function buildStatsFor(buildToCompute: Build): CalculatedStats {
  const stats = calculateStats(
    buildToCompute.champion ?? null,
    filterItemsForStats(buildToCompute.items ?? []),
    buildToCompute.runes,
    buildToCompute.shards,
    18
  )
  return stats ?? createEmptyStats()
}

type VariantEntry = {
  key: string
  index: number | null
  title: string
  description: string
  build: Build
  stats: CalculatedStats
}

const variantEntries = computed<VariantEntry[]>(() => {
  const b = build.value
  if (!b) return []
  const mode = b.descriptionMode ?? 'single'
  const baseEntryBuild = b as Build
  const entries: VariantEntry[] = [
    {
      key: 'main',
      index: null,
      title: b.name || b.author || 'Build principal',
      description: mode === 'multiple' ? (b.description ?? '').trim() : '',
      build: baseEntryBuild,
      stats: buildStatsFor(baseEntryBuild),
    },
  ]
  const subs = (b.subBuilds as SubBuild[] | undefined) ?? []
  for (let i = 0; i < subs.length; i += 1) {
    const sub = subs[i]
    if (!sub) continue
    const merged = {
      ...b,
      items: sub.items,
      runes: sub.runes,
      shards: sub.shards,
      summonerSpells: sub.summonerSpells,
      skillOrder: sub.skillOrder,
      roles: sub.roles,
      description: sub.description ?? b.description,
      gameVersion: sub.gameVersion || b.gameVersion,
    } as Build
    entries.push({
      key: `sub-${i}`,
      index: i,
      title: sub.title || `Variante ${i + 1}`,
      description: mode === 'multiple' ? (sub.description ?? '').trim() : '',
      build: merged,
      stats: buildStatsFor(merged),
    })
  }
  return entries
})

/** Textes description pour l’onglet (mode single = une section ; multiple = une par variante avec texte). */
const descriptionTabSections = computed(() => {
  const b = build.value
  if (!b) return [] as { title: string; text: string }[]
  const mode = b.descriptionMode ?? 'single'
  if (mode === 'single') {
    const text = (b.description ?? '').trim()
    if (!text) return []
    return [{ title: b.name || b.author || t('buildDiscovery.anonymous'), text }]
  }
  const out: { title: string; text: string }[] = []
  for (const e of variantEntries.value) {
    const text = (e.description ?? '').trim()
    if (!text) continue
    out.push({ title: e.title, text })
  }
  return out
})

const hasDescriptionTab = computed(() => descriptionTabSections.value.length > 0)

/** Agrégé pour l’image « auteur + description ». */
const activeDescription = computed(() => {
  const sections = descriptionTabSections.value
  if (sections.length === 0) return ''
  if (sections.length === 1) return sections[0]?.text ?? ''
  return sections.map(s => `${s.title}: ${s.text}`).join('\n\n')
})

watch(
  () => [build.value?.id, hasDescriptionTab.value, route.query.sub] as const,
  () => {
    const subQ = route.query.sub
    if (subQ !== undefined && subQ !== null && String(subQ).trim() !== '') {
      activeDetailTab.value = 'statistics'
      return
    }
    if (hasDescriptionTab.value) activeDetailTab.value = 'description'
    else activeDetailTab.value = 'statistics'
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
  openShareDropdown.value = !openShareDropdown.value
}

const copyBuildLink = async () => {
  if (!build.value) return
  const subParam =
    typeof detailDisplayedSubIndex.value === 'number' ? `?sub=${detailDisplayedSubIndex.value}` : ''
  const buildUrl = `${window.location.origin}/builds/${build.value.id}${subParam}`
  try {
    await navigator.clipboard.writeText(buildUrl)
    openShareDropdown.value = false
  } catch (error) {
    const textarea = document.createElement('textarea')
    textarea.value = buildUrl
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    openShareDropdown.value = false
  }
}

const captureBuildImage = async (): Promise<Blob | null> => {
  if (!buildCardRef.value || !build.value) return null

  try {
    const buildCardWrapper = buildCardRef.value.querySelector('.build-card-wrapper') as HTMLElement
    if (!buildCardWrapper) return null

    // Attendre un peu pour s'assurer que tout est rendu
    await new Promise(resolve => setTimeout(resolve, 200))

    // Cloner l'élément pour éviter de modifier l'original
    const clonedElement = buildCardWrapper.cloneNode(true) as HTMLElement

    // Positionner le clone hors écran mais visible pour le rendu
    clonedElement.style.position = 'fixed'
    clonedElement.style.left = '-9999px'
    clonedElement.style.top = '0'
    clonedElement.style.zIndex = '9999'
    clonedElement.style.opacity = '1'
    clonedElement.style.visibility = 'visible'
    clonedElement.style.pointerEvents = 'none'
    document.body.appendChild(clonedElement)

    // Forcer l'affichage de la face avant (retirer l'état "flipped" sur le clone)
    const flipContainers = clonedElement.querySelectorAll('.flip-container')
    flipContainers.forEach(fc => fc.classList.remove('flipped'))
    // Cacher explicitement les faces arrière pour éviter de capturer la liste des variantes
    const backFaces = clonedElement.querySelectorAll('.build-card-back') as NodeListOf<HTMLElement>
    backFaces.forEach(b => {
      b.style.display = 'none'
    })

    // Fonction pour forcer tous les backgrounds à être transparents sauf ceux explicitement définis
    const sanitizeStyles = (element: HTMLElement) => {
      const allElements = [element, ...Array.from(element.querySelectorAll('*'))] as HTMLElement[]

      const isWhiteOrLightGrey = (color: string): boolean => {
        if (!color) return false
        const normalized = color.toLowerCase().trim()
        if (
          normalized === 'rgb(255, 255, 255)' ||
          normalized === 'rgba(255, 255, 255, 1)' ||
          normalized === '#ffffff' ||
          normalized === '#fff' ||
          normalized === 'white'
        ) {
          return true
        }
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
          if (r > 200 && g > 200 && b > 200) {
            return true
          }
        }
        return false
      }

      allElements.forEach(el => {
        const computed = window.getComputedStyle(el)
        const style = el.style
        const isSeparator = el.classList.contains('separator-line')
        const isSpellOrLevelBadge =
          el.classList.contains('skill-key') ||
          el.classList.contains('level-badge') ||
          el.classList.contains('max-badge')

        if (!isSeparator && !isSpellOrLevelBadge) {
          style.backgroundColor = 'transparent'
        }

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

        const bgColor = computed.backgroundColor
        if (
          !isSpellOrLevelBadge &&
          bgColor &&
          !isWhiteOrLightGrey(bgColor) &&
          bgColor !== 'rgba(0, 0, 0, 0)' &&
          bgColor !== 'transparent'
        ) {
          style.backgroundColor = bgColor
          if (isSeparator) {
            style.opacity = computed.opacity || '0.8'
          }
        }

        if (computed.backgroundImage && computed.backgroundImage !== 'none') {
          style.backgroundImage = computed.backgroundImage
          style.backgroundSize = computed.backgroundSize
          style.backgroundPosition = computed.backgroundPosition
          style.backgroundRepeat = computed.backgroundRepeat
        }

        const borderColor = computed.borderColor
        if (isWhiteOrLightGrey(borderColor)) {
          style.border = 'none'
          style.borderWidth = '0'
          style.borderColor = 'transparent'
        } else if (
          borderColor &&
          borderColor !== 'rgba(0, 0, 0, 0)' &&
          borderColor !== 'transparent'
        ) {
          style.borderColor = borderColor
        } else {
          style.border = 'none'
        }

        if (computed.color && computed.color !== 'rgb(0, 0, 0)') {
          style.color = computed.color
        }

        if (isSeparator) {
          style.width = computed.width || '100%'
          style.height = computed.height || '1px'
          style.margin = computed.margin || '8px 0'
        }
      })
    }

    sanitizeStyles(clonedElement)
    await new Promise(resolve => setTimeout(resolve, 300))

    const domtoimage = await import('dom-to-image-more')
    const resultBlob = await domtoimage.toBlob(clonedElement, {
      bgcolor: '#0a0a14',
      quality: 1.0,
    })

    document.body.removeChild(clonedElement)
    return resultBlob
  } catch {
    return null
  }
}

const downloadBuildImage = async () => {
  if (!build.value) return
  try {
    const blob = await captureBuildImage()
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `build-${build.value.id}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    openShareDropdown.value = false
  } catch {
    // Failed to download image
  }
}

const copyBuildImage = async () => {
  if (!build.value) return
  try {
    const blob = await captureBuildImage()
    if (!blob) return

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ])
    openShareDropdown.value = false
  } catch {
    // Fallback: télécharger l'image
    downloadBuildImage()
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

/** Wrap text to fit maxWidth; returns array of lines. */
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

/** Capture build card image then composite author + first 250 chars of description below. */
const captureBuildImageWithAuthorAndDescription = async (): Promise<Blob | null> => {
  if (!build.value) return null
  const blob = await captureBuildImage()
  if (!blob) return null

  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const cardWidth = img.width
      const cardHeight = img.height

      const authorText = (build.value?.author || t('buildDiscovery.anonymous')).trim() || '—'
      const descRaw = (activeDescription.value || '').trim().slice(0, DESCRIPTION_MAX_CHARS)
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

const copyBuildImageWithAuthorAndDescription = async () => {
  if (!build.value) return
  try {
    const blob = await captureBuildImageWithAuthorAndDescription()
    if (!blob) return

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ])
    openShareDropdown.value = false
  } catch {
    const blob = await captureBuildImageWithAuthorAndDescription()
    if (blob) {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `build-${build.value.id}-avec-auteur-description.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      openShareDropdown.value = false
    }
  }
}

// const goToTheorycraft = async () => {
//   if (!build.value) return
//   // Charger le build dans le store theorycraft avant de naviguer
//   const { useTheorycraftStore } = await import('~/stores/TheorycraftStore')
//   const theorycraftStore = useTheorycraftStore()
//   theorycraftStore.loadBuild(build.value)
//   navigateTo(localePath('/theorycraft'))
// }

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

watch(
  () => props.buildId,
  async id => {
    if (!id) return
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
          const { migrated } = await migrateBuildToCurrent(localBuild)
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
})
</script>

<style scoped>
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

.detail-page-tabs.stats-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem;
  min-height: 36px;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.2rem;
}

.detail-page-tabs .stats-tab {
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: rgb(var(--rgb-text) / 0.75);
  min-height: 30px;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.1;
  transition: all 0.2s ease;
  cursor: pointer;
}

.detail-page-tabs .stats-tab:hover {
  background: rgb(var(--rgb-primary) / 0.16);
  color: rgb(var(--rgb-text));
}

.detail-page-tabs .stats-tab--active {
  background: rgb(var(--rgb-primary) / 0.3);
  color: rgb(var(--rgb-text));
}
</style>
