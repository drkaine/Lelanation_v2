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
        <!-- Header avec retour à gauche et nom du build centré -->
        <div class="relative flex w-full items-center">
          <!-- Bouton retour à gauche -->
          <NuxtLink
            :to="localePath('/builds')"
            class="absolute left-0 flex-shrink-0 rounded bg-surface px-4 py-2 text-text transition-colors hover:bg-primary hover:text-white"
          >
            ← Retour
          </NuxtLink>
          <!-- Nom du build centré -->
          <div class="mx-auto flex flex-col text-center">
            <!-- Nom du build / variante affichée -->
            <h3 class="text-lg font-semibold text-text">{{ activeTitle }}</h3>
            <!-- Auteur -->
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

        <!-- Layout principal: Sheet à gauche, Onglets à droite -->
        <div class="flex flex-col gap-6 lg:flex-row">
          <!-- Colonne gauche: BuildCard Sheet -->
          <div class="flex-shrink-0 lg:w-auto">
            <div class="relative">
              <div ref="buildCardRef" :data-build-id="build.id">
                <BuildCard
                  :build="detailDisplayedBuild || build"
                  :readonly="true"
                  :sheet-tooltips="true"
                  @variant-change="
                    idx => {
                      detailDisplayedSubIndex = idx
                    }
                  "
                />
              </div>
              <!-- Boutons d'action utilisateur (supprimer/modifier) -->
              <div v-if="isUserBuild" class="absolute -right-5 top-0 z-50 flex flex-col gap-1.5">
                <!-- Bouton Supprimer -->
                <button
                  class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white shadow-md transition-colors hover:bg-error/80"
                  title="Supprimer le build"
                  @click.stop="confirmDelete"
                >
                  ✕
                </button>
                <!-- Bouton Modifier (symbole crayon) -->
                <NuxtLink
                  :to="localePath(`/builds/edit/${build.id}`)"
                  class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[10px] text-white shadow-md transition-colors hover:bg-accent-dark"
                  title="Modifier le build"
                  @click.stop
                >
                  ✎
                </NuxtLink>
              </div>
            </div>

            <!-- Informations en dessous de la sheet (votes, partager) -->
            <div class="mt-4 w-full max-w-[300px] space-y-2">
              <div class="flex items-center justify-end gap-2">
                <!-- Bouton Theorycraft (visible pour tous) -->
                <!-- <button
                  class="rounded border border-accent/70 bg-surface px-2 py-1 text-xs text-text transition-colors hover:bg-accent/10"
                  :title="t('theorycraft.testBuild')"
                  @click.stop="goToTheorycraft"
                >
                  <span>{{ t('theorycraft.testBuild') }}</span>
                </button> -->
                <!-- Boutons de vote (désactivés pour les builds de l'utilisateur) -->
                <div v-if="!isUserBuild" class="flex items-center gap-1">
                  <!-- Bouton Upvote -->
                  <button
                    class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
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
                  <!-- Bouton Downvote -->
                  <button
                    class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
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

                <!-- Bouton Partager avec dropdown -->
                <div class="relative">
                  <button
                    class="rounded border border-accent/70 bg-surface px-2 py-1 text-xs text-text transition-colors hover:bg-accent/10"
                    @click.stop="toggleShareDropdown"
                  >
                    Partager
                  </button>
                  <!-- Dropdown -->
                  <div
                    v-if="openShareDropdown"
                    class="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-primary shadow-lg"
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
                      class="flex w-full items-center gap-2 rounded-b-lg border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                      @click="copyBuildImage"
                    >
                      <span class="text-base">📋</span>
                      <span>Copier l'image</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Colonne droite: Description / Statistiques -->
          <div class="flex-1">
            <!-- Onglets -->
            <div class="mb-4 flex gap-2 border-b border-primary/20">
              <button
                v-if="hasDescriptionTab"
                type="button"
                class="px-4 py-2 text-sm font-semibold transition-colors"
                :class="
                  activeTab === 'description'
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-text/60 hover:text-text'
                "
                @click="activeTab = 'description'"
              >
                Description
              </button>
              <button
                type="button"
                class="px-4 py-2 text-sm font-semibold transition-colors"
                :class="
                  activeTab === 'stats'
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-text/60 hover:text-text'
                "
                @click="activeTab = 'stats'"
              >
                Statistiques
              </button>
            </div>

            <!-- Contenu onglet Description -->
            <div v-if="hasDescriptionTab && activeTab === 'description'" class="space-y-3">
              <div class="text-sm text-text/80">
                <template v-if="activeDescription">
                  <!-- eslint-disable vue/no-v-html -->
                  <p class="whitespace-pre-wrap" v-html="linkifyDescription(activeDescription)" />
                  <!-- eslint-enable vue/no-v-html -->
                </template>
              </div>

              <p v-if="build.createdAt && hydrated" class="text-xs text-text/50">
                Créé le : {{ formatDate(build.createdAt) }}
              </p>
            </div>

            <!-- Contenu onglet Statistiques -->
            <div v-else class="tab-content">
              <h2 class="mb-3 text-lg font-semibold text-text">{{ t('stats.title') }}</h2>
              <StatsTable
                v-if="detailDisplayedBuild && detailDisplayedBuild.champion"
                :build="detailDisplayedBuild"
              />
              <div v-else class="py-8 text-center">
                <p class="text-text/70">
                  {{ build ? 'Chargement du build...' : 'Aucun build chargé' }}
                </p>
              </div>
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
import { useBuildStore } from '~/stores/BuildStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import OutdatedBuildBanner from '~/components/Build/OutdatedBuildBanner.vue'
import StatsTable from '~/components/Build/StatsTable.vue'
import { apiUrl } from '~/utils/apiUrl'
import { linkifyDescription } from '~/utils/linkifyDescription'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'
import type { Build, SubBuild } from '~/types/build'
import { useClientHydrated } from '~/composables/useClientHydrated'

const props = defineProps<{ buildId: string }>()

const buildStore = useBuildStore()
const voteStore = useVoteStore()
const discoveryStore = useBuildDiscoveryStore()
const localePath = useLocalePath()
const { t } = useI18n()
const route = useRoute()
const { hydrated } = useClientHydrated()

const loading = ref(true)
const error = ref<string | null>(null)
const detailRootBuild = ref<Build | null>(null)
const build = computed(() => detailRootBuild.value)
const openShareDropdown = ref(false)
const buildCardRef = ref<HTMLElement | null>(null)
const buildToDelete = ref<string | null>(null)

/** Variante sélectionnée localement sur la page détail (null = principale). */
const detailDisplayedSubIndex = ref<number | null>(null)
const activeTab = ref<'description' | 'stats'>('description')

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

const activeDescription = computed(() => {
  const b = build.value
  if (!b) return ''
  const mode = b.descriptionMode ?? 'single'
  if (mode === 'single' || detailDisplayedSubIndex.value === null) {
    return b.description || ''
  }
  const subs = b.subBuilds as SubBuild[] | undefined
  const sub = subs?.[detailDisplayedSubIndex.value]
  return sub?.description ?? b.description ?? ''
})

const hasDescriptionTab = computed(() => {
  const b = build.value
  if (!b) return false
  const baseDesc = (b.description || '').trim()
  const subDescs = (b.subBuilds as SubBuild[] | undefined) ?? []
  const anySubDesc = subDescs.some(sub => (sub.description || '').trim().length > 0)
  return baseDesc.length > 0 || anySubDesc
})

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
          el.classList.contains('skill-key') || el.classList.contains('level-badge')

        if (!isSeparator && !isSpellOrLevelBadge) {
          style.backgroundColor = 'transparent'
        }

        if (el.classList.contains('skill-key')) {
          style.backgroundColor = 'rgba(0, 0, 0, 0.9)'
          style.color = computed.color || '#c9a227'
        } else if (el.classList.contains('level-badge')) {
          style.backgroundColor = '#c9a227'
          style.color = '#2563eb'
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
    if (newId) navigateTo(localePath(`/builds/edit/${newId}`))
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

// Onglet par défaut : description si le build en a une, sinon stats
watch(
  hasDescriptionTab,
  hasDesc => {
    activeTab.value = hasDesc ? 'description' : 'stats'
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
})
</script>
