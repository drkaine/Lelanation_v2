<template>
  <div class="build-details min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <div v-if="loading" class="py-12 text-center">
        <p class="text-text">Loading build...</p>
      </div>

      <div v-else-if="error" class="py-12 text-center">
        <p class="text-error">{{ error }}</p>
        <NuxtLink
          to="/builds"
          class="mt-4 inline-block rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
        >
          Back to Builds
        </NuxtLink>
      </div>

      <div v-else-if="build" class="space-y-6">
        <!-- Header avec retour -->
        <div class="flex w-full items-center justify-between">
          <NuxtLink
            to="/builds"
            class="rounded bg-surface px-4 py-2 text-text transition-colors hover:bg-primary hover:text-white"
          >
            ← Retour
          </NuxtLink>
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
            <!-- Informations au-dessus de la sheet (nom et auteur) -->
            <div
              class="mb-4 flex min-h-[60px] w-full max-w-[300px] flex-col justify-center space-y-1 text-center"
            >
              <!-- Nom du build -->
              <h3 class="text-lg font-semibold text-text">{{ build.name || 'Sans nom' }}</h3>
              <!-- Auteur -->
              <div class="text-sm text-text/70" :class="{ invisible: !build.author }">
                <span class="ml-1">{{ build.author || 'Placeholder' }}</span>
              </div>
            </div>

            <div class="relative">
              <div ref="buildCardRef" :data-build-id="build.id">
                <BuildCard :build="build" :readonly="true" />
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
                  :to="`/builds/edit/${build.id}`"
                  class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[10px] text-white shadow-md transition-colors hover:bg-accent-dark"
                  title="Modifier le build"
                  @click.stop
                >
                  ✎
                </NuxtLink>
              </div>
            </div>

            <!-- Informations en dessous de la sheet (description, date, votes, partager) -->
            <div class="mt-4 w-full max-w-[300px] space-y-2">
              <div class="flex items-center justify-end gap-2">
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

              <!-- Description -->
              <div class="text-sm text-text/80">
                <template v-if="build.description">
                  <p
                    v-if="build.description.length <= 150 || isDescriptionExpanded"
                    class="whitespace-pre-wrap"
                  >
                    {{ build.description }}
                  </p>
                  <p v-else class="line-clamp-3 whitespace-pre-wrap">
                    {{ build.description }}
                  </p>
                  <button
                    v-if="build.description.length > 150"
                    class="mt-1 text-xs text-accent hover:text-accent/80"
                    @click="isDescriptionExpanded = !isDescriptionExpanded"
                  >
                    {{ isDescriptionExpanded ? 'Voir moins' : 'Voir plus' }}
                  </button>
                </template>
              </div>

              <!-- Date de création -->
              <p v-if="build.createdAt" class="text-xs text-text/50">
                Créé le : {{ formatDate(build.createdAt) }}
              </p>
            </div>
          </div>

          <!-- Colonne droite: Onglets Skill Order et Statistiques -->
          <div class="flex-1">
            <!-- Tabs Navigation -->
            <div class="mb-6 flex gap-2 border-b border-primary/20">
              <button
                type="button"
                class="px-4 py-2 text-sm font-semibold transition-colors"
                :class="
                  activeTab === 'skill-order'
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-text/60 hover:text-text'
                "
                @click="activeTab = 'skill-order'"
              >
                Skill Order
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

            <!-- Tab Content: Skill Order -->
            <div v-show="activeTab === 'skill-order'" class="tab-content">
              <SkillOrderDisplay v-if="build && build.champion" :build="build" />
              <div v-else class="py-8 text-center">
                <p class="text-text/70">
                  {{ build ? 'Chargement du build...' : 'Aucun build chargé' }}
                </p>
              </div>
            </div>

            <!-- Tab Content: Statistiques -->
            <div v-show="activeTab === 'stats'" class="tab-content">
              <StatsTable v-if="build && build.champion" :build="build" />
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
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
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
import { useBuildStore } from '~/stores/BuildStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import OutdatedBuildBanner from '~/components/Build/OutdatedBuildBanner.vue'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'

const props = defineProps<{ buildId: string }>()

const buildStore = useBuildStore()
const voteStore = useVoteStore()
const discoveryStore = useBuildDiscoveryStore()

const loading = ref(true)
const error = ref<string | null>(null)
const build = computed(() => buildStore.currentBuild)
const openShareDropdown = ref(false)
const buildCardRef = ref<HTMLElement | null>(null)
const buildToDelete = ref<string | null>(null)
const activeTab = ref<'skill-order' | 'stats'>('skill-order')
const isDescriptionExpanded = ref(false)

const upvoteCount = computed(() => (build.value ? voteStore.getUpvoteCount(build.value.id) : 0))
const downvoteCount = computed(() => (build.value ? voteStore.getDownvoteCount(build.value.id) : 0))
const userVote = computed(() => (build.value ? voteStore.getUserVote(build.value.id) : null))
const isUserBuild = computed(() => {
  if (!build.value) return false
  const savedBuilds = buildStore.getSavedBuilds()
  return savedBuilds.some(b => b.id === build.value!.id)
})

const handleUpvote = async () => {
  if (!build.value) return
  voteStore.upvote(build.value.id)
  await buildStore.checkAndUpdateVisibility()
}

const handleDownvote = async () => {
  if (!build.value) return
  voteStore.downvote(build.value.id)
  await buildStore.checkAndUpdateVisibility()
}

const toggleShareDropdown = () => {
  openShareDropdown.value = !openShareDropdown.value
}

const copyBuildLink = async () => {
  if (!build.value) return
  const buildUrl = `${window.location.origin}/builds/${build.value.id}`
  try {
    await navigator.clipboard.writeText(buildUrl)
    openShareDropdown.value = false
  } catch (error) {
    // Fallback pour les navigateurs qui ne supportent pas clipboard API
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
  if (!buildCardRef.value || !build.value) {
    // eslint-disable-next-line no-console
    console.error('BuildCard element not found')
    return null
  }

  try {
    // Trouver le BuildCard à l'intérieur (élément avec classe build-card-wrapper)
    const buildCardWrapper = buildCardRef.value.querySelector('.build-card-wrapper') as HTMLElement
    if (!buildCardWrapper) {
      // eslint-disable-next-line no-console
      console.error('BuildCard wrapper not found')
      return null
    }

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

        if (!isSeparator) {
          style.backgroundColor = 'transparent'
        }

        const bgColor = computed.backgroundColor
        if (
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to capture image:', error)
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to download image:', error)
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to copy image:', error)
    // Fallback: télécharger l'image
    downloadBuildImage()
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
    if (newId) navigateTo(`/builds/edit/${newId}`)
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

    // Essayer d'abord de charger depuis le localStorage
    const ok = buildStore.loadBuild(id)
    if (ok && build.value) {
      // Migrer le build même s'il vient du localStorage pour s'assurer qu'il a la bonne structure
      try {
        const { migrated } = await migrateBuildToCurrent(build.value)
        buildStore.setCurrentBuild(migrated)
      } catch (e) {
        // Si la migration échoue, on garde le build original
        // eslint-disable-next-line no-console
        console.warn('Migration failed for local build:', e)
      }
      loading.value = false
      return
    }

    // Si pas trouvé localement, charger depuis l'API
    try {
      const { apiUrl } = await import('~/utils/apiUrl')
      const response = await fetch(apiUrl(`/api/builds/${encodeURIComponent(id)}`))
      if (response.ok) {
        const buildData = await response.json()
        // Migrer le build si nécessaire pour s'assurer qu'il a la bonne structure
        const { migrated } = await migrateBuildToCurrent(buildData)
        buildStore.setCurrentBuild(migrated)
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
